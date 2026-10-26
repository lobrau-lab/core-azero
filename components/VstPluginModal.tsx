import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Power,
  Sliders,
  ChevronDown,
  Sparkles,
  RotateCcw,
  Volume2,
  Activity,
  Layers,
  Cpu,
  Check,
  Zap,
  Info,
  Maximize2,
  Minimize2,
  Copy,
  Radio
} from 'lucide-react';
import { ChannelSettings, VstPluginConfig } from '../types';
import { VST_PLUGINS, VstPluginDefinition, getDefaultVstConfig } from '../services/vstPluginsData';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelSettings[];
  activeChannelId: number;
  onSelectChannel: (channelId: number) => void;
  onUpdateChannelVst: (channelId: number, vst: VstPluginConfig) => void;
}

// Interactive Rotatable / Draggable Knob for simulated VST interface
const VstKnob: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  color?: 'amber' | 'emerald' | 'cyan' | 'sky' | 'orange' | 'white';
  size?: 'sm' | 'md' | 'lg';
  formatValue?: (val: number) => string;
}> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  color = 'cyan',
  size = 'md',
  formatValue
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startVal = useRef(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      const range = max - min;
      let newVal = startVal.current + deltaY * (range / 150);
      newVal = Math.max(min, Math.min(max, newVal));
      if (step >= 1) newVal = Math.round(newVal);
      else {
        const factor = 1 / step;
        newVal = Math.round(newVal * factor) / factor;
      }
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
  }, [isDragging, min, max, step, onChange]);

  const percentage = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const rotation = percentage * 270 - 135;

  const colorClasses = {
    amber: {
      track: 'border-amber-950/70',
      indicator: 'bg-amber-400 shadow-[0_0_6px_#f59e0b]',
      text: 'text-amber-400',
      glow: 'shadow-[inset_0_0_8px_rgba(245,158,11,0.25)]'
    },
    emerald: {
      track: 'border-emerald-950/70',
      indicator: 'bg-emerald-400 shadow-[0_0_6px_#10b981]',
      text: 'text-emerald-400',
      glow: 'shadow-[inset_0_0_8px_rgba(16,185,129,0.25)]'
    },
    cyan: {
      track: 'border-cyan-950/70',
      indicator: 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]',
      text: 'text-cyan-400',
      glow: 'shadow-[inset_0_0_8px_rgba(6,182,212,0.25)]'
    },
    sky: {
      track: 'border-sky-950/70',
      indicator: 'bg-sky-400 shadow-[0_0_6px_#38bdf8]',
      text: 'text-sky-400',
      glow: 'shadow-[inset_0_0_8px_rgba(56,189,248,0.25)]'
    },
    orange: {
      track: 'border-orange-950/70',
      indicator: 'bg-orange-400 shadow-[0_0_6px_#f97316]',
      text: 'text-orange-400',
      glow: 'shadow-[inset_0_0_8px_rgba(249,115,22,0.25)]'
    },
    white: {
      track: 'border-neutral-800',
      indicator: 'bg-white shadow-[0_0_6px_#ffffff]',
      text: 'text-white',
      glow: 'shadow-[inset_0_0_8px_rgba(255,255,255,0.2)]'
    }
  }[color];

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-14 h-14'
  }[size];

  const displayVal = formatValue
    ? formatValue(value)
    : `${typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(1) : value}${unit}`;

  return (
    <div className="flex flex-col items-center select-none group">
      <div
        className={`${sizeClasses} rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#121212] border-2 ${colorClasses.track} ${colorClasses.glow} relative flex items-center justify-center cursor-ns-resize shadow-md transition-transform group-hover:scale-[1.03] active:scale-95`}
        onMouseDown={(e) => {
          setIsDragging(true);
          startY.current = e.clientY;
          startVal.current = value;
        }}
      >
        {/* Subtle notch ticks on the bezel */}
        <div
          className="w-full h-full rounded-full relative pointer-events-none"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Pointer line */}
          <div
            className={`absolute top-1 left-1/2 -translate-x-1/2 w-0.5 ${
              size === 'sm' ? 'h-2' : size === 'lg' ? 'h-3.5' : 'h-2.5'
            } ${colorClasses.indicator} rounded-full`}
          />
        </div>
        {/* Inner metal cap */}
        <div className="absolute inset-1.5 rounded-full bg-gradient-to-tr from-[#151515] to-[#2d2d2d] border border-white/5 pointer-events-none flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0a]" />
        </div>
      </div>
      <span className="text-[9px] font-semibold text-gray-400 mt-1 uppercase tracking-tight text-center leading-none">
        {label}
      </span>
      <span className={`text-[9px] font-mono font-bold ${colorClasses.text} mt-0.5 leading-none`}>
        {displayVal}
      </span>
    </div>
  );
};

const VstPluginModal: React.FC<Props> = ({
  isOpen,
  onClose,
  channels,
  activeChannelId,
  onSelectChannel,
  onUpdateChannelVst
}) => {
  const currentChannel = channels.find((c) => c.id === activeChannelId) || channels[0];
  const vstConfig: VstPluginConfig = currentChannel?.vst || getDefaultVstConfig(activeChannelId);

  const activePluginDef =
    VST_PLUGINS.find((p) => p.id === vstConfig.pluginId) || VST_PLUGINS[0];

  const [pluginSelectorOpen, setPluginSelectorOpen] = useState(false);
  const [presetSelectorOpen, setPresetSelectorOpen] = useState(false);
  const [simulatedDspLoad, setSimulatedDspLoad] = useState(1.4);
  const [simulatedVuLevel, setSimulatedVuLevel] = useState(45);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);

  // Oscillating / reactive simulation for VU meter
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      if (vstConfig.enabled) {
        setSimulatedDspLoad(+(1.2 + Math.random() * 0.9).toFixed(1));
        const base = vstConfig.pluginId === 'fet_76' ? 30 : 55;
        setSimulatedVuLevel(Math.floor(base + Math.random() * 25));
      } else {
        setSimulatedDspLoad(0.1);
        setSimulatedVuLevel(0);
      }
    }, 180);
    return () => clearInterval(interval);
  }, [isOpen, vstConfig.enabled, vstConfig.pluginId]);

  if (!isOpen) return null;

  const handleToggleVstPower = () => {
    const updated: VstPluginConfig = {
      ...vstConfig,
      enabled: !vstConfig.enabled
    };
    onUpdateChannelVst(activeChannelId, updated);
  };

  const handleSelectPlugin = (plugin: VstPluginDefinition) => {
    const updated: VstPluginConfig = {
      ...vstConfig,
      pluginId: plugin.id,
      pluginName: plugin.name,
      presetName: plugin.defaultPreset,
      dryWet: plugin.defaultDryWet,
      inputGain: plugin.defaultInputGain,
      outputGain: plugin.defaultOutputGain,
      parameters: { ...plugin.defaultParameters }
    };
    onUpdateChannelVst(activeChannelId, updated);
    setPluginSelectorOpen(false);
  };

  const handleSelectPreset = (presetName: string) => {
    const foundPreset = activePluginDef.presets.find((p) => p.name === presetName);
    if (!foundPreset) return;

    const updated: VstPluginConfig = {
      ...vstConfig,
      presetName: foundPreset.name,
      dryWet: foundPreset.dryWet,
      inputGain: foundPreset.inputGain,
      outputGain: foundPreset.outputGain,
      parameters: { ...foundPreset.parameters }
    };
    onUpdateChannelVst(activeChannelId, updated);
    setPresetSelectorOpen(false);
  };

  const handleUpdateParameter = (paramKey: string, val: number | string | boolean) => {
    const updated: VstPluginConfig = {
      ...vstConfig,
      parameters: {
        ...vstConfig.parameters,
        [paramKey]: val
      }
    };
    onUpdateChannelVst(activeChannelId, updated);
  };

  const handleCopySettingsToAllChannels = () => {
    channels.forEach((ch) => {
      onUpdateChannelVst(ch.id, {
        ...vstConfig,
        enabled: true
      });
    });
    setCopiedNotification('Plugin settings copied to all 8 channels!');
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  const handleResetToDefault = () => {
    const fresh = getDefaultVstConfig(activeChannelId);
    onUpdateChannelVst(activeChannelId, fresh);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl bg-[#111113] border-2 border-[#2b2b30] rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-gray-200 font-sans"
        style={{ maxHeight: '94vh' }}
      >
        {/* Top Window Bar - Host Header */}
        <div className="bg-[#18181c] border-b border-[#2a2a30] px-4 py-2 flex items-center justify-between select-none">
          <div className="flex items-center gap-2.5">
            {/* Host Title */}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]" />
              <span className="text-xs font-black tracking-wider text-gray-300 font-mono">
                CORE AZERO // EXTERNAL VST3 HOST
              </span>
            </div>

            <span className="text-[10px] bg-neutral-900 border border-neutral-700/60 px-2 py-0.5 rounded text-gray-400 font-mono">
              64-BIT VST3 BRIDGE
            </span>
          </div>

          {/* Channel Selector Quick Switcher */}
          <div className="flex items-center gap-1 bg-[#0c0c0e] p-1 rounded-lg border border-neutral-800">
            <span className="text-[9px] font-bold text-gray-500 px-1 font-mono uppercase">CHANNEL:</span>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => onSelectChannel(ch.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  ch.id === activeChannelId
                    ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/40'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-neutral-800/80'
                }`}
              >
                CH.{ch.id}
                {ch.vst?.enabled && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#4ade80]" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-1 hover:bg-neutral-800 rounded transition-colors"
              title="Close Plugin Window"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Plugin Host Control Strip */}
        <div className="bg-[#141418] border-b border-[#25252c] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            {/* POWER / BYPASS TOGGLE */}
            <button
              onClick={handleToggleVstPower}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold text-[11px] font-mono tracking-wider transition-all border ${
                vstConfig.enabled
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                  : 'bg-neutral-900 text-gray-500 border-neutral-700/80 hover:border-neutral-500 hover:text-gray-300'
              }`}
            >
              <Power size={13} className={vstConfig.enabled ? 'text-emerald-400 animate-pulse' : ''} />
              <span>{vstConfig.enabled ? 'ACTIVE' : 'BYPASSED'}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  vstConfig.enabled
                    ? 'bg-emerald-400 shadow-[0_0_6px_#10b981]'
                    : 'bg-neutral-600'
                }`}
              />
            </button>

            {/* Plugin Dropdown Selector */}
            <div className="relative">
              <button
                onClick={() => setPluginSelectorOpen(!pluginSelectorOpen)}
                className="flex items-center gap-2 bg-[#0d0d10] border border-neutral-700 hover:border-cyan-500/70 px-3 py-1.5 rounded-md text-gray-200 transition-colors font-mono"
              >
                <Layers size={13} className="text-cyan-400" />
                <span className="font-bold text-xs truncate max-w-[180px]">
                  {activePluginDef.name}
                </span>
                <ChevronDown size={12} className="text-gray-400 ml-1" />
              </button>

              {pluginSelectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#121216] border border-neutral-700 rounded-lg shadow-2xl z-50 p-1.5 font-mono">
                  <div className="px-2 py-1 text-[9px] font-bold text-gray-500 uppercase border-b border-neutral-800">
                    AVAILABLE VST3 PLUGINS
                  </div>
                  <div className="my-1 space-y-1">
                    {VST_PLUGINS.map((plugin) => (
                      <button
                        key={plugin.id}
                        onClick={() => handleSelectPlugin(plugin)}
                        className={`w-full text-left px-2.5 py-2 rounded flex flex-col gap-0.5 hover:bg-neutral-800 transition-colors ${
                          plugin.id === vstConfig.pluginId ? 'bg-cyan-950/60 border border-cyan-800/60' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-gray-200">{plugin.name}</span>
                          <span className="text-[8px] uppercase tracking-wider text-cyan-400">
                            {plugin.category}
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-400 leading-tight">
                          {plugin.tagline}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preset Dropdown Selector */}
            <div className="relative">
              <button
                onClick={() => setPresetSelectorOpen(!presetSelectorOpen)}
                className="flex items-center gap-2 bg-[#0d0d10] border border-neutral-700 hover:border-amber-500/70 px-3 py-1.5 rounded-md text-gray-200 transition-colors font-mono text-[11px]"
              >
                <Sparkles size={12} className="text-amber-400" />
                <span className="text-gray-400">PRESET:</span>
                <span className="font-bold text-white truncate max-w-[150px]">
                  {vstConfig.presetName || 'Default'}
                </span>
                <ChevronDown size={12} className="text-gray-400 ml-1" />
              </button>

              {presetSelectorOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-[#121216] border border-neutral-700 rounded-lg shadow-2xl z-50 p-1.5 font-mono">
                  <div className="px-2 py-1 text-[9px] font-bold text-gray-500 uppercase border-b border-neutral-800">
                    {activePluginDef.name} PRESETS
                  </div>
                  <div className="my-1 space-y-0.5">
                    {activePluginDef.presets.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => handleSelectPreset(preset.name)}
                        className={`w-full text-left px-2 py-1.5 rounded hover:bg-neutral-800 text-xs transition-colors flex flex-col ${
                          preset.name === vstConfig.presetName
                            ? 'bg-amber-950/40 text-amber-300 font-bold'
                            : 'text-gray-300'
                        }`}
                      >
                        <span>{preset.name}</span>
                        <span className="text-[8px] text-gray-500 font-normal truncate">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Engine Real-time Diagnostics Telemetry */}
          <div className="flex items-center gap-4 text-[10px] font-mono text-gray-400">
            <div className="flex items-center gap-1.5">
              <Cpu size={12} className="text-cyan-400" />
              <span>DSP LOAD:</span>
              <span className="text-cyan-300 font-bold">{simulatedDspLoad}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity size={12} className="text-emerald-400" />
              <span>LATENCY:</span>
              <span className="text-emerald-300 font-bold">0.0ms (Zero)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>FORMAT:</span>
              <span className="text-purple-400 font-bold">48kHz / 64f</span>
            </div>
          </div>
        </div>

        {/* Plugin Body / Simulated DSP Canvas Area */}
        <div className="p-4 flex-1 overflow-y-auto bg-[#0d0d0f] flex flex-col justify-center">
          {/* Main Plugin Visual Rack Unit */}
          <div className="relative rounded-xl border border-[#2a2a30] overflow-hidden shadow-2xl bg-gradient-to-b from-[#19191d] to-[#111114]">
            {/* Plugin Header Plaque */}
            <div className="bg-[#141418] border-b border-[#222228] px-4 py-2.5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-sm tracking-wide text-white uppercase">
                    {activePluginDef.name}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-400 font-mono">
                    {activePluginDef.category}
                  </span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {activePluginDef.tagline}
                </div>
              </div>

              {/* Hardware Model badge */}
              <div className="text-right">
                <span className="text-[10px] font-mono font-bold text-gray-400 tracking-wider">
                  MODEL: AZ-DSP-X7
                </span>
                <div className="text-[8px] text-gray-600 font-mono">
                  S/N: #892-VR-AZERO
                </div>
              </div>
            </div>

            {/* Plugin Specific Interface */}
            <div className="p-6">
              {/* 1. AZERO WARMDRIVE VST3 */}
              {activePluginDef.id === 'warm_drive' && (
                <div className="flex flex-col gap-6">
                  {/* Vacuum Tube Display & VU Centerpiece */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#0a0a0c] p-4 rounded-lg border border-amber-950/60 shadow-inner items-center">
                    {/* Simulated Vacuum Tube Glow Graphic */}
                    <div className="flex flex-col items-center justify-center p-3 rounded bg-black/60 border border-neutral-800">
                      <span className="text-[9px] font-mono text-amber-500/80 mb-2 font-bold tracking-widest">
                        DUAL TRIODE 12AX7 CORE
                      </span>
                      <div className="relative w-16 h-24 rounded-t-full bg-gradient-to-b from-neutral-800 to-black border-2 border-neutral-700 flex items-center justify-center overflow-hidden shadow-lg">
                        {/* Glow animation based on drive */}
                        <div
                          className="w-8 h-16 rounded-full blur-md transition-all duration-300"
                          style={{
                            backgroundColor: '#f59e0b',
                            opacity: vstConfig.enabled
                              ? Math.max(0.3, Number(vstConfig.parameters.drive || 30) / 100)
                              : 0.05
                          }}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 opacity-70">
                          <div className="w-6 h-0.5 bg-amber-200" />
                          <div className="w-8 h-0.5 bg-amber-400" />
                          <div className="w-6 h-0.5 bg-amber-200" />
                        </div>
                      </div>
                      <span className="text-[8px] font-mono text-gray-500 mt-2">
                        TUBE TEMP: {vstConfig.enabled ? '86°C (OPTIMAL)' : 'STANDBY'}
                      </span>
                    </div>

                    {/* Simulated Analog Warmth VU Meter */}
                    <div className="col-span-2 flex flex-col items-center justify-center bg-[#050507] p-4 rounded border border-neutral-800">
                      <div className="w-full flex justify-between text-[9px] font-mono text-gray-400 mb-1">
                        <span>SATURATION TRANSFER</span>
                        <span className="text-amber-400 font-bold">
                          {vstConfig.enabled ? 'DYNAMIC TAPE SATURATION' : 'BYPASS'}
                        </span>
                      </div>
                      <div className="w-full h-8 bg-neutral-950 rounded border border-neutral-800 relative overflow-hidden flex items-center px-1">
                        <div
                          className="h-5 bg-gradient-to-r from-emerald-600 via-amber-500 to-red-500 rounded transition-all duration-100 ease-out"
                          style={{
                            width: `${vstConfig.enabled ? simulatedVuLevel : 0}%`,
                            boxShadow: '0 0 12px rgba(245, 158, 11, 0.4)'
                          }}
                        />
                      </div>
                      <div className="w-full flex justify-between text-[8px] font-mono text-gray-600 mt-1">
                        <span>-40 dB</span>
                        <span>-20 dB</span>
                        <span>-6 dB</span>
                        <span>0 dB</span>
                        <span className="text-red-500">+6 dB (DRIVE)</span>
                      </div>
                    </div>
                  </div>

                  {/* Rotary Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 justify-items-center">
                    <VstKnob
                      label="DRIVE"
                      value={Number(vstConfig.parameters.drive ?? 32)}
                      min={0}
                      max={100}
                      unit="%"
                      color="amber"
                      size="lg"
                      onChange={(v) => handleUpdateParameter('drive', v)}
                    />
                    <VstKnob
                      label="TUBE BIAS"
                      value={Number(vstConfig.parameters.tubeBias ?? 50)}
                      min={0}
                      max={100}
                      unit="%"
                      color="amber"
                      onChange={(v) => handleUpdateParameter('tubeBias', v)}
                    />
                    <VstKnob
                      label="WARMTH"
                      value={Number(vstConfig.parameters.warmth ?? 3)}
                      min={-12}
                      max={12}
                      step={0.5}
                      unit="dB"
                      color="amber"
                      onChange={(v) => handleUpdateParameter('warmth', v)}
                    />
                    <VstKnob
                      label="TAPE FLUTTER"
                      value={Number(vstConfig.parameters.tapeFlutter ?? 12)}
                      min={0}
                      max={100}
                      unit="%"
                      color="amber"
                      onChange={(v) => handleUpdateParameter('tapeFlutter', v)}
                    />
                    <VstKnob
                      label="HEADROOM"
                      value={Number(vstConfig.parameters.headroom ?? -6)}
                      min={-18}
                      max={0}
                      step={1}
                      unit="dB"
                      color="amber"
                      onChange={(v) => handleUpdateParameter('headroom', v)}
                    />
                  </div>
                </div>
              )}

              {/* 2. BLACKFACE FET-76 VST3 */}
              {activePluginDef.id === 'fet_76' && (
                <div className="flex flex-col gap-6">
                  {/* Big Vintage VU Needle Meter */}
                  <div className="bg-[#0b0c0d] p-4 rounded-lg border border-neutral-800 flex flex-col items-center shadow-inner">
                    <div className="w-full flex justify-between text-[9px] font-mono text-gray-400 mb-1">
                      <span>PEAK LIMITING REDUCTION</span>
                      <span className="text-emerald-400 font-bold">
                        {vstConfig.parameters.ratio} RATIO MODE
                      </span>
                    </div>

                    <div className="w-full max-w-lg h-20 bg-[#f7eed6] rounded-md border-4 border-[#222] relative overflow-hidden flex flex-col items-center justify-center shadow-md">
                      {/* Meter scale markings */}
                      <div className="absolute top-2 w-full px-6 flex justify-between text-[8px] font-mono font-bold text-neutral-800 pointer-events-none select-none">
                        <span>-20</span>
                        <span>-10</span>
                        <span>-7</span>
                        <span>-5</span>
                        <span>-3</span>
                        <span>-1</span>
                        <span className="text-red-700">0</span>
                        <span className="text-red-700">+3</span>
                      </div>
                      {/* Needle */}
                      <div
                        className="absolute bottom-0 w-1 h-16 bg-neutral-900 origin-bottom transition-all duration-75 ease-out shadow-sm"
                        style={{
                          transform: `rotate(${
                            vstConfig.enabled ? (simulatedVuLevel / 100) * 60 - 30 : -35
                          }deg)`
                        }}
                      />
                      <span className="absolute bottom-1 text-[8px] font-mono font-black text-neutral-700">
                        GAIN REDUCTION (dB)
                      </span>
                    </div>
                  </div>

                  {/* Hardware Ratio Push-Buttons */}
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-bold text-gray-500 font-mono mb-1.5 uppercase">
                      COMPRESSION RATIO
                    </span>
                    <div className="flex gap-2">
                      {['4:1', '8:1', '12:1', '20:1', 'ALL'].map((r) => (
                        <button
                          key={r}
                          onClick={() => handleUpdateParameter('ratio', r)}
                          className={`px-3 py-1.5 rounded font-mono text-xs font-black transition-all border ${
                            vstConfig.parameters.ratio === r
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-[0_0_10px_#10b981]'
                              : 'bg-neutral-800 text-gray-400 border-neutral-700 hover:text-white'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* FET-76 Knobs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 justify-items-center">
                    <VstKnob
                      label="INPUT GAIN"
                      value={Number(vstConfig.parameters.input ?? -18)}
                      min={-48}
                      max={12}
                      step={1}
                      unit="dB"
                      color="emerald"
                      size="lg"
                      onChange={(v) => handleUpdateParameter('input', v)}
                    />
                    <VstKnob
                      label="OUTPUT GAIN"
                      value={Number(vstConfig.parameters.output ?? -12)}
                      min={-48}
                      max={12}
                      step={1}
                      unit="dB"
                      color="emerald"
                      size="lg"
                      onChange={(v) => handleUpdateParameter('output', v)}
                    />
                    <VstKnob
                      label="ATTACK"
                      value={Number(vstConfig.parameters.attack ?? 250)}
                      min={20}
                      max={800}
                      step={10}
                      unit="µs"
                      color="emerald"
                      onChange={(v) => handleUpdateParameter('attack', v)}
                    />
                    <VstKnob
                      label="RELEASE"
                      value={Number(vstConfig.parameters.release ?? 300)}
                      min={50}
                      max={1100}
                      step={10}
                      unit="ms"
                      color="emerald"
                      onChange={(v) => handleUpdateParameter('release', v)}
                    />
                  </div>
                </div>
              )}

              {/* 3. AETHERSPACE REVERB VST3 */}
              {activePluginDef.id === 'aetherspace_reverb' && (
                <div className="flex flex-col gap-6">
                  {/* Algorithmic Space Curve Canvas Display */}
                  <div className="bg-[#050608] p-4 rounded-lg border border-cyan-950/70 shadow-inner">
                    <div className="w-full flex justify-between text-[9px] font-mono text-cyan-400 mb-2">
                      <span>SPATIAL IMPULSE DECAY VISUALIZER</span>
                      <span className="font-bold">
                        {String(vstConfig.parameters.algo ?? 'Lush Plate')}
                      </span>
                    </div>

                    <div className="w-full h-24 bg-neutral-950 rounded border border-neutral-800 relative overflow-hidden flex items-end px-2 py-1">
                      {/* Simulated decaying reverb particle lines */}
                      {Array.from({ length: 32 }).map((_, i) => {
                        const decaySec = Number(vstConfig.parameters.decay || 2.2);
                        const progress = i / 32;
                        const heightPct = Math.max(
                          4,
                          Math.exp(-progress * (4 / decaySec)) * 90 +
                            (vstConfig.enabled ? Math.sin(i + simulatedVuLevel * 0.1) * 6 : 0)
                        );
                        return (
                          <div
                            key={i}
                            className="flex-1 mx-0.5 bg-cyan-400 rounded-t transition-all duration-100"
                            style={{
                              height: `${heightPct}%`,
                              opacity: Math.max(0.2, 1 - progress * 0.8),
                              backgroundColor: i < 8 ? '#38bdf8' : '#06b6d4'
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Knobs */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 justify-items-center">
                    <VstKnob
                      label="DECAY"
                      value={Number(vstConfig.parameters.decay ?? 2.2)}
                      min={0.2}
                      max={15}
                      step={0.1}
                      unit="s"
                      color="cyan"
                      size="lg"
                      onChange={(v) => handleUpdateParameter('decay', v)}
                    />
                    <VstKnob
                      label="PRE-DELAY"
                      value={Number(vstConfig.parameters.predelay ?? 28)}
                      min={0}
                      max={250}
                      step={2}
                      unit="ms"
                      color="cyan"
                      onChange={(v) => handleUpdateParameter('predelay', v)}
                    />
                    <VstKnob
                      label="DAMPING"
                      value={Number(vstConfig.parameters.damping ?? 6800)}
                      min={1000}
                      max={18000}
                      step={100}
                      unit="Hz"
                      color="cyan"
                      onChange={(v) => handleUpdateParameter('damping', v)}
                    />
                    <VstKnob
                      label="DIFFUSION"
                      value={Number(vstConfig.parameters.diffusion ?? 88)}
                      min={0}
                      max={100}
                      unit="%"
                      color="cyan"
                      onChange={(v) => handleUpdateParameter('diffusion', v)}
                    />
                    <VstKnob
                      label="WIDTH"
                      value={Number(vstConfig.parameters.width ?? 125)}
                      min={0}
                      max={200}
                      unit="%"
                      color="cyan"
                      onChange={(v) => handleUpdateParameter('width', v)}
                    />
                    <VstKnob
                      label="MODULATION"
                      value={Number(vstConfig.parameters.modulation ?? 45)}
                      min={0}
                      max={100}
                      unit="%"
                      color="cyan"
                      onChange={(v) => handleUpdateParameter('modulation', v)}
                    />
                  </div>
                </div>
              )}

              {/* 4. PRECISION PHASE-EQ VST3 */}
              {activePluginDef.id === 'precision_eq' && (
                <div className="flex flex-col gap-6">
                  {/* EQ Frequency Curve Screen */}
                  <div className="bg-[#07090c] p-4 rounded-lg border border-sky-950/70 shadow-inner">
                    <div className="w-full flex justify-between text-[9px] font-mono text-sky-400 mb-2">
                      <span>SURGICAL MINIMUM-PHASE CURVE</span>
                      <span>20 Hz — 20 kHz</span>
                    </div>

                    <div className="w-full h-28 bg-[#040608] rounded border border-neutral-800 relative overflow-hidden flex items-center px-4">
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex justify-between px-6 pointer-events-none opacity-20">
                        {['50Hz', '200Hz', '1kHz', '5kHz', '15kHz'].map((hz) => (
                          <div key={hz} className="h-full border-r border-sky-400 flex flex-col justify-end pb-1">
                            <span className="text-[7px] font-mono text-sky-400">{hz}</span>
                          </div>
                        ))}
                      </div>

                      {/* SVG Simulated EQ Curve */}
                      <svg className="w-full h-full" viewBox="0 0 500 100" preserveAspectRatio="none">
                        <path
                          d={`M 0,50 
                             Q 60,${50 - Number(vstConfig.parameters.lowGain || 0) * 2} 150,50 
                             Q 250,${50 - Number(vstConfig.parameters.midGain || 0) * 2.5} 350,50 
                             Q 420,${50 - Number(vstConfig.parameters.highGain || 0) * 2} 500,${
                            50 - Number(vstConfig.parameters.airBoost || 0) * 2.5
                          }`}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* Knobs */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 justify-items-center">
                    <VstKnob
                      label="HP FILTER"
                      value={Number(vstConfig.parameters.hpFreq ?? 85)}
                      min={20}
                      max={400}
                      step={5}
                      unit="Hz"
                      color="sky"
                      onChange={(v) => handleUpdateParameter('hpFreq', v)}
                    />
                    <VstKnob
                      label="LOW GAIN"
                      value={Number(vstConfig.parameters.lowGain ?? 1.5)}
                      min={-18}
                      max={18}
                      step={0.5}
                      unit="dB"
                      color="sky"
                      onChange={(v) => handleUpdateParameter('lowGain', v)}
                    />
                    <VstKnob
                      label="MID GAIN"
                      value={Number(vstConfig.parameters.midGain ?? -2.0)}
                      min={-18}
                      max={18}
                      step={0.5}
                      unit="dB"
                      color="sky"
                      size="lg"
                      onChange={(v) => handleUpdateParameter('midGain', v)}
                    />
                    <VstKnob
                      label="HIGH GAIN"
                      value={Number(vstConfig.parameters.highGain ?? 2.5)}
                      min={-18}
                      max={18}
                      step={0.5}
                      unit="dB"
                      color="sky"
                      onChange={(v) => handleUpdateParameter('highGain', v)}
                    />
                    <VstKnob
                      label="AIR BOOST"
                      value={Number(vstConfig.parameters.airBoost ?? 3.5)}
                      min={0}
                      max={12}
                      step={0.5}
                      unit="dB"
                      color="sky"
                      onChange={(v) => handleUpdateParameter('airBoost', v)}
                    />
                  </div>
                </div>
              )}

              {/* 5. OTT MULTIBAND PUMP VST3 */}
              {activePluginDef.id === 'ott_multiband' && (
                <div className="flex flex-col gap-6">
                  {/* Tri-band Dynamic Matrix Display */}
                  <div className="grid grid-cols-3 gap-3 bg-[#08080a] p-4 rounded-lg border border-orange-950/70 shadow-inner">
                    {['LOW BAND', 'MID BAND', 'HIGH BAND'].map((band, idx) => (
                      <div key={band} className="flex flex-col items-center bg-black/60 p-2.5 rounded border border-neutral-800">
                        <span className="text-[9px] font-mono font-bold text-orange-400 mb-2">
                          {band}
                        </span>
                        <div className="w-full h-20 bg-neutral-950 rounded flex gap-1 p-1">
                          {/* Upward compression bar */}
                          <div className="flex-1 bg-neutral-900 rounded-sm relative flex flex-col justify-end">
                            <div
                              className="w-full bg-cyan-500 rounded-sm transition-all duration-100"
                              style={{
                                height: `${vstConfig.enabled ? (simulatedVuLevel * (idx + 1) * 0.4) : 0}%`
                              }}
                            />
                            <span className="absolute bottom-1 left-0 right-0 text-center text-[7px] font-mono text-white">
                              UP
                            </span>
                          </div>
                          {/* Downward compression bar */}
                          <div className="flex-1 bg-neutral-900 rounded-sm relative flex flex-col justify-start">
                            <div
                              className="w-full bg-orange-500 rounded-sm transition-all duration-100"
                              style={{
                                height: `${vstConfig.enabled ? (simulatedVuLevel * 0.7) : 0}%`
                              }}
                            />
                            <span className="absolute top-1 left-0 right-0 text-center text-[7px] font-mono text-white">
                              DN
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Knobs */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 justify-items-center">
                    <VstKnob
                      label="DEPTH"
                      value={Number(vstConfig.parameters.depth ?? 65)}
                      min={0}
                      max={100}
                      unit="%"
                      color="orange"
                      size="lg"
                      onChange={(v) => handleUpdateParameter('depth', v)}
                    />
                    <VstKnob
                      label="TIME FACTOR"
                      value={Number(vstConfig.parameters.time ?? 1.0)}
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      unit="x"
                      color="orange"
                      onChange={(v) => handleUpdateParameter('time', v)}
                    />
                    <VstKnob
                      label="UPWARD %"
                      value={Number(vstConfig.parameters.upward ?? 70)}
                      min={0}
                      max={100}
                      unit="%"
                      color="orange"
                      onChange={(v) => handleUpdateParameter('upward', v)}
                    />
                    <VstKnob
                      label="DOWNWARD %"
                      value={Number(vstConfig.parameters.downward ?? 60)}
                      min={0}
                      max={100}
                      unit="%"
                      color="orange"
                      onChange={(v) => handleUpdateParameter('downward', v)}
                    />
                    <VstKnob
                      label="HIGH GAIN"
                      value={Number(vstConfig.parameters.highBandGain ?? 2.5)}
                      min={-12}
                      max={12}
                      step={0.5}
                      unit="dB"
                      color="orange"
                      onChange={(v) => handleUpdateParameter('highBandGain', v)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Master Host Bar for this Plugin */}
            <div className="bg-[#131317] border-t border-[#232328] px-6 py-3 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <VstKnob
                  label="INPUT TRIM"
                  value={vstConfig.inputGain}
                  min={-12}
                  max={12}
                  step={0.5}
                  unit="dB"
                  size="sm"
                  color="white"
                  onChange={(v) =>
                    onUpdateChannelVst(activeChannelId, { ...vstConfig, inputGain: v })
                  }
                />
                <VstKnob
                  label="OUTPUT TRIM"
                  value={vstConfig.outputGain}
                  min={-12}
                  max={12}
                  step={0.5}
                  unit="dB"
                  size="sm"
                  color="white"
                  onChange={(v) =>
                    onUpdateChannelVst(activeChannelId, { ...vstConfig, outputGain: v })
                  }
                />
                <VstKnob
                  label="DRY / WET MIX"
                  value={vstConfig.dryWet}
                  min={0}
                  max={100}
                  unit="%"
                  size="sm"
                  color="cyan"
                  onChange={(v) =>
                    onUpdateChannelVst(activeChannelId, { ...vstConfig, dryWet: v })
                  }
                />
              </div>

              {/* Utility actions */}
              <div className="flex items-center gap-2">
                {copiedNotification && (
                  <span className="text-[10px] text-green-400 font-mono animate-in fade-in">
                    {copiedNotification}
                  </span>
                )}
                <button
                  onClick={handleCopySettingsToAllChannels}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded text-[10px] font-mono flex items-center gap-1 transition-colors"
                  title="Copy this VST setup across all 8 channels"
                >
                  <Copy size={11} />
                  <span>COPY TO ALL CHANNELS</span>
                </button>

                <button
                  onClick={handleResetToDefault}
                  className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-gray-300 rounded text-[10px] font-mono flex items-center gap-1 transition-colors"
                  title="Reset to factory defaults"
                >
                  <RotateCcw size={11} />
                  <span>RESET</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-[11px] font-bold font-mono shadow-md transition-colors"
                >
                  DONE
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VstPluginModal;
