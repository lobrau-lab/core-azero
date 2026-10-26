import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  Square,
  Repeat,
  Circle,
  Sparkles,
  Trash2,
  Sliders,
  Layers,
  Activity,
  Maximize2,
  TrendingUp,
  Volume2,
  Eye,
  EyeOff,
  Clock,
  BarChart2,
  Filter,
  CheckSquare,
  Square as SquareOutline
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  Brush,
  AreaChart,
  Area
} from 'recharts';
import { automationService } from '../services/automationService';
import {
  AutomationBuffer,
  AutomationStatus,
  AutomationPoint,
  AutomationTargetId,
  ChannelSettings,
  MasterSettings
} from '../types';

interface AutomationOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: ChannelSettings[];
  masterSettings: MasterSettings;
}

// Color palette for all channels
const CHANNEL_PALETTE: Record<string, { color: string; label: string; strokeDash?: string }> = {
  master: { color: '#f59e0b', label: 'Master Bus' },
  channel_1: { color: '#4ade80', label: 'Ch 1' },
  channel_2: { color: '#22d3ee', label: 'Ch 2' },
  channel_3: { color: '#a855f7', label: 'Ch 3' },
  channel_4: { color: '#f43f5e', label: 'Ch 4' },
  channel_5: { color: '#38bdf8', label: 'Ch 5' },
  channel_6: { color: '#fb923c', label: 'Ch 6' },
  channel_7: { color: '#e879f9', label: 'Ch 7' },
  channel_8: { color: '#facc15', label: 'Ch 8' },
};

const formatTimeMs = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((ms % 1000) / 100);
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${millis}`;
};

const gainToDb = (gain: number): string => {
  if (gain <= 0.0001) return '-∞ dB';
  const db = 20 * Math.log10(gain);
  return `${db >= 0 ? '+' : ''}${db.toFixed(1)} dB`;
};

// Custom dark styled Tooltip for Recharts
const CustomRechartsTooltip = ({
  active,
  payload,
  label,
  channelNames,
}: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#121212]/95 border border-[#333] shadow-2xl rounded-lg p-3 text-xs backdrop-blur-md min-w-[200px] z-50">
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#262626]">
        <div className="flex items-center gap-1.5 text-cyan-400 font-mono font-bold text-[11px]">
          <Clock size={12} />
          <span>{label}</span>
        </div>
        <span className="text-[9px] text-gray-500 font-mono">
          {payload.length} lane{payload.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
        {payload.map((entry: any) => {
          const targetId = entry.dataKey as string;
          const config = CHANNEL_PALETTE[targetId] || { color: entry.color, label: targetId };
          const customName = channelNames[targetId] || config.label;
          const val = Number(entry.value);

          return (
            <div key={targetId} className="flex items-center justify-between gap-3 text-[11px] font-mono">
              <div className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2 h-2 rounded-full shrink-0 shadow-sm"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-gray-200 font-semibold truncate">{customName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-400 text-[10px]">{val.toFixed(2)}x</span>
                <span
                  className={`px-1 rounded text-[10px] font-bold ${
                    val > 1.0
                      ? 'text-amber-400 bg-amber-950/60'
                      : val === 1.0
                      ? 'text-gray-300 bg-neutral-800'
                      : 'text-cyan-400 bg-cyan-950/60'
                  }`}
                >
                  {gainToDb(val)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AutomationOverviewModal: React.FC<AutomationOverviewModalProps> = ({
  isOpen,
  onClose,
  channels,
  masterSettings,
}) => {
  const [status, setStatus] = useState<AutomationStatus>(() => automationService.getStatus());
  const [buffer, setBuffer] = useState<AutomationBuffer | null>(() => automationService.getBuffer());
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => automationService.getCurrentPlaybackTime());
  const [durationMs, setDurationMs] = useState<number>(() => automationService.getDuration());
  const [isLooping, setIsLooping] = useState<boolean>(() => automationService.isLoopEnabled());

  // View state: 'combined' = full multi-line timeline, 'lanes' = individual channel sparklines, 'data' = keyframes table
  const [viewMode, setViewMode] = useState<'combined' | 'lanes' | 'table'>('combined');
  const [showBrush, setShowBrush] = useState<boolean>(true);

  // Channel visibility filter: targetId -> boolean
  const [visibleTargets, setVisibleTargets] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { master: true };
    for (let i = 1; i <= 8; i++) {
      initial[`channel_${i}`] = true;
    }
    return initial;
  });

  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Listen to automationService updates
  useEffect(() => {
    const handleState = (s: AutomationStatus) => setStatus(s);
    const handleBuf = (b: AutomationBuffer | null) => {
      setBuffer(b ? { ...b, points: [...b.points] } : null);
      if (b) setDurationMs(b.duration);
    };
    const handleTime = (c: number, d: number) => {
      setCurrentTimeMs(c);
      setDurationMs(d);
    };

    automationService.onStateChange = handleState;
    automationService.onBufferChange = handleBuf;
    automationService.onTimeUpdate = handleTime;

    return () => {
      if (automationService.onStateChange === handleState) automationService.onStateChange = null;
      if (automationService.onBufferChange === handleBuf) automationService.onBufferChange = null;
      if (automationService.onTimeUpdate === handleTime) automationService.onTimeUpdate = null;
    };
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Channel lookup dictionary for names
  const channelNames = useMemo<Record<string, string>>(() => {
    const names: Record<string, string> = { master: 'MASTER BUS' };
    channels.forEach((ch) => {
      names[`channel_${ch.id}`] = ch.name ? `${ch.name} (CH ${ch.id})` : `CH ${ch.id}`;
    });
    return names;
  }, [channels]);

  // Generate Recharts timeline data
  const timelineData = useMemo(() => {
    return automationService.getTimelineData(100);
  }, [buffer, durationMs]);

  // Determine active targets recorded in the buffer
  const recordedTargets = useMemo<string[]>(() => {
    if (!buffer || buffer.points.length === 0) return ['master', 'channel_1'];
    const set = new Set<string>();
    for (const p of buffer.points) {
      set.add(p.targetId);
    }
    return Array.from(set);
  }, [buffer]);

  // Calculate per-lane statistics
  const laneStats = useMemo(() => {
    const stats: Record<string, { count: number; min: number; max: number; current: number; points: AutomationPoint[] }> = {};

    const allTargets = ['master', ...Array.from({ length: 8 }, (_, i) => `channel_${i + 1}`)];
    allTargets.forEach((t) => {
      stats[t] = { count: 0, min: 1, max: 1, current: 1, points: [] };
    });

    if (buffer) {
      for (const p of buffer.points) {
        if (!stats[p.targetId]) {
          stats[p.targetId] = { count: 0, min: p.value, max: p.value, current: p.value, points: [] };
        }
        const st = stats[p.targetId];
        st.count++;
        st.points.push(p);
        st.min = Math.min(st.min, p.value);
        st.max = Math.max(st.max, p.value);
        st.current = p.value;
      }
    }

    return stats;
  }, [buffer]);

  if (!isOpen) return null;

  // Actions
  const handleToggleRecord = () => {
    if (status === 'recording') {
      automationService.stopRecording();
    } else {
      automationService.startRecording({
        masterGain: masterSettings.masterGain,
        channels: channels.map((c) => ({ id: c.id, gain: c.gain })),
      });
    }
  };

  const handleTogglePlayback = () => {
    if (status === 'playing') {
      automationService.pausePlayback();
    } else {
      if (!buffer || buffer.points.length === 0) {
        automationService.generateDemoAutomation(masterSettings.masterGain);
      }
      automationService.startPlayback({ loop: isLooping });
    }
  };

  const handleStop = () => {
    automationService.stopPlayback();
  };

  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    automationService.setLoop(next);
  };

  const handleClear = () => {
    if (window.confirm('Clear all recorded fader automation points?')) {
      automationService.clearBuffer();
    }
  };

  const handleGenerateDemo = () => {
    automationService.generateDemoAutomation(masterSettings.masterGain);
  };

  const toggleTargetVisibility = (targetId: string) => {
    setVisibleTargets((prev) => ({
      ...prev,
      [targetId]: !prev[targetId],
    }));
  };

  const handleSelectAllTargets = () => {
    const next: Record<string, boolean> = { master: true };
    for (let i = 1; i <= 8; i++) {
      next[`channel_${i}`] = true;
    }
    setVisibleTargets(next);
  };

  const handleSelectOnlyActive = () => {
    const next: Record<string, boolean> = {};
    for (let i = 1; i <= 8; i++) {
      next[`channel_${i}`] = false;
    }
    next.master = false;
    recordedTargets.forEach((t) => {
      next[t] = true;
    });
    setVisibleTargets(next);
  };

  const handleSoloTarget = (targetId: string) => {
    const next: Record<string, boolean> = {};
    for (let i = 1; i <= 8; i++) {
      next[`channel_${i}`] = false;
    }
    next.master = false;
    next[targetId] = true;
    setVisibleTargets(next);
  };

  // Playhead position formatted string to match recharts X-Axis
  const playheadMinutes = Math.floor(currentTimeMs / 60000);
  const playheadSeconds = Math.floor((currentTimeMs % 60000) / 1000);
  const playheadMs = Math.floor((currentTimeMs % 1000) / 100);
  const playheadFormatted = `${playheadMinutes > 0 ? `${playheadMinutes}:` : ''}${playheadSeconds
    .toString()
    .padStart(playheadMinutes > 0 ? 2 : 1, '0')}.${playheadMs}s`;

  const totalPoints = buffer ? buffer.points.length : 0;
  const activeChannelsCount = recordedTargets.filter((t) => t !== 'master').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e0e0e] border border-[#2b2b2b] rounded-xl shadow-2xl w-full max-w-6xl h-[92vh] max-h-[900px] flex flex-col overflow-hidden text-gray-200">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#141414] via-[#111] to-[#141414] border-b border-[#242424]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-950 to-blue-900 border border-cyan-500/40 flex items-center justify-center shadow-inner">
              <TrendingUp size={18} className="text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black tracking-wider text-white uppercase font-sans">
                  Automation Overview
                </h2>
                {/* Live Status Badge */}
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider border ${
                    status === 'recording'
                      ? 'bg-red-950/80 text-red-300 border-red-500/80 animate-pulse'
                      : status === 'playing'
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/80'
                      : status === 'paused'
                      ? 'bg-amber-950/80 text-amber-300 border-amber-600/80'
                      : totalPoints > 0
                      ? 'bg-neutral-800 text-gray-300 border-neutral-700'
                      : 'bg-black text-gray-600 border-neutral-800'
                  }`}
                >
                  ● {status.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                Visual Timeline of Recorded Fader Movements for All Channels (Recharts Engine)
              </p>
            </div>
          </div>

          {/* Time & Points Summary + Close */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 bg-[#161616] px-3 py-1.5 rounded-lg border border-[#262626] font-mono text-[11px]">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Clock size={12} className="text-cyan-400" />
                <span className={status === 'playing' ? 'text-emerald-400 font-bold' : 'text-white'}>
                  {formatTimeMs(currentTimeMs)}
                </span>
                <span className="text-gray-600">/</span>
                <span className="text-gray-400">{formatTimeMs(durationMs)}</span>
              </div>
              <div className="h-3 w-[1px] bg-neutral-700" />
              <div className="flex items-center gap-1 text-gray-400">
                <Activity size={12} className="text-amber-400" />
                <span className="text-amber-300 font-bold">{totalPoints}</span>
                <span className="text-gray-500 text-[10px]">pts</span>
              </div>
              <div className="h-3 w-[1px] bg-neutral-700" />
              <div className="flex items-center gap-1 text-gray-400">
                <Layers size={12} className="text-emerald-400" />
                <span className="text-emerald-300 font-bold">{activeChannelsCount + (laneStats.master?.count ? 1 : 0)}</span>
                <span className="text-gray-500 text-[10px]">lanes</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              title="Close modal (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Transport Toolbar & View Mode Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#121212] border-b border-[#222]">
          {/* Playback & Automation Actions */}
          <div className="flex items-center gap-2">
            {/* Record */}
            <button
              onClick={handleToggleRecord}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold tracking-wider transition-all skeuo-button active:scale-95 ${
                status === 'recording'
                  ? 'bg-red-600 text-white border border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse'
                  : 'bg-[#1b1b1b] hover:bg-[#252525] text-red-400 hover:text-red-300 border border-[#333]'
              }`}
              title={status === 'recording' ? 'Stop recording fader automation' : 'Record fader movements into buffer'}
            >
              <Circle
                size={10}
                className={status === 'recording' ? 'fill-white text-white' : 'fill-red-500 text-red-500'}
              />
              <span>{status === 'recording' ? 'STOP REC' : 'RECORD'}</span>
            </button>

            {/* Playback (Main Action) */}
            <button
              onClick={handleTogglePlayback}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-[10px] font-black tracking-wider transition-all skeuo-button active:scale-95 ${
                status === 'playing'
                  ? 'bg-emerald-600 text-white border border-emerald-400 shadow-[0_0_14px_rgba(16,185,129,0.5)]'
                  : totalPoints > 0
                  ? 'bg-gradient-to-r from-emerald-950 to-emerald-900 hover:from-emerald-900 hover:to-emerald-800 text-emerald-200 border border-emerald-600/70 shadow-sm'
                  : 'bg-[#1b1b1b] hover:bg-[#252525] text-emerald-400 border border-[#333]'
              }`}
              title="Automatically replay recorded fader movements"
            >
              {status === 'playing' ? (
                <>
                  <Pause size={12} className="fill-white" />
                  <span>PAUSE</span>
                </>
              ) : (
                <>
                  <Play size={12} className="fill-emerald-400 text-emerald-400" />
                  <span>PLAYBACK</span>
                </>
              )}
            </button>

            {/* Stop / Rewind */}
            <button
              onClick={handleStop}
              disabled={status === 'idle' && currentTimeMs === 0}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold border transition-all skeuo-button active:scale-95 ${
                status === 'idle' && currentTimeMs === 0
                  ? 'bg-[#141414] text-gray-700 border-transparent cursor-not-allowed'
                  : 'bg-[#1b1b1b] hover:bg-[#252525] text-gray-300 hover:text-white border-[#333]'
              }`}
              title="Stop and rewind to beginning"
            >
              <Square size={10} className="fill-current" />
              <span>STOP</span>
            </button>

            {/* Loop Toggle */}
            <button
              onClick={handleToggleLoop}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold border transition-all skeuo-button active:scale-95 ${
                isLooping
                  ? 'bg-amber-950/80 text-amber-300 border-amber-600/80 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  : 'bg-[#1b1b1b] hover:bg-[#252525] text-gray-400 hover:text-gray-200 border-[#333]'
              }`}
              title="Toggle automation looping"
            >
              <Repeat size={11} className={isLooping ? 'text-amber-400' : 'text-gray-500'} />
              <span>LOOP</span>
            </button>

            <div className="h-5 w-[1px] bg-neutral-800 mx-1" />

            {/* Instant Demo Generator */}
            <button
              onClick={handleGenerateDemo}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#161616] hover:bg-[#222] text-cyan-400 hover:text-cyan-300 border border-cyan-800/60 text-[10px] font-bold transition-all"
              title="Generate a multi-channel fader movement demo to visualize in Recharts"
            >
              <Sparkles size={11} />
              <span>GENERATE DEMO</span>
            </button>

            {/* Clear */}
            {totalPoints > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1 px-2 py-1.5 rounded bg-[#161616] hover:bg-[#281515] text-gray-400 hover:text-red-400 border border-[#333] text-[10px] transition-colors"
                title="Clear temporary automation buffer"
              >
                <Trash2 size={11} />
                <span className="hidden sm:inline">CLEAR</span>
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#161616] p-0.5 rounded-lg border border-[#262626]">
            <button
              onClick={() => setViewMode('combined')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all ${
                viewMode === 'combined'
                  ? 'bg-gradient-to-r from-cyan-900 to-blue-900 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <TrendingUp size={12} />
              <span>COMBINED TIMELINE</span>
            </button>

            <button
              onClick={() => setViewMode('lanes')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all ${
                viewMode === 'lanes'
                  ? 'bg-gradient-to-r from-cyan-900 to-blue-900 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <BarChart2 size={12} />
              <span>PER-CHANNEL LANES</span>
            </button>

            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold transition-all ${
                viewMode === 'table'
                  ? 'bg-gradient-to-r from-cyan-900 to-blue-900 text-white shadow-sm'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Layers size={12} />
              <span>KEYFRAMES TABLE</span>
            </button>
          </div>
        </div>

        {/* Channel Selector Chips Bar */}
        <div className="px-5 py-2 bg-[#0c0c0c] border-b border-[#1f1f1f] flex items-center justify-between gap-3 overflow-x-auto text-[10px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-gray-500 font-mono text-[9px] uppercase tracking-wider mr-1 flex items-center gap-1">
              <Filter size={10} />
              <span>LANES:</span>
            </span>

            {/* Master Bus Chip */}
            <button
              onClick={() => toggleTargetVisibility('master')}
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all font-mono font-bold ${
                visibleTargets.master
                  ? 'bg-[#221c08] border-amber-500/80 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : 'bg-[#141414] border-[#292929] text-gray-500 opacity-60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>MASTER</span>
              <span className="text-[8px] text-amber-400/80">({laneStats.master?.count || 0}p)</span>
            </button>

            {/* Channels 1-8 Chips */}
            {Array.from({ length: 8 }, (_, i) => {
              const chId = i + 1;
              const targetId = `channel_${chId}`;
              const config = CHANNEL_PALETTE[targetId];
              const isVisible = visibleTargets[targetId];
              const pCount = laneStats[targetId]?.count || 0;
              const chName = channels.find((c) => c.id === chId)?.name || `CH ${chId}`;

              return (
                <button
                  key={targetId}
                  onClick={() => toggleTargetVisibility(targetId)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border transition-all font-mono ${
                    isVisible
                      ? 'bg-[#161616] border-opacity-80 text-gray-200 font-semibold'
                      : 'bg-[#101010] border-[#242424] text-gray-600 opacity-50'
                  }`}
                  style={{
                    borderColor: isVisible ? config.color : undefined,
                    boxShadow: isVisible ? `0 0 6px ${config.color}22` : undefined,
                  }}
                  title={`Toggle ${chName} visibility in graph`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span>{chName}</span>
                  <span className="text-[8px] opacity-70">({pCount}p)</span>
                </button>
              );
            })}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center gap-1.5 shrink-0 text-[9px] font-mono">
            <button
              onClick={handleSelectAllTargets}
              className="px-2 py-0.5 rounded bg-[#181818] hover:bg-[#222] text-gray-300 border border-[#2b2b2b]"
            >
              SHOW ALL
            </button>
            <button
              onClick={handleSelectOnlyActive}
              className="px-2 py-0.5 rounded bg-[#181818] hover:bg-[#222] text-cyan-400 border border-cyan-900/60"
            >
              ACTIVE ONLY
            </button>
            {viewMode === 'combined' && (
              <button
                onClick={() => setShowBrush(!showBrush)}
                className={`px-2 py-0.5 rounded border ${
                  showBrush
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80'
                    : 'bg-[#181818] text-gray-400 border-[#2b2b2b]'
                }`}
                title="Toggle timeline zoom/brush navigator"
              >
                ZOOM BRUSH
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 bg-[#090909] p-4 overflow-y-auto">
          {/* Empty Buffer State Notice */}
          {totalPoints === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-[#101010] rounded-xl border border-dashed border-[#282828]">
              <div className="w-14 h-14 rounded-full bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center mb-3">
                <TrendingUp size={28} className="text-cyan-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">No Fader Automation Recorded Yet</h3>
              <p className="text-xs text-gray-400 max-w-md mb-5 leading-relaxed">
                Record live gain fader movements from the mixer strips or your external Web MIDI controller, or generate a rich demo timeline to inspect in Recharts.
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleGenerateDemo}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-bold text-xs shadow-lg transition-transform active:scale-95"
                >
                  <Sparkles size={14} />
                  <span>Generate Multi-Channel Demo</span>
                </button>
                <button
                  onClick={handleToggleRecord}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs shadow-lg transition-transform active:scale-95"
                >
                  <Circle size={12} className="fill-white" />
                  <span>Start Recording Now</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 1: COMBINED RECHARTS MULTI-LINE GRAPH */}
          {totalPoints > 0 && viewMode === 'combined' && (
            <div className="h-full flex flex-col bg-[#0d0d0d] rounded-xl border border-[#222] p-3 shadow-inner">
              {/* Graph Legend & Status Subheader */}
              <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-mono text-gray-400 border-b border-[#1c1c1c] mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-gray-300 font-bold flex items-center gap-1">
                    <Activity size={12} className="text-cyan-400" />
                    <span>TIMELINE (Gain vs Time)</span>
                  </span>
                  <span className="text-gray-500">|</span>
                  <span className="text-gray-400">Y-Axis: Fader Gain (0.00x - 1.50x / -∞ to +3.5 dB)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400 font-bold">Playhead: {playheadFormatted}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">{timelineData.length} sampled points</span>
                </div>
              </div>

              {/* Recharts Main Graph */}
              <div ref={chartContainerRef} className="flex-1 w-full min-h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={timelineData}
                    margin={{ top: 15, right: 25, left: 0, bottom: 5 }}
                    onClick={(e: any) => {
                      if (e && e.activePayload && e.activePayload.length > 0) {
                        const point = e.activePayload[0].payload;
                        if (point && typeof point.timeMs === 'number') {
                          automationService.seek(point.timeMs);
                        }
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1c" vertical={true} />
                    
                    <XAxis
                      dataKey="formattedTime"
                      stroke="#555"
                      tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={{ stroke: '#333' }}
                    />

                    <YAxis
                      domain={[0, 1.5]}
                      stroke="#555"
                      tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
                      tickLine={{ stroke: '#333' }}
                      tickFormatter={(val) => `${val.toFixed(2)}x`}
                      ticks={[0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5]}
                    />

                    <Tooltip
                      content={
                        <CustomRechartsTooltip
                          channelNames={channelNames}
                        />
                      }
                    />

                    {/* Unity Gain Reference Line (1.0x / 0 dB) */}
                    <ReferenceLine
                      y={1.0}
                      stroke="#444"
                      strokeDasharray="4 4"
                      label={{
                        value: 'UNITY (0 dB / 1.0x)',
                        fill: '#777',
                        fontSize: 9,
                        position: 'insideTopRight',
                        fontFamily: 'monospace',
                      }}
                    />

                    {/* Active Playhead Reference Line */}
                    {durationMs > 0 && (
                      <ReferenceLine
                        x={playheadFormatted}
                        stroke="#22d3ee"
                        strokeWidth={2}
                        label={{
                          value: `PLAYHEAD: ${playheadFormatted}`,
                          fill: '#22d3ee',
                          fontSize: 10,
                          position: 'top',
                          fontFamily: 'monospace',
                          fontWeight: 'bold',
                        }}
                      />
                    )}

                    {/* Master Bus Line */}
                    {visibleTargets.master && (
                      <Line
                        type="monotone"
                        dataKey="master"
                        name={channelNames.master || 'Master Bus'}
                        stroke={CHANNEL_PALETTE.master.color}
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, fill: CHANNEL_PALETTE.master.color, stroke: '#fff', strokeWidth: 1 }}
                        isAnimationActive={false}
                      />
                    )}

                    {/* Channel 1-8 Lines */}
                    {Array.from({ length: 8 }, (_, i) => {
                      const chId = i + 1;
                      const targetId = `channel_${chId}`;
                      if (!visibleTargets[targetId]) return null;

                      const config = CHANNEL_PALETTE[targetId];
                      const chName = channelNames[targetId] || `CH ${chId}`;

                      return (
                        <Line
                          key={targetId}
                          type="monotone"
                          dataKey={targetId}
                          name={chName}
                          stroke={config.color}
                          strokeWidth={1.8}
                          dot={false}
                          activeDot={{ r: 4, fill: config.color, stroke: '#fff', strokeWidth: 1 }}
                          isAnimationActive={false}
                        />
                      );
                    })}

                    {/* Optional Timeline Brush for Zooming */}
                    {showBrush && timelineData.length > 5 && (
                      <Brush
                        dataKey="formattedTime"
                        height={24}
                        stroke="#0284c7"
                        fill="#0c121e"
                        tickFormatter={() => ''}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Scrubber & Legend Footer */}
              <div className="pt-2 mt-1 border-t border-[#1c1c1c] flex items-center justify-between text-[10px] text-gray-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Hint:</span>
                  <span>Click anywhere along the timeline graph to jump the playback playhead.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-0.5 bg-gray-500" />
                    <span>0 dB Unity</span>
                  </span>
                  <span className="flex items-center gap-1 text-cyan-400">
                    <span className="w-2.5 h-0.5 bg-cyan-400" />
                    <span>Playhead</span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: PER-CHANNEL INDIVIDUAL LANES (SPARKLINE CARDS) */}
          {totalPoints > 0 && viewMode === 'lanes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Master Lane Card */}
              {visibleTargets.master && (
                <div className="bg-[#111] border border-[#262626] rounded-xl p-3 shadow-md flex flex-col justify-between hover:border-amber-600/50 transition-colors">
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#202020]">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                      <span className="text-xs font-bold text-white font-mono">MASTER BUS</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-gray-400">{laneStats.master?.count || 0} pts</span>
                      <button
                        onClick={() => handleSoloTarget('master')}
                        className="px-1.5 py-0.5 rounded bg-[#1c1c1c] hover:bg-amber-900/40 text-amber-300 border border-amber-800/60 text-[9px]"
                      >
                        SOLO
                      </button>
                    </div>
                  </div>

                  <div className="h-28 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradMaster" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 2" stroke="#1c1c1c" />
                        <XAxis dataKey="formattedTime" hide />
                        <YAxis domain={[0, 1.5]} tick={{ fontSize: 8, fill: '#666' }} />
                        <Tooltip content={<CustomRechartsTooltip channelNames={channelNames} />} />
                        {durationMs > 0 && (
                          <ReferenceLine x={playheadFormatted} stroke="#22d3ee" strokeWidth={1.5} />
                        )}
                        <Area
                          type="monotone"
                          dataKey="master"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#gradMaster)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#1c1c1c] text-[10px] font-mono text-gray-400">
                    <span>Min: {laneStats.master?.min.toFixed(2)}x</span>
                    <span>Max: {laneStats.master?.max.toFixed(2)}x</span>
                    <span className="text-amber-300 font-bold">
                      {gainToDb(laneStats.master?.current || masterSettings.masterGain)}
                    </span>
                  </div>
                </div>
              )}

              {/* Channels 1-8 Lane Cards */}
              {Array.from({ length: 8 }, (_, i) => {
                const chId = i + 1;
                const targetId = `channel_${chId}`;
                if (!visibleTargets[targetId]) return null;

                const config = CHANNEL_PALETTE[targetId];
                const stats = laneStats[targetId] || { count: 0, min: 1, max: 1, current: 1 };
                const ch = channels.find((c) => c.id === chId);
                const chName = ch?.name ? `${ch.name} (CH ${chId})` : `CH ${chId}`;

                return (
                  <div
                    key={targetId}
                    className="bg-[#111] border border-[#262626] rounded-xl p-3 shadow-md flex flex-col justify-between hover:border-gray-500 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#202020]">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shadow-sm"
                          style={{ backgroundColor: config.color }}
                        />
                        <span className="text-xs font-bold text-white font-mono truncate max-w-[130px]">
                          {chName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-gray-400">{stats.count} pts</span>
                        <button
                          onClick={() => handleSoloTarget(targetId)}
                          className="px-1.5 py-0.5 rounded bg-[#1c1c1c] hover:bg-neutral-700 text-gray-300 border border-[#333] text-[9px]"
                        >
                          SOLO
                        </button>
                      </div>
                    </div>

                    <div className="h-28 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={timelineData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`grad_${targetId}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={config.color} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="2 2" stroke="#1c1c1c" />
                          <XAxis dataKey="formattedTime" hide />
                          <YAxis domain={[0, 1.2]} tick={{ fontSize: 8, fill: '#666' }} />
                          <Tooltip content={<CustomRechartsTooltip channelNames={channelNames} />} />
                          {durationMs > 0 && (
                            <ReferenceLine x={playheadFormatted} stroke="#22d3ee" strokeWidth={1.5} />
                          )}
                          <Area
                            type="monotone"
                            dataKey={targetId}
                            stroke={config.color}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#grad_${targetId})`}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#1c1c1c] text-[10px] font-mono text-gray-400">
                      <span>Min: {stats.min.toFixed(2)}x</span>
                      <span>Max: {stats.max.toFixed(2)}x</span>
                      <span className="text-cyan-300 font-bold">{gainToDb(stats.current)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 3: KEYFRAMES TABLE INSPECTOR */}
          {totalPoints > 0 && viewMode === 'table' && buffer && (
            <div className="bg-[#101010] border border-[#242424] rounded-xl overflow-hidden shadow-md flex flex-col h-full">
              <div className="px-4 py-2.5 bg-[#141414] border-b border-[#202020] flex items-center justify-between text-xs font-mono">
                <span className="text-gray-300 font-bold">
                  Raw Keyframe Buffer ({buffer.points.length} entries)
                </span>
                <span className="text-gray-500 text-[11px]">
                  Recorded on: {new Date(buffer.recordedAt).toLocaleTimeString()}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead className="bg-[#181818] text-gray-400 sticky top-0 border-b border-[#262626]">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Target</th>
                      <th className="py-2 px-3">Raw Gain</th>
                      <th className="py-2 px-3">dB Value</th>
                      <th className="py-2 px-3">Normalized</th>
                      <th className="py-2 px-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c1c1c]">
                    {buffer.points.map((pt, idx) => {
                      const config = CHANNEL_PALETTE[pt.targetId] || { color: '#888', label: pt.targetId };
                      const name = channelNames[pt.targetId] || config.label;
                      const isCurrent = Math.abs(currentTimeMs - pt.timestamp) < 100;

                      return (
                        <tr
                          key={pt.id}
                          className={`hover:bg-[#181818] transition-colors ${
                            isCurrent ? 'bg-cyan-950/40 text-cyan-200' : 'text-gray-300'
                          }`}
                        >
                          <td className="py-1.5 px-3 text-gray-500">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-bold">{formatTimeMs(pt.timestamp)}</td>
                          <td className="py-1.5 px-3">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: config.color }}
                              />
                              <span>{name}</span>
                            </span>
                          </td>
                          <td className="py-1.5 px-3">{pt.value.toFixed(3)}</td>
                          <td className="py-1.5 px-3 text-amber-300 font-bold">{gainToDb(pt.value)}</td>
                          <td className="py-1.5 px-3 text-gray-400">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-[#222] rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, pt.normalized * 100)}%`,
                                    backgroundColor: config.color,
                                  }}
                                />
                              </div>
                              <span>{Math.round(pt.normalized * 100)}%</span>
                            </div>
                          </td>
                          <td className="py-1.5 px-3">
                            <button
                              onClick={() => automationService.seek(pt.timestamp)}
                              className="px-2 py-0.5 rounded bg-[#202020] hover:bg-cyan-900/50 text-cyan-400 text-[10px]"
                            >
                              Seek
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="px-5 py-3 bg-[#111] border-t border-[#222] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Real-Time Playback Synchronization</span>
            </span>
            <span className="hidden sm:inline text-gray-600">•</span>
            <span className="hidden sm:inline text-gray-400">
              Interpolation: Hermite cubic/linear smoothing
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#1e1e1e] hover:bg-[#282828] text-gray-300 hover:text-white rounded-lg text-xs font-bold transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AutomationOverviewModal;
