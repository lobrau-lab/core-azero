
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { TOTAL_INPUTS, CHANNEL_COLORS, ICONS } from './constants';
import { ChannelSettings, MasterSettings, StripType, ConsolePreset, ChannelStripPreset, MasterBusPreset, MidiMapping, MidiTarget, VstPluginConfig } from './types';
import { X, Bookmark, Sliders, Shield, RefreshCw, Cpu, Check, ChevronDown, Plus, Radio, Zap, Layers, TrendingUp, PowerOff } from 'lucide-react';
import MixerStrip from './components/MixerStrip';
import MasterSection from './components/MasterSection';
import VbanPanel from './components/VbanPanel';
import DriverModal from './components/DriverModal';
import PresetsModal from './components/PresetsModal';
import MidiModal from './components/MidiModal';
import VstPluginModal from './components/VstPluginModal';
import AutomationOverviewModal from './components/AutomationOverviewModal';
import { audioEngine } from './services/audioEngine';
import { audioHealthMonitor } from './services/AudioHealthMonitor';
import { getGeminiOptimization } from './services/geminiService';
import { presetService } from './services/presetService';
import { midiService } from './services/midiService';
import { getDefaultVstConfig } from './services/vstPluginsData';
import { automationService } from './services/automationService';

const INITIAL_CHANNELS: ChannelSettings[] = Array.from({ length: TOTAL_INPUTS }, (_, i) => ({
  id: i + 1,
  name: `CH ${i + 1}`,
  type: i < 5 ? StripType.PHYSICAL : StripType.VIRTUAL,
  gain: 1,
  mute: false,
  solo: false,
  monitor: false,
  pan: 0,
  eq: { low: 0, mid: 0, high: 0 },
  gate: { threshold: -60, active: false },
  compressor: { threshold: -20, ratio: 1, active: false },
  routing: [],
  vst: getDefaultVstConfig(i + 1),
}));

const INITIAL_MASTER: MasterSettings = {
    reverb: 0, delay: 0, noiseReduction: 0, aec: false, masterGain: 0.8, smartMastering: false
};

const App: React.FC = () => {
  const [channels, setChannels] = useState<ChannelSettings[]>(() => {
      const saved = localStorage.getItem('omni_channels');
      if (saved) {
        try {
          const parsed: ChannelSettings[] = JSON.parse(saved);
          return parsed.map((ch, i) => ({
            ...ch,
            vst: ch.vst || getDefaultVstConfig(ch.id || i + 1)
          }));
        } catch {
          // fallback to INITIAL_CHANNELS
        }
      }
      return INITIAL_CHANNELS;
  });
  
  const [masterSettings, setMasterSettings] = useState<MasterSettings>(() => {
      const saved = localStorage.getItem('omni_master');
      return saved ? JSON.parse(saved) : INITIAL_MASTER;
  });

  const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [isDriverModalOpen, setDriverModalOpen] = useState(false);
  const [notification, setNotification] = useState<{title: string, message: string} | null>(null);

  // Preset Management State
  const [isPresetsModalOpen, setPresetsModalOpen] = useState(false);
  const [presetsInitialTab, setPresetsInitialTab] = useState<'console' | 'channel' | 'master' | 'backup'>('console');
  const [preselectedChannelForPresets, setPreselectedChannelForPresets] = useState<number>(1);
  const [activePresetId, setActivePresetId] = useState<string | null>(() => presetService.getActivePresetId());
  const [consolePresets, setConsolePresets] = useState<ConsolePreset[]>(() => presetService.getConsolePresets());
  const [channelPresets, setChannelPresets] = useState<ChannelStripPreset[]>(() => presetService.getChannelPresets());
  const [masterPresets, setMasterPresets] = useState<MasterBusPreset[]>(() => presetService.getMasterPresets());

  // MIDI Controller State
  const [isMidiModalOpen, setMidiModalOpen] = useState(false);
  const [isMidiLearnMode, setMidiLearnMode] = useState(false);
  const [activeLearningTarget, setActiveLearningTarget] = useState<MidiTarget | null>(null);
  const [midiMappings, setMidiMappings] = useState<MidiMapping[]>(() => midiService.getMappings());
  const [midiDevicesCount, setMidiDevicesCount] = useState(0);

  // External VST Plugin Host State
  const [isVstModalOpen, setVstModalOpen] = useState(false);
  const [vstModalChannelId, setVstModalChannelId] = useState<number>(1);

  // Master VST Bypass State (Quick A/B Dry vs Wet Signal Testing)
  const [isMasterVstBypassed, setIsMasterVstBypassed] = useState(false);
  const previousVstStatesRef = useRef<Map<number, boolean>>(new Map());

  // Automation Overview Recharts Modal State
  const [isAutomationOverviewOpen, setAutomationOverviewOpen] = useState(false);

  const refreshPresetLists = useCallback(() => {
    setConsolePresets(presetService.getConsolePresets());
    setChannelPresets(presetService.getChannelPresets());
    setMasterPresets(presetService.getMasterPresets());
  }, []);

  // Web MIDI Lifecycle & Listeners
  useEffect(() => {
    midiService.initialize().then(() => {
      setMidiDevicesCount(midiService.getConnectedDevices().length);
    });

    midiService.onMappingsUpdated = (maps) => setMidiMappings(maps);
    midiService.onDeviceStateChange = (devs) => setMidiDevicesCount(devs.length);

    midiService.onMappingLearned = (mapping, target) => {
      setActiveLearningTarget(null);
      setNotification({
        title: "MIDI Mapped Successfully",
        message: `Assigned "${target.label}" to ${mapping.messageType.toUpperCase()} #${mapping.controlNumber} (Ch ${mapping.midiChannel === 0 ? 'Omni' : mapping.midiChannel})`
      });
    };

    midiService.onContinuousControl = (target, normalizedValue) => {
      if (target.type === 'channel_gain' && target.channelId) {
        const newGain = Math.round(normalizedValue * 1.2 * 100) / 100;
        setChannels(prev => prev.map(ch => ch.id === target.channelId ? { ...ch, gain: newGain } : ch));
        automationService.recordFaderMove(target.channelId, newGain);
      } else if (target.type === 'master_gain') {
        const newGain = Math.round(normalizedValue * 1.5 * 100) / 100;
        setMasterSettings(prev => ({ ...prev, masterGain: newGain }));
        automationService.recordFaderMove('master', newGain);
      }
    };

    midiService.onToggleControl = (target) => {
      if (target.type === 'channel_mute' && target.channelId) {
        setChannels(prev => prev.map(ch => ch.id === target.channelId ? { ...ch, mute: !ch.mute } : ch));
      } else if (target.type === 'channel_solo' && target.channelId) {
        setChannels(prev => prev.map(ch => ch.id === target.channelId ? { ...ch, solo: !ch.solo } : ch));
      } else if (target.type === 'channel_monitor' && target.channelId) {
        setChannels(prev => prev.map(ch => ch.id === target.channelId ? { ...ch, monitor: !ch.monitor } : ch));
      } else if (target.type === 'master_smart_mastering') {
        setMasterSettings(prev => ({ ...prev, smartMastering: !prev.smartMastering }));
      } else if (target.type === 'master_aec') {
        setMasterSettings(prev => ({ ...prev, aec: !prev.aec }));
      }
    };

    return () => {
      midiService.onMappingsUpdated = null;
      midiService.onDeviceStateChange = null;
      midiService.onMappingLearned = null;
      midiService.onContinuousControl = null;
      midiService.onToggleControl = null;
    };
  }, []);

  const handleToggleLearnMode = useCallback(() => {
    setMidiLearnMode(prev => {
      const next = !prev;
      if (!next) {
        midiService.cancelLearn();
        setActiveLearningTarget(null);
      }
      return next;
    });
  }, []);

  const handleStartLearn = useCallback((target: MidiTarget) => {
    setMidiLearnMode(true);
    setActiveLearningTarget(target);
    midiService.startLearn(target);
  }, []);

  const handleCancelLearn = useCallback(() => {
    midiService.cancelLearn();
    setActiveLearningTarget(null);
  }, []);

  // Profile Persistence
  useEffect(() => {
      localStorage.setItem('omni_channels', JSON.stringify(channels));
  }, [channels]);

  useEffect(() => {
      localStorage.setItem('omni_master', JSON.stringify(masterSettings));
  }, [masterSettings]);

  const refreshDevices = async () => {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        
        // If device labels are empty, we need to request permission
        if (!devices.some(d => d.label) && devices.length > 0) {
             console.log("Labels missing. Requesting permissions...");
             try {
                 const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                 stream.getTracks().forEach(t => t.stop());
                 // Enumerate again after permission granted
                 devices = await navigator.mediaDevices.enumerateDevices();
             } catch (e) {
                 console.warn("Permission denied for audio devices.");
             }
        }

        const inputs = devices.filter(d => d.kind === 'audioinput');
        const outputs = devices.filter(d => d.kind === 'audiooutput');

        // Inject Virtual Capture Option for Application Audio
        // This allows the user to select a specific App Window or Tab via the browser's native picker
        const appCapture = {
            deviceId: 'display-capture',
            kind: 'audioinput',
            label: '🖥️ App / Window Capture',
            groupId: 'virtual',
            toJSON: () => {}
        } as unknown as MediaDeviceInfo;

        setInputDevices([appCapture, ...inputs]);
        setOutputDevices(outputs);
      } catch (e) {
        console.error("Failed to enumerate devices:", e);
      }
  };

  useEffect(() => {
    const init = async () => {
      await audioEngine.initialize();
      await refreshDevices();
      
      // Initialize channels in engine
      channels.forEach(ch => {
          audioEngine.createChannelStrip(ch.id);
          // Re-connect device if it was saved
          if (ch.deviceId) audioEngine.setInputDevice(ch.id, ch.deviceId);
      });

      audioHealthMonitor.start(channels);
      audioHealthMonitor.onHealthUpdate = (report) => {
          if (report.status !== 'HEALTHY') console.warn(report);
      };

      audioEngine.onNeedsHealing = async (reason) => {
          console.error(`Self-healing triggered: ${reason}`);
          setNotification({ title: "SONIC ATTACK DETECTED", message: `Initiating self-healing sequence... (${reason})` });
          
          try {
              await audioEngine.reboot(channels, masterSettings);
              setNotification({ title: "SYSTEM REPAIRED", message: "Audio engine successfully rebooted and restored." });
          } catch (e) {
              setNotification({ title: "HEALING FAILED", message: "Critical failure during reboot. Please refresh the application." });
          }
      };
    };
    init();

    // Hot-Plug Listener
    const handleDeviceChange = () => {
        console.log("Hardware change detected. Refreshing devices...");
        refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
        audioHealthMonitor.stop();
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  useEffect(() => {
      audioHealthMonitor.updateChannels(channels);
      const anySoloed = channels.some(ch => ch.solo);
      channels.forEach(ch => audioEngine.updateChannel(ch, anySoloed));
  }, [channels]);

  useEffect(() => {
      audioEngine.updateMaster(masterSettings);
  }, [masterSettings]);

  // Automation Lane Playback Dispatcher
  useEffect(() => {
    automationService.onApplyFader = (targetId, value, channelId) => {
      if (targetId === 'master') {
        setMasterSettings(prev => prev.masterGain === value ? prev : { ...prev, masterGain: value });
      } else if (channelId !== undefined) {
        setChannels(prev => prev.map(ch => ch.id === channelId ? (ch.gain === value ? ch : { ...ch, gain: value }) : ch));
      }
    };

    return () => {
      automationService.onApplyFader = null;
    };
  }, []);

  const handleChannelChange = React.useCallback((updated: ChannelSettings) => {
    setChannels(prev => {
      const prevCh = prev.find(c => c.id === updated.id);
      if (prevCh && prevCh.gain !== updated.gain) {
        automationService.recordFaderMove(updated.id, updated.gain);
      }
      return prev.map(ch => ch.id === updated.id ? updated : ch);
    });
  }, []);

  const handleOptimization = async (channelId: number) => {
     const ch = channels.find(c => c.id === channelId);
     if(!ch) return;
     try {
       const suggestion = await getGeminiOptimization(ch.name, ch.type);
       setNotification({ title: `AI Optimization: ${ch.name}`, message: suggestion || "No suggestion available." });
     } catch (error: any) {
       setNotification({ title: `AI Optimization: ${ch.name}`, message: error.message || "Could not fetch AI suggestions at this time." });
     }
  };

  const handleMasterOptimization = () => {
      // Calculate safe gain
      const safeGain = audioEngine.calculateOptimalMasterGain();
      setMasterSettings(prev => ({ ...prev, masterGain: safeGain }));
  };

  const handleLoadAudio = async (file: File) => {
      try {
          // Use Channel 5 (first virtual channel) for playback
          const targetChannelId = 5;
          await audioEngine.setFileSource(targetChannelId, file);
          
          // Update channel name and ensure it's unmuted and volume is up
          setChannels(prev => prev.map(ch => {
              if (ch.id === targetChannelId) {
                  return { ...ch, name: file.name.substring(0, 10).toUpperCase(), mute: false, gain: 1 };
              }
              return ch;
          }));

          // Enable Smart Mastering automatically
          setMasterSettings(prev => ({ ...prev, smartMastering: true }));

          setNotification({ title: "Audio Loaded & Mastered", message: `Playing ${file.name} through Virtual Channel 5 with Smart Mastering enabled.` });
      } catch (err) {
          setNotification({ title: "Error", message: "Failed to load audio file." });
      }
  };

  const handleDriverRestart = async (settings: any) => {
      console.log("Rebooting Kernel with settings:", settings);
      // Simulate driver mode change
      setNotification({ title: "Driver Restart", message: `Switched to ${settings.driverMode} with ${settings.bufferSize} spls buffer.` });
      
      await audioEngine.initialize(settings.bufferSize / 48000, settings.sampleRate);
      // Re-initialize strips
      const anySoloed = channels.some(ch => ch.solo);
      channels.forEach(ch => {
          audioEngine.createChannelStrip(ch.id);
          audioEngine.setInputDevice(ch.id, ch.deviceId || '');
          audioEngine.updateChannel(ch, anySoloed);
      });
  };

  // --- PRESET LOAD HANDLERS ---
  const handleLoadConsolePreset = useCallback((preset: ConsolePreset) => {
    // Merge channels while keeping existing assigned device IDs if present
    const updatedChannels = preset.channels.map((pc, idx) => {
      const current = channels[idx];
      return {
        ...pc,
        id: idx + 1,
        deviceId: current?.deviceId || pc.deviceId,
        vst: pc.vst || current?.vst || getDefaultVstConfig(idx + 1),
      };
    });

    const updatedMaster: MasterSettings = {
      ...preset.master,
      outputDeviceId: masterSettings.outputDeviceId || preset.master.outputDeviceId,
    };

    setChannels(updatedChannels);
    setMasterSettings(updatedMaster);
    setActivePresetId(preset.id);
    presetService.setActivePresetId(preset.id);
    refreshPresetLists();

    setNotification({
      title: "Console Scene Loaded",
      message: `Successfully loaded "${preset.name}". All 8 channels and master settings updated.`
    });
  }, [channels, masterSettings, refreshPresetLists]);

  const handleLoadChannelPreset = useCallback((preset: ChannelStripPreset, targetChannelId: number | 'all') => {
    if (targetChannelId === 'all') {
      setChannels(prev => prev.map(ch => ({
        ...ch,
        gain: preset.settings.gain,
        mute: preset.settings.mute,
        solo: preset.settings.solo,
        monitor: preset.settings.monitor,
        pan: preset.settings.pan,
        eq: { ...preset.settings.eq },
        gate: { ...preset.settings.gate },
        compressor: { ...preset.settings.compressor },
        vst: preset.settings.vst ? JSON.parse(JSON.stringify(preset.settings.vst)) : ch.vst,
      })));
      setNotification({
        title: "Channel Preset Applied",
        message: `Applied "${preset.name}" across ALL 8 channels.`
      });
    } else {
      setChannels(prev => prev.map(ch => {
        if (ch.id === targetChannelId) {
          return {
            ...ch,
            gain: preset.settings.gain,
            mute: preset.settings.mute,
            solo: preset.settings.solo,
            monitor: preset.settings.monitor,
            pan: preset.settings.pan,
            eq: { ...preset.settings.eq },
            gate: { ...preset.settings.gate },
            compressor: { ...preset.settings.compressor },
            vst: preset.settings.vst ? JSON.parse(JSON.stringify(preset.settings.vst)) : ch.vst,
          };
        }
        return ch;
      }));
      setNotification({
        title: "Channel Strip Configured",
        message: `Applied "${preset.name}" to Channel ${targetChannelId}.`
      });
    }
  }, []);

  const handleLoadMasterPreset = useCallback((preset: MasterBusPreset) => {
    setMasterSettings(prev => ({
      ...preset.settings,
      outputDeviceId: prev.outputDeviceId || preset.settings.outputDeviceId
    }));
    setNotification({
      title: "Master Settings Loaded",
      message: `Loaded "${preset.name}" into master conditioning bus.`
    });
  }, []);

  // --- EXTERNAL VST HANDLERS ---
  const handleToggleChannelVst = useCallback((channelId: number) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === channelId) {
        const currentVst = ch.vst || getDefaultVstConfig(channelId);
        const nextVst = { ...currentVst, enabled: !currentVst.enabled };
        return { ...ch, vst: nextVst };
      }
      return ch;
    }));
  }, []);

  const handleUpdateChannelVst = useCallback((channelId: number, vst: VstPluginConfig) => {
    setChannels(prev => prev.map(ch => ch.id === channelId ? { ...ch, vst } : ch));
  }, []);

  const handleOpenVstModal = useCallback((channelId: number) => {
    setVstModalChannelId(channelId);
    setVstModalOpen(true);
  }, []);

  // Master VST Bypass Toggle (Sets all VST configs to enabled: false for dry vs wet testing)
  const handleToggleMasterVstBypass = useCallback(() => {
    setIsMasterVstBypassed(prev => {
      const nextBypassed = !prev;
      if (nextBypassed) {
        // Save current VST enabled state of all channels before disabling
        channels.forEach(ch => {
          if (ch.vst) {
            previousVstStatesRef.current.set(ch.id, ch.vst.enabled);
          }
        });

        // Set all VST plugin configs to enabled: false across all 8 channels simultaneously
        setChannels(currentChannels => currentChannels.map(ch => ({
          ...ch,
          vst: ch.vst ? { ...ch.vst, enabled: false } : undefined
        })));

        setNotification({
          title: "MASTER BYPASS: ACTIVE (DRY SIGNAL)",
          message: "All 8 channel VST plugin configs set to enabled: false for instant dry/wet A/B comparison."
        });
      } else {
        // Restore wet state across all 8 channels
        setChannels(currentChannels => currentChannels.map(ch => {
          if (!ch.vst) return ch;
          const wasEnabled = previousVstStatesRef.current.get(ch.id) ?? true;
          return {
            ...ch,
            vst: { ...ch.vst, enabled: wasEnabled }
          };
        }));

        setNotification({
          title: "MASTER BYPASS: OFF (WET SIGNAL)",
          message: "Restored VST plugins across all channel strips for processed wet signal."
        });
      }
      return nextBypassed;
    });
  }, [channels]);

  // Quick Open Modal with Specific Tab / Channel
  const openPresetsForChannel = (channelId: number) => {
    setPreselectedChannelForPresets(channelId);
    setPresetsInitialTab('channel');
    refreshPresetLists();
    setPresetsModalOpen(true);
  };

  const openPresetsForMaster = () => {
    setPresetsInitialTab('master');
    refreshPresetLists();
    setPresetsModalOpen(true);
  };

  const openPresetsModalGeneral = (tab: 'console' | 'channel' | 'master' | 'backup' = 'console') => {
    setPresetsInitialTab(tab);
    refreshPresetLists();
    setPresetsModalOpen(true);
  };

  const activeConsolePreset = consolePresets.find(p => p.id === activePresetId);

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white overflow-hidden select-none font-mono">
      
      {/* Top Console Hardware Rack Header */}
      <header className="bg-[#090909] border-b border-[#222] px-4 py-2 flex items-center justify-between shrink-0 skeuo-shadow z-30">
        <div className="flex items-center gap-4">
          {/* Brand & Console Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 led-green animate-pulse" />
            <div className="flex flex-col">
              <span className="text-xs font-black tracking-widest text-white uppercase italic leading-none">
                CORE AZERO
              </span>
              <span className="text-[8px] font-bold tracking-wider text-cyan-400 uppercase leading-none mt-0.5">
                VIRTUAL CONSOLE PRO
              </span>
            </div>
          </div>

          <div className="h-5 w-px bg-[#262626]" />

          {/* Quick Scene / Console Preset Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Bookmark size={11} className="text-cyan-400" /> SCENE:
            </span>
            <div className="relative group/scene">
              <button className="flex items-center gap-2 bg-[#141414] hover:bg-[#1a1a1a] border border-[#2e2e2e] hover:border-cyan-500/60 px-2.5 py-1 rounded text-[10px] font-bold text-gray-200 transition-colors skeuo-shadow">
                <span className="truncate max-w-[170px] text-cyan-300">
                  {activeConsolePreset?.name || "Standard / Custom Scene"}
                </span>
                <ChevronDown size={10} className="text-gray-400" />
              </button>

              <div className="absolute top-full left-0 mt-1 w-64 bg-[#111111] border border-cyan-800/80 rounded shadow-2xl z-50 p-1 text-[10px] hidden group-hover/scene:block animate-in fade-in duration-100">
                <div className="px-2 py-1 border-b border-[#252525] text-cyan-400 font-bold flex justify-between items-center text-[9px] uppercase">
                  <span>CONSOLE SCENES</span>
                  <span className="text-gray-500 text-[8px]">{consolePresets.length} PRESETS</span>
                </div>
                <div className="max-h-56 overflow-y-auto my-1 space-y-0.5">
                  {consolePresets.map((p) => {
                    const isSel = p.id === activePresetId;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleLoadConsolePreset(p)}
                        className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between transition-colors ${
                          isSel ? 'bg-cyan-900/40 text-cyan-200 font-bold' : 'hover:bg-white/5 text-gray-300'
                        }`}
                      >
                        <span className="truncate pr-1">{p.name}</span>
                        {p.isFactory ? (
                          <span className="text-[7px] text-blue-400 font-bold uppercase shrink-0">FAC</span>
                        ) : (
                          <span className="text-[7px] text-green-400 font-bold uppercase shrink-0">USR</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="border-t border-[#252525] pt-1">
                  <button
                    onClick={() => openPresetsModalGeneral('console')}
                    className="w-full text-center py-1 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 rounded text-[9px] font-bold tracking-wider"
                  >
                    + MANAGE ALL PRESETS
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* MIDI Learn Mode Toggle Button */}
          <button
            onClick={handleToggleLearnMode}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-black tracking-wider transition-all skeuo-button active:scale-95 ${
              isMidiLearnMode
                ? 'bg-amber-600 text-black border-amber-300 led-yellow animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                : 'bg-[#1a1a1a] hover:bg-[#252525] text-amber-400 border-[#333]'
            }`}
            title="Toggle MIDI Learn Mode (Click any mixer control, then move a MIDI fader or press a button)"
          >
            <Zap size={12} className={isMidiLearnMode ? 'text-black' : 'text-amber-400'} />
            <span>{isMidiLearnMode ? 'MIDI LEARN ON' : 'MIDI LEARN'}</span>
            {activeLearningTarget && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping ml-0.5" />
            )}
          </button>

          {/* MIDI Hardware / Settings Button */}
          <button
            onClick={() => setMidiModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-amber-400 border border-[#333] rounded text-[10px] font-bold tracking-wider transition-all skeuo-button active:scale-95"
            title="MIDI Controller Settings & Mappings"
          >
            <Radio size={12} className={midiDevicesCount > 0 ? 'text-green-400' : 'text-gray-500'} />
            <span className="hidden sm:inline">MIDI</span>
            <span className="text-[8px] text-gray-400">
              ({midiDevicesCount > 0 ? `${midiDevicesCount} DEV` : 'SIM'})
            </span>
          </button>

          {/* External VST Host Button */}
          <button
            onClick={() => {
              setVstModalChannelId(1);
              setVstModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-emerald-400 border border-[#333] rounded text-[10px] font-bold tracking-wider transition-all skeuo-button active:scale-95"
            title="External VST3 Plugin Host Bridge & Parameters"
          >
            <Layers size={12} className={channels.some(c => c.vst?.enabled) ? 'text-emerald-400' : 'text-gray-500'} />
            <span className="hidden sm:inline">EXT VST</span>
            <span className="text-[8px] text-gray-400">
              ({channels.filter(c => c.vst?.enabled).length} ON)
            </span>
          </button>

          {/* Master Bypass Button (A/B Test Dry vs Wet Signals across all 8 channels) */}
          <button
            onClick={handleToggleMasterVstBypass}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-black tracking-wider transition-all skeuo-button active:scale-95 ${
              isMasterVstBypassed
                ? 'bg-amber-500/20 text-amber-300 border-amber-500 led-yellow shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse'
                : 'bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-amber-400 border border-[#333]'
            }`}
            title="Master Bypass: Sets all VST plugin configs to enabled: false across all 8 channels simultaneously for quick A/B testing of dry vs wet signals"
          >
            <PowerOff size={12} className={isMasterVstBypassed ? 'text-amber-300' : 'text-gray-400'} />
            <span className="hidden sm:inline">MASTER BYPASS</span>
            <span className="sm:hidden">BYPASS</span>
            <span className={`text-[8px] px-1 py-0.5 rounded font-mono font-bold uppercase ${
              isMasterVstBypassed ? 'bg-amber-400 text-black' : 'bg-black/60 text-emerald-400'
            }`}>
              {isMasterVstBypassed ? 'DRY' : 'WET'}
            </span>
          </button>

          {/* Automation Overview Recharts Modal Button */}
          <button
            onClick={() => setAutomationOverviewOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-cyan-400 border border-[#333] rounded text-[10px] font-bold tracking-wider transition-all skeuo-button active:scale-95"
            title="Automation Overview - Visual timeline of recorded fader movements for all channels in Recharts"
          >
            <TrendingUp size={12} className="text-cyan-400" />
            <span className="hidden sm:inline">AUTOMATION</span>
            <span className="text-[8px] text-cyan-300 font-mono">
              GRAPH
            </span>
          </button>

          {/* Preset Library Button */}
          <button
            onClick={() => openPresetsModalGeneral('console')}
            className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-950 to-cyan-900 hover:from-cyan-900 hover:to-cyan-800 text-cyan-200 border border-cyan-700/60 rounded text-[10px] font-black tracking-wider transition-all skeuo-button active:scale-95"
          >
            <Sliders size={12} className="text-cyan-400" />
            <span>PRESETS</span>
            <span className="ml-1 px-1 rounded-full bg-cyan-800/80 text-[8px] text-cyan-100">
              {consolePresets.length + channelPresets.length + masterPresets.length}
            </span>
          </button>

          {/* Quick Snapshot Button */}
          <button
            onClick={() => {
              const name = prompt("Enter a name for this console preset snapshot:", `Snapshot ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
              if (name && name.trim()) {
                const saved = presetService.saveConsolePreset(name.trim(), channels, masterSettings);
                refreshPresetLists();
                setActivePresetId(saved.id);
                presetService.setActivePresetId(saved.id);
                setNotification({ title: "Snapshot Saved", message: `Saved "${saved.name}" to localStorage presets.` });
              }
            }}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-white border border-[#333] rounded text-[10px] font-bold tracking-wider transition-all skeuo-button active:scale-95"
            title="Quick save current mixer state as a preset"
          >
            <Plus size={12} className="text-cyan-400" />
            <span>SAVE SCENE</span>
          </button>

          {/* Kernel Config Button */}
          <button
            onClick={() => setDriverModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-blue-400 border border-[#333] rounded text-[10px] font-bold tracking-wider transition-all skeuo-button active:scale-95"
            title="Kernel & Driver Settings"
          >
            <Cpu size={12} />
            <span className="hidden sm:inline">KERNEL</span>
          </button>

          {/* Self-Healing / Defense Badge */}
          <div
            onClick={() => {
              audioEngine.reboot(channels, masterSettings);
              setNotification({ title: "MANUAL REBOOT", message: "Kernel reboot triggered. Rebuilding audio threads..." });
            }}
            className="flex items-center gap-1.5 px-2 py-1 bg-[#050505] border border-green-900/50 rounded cursor-pointer hover:border-green-600 transition-colors"
            title="Click to manually execute Self-Healing Reboot"
          >
            <Shield size={11} className="text-green-400" />
            <span className="text-[8px] font-black text-green-400 tracking-widest hidden md:inline">
              SHIELD ARMED
            </span>
          </div>
        </div>
      </header>
      
      <div className="flex-grow flex overflow-hidden">
        {/* Channel Strips Area */}
        <div className="flex-grow overflow-x-auto">
          <div className="flex h-full min-w-max">
            {channels.map((ch) => (
              <MixerStrip 
                key={ch.id} 
                settings={ch} 
                onChange={handleChannelChange} 
                inputDevices={inputDevices}
                onOptimize={() => handleOptimization(ch.id)}
                channelPresets={channelPresets}
                onOpenPresets={openPresetsForChannel}
                onApplyPreset={(p) => handleLoadChannelPreset(p, ch.id)}
                isLearnMode={isMidiLearnMode}
                activeLearningTarget={activeLearningTarget}
                onStartLearn={handleStartLearn}
                midiMappings={midiMappings}
                onOpenVstModal={handleOpenVstModal}
                onToggleVst={handleToggleChannelVst}
              />
            ))}
          </div>
        </div>

        {/* Master Section */}
        <MasterSection 
          settings={masterSettings} 
          onChange={setMasterSettings} 
          outputDevices={outputDevices}
          onOptimize={handleMasterOptimization} 
          onOpenDriverSettings={() => setDriverModalOpen(true)}
          onLoadAudio={handleLoadAudio}
          masterPresets={masterPresets}
          onOpenPresets={openPresetsForMaster}
          onApplyPreset={handleLoadMasterPreset}
          isLearnMode={isMidiLearnMode}
          activeLearningTarget={activeLearningTarget}
          onStartLearn={handleStartLearn}
          midiMappings={midiMappings}
          onOpenMidiModal={() => setMidiModalOpen(true)}
          channels={channels}
          onOpenAutomationOverview={() => setAutomationOverviewOpen(true)}
        />
      </div>

      {/* Footer / VBAN / Driver Status */}
      <div onClick={() => setDriverModalOpen(true)} className="cursor-pointer hover:bg-white/5 transition-colors">
        <VbanPanel />
      </div>

      {/* Driver Configuration Modal */}
      <DriverModal 
        isOpen={isDriverModalOpen}
        onClose={() => setDriverModalOpen(false)}
        onSave={handleDriverRestart}
      />

      {/* Presets Manager Modal */}
      <PresetsModal
        isOpen={isPresetsModalOpen}
        onClose={() => {
          setPresetsModalOpen(false);
          refreshPresetLists();
        }}
        currentChannels={channels}
        currentMaster={masterSettings}
        activePresetId={activePresetId}
        onLoadConsolePreset={handleLoadConsolePreset}
        onLoadChannelPreset={handleLoadChannelPreset}
        onLoadMasterPreset={handleLoadMasterPreset}
        initialTab={presetsInitialTab}
        preselectedChannelId={preselectedChannelForPresets}
      />

      {/* MIDI Configuration & Virtual Tester Modal */}
      <MidiModal
        isOpen={isMidiModalOpen}
        onClose={() => setMidiModalOpen(false)}
        isLearnMode={isMidiLearnMode}
        activeLearningTarget={activeLearningTarget}
        onToggleLearnMode={handleToggleLearnMode}
        onStartLearn={handleStartLearn}
        onCancelLearn={handleCancelLearn}
      />

      {/* Simulated External VST Plugin Parameters Modal */}
      <VstPluginModal
        isOpen={isVstModalOpen}
        onClose={() => setVstModalOpen(false)}
        channels={channels}
        activeChannelId={vstModalChannelId}
        onSelectChannel={(chId) => setVstModalChannelId(chId)}
        onUpdateChannelVst={handleUpdateChannelVst}
      />

      {/* Automation Overview Modal (Recharts Multi-Channel Timeline) */}
      <AutomationOverviewModal
        isOpen={isAutomationOverviewOpen}
        onClose={() => setAutomationOverviewOpen(false)}
        channels={channels}
        masterSettings={masterSettings}
      />

      {/* Custom Notification Toast */}
      {notification && (
        <div className="fixed top-14 right-4 z-[100] w-80 bg-[#161616] border border-cyan-500/80 rounded-lg shadow-2xl p-4 animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">{notification.title}</h3>
            <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="text-[10px] text-gray-300 leading-relaxed whitespace-pre-wrap font-mono">
            {notification.message}
          </div>
          <button 
            onClick={() => setNotification(null)}
            className="mt-3 w-full py-1 bg-cyan-700 hover:bg-cyan-600 text-white text-[10px] font-bold rounded font-mono"
          >
            DISMISS
          </button>
        </div>
      )}
    </div>
  );
};

export default App;

