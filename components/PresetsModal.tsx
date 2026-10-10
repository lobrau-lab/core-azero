import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Sliders,
  Mic,
  Speaker,
  Download,
  Upload,
  Trash2,
  Check,
  Plus,
  Bookmark,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import {
  ChannelSettings,
  MasterSettings,
  ConsolePreset,
  ChannelStripPreset,
  MasterBusPreset
} from '../types';
import { presetService } from '../services/presetService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentChannels: ChannelSettings[];
  currentMaster: MasterSettings;
  activePresetId: string | null;
  onLoadConsolePreset: (preset: ConsolePreset) => void;
  onLoadChannelPreset: (preset: ChannelStripPreset, targetChannelId: number | 'all') => void;
  onLoadMasterPreset: (preset: MasterBusPreset) => void;
  initialTab?: 'console' | 'channel' | 'master' | 'backup';
  preselectedChannelId?: number;
}

export const PresetsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentChannels,
  currentMaster,
  activePresetId,
  onLoadConsolePreset,
  onLoadChannelPreset,
  onLoadMasterPreset,
  initialTab = 'console',
  preselectedChannelId = 1
}) => {
  const [activeTab, setActiveTab] = useState<'console' | 'channel' | 'master' | 'backup'>(initialTab);
  
  // Data lists
  const [consolePresets, setConsolePresets] = useState<ConsolePreset[]>([]);
  const [channelPresets, setChannelPresets] = useState<ChannelStripPreset[]>([]);
  const [masterPresets, setMasterPresets] = useState<MasterBusPreset[]>([]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'factory' | 'custom'>('all');

  // New preset creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [sourceChannelId, setSourceChannelId] = useState<number>(preselectedChannelId);
  const [newChannelCategory, setNewChannelCategory] = useState<'vocal' | 'instrument' | 'stream' | 'cleanup' | 'game' | 'custom'>('vocal');
  const [targetChannelForLoad, setTargetChannelForLoad] = useState<number | 'all'>(preselectedChannelId);

  // Status message / toast inside modal
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshPresets = () => {
    setConsolePresets(presetService.getConsolePresets());
    setChannelPresets(presetService.getChannelPresets());
    setMasterPresets(presetService.getMasterPresets());
  };

  useEffect(() => {
    if (isOpen) {
      refreshPresets();
      setActiveTab(initialTab);
      setSourceChannelId(preselectedChannelId);
      setTargetChannelForLoad(preselectedChannelId);
      setIsCreating(false);
      setSearchQuery('');
    }
  }, [isOpen, initialTab, preselectedChannelId]);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Handlers for saving ---
  const handleSaveConsole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const created = presetService.saveConsolePreset(
      newPresetName,
      currentChannels,
      currentMaster,
      newPresetDesc
    );
    refreshPresets();
    setIsCreating(false);
    setNewPresetName('');
    setNewPresetDesc('');
    showToast(`Saved console snapshot: "${created.name}"`);
  };

  const handleSaveChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const ch = currentChannels.find((c) => c.id === sourceChannelId) || currentChannels[0];
    const created = presetService.saveChannelPreset(
      newPresetName,
      ch,
      newChannelCategory,
      newPresetDesc
    );
    refreshPresets();
    setIsCreating(false);
    setNewPresetName('');
    setNewPresetDesc('');
    showToast(`Saved channel preset: "${created.name}" from CH ${sourceChannelId}`);
  };

  const handleSaveMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) return;
    const created = presetService.saveMasterPreset(newPresetName, currentMaster, newPresetDesc);
    refreshPresets();
    setIsCreating(false);
    setNewPresetName('');
    setNewPresetDesc('');
    showToast(`Saved master bus preset: "${created.name}"`);
  };

  // --- Handlers for deleting ---
  const handleDeleteConsole = (id: string, name: string) => {
    if (window.confirm(`Delete preset "${name}"?`)) {
      presetService.deleteConsolePreset(id);
      refreshPresets();
      showToast(`Deleted preset "${name}"`);
    }
  };

  const handleDeleteChannel = (id: string, name: string) => {
    if (window.confirm(`Delete channel preset "${name}"?`)) {
      presetService.deleteChannelPreset(id);
      refreshPresets();
      showToast(`Deleted channel preset "${name}"`);
    }
  };

  const handleDeleteMaster = (id: string, name: string) => {
    if (window.confirm(`Delete master preset "${name}"?`)) {
      presetService.deleteMasterPreset(id);
      refreshPresets();
      showToast(`Deleted master preset "${name}"`);
    }
  };

  // --- Handlers for export / import ---
  const handleExport = () => {
    const jsonStr = presetService.exportAllPresetsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `core_azero_presets_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported presets JSON file successfully!');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const result = presetService.importPresetsFromJSON(content);
        refreshPresets();
        showToast(
          `Imported ${result.importedConsole} console, ${result.importedChannel} channel, ${result.importedMaster} master presets!`
        );
      } catch (err) {
        alert('Invalid preset JSON file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtering helpers
  const filterList = <T extends { name: string; description?: string; isFactory?: boolean }>(list: T[]): T[] => {
    return list.filter((item: T) => {
      const matchQuery =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchQuery) return false;
      if (filterType === 'factory') return !!item.isFactory;
      if (filterType === 'custom') return !item.isFactory;
      return true;
    });
  };

  const filteredConsole: ConsolePreset[] = filterList<ConsolePreset>(consolePresets);
  const filteredChannel: ChannelStripPreset[] = filterList<ChannelStripPreset>(channelPresets);
  const filteredMaster: MasterBusPreset[] = filterList<MasterBusPreset>(masterPresets);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#151515] border border-[#2e2e2e] w-full max-w-4xl max-h-[92vh] rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden skeuo-panel animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="bg-[#0b0b0b] px-5 py-3 border-b border-[#252525] flex justify-between items-center skeuo-shadow">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#1e1e1e] border border-[#333] flex items-center justify-center text-cyan-400 skeuo-shadow">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-black tracking-widest text-white uppercase font-mono">
                  PRESET LIBRARY & SNAPSHOT MANAGER
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-bold">
                  LOCALSTORAGE READY
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono">
                Instant recall for channel strips, mastering nodes & entire console scenes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-[#111111] px-4 pt-2 border-b border-[#222] flex justify-between items-center overflow-x-auto">
          <div className="flex gap-1">
            <button
              onClick={() => { setActiveTab('console'); setIsCreating(false); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t font-mono text-[11px] font-bold tracking-wider transition-all border-t border-x ${
                activeTab === 'console'
                  ? 'bg-[#1a1a1a] text-cyan-400 border-[#333] border-b-[#1a1a1a] shadow-[0_-2px_8px_rgba(6,182,212,0.15)]'
                  : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              <Layers size={14} />
              <span>FULL CONSOLE ({consolePresets.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab('channel'); setIsCreating(false); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t font-mono text-[11px] font-bold tracking-wider transition-all border-t border-x ${
                activeTab === 'channel'
                  ? 'bg-[#1a1a1a] text-cyan-400 border-[#333] border-b-[#1a1a1a] shadow-[0_-2px_8px_rgba(6,182,212,0.15)]'
                  : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              <Mic size={14} />
              <span>CHANNEL STRIPS ({channelPresets.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab('master'); setIsCreating(false); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t font-mono text-[11px] font-bold tracking-wider transition-all border-t border-x ${
                activeTab === 'master'
                  ? 'bg-[#1a1a1a] text-cyan-400 border-[#333] border-b-[#1a1a1a] shadow-[0_-2px_8px_rgba(6,182,212,0.15)]'
                  : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              <Speaker size={14} />
              <span>MASTER BUS ({masterPresets.length})</span>
            </button>

            <button
              onClick={() => { setActiveTab('backup'); setIsCreating(false); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-t font-mono text-[11px] font-bold tracking-wider transition-all border-t border-x ${
                activeTab === 'backup'
                  ? 'bg-[#1a1a1a] text-cyan-400 border-[#333] border-b-[#1a1a1a] shadow-[0_-2px_8px_rgba(6,182,212,0.15)]'
                  : 'bg-transparent text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              <Bookmark size={14} />
              <span>BACKUP / IMPORT</span>
            </button>
          </div>

          {activeTab !== 'backup' && (
            <button
              onClick={() => setIsCreating(!isCreating)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold font-mono tracking-wider flex items-center gap-1.5 transition-all skeuo-button ${
                isCreating
                  ? 'bg-red-950 text-red-300 border-red-800'
                  : 'bg-cyan-900/60 text-cyan-300 border-cyan-700 hover:bg-cyan-800/80'
              }`}
            >
              {isCreating ? <X size={12} /> : <Plus size={12} />}
              <span>{isCreating ? 'CANCEL' : 'SAVE NEW PRESET'}</span>
            </button>
          )}
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="bg-cyan-950/90 border-b border-cyan-800/80 px-4 py-2 text-cyan-200 text-xs font-mono flex items-center justify-between animate-in fade-in duration-200">
            <span className="flex items-center gap-2">
              <Check size={14} className="text-cyan-400" />
              {toastMessage}
            </span>
            <button onClick={() => setToastMessage(null)} className="text-cyan-400 hover:text-white">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 bg-[#171717] space-y-4">

          {/* Creation Panel */}
          {isCreating && (
            <div className="bg-[#1e1e1e] p-4 rounded border border-cyan-900/60 shadow-lg space-y-3 mb-4 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between border-b border-[#333] pb-2">
                <span className="text-[11px] font-bold font-mono text-cyan-400 flex items-center gap-2">
                  <Sparkles size={14} />
                  {activeTab === 'console' && 'STORE CURRENT CONSOLE STATE AS NEW PRESET'}
                  {activeTab === 'channel' && 'STORE CHANNEL STRIP AS NEW PRESET'}
                  {activeTab === 'master' && 'STORE MASTER BUS CONFIG AS NEW PRESET'}
                </span>
                <span className="text-[9px] text-gray-400 font-mono uppercase">
                  SAVED DIRECTLY TO LOCALSTORAGE
                </span>
              </div>

              {activeTab === 'console' && (
                <form onSubmit={handleSaveConsole} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Preset Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="e.g. My Twitch Gaming Scene"
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Description / Notes
                      </label>
                      <input
                        type="text"
                        value={newPresetDesc}
                        onChange={(e) => setNewPresetDesc(e.target.value)}
                        placeholder="e.g. Host mic on CH1, Discord on CH4, Smart Master ON"
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-1.5 text-xs font-mono text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-mono font-bold tracking-wider flex items-center gap-2"
                    >
                      <Bookmark size={14} />
                      SAVE CONSOLE SNAPSHOT
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'channel' && (
                <form onSubmit={handleSaveChannel} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Source Channel Strip
                      </label>
                      <select
                        value={sourceChannelId}
                        onChange={(e) => setSourceChannelId(Number(e.target.value))}
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-cyan-400 font-mono focus:border-cyan-500 outline-none"
                      >
                        {currentChannels.map((c) => (
                          <option key={c.id} value={c.id}>
                            CH {c.id} ({c.name})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Category Tag
                      </label>
                      <select
                        value={newChannelCategory}
                        onChange={(e) => setNewChannelCategory(e.target.value as any)}
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      >
                        <option value="vocal">Vocal / Mic</option>
                        <option value="instrument">Instrument / Acoustic</option>
                        <option value="stream">Stream / Discord Comms</option>
                        <option value="cleanup">Noise Cleanup / Gate</option>
                        <option value="game">Game Audio</option>
                        <option value="custom">General Custom</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Preset Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="e.g. Warm Vocal Warmup"
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                      Description / EQ & Dynamics Notes
                    </label>
                    <input
                      type="text"
                      value={newPresetDesc}
                      onChange={(e) => setNewPresetDesc(e.target.value)}
                      placeholder="e.g. +3dB High air, -45dB gate threshold for untreated rooms"
                      className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-1.5 text-xs font-mono text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-mono font-bold tracking-wider flex items-center gap-2"
                    >
                      <Bookmark size={14} />
                      SAVE CHANNEL PRESET
                    </button>
                  </div>
                </form>
              )}

              {activeTab === 'master' && (
                <form onSubmit={handleSaveMaster} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Master Preset Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="e.g. Studio Master Limiter"
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-gray-400 uppercase font-mono mb-1">
                        Description / Notes
                      </label>
                      <input
                        type="text"
                        value={newPresetDesc}
                        onChange={(e) => setNewPresetDesc(e.target.value)}
                        placeholder="e.g. Smart Mastering enabled, 5% reverb warmth"
                        className="w-full bg-[#0d0d0d] border border-[#333] rounded px-3 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-1.5 text-xs font-mono text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs font-mono font-bold tracking-wider flex items-center gap-2"
                    >
                      <Bookmark size={14} />
                      SAVE MASTER PRESET
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Search and Filters Bar (except for backup tab) */}
          {activeTab !== 'backup' && (
            <div className="flex flex-wrap gap-2 items-center justify-between bg-[#111] p-2.5 rounded border border-[#262626]">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter presets by name or keywords..."
                  className="w-full bg-[#0a0a0a] border border-[#2b2b2b] rounded px-3 py-1.5 text-xs text-gray-200 font-mono focus:border-cyan-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="text-gray-500 uppercase font-bold mr-1">TYPE:</span>
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterType === 'all'
                      ? 'bg-cyan-900/60 text-cyan-300 font-bold border border-cyan-700/60'
                      : 'text-gray-400 hover:text-gray-200 bg-[#1c1c1c]'
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setFilterType('factory')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterType === 'factory'
                      ? 'bg-blue-900/60 text-blue-300 font-bold border border-blue-700/60'
                      : 'text-gray-400 hover:text-gray-200 bg-[#1c1c1c]'
                  }`}
                >
                  FACTORY
                </button>
                <button
                  onClick={() => setFilterType('custom')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterType === 'custom'
                      ? 'bg-green-900/60 text-green-300 font-bold border border-green-700/60'
                      : 'text-gray-400 hover:text-gray-200 bg-[#1c1c1c]'
                  }`}
                >
                  MY PRESETS
                </button>
              </div>

              {/* If in Channel Tab: Channel Target Selector */}
              {activeTab === 'channel' && (
                <div className="w-full sm:w-auto flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-[#2e2e2e] pt-2 sm:pt-0 sm:pl-3">
                  <span className="text-[10px] font-mono text-gray-400 font-bold whitespace-nowrap">
                    LOAD TARGET:
                  </span>
                  <select
                    value={targetChannelForLoad}
                    onChange={(e) =>
                      setTargetChannelForLoad(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                    className="bg-[#0a0a0a] border border-[#333] text-cyan-400 text-xs font-mono rounded px-2 py-1 outline-none"
                  >
                    <option value="all">⚡ ALL 8 CHANNELS</option>
                    {currentChannels.map((c) => (
                      <option key={c.id} value={c.id}>
                        CH {c.id} ({c.name})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: FULL CONSOLE PRESETS */}
          {activeTab === 'console' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredConsole.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500 font-mono text-xs">
                  No console presets match your criteria.
                </div>
              ) : (
                filteredConsole.map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={`p-4 rounded-md border flex flex-col justify-between transition-all skeuo-panel relative overflow-hidden ${
                        isActive
                          ? 'border-cyan-500/80 bg-gradient-to-br from-[#1c2a30] to-[#121c20] shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'border-[#262626] bg-[#141414] hover:border-[#383838]'
                      }`}
                    >
                      {/* Active glowing indicator banner */}
                      {isActive && (
                        <div className="absolute top-0 right-0 bg-cyan-500 text-black text-[9px] font-mono font-black px-2.5 py-0.5 rounded-bl shadow-sm uppercase tracking-wider flex items-center gap-1">
                          <Check size={10} strokeWidth={3} /> ACTIVE CONSOLE
                        </div>
                      )}

                      <div>
                        <div className="flex items-start justify-between gap-2 pr-16">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-black font-mono tracking-wider text-white">
                                {preset.name}
                              </h3>
                              {preset.isFactory ? (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 uppercase">
                                  Factory
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-green-950 text-green-300 border border-green-800/60 uppercase">
                                  User Preset
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mt-1 leading-relaxed">
                              {preset.description || 'Full 8-channel + master snapshot'}
                            </p>
                          </div>
                        </div>

                        {/* Snapshot specs badge breakdown */}
                        <div className="mt-3 grid grid-cols-2 gap-1.5 text-[9px] font-mono text-gray-300 bg-[#0c0c0c] p-2 rounded border border-[#222]">
                          <div>
                            <span className="text-gray-500">CHANNELS:</span> 8 configured
                          </div>
                          <div>
                            <span className="text-gray-500">MASTER GAIN:</span>{' '}
                            {Math.round(preset.master.masterGain * 100)}%
                          </div>
                          <div>
                            <span className="text-gray-500">SMART MASTER:</span>{' '}
                            <span className={preset.master.smartMastering ? 'text-green-400 font-bold' : 'text-gray-500'}>
                              {preset.master.smartMastering ? 'ACTIVE' : 'OFF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">ECHO CANCEL:</span>{' '}
                            <span className={preset.master.aec ? 'text-blue-400 font-bold' : 'text-gray-500'}>
                              {preset.master.aec ? 'ACTIVE' : 'OFF'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-500">
                          {preset.createdAt
                            ? new Date(preset.createdAt).toLocaleDateString()
                            : 'Factory Standard'}
                        </span>

                        <div className="flex items-center gap-2">
                          {!preset.isFactory && (
                            <button
                              onClick={() => handleDeleteConsole(preset.id, preset.name)}
                              title="Delete this custom preset"
                              className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              onLoadConsolePreset(preset);
                              showToast(`Loaded console preset: "${preset.name}"`);
                            }}
                            className={`px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 transition-all skeuo-button ${
                              isActive
                                ? 'bg-cyan-800 text-cyan-200 border-cyan-500'
                                : 'bg-[#222] hover:bg-cyan-700 text-gray-200 hover:text-white border-[#333]'
                            }`}
                          >
                            <ArrowRight size={12} />
                            <span>{isActive ? 'RELOAD SCENE' : 'LOAD CONSOLE'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: CHANNEL STRIP PRESETS */}
          {activeTab === 'channel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredChannel.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500 font-mono text-xs">
                  No channel strip presets match your criteria.
                </div>
              ) : (
                filteredChannel.map((preset) => {
                  const s = preset.settings;
                  return (
                    <div
                      key={preset.id}
                      className="p-4 rounded-md border border-[#262626] bg-[#141414] hover:border-[#383838] flex flex-col justify-between transition-all skeuo-panel"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-black font-mono tracking-wider text-white">
                                {preset.name}
                              </h3>
                              {preset.isFactory ? (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 uppercase">
                                  Factory
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-green-950 text-green-300 border border-green-800/60 uppercase">
                                  User Strip
                                </span>
                              )}
                              {preset.category && (
                                <span className="text-[8px] font-mono text-cyan-400 uppercase">
                                  #{preset.category}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mt-1 leading-relaxed">
                              {preset.description || 'Channel EQ, dynamics and gain calibration'}
                            </p>
                          </div>
                        </div>

                        {/* Parameter details preview */}
                        <div className="mt-3 grid grid-cols-3 gap-1.5 text-[9px] font-mono text-gray-300 bg-[#0c0c0c] p-2 rounded border border-[#222]">
                          <div>
                            <span className="text-gray-500">EQ HI:</span>{' '}
                            <span className={s.eq.high > 0 ? 'text-cyan-400' : s.eq.high < 0 ? 'text-amber-400' : 'text-gray-400'}>
                              {s.eq.high > 0 ? `+${s.eq.high}` : s.eq.high}dB
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">EQ MID:</span>{' '}
                            <span className={s.eq.mid > 0 ? 'text-cyan-400' : s.eq.mid < 0 ? 'text-amber-400' : 'text-gray-400'}>
                              {s.eq.mid > 0 ? `+${s.eq.mid}` : s.eq.mid}dB
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">EQ LOW:</span>{' '}
                            <span className={s.eq.low > 0 ? 'text-cyan-400' : s.eq.low < 0 ? 'text-amber-400' : 'text-gray-400'}>
                              {s.eq.low > 0 ? `+${s.eq.low}` : s.eq.low}dB
                            </span>
                          </div>

                          <div>
                            <span className="text-gray-500">GATE:</span>{' '}
                            <span className={s.gate.active ? 'text-green-400 font-bold' : 'text-gray-500'}>
                              {s.gate.active ? `${s.gate.threshold}dB` : 'OFF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">COMP:</span>{' '}
                            <span className={s.compressor.active ? 'text-amber-400 font-bold' : 'text-gray-500'}>
                              {s.compressor.active ? `${s.compressor.ratio}:1` : 'OFF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">GAIN:</span>{' '}
                            <span className="text-gray-300">
                              {(20 * Math.log10(s.gain || 0.001)).toFixed(1)}dB
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-500">
                          {preset.createdAt
                            ? new Date(preset.createdAt).toLocaleDateString()
                            : 'Standard Voicing'}
                        </span>

                        <div className="flex items-center gap-2">
                          {!preset.isFactory && (
                            <button
                              onClick={() => handleDeleteChannel(preset.id, preset.name)}
                              title="Delete this custom preset"
                              className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              onLoadChannelPreset(preset, targetChannelForLoad);
                              showToast(
                                targetChannelForLoad === 'all'
                                  ? `Applied "${preset.name}" to ALL 8 channels!`
                                  : `Applied "${preset.name}" to Channel ${targetChannelForLoad}`
                              );
                            }}
                            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 bg-[#222] hover:bg-cyan-700 text-gray-200 hover:text-white border border-[#333] transition-all skeuo-button"
                          >
                            <ArrowRight size={12} />
                            <span>
                              APPLY TO {targetChannelForLoad === 'all' ? 'ALL' : `CH ${targetChannelForLoad}`}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: MASTER BUS PRESETS */}
          {activeTab === 'master' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMaster.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500 font-mono text-xs">
                  No master bus presets match your criteria.
                </div>
              ) : (
                filteredMaster.map((preset) => {
                  const m = preset.settings;
                  return (
                    <div
                      key={preset.id}
                      className="p-4 rounded-md border border-[#262626] bg-[#141414] hover:border-[#383838] flex flex-col justify-between transition-all skeuo-panel"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-xs font-black font-mono tracking-wider text-white">
                                {preset.name}
                              </h3>
                              {preset.isFactory ? (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/60 uppercase">
                                  Factory
                                </span>
                              ) : (
                                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-green-950 text-green-300 border border-green-800/60 uppercase">
                                  User Master
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 font-mono mt-1 leading-relaxed">
                              {preset.description || 'Mastering node, DSP conditioning and loudness limits'}
                            </p>
                          </div>
                        </div>

                        {/* Master parameter preview */}
                        <div className="mt-3 grid grid-cols-3 gap-1.5 text-[9px] font-mono text-gray-300 bg-[#0c0c0c] p-2 rounded border border-[#222]">
                          <div>
                            <span className="text-gray-500">SMART MASTER:</span>{' '}
                            <span className={m.smartMastering ? 'text-green-400 font-bold' : 'text-gray-500'}>
                              {m.smartMastering ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">ECHO CANCEL:</span>{' '}
                            <span className={m.aec ? 'text-blue-400 font-bold' : 'text-gray-500'}>
                              {m.aec ? 'ON' : 'OFF'}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">MASTER GAIN:</span>{' '}
                            <span className="text-cyan-400 font-bold">
                              {Math.round(m.masterGain * 100)}%
                            </span>
                          </div>

                          <div>
                            <span className="text-gray-500">REVERB:</span>{' '}
                            <span className="text-gray-300">{Math.round(m.reverb * 100)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-500">DELAY:</span>{' '}
                            <span className="text-gray-300">{Math.round(m.delay * 100)}%</span>
                          </div>
                          <div>
                            <span className="text-gray-500">NOISE CUTOFF:</span>{' '}
                            <span className="text-gray-300">{Math.round(m.noiseReduction * 100)}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-[#222] flex items-center justify-between">
                        <span className="text-[9px] font-mono text-gray-500">
                          {preset.createdAt
                            ? new Date(preset.createdAt).toLocaleDateString()
                            : 'Factory Standard'}
                        </span>

                        <div className="flex items-center gap-2">
                          {!preset.isFactory && (
                            <button
                              onClick={() => handleDeleteMaster(preset.id, preset.name)}
                              title="Delete this custom preset"
                              className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-950/40 border border-transparent hover:border-red-800/50 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}

                          <button
                            onClick={() => {
                              onLoadMasterPreset(preset);
                              showToast(`Loaded master preset: "${preset.name}"`);
                            }}
                            className="px-3 py-1.5 rounded text-[10px] font-mono font-bold tracking-wider flex items-center gap-1.5 bg-[#222] hover:bg-cyan-700 text-gray-200 hover:text-white border border-[#333] transition-all skeuo-button"
                          >
                            <ArrowRight size={12} />
                            <span>LOAD MASTER SETTINGS</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 4: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-[#121212] p-5 rounded-md border border-[#2b2b2b] skeuo-panel space-y-4">
                <div className="flex items-center gap-2 text-cyan-400">
                  <ShieldCheck size={18} />
                  <h3 className="text-xs font-bold font-mono uppercase tracking-wider">
                    LOCALSTORAGE PRESET PERSISTENCE
                  </h3>
                </div>
                <p className="text-xs text-gray-400 font-mono leading-relaxed">
                  All custom channel presets, master settings, and console snapshots are persisted in your
                  browser's isolated <code className="text-cyan-300">localStorage</code>. They survive reboots,
                  browser refreshes, and self-healing engine reboots.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* Export Box */}
                  <div className="bg-[#1a1a1a] p-4 rounded border border-[#333] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-white font-mono text-xs font-bold mb-1">
                        <Download size={14} className="text-cyan-400" />
                        <span>EXPORT TO JSON FILE</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono mb-4">
                        Download all custom presets to a JSON file on your machine for safekeeping, migrating to
                        another computer, or sharing with team members.
                      </p>
                    </div>
                    <button
                      onClick={handleExport}
                      className="w-full py-2 bg-cyan-900/60 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all skeuo-button"
                    >
                      <Download size={14} />
                      DOWNLOAD PRESETS BACKUP (.JSON)
                    </button>
                  </div>

                  {/* Import Box */}
                  <div className="bg-[#1a1a1a] p-4 rounded border border-[#333] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-white font-mono text-xs font-bold mb-1">
                        <Upload size={14} className="text-green-400" />
                        <span>IMPORT FROM JSON FILE</span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono mb-4">
                        Restore or merge presets from a previously exported CORE AZERO JSON file without losing
                        factory defaults.
                      </p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="application/json,.json"
                      onChange={handleFileImport}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 bg-green-950/60 hover:bg-green-900/80 text-green-200 border border-green-700 rounded text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all skeuo-button"
                    >
                      <Upload size={14} />
                      SELECT JSON FILE TO IMPORT
                    </button>
                  </div>
                </div>

                {/* Reset Warning Box */}
                <div className="pt-4 border-t border-[#262626] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-mono">
                    <Info size={14} />
                    <span>Factory presets cannot be modified or deleted.</span>
                  </div>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          'Are you sure you want to delete ALL custom presets from localStorage? This cannot be undone.'
                        )
                      ) {
                        presetService.clearAllCustomPresets();
                        refreshPresets();
                        showToast('All custom presets have been cleared.');
                      }
                    }}
                    className="text-red-400 hover:text-red-300 text-[10px] font-mono hover:underline flex items-center gap-1"
                  >
                    <RotateCcw size={11} /> Clear All Custom Presets
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Bar */}
        <div className="bg-[#0c0c0c] px-5 py-2.5 border-t border-[#252525] flex items-center justify-between text-[10px] font-mono text-gray-500">
          <div className="flex items-center gap-4">
            <span>
              TOTAL PRESETS:{' '}
              <strong className="text-gray-300">
                {consolePresets.length + channelPresets.length + masterPresets.length}
              </strong>
            </span>
            <span>•</span>
            <span>
              ACTIVE CONSOLE:{' '}
              <strong className="text-cyan-400">
                {consolePresets.find((p) => p.id === activePresetId)?.name || 'Custom / Unsaved'}
              </strong>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-gray-300 rounded text-[10px] font-mono border border-[#333]"
          >
            CLOSE
          </button>
        </div>

      </div>
    </div>
  );
};

export default PresetsModal;
