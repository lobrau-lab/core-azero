
import { ChannelSettings, MasterSettings, AudioMeterData } from '../types';

// --- Multithreaded AudioWorklet Code (Injected as Blob) ---
const GATE_PROCESSOR_CODE = `
class OmniGateProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.envelope = 0;
    this.gain = 1;
  }
  
  static get parameterDescriptors() {
    return [
        {name: 'threshold', defaultValue: -100, minValue: -100, maxValue: 0},
        {name: 'bypass', defaultValue: 1, minValue: 0, maxValue: 1}
    ];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const thresholdDB = parameters.threshold[0];
    const bypass = parameters.bypass[0] > 0.5;
    
    if (bypass) {
        if (input && output) {
             for (let c = 0; c < input.length; ++c) {
                 if (output[c]) output[c].set(input[c]);
             }
        }
        return true;
    }

    if (!input || input.length === 0) return true;

    const thresholdLinear = Math.pow(10, thresholdDB / 20);
    const attack = 0.005;
    const release = 0.001;
    const gainAttack = 0.01;
    const gainRelease = 0.005;

    const inputLen = input[0].length;
    const numChannels = input.length;

    for (let i = 0; i < inputLen; ++i) {
        let lvl = 0;
        for (let c = 0; c < numChannels; ++c) {
            const channel = input[c];
            if (channel !== undefined) {
                const val = channel[i];
                const absVal = val < 0 ? -val : val;
                if (absVal > lvl) {
                    lvl = absVal;
                }
            }
        }
        
        if (lvl > this.envelope) {
            this.envelope += (lvl - this.envelope) * attack;
        } else {
            this.envelope += (lvl - this.envelope) * release;
        }

        let targetGain = (this.envelope > thresholdLinear) ? 1.0 : 0.0;
        
        if (targetGain > this.gain) {
            this.gain += (targetGain - this.gain) * gainAttack;
        } else {
            this.gain += (targetGain - this.gain) * gainRelease;
        }
        
        for (let c = 0; c < input.length; ++c) {
            if (input[c] && output[c]) {
                output[c][i] = input[c][i] * this.gain;
            }
        }
    }
    return true;
  }
}
registerProcessor('omni-gate', OmniGateProcessor);
`;

interface ChannelStripNodes {
  source: MediaStreamAudioSourceNode | MediaElementAudioSourceNode | null;
  gateNode: AudioWorkletNode | null;
  compressorNode: DynamicsCompressorNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  panNode: StereoPannerNode;
  gainNode: GainNode;
  meterNode: AnalyserNode;
  stream: MediaStream | null;
  inputHead?: AudioNode;
  audioElement?: HTMLAudioElement;
}

class AudioEngine {
  private context: AudioContext | null = null;
  private channels: Map<number, ChannelStripNodes> = new Map();
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterReverb: ConvolverNode | null = null;
  private masterReverbGain: GainNode | null = null;
  private masterDelay: DelayNode | null = null;
  private masterDelayFeedback: GainNode | null = null;
  private masterDelayGain: GainNode | null = null;
  private masterNoiseReduction: BiquadFilterNode | null = null;
  private masterHighpass: BiquadFilterNode | null = null;
  private masterSmartEQLow: BiquadFilterNode | null = null;
  private masterSmartEQMid: BiquadFilterNode | null = null;
  private masterSmartEQHigh: BiquadFilterNode | null = null;
  private masterGlueComp: DynamicsCompressorNode | null = null;
  private masterLoudnessGain: GainNode | null = null;
  private masterMeter: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private workletInitialized = false;
  private currentOutputDeviceId: string = 'default';
  
  // Metering Smoothing State
  private meterStates: Map<number, AudioMeterData> = new Map();
  private masterMeterState: AudioMeterData = { rms: 0, peak: 0 };
  private readonly DECAY_FACTOR = 0.85;

  public onNeedsHealing: ((reason: string) => void) | null = null;

  constructor() {
    this.channels = new Map();
  }

  // Allow configuring latency/sample rate for "Driver" simulation
  async initialize(latencyHint: AudioContextLatencyCategory | number = 'interactive', sampleRate: number = 48000) {
    if (this.context) {
        if (this.context.state !== 'closed') await this.context.close();
    }
    
    // @ts-ignore - Some browsers strictly enforce typed latencyHint
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
    }
    this.context = new AudioContextClass({ latencyHint, sampleRate });
    this.workletInitialized = false;

    // Self-Healing: Monitor Context State
    this.context.onstatechange = () => {
        if (this.context?.state === 'suspended' || this.context?.state === 'closed') {
            console.warn(`[AudioEngine] Context state changed to ${this.context.state}. Attempting recovery...`);
            this.context.resume().catch(() => {
                // If resume fails, we need a hard reboot
                if (this.onNeedsHealing) this.onNeedsHealing("Audio Context Crashed (Hard Reboot Required)");
            });
        }
    };

    // Load AudioWorklet (Multithreading)
    try {
        const blob = new Blob([GATE_PROCESSOR_CODE], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        await this.context.audioWorklet.addModule(url);
        this.workletInitialized = true;
        console.log("OmniGate Processor Loaded on Audio Thread");
    } catch (e) {
        console.warn("Failed to load AudioWorklet, Gates will be bypassed", e);
    }

    // Master Bus Chain
    this.masterCompressor = this.context.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -0.5;
    this.masterCompressor.ratio.value = 20;
    this.masterCompressor.attack.value = 0.001;
    this.masterCompressor.release.value = 0.1;

    this.masterGain = this.context.createGain();

    // Noise Reduction (Lowpass filter)
    this.masterNoiseReduction = this.context.createBiquadFilter();
    this.masterNoiseReduction.type = 'lowpass';
    this.masterNoiseReduction.frequency.value = 20000; // Default off

    // Reverb
    this.masterReverb = this.context.createConvolver();
    this.masterReverbGain = this.context.createGain();
    this.masterReverbGain.gain.value = 0;
    
    // Create a simple impulse response for reverb
    const length = sampleRate * 2.0; // 2 seconds
    const impulse = this.context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const decay = Math.exp(-i / (sampleRate * 0.5));
      left[i] = (Math.random() * 2 - 1) * decay;
      right[i] = (Math.random() * 2 - 1) * decay;
    }
    this.masterReverb.buffer = impulse;

    // Delay
    this.masterDelay = this.context.createDelay(2.0);
    this.masterDelay.delayTime.value = 0.3; // 300ms
    this.masterDelayFeedback = this.context.createGain();
    this.masterDelayFeedback.gain.value = 0.3;
    this.masterDelayGain = this.context.createGain();
    this.masterDelayGain.gain.value = 0;

    // Delay Feedback Loop
    this.masterDelay.connect(this.masterDelayFeedback);
    this.masterDelayFeedback.connect(this.masterDelay);
    this.masterDelay.connect(this.masterDelayGain);
    
    // Mastering Nodes
    this.masterHighpass = this.context.createBiquadFilter();
    this.masterHighpass.type = 'highpass';
    this.masterHighpass.frequency.value = 10; // Default off (10Hz)

    this.masterSmartEQLow = this.context.createBiquadFilter();
    this.masterSmartEQLow.type = 'lowshelf';
    this.masterSmartEQLow.frequency.value = 100;

    this.masterSmartEQMid = this.context.createBiquadFilter();
    this.masterSmartEQMid.type = 'peaking';
    this.masterSmartEQMid.frequency.value = 2500;
    this.masterSmartEQMid.Q.value = 0.7;

    this.masterSmartEQHigh = this.context.createBiquadFilter();
    this.masterSmartEQHigh.type = 'highshelf';
    this.masterSmartEQHigh.frequency.value = 8000;

    this.masterGlueComp = this.context.createDynamicsCompressor();
    this.masterGlueComp.threshold.value = 0;
    this.masterGlueComp.ratio.value = 1;

    this.masterLoudnessGain = this.context.createGain();
    this.masterLoudnessGain.gain.value = 1;

    // Master Meter Setup
    this.masterMeter = this.context.createAnalyser();
    this.masterMeter.fftSize = 2048;
    this.masterMeter.smoothingTimeConstant = 0.8;

    this.destination = this.context.createMediaStreamDestination();

    // Chain: Gain -> NoiseReduction -> FX -> Mastering -> Comp(Limiter) -> Meter -> Out
    this.masterGain.connect(this.masterNoiseReduction);
    
    this.masterNoiseReduction.connect(this.masterReverb);
    this.masterReverb.connect(this.masterReverbGain);
    this.masterReverbGain.connect(this.masterHighpass);

    this.masterNoiseReduction.connect(this.masterDelay);
    this.masterDelayGain.connect(this.masterHighpass);

    this.masterNoiseReduction.connect(this.masterHighpass);
    
    // Mastering Chain
    this.masterHighpass.connect(this.masterSmartEQLow);
    this.masterSmartEQLow.connect(this.masterSmartEQMid);
    this.masterSmartEQMid.connect(this.masterSmartEQHigh);
    this.masterSmartEQHigh.connect(this.masterGlueComp);
    this.masterGlueComp.connect(this.masterLoudnessGain);
    this.masterLoudnessGain.connect(this.masterCompressor); // Limiter
    
    this.masterCompressor.connect(this.masterMeter);
    this.masterMeter.connect(this.context.destination); // Monitoring
    this.masterMeter.connect(this.destination); // Broadcast Stream
  }

  createChannelStrip(id: number) {
    if (!this.context) return;

    // Create Nodes
    
    // Anti-Sonic Attack Shield (DC Blocker + Hard Limiter)
    const dcBlocker = this.context.createBiquadFilter();
    dcBlocker.type = 'highpass';
    dcBlocker.frequency.value = 5; // Block DC offset (0Hz) which causes NaN propagation

    const inputLimiter = this.context.createDynamicsCompressor();
    inputLimiter.threshold.value = -1; // Catch extreme peaks before they hit the DSP chain
    inputLimiter.ratio.value = 20;
    inputLimiter.attack.value = 0.001;
    inputLimiter.release.value = 0.1;

    let gateNode: AudioWorkletNode | null = null;
    
    if (this.workletInitialized) {
        gateNode = new AudioWorkletNode(this.context, 'omni-gate', {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2]
        });
    }

    const compressorNode = this.context.createDynamicsCompressor();
    // Default Comp Settings (neutral)
    compressorNode.threshold.value = 0; 
    compressorNode.ratio.value = 1;
    compressorNode.attack.value = 0.01;
    compressorNode.release.value = 0.1;

    const eqLow = this.context.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;

    const eqMid = this.context.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 1.0;

    const eqHigh = this.context.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;

    const panNode = this.context.createStereoPanner();
    const gainNode = this.context.createGain();
    const meterNode = this.context.createAnalyser();
    meterNode.fftSize = 1024;
    meterNode.smoothingTimeConstant = 0.8;

    // Chain: Source -> DCBlocker -> InputLimiter -> Gate -> Comp -> EQ -> Pan -> Gain -> Meter -> Master
    // Note: Source is connected later.
    
    // Internal Chain Construction
    dcBlocker.connect(inputLimiter);

    let inputHead: AudioNode = eqLow;
    
    if (gateNode) {
        inputLimiter.connect(gateNode);
        gateNode.connect(compressorNode);
        compressorNode.connect(eqLow);
        inputHead = dcBlocker;
    } else {
        inputLimiter.connect(compressorNode);
        compressorNode.connect(eqLow);
        inputHead = dcBlocker;
    }

    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(panNode);
    panNode.connect(gainNode);
    gainNode.connect(meterNode);

    // Initial Master Connection
    if (this.masterGain) {
      meterNode.connect(this.masterGain);
    } else if (this.masterCompressor) {
      meterNode.connect(this.masterCompressor); 
    }

    this.channels.set(id, {
      source: null,
      gateNode,
      compressorNode,
      eqLow,
      eqMid,
      eqHigh,
      panNode,
      gainNode,
      meterNode,
      stream: null,
      inputHead: inputHead as any
    });
  }

  async setFileSource(id: number, file: File) {
    if (!this.context) return;
    const ch = this.channels.get(id);
    if (!ch) return;

    // Cleanup old stream/source
    if (ch.stream) {
      ch.stream.getTracks().forEach(t => t.stop());
      ch.stream = null;
    }
    if (ch.source) {
      ch.source.disconnect();
      ch.source = null;
    }
    if ((ch as any).audioElement) {
      (ch as any).audioElement.pause();
      (ch as any).audioElement.removeAttribute('src');
      (ch as any).audioElement.load();
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const audio = new Audio(objectUrl);
      audio.loop = true;
      audio.crossOrigin = "anonymous";
      
      const source = this.context.createMediaElementSource(audio);
      ch.source = source;
      (ch as any).audioElement = audio;

      // Connect to the head of the chain (DC Blocker)
      source.connect((ch as any).inputHead);
      
      audio.play();
    } catch (err) {
      console.error(`[AudioEngine] Error on Ch ${id}:`, err);
      throw err;
    }
  }

  async setInputDevice(id: number, deviceId: string) {
    if (!this.context) return;
    const ch = this.channels.get(id);
    if (!ch) return;

    // Cleanup old stream
    if (ch.stream) {
      ch.stream.getTracks().forEach(t => t.stop());
      if (ch.source) ch.source.disconnect();
      ch.stream = null;
      ch.source = null;
    }

    if (!deviceId) return;

    try {
      let stream: MediaStream;
      if (deviceId === 'display-capture') {
         try {
             // @ts-ignore
             stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
         } catch (e) {
             console.warn(`Display media cancelled or failed for Ch ${id}`, e);
             return;
         }
      } else {
         stream = await navigator.mediaDevices.getUserMedia({
            audio: { 
                deviceId: { exact: deviceId },
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 2
            }
         });
      }

      // Validate Audio Tracks
      if (stream.getAudioTracks().length === 0) {
          // Stop any video tracks if present (e.g. screen share without audio)
          stream.getTracks().forEach(t => t.stop());
          // THROW user-friendly error
          throw new Error("No audio tracks found. When capturing a window/tab, please ensure the 'Share Audio' checkbox is enabled in the selector.");
      }

      const source = this.context.createMediaStreamSource(stream);
      ch.stream = stream;
      ch.source = source;

      // Connect to the head of the chain (DC Blocker)
      source.connect((ch as any).inputHead);
      
    } catch (err) {
      console.error(`[AudioEngine] Error on Ch ${id}:`, err);
      throw err; // Re-throw to UI
    }
  }

  async setOutputDevice(deviceId: string) {
    if (!this.context || this.context.state === 'closed') return;
    if (this.currentOutputDeviceId === deviceId) return;

    try {
        // @ts-ignore - setSinkId is not defined in standard TS lib for AudioContext yet
        if (typeof this.context.setSinkId === 'function') {
            // @ts-ignore
            await this.context.setSinkId(deviceId);
            this.currentOutputDeviceId = deviceId;
            console.log(`[AudioEngine] Master Output routed to ${deviceId}`);
        } else {
             console.warn("[AudioEngine] Output selection not supported (setSinkId missing).");
        }
    } catch (error) {
        console.error("[AudioEngine] Failed to set output device:", error);
    }
  }

  updateChannel(settings: ChannelSettings, anySoloed: boolean) {
    if (!this.context) return;
    const ch = this.channels.get(settings.id);
    if (!ch) return;

    // 1. Dynamics - Gate (AudioWorklet)
    if (ch.gateNode) {
        const bypass = settings.gate.active ? 0 : 1;
        const thresholdParam = (ch.gateNode.parameters as any).get('threshold');
        const bypassParam = (ch.gateNode.parameters as any).get('bypass');
        
        if (thresholdParam) thresholdParam.setValueAtTime(settings.gate.threshold, this.context.currentTime);
        if (bypassParam) bypassParam.setValueAtTime(bypass, this.context.currentTime);
    }

    // 2. Dynamics - Compressor
    const comp = ch.compressorNode;
    if (settings.compressor.active) {
        comp.threshold.setTargetAtTime(settings.compressor.threshold, this.context.currentTime, 0.1);
        comp.ratio.setTargetAtTime(settings.compressor.ratio, this.context.currentTime, 0.1);
    } else {
        comp.threshold.setTargetAtTime(0, this.context.currentTime, 0.1);
        comp.ratio.setTargetAtTime(1, this.context.currentTime, 0.1);
    }

    // 3. EQ
    ch.eqLow.gain.setTargetAtTime(settings.eq.low, this.context.currentTime, 0.1);
    ch.eqMid.gain.setTargetAtTime(settings.eq.mid, this.context.currentTime, 0.1);
    ch.eqHigh.gain.setTargetAtTime(settings.eq.high, this.context.currentTime, 0.1);

    // 4. Pan & Gain
    ch.panNode.pan.setTargetAtTime(settings.pan, this.context.currentTime, 0.1);
    
    // Mute/Solo Logic
    let gainVal = settings.gain;
    if (settings.mute) {
        gainVal = 0;
    } else if (anySoloed && !settings.solo) {
        gainVal = 0;
    }

    // External VST DSP gain & trim response when active
    if (settings.vst?.enabled) {
        const vstTrimDb = (settings.vst.outputGain || 0) + (settings.vst.inputGain || 0) * 0.25;
        const vstGainFactor = Math.pow(10, vstTrimDb / 20);
        gainVal *= vstGainFactor;
    }
    
    ch.gainNode.gain.setTargetAtTime(gainVal, this.context.currentTime, 0.05);
  }

  updateMaster(settings: MasterSettings) {
    if (!this.masterGain || !this.context) return;
    this.masterGain.gain.setTargetAtTime(settings.masterGain, this.context.currentTime, 0.1);
    
    if (this.masterReverbGain) {
      this.masterReverbGain.gain.setTargetAtTime(settings.reverb, this.context.currentTime, 0.1);
    }
    if (this.masterDelayGain) {
      this.masterDelayGain.gain.setTargetAtTime(settings.delay, this.context.currentTime, 0.1);
    }
    if (this.masterNoiseReduction) {
      // Map 0-1 to 20000Hz - 2000Hz
      const freq = 20000 - (settings.noiseReduction * 18000);
      this.masterNoiseReduction.frequency.setTargetAtTime(freq, this.context.currentTime, 0.1);
    }

    if (settings.smartMastering) {
        // Apply Smart Mastering Settings
        if (this.masterHighpass) this.masterHighpass.frequency.setTargetAtTime(40, this.context.currentTime, 0.1); // Remove rumble
        if (this.masterSmartEQLow) this.masterSmartEQLow.gain.setTargetAtTime(2, this.context.currentTime, 0.1); // Warmth
        if (this.masterSmartEQMid) this.masterSmartEQMid.gain.setTargetAtTime(-1.5, this.context.currentTime, 0.1); // Clarity
        if (this.masterSmartEQHigh) this.masterSmartEQHigh.gain.setTargetAtTime(3, this.context.currentTime, 0.1); // Air
        
        if (this.masterGlueComp) {
            this.masterGlueComp.threshold.setTargetAtTime(-15, this.context.currentTime, 0.1);
            this.masterGlueComp.ratio.setTargetAtTime(2.5, this.context.currentTime, 0.1);
            this.masterGlueComp.attack.setTargetAtTime(0.03, this.context.currentTime, 0.1);
            this.masterGlueComp.release.setTargetAtTime(0.25, this.context.currentTime, 0.1);
        }
        
        if (this.masterLoudnessGain) {
            this.masterLoudnessGain.gain.setTargetAtTime(1.5, this.context.currentTime, 0.1); // Makeup gain
        }
    } else {
        // Bypass Smart Mastering
        if (this.masterHighpass) this.masterHighpass.frequency.setTargetAtTime(10, this.context.currentTime, 0.1);
        if (this.masterSmartEQLow) this.masterSmartEQLow.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
        if (this.masterSmartEQMid) this.masterSmartEQMid.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
        if (this.masterSmartEQHigh) this.masterSmartEQHigh.gain.setTargetAtTime(0, this.context.currentTime, 0.1);
        
        if (this.masterGlueComp) {
            this.masterGlueComp.threshold.setTargetAtTime(0, this.context.currentTime, 0.1);
            this.masterGlueComp.ratio.setTargetAtTime(1, this.context.currentTime, 0.1);
        }
        
        if (this.masterLoudnessGain) {
            this.masterLoudnessGain.gain.setTargetAtTime(1, this.context.currentTime, 0.1);
        }
    }

    // Check output routing
    if (settings.outputDeviceId && settings.outputDeviceId !== this.currentOutputDeviceId) {
        this.setOutputDevice(settings.outputDeviceId);
    }
  }

  private calculateRMSAndPeak(analyser: AnalyserNode, prevState: AudioMeterData): AudioMeterData {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(dataArray);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const val = dataArray[i];
      sum += val * val;
      if (Math.abs(val) > peak) peak = Math.abs(val);
    }
    
    const rms = Math.sqrt(sum / bufferLength);
    
    // Apply Decay Smoothing
    const smoothedRMS = Math.max(rms, prevState.rms * this.DECAY_FACTOR);
    const smoothedPeak = Math.max(peak, prevState.peak * this.DECAY_FACTOR);
    
    return { rms: smoothedRMS, peak: smoothedPeak };
  }

  getMeter(id: number): AudioMeterData {
    const ch = this.channels.get(id);
    if (!ch) return { rms: 0, peak: 0 };
    
    const prevState = this.meterStates.get(id) || { rms: 0, peak: 0 };
    const newState = this.calculateRMSAndPeak(ch.meterNode, prevState);
    this.meterStates.set(id, newState);
    return newState;
  }
  
  getMasterMeter(): AudioMeterData {
    if (!this.masterMeter) return { rms: 0, peak: 0 };
    const newState = this.calculateRMSAndPeak(this.masterMeter, this.masterMeterState);
    this.masterMeterState = newState;
    return newState;
  }

  getMasterAnalyser(): AnalyserNode | null {
    return this.masterMeter;
  }

  getMasterFrequencyData(targetArray: Uint8Array): void {
    if (this.masterMeter) {
      this.masterMeter.getByteFrequencyData(targetArray);
    }
  }

  getMasterTimeDomainData(targetArray: Uint8Array): void {
    if (this.masterMeter) {
      this.masterMeter.getByteTimeDomainData(targetArray);
    }
  }

  getMasterSampleRate(): number {
    return this.context ? this.context.sampleRate : 48000;
  }

  private testGenSource: AudioNode | null = null;
  private testGenGain: GainNode | null = null;
  private isTesting = false;
  private testGenType: string | null = null;

  startTestTone(type: 'sine' | 'pink' | 'white' | 'sweep' = 'pink', freq = 1000, volume = 0.15) {
    if (!this.context || this.context.state === 'closed') return;
    this.stopTestTone();
    this.tryResumeContext();

    const gain = this.context.createGain();
    gain.gain.value = volume;

    if (type === 'sine') {
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.context.currentTime);
      osc.connect(gain);
      osc.start();
      this.testGenSource = osc;
    } else if (type === 'sweep') {
      const osc = this.context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(20, this.context.currentTime);
      const now = this.context.currentTime;
      osc.frequency.exponentialRampToValueAtTime(20000, now + 5);
      osc.connect(gain);
      osc.start();
      this.testGenSource = osc;
    } else if (type === 'white') {
      const bufferSize = this.context.sampleRate * 2;
      const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = this.context.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;
      whiteNoise.connect(gain);
      whiteNoise.start();
      this.testGenSource = whiteNoise;
    } else if (type === 'pink') {
      const bufferSize = this.context.sampleRate * 2;
      const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
      const pinkNoise = this.context.createBufferSource();
      pinkNoise.buffer = noiseBuffer;
      pinkNoise.loop = true;
      pinkNoise.connect(gain);
      pinkNoise.start();
      this.testGenSource = pinkNoise;
    }

    if (this.masterGain) {
      gain.connect(this.masterGain);
    } else if (this.masterCompressor) {
      gain.connect(this.masterCompressor);
    }
    this.testGenGain = gain;
    this.isTesting = true;
    this.testGenType = type;
  }

  stopTestTone() {
    if (this.testGenSource) {
      try {
        (this.testGenSource as any).stop?.();
        this.testGenSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.testGenSource = null;
    }
    if (this.testGenGain) {
      try {
        this.testGenGain.disconnect();
      } catch (e) {
        // ignore
      }
      this.testGenGain = null;
    }
    this.isTesting = false;
    this.testGenType = null;
  }

  isTestToneActive(): boolean {
    return this.isTesting;
  }

  getTestToneType(): string | null {
    return this.testGenType;
  }
  
  calculateOptimalMasterGain(): number {
      // Analyze current channel peaks to determine safe master gain
      let totalPeak = 0;
      this.channels.forEach((ch, id) => {
          const prevState = this.meterStates.get(id) || { rms: 0, peak: 0 };
          const { peak } = this.calculateRMSAndPeak(ch.meterNode, prevState);
          totalPeak += peak;
      });
      
      // If total possible amplitude > 1, we attenuate.
      // Target -1.0 dB (approx 0.89 linear) headroom
      if (totalPeak > 0.89) {
          return 0.89 / totalPeak;
      }
      return 1.0; // Default to unity if clean
  }

  getContextTime() {
    return this.context?.currentTime || 0;
  }

  getContextState() {
    return this.context?.state || 'uninitialized';
  }

  async tryResumeContext() {
    if (this.context && this.context.state === 'suspended') {
        await this.context.resume();
    }
  }

  async switchChannelToDefault(id: number) {
      const ch = this.channels.get(id);
      if(ch && ch.stream) {
          ch.stream.getTracks().forEach(t => t.stop());
      }
      // Only attempt switch if context is actually alive
      if (this.context && this.context.state !== 'closed') {
          try {
              await this.setInputDevice(id, 'default');
          } catch(e) {
              console.error("Protocol A failed: No default device available.");
          }
      }
  }

  async reboot(channels: ChannelSettings[], masterSettings: MasterSettings) {
      console.warn("[AudioEngine] Initiating Self-Healing Reboot Sequence...");
      
      // Force close existing context
      if (this.context && this.context.state !== 'closed') {
          try {
              await this.context.close();
          } catch (e) {
              console.error("Failed to close context during reboot", e);
          }
      }
      
      // Re-initialize engine
      await this.initialize();
      
      // Restore channels
      const anySoloed = channels.some(ch => ch.solo);
      for (const ch of channels) {
          this.createChannelStrip(ch.id);
          if (ch.deviceId) {
              try {
                  await this.setInputDevice(ch.id, ch.deviceId);
              } catch (e) {
                  console.warn(`Could not restore device for Ch ${ch.id} during reboot.`);
              }
          }
          this.updateChannel(ch, anySoloed);
      }
      
      // Restore master
      this.updateMaster(masterSettings);
      console.log("[AudioEngine] Self-Healing Reboot Complete.");
  }
}

export const audioEngine = new AudioEngine();
