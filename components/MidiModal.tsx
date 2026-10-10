import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Radio,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  Activity,
  Zap,
  Volume2,
  Power,
  Cpu,
  ChevronDown
} from 'lucide-react';
import {
  MidiMapping,
  MidiTarget,
  MidiInputPortInfo,
  MidiLogEntry
} from '../types';
import {
  midiService,
  AVAILABLE_MIDI_TARGETS,
  HARDWARE_PROFILES
} from '../services/midiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  isLearnMode: boolean;
  activeLearningTarget: MidiTarget | null;
  onToggleLearnMode: () => void;
  onStartLearn: (target: MidiTarget) => void;
  onCancelLearn: () => void;
}

export const MidiModal: React.FC<Props> = ({
  isOpen,
  onClose,
  isLearnMode,
  activeLearningTarget,
  onToggleLearnMode,
  onStartLearn,
  onCancelLearn
}) => {
  const [activeTab, setActiveTab] = useState<'mappings' | 'profiles' | 'virtual' | 'monitor'>('mappings');
  const [mappings, setMappings] = useState<MidiMapping[]>([]);
  const [devices, setDevices] = useState<MidiInputPortInfo[]>([]);
  const [logs, setLogs] = useState<MidiLogEntry[]>([]);
  const [isSupported, setIsSupported] = useState(true);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);

  // Virtual controller state for testing
  const [virtualValues, setVirtualValues] = useState<{ [key: string]: number }>({
    cc1: 85,
    cc2: 85,
    cc3: 85,
    cc4: 85,
    cc5: 85,
    cc6: 85,
    cc7: 85,
    cc8: 85,
    cc9: 90
  });

  const refreshState = () => {
    setMappings(midiService.getMappings());
    setDevices(midiService.getConnectedDevices());
    setLogs(midiService.getRecentLogs());
  };

  useEffect(() => {
    if (!isOpen) return;

    midiService.initialize().then((res) => {
      setIsSupported(res.supported);
      if (!res.supported) {
        setSupportMessage(res.error || 'Web MIDI API not available in this environment.');
      } else {
        setSupportMessage(null);
      }
      refreshState();
    });

    const handleUpdate = () => refreshState();
    midiService.onMappingsUpdated = handleUpdate;
    midiService.onDeviceStateChange = handleUpdate;
    midiService.onRawMessageReceived = () => setLogs(midiService.getRecentLogs());

    return () => {
      midiService.onMappingsUpdated = null;
      midiService.onDeviceStateChange = null;
      midiService.onRawMessageReceived = null;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyProfile = (profileId: string) => {
    midiService.applyHardwareProfile(profileId);
    refreshState();
  };

  const handleDeleteMapping = (id: string) => {
    midiService.deleteMapping(id);
    refreshState();
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all MIDI controller mappings?')) {
      midiService.clearAllMappings();
      refreshState();
    }
  };

  // Virtual controller triggers
  const handleVirtualSliderChange = (ccNum: number, value: number) => {
    setVirtualValues((prev) => ({ ...prev, [`cc${ccNum}`]: value }));
    midiService.simulateMessage('cc', 1, ccNum, value);
  };

  const handleVirtualButtonPress = (noteNum: number) => {
    midiService.simulateMessage('note', 1, noteNum, 127);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-mono">
      <div className="bg-[#141414] border border-[#2b2b2b] w-full max-w-4xl max-h-[92vh] rounded-md shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden skeuo-panel animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-[#0a0a0a] px-5 py-3 border-b border-[#242424] flex justify-between items-center skeuo-shadow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#1c1c1c] border border-[#333] flex items-center justify-center text-amber-400 skeuo-shadow">
              <Radio size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black tracking-widest text-white uppercase">
                  WEB MIDI CONTROLLER INTERFACE
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950 text-amber-400 border border-amber-800/60 font-bold">
                  HARDWARE LEARN
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Map external USB/Bluetooth MIDI knobs, faders, and buttons to console controls
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global MIDI Learn Toggle Button */}
            <button
              onClick={onToggleLearnMode}
              className={`px-3 py-1.5 rounded text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all skeuo-button ${
                isLearnMode
                  ? 'bg-amber-600 text-black border-amber-300 led-yellow animate-pulse'
                  : 'bg-[#222] text-amber-400 hover:bg-amber-950/60 border-[#333]'
              }`}
            >
              <Zap size={13} />
              <span>{isLearnMode ? 'MIDI LEARN: ACTIVE' : 'ENABLE MIDI LEARN'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Device Status Bar */}
        <div className="bg-[#0e0e0e] px-5 py-2 border-b border-[#222] flex flex-wrap items-center justify-between text-[10px] text-gray-400 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold text-gray-300">
              <span
                className={`w-2 h-2 rounded-full ${
                  devices.length > 0 ? 'bg-green-500 led-green animate-pulse' : 'bg-amber-500'
                }`}
              />
              {devices.length > 0
                ? `${devices.length} MIDI DEVICE(S) CONNECTED`
                : 'NO PHYSICAL MIDI DETECTED'}
            </span>

            {devices.map((d) => (
              <span
                key={d.id}
                className="px-2 py-0.5 rounded bg-[#1a1a1a] text-cyan-300 border border-[#2b2b2b] text-[9px]"
              >
                {d.name}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[9px] text-gray-400">
            <span>MAPPINGS: <strong className="text-white">{mappings.length}</strong></span>
            <span>•</span>
            <span className="text-amber-400 font-bold">VIRTUAL SIMULATOR READY</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#111] px-5 pt-2 border-b border-[#222] flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('mappings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t text-[11px] font-bold tracking-wider transition-all border-t border-x ${
              activeTab === 'mappings'
                ? 'bg-[#181818] text-amber-400 border-[#333] border-b-[#181818]'
                : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <Sliders size={13} />
            <span>MAPPINGS LIST ({mappings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t text-[11px] font-bold tracking-wider transition-all border-t border-x ${
              activeTab === 'profiles'
                ? 'bg-[#181818] text-amber-400 border-[#333] border-b-[#181818]'
                : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <Layers size={13} />
            <span>HARDWARE TEMPLATES</span>
          </button>

          <button
            onClick={() => setActiveTab('virtual')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t text-[11px] font-bold tracking-wider transition-all border-t border-x ${
              activeTab === 'virtual'
                ? 'bg-[#181818] text-amber-400 border-[#333] border-b-[#181818]'
                : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <Cpu size={13} />
            <span>VIRTUAL MIDI TESTER</span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-4 py-2 rounded-t text-[11px] font-bold tracking-wider transition-all border-t border-x ${
              activeTab === 'monitor'
                ? 'bg-[#181818] text-amber-400 border-[#333] border-b-[#181818]'
                : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
            }`}
          >
            <Activity size={13} />
            <span>LIVE MIDI MONITOR</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#171717] space-y-4">
          
          {/* Active Learning Banner */}
          {activeLearningTarget && (
            <div className="bg-amber-950/80 border border-amber-500/80 rounded p-3 text-amber-200 text-xs flex items-center justify-between shadow-lg animate-pulse">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-amber-400 animate-spin" />
                <span>
                  <strong>WAITING FOR MIDI INPUT:</strong> Move any physical fader or press a button to map to{' '}
                  <span className="text-white font-bold underline">{activeLearningTarget.label}</span>...
                </span>
              </div>
              <button
                onClick={onCancelLearn}
                className="px-2.5 py-1 bg-[#1a1a1a] hover:bg-black text-amber-300 rounded border border-amber-600 text-[10px] font-bold"
              >
                CANCEL
              </button>
            </div>
          )}

          {/* TAB 1: MAPPINGS LIST */}
          {activeTab === 'mappings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-gray-400">
                  Click <strong>"LEARN"</strong> next to any target, then wiggle a physical fader or press a button on your controller.
                </div>
                {mappings.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1 hover:underline"
                  >
                    <Trash2 size={12} /> Clear All Mappings
                  </button>
                )}
              </div>

              {/* Targets Table */}
              <div className="bg-[#121212] rounded border border-[#2b2b2b] overflow-hidden">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0b0b0b] text-[9px] uppercase tracking-wider text-gray-400 border-b border-[#222]">
                    <tr>
                      <th className="py-2.5 px-3">Console Target</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">MIDI Message</th>
                      <th className="py-2.5 px-3">Channel</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                    {AVAILABLE_MIDI_TARGETS.map((target) => {
                      const mapping = mappings.find((m) => m.targetId === target.id);
                      const isTargetLearning = activeLearningTarget?.id === target.id;

                      return (
                        <tr
                          key={target.id}
                          className={`hover:bg-white/[0.02] transition-colors ${
                            isTargetLearning ? 'bg-amber-950/30' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-bold text-gray-200">
                            <span className="flex items-center gap-2">
                              {target.type.includes('gain') ? (
                                <Sliders size={13} className="text-cyan-400" />
                              ) : (
                                <Power size={13} className="text-amber-400" />
                              )}
                              {target.label}
                            </span>
                          </td>

                          <td className="py-2 px-3 text-[10px] text-gray-400">
                            {target.type.includes('gain') ? 'Continuous Fader' : 'Latching Button'}
                          </td>

                          <td className="py-2 px-3 text-[11px]">
                            {mapping ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e1e1e] border border-[#333] text-amber-300 font-bold">
                                {mapping.messageType.toUpperCase()} #{mapping.controlNumber}
                              </span>
                            ) : isTargetLearning ? (
                              <span className="text-amber-400 animate-pulse font-bold">
                                [Listening for input...]
                              </span>
                            ) : (
                              <span className="text-gray-600 italic">Unassigned</span>
                            )}
                          </td>

                          <td className="py-2 px-3 text-[10px] text-gray-400">
                            {mapping ? (mapping.midiChannel === 0 ? 'Omni (Any)' : `Ch ${mapping.midiChannel}`) : '—'}
                          </td>

                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isTargetLearning ? (
                                <button
                                  onClick={onCancelLearn}
                                  className="px-2 py-0.5 rounded text-[10px] bg-red-950 text-red-300 border border-red-800"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <button
                                  onClick={() => onStartLearn(target)}
                                  className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#1e1e1e] hover:bg-amber-900/60 text-amber-300 border border-[#333] hover:border-amber-600 transition-colors"
                                >
                                  {mapping ? 'RE-LEARN' : 'LEARN'}
                                </button>
                              )}

                              {mapping && (
                                <button
                                  onClick={() => handleDeleteMapping(mapping.id)}
                                  className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                                  title="Unmap this control"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: HARDWARE PROFILES */}
          {activeTab === 'profiles' && (
            <div className="space-y-4">
              <div className="text-[10px] text-gray-400">
                Instantly map your entire physical audio controller using factory templates.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {HARDWARE_PROFILES.map((prof) => (
                  <div
                    key={prof.id}
                    className="p-4 rounded-md border border-[#2b2b2b] bg-[#121212] skeuo-panel flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="text-xs font-black text-white uppercase">{prof.name}</h3>
                      <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                        {prof.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#222] flex justify-end">
                      <button
                        onClick={() => handleApplyProfile(prof.id)}
                        className="px-4 py-1.5 bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-700 rounded text-xs font-bold tracking-wider skeuo-button active:scale-95"
                      >
                        APPLY CONTROLLER TEMPLATE
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: VIRTUAL MIDI TESTER */}
          {activeTab === 'virtual' && (
            <div className="space-y-4">
              <div className="bg-[#121212] p-4 rounded border border-[#2b2b2b] skeuo-panel">
                <div className="flex items-center justify-between mb-3 border-b border-[#222] pb-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-2">
                    <Cpu size={16} />
                    INTERACTIVE VIRTUAL CONTROLLER SLIDERS (CC 1 - CC 9)
                  </span>
                  <span className="text-[9px] text-gray-500">
                    Sends real MIDI messages through Web MIDI pipeline
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-9 gap-3">
                  {Array.from({ length: 8 }, (_, i) => {
                    const ccNum = i + 1;
                    const val = virtualValues[`cc${ccNum}`] ?? 85;
                    return (
                      <div
                        key={ccNum}
                        className="flex flex-col items-center bg-[#090909] p-2.5 rounded border border-[#222] skeuo-shadow"
                      >
                        <span className="text-[9px] font-bold text-gray-400">CH {ccNum}</span>
                        <span className="text-[8px] text-amber-400">CC {ccNum}</span>

                        <input
                          type="range"
                          min="0"
                          max="127"
                          value={val}
                          onChange={(e) => handleVirtualSliderChange(ccNum, Number(e.target.value))}
                          className="h-28 w-2 my-2 appearance-none bg-[#1c1c1c] rounded-full outline-none accent-amber-500 cursor-pointer"
                          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                        />

                        <span className="text-[10px] font-bold text-gray-300">{val}</span>

                        <button
                          onClick={() => handleVirtualButtonPress(ccNum)}
                          className="mt-2 w-full py-1 text-[8px] font-bold bg-[#1e1e1e] hover:bg-amber-900/60 text-gray-300 hover:text-white rounded border border-[#333]"
                          title={`Send Note #${ccNum}`}
                        >
                          MUTE #{ccNum}
                        </button>
                      </div>
                    );
                  })}

                  {/* Master Virtual Fader (CC 9) */}
                  <div className="flex flex-col items-center bg-[#090909] p-2.5 rounded border border-cyan-900/60 skeuo-shadow">
                    <span className="text-[9px] font-bold text-cyan-400">MASTER</span>
                    <span className="text-[8px] text-cyan-500">CC 9</span>

                    <input
                      type="range"
                      min="0"
                      max="127"
                      value={virtualValues.cc9 ?? 90}
                      onChange={(e) => handleVirtualSliderChange(9, Number(e.target.value))}
                      className="h-28 w-2 my-2 appearance-none bg-[#1c1c1c] rounded-full outline-none accent-cyan-500 cursor-pointer"
                      style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                    />

                    <span className="text-[10px] font-bold text-cyan-300">{virtualValues.cc9 ?? 90}</span>

                    <button
                      onClick={() => handleVirtualButtonPress(99)}
                      className="mt-2 w-full py-1 text-[8px] font-bold bg-[#1e1e1e] hover:bg-cyan-900/60 text-gray-300 hover:text-white rounded border border-[#333]"
                      title="Send Note #99"
                    >
                      SMART
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE MONITOR */}
          {activeTab === 'monitor' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span>Real-time rolling feed of all incoming MIDI packets from connected devices.</span>
                <button
                  onClick={() => midiService.clearLogs()}
                  className="text-gray-500 hover:text-white flex items-center gap-1 hover:underline"
                >
                  <RotateCcw size={11} /> Clear Log
                </button>
              </div>

              <div className="bg-[#0b0b0b] rounded border border-[#262626] max-h-72 overflow-y-auto p-2 font-mono text-[10px]">
                {logs.length === 0 ? (
                  <div className="text-center py-10 text-gray-600">
                    No MIDI messages received yet. Move a physical fader or test using the Virtual Controller.
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="text-[8px] text-gray-500 uppercase border-b border-[#222]">
                      <tr>
                        <th className="py-1 px-2">Time</th>
                        <th className="py-1 px-2">Channel</th>
                        <th className="py-1 px-2">Type</th>
                        <th className="py-1 px-2">Number</th>
                        <th className="py-1 px-2">Value</th>
                        <th className="py-1 px-2">Mapped Target</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1a1a1a]">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.02]">
                          <td className="py-1 px-2 text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="py-1 px-2 text-gray-300">Ch {log.channel}</td>
                          <td className="py-1 px-2 text-amber-400 uppercase font-bold">{log.type}</td>
                          <td className="py-1 px-2 text-white">#{log.controlNumber}</td>
                          <td className="py-1 px-2 text-cyan-300 font-bold">{log.value}</td>
                          <td className="py-1 px-2 text-green-400">
                            {log.mappedTargetLabel || <span className="text-gray-600">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-[#0b0b0b] px-5 py-2.5 border-t border-[#222] flex items-center justify-between text-[10px] text-gray-500">
          <div className="flex items-center gap-3">
            <span>
              STATUS: <strong className="text-green-400">{isSupported ? 'ONLINE' : 'UNAVAILABLE'}</strong>
            </span>
            <span>•</span>
            <span>
              MAPPINGS PERSISTENCE:{' '}
              <strong className="text-cyan-400">SAVED TO LOCALSTORAGE</strong>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 rounded border border-[#333]"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
};

export default MidiModal;
