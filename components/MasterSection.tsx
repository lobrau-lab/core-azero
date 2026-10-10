
import React, { useEffect, useState, useRef } from 'react';
import { ICONS } from '../constants';
import { MasterSettings, MasterBusPreset, MidiMapping, MidiTarget } from '../types';
import { ChevronDown, Speaker, MicOff, Waves, Bookmark, Sliders, Radio } from 'lucide-react';
import { audioEngine } from '../services/audioEngine';

interface Props {
  settings: MasterSettings;
  onChange: (settings: MasterSettings) => void;
  onOptimize: () => void;
  onOpenDriverSettings: () => void;
  outputDevices: MediaDeviceInfo[];
  onLoadAudio: (file: File) => void;
  masterPresets?: MasterBusPreset[];
  onOpenPresets?: () => void;
  onApplyPreset?: (preset: MasterBusPreset) => void;
  isLearnMode?: boolean;
  activeLearningTarget?: MidiTarget | null;
  onStartLearn?: (target: MidiTarget) => void;
  midiMappings?: MidiMapping[];
  onOpenMidiModal?: () => void;
}

const MasterKnob = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label: string }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startVal = useRef(0);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const deltaY = startY.current - e.clientY;
            let newVal = startVal.current + deltaY * 0.01;
            newVal = Math.max(0, Math.min(1, newVal));
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
    }, [isDragging, onChange]);

    const rotation = (value * 270) - 135;

    return (
        <div className="flex flex-col items-center">
            <span className="text-[9px] opacity-60 mb-2 font-bold tracking-tighter">{label}</span>
            <div 
                className="w-12 h-12 rounded-full skeuo-knob flex items-center justify-center relative cursor-ns-resize group shadow-lg transition-transform duration-75"
                style={{ transform: `rotate(${rotation}deg)` }}
                onMouseDown={(e) => {
                    setIsDragging(true);
                    startY.current = e.clientY;
                    startVal.current = value;
                }}
            >
              <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1 h-3 bg-red-500 rounded-full shadow-[0_0_3px_rgba(239,68,68,0.5)]" />
            </div>
            <span className="text-[8px] mt-1 opacity-40 font-mono">{Math.round(value * 100)}%</span>
        </div>
    );
};

const MasterSection: React.FC<Props> = ({
  settings,
  onChange,
  onOptimize,
  onOpenDriverSettings,
  outputDevices,
  onLoadAudio,
  masterPresets = [],
  onOpenPresets,
  onApplyPreset,
  isLearnMode = false,
  activeLearningTarget = null,
  onStartLearn,
  midiMappings = [],
  onOpenMidiModal
}) => {
  const meterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMasterPresetsOpen, setIsMasterPresetsOpen] = useState(false);
  const presetsRef = useRef<HTMLDivElement>(null);

  // Targets and mappings for MIDI Learn
  const masterGainTarget: MidiTarget = { id: 'master_gain', type: 'master_gain', label: 'Master Fader Gain' };
  const smartMasteringTarget: MidiTarget = { id: 'master_smart_mastering', type: 'master_smart_mastering', label: 'Smart Mastering Toggle' };
  const aecTarget: MidiTarget = { id: 'master_aec', type: 'master_aec', label: 'Echo Cancellation Toggle' };

  const masterGainMapping = midiMappings.find(m => m.targetId === masterGainTarget.id);
  const smartMasteringMapping = midiMappings.find(m => m.targetId === smartMasteringTarget.id);
  const aecMapping = midiMappings.find(m => m.targetId === aecTarget.id);

  const isMasterGainLearning = activeLearningTarget?.id === masterGainTarget.id;
  const isSmartMasteringLearning = activeLearningTarget?.id === smartMasteringTarget.id;
  const isAecLearning = activeLearningTarget?.id === aecTarget.id;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presetsRef.current && !presetsRef.current.contains(e.target as Node)) {
        setIsMasterPresetsOpen(false);
      }
    };
    if (isMasterPresetsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMasterPresetsOpen]);

  useEffect(() => {
    const interval = setInterval(() => {
        const data = audioEngine.getMasterMeter();
        if (meterRef.current) {
            const height = Math.min(100, data.rms * 150);
            meterRef.current.style.height = `${height}%`;
            // LED Colors for Master (Hard Clipping warning)
            if (data.peak > 0.98) meterRef.current.style.background = 'linear-gradient(to top, #ef4444, #b91c1c)';
            else if (data.peak > 0.85) meterRef.current.style.background = 'linear-gradient(to top, #eab308, #f59e0b)';
            else meterRef.current.style.background = 'linear-gradient(to top, #22c55e, #16a34a)';
        }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-64 flex flex-col bg-[#1a1a1a] border-l border-[#000] skeuo-panel h-full shrink-0">
      <div className="p-4 border-b border-[#000] bg-[#0a0a0a] flex justify-between items-center skeuo-shadow">
        <h2 className="text-sm font-black tracking-widest text-white italic">MASTER BUS</h2>
        <div className="flex items-center gap-2 text-gray-500">
          {onOpenMidiModal && (
            <button
              onClick={onOpenMidiModal}
              className="hover:text-amber-400 text-amber-500/80 transition-colors p-1 rounded hover:bg-white/5"
              title="MIDI Controller Settings"
            >
              <Radio size={14} />
            </button>
          )}
          <button
            onClick={onOpenPresets}
            className="hover:text-cyan-400 text-cyan-500/80 transition-colors p-1 rounded hover:bg-white/5"
            title="Master Presets Library"
          >
            <Bookmark size={15} />
          </button>
          <button onClick={onOpenDriverSettings} className="hover:text-blue-500 transition-colors" title="Kernel Settings">
            {ICONS.Settings}
          </button>
          {ICONS.Activity}
        </div>
      </div>

      <div className="p-4 flex-grow flex flex-col space-y-6 overflow-y-auto relative">
        
        {/* Presets & AI Optimizer */}
        <div className="flex flex-col gap-2">
            {/* Quick Master Presets Dropdown */}
            <div className="relative" ref={presetsRef}>
                <button
                    onClick={() => setIsMasterPresetsOpen(!isMasterPresetsOpen)}
                    className="w-full py-2 bg-gradient-to-r from-cyan-950 to-cyan-900 hover:from-cyan-900 hover:to-cyan-800 text-cyan-200 border border-cyan-700/60 rounded-sm font-black text-[10px] tracking-widest transition-all flex items-center justify-between px-3 skeuo-button active:scale-95"
                >
                    <span className="flex items-center gap-1.5 truncate">
                        <Bookmark size={12} className="text-cyan-400" />
                        MASTER PRESETS
                    </span>
                    <ChevronDown size={12} className={`transition-transform ${isMasterPresetsOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMasterPresetsOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-[#121212] border border-cyan-800/80 rounded shadow-2xl z-50 p-1 text-[10px] font-mono animate-in fade-in duration-100">
                        <div className="px-2 py-1 border-b border-[#252525] text-cyan-400 font-bold flex justify-between items-center text-[9px] uppercase">
                            <span>MASTER PRESETS</span>
                            <span className="text-gray-500 text-[8px]">{masterPresets.length} PRESETS</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto my-1 space-y-0.5">
                            {masterPresets.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => {
                                        onApplyPreset?.(p);
                                        setIsMasterPresetsOpen(false);
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
                                    setIsMasterPresetsOpen(false);
                                    onOpenPresets?.();
                                }}
                                className="w-full text-center py-1 bg-cyan-950/60 hover:bg-cyan-900 text-cyan-300 rounded text-[9px] font-bold tracking-wider"
                            >
                                + OPEN PRESET MANAGER
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <input 
                type="file" 
                accept="audio/mp3, audio/wav, audio/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                        onLoadAudio(e.target.files[0]);
                    }
                }}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-gradient-to-r from-purple-800 to-purple-700 hover:from-purple-700 hover:to-purple-600 text-white rounded-sm font-black text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 skeuo-button active:scale-95"
            >
                {ICONS.Activity} LOAD & MASTER AUDIO
            </button>

            {/* Smart Mastering Toggle Button with MIDI Learn */}
            <button 
                onClick={() => {
                  if (isLearnMode) {
                    onStartLearn?.(smartMasteringTarget);
                  } else {
                    onChange({ ...settings, smartMastering: !settings.smartMastering });
                  }
                }}
                className={`w-full py-2 rounded-sm font-black text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 skeuo-button active:scale-95 relative ${
                  isSmartMasteringLearning
                    ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400 animate-pulse'
                    : isLearnMode
                    ? 'border-amber-700/80 bg-[#1e1e1e] text-amber-300 hover:border-amber-400'
                    : settings.smartMastering
                    ? 'bg-gradient-to-r from-green-800 to-green-700 hover:from-green-700 hover:to-green-600 text-white led-green border-green-500/50'
                    : 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-gray-400'
                }`}
                title={isLearnMode ? 'Click to map MIDI to SMART MASTERING' : undefined}
            >
                {ICONS.Zap}
                <span>{settings.smartMastering ? 'SMART MASTERING ON' : 'SMART MASTERING OFF'}</span>
                {isLearnMode && (
                  <span className="text-[8px] text-amber-300 bg-black/60 px-1 rounded ml-1 font-mono">
                    {isSmartMasteringLearning
                      ? 'WAITING...'
                      : smartMasteringMapping
                      ? `CC#${smartMasteringMapping.controlNumber}`
                      : '[+]'}
                  </span>
                )}
            </button>

            <button 
                onClick={onOptimize}
                className="w-full py-2 bg-gradient-to-r from-blue-800 to-blue-700 hover:from-blue-700 hover:to-blue-600 text-white rounded-sm font-black text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 skeuo-button active:scale-95"
            >
                {ICONS.Activity} AUTO-LEVEL MASTER
            </button>
        </div>

        {/* Output Destination Selection */}
        <div className="space-y-1">
            <label className="text-[9px] font-black text-gray-600 flex items-center gap-1 tracking-widest">
                <Speaker size={10} /> SELECT DESTINATION
            </label>
            <div className="relative group/output">
                <button className="flex items-center justify-between w-full text-[10px] bg-[#050505] p-2 rounded-sm border border-[#222] hover:border-blue-500/50 truncate text-gray-400 transition-colors">
                    <span className="truncate flex-1 text-left">
                        {outputDevices.find(d => d.deviceId === settings.outputDeviceId)?.label || "Default Output"}
                    </span>
                    <ChevronDown size={10} />
                </button>
                <div className="absolute top-full left-0 w-full bg-[#121212] border border-[#333] z-50 hidden group-hover/output:block max-h-48 overflow-y-auto shadow-2xl rounded-b">
                    {outputDevices.map(device => (
                        <div 
                            key={device.deviceId} 
                            onClick={() => onChange({ ...settings, outputDeviceId: device.deviceId })}
                            className={`p-2 text-[10px] hover:bg-blue-900/40 cursor-pointer truncate ${device.deviceId === settings.outputDeviceId ? 'text-blue-400 font-bold bg-white/5' : 'text-gray-400'}`}
                        >
                            {device.label || `Device ${device.deviceId.substring(0,8)}...`}
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* FX Sends / DSP */}
        <div className="grid grid-cols-2 gap-4 bg-[#0a0a0a] p-3 rounded-lg border border-[#222] skeuo-shadow">
          <MasterKnob 
            label="REVERB" 
            value={settings.reverb} 
            onChange={(v) => onChange({ ...settings, reverb: v })} 
          />
          <MasterKnob 
            label="DELAY" 
            value={settings.delay} 
            onChange={(v) => onChange({ ...settings, delay: v })} 
          />
        </div>

        {/* Noise & Echo Control */}
        <div className="space-y-4 bg-[#0a0a0a] p-3 rounded-lg border border-[#222] skeuo-shadow">
            <div className="flex items-center justify-between">
                <MasterKnob 
                    label="NOISE REMOVER" 
                    value={settings.noiseReduction} 
                    onChange={(v) => onChange({ ...settings, noiseReduction: v })} 
                />
                <div className="flex flex-col items-center gap-2">
                    <span className="text-[9px] font-black text-gray-600 tracking-tighter">ECHO CANCEL</span>
                    <button 
                        onClick={() => {
                          if (isLearnMode) {
                            onStartLearn?.(aecTarget);
                          } else {
                            onChange({ ...settings, aec: !settings.aec });
                          }
                        }}
                        className={`w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center transition-all relative ${
                          isAecLearning
                            ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400 animate-pulse'
                            : isLearnMode
                            ? 'border-amber-600 bg-[#1e1e1e] text-amber-300'
                            : settings.aec
                            ? 'bg-blue-900/30 border-blue-400 text-blue-400 led-blue'
                            : 'bg-[#1a1a1a] border-[#333] text-gray-700'
                        }`}
                        title={isLearnMode ? 'Click to map MIDI to ECHO CANCEL' : undefined}
                    >
                        <Waves size={16} />
                        {isLearnMode && (
                          <span className="text-[6px] font-mono text-amber-300">
                            {isAecLearning ? 'LEARN' : aecMapping ? `CC#${aecMapping.controlNumber}` : '[+]'}
                          </span>
                        )}
                    </button>
                </div>
            </div>
        </div>

        {/* Master Meter & Fader - Fixed Layout */}
        <div className="flex-grow flex justify-center gap-4 min-h-[250px] relative items-end pb-4">
          
          {/* Fader Track */}
          <div className={`w-12 bg-[#050505] h-full rounded-sm border relative flex justify-center skeuo-fader-track transition-all ${
            isMasterGainLearning
              ? 'border-amber-400 ring-2 ring-amber-400 animate-pulse'
              : isLearnMode
              ? 'border-amber-600/80 hover:border-amber-400 cursor-pointer'
              : 'border-[#1a1a1a]'
          }`}>
            <div className="absolute top-[5%] bottom-[5%] w-0.5 bg-[#111]" />
            {/* Visual Handle - Vertical orientation logic */}
            <div 
                className="absolute w-full h-10 skeuo-fader-handle z-10 pointer-events-none flex items-center justify-center rounded-sm"
                style={{ bottom: `${(settings.masterGain / 1.5) * 80}%`, transition: 'bottom 0.1s' }}
            >
                <div className="w-full h-px bg-black/40" />
            </div>
             {/* Actual Input - Rotated but hidden opacity for interaction */}
            <input 
                type="range"
                min="0"
                max="1.5"
                step="0.01"
                value={settings.masterGain}
                onChange={(e) => {
                  if (!isLearnMode) {
                    onChange({ ...settings, masterGain: parseFloat(e.target.value) });
                  }
                }}
                onClick={(e) => {
                  if (isLearnMode) {
                    e.stopPropagation();
                    onStartLearn?.(masterGainTarget);
                  }
                }}
                className={`absolute w-[250px] h-12 -rotate-90 top-[100px] opacity-0 z-20 ${
                  isLearnMode ? 'cursor-pointer pointer-events-none' : 'cursor-pointer'
                }`}
                style={{ transformOrigin: 'center' }}
            />

            {/* MIDI Learn Mode Overlay on Master Fader */}
            {isLearnMode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartLearn?.(masterGainTarget);
                }}
                className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-1 text-[8px] font-mono font-bold transition-all ${
                  isMasterGainLearning
                    ? 'bg-amber-950/90 text-amber-200'
                    : 'bg-black/80 hover:bg-black/90 text-amber-400 hover:text-white'
                }`}
              >
                <span className="text-[7px]">
                  {isMasterGainLearning ? 'WAITING' : 'MASTER'}
                </span>
                <span className="text-[8px] text-amber-300 font-extrabold">
                  {isMasterGainLearning
                    ? 'MIDI...'
                    : masterGainMapping
                    ? `CC#${masterGainMapping.controlNumber}`
                    : '[+ LEARN]'}
                </span>
              </button>
            )}
          </div>

          {/* Meter */}
          <div className="h-full w-8 bg-[#050505] self-center rounded-sm border border-[#1a1a1a] relative overflow-hidden flex flex-col-reverse skeuo-meter-track">
             <div ref={meterRef} className="w-full bg-green-500 transition-all duration-75 ease-out opacity-90" style={{ height: '0%' }} />
             <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
               {[...Array(20)].map((_, i) => <div key={i} className="h-px bg-white/5 w-full" />)}
             </div>
          </div>
        </div>

        <div className="text-[8px] text-center opacity-30 uppercase pb-2 font-bold tracking-widest">
            Windows WDM Bridge Active
        </div>
      </div>
    </div>
  );
};

export default MasterSection;
