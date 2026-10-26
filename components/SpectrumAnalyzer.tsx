import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import {
  Activity,
  Maximize2,
  Minimize2,
  Sliders,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkles,
  Info,
  Pause,
  BarChart2,
  TrendingUp,
  RefreshCw,
  Circle,
  Disc,
  Download,
  FileText,
  Camera,
  Trash2,
  RotateCcw
} from 'lucide-react';
import { spectralCaptureService, SpectralRecordingSession, SpectralCaptureFrame } from '../services/spectralCaptureService';

export interface SpectrumAnalyzerProps {
  className?: string;
  onExpandModal?: () => void;
}

// ISO Standard 1/3-Octave Center Frequencies (Hz)
const ISO_BANDS_31 = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
];

const ISO_BANDS_24 = [
  31.5, 45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400, 2000, 2800, 4000,
  5600, 8000, 11200, 16000, 20000
];

// Reference Frequency Markers for Logarithmic Grid
const GRID_FREQUENCIES = [
  { freq: 50, label: '50' },
  { freq: 100, label: '100' },
  { freq: 250, label: '250' },
  { freq: 500, label: '500' },
  { freq: 1000, label: '1k' },
  { freq: 2500, label: '2.5k' },
  { freq: 5000, label: '5k' },
  { freq: 10000, label: '10k' },
  { freq: 20000, label: '20k' }
];

const DB_MARKS = [-12, -24, -36, -48, -60];

// Musical note calculation
function freqToNote(freq: number): string {
  if (freq < 16) return '';
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const midi = Math.round(12 * Math.log2(freq / 440) + 69);
  const note = noteNames[(midi % 12 + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({ className = '', onExpandModal }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'curve' | 'bars'>('curve');
  const [peakHoldEnabled, setPeakHoldEnabled] = useState(true);
  const [speed, setSpeed] = useState<'fast' | 'norm' | 'smooth'>('norm');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [testToneActive, setTestToneActive] = useState(false);
  const [testToneType, setTestToneType] = useState<'pink' | 'sine' | 'sweep' | 'white'>('pink');
  const [hoverData, setHoverData] = useState<{ x: number; y: number; freq: number; db: number; note: string } | null>(null);

  // Live Peak Readout
  const [livePeak, setLivePeak] = useState<{ freq: number; db: number; note: string }>({ freq: 0, db: -100, note: '' });
  // Live 4-Band Energy Distribution
  const [bandEnergy, setBandEnergy] = useState<{ sub: number; bass: number; mid: number; high: number }>({
    sub: 0,
    bass: 0,
    mid: 0,
    high: 0
  });

  // Spectral Capture State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFramesCount, setRecordedFramesCount] = useState(0);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const [lastSession, setLastSession] = useState<SpectralRecordingSession | null>(() => spectralCaptureService.getLastSession());
  const [snapshotFeedback, setSnapshotFeedback] = useState<string | null>(null);

  // Sync with spectralCaptureService
  useEffect(() => {
    spectralCaptureService.onRecordingStateChange = (rec, count, dur) => {
      setIsRecording(rec);
      setRecordedFramesCount(count);
      setRecordedDurationMs(dur);
      if (!rec) {
        setLastSession(spectralCaptureService.getLastSession());
      }
    };
    return () => {
      spectralCaptureService.onRecordingStateChange = null;
    };
  }, []);

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      const session = spectralCaptureService.stopRecording(audioEngine.getMasterSampleRate());
      setLastSession(session);
    } else {
      spectralCaptureService.startRecording();
    }
  }, [isRecording]);

  const handleCaptureSnapshot = useCallback(() => {
    const analyser = audioEngine.getMasterAnalyser();
    if (!analyser) return;

    const snapshot = {
      timestamp: new Date().toISOString(),
      peakFreq: livePeak.freq,
      peakDb: livePeak.db,
      note: livePeak.note,
      bandEnergy,
      sampleRate: audioEngine.getMasterSampleRate(),
      fftSize: analyser.fftSize
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `master_spectrum_snapshot_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();

    setSnapshotFeedback("Snapshot Saved!");
    setTimeout(() => setSnapshotFeedback(null), 2000);
  }, [livePeak, bandEnergy]);

  // State refs for animation loop
  const peaksRef = useRef<Float32Array | null>(null);
  const frozenBufferRef = useRef<Uint8Array | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Smoothing constant based on speed setting
  useEffect(() => {
    const analyser = audioEngine.getMasterAnalyser();
    if (analyser) {
      if (speed === 'fast') analyser.smoothingTimeConstant = 0.5;
      else if (speed === 'smooth') analyser.smoothingTimeConstant = 0.88;
      else analyser.smoothingTimeConstant = 0.78;
    }
  }, [speed]);

  // Test tone toggle
  const toggleTestTone = (type?: 'pink' | 'sine' | 'sweep' | 'white') => {
    const nextType = type || testToneType;
    if (testToneActive && (!type || type === testToneType)) {
      audioEngine.stopTestTone();
      setTestToneActive(false);
    } else {
      audioEngine.startTestTone(nextType, nextType === 'sine' ? 1000 : undefined, 0.12);
      setTestToneType(nextType);
      setTestToneActive(true);
    }
  };

  useEffect(() => {
    return () => {
      if (testToneActive) {
        audioEngine.stopTestTone();
      }
    };
  }, [testToneActive]);

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    let lastMetricsUpdateTime = 0;

    const render = (time: number) => {
      animFrameIdRef.current = requestAnimationFrame(render);

      const analyser = audioEngine.getMasterAnalyser();
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      const binCount = analyser ? analyser.frequencyBinCount : 1024;
      const sampleRate = (analyser && analyser.context ? analyser.context.sampleRate : 48000);
      const nyquist = sampleRate / 2;

      // Frequency buffer
      let freqArray: Uint8Array;
      if (isFrozen && frozenBufferRef.current) {
        freqArray = frozenBufferRef.current;
      } else {
        freqArray = new Uint8Array(binCount);
        if (analyser) {
          analyser.getByteFrequencyData(freqArray);
        }
        if (!frozenBufferRef.current || frozenBufferRef.current.length !== binCount) {
          frozenBufferRef.current = new Uint8Array(binCount);
        }
        frozenBufferRef.current.set(freqArray);
      }

      // Initialize / update peak hold array
      if (!peaksRef.current || peaksRef.current.length !== width) {
        peaksRef.current = new Float32Array(width);
      }
      const peaks = peaksRef.current;

      // Clear Canvas
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Background & Technical Grid
      ctx.fillStyle = '#070a0e';
      ctx.fillRect(0, 0, width, height);

      // Grid Lines & Labels
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.45)';
      ctx.font = '8px ui-monospace, SFMono-Regular, monospace';

      // Horizontal dB Grid Lines
      DB_MARKS.forEach((db) => {
        // Map -70 dB to 0 dB to Y
        const norm = (db + 70) / 70; // 0 at -70, 1 at 0dB
        const y = height - (norm * (height - 14) + 6);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.fillText(`${db}dB`, 3, y - 2);
      });

      // Vertical Frequency Grid Lines
      GRID_FREQUENCIES.forEach(({ freq, label }) => {
        const x = ((Math.log10(freq) - logMin) / logRange) * width;
        if (x > 15 && x < width - 15) {
          ctx.beginPath();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height - 12);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.textAlign = 'center';
          ctx.fillText(label, x, height - 3);
        }
      });
      ctx.textAlign = 'left';

      // 2. Frequency Spectrum Data Conversion
      // Compute pixel spectrum points mapped logarithmically
      const spectrumPoints: number[] = new Array(width);
      let maxVal = 0;
      let maxFreqFound = 0;

      // 4-Band Energy Accumulators
      let subSum = 0, subCount = 0;
      let bassSum = 0, bassCount = 0;
      let midSum = 0, midCount = 0;
      let highSum = 0, highCount = 0;

      for (let x = 0; x < width; x++) {
        const logX = logMin + (x / width) * logRange;
        const freq = Math.pow(10, logX);
        const bin = Math.min(Math.round((freq / nyquist) * binCount), binCount - 1);
        const rawVal = freqArray[bin] || 0; // 0 to 255

        // Normalize value to display height (0 to height - 16)
        const normY = (rawVal / 255) * (height - 16);
        spectrumPoints[x] = normY;

        // Peak tracking
        if (rawVal > maxVal) {
          maxVal = rawVal;
          maxFreqFound = Math.round(freq);
        }

        // Band aggregation
        if (freq >= 20 && freq < 60) {
          subSum += rawVal;
          subCount++;
        } else if (freq >= 60 && freq < 250) {
          bassSum += rawVal;
          bassCount++;
        } else if (freq >= 250 && freq < 4000) {
          midSum += rawVal;
          midCount++;
        } else if (freq >= 4000 && freq <= 20000) {
          highSum += rawVal;
          highCount++;
        }

        // Peak hold decay
        if (normY > peaks[x]) {
          peaks[x] = normY;
        } else {
          peaks[x] = Math.max(0, peaks[x] - 0.75); // Linear drop per frame
        }
      }

      // Update metrics periodically (~10 times per sec)
      if (time - lastMetricsUpdateTime > 100) {
        lastMetricsUpdateTime = time;
        if (maxVal > 15) {
          const approxDb = Math.round(((maxVal / 255) * 60 - 60) * 10) / 10;
          setLivePeak({
            freq: maxFreqFound,
            db: approxDb,
            note: freqToNote(maxFreqFound)
          });
        } else {
          setLivePeak({ freq: 0, db: -70, note: '' });
        }

        setBandEnergy({
          sub: subCount > 0 ? Math.min(100, Math.round((subSum / (subCount * 255)) * 100)) : 0,
          bass: bassCount > 0 ? Math.min(100, Math.round((bassSum / (bassCount * 255)) * 100)) : 0,
          mid: midCount > 0 ? Math.min(100, Math.round((midSum / (midCount * 255)) * 100)) : 0,
          high: highCount > 0 ? Math.min(100, Math.round((highSum / (highCount * 255)) * 100)) : 0
        });
      }

      // 2.5 Real-time Spectral Data Capture Recording
      if (spectralCaptureService.getIsRecording()) {
        const approxDb = Math.round(((maxVal / 255) * 60 - 60) * 10) / 10;
        const curBands = {
          sub: subCount > 0 ? Math.min(100, Math.round((subSum / (subCount * 255)) * 100)) : 0,
          bass: bassCount > 0 ? Math.min(100, Math.round((bassSum / (bassCount * 255)) * 100)) : 0,
          mid: midCount > 0 ? Math.min(100, Math.round((midSum / (midCount * 255)) * 100)) : 0,
          high: highCount > 0 ? Math.min(100, Math.round((highSum / (highCount * 255)) * 100)) : 0
        };
        const sampled32: number[] = new Array(32);
        for (let i = 0; i < 32; i++) {
          const sampleX = Math.min(width - 1, Math.floor((i / 31) * (width - 1)));
          sampled32[i] = Math.round(spectrumPoints[sampleX] || 0);
        }
        spectralCaptureService.recordFrame(maxFreqFound, approxDb, curBands, sampled32);
      }

      // 3. Render Visualization Mode
      const bottomY = height - 14;

      if (viewMode === 'curve') {
        // --- CURVE MODE: Glowing Smooth Gradient Spectrum ---
        // Create Gradient Fill: Sub/Bass (Cyan) -> Mids (Emerald) -> Presence (Amber) -> Highs (Rose)
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0.0, 'rgba(6, 182, 212, 0.45)');   // Cyan (Sub)
        grad.addColorStop(0.25, 'rgba(16, 185, 129, 0.45)'); // Emerald (Bass/Low Mid)
        grad.addColorStop(0.65, 'rgba(245, 158, 11, 0.45)'); // Amber (Mids/Presence)
        grad.addColorStop(1.0, 'rgba(244, 63, 94, 0.45)');   // Rose (Treble/Air)

        const strokeGrad = ctx.createLinearGradient(0, 0, width, 0);
        strokeGrad.addColorStop(0.0, '#22d3ee');
        strokeGrad.addColorStop(0.25, '#34d399');
        strokeGrad.addColorStop(0.65, '#fbbf24');
        strokeGrad.addColorStop(1.0, '#fb7185');

        // Draw Filled Curve
        ctx.beginPath();
        ctx.moveTo(0, bottomY);
        for (let x = 0; x < width; x++) {
          const y = bottomY - spectrumPoints[x];
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, bottomY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Draw Stroke with Phosphor Glow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, bottomY - spectrumPoints[0]);
        for (let x = 1; x < width; x++) {
          const y = bottomY - spectrumPoints[x];
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = 1.75;
        ctx.shadowColor = 'rgba(34, 211, 238, 0.6)';
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.restore();

        // Draw Peak Hold Line
        if (peakHoldEnabled) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x++) {
            const y = bottomY - peaks[x];
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // --- BARS MODE: 1/3-Octave Graphic RTA Hardware Style ---
        const bands = width > 400 ? ISO_BANDS_31 : ISO_BANDS_24;
        const barGap = 2;
        const totalGap = (bands.length - 1) * barGap;
        const barWidth = Math.max(3, (width - totalGap) / bands.length);

        bands.forEach((bandFreq, i) => {
          const x = i * (barWidth + barGap);
          const bin = Math.min(Math.round((bandFreq / nyquist) * binCount), binCount - 1);
          // Average neighboring bins for stability
          let sum = freqArray[bin] || 0;
          let count = 1;
          if (bin > 0) { sum += freqArray[bin - 1]; count++; }
          if (bin < binCount - 1) { sum += freqArray[bin + 1]; count++; }
          const avgVal = sum / count;

          const barHeight = (avgVal / 255) * (height - 18);
          const barY = bottomY - barHeight;

          // Multi-color Segmented LED appearance
          const segments = 16;
          const segHeight = (height - 18) / segments;
          const litSegments = Math.round((barHeight / (height - 18)) * segments);

          for (let s = 0; s < segments; s++) {
            const segY = bottomY - (s + 1) * segHeight + 1;
            const isLit = s < litSegments;

            if (isLit) {
              if (s > 13) ctx.fillStyle = '#ef4444'; // Red top (Overload)
              else if (s > 10) ctx.fillStyle = '#f59e0b'; // Amber
              else if (s > 6) ctx.fillStyle = '#10b981'; // Green
              else ctx.fillStyle = '#06b6d4'; // Cyan
            } else {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.04)'; // Dark LED segment
            }

            ctx.fillRect(x, segY, barWidth, segHeight - 1);
          }

          // Peak Hold Dot
          if (peakHoldEnabled) {
            const peakBinX = Math.round(x);
            const peakVal = peaks[peakBinX] || 0;
            const peakY = bottomY - peakVal;
            if (peakVal > 4) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x, peakY - 1, barWidth, 2);
            }
          }
        });
      }

      // 4. Draw Interactive Reticle Cursor if hovered
      if (hoverData && hoverData.x >= 0 && hoverData.x <= width) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);

        // Vertical cursor line
        ctx.beginPath();
        ctx.moveTo(hoverData.x, 0);
        ctx.lineTo(hoverData.x, bottomY);
        ctx.stroke();

        // Horizontal level line at hover point
        ctx.beginPath();
        ctx.moveTo(0, hoverData.y);
        ctx.lineTo(width, hoverData.y);
        ctx.stroke();

        // Target dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(hoverData.x, hoverData.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      // 5. On-Canvas Recording Indicator Watermark
      if (spectralCaptureService.getIsRecording()) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(width - 12, 12, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 8px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'right';
        ctx.fillText('REC', width - 19, 14);
        ctx.restore();
      }
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [viewMode, peakHoldEnabled, isFrozen, hoverData]);

  // Handle Canvas Resizing (Hi-DPI aware)
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.floor(rect.width * dpr);
    const targetHeight = Math.floor(rect.height * dpr);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
  }, []);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas, isExpanded]);

  // Interactive Mouse Hover for precise Hz / dB / Note readout
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    const normX = Math.max(0, Math.min(1, mouseX / canvas.width));
    const logX = logMin + normX * logRange;
    const freq = Math.round(Math.pow(10, logX));

    // Calculate approx dB from Y coordinate
    const bottomY = canvas.height - 14;
    const normY = Math.max(0, Math.min(1, (bottomY - mouseY) / (canvas.height - 16)));
    const db = Math.round((normY * 60 - 60) * 10) / 10;
    const note = freqToNote(freq);

    setHoverData({
      x: mouseX,
      y: mouseY,
      freq,
      db,
      note
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  return (
    <>
      {/* Compact MasterSection Rackmount Display */}
      <div className={`bg-[#0d0f12] rounded border border-[#222] p-2.5 flex flex-col gap-2 skeuo-shadow relative select-none ${className}`}>
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#1c1f26] pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]" />
            <span className="text-[10px] font-black tracking-widest text-cyan-300 font-mono">RTA SPECTRUM</span>
            <span className="text-[8px] bg-cyan-950/70 text-cyan-400 border border-cyan-800/60 px-1 rounded font-mono">
              20Hz-20kHz
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* View Mode Toggle */}
            <div className="flex bg-[#161a22] rounded p-0.5 border border-[#252a36]">
              <button
                onClick={() => setViewMode('curve')}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition-colors ${
                  viewMode === 'curve' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="Continuous FFT Spectral Curve"
              >
                CRV
              </button>
              <button
                onClick={() => setViewMode('bars')}
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono transition-colors ${
                  viewMode === 'bars' ? 'bg-cyan-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
                title="1/3 Octave Discrete RTA Bars"
              >
                BAR
              </button>
            </div>

            {/* Expand / Maximize Modal */}
            <button
              onClick={() => {
                if (onExpandModal) onExpandModal();
                else setIsExpanded(true);
              }}
              className="p-1 rounded bg-[#161a22] hover:bg-cyan-950 text-gray-400 hover:text-cyan-300 border border-[#252a36] hover:border-cyan-700/60 transition-colors"
              title="Expand Spectrum Inspector"
            >
              <Maximize2 size={11} />
            </button>
          </div>
        </div>

        {/* Real-time CRT Display Bezel */}
        <div className="relative w-full h-24 bg-[#05070a] rounded border border-[#181d26] overflow-hidden shadow-inner group cursor-crosshair">
          {/* Subtle CRT Acrylic Glare */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.04] to-transparent pointer-events-none z-10" />

          {/* Canvas Element */}
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />

          {/* Interactive Live Cursor Tooltip */}
          {hoverData && (
            <div className="absolute top-1 right-1 bg-black/85 border border-cyan-500/80 rounded px-1.5 py-0.5 text-[8px] font-mono text-cyan-300 pointer-events-none z-20 shadow-lg flex items-center gap-2">
              <span className="font-bold">{hoverData.freq} Hz</span>
              <span className="text-gray-400">{hoverData.note}</span>
              <span className="text-amber-400">{hoverData.db} dB</span>
            </div>
          )}

          {/* Top Peak Badge if no hover */}
          {!hoverData && livePeak.freq > 0 && (
            <div className="absolute top-1 left-2 pointer-events-none z-20 flex items-center gap-1.5 text-[8px] font-mono opacity-80">
              <span className="text-gray-400">PEAK:</span>
              <span className="text-cyan-300 font-bold">{livePeak.freq} Hz</span>
              <span className="text-amber-400 font-semibold">{livePeak.db} dB</span>
              {livePeak.note && <span className="text-emerald-400">({livePeak.note})</span>}
            </div>
          )}
        </div>

        {/* 4-Band Energy Distribution Bar */}
        <div className="grid grid-cols-4 gap-1 pt-0.5">
          <div className="bg-[#080b10] border border-[#1a1f29] rounded px-1.5 py-1 flex flex-col items-center">
            <div className="flex justify-between w-full text-[7px] font-mono text-gray-400 mb-0.5">
              <span>SUB</span>
              <span className="text-cyan-400">{bandEnergy.sub}%</span>
            </div>
            <div className="w-full h-1 bg-[#141923] rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-75"
                style={{ width: `${bandEnergy.sub}%` }}
              />
            </div>
          </div>

          <div className="bg-[#080b10] border border-[#1a1f29] rounded px-1.5 py-1 flex flex-col items-center">
            <div className="flex justify-between w-full text-[7px] font-mono text-gray-400 mb-0.5">
              <span>BASS</span>
              <span className="text-emerald-400">{bandEnergy.bass}%</span>
            </div>
            <div className="w-full h-1 bg-[#141923] rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${bandEnergy.bass}%` }}
              />
            </div>
          </div>

          <div className="bg-[#080b10] border border-[#1a1f29] rounded px-1.5 py-1 flex flex-col items-center">
            <div className="flex justify-between w-full text-[7px] font-mono text-gray-400 mb-0.5">
              <span>MID</span>
              <span className="text-amber-400">{bandEnergy.mid}%</span>
            </div>
            <div className="w-full h-1 bg-[#141923] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-75"
                style={{ width: `${bandEnergy.mid}%` }}
              />
            </div>
          </div>

          <div className="bg-[#080b10] border border-[#1a1f29] rounded px-1.5 py-1 flex flex-col items-center">
            <div className="flex justify-between w-full text-[7px] font-mono text-gray-400 mb-0.5">
              <span>HIGH</span>
              <span className="text-rose-400">{bandEnergy.high}%</span>
            </div>
            <div className="w-full h-1 bg-[#141923] rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-75"
                style={{ width: `${bandEnergy.high}%` }}
              />
            </div>
          </div>
        </div>

        {/* Spectral Data Capture Row */}
        <div className="flex items-center justify-between bg-[#080b10] px-2 py-1.5 rounded border border-[#1e2430] text-[8px] font-mono">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleToggleRecord}
              className={`flex items-center gap-1 px-2 py-0.5 rounded font-black tracking-wider transition-all skeuo-button active:scale-95 ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.7)]'
                  : 'bg-[#141923] hover:bg-red-950/60 text-red-400 hover:text-red-300 border border-red-900/60'
              }`}
              title={isRecording ? 'Stop Recording Spectral Data' : 'Capture & Record real-time master frequency spectrum frames over time'}
            >
              {isRecording ? <Square size={8} className="fill-white" /> : <Circle size={8} className="fill-red-500 text-red-500" />}
              <span>
                {isRecording
                  ? `REC ${(recordedDurationMs / 1000).toFixed(1)}s (${recordedFramesCount}f)`
                  : 'REC SPECTRA'}
              </span>
            </button>

            <button
              onClick={handleCaptureSnapshot}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#141923] hover:bg-white/10 text-gray-300 hover:text-cyan-300 border border-[#252c3c] transition-colors"
              title="Capture instantaneous snapshot of master spectrum (JSON)"
            >
              <Camera size={9} className="text-cyan-400" />
              <span>SNAP</span>
            </button>

            {snapshotFeedback && (
              <span className="text-[7px] text-green-400 font-bold animate-pulse">
                {snapshotFeedback}
              </span>
            )}
          </div>

          {/* Export / Clear Buttons */}
          {lastSession && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => spectralCaptureService.exportJson()}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 font-bold transition-colors"
                title="Download captured spectral data as JSON"
              >
                <Download size={8} />
                <span>JSON</span>
              </button>
              <button
                onClick={() => spectralCaptureService.exportCsv()}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#141923] hover:bg-white/10 text-gray-300 hover:text-emerald-300 border border-[#252c3c] transition-colors"
                title="Download captured spectral data as CSV"
              >
                <FileText size={8} />
                <span>CSV</span>
              </button>
              <button
                onClick={() => {
                  spectralCaptureService.clearSession();
                  setLastSession(null);
                }}
                className="p-0.5 text-gray-500 hover:text-red-400 transition-colors ml-0.5"
                title="Clear recorded spectral buffer"
              >
                <Trash2 size={9} />
              </button>
            </div>
          )}
        </div>

        {/* Quick Calibration & DSP Toolbar */}
        <div className="flex items-center justify-between pt-1 border-t border-[#181d26] text-[8px] font-mono">
          {/* Peak Hold Toggle */}
          <button
            onClick={() => setPeakHoldEnabled(!peakHoldEnabled)}
            className={`px-1.5 py-0.5 rounded border transition-colors ${
              peakHoldEnabled
                ? 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80 font-bold'
                : 'bg-[#12151c] text-gray-500 border-[#222]'
            }`}
          >
            PEAK: {peakHoldEnabled ? 'ON' : 'OFF'}
          </button>

          {/* Speed Toggle */}
          <button
            onClick={() => {
              const next = speed === 'fast' ? 'norm' : speed === 'norm' ? 'smooth' : 'fast';
              setSpeed(next);
            }}
            className="px-1.5 py-0.5 rounded bg-[#12151c] hover:bg-[#1a1f2a] text-gray-400 hover:text-white border border-[#222]"
            title="Averaging Speed"
          >
            SPEED: {speed.toUpperCase()}
          </button>

          {/* Built-in Generator for Audio Testing & Calibration */}
          <button
            onClick={() => toggleTestTone('pink')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
              testToneActive
                ? 'bg-amber-950/80 text-amber-300 border-amber-600 animate-pulse font-bold'
                : 'bg-[#12151c] hover:bg-amber-950/40 text-gray-400 hover:text-amber-300 border-[#222]'
            }`}
            title="Generate test pink noise directly into master bus to verify spectrum response"
          >
            <Sparkles size={9} />
            <span>{testToneActive ? 'CAL NOISE' : 'TEST'}</span>
          </button>
        </div>
      </div>

      {/* Expanded Mastering Spectrum Inspector Modal */}
      {isExpanded && (
        <ExpandedSpectrumModal
          isOpen={isExpanded}
          onClose={() => setIsExpanded(false)}
          viewMode={viewMode}
          setViewMode={setViewMode}
          peakHoldEnabled={peakHoldEnabled}
          setPeakHoldEnabled={setPeakHoldEnabled}
          speed={speed}
          setSpeed={setSpeed}
          testToneActive={testToneActive}
          testToneType={testToneType}
          toggleTestTone={toggleTestTone}
          livePeak={livePeak}
          bandEnergy={bandEnergy}
        />
      )}
    </>
  );
};

// --- Expanded High-Resolution Spectrum Inspector Modal ---
interface ExpandedModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewMode: 'curve' | 'bars';
  setViewMode: (v: 'curve' | 'bars') => void;
  peakHoldEnabled: boolean;
  setPeakHoldEnabled: (v: boolean) => void;
  speed: 'fast' | 'norm' | 'smooth';
  setSpeed: (v: 'fast' | 'norm' | 'smooth') => void;
  testToneActive: boolean;
  testToneType: 'pink' | 'sine' | 'sweep' | 'white';
  toggleTestTone: (type?: 'pink' | 'sine' | 'sweep' | 'white') => void;
  livePeak: { freq: number; db: number; note: string };
  bandEnergy: { sub: number; bass: number; mid: number; high: number };
}

const ExpandedSpectrumModal: React.FC<ExpandedModalProps> = ({
  isOpen,
  onClose,
  viewMode,
  setViewMode,
  peakHoldEnabled,
  setPeakHoldEnabled,
  speed,
  setSpeed,
  testToneActive,
  testToneType,
  toggleTestTone,
  livePeak,
  bandEnergy
}) => {
  const bigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isFrozen, setIsFrozen] = useState(false);
  const [hoverData, setHoverData] = useState<{ x: number; y: number; freq: number; db: number; note: string } | null>(null);
  const [slopeTilt, setSlopeTilt] = useState<0 | 3 | 4.5>(3); // 3dB/oct standard pink slope
  const peaksRef = useRef<Float32Array | null>(null);
  const frozenBufferRef = useRef<Uint8Array | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Modal Spectral Capture & Playback State
  const [isRecording, setIsRecording] = useState(() => spectralCaptureService.getIsRecording());
  const [recordedFramesCount, setRecordedFramesCount] = useState(() => spectralCaptureService.getFramesCount());
  const [recordedDurationMs, setRecordedDurationMs] = useState(() => spectralCaptureService.getCurrentDurationMs());
  const [lastSession, setLastSession] = useState<SpectralRecordingSession | null>(() => spectralCaptureService.getLastSession());
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [modalToast, setModalToast] = useState<string | null>(null);

  useEffect(() => {
    spectralCaptureService.onRecordingStateChange = (rec, count, dur) => {
      setIsRecording(rec);
      setRecordedFramesCount(count);
      setRecordedDurationMs(dur);
      if (!rec) {
        setLastSession(spectralCaptureService.getLastSession());
      }
    };
  }, []);

  // Playback timer loop
  useEffect(() => {
    if (!isPlayingBack || !lastSession || lastSession.frames.length === 0) return;
    const interval = setInterval(() => {
      setPlaybackIndex(prev => {
        const next = (prev === null ? 0 : prev + 1);
        if (next >= lastSession.frames.length) {
          setIsPlayingBack(false);
          return lastSession.frames.length - 1;
        }
        return next;
      });
    }, 40); // ~25 fps
    return () => clearInterval(interval);
  }, [isPlayingBack, lastSession]);

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      const session = spectralCaptureService.stopRecording(audioEngine.getMasterSampleRate());
      setLastSession(session);
      setPlaybackIndex(null);
      setIsPlayingBack(false);
    } else {
      setPlaybackIndex(null);
      setIsPlayingBack(false);
      spectralCaptureService.startRecording();
    }
  }, [isRecording]);

  const handleCaptureSnapshot = useCallback(() => {
    const analyser = audioEngine.getMasterAnalyser();
    if (!analyser) return;

    const snapshot = {
      timestamp: new Date().toISOString(),
      peakFreq: livePeak.freq,
      peakDb: livePeak.db,
      note: livePeak.note,
      bandEnergy,
      sampleRate: audioEngine.getMasterSampleRate(),
      fftSize: analyser.fftSize
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(snapshot, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `master_spectrum_snapshot_${Date.now()}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();

    setModalToast("Snapshot Downloaded!");
    setTimeout(() => setModalToast(null), 2000);
  }, [livePeak, bandEnergy]);

  useEffect(() => {
    const canvas = bigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      const analyser = audioEngine.getMasterAnalyser();
      const width = canvas.width;
      const height = canvas.height;
      if (width === 0 || height === 0) return;

      const binCount = analyser ? analyser.frequencyBinCount : 1024;
      const sampleRate = (analyser && analyser.context ? analyser.context.sampleRate : 48000);
      const nyquist = sampleRate / 2;

      let freqArray: Uint8Array;
      if (isFrozen && frozenBufferRef.current) {
        freqArray = frozenBufferRef.current;
      } else {
        freqArray = new Uint8Array(binCount);
        if (analyser) {
          analyser.getByteFrequencyData(freqArray);
        }
        if (!frozenBufferRef.current || frozenBufferRef.current.length !== binCount) {
          frozenBufferRef.current = new Uint8Array(binCount);
        }
        frozenBufferRef.current.set(freqArray);
      }

      if (!peaksRef.current || peaksRef.current.length !== width) {
        peaksRef.current = new Float32Array(width);
      }
      const peaks = peaksRef.current;

      ctx.clearRect(0, 0, width, height);

      // Deep studio background with oscilloscope grid
      ctx.fillStyle = '#06090e';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.5)';
      ctx.font = '10px ui-monospace, SFMono-Regular, monospace';

      // Horizontal dB lines
      const dbMarks = [0, -6, -12, -18, -24, -30, -36, -42, -48, -54, -60, -72];
      dbMarks.forEach((db) => {
        const norm = (db + 72) / 72;
        const y = height - (norm * (height - 30) + 15);
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        ctx.textAlign = 'right';
        ctx.fillText(`${db}dB`, 30, y + 3);
      });

      // Vertical Frequency lines
      const detailedFreqs = [
        30, 60, 100, 200, 300, 500, 700, 1000, 2000, 3000, 5000, 7000, 10000, 15000, 20000
      ];
      detailedFreqs.forEach((freq) => {
        const x = 35 + ((Math.log10(freq) - logMin) / logRange) * (width - 35);
        ctx.beginPath();
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.moveTo(x, 10);
        ctx.lineTo(x, height - 20);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textAlign = 'center';
        const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
        ctx.fillText(label, x, height - 5);
      });

      // Frequency points
      const plotWidth = width - 35;
      const spectrumPoints: number[] = new Array(plotWidth);
      const bottomY = height - 20;

      const activePlaybackFrame = (playbackIndex !== null && lastSession && lastSession.frames[playbackIndex]) ? lastSession.frames[playbackIndex] : null;

      if (activePlaybackFrame) {
        const bands = activePlaybackFrame.spectrumBands;
        const numBands = bands.length;
        for (let i = 0; i < plotWidth; i++) {
          const bandIdx = (i / plotWidth) * (numBands - 1);
          const low = Math.floor(bandIdx);
          const high = Math.min(numBands - 1, Math.ceil(bandIdx));
          const frac = bandIdx - low;
          const rawVal = bands[low] * (1 - frac) + bands[high] * frac;
          const normY = (rawVal / 255) * (height - 35);
          spectrumPoints[i] = normY;
          peaks[i] = Math.max(normY, peaks[i] * 0.98);
        }
      } else {
        for (let i = 0; i < plotWidth; i++) {
          const logX = logMin + (i / plotWidth) * logRange;
          const freq = Math.pow(10, logX);
          const bin = Math.min(Math.round((freq / nyquist) * binCount), binCount - 1);
          let rawVal = freqArray[bin] || 0;

          // Apply slope tilt compensation (e.g. 3dB or 4.5dB per octave)
          if (slopeTilt > 0) {
            const octavesAbove20 = Math.log2(freq / 20);
            const boost = (octavesAbove20 * slopeTilt * 255) / 60;
            rawVal = Math.min(255, rawVal + boost * 0.4);
          }

          const normY = (rawVal / 255) * (height - 35);
          spectrumPoints[i] = normY;

          if (normY > peaks[i]) {
            peaks[i] = normY;
          } else {
            peaks[i] = Math.max(0, peaks[i] - 0.7);
          }
        }
      }

      if (viewMode === 'curve') {
        const grad = ctx.createLinearGradient(35, 0, width, 0);
        grad.addColorStop(0.0, 'rgba(6, 182, 212, 0.4)');
        grad.addColorStop(0.25, 'rgba(16, 185, 129, 0.4)');
        grad.addColorStop(0.65, 'rgba(245, 158, 11, 0.4)');
        grad.addColorStop(1.0, 'rgba(244, 63, 94, 0.4)');

        const strokeGrad = ctx.createLinearGradient(35, 0, width, 0);
        strokeGrad.addColorStop(0.0, '#06b6d4');
        strokeGrad.addColorStop(0.25, '#10b981');
        strokeGrad.addColorStop(0.65, '#f59e0b');
        strokeGrad.addColorStop(1.0, '#f43f5e');

        // Draw filled polygon
        ctx.beginPath();
        ctx.moveTo(35, bottomY);
        for (let i = 0; i < plotWidth; i++) {
          ctx.lineTo(35 + i, bottomY - spectrumPoints[i]);
        }
        ctx.lineTo(width, bottomY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Stroke
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(35, bottomY - spectrumPoints[0]);
        for (let i = 1; i < plotWidth; i++) {
          ctx.lineTo(35 + i, bottomY - spectrumPoints[i]);
        }
        ctx.strokeStyle = strokeGrad;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(6, 182, 212, 0.8)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.restore();

        // Peak Hold Line
        if (peakHoldEnabled) {
          ctx.save();
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1;
          for (let i = 0; i < plotWidth; i++) {
            const y = bottomY - peaks[i];
            if (i === 0) ctx.moveTo(35 + i, y);
            else ctx.lineTo(35 + i, y);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else {
        // High-res 31-Band RTA
        const barGap = 3;
        const totalGap = (ISO_BANDS_31.length - 1) * barGap;
        const barWidth = (plotWidth - totalGap) / ISO_BANDS_31.length;

        ISO_BANDS_31.forEach((bandFreq, i) => {
          const x = 35 + i * (barWidth + barGap);
          const bin = Math.min(Math.round((bandFreq / nyquist) * binCount), binCount - 1);
          let sum = freqArray[bin] || 0;
          let count = 1;
          if (bin > 0) { sum += freqArray[bin - 1]; count++; }
          if (bin < binCount - 1) { sum += freqArray[bin + 1]; count++; }
          const avgVal = sum / count;

          const barHeight = (avgVal / 255) * (height - 35);
          const segments = 24;
          const segHeight = (height - 35) / segments;
          const litSegments = Math.round((barHeight / (height - 35)) * segments);

          for (let s = 0; s < segments; s++) {
            const segY = bottomY - (s + 1) * segHeight + 1;
            const isLit = s < litSegments;

            if (isLit) {
              if (s > 20) ctx.fillStyle = '#ef4444';
              else if (s > 15) ctx.fillStyle = '#f59e0b';
              else if (s > 8) ctx.fillStyle = '#10b981';
              else ctx.fillStyle = '#06b6d4';
            } else {
              ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            }

            ctx.fillRect(x, segY, barWidth, segHeight - 1);
          }

          if (peakHoldEnabled) {
            const peakBinX = Math.round(i * (barWidth + barGap));
            const peakVal = peaks[peakBinX] || 0;
            const peakY = bottomY - peakVal;
            if (peakVal > 4) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(x, peakY - 1, barWidth, 2);
            }
          }
        });
      }

      // Hover Crosshair
      if (hoverData && hoverData.x >= 35 && hoverData.x <= width) {
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);

        ctx.beginPath();
        ctx.moveTo(hoverData.x, 10);
        ctx.lineTo(hoverData.x, bottomY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(35, hoverData.y);
        ctx.lineTo(width, hoverData.y);
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(hoverData.x, hoverData.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Drawing Recording / Playback Overlay
      if (spectralCaptureService.getIsRecording()) {
        ctx.save();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(width - 25, 25, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 11px ui-monospace, SFMono-Regular, monospace';
        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'right';
        ctx.fillText('REC SPECTRAL DATA', width - 36, 29);
        ctx.restore();
      } else if (activePlaybackFrame) {
        ctx.save();
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 10px ui-monospace, SFMono-Regular, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`SCRUBBER [FRAME ${playbackIndex! + 1}/${lastSession!.totalFrames}] ${activePlaybackFrame.timeOffsetMs}ms (PEAK: ${activePlaybackFrame.peakFreq}Hz @ ${activePlaybackFrame.peakDb}dB)`, width - 20, 25);
        ctx.restore();
      }
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [viewMode, peakHoldEnabled, isFrozen, hoverData, slopeTilt, playbackIndex, lastSession, isRecording]);

  // Hi-DPI setup for expanded modal
  useEffect(() => {
    const canvas = bigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
  }, []);

  const handleBigMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = bigCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const mouseX = (e.clientX - rect.left) * dpr;
    const mouseY = (e.clientY - rect.top) * dpr;

    const minFreq = 20;
    const maxFreq = 20000;
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(maxFreq);
    const logRange = logMax - logMin;

    const plotWidth = canvas.width - 35;
    const normX = Math.max(0, Math.min(1, (mouseX - 35) / plotWidth));
    const logX = logMin + normX * logRange;
    const freq = Math.round(Math.pow(10, logX));

    const bottomY = canvas.height - 20;
    const normY = Math.max(0, Math.min(1, (bottomY - mouseY) / (canvas.height - 35)));
    const db = Math.round((normY * 72 - 72) * 10) / 10;
    const note = freqToNote(freq);

    setHoverData({ x: mouseX, y: mouseY, freq, db, note });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#111419] border border-[#2b3240] rounded-lg shadow-2xl max-w-4xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-3 bg-[#0a0d12] border-b border-[#222834] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <h2 className="text-sm font-black font-mono tracking-widest text-white">
              CORE AZERO // MASTER RTA SPECTRUM INSPECTOR
            </h2>
            <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-700/60 px-1.5 py-0.5 rounded font-mono">
              64-BIT FFT ANALYZER
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <Minimize2 size={16} />
          </button>
        </div>

        {/* Modal Control Toolbar */}
        <div className="p-2.5 bg-[#141820] border-b border-[#222834] flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            {/* View Mode */}
            <div className="flex bg-[#0b0e14] rounded border border-[#252c3c] p-0.5">
              <button
                onClick={() => setViewMode('curve')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  viewMode === 'curve' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                CURVE SPECTRUM
              </button>
              <button
                onClick={() => setViewMode('bars')}
                className={`px-2.5 py-1 rounded font-bold transition-colors ${
                  viewMode === 'bars' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                1/3 OCTAVE BARS
              </button>
            </div>

            {/* Freeze Frame Button */}
            <button
              onClick={() => setIsFrozen(!isFrozen)}
              className={`px-2.5 py-1 rounded border font-bold flex items-center gap-1.5 transition-colors ${
                isFrozen
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600 ring-1 ring-amber-500'
                  : 'bg-[#0b0e14] text-gray-300 border-[#252c3c] hover:bg-white/5'
              }`}
            >
              {isFrozen ? <Play size={10} /> : <Pause size={10} />}
              <span>{isFrozen ? 'UNFREEZE' : 'FREEZE HOLD'}</span>
            </button>

            {/* Peak Hold */}
            <button
              onClick={() => setPeakHoldEnabled(!peakHoldEnabled)}
              className={`px-2.5 py-1 rounded border font-bold transition-colors ${
                peakHoldEnabled
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-[#0b0e14] text-gray-400 border-[#252c3c]'
              }`}
            >
              PEAKS: {peakHoldEnabled ? 'ENABLED' : 'OFF'}
            </button>

            {/* Slope Tilt Selector */}
            <div className="flex items-center gap-1 bg-[#0b0e14] px-2 py-1 rounded border border-[#252c3c]">
              <span className="text-gray-400">SLOPE:</span>
              <button
                onClick={() => setSlopeTilt(0)}
                className={`px-1.5 rounded ${slopeTilt === 0 ? 'bg-cyan-700 text-white' : 'text-gray-400'}`}
              >
                0dB
              </button>
              <button
                onClick={() => setSlopeTilt(3)}
                className={`px-1.5 rounded ${slopeTilt === 3 ? 'bg-cyan-700 text-white' : 'text-gray-400'}`}
                title="+3dB/oct (Pink noise flat calibration)"
              >
                +3dB
              </button>
              <button
                onClick={() => setSlopeTilt(4.5)}
                className={`px-1.5 rounded ${slopeTilt === 4.5 ? 'bg-cyan-700 text-white' : 'text-gray-400'}`}
              >
                +4.5dB
              </button>
            </div>
          </div>

          {/* Test Signal Generator Controls */}
          <div className="flex items-center gap-1.5 bg-[#0b0e14] p-1 rounded border border-[#252c3c]">
            <span className="text-gray-400 px-1">CALIBRATE:</span>
            <button
              onClick={() => toggleTestTone('pink')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                testToneActive && testToneType === 'pink'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              PINK NOISE
            </button>
            <button
              onClick={() => toggleTestTone('sine')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                testToneActive && testToneType === 'sine'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              1kHz SINE
            </button>
            <button
              onClick={() => toggleTestTone('sweep')}
              className={`px-2 py-0.5 rounded text-[9px] font-bold transition-colors ${
                testToneActive && testToneType === 'sweep'
                  ? 'bg-amber-600 text-white animate-pulse'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              SWEEP 20-20k
            </button>
            {testToneActive && (
              <button
                onClick={() => toggleTestTone()}
                className="px-2 py-0.5 rounded text-[9px] bg-red-900/60 hover:bg-red-800 text-red-200 font-bold border border-red-700"
              >
                STOP
              </button>
            )}
          </div>
        </div>

        {/* Spectral Capture & Playback Scrubber Toolbar */}
        <div className="px-3 py-2 bg-[#0c1017] border-b border-[#1c2331] flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono">
          <div className="flex items-center gap-2">
            {/* Record Button */}
            <button
              onClick={handleToggleRecord}
              className={`flex items-center gap-1.5 px-3 py-1 rounded font-bold tracking-wider transition-all skeuo-button active:scale-95 ${
                isRecording
                  ? 'bg-red-600 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.7)]'
                  : 'bg-[#161d2b] hover:bg-red-950/70 text-red-400 hover:text-red-300 border border-red-900/80'
              }`}
              title={isRecording ? 'Stop Recording Spectral Data' : 'Start Recording Master Frequency Spectrum Timeline'}
            >
              {isRecording ? <Square size={10} className="fill-white" /> : <Circle size={10} className="fill-red-500 text-red-500" />}
              <span>
                {isRecording
                  ? `RECORDING [${(recordedDurationMs / 1000).toFixed(1)}s] (${recordedFramesCount} frames)`
                  : 'RECORD SPECTRA'}
              </span>
            </button>

            {/* Instant Snapshot */}
            <button
              onClick={handleCaptureSnapshot}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#161d2b] hover:bg-white/10 text-gray-300 hover:text-cyan-300 border border-[#252f44] transition-colors"
              title="Save instant snapshot of current frequency spectrum curve (JSON)"
            >
              <Camera size={11} className="text-cyan-400" />
              <span>SNAPSHOT</span>
            </button>

            {modalToast && (
              <span className="text-[9px] text-green-400 font-bold animate-pulse">
                {modalToast}
              </span>
            )}
          </div>

          {/* If Session Exists: Playback Scrubber, Exports, Clear */}
          {lastSession && (
            <div className="flex items-center gap-3 bg-[#111723] px-3 py-1 rounded border border-[#1f283b] flex-1 max-w-xl">
              {/* Play / Pause Replay */}
              <button
                onClick={() => {
                  if (isPlayingBack) {
                    setIsPlayingBack(false);
                  } else {
                    if (playbackIndex === null || playbackIndex >= lastSession.frames.length - 1) {
                      setPlaybackIndex(0);
                    }
                    setIsPlayingBack(true);
                  }
                }}
                className={`p-1 rounded transition-colors ${
                  isPlayingBack ? 'bg-cyan-600 text-white' : 'bg-white/5 hover:bg-white/10 text-cyan-400'
                }`}
                title={isPlayingBack ? 'Pause Spectral Replay' : 'Play / Replay Recorded Spectral Animation'}
              >
                {isPlayingBack ? <Pause size={12} /> : <Play size={12} />}
              </button>

              {/* Scrubber Range Input */}
              <div className="flex-1 flex items-center gap-2">
                <span className="text-[9px] text-gray-400 font-mono shrink-0">
                  {playbackIndex !== null ? `${lastSession.frames[playbackIndex]?.timeOffsetMs || 0}ms` : '0ms'}
                </span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, lastSession.frames.length - 1)}
                  value={playbackIndex ?? 0}
                  onChange={(e) => {
                    setIsPlayingBack(false);
                    setPlaybackIndex(parseInt(e.target.value, 10));
                  }}
                  className="w-full accent-cyan-500 h-1 bg-[#1d2638] rounded cursor-pointer"
                  title="Scrub across recorded spectral timeline"
                />
                <span className="text-[9px] text-gray-500 font-mono shrink-0">
                  {(lastSession.durationMs / 1000).toFixed(1)}s
                </span>
              </div>

              {/* Live / Scrubber Toggle */}
              {playbackIndex !== null && (
                <button
                  onClick={() => {
                    setPlaybackIndex(null);
                    setIsPlayingBack(false);
                  }}
                  className="px-1.5 py-0.5 rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-700/60 text-[9px] font-bold"
                  title="Return to real-time live RTA display"
                >
                  LIVE RTA
                </button>
              )}

              {/* Export Buttons */}
              <button
                onClick={() => spectralCaptureService.exportJson()}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 font-bold transition-colors"
                title="Download full spectral session as JSON"
              >
                <Download size={10} />
                <span>JSON</span>
              </button>
              <button
                onClick={() => spectralCaptureService.exportCsv()}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#161d2b] hover:bg-white/10 text-gray-300 hover:text-emerald-300 border border-[#252f44] transition-colors"
                title="Download full spectral timeline as CSV"
              >
                <FileText size={10} />
                <span>CSV</span>
              </button>
              <button
                onClick={() => {
                  spectralCaptureService.clearSession();
                  setLastSession(null);
                  setPlaybackIndex(null);
                  setIsPlayingBack(false);
                }}
                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                title="Clear recorded spectral buffer"
              >
                <Trash2 size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Big Canvas Display */}
        <div className="p-4 bg-[#0a0d12] flex flex-col gap-3">
          <div className="relative w-full h-[360px] bg-[#05070a] rounded border border-[#1e2532] shadow-inner overflow-hidden cursor-crosshair">
            <canvas
              ref={bigCanvasRef}
              className="w-full h-full block"
              onMouseMove={handleBigMouseMove}
              onMouseLeave={() => setHoverData(null)}
            />

            {/* Hover Tooltip Overlay */}
            {hoverData && (
              <div className="absolute top-3 right-3 bg-black/90 border border-cyan-500 rounded p-2 text-xs font-mono text-cyan-300 pointer-events-none shadow-2xl flex flex-col gap-1 min-w-[150px]">
                <div className="flex justify-between items-center border-b border-cyan-800/60 pb-1">
                  <span className="text-gray-400">FREQUENCY:</span>
                  <span className="font-bold text-white">{hoverData.freq} Hz</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">NOTE:</span>
                  <span className="text-emerald-400 font-bold">{hoverData.note || '--'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">AMPLITUDE:</span>
                  <span className="text-amber-400 font-bold">{hoverData.db} dB</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Energy Gauge Bar */}
          <div className="grid grid-cols-4 gap-3 bg-[#11151c] p-2.5 rounded border border-[#222834]">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-cyan-400 font-bold">SUB-BASS (20-60Hz)</span>
                <span className="text-white">{bandEnergy.sub}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 transition-all duration-75" style={{ width: `${bandEnergy.sub}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-emerald-400 font-bold">BASS / LOW-MID (60-250Hz)</span>
                <span className="text-white">{bandEnergy.bass}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${bandEnergy.bass}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-amber-400 font-bold">MIDS (250-4000Hz)</span>
                <span className="text-white">{bandEnergy.mid}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 transition-all duration-75" style={{ width: `${bandEnergy.mid}%` }} />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-rose-400 font-bold">PRESENCE & AIR (4k-20kHz)</span>
                <span className="text-white">{bandEnergy.high}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#1b2230] rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${bandEnergy.high}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-[#0a0d12] border-t border-[#222834] flex items-center justify-between text-[10px] font-mono text-gray-400">
          <div className="flex items-center gap-3">
            <span>PEAK DETECTOR: <strong className="text-cyan-300">{livePeak.freq > 0 ? `${livePeak.freq} Hz (${livePeak.db} dB)` : 'IDLE'}</strong></span>
            {livePeak.note && <span>TUNING: <strong className="text-emerald-400">{livePeak.note}</strong></span>}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gradient-to-r from-cyan-900 to-cyan-800 hover:from-cyan-800 hover:to-cyan-700 text-white rounded font-bold transition-all shadow"
          >
            CLOSE INSPECTOR
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpectrumAnalyzer;
