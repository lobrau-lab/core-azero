import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Circle,
  Play,
  Pause,
  Square,
  Repeat,
  Trash2,
  Sparkles,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
  TrendingUp,
} from 'lucide-react';
import { automationService } from '../services/automationService';
import {
  AutomationStatus,
  AutomationBuffer,
  AutomationPoint,
  AutomationLaneInfo,
} from '../types';

interface AutomationLaneProps {
  currentMasterGain: number;
  channels: { id: number; gain: number }[];
  onStartRecord?: () => void;
  onStopRecord?: () => void;
  onOpenOverview?: () => void;
}

const formatTime = (ms: number): string => {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((ms % 1000) / 100);
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${millis}`;
};

export const AutomationLane: React.FC<AutomationLaneProps> = ({
  currentMasterGain,
  channels,
  onOpenOverview,
}) => {
  const [status, setStatus] = useState<AutomationStatus>(() => automationService.getStatus());
  const [buffer, setBuffer] = useState<AutomationBuffer | null>(() => automationService.getBuffer());
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => automationService.getCurrentPlaybackTime());
  const [durationMs, setDurationMs] = useState<number>(() => automationService.getDuration());
  const [isLooping, setIsLooping] = useState<boolean>(() => automationService.isLoopEnabled());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Sync with service listeners
  useEffect(() => {
    automationService.onStateChange = (newStatus) => {
      setStatus(newStatus);
    };

    automationService.onBufferChange = (newBuffer) => {
      setBuffer(newBuffer ? { ...newBuffer, points: [...newBuffer.points] } : null);
      if (newBuffer) {
        setDurationMs(newBuffer.duration);
      }
    };

    automationService.onTimeUpdate = (current, total) => {
      setCurrentTimeMs(current);
      setDurationMs(total);
    };

    return () => {
      automationService.onStateChange = null;
      automationService.onBufferChange = null;
      automationService.onTimeUpdate = null;
    };
  }, []);

  const lanes = useMemo<AutomationLaneInfo[]>(() => {
    return automationService.getLanes();
  }, [buffer]);

  const handleToggleRecord = () => {
    if (status === 'recording') {
      automationService.stopRecording();
    } else {
      automationService.startRecording({
        masterGain: currentMasterGain,
        channels,
      });
    }
  };

  const handleTogglePlayback = () => {
    if (status === 'playing') {
      automationService.pausePlayback();
    } else {
      if (!buffer || buffer.points.length === 0) {
        // Auto-generate demo if empty to give instant feedback
        automationService.generateDemoAutomation(currentMasterGain);
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
    if (window.confirm('Clear recorded fader movements from temporary buffer?')) {
      automationService.clearBuffer();
    }
  };

  const handleLoadDemo = () => {
    automationService.generateDemoAutomation(currentMasterGain);
  };

  // Interactive Playhead scrubbing via canvas click/drag
  const handleScrub = useCallback(
    (clientX: number) => {
      if (!canvasRef.current || !durationMs || durationMs <= 0) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = clickX / rect.width;
      const targetTime = ratio * durationMs;
      automationService.seek(targetTime);
    },
    [durationMs]
  );

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingPlayhead(true);
    handleScrub(e.clientX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingPlayhead) {
        handleScrub(e.clientX);
      }
    };
    const handleMouseUp = () => {
      if (isDraggingPlayhead) {
        setIsDraggingPlayhead(false);
      }
    };

    if (isDraggingPlayhead) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPlayhead, handleScrub]);

  // Canvas Waveform & Curve Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 300;
    const height = canvas.clientHeight || 70;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);

    const padTop = 8;
    const padBottom = 14;
    const drawHeight = height - padTop - padBottom;
    const totalDuration = Math.max(durationMs, 1000);

    // Grid lines (horizontal gain levels)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let r = 0; r <= 4; r++) {
      const y = padTop + (r / 4) * drawHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Time ticks (vertical)
    const secondInterval = totalDuration > 15000 ? 5 : totalDuration > 8000 ? 2 : 1;
    const numSeconds = Math.ceil(totalDuration / 1000);
    ctx.font = '7px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.textAlign = 'center';

    for (let s = 0; s <= numSeconds; s += secondInterval) {
      const x = ( (s * 1000) / totalDuration ) * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height - 12);
      ctx.stroke();

      ctx.fillText(`${s}s`, x + 2, height - 3);
    }

    // Empty Buffer State
    if (!buffer || buffer.points.length === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        status === 'recording'
          ? '● RECORDING FADER MOVEMENTS...'
          : 'NO AUTOMATION BUFFER - PRESS REC OR DEMO',
        width / 2,
        height / 2
      );
      return;
    }

    // Render curves for each recorded target
    const pointsByTarget: Record<string, AutomationPoint[]> = {};
    for (const pt of buffer.points) {
      if (!pointsByTarget[pt.targetId]) {
        pointsByTarget[pt.targetId] = [];
      }
      pointsByTarget[pt.targetId].push(pt);
    }

    Object.entries(pointsByTarget).forEach(([targetId, pts]) => {
      if (pts.length === 0) return;

      const isMaster = targetId === 'master';
      const strokeColor = isMaster ? '#f59e0b' : '#38bdf8';
      const glowColor = isMaster ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.3)';

      // Draw subtle filled area under curve
      ctx.beginPath();
      const firstX = (pts[0].timestamp / totalDuration) * width;
      const firstY = padTop + (1 - pts[0].normalized) * drawHeight;
      ctx.moveTo(firstX, height - padBottom);
      ctx.lineTo(firstX, firstY);

      for (let i = 1; i < pts.length; i++) {
        const x = (pts[i].timestamp / totalDuration) * width;
        const y = padTop + (1 - pts[i].normalized) * drawHeight;
        ctx.lineTo(x, y);
      }

      const lastX = (pts[pts.length - 1].timestamp / totalDuration) * width;
      ctx.lineTo(lastX, height - padBottom);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, padTop, 0, height);
      grad.addColorStop(0, glowColor);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Draw curve line
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = isMaster ? 2 : 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.moveTo(firstX, firstY);
      for (let i = 1; i < pts.length; i++) {
        const x = (pts[i].timestamp / totalDuration) * width;
        const y = padTop + (1 - pts[i].normalized) * drawHeight;
        ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Draw keyframe point nodes
      ctx.fillStyle = strokeColor;
      for (let i = 0; i < pts.length; i++) {
        const x = (pts[i].timestamp / totalDuration) * width;
        const y = padTop + (1 - pts[i].normalized) * drawHeight;
        ctx.beginPath();
        ctx.arc(x, y, isMaster ? 2 : 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Playhead line & marker
    if (totalDuration > 0) {
      const playheadX = (currentTimeMs / totalDuration) * width;

      // Glow beam
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.3)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Sharp line
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead top triangle handle
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(playheadX - 4, 0);
      ctx.lineTo(playheadX + 4, 0);
      ctx.lineTo(playheadX, 6);
      ctx.closePath();
      ctx.fill();
    }
  }, [buffer, currentTimeMs, durationMs, status]);

  const hasData = !!(buffer && buffer.points.length > 0);

  return (
    <div
      ref={containerRef}
      className="bg-[#0b0b0b] rounded-lg border border-[#222] p-2.5 shadow-md flex flex-col gap-2"
    >
      {/* Header & Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity
            size={12}
            className={
              status === 'recording'
                ? 'text-red-500 animate-pulse'
                : status === 'playing'
                ? 'text-emerald-400 animate-pulse'
                : 'text-amber-500'
            }
          />
          <span className="text-[10px] font-black tracking-wider text-gray-200">
            AUTOMATION LANE
          </span>

          {/* Status Badge */}
          <span
            className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-bold tracking-tight border ${
              status === 'recording'
                ? 'bg-red-950/80 text-red-300 border-red-500/80 animate-pulse'
                : status === 'playing'
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/80'
                : status === 'paused'
                ? 'bg-amber-950/80 text-amber-300 border-amber-600/80'
                : hasData
                ? 'bg-neutral-800 text-gray-300 border-neutral-700'
                : 'bg-black text-gray-600 border-neutral-800'
            }`}
          >
            {status.toUpperCase()}
          </span>
        </div>

        {/* Time Readout & Overview Button */}
        <div className="flex items-center gap-1 font-mono text-[9px] text-gray-400">
          {onOpenOverview && (
            <button
              onClick={onOpenOverview}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#181818] hover:bg-cyan-950/70 text-cyan-400 hover:text-cyan-300 border border-cyan-800/60 text-[8px] font-bold transition-all mr-0.5 shadow-sm active:scale-95"
              title="Open full Automation Overview modal (Recharts multi-channel timeline graphs)"
            >
              <TrendingUp size={9} />
              <span>GRAPH</span>
            </button>
          )}
          <span className={status === 'playing' ? 'text-emerald-400 font-bold' : 'text-gray-300'}>
            {formatTime(currentTimeMs)}
          </span>
          <span className="text-gray-600">/</span>
          <span>{formatTime(durationMs)}</span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-300 ml-1 transition-colors"
            title={isExpanded ? 'Collapse lane' : 'Expand lane'}
          >
            {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* Main Controls Toolbar */}
      <div className="grid grid-cols-5 gap-1.5 bg-[#141414] p-1.5 rounded border border-[#262626]">
        {/* 1. Record Button */}
        <button
          onClick={handleToggleRecord}
          className={`flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold tracking-wider transition-all skeuo-button active:scale-95 ${
            status === 'recording'
              ? 'bg-red-600 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.6)] animate-pulse'
              : 'bg-[#1a1a1a] hover:bg-[#252525] text-red-400 hover:text-red-300 border-[#333]'
          }`}
          title={status === 'recording' ? 'Stop recording fader movements' : 'Record fader gain movements into buffer'}
        >
          <Circle
            size={9}
            className={status === 'recording' ? 'fill-white text-white' : 'fill-red-500 text-red-500'}
          />
          <span>{status === 'recording' ? 'STOP' : 'REC'}</span>
        </button>

        {/* 2. Playback Button (Primary Request) */}
        <button
          onClick={handleTogglePlayback}
          className={`col-span-2 flex items-center justify-center gap-1.5 py-1 rounded text-[9px] font-black tracking-wider transition-all skeuo-button active:scale-95 ${
            status === 'playing'
              ? 'bg-emerald-600 text-white border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : hasData
              ? 'bg-gradient-to-r from-emerald-950 to-emerald-900 hover:from-emerald-900 hover:to-emerald-800 text-emerald-200 border-emerald-600/60 shadow-sm'
              : 'bg-[#1a1a1a] hover:bg-[#252525] text-emerald-400/70 border-[#333]'
          }`}
          title="Re-apply recorded fader movements automatically as an automation lane"
        >
          {status === 'playing' ? (
            <>
              <Pause size={10} className="fill-white" />
              <span>PAUSE</span>
            </>
          ) : (
            <>
              <Play size={10} className="fill-emerald-400 text-emerald-400" />
              <span>PLAYBACK</span>
            </>
          )}
        </button>

        {/* 3. Stop / Rewind */}
        <button
          onClick={handleStop}
          disabled={status === 'idle' && currentTimeMs === 0}
          className={`flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold border transition-all skeuo-button active:scale-95 ${
            status === 'idle' && currentTimeMs === 0
              ? 'bg-[#141414] text-gray-700 border-transparent cursor-not-allowed'
              : 'bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 hover:text-white border-[#333]'
          }`}
          title="Stop and rewind to beginning"
        >
          <Square size={8} className="fill-current" />
          <span>STOP</span>
        </button>

        {/* 4. Loop Toggle */}
        <button
          onClick={handleToggleLoop}
          className={`flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold border transition-all skeuo-button active:scale-95 ${
            isLooping
              ? 'bg-amber-950/80 text-amber-300 border-amber-600/70 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
              : 'bg-[#1a1a1a] hover:bg-[#252525] text-gray-400 hover:text-gray-200 border-[#333]'
          }`}
          title="Toggle automation looping"
        >
          <Repeat size={9} className={isLooping ? 'text-amber-400' : 'text-gray-500'} />
          <span>LOOP</span>
        </button>
      </div>

      {/* Expanded Timeline & Curve Visualizer */}
      {isExpanded && (
        <div className="space-y-1.5">
          {/* Interactive Automation Curve Canvas */}
          <div className="relative rounded overflow-hidden border border-[#222] bg-[#050505]">
            <canvas
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              className="w-full h-16 block cursor-crosshair select-none"
              title="Click or drag to scrub automation playhead position"
            />

            {/* Empty State Overlay */}
            {!hasData && status !== 'recording' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px] pointer-events-none">
                <span className="text-[8px] font-mono text-gray-400 tracking-tight">
                  Click <strong className="text-red-400">REC</strong> & move faders, or click{' '}
                  <strong className="text-cyan-400">DEMO</strong>
                </span>
              </div>
            )}
          </div>

          {/* Lane Tags & Actions Footer */}
          <div className="flex items-center justify-between text-[8px] text-gray-400 px-0.5">
            {/* Active Lanes Tags */}
            <div className="flex items-center gap-1 flex-wrap overflow-hidden">
              <Layers size={10} className="text-gray-500 shrink-0" />
              {lanes.length > 0 ? (
                lanes.map((l) => (
                  <span
                    key={l.targetId}
                    className="px-1.5 py-0.5 rounded bg-[#161616] border border-[#292929] flex items-center gap-1 font-mono"
                    title={`${l.label}: ${l.pointsCount} points`}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="text-gray-300 font-bold">{l.label}</span>
                    <span className="text-gray-500 text-[7px]">({l.pointsCount}p)</span>
                  </span>
                ))
              ) : (
                <span className="text-gray-600 font-mono italic">Buffer empty</span>
              )}
            </div>

            {/* Quick Helper Actions: Overview, Demo & Clear */}
            <div className="flex items-center gap-1 shrink-0">
              {onOpenOverview && (
                <button
                  onClick={onOpenOverview}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 hover:text-white border border-cyan-700/60 text-[8px] font-bold transition-colors"
                  title="Open Automation Overview with multi-channel Recharts line graphs"
                >
                  <TrendingUp size={8} />
                  <span>OVERVIEW</span>
                </button>
              )}
              <button
                onClick={handleLoadDemo}
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#161616] hover:bg-[#202020] text-cyan-400 hover:text-cyan-300 border border-cyan-900/50 text-[8px] font-bold transition-colors"
                title="Generate an instant multi-fader demo automation lane for testing"
              >
                <Sparkles size={8} />
                <span>DEMO</span>
              </button>

              {hasData && (
                <button
                  onClick={handleClear}
                  className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-[#161616] hover:bg-[#261515] text-gray-500 hover:text-red-400 border border-[#2a2a2a] text-[8px] transition-colors"
                  title="Clear temporary automation buffer"
                >
                  <Trash2 size={8} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationLane;
