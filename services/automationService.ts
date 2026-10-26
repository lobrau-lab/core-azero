import {
  AutomationPoint,
  AutomationStatus,
  AutomationBuffer,
  AutomationTargetId,
  AutomationLaneInfo,
} from '../types';

export class AutomationService {
  private status: AutomationStatus = 'idle';
  private buffer: AutomationBuffer | null = null;
  private recordingStartTime = 0;
  private playbackStartTime = 0;
  private playbackOffsetMs = 0;
  private currentPlaybackTimeMs = 0;
  private animFrameId: number | null = null;
  private recordTimerId: number | null = null;
  private isLooping = false;

  // Listeners & Callbacks
  public onApplyFader: ((targetId: AutomationTargetId, value: number, channelId?: number) => void) | null = null;
  public onStateChange: ((status: AutomationStatus) => void) | null = null;
  public onTimeUpdate: ((currentTimeMs: number, durationMs: number) => void) | null = null;
  public onBufferChange: ((buffer: AutomationBuffer | null) => void) | null = null;

  constructor() {
    // Attempt to load from localStorage if persisted, or start fresh
    this.loadFromStorage();
  }

  public getStatus(): AutomationStatus {
    return this.status;
  }

  public getBuffer(): AutomationBuffer | null {
    return this.buffer;
  }

  public hasBuffer(): boolean {
    return !!(this.buffer && this.buffer.points.length > 0);
  }

  public getDuration(): number {
    return this.buffer?.duration || 0;
  }

  public getCurrentPlaybackTime(): number {
    return this.currentPlaybackTimeMs;
  }

  public isLoopEnabled(): boolean {
    return this.isLooping;
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  // --- RECORDING ---
  public startRecording(initialSnapshot: {
    masterGain: number;
    channels: { id: number; gain: number }[];
  }): void {
    if (this.status === 'playing') {
      this.stopPlayback();
    }

    this.recordingStartTime = performance.now();
    this.status = 'recording';

    const channelGains: Record<number, number> = {};
    const initialPoints: AutomationPoint[] = [];

    // Capture initial Master keyframe at t=0
    initialPoints.push({
      id: `pt_master_0`,
      timestamp: 0,
      targetId: 'master',
      value: initialSnapshot.masterGain,
      normalized: Math.min(1, Math.max(0, initialSnapshot.masterGain / 1.5)),
    });

    // Capture initial keyframes for each channel at t=0
    initialSnapshot.channels.forEach((ch) => {
      channelGains[ch.id] = ch.gain;
      initialPoints.push({
        id: `pt_ch_${ch.id}_0`,
        timestamp: 0,
        targetId: `channel_${ch.id}`,
        channelId: ch.id,
        value: ch.gain,
        normalized: Math.min(1, Math.max(0, ch.gain / 1.2)),
      });
    });

    this.buffer = {
      id: `auto_${Date.now()}`,
      recordedAt: Date.now(),
      duration: 100, // initialized, grows as recording progresses
      points: initialPoints,
      initialValues: {
        masterGain: initialSnapshot.masterGain,
        channelGains,
      },
    };

    this.currentPlaybackTimeMs = 0;
    this.notifyState();
    this.notifyBuffer();

    // Start timer to update recording elapsed time
    if (this.recordTimerId) clearInterval(this.recordTimerId);
    this.recordTimerId = window.setInterval(() => {
      if (this.status === 'recording' && this.buffer) {
        const elapsed = Math.max(0, performance.now() - this.recordingStartTime);
        this.buffer.duration = Math.max(this.buffer.duration, elapsed);
        this.notifyTime(elapsed, this.buffer.duration);
      }
    }, 50);
  }

  public recordFaderMove(target: 'master' | number, value: number): void {
    if (this.status !== 'recording' || !this.buffer) return;

    const elapsed = Math.max(0, performance.now() - this.recordingStartTime);
    const targetId: AutomationTargetId = target === 'master' ? 'master' : `channel_${target}`;
    const channelId = target === 'master' ? undefined : target;
    const maxRange = target === 'master' ? 1.5 : 1.2;
    const normalized = Math.min(1, Math.max(0, value / maxRange));

    // Avoid redundant duplicate points if within 15ms and same value
    const lastPoint = [...this.buffer.points]
      .reverse()
      .find((p) => p.targetId === targetId);

    if (lastPoint && Math.abs(elapsed - lastPoint.timestamp) < 15 && Math.abs(lastPoint.value - value) < 0.005) {
      return;
    }

    const newPoint: AutomationPoint = {
      id: `pt_${targetId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: elapsed,
      targetId,
      channelId,
      value: Math.round(value * 1000) / 1000,
      normalized: Math.round(normalized * 1000) / 1000,
    };

    this.buffer.points.push(newPoint);
    this.buffer.duration = Math.max(this.buffer.duration, elapsed);
    this.notifyBuffer();
    this.notifyTime(elapsed, this.buffer.duration);
  }

  public stopRecording(): AutomationBuffer | null {
    if (this.status !== 'recording') return this.buffer;

    if (this.recordTimerId) {
      clearInterval(this.recordTimerId);
      this.recordTimerId = null;
    }

    if (this.buffer) {
      const elapsed = Math.max(0, performance.now() - this.recordingStartTime);
      this.buffer.duration = Math.max(this.buffer.duration, elapsed, 1000);
      // Sort points chronologically
      this.buffer.points.sort((a, b) => a.timestamp - b.timestamp);
      this.saveToStorage();
    }

    this.status = 'idle';
    this.currentPlaybackTimeMs = 0;
    this.notifyState();
    this.notifyBuffer();
    this.notifyTime(0, this.buffer?.duration || 0);

    return this.buffer;
  }

  // --- PLAYBACK ---
  public startPlayback(options: { loop?: boolean; fromStart?: boolean } = {}): boolean {
    if (!this.buffer || this.buffer.points.length === 0) {
      return false;
    }

    if (this.status === 'recording') {
      this.stopRecording();
    }

    if (options.loop !== undefined) {
      this.isLooping = options.loop;
    }

    if (options.fromStart || this.currentPlaybackTimeMs >= this.buffer.duration) {
      this.currentPlaybackTimeMs = 0;
      this.playbackOffsetMs = 0;
    } else {
      this.playbackOffsetMs = this.currentPlaybackTimeMs;
    }

    this.playbackStartTime = performance.now();
    this.status = 'playing';
    this.notifyState();

    this.runPlaybackLoop();
    return true;
  }

  public pausePlayback(): void {
    if (this.status !== 'playing') return;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.status = 'paused';
    this.notifyState();
  }

  public stopPlayback(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.status = 'idle';
    this.currentPlaybackTimeMs = 0;
    this.playbackOffsetMs = 0;

    // Apply values at t=0
    if (this.buffer) {
      this.applyInterpolatedValuesAt(0);
    }

    this.notifyState();
    this.notifyTime(0, this.buffer?.duration || 0);
  }

  public togglePlayback(): void {
    if (this.status === 'playing') {
      this.pausePlayback();
    } else {
      this.startPlayback({ loop: this.isLooping });
    }
  }

  public seek(timeMs: number): void {
    if (!this.buffer) return;
    const clamped = Math.max(0, Math.min(this.buffer.duration, timeMs));
    this.currentPlaybackTimeMs = clamped;
    this.playbackOffsetMs = clamped;
    this.playbackStartTime = performance.now();

    this.applyInterpolatedValuesAt(clamped);
    this.notifyTime(clamped, this.buffer.duration);
  }

  private runPlaybackLoop = (): void => {
    if (this.status !== 'playing' || !this.buffer) return;

    const now = performance.now();
    const elapsedSinceStart = now - this.playbackStartTime;
    let targetTime = this.playbackOffsetMs + elapsedSinceStart;

    if (targetTime >= this.buffer.duration) {
      if (this.isLooping && this.buffer.duration > 0) {
        // Loop back
        this.playbackStartTime = now;
        this.playbackOffsetMs = 0;
        targetTime = targetTime % this.buffer.duration;
      } else {
        // Reached end of automation lane
        targetTime = this.buffer.duration;
        this.currentPlaybackTimeMs = targetTime;
        this.applyInterpolatedValuesAt(targetTime);
        this.notifyTime(targetTime, this.buffer.duration);
        this.stopPlayback();
        return;
      }
    }

    this.currentPlaybackTimeMs = targetTime;
    this.applyInterpolatedValuesAt(targetTime);
    this.notifyTime(targetTime, this.buffer.duration);

    this.animFrameId = requestAnimationFrame(this.runPlaybackLoop);
  };

  /**
   * Evaluates each recorded target's automation curve at time t and dispatches fader updates
   */
  public applyInterpolatedValuesAt(timeMs: number): void {
    if (!this.buffer || !this.onApplyFader) return;

    // Group points by targetId
    const pointsByTarget: Record<AutomationTargetId, AutomationPoint[]> = {} as any;
    for (const pt of this.buffer.points) {
      if (!pointsByTarget[pt.targetId]) {
        pointsByTarget[pt.targetId] = [];
      }
      pointsByTarget[pt.targetId].push(pt);
    }

    // For each target, interpolate value at timeMs
    for (const [targetKey, pts] of Object.entries(pointsByTarget)) {
      const targetId = targetKey as AutomationTargetId;
      if (pts.length === 0) continue;

      let value = pts[0].value;
      const channelId = pts[0].channelId;

      if (timeMs <= pts[0].timestamp) {
        value = pts[0].value;
      } else if (timeMs >= pts[pts.length - 1].timestamp) {
        value = pts[pts.length - 1].value;
      } else {
        // Binary search or linear search for adjacent keyframes
        let i = 0;
        while (i < pts.length - 1 && pts[i + 1].timestamp <= timeMs) {
          i++;
        }
        const p1 = pts[i];
        const p2 = pts[i + 1];

        if (p2 && p2.timestamp > p1.timestamp) {
          const ratio = (timeMs - p1.timestamp) / (p2.timestamp - p1.timestamp);
          // Smooth Hermite / linear interpolation
          value = p1.value + ratio * (p2.value - p1.value);
        } else {
          value = p1.value;
        }
      }

      this.onApplyFader(targetId, Math.round(value * 1000) / 1000, channelId);
    }
  }

  /**
   * Returns the interpolated fader value for a specific target at timeMs
   */
  public getInterpolatedValue(timeMs: number, targetId: AutomationTargetId): number | null {
    if (!this.buffer || this.buffer.points.length === 0) return null;

    const targetPoints = this.buffer.points.filter((p) => p.targetId === targetId);
    if (targetPoints.length === 0) return null;

    if (timeMs <= targetPoints[0].timestamp) {
      return targetPoints[0].value;
    }
    if (timeMs >= targetPoints[targetPoints.length - 1].timestamp) {
      return targetPoints[targetPoints.length - 1].value;
    }

    let i = 0;
    while (i < targetPoints.length - 1 && targetPoints[i + 1].timestamp <= timeMs) {
      i++;
    }
    const p1 = targetPoints[i];
    const p2 = targetPoints[i + 1];

    if (p2 && p2.timestamp > p1.timestamp) {
      const ratio = (timeMs - p1.timestamp) / (p2.timestamp - p1.timestamp);
      return Math.round((p1.value + ratio * (p2.value - p1.value)) * 1000) / 1000;
    }
    return p1.value;
  }

  /**
   * Builds an aggregated timeline series for Recharts line graphs.
   * Generates time samples ensuring all recorded keyframe timestamps are captured.
   */
  public getTimelineData(minSamples = 80): Array<{
    timeMs: number;
    timeSec: number;
    formattedTime: string;
    [key: string]: number | string | undefined;
  }> {
    if (!this.buffer || this.buffer.points.length === 0) return [];

    const duration = Math.max(this.buffer.duration, 500);

    // Collect all exact keyframe timestamps
    const timestampSet = new Set<number>();
    timestampSet.add(0);
    timestampSet.add(duration);

    for (const pt of this.buffer.points) {
      timestampSet.add(Math.round(pt.timestamp));
    }

    // Add regular intervals to ensure smooth curve between sparse keyframes
    const step = Math.max(25, duration / minSamples);
    for (let t = 0; t <= duration; t += step) {
      timestampSet.add(Math.round(t));
    }

    const sortedTimes = Array.from(timestampSet).sort((a, b) => a - b);

    // Identify all unique targets present in buffer
    const targets = Array.from(new Set(this.buffer.points.map((p) => p.targetId)));

    return sortedTimes.map((t) => {
      const sec = Math.round((t / 1000) * 100) / 100;
      const minutes = Math.floor(t / 60000);
      const seconds = Math.floor((t % 60000) / 1000);
      const ms = Math.floor((t % 1000) / 100);
      const formattedTime = `${minutes > 0 ? `${minutes}:` : ''}${seconds.toString().padStart(minutes > 0 ? 2 : 1, '0')}.${ms}s`;

      const row: Record<string, number | string | undefined> = {
        timeMs: t,
        timeSec: sec,
        formattedTime,
      };

      for (const targetId of targets) {
        const val = this.getInterpolatedValue(t, targetId);
        if (val !== null) {
          row[targetId] = val;
        }
      }

      return row as {
        timeMs: number;
        timeSec: number;
        formattedTime: string;
        [key: string]: number | string | undefined;
      };
    });
  }

  // --- BUFFER CLEAR & DEMO AUTOMATION ---
  public clearBuffer(): void {
    if (this.status === 'playing') this.stopPlayback();
    if (this.status === 'recording') this.stopRecording();

    this.buffer = null;
    this.currentPlaybackTimeMs = 0;
    this.playbackOffsetMs = 0;
    localStorage.removeItem('omni_automation_buffer');
    this.notifyBuffer();
    this.notifyState();
    this.notifyTime(0, 0);
  }

  /**
   * Generates a musical 8-second demo automation curve with master swells and channel fader moves
   */
  public generateDemoAutomation(currentMasterGain = 0.8): AutomationBuffer {
    if (this.status === 'playing') this.stopPlayback();
    if (this.status === 'recording') this.stopRecording();

    const duration = 8000; // 8 seconds
    const points: AutomationPoint[] = [];

    // Master fader swell (0.8 -> 0.4 -> 1.1 -> 0.6 -> 0.8)
    const masterWaypoints = [
      { t: 0, v: currentMasterGain },
      { t: 1500, v: Math.max(0.3, currentMasterGain * 0.6) },
      { t: 3000, v: Math.min(1.4, currentMasterGain * 1.3) },
      { t: 4500, v: Math.max(0.4, currentMasterGain * 0.75) },
      { t: 6000, v: Math.min(1.3, currentMasterGain * 1.15) },
      { t: 8000, v: currentMasterGain },
    ];

    masterWaypoints.forEach((wp, idx) => {
      points.push({
        id: `demo_master_${idx}`,
        timestamp: wp.t,
        targetId: 'master',
        value: Math.round(wp.v * 100) / 100,
        normalized: Math.min(1, Math.max(0, wp.v / 1.5)),
      });
    });

    // Channel 1 rhythm fader ride
    const ch1Waypoints = [
      { t: 0, v: 0.9 },
      { t: 2000, v: 1.1 },
      { t: 4000, v: 0.5 },
      { t: 6000, v: 1.0 },
      { t: 8000, v: 0.9 },
    ];
    ch1Waypoints.forEach((wp, idx) => {
      points.push({
        id: `demo_ch1_${idx}`,
        timestamp: wp.t,
        targetId: 'channel_1',
        channelId: 1,
        value: wp.v,
        normalized: wp.v / 1.2,
      });
    });

    // Channel 5 (Music playback) volume automation
    const ch5Waypoints = [
      { t: 0, v: 1.0 },
      { t: 1800, v: 0.7 },
      { t: 3600, v: 1.15 },
      { t: 5400, v: 0.8 },
      { t: 8000, v: 1.0 },
    ];
    ch5Waypoints.forEach((wp, idx) => {
      points.push({
        id: `demo_ch5_${idx}`,
        timestamp: wp.t,
        targetId: 'channel_5',
        channelId: 5,
        value: wp.v,
        normalized: wp.v / 1.2,
      });
    });

    points.sort((a, b) => a.timestamp - b.timestamp);

    this.buffer = {
      id: `demo_auto_${Date.now()}`,
      recordedAt: Date.now(),
      duration,
      points,
      initialValues: {
        masterGain: currentMasterGain,
        channelGains: { 1: 0.9, 5: 1.0 },
      },
    };

    this.saveToStorage();
    this.notifyBuffer();
    this.notifyState();
    this.notifyTime(0, duration);
    return this.buffer;
  }

  // --- INSPECTION & LANE META ---
  public getLanes(): AutomationLaneInfo[] {
    if (!this.buffer || this.buffer.points.length === 0) return [];

    const map = new Map<AutomationTargetId, { count: number; channelId?: number; lastVal: number }>();

    for (const pt of this.buffer.points) {
      const existing = map.get(pt.targetId) || { count: 0, channelId: pt.channelId, lastVal: pt.value };
      existing.count += 1;
      existing.lastVal = pt.value;
      if (pt.channelId) existing.channelId = pt.channelId;
      map.set(pt.targetId, existing);
    }

    const lanes: AutomationLaneInfo[] = [];
    const colors = ['#f59e0b', '#38bdf8', '#a855f7', '#34d399', '#f43f5e', '#60a5fa'];
    let colorIdx = 0;

    map.forEach((data, targetId) => {
      lanes.push({
        targetId,
        label: targetId === 'master' ? 'MASTER FADER' : `CH ${data.channelId || '?'} GAIN`,
        channelId: data.channelId,
        color: targetId === 'master' ? '#f59e0b' : colors[(colorIdx++) % colors.length],
        pointsCount: data.count,
        currentValue: data.lastVal,
      });
    });

    return lanes;
  }

  // --- STORAGE ---
  private saveToStorage(): void {
    if (!this.buffer) return;
    try {
      localStorage.setItem('omni_automation_buffer', JSON.stringify(this.buffer));
    } catch {
      // quota or private browsing
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem('omni_automation_buffer');
      if (raw) {
        this.buffer = JSON.parse(raw);
      }
    } catch {
      this.buffer = null;
    }
  }

  // --- NOTIFIERS ---
  private notifyState(): void {
    this.onStateChange?.(this.status);
  }

  private notifyBuffer(): void {
    this.onBufferChange?.(this.buffer);
  }

  private notifyTime(currentTime: number, duration: number): void {
    this.onTimeUpdate?.(currentTime, duration);
  }
}

export const automationService = new AutomationService();
