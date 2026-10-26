
import React, { useEffect, useRef, useState } from 'react';
import { ICONS } from '../constants';
import { ChannelSettings, AudioMeterData, ChannelStripPreset, MidiMapping, MidiTarget, VstPluginConfig } from '../types';
import { ChevronDown, Power, AlertCircle, Bookmark, Sliders, Radio, Sparkles } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';
import { getDefaultVstConfig } from '../services/vstPluginsData';

interface Props {
  settings: ChannelSettings;
  onChange: (settings: ChannelSettings) => void;
  inputDevices: MediaDeviceInfo[];
  onOptimize: () => void;
  channelPresets?: ChannelStripPreset[];
  onOpenPresets?: (channelId: number) => void;
  onApplyPreset?: (preset: ChannelStripPreset) => void;
  isLearnMode?: boolean;
  activeLearningTarget?: MidiTarget | null;
  onStartLearn?: (target: MidiTarget) => void;
  midiMappings?: MidiMapping[];
  onOpenVstModal?: (channelId: number) => void;
  onToggleVst?: (channelId: number) => void;
}

const Knob = ({ value, onChange, label, min, max, color = "blue", size = "w-10 h-10" }: any) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startVal = useRef(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const deltaY = startY.current - e.clientY;
            const range = max - min;
            let newVal = startVal.current + deltaY * (range / 200);
            newVal = Math.max(min, Math.min(max, newVal));
            onChange(newVal);
        };
        const handleMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, onChange, min, max]);

    const percentage = (value - min) / (max - min);
    const rotation = (percentage * 270) - 135;
    
    const indicatorColor = color === "green" ? "bg-green-400" : color === "red" ? "bg-red-400" : "bg-blue-400";

    return (
        <div className="flex flex-col items-center gap-1">
            <div 
                className={`${size} rounded-full skeuo-knob flex items-center justify-center relative cursor-ns-resize group transition-transform duration-75`}
                style={{ transform: `rotate(${rotation}deg)` }}
                onMouseDown={(e) => {
                    setIsDragging(true);
                    startY.current = e.clientY;
                    startVal.current = value;
                }}
            >
              {/* Physical Pointer */}
              <div className={`absolute top-1 left-1/2 -translate-x-1/2 w-0.5 h-2 ${indicatorColor} rounded-full shadow-[0_0_2px_rgba(255,255,255,0.5)]`} />
            </div>
            {label && <span className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">{label}</span>}
        </div>
    );
};

const MixerStrip: React.FC<Props> = ({
  settings,
  onChange,
  inputDevices,
  onOptimize,
  channelPresets = [],
  onOpenPresets,
  onApplyPreset,
  isLearnMode = false,
  activeLearningTarget = null,
  onStartLearn,
  midiMappings = [],
  onOpenVstModal,
  onToggleVst
}) => {
  const [meter, setMeter] = useState<AudioMeterData>({ rms: 0, peak: 0 });
  const [hasError, setHasError] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const meterRef = useRef<HTMLDivElement>(null);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  // VST Configuration
  const currentVst: VstPluginConfig = settings.vst || getDefaultVstConfig(settings.id);
  const isVstActive = Boolean(currentVst.enabled);
  const vstShortNames: Record<string, string> = {
    warm_drive: 'WARMDRV',
    fet_76: 'FET-76',
    aetherspace_reverb: 'SPACE-RV',
    precision_eq: 'PHASE-EQ',
    ott_multiband: 'OTT-PUMP'
  };
  const vstShortLabel = vstShortNames[currentVst.pluginId] || 'EXT VST';

  // Targets and mappings for MIDI Learn
  const gainTarget: MidiTarget = { id: `ch_${settings.id}_gain`, type: 'channel_gain', channelId: settings.id, label: `CH ${settings.id} Fader Gain` };
  const muteTarget: MidiTarget = { id: `ch_${settings.id}_mute`, type: 'channel_mute', channelId: settings.id, label: `CH ${settings.id} Mute Toggle` };
  const soloTarget: MidiTarget = { id: `ch_${settings.id}_solo`, type: 'channel_solo', channelId: settings.id, label: `CH ${settings.id} Solo Toggle` };
  const monitorTarget: MidiTarget = { id: `ch_${settings.id}_monitor`, type: 'channel_monitor', channelId: settings.id, label: `CH ${settings.id} Monitor Toggle` };

  const gainMapping = midiMappings.find(m => m.targetId === gainTarget.id);
  const muteMapping = midiMappings.find(m => m.targetId === muteTarget.id);
  const soloMapping = midiMappings.find(m => m.targetId === soloTarget.id);
  const monitorMapping = midiMappings.find(m => m.targetId === monitorTarget.id);

  const isGainLearning = activeLearningTarget?.id === gainTarget.id;
  const isMuteLearning = activeLearningTarget?.id === muteTarget.id;
  const isSoloLearning = activeLearningTarget?.id === soloTarget.id;
  const isMonitorLearning = activeLearningTarget?.id === monitorTarget.id;

  // Close preset dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setIsPresetMenuOpen(false);
      }
    };
    if (isPresetMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPresetMenuOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
        const data = audioEngine.getMeter(settings.id);
        setMeter(data);
        if (meterRef.current) {
            const height = Math.min(100, data.rms * 150); // Scale RMS for better visibility
            meterRef.current.style.height = `${height}%`;
            if (data.peak > 0.9) meterRef.current.style.backgroundColor = '#f87171';
            else if (data.peak > 0.7) meterRef.current.style.backgroundColor = '#eab308';
            else meterRef.current.style.backgroundColor = '#4ade80';
        }
    }, 50);
    return () => clearInterval(interval);
  }, [settings.id]);

  const handleDeviceSelect = async (deviceId: string) => {
    setHasError(false);
    try {
        await audioEngine.setInputDevice(settings.id, deviceId);
        onChange({ ...settings, deviceId });
    } catch (e: any) {
        setHasError(true);
        alert(e.message || "Failed to initialize audio device.");
    }
  };

  return (
    <div className="w-32 bg-[#1a1a1a] border-r border-[#000] flex flex-col items-center py-2 shrink-0 skeuo-panel relative">
      
      {/* Header & Optimize */}
      <div className="w-full px-2 mb-2 flex flex-col gap-1">
        <div className="flex justify-between items-center bg-[#0a0a0a] p-1 rounded border border-[#333] skeuo-shadow">
            <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-gray-500">CH.{settings.id}</span>
                {hasError && <AlertCircle size={10} className="text-red-500 animate-pulse" />}
            </div>

            <div className="flex items-center gap-1">
                {/* Channel Presets Quick Dropdown */}
                <div className="relative" ref={presetMenuRef}>
                    <button
                        onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
                        className={`p-0.5 rounded transition-colors ${isPresetMenuOpen ? 'text-cyan-300 bg-cyan-950/80' : 'text-cyan-500/70 hover:text-cyan-300'}`}
                        title="Channel Strip Presets"
                    >
                        <Bookmark size={11} />
                    </button>

                    {isPresetMenuOpen && (
                        <div className="absolute top-full left-0 mt-1 w-52 bg-[#121212] border border-cyan-800/60 rounded shadow-2xl z-50 p-1 text-[10px] font-mono animate-in fade-in duration-100">
                            <div className="px-2 py-1 border-b border-[#252525] text-cyan-400 font-bold flex justify-between items-center text-[9px] uppercase">
                                <span>CH.{settings.id} PRESETS</span>
                                <span className="text-gray-500 text-[8px]">{channelPresets.length} TOTAL</span>
                            </div>

                            <div className="max-h-48 overflow-y-auto my-1 space-y-0.5">
                                {channelPresets.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            onApplyPreset?.(p);
                                            setIsPresetMenuOpen(false);
                                        }}
                                        className="w-full text-left px-2 py-1.5 rounded hover:bg-cyan-900/40 text-gray-300 hover:text-white flex items-center justify-between transition-colors group"
                                    >
                                        <span className="truncate pr-1 font-medium">{p.name}</span>
                                        {p.isFactory ? (
                                            <span className="text-[7px] text-blue-400 font-bold uppercase shrink-0">
                                                FAC
                                            </span>
                                        ) : (
                                            <span className="text-[7px] text-green-400 font-bold uppercase shrink-0">
                                                USR
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-[#252525] pt-1">
                                <button
                                    onClick={() => {
                                        setIsPresetMenuOpen(false);
                                        onOpenPresets?.(settings.id);
                                    }}
                                    className="w-full text-center py-1 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 rounded text-[9px] font-bold tracking-wider"
                                >
                                    + SAVE / MANAGE PRESETS
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button onClick={onOptimize} className="text-yellow-600 hover:text-yellow-400 transition-colors" title="AI Optimize">
                    {ICONS.Zap}
                </button>
            </div>
        </div>
        
        {/* Input Selector */}
        <div className="relative group w-full">
            <button className={`flex items-center justify-between w-full text-[9px] bg-[#050505] p-1.5 rounded border ${hasError ? 'border-red-900 shadow-[inset_0_0_5px_rgba(255,0,0,0.5)]' : 'border-[#222]'} hover:border-blue-500/50 truncate text-gray-400 transition-colors`}>
                <span className="truncate w-16 text-left">
                    {inputDevices.find(d => d.deviceId === settings.deviceId)?.label || "Select Input"}
                </span>
                <ChevronDown size={8} />
            </button>
            <div className="absolute top-full left-0 w-48 bg-[#121212] border border-[#333] z-50 hidden group-hover:block max-h-48 overflow-y-auto shadow-2xl rounded-b">
                {inputDevices.map(device => (
                    <div 
                        key={device.deviceId} 
                        onClick={() => handleDeviceSelect(device.deviceId)}
                        className={`p-2 text-[10px] hover:bg-blue-900/40 cursor-pointer truncate ${device.deviceId === settings.deviceId ? 'text-blue-400 font-bold bg-white/5' : 'text-gray-400'}`}
                        title={device.label}
                    >
                        {device.label || `Device ${device.deviceId.substring(0,8)}...`}
                    </div>
                ))}
            </div>
        </div>
      </div>

      {/* External VST Insert Slot */}
      <div className="w-[90%] bg-[#0a0a0a] rounded border border-[#222] p-1 mb-2 flex flex-col gap-1 skeuo-shadow">
        <div className="flex justify-between items-center border-b border-[#222] pb-0.5 px-0.5">
          <span className="text-[7px] text-gray-500 font-black tracking-widest">EXT VST</span>
          <span
            className={`text-[6px] font-mono font-bold px-1 rounded transition-colors ${
              isVstActive
                ? 'text-emerald-400 bg-emerald-950/80 border border-emerald-500/30'
                : 'text-gray-600 bg-neutral-900 border border-neutral-800'
            }`}
          >
            {isVstActive ? 'ACTIVE' : 'BYPASS'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Toggle Power Button */}
          <button
            onClick={() => {
              if (onToggleVst) {
                onToggleVst(settings.id);
              } else {
                onChange({
                  ...settings,
                  vst: { ...currentVst, enabled: !currentVst.enabled }
                });
              }
            }}
            className={`flex items-center justify-center p-1 rounded transition-all text-[8px] font-bold ${
              isVstActive
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/50 led-green'
                : 'bg-[#181818] text-gray-600 border border-[#2e2e2e] hover:text-gray-400'
            }`}
            title={isVstActive ? 'Bypass External VST Effect' : 'Enable External VST Effect'}
          >
            <Power size={9} />
          </button>

          {/* Plugin Name / Trigger Modal Button */}
          <button
            onClick={() => onOpenVstModal?.(settings.id)}
            className={`flex-1 bg-[#121214] hover:bg-[#1a1a20] border rounded px-1.5 py-0.5 text-left flex items-center justify-between transition-colors group ${
              isVstActive
                ? 'border-emerald-800/60 shadow-[0_0_6px_rgba(16,185,129,0.15)]'
                : 'border-[#2a2a2e] hover:border-cyan-500/40'
            }`}
            title="Open External VST Plugin Parameters"
          >
            <span
              className={`text-[8px] font-mono font-bold truncate max-w-[50px] transition-colors ${
                isVstActive
                  ? 'text-emerald-300 group-hover:text-emerald-200'
                  : 'text-gray-400 group-hover:text-cyan-300'
              }`}
            >
              {vstShortLabel}
            </span>
            <Sliders
              size={8}
              className={`shrink-0 ml-0.5 transition-colors ${
                isVstActive
                  ? 'text-emerald-400 group-hover:text-emerald-300'
                  : 'text-gray-500 group-hover:text-cyan-400'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dynamics Section */}
      <div className="w-[90%] bg-[#0a0a0a] rounded border border-[#222] p-1 mb-2 flex flex-col gap-1 skeuo-shadow">
         <span className="text-[7px] text-center text-gray-600 font-black border-b border-[#222] pb-0.5 tracking-widest">DYNAMICS</span>
         <div className="flex justify-between px-1">
            <div className="flex flex-col items-center">
                 <button 
                    onClick={() => onChange({...settings, gate: {...settings.gate, active: !settings.gate.active}})}
                    className={`text-[8px] mb-1 px-1.5 rounded-sm font-bold transition-all ${settings.gate.active ? 'bg-green-900/40 text-green-400 border border-green-500/30 led-green' : 'bg-[#1a1a1a] text-gray-600 border border-[#333]'}`}
                 >GATE</button>
                 <Knob 
                    value={settings.gate.threshold} 
                    min={-80} max={0} 
                    onChange={(v: number) => onChange({...settings, gate: {...settings.gate, threshold: v}})}
                    size="w-6 h-6"
                    color="green"
                 />
            </div>
            <div className="flex flex-col items-center">
                 <button 
                    onClick={() => onChange({...settings, compressor: {...settings.compressor, active: !settings.compressor.active}})}
                    className={`text-[8px] mb-1 px-1.5 rounded-sm font-bold transition-all ${settings.compressor.active ? 'bg-yellow-900/40 text-yellow-400 border border-yellow-500/30 led-yellow' : 'bg-[#1a1a1a] text-gray-600 border border-[#333]'}`}
                 >COMP</button>
                 <Knob 
                    value={settings.compressor.ratio} 
                    min={1} max={20} 
                    onChange={(v: number) => onChange({...settings, compressor: {...settings.compressor, ratio: v}})}
                    size="w-6 h-6"
                    color="yellow"
                 />
            </div>
         </div>
      </div>

      {/* EQ Section */}
      <div className="flex flex-col gap-2 bg-[#1a1a1a] p-2 rounded-lg border border-[#2a2a2a] mb-2 skeuo-shadow">
        <Knob label="HIGH" value={settings.eq.high} min={-12} max={12} onChange={(v:number) => onChange({ ...settings, eq: { ...settings.eq, high: v }})} />
        <Knob label="MID" value={settings.eq.mid} min={-12} max={12} onChange={(v:number) => onChange({ ...settings, eq: { ...settings.eq, mid: v }})} />
        <Knob label="LOW" value={settings.eq.low} min={-12} max={12} onChange={(v:number) => onChange({ ...settings, eq: { ...settings.eq, low: v }})} />
      </div>

      {/* Pan */}
      <div className="mb-2">
         <Knob label="PAN" value={settings.pan} min={-1} max={1} onChange={(v:number) => onChange({ ...settings, pan: v })} color="red" size="w-8 h-8" />
      </div>

      {/* Mute/Solo/Monitor */}
      <div className="flex flex-col gap-1 w-full px-2 mb-2">
         <div className="flex gap-1 relative">
            <button 
                onClick={() => {
                  if (isLearnMode) {
                    onStartLearn?.(muteTarget);
                  } else {
                    onChange({ ...settings, mute: !settings.mute });
                  }
                }}
                className={`flex-1 py-1 text-[9px] font-black border rounded-sm transition-all relative ${
                  isMuteLearning
                    ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400 animate-pulse'
                    : isLearnMode
                    ? 'border-amber-700/80 bg-[#1e1e1e] text-amber-300 hover:border-amber-400'
                    : settings.mute
                    ? 'bg-red-700 border-red-400 text-white led-red'
                    : 'bg-[#222] border-[#333] text-gray-500'
                }`}
                title={isLearnMode ? 'Click to map MIDI to MUTE' : undefined}
            >
              MUTE
              {isLearnMode && (
                <span className="block text-[7px] text-amber-400 font-normal tracking-tight">
                  {isMuteLearning ? 'LEARN...' : muteMapping ? `CC#${muteMapping.controlNumber}` : '[+]'}
                </span>
              )}
            </button>

            <button 
                onClick={() => {
                  if (isLearnMode) {
                    onStartLearn?.(soloTarget);
                  } else {
                    onChange({ ...settings, solo: !settings.solo });
                  }
                }}
                className={`flex-1 py-1 text-[9px] font-black border rounded-sm transition-all relative ${
                  isSoloLearning
                    ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400 animate-pulse'
                    : isLearnMode
                    ? 'border-amber-700/80 bg-[#1e1e1e] text-amber-300 hover:border-amber-400'
                    : settings.solo
                    ? 'bg-yellow-600 border-yellow-300 text-black led-yellow'
                    : 'bg-[#222] border-[#333] text-gray-500'
                }`}
                title={isLearnMode ? 'Click to map MIDI to SOLO' : undefined}
            >
              SOLO
              {isLearnMode && (
                <span className="block text-[7px] text-amber-400 font-normal tracking-tight">
                  {isSoloLearning ? 'LEARN...' : soloMapping ? `CC#${soloMapping.controlNumber}` : '[+]'}
                </span>
              )}
            </button>
         </div>

         <button 
            onClick={() => {
              if (isLearnMode) {
                onStartLearn?.(monitorTarget);
              } else {
                onChange({ ...settings, monitor: !settings.monitor });
              }
            }}
            className={`w-full py-1 text-[9px] font-black border rounded-sm flex items-center justify-center gap-1 transition-all ${
              isMonitorLearning
                ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400 animate-pulse'
                : isLearnMode
                ? 'border-amber-700/80 bg-[#1e1e1e] text-amber-300 hover:border-amber-400'
                : settings.monitor
                ? 'bg-blue-700 border-blue-400 text-white led-blue'
                : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-600'
            }`}
            title={isLearnMode ? 'Click to map MIDI to MONITOR' : undefined}
         >
             <Power size={10} />
             <span>MONITOR</span>
             {isLearnMode && (
                <span className="text-[7px] text-amber-400 font-normal ml-1">
                  {isMonitorLearning ? 'LEARN' : monitorMapping ? `CC#${monitorMapping.controlNumber}` : '[+]'}
                </span>
             )}
         </button>
      </div>

      {/* Fader & Meter */}
      <div className="flex-grow flex justify-center gap-2 h-48 w-full px-2 relative">
        <div className="w-2 bg-[#050505] h-full rounded-sm border border-[#1a1a1a] overflow-hidden relative flex flex-col-reverse skeuo-meter-track">
            <div ref={meterRef} className="w-full bg-green-500 transition-all duration-75 ease-out opacity-80" style={{height: '0%'}} />
            <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                {[...Array(10)].map((_, i) => <div key={i} className="w-full h-px bg-white/5" />)}
            </div>
        </div>

        <div className={`w-8 bg-[#050505] h-full rounded-sm border relative skeuo-fader-track transition-all ${
          isGainLearning
            ? 'border-amber-400 ring-2 ring-amber-400 animate-pulse'
            : isLearnMode
            ? 'border-amber-600/80 hover:border-amber-400 cursor-pointer'
            : 'border-[#1a1a1a]'
        }`}>
            <div className="absolute top-[10%] bottom-[10%] left-1/2 -translate-x-1/2 w-0.5 bg-[#111]" />
            <input 
                type="range"
                min="0" max="1.2" step="0.01"
                value={settings.gain}
                onChange={(e) => {
                  if (!isLearnMode) {
                    onChange({ ...settings, gain: parseFloat(e.target.value) });
                  }
                }}
                onClick={(e) => {
                  if (isLearnMode) {
                    e.stopPropagation();
                    onStartLearn?.(gainTarget);
                  }
                }}
                className={`absolute -rotate-90 w-40 h-8 -left-16 top-20 opacity-0 z-20 ${
                  isLearnMode ? 'cursor-pointer pointer-events-none' : 'cursor-pointer'
                }`}
            />
            <div 
                className="absolute left-0 w-full h-8 skeuo-fader-handle z-10 pointer-events-none flex items-center justify-center rounded-sm"
                style={{ bottom: `${(settings.gain / 1.2) * 80}%`, transition: 'bottom 0.1s' }}
            >
                <div className="w-full h-px bg-black/40" />
            </div>

            {/* MIDI Learn Mode Overlay Button on Fader */}
            {isLearnMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartLearn?.(gainTarget);
                }}
                className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-0.5 text-[8px] font-mono font-bold transition-all ${
                  isGainLearning
                    ? 'bg-amber-950/90 text-amber-200'
                    : 'bg-black/80 hover:bg-black/90 text-amber-400 hover:text-white'
                }`}
              >
                <span className="text-[7px] leading-tight">
                  {isGainLearning ? 'WAITING' : 'FADER'}
                </span>
                <span className="text-[8px] text-amber-300 font-extrabold">
                  {isGainLearning
                    ? 'MIDI...'
                    : gainMapping
                    ? `CC#${gainMapping.controlNumber}`
                    : '[+ LEARN]'}
                </span>
              </button>
            )}
        </div>
      </div>

      <div className="mt-2 bg-[#0a0a0a] px-2 py-0.5 rounded border border-[#222] text-[9px] font-mono text-green-500/80 skeuo-shadow">
        {settings.gain === 0 ? '-inf' : `${(20 * Math.log10(settings.gain)).toFixed(1)}`} dB
      </div>

    </div>
  );
};

export default MixerStrip;
