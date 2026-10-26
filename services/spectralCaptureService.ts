/**
 * Spectral Capture Service
 * Captures real-time FFT frequency spectrum analysis frames over time from the Master AnalyserNode.
 * Allows time-series spectral capture, snapshot capture, playback scrubbing, and JSON/CSV export.
 */

export interface SpectralCaptureFrame {
  timeOffsetMs: number;
  peakFreq: number;
  peakDb: number;
  bands: {
    sub: number;
    bass: number;
    mid: number;
    high: number;
  };
  // 32-band discrete log spectrum normalized values (0-255)
  spectrumBands: number[];
}

export interface SpectralRecordingSession {
  id: string;
  name: string;
  timestamp: string;
  durationMs: number;
  totalFrames: number;
  sampleRate: number;
  fftSize: number;
  maxPeakFreq: number;
  maxPeakDb: number;
  avgBands: {
    sub: number;
    bass: number;
    mid: number;
    high: number;
  };
  frames: SpectralCaptureFrame[];
}

class SpectralCaptureService {
  private isRecording = false;
  private startTime = 0;
  private currentFrames: SpectralCaptureFrame[] = [];
  private lastSession: SpectralRecordingSession | null = null;
  private maxFrames = 4500; // ~3 minutes at 25 fps buffer
  private lastRecordedFrameTime = 0;
  private readonly MIN_FRAME_INTERVAL_MS = 38; // ~26 fps throttling to maintain smooth CPU performance

  public onRecordingStateChange: ((isRecording: boolean, count: number, durationMs: number) => void) | null = null;

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public getFramesCount(): number {
    return this.currentFrames.length;
  }

  public getCurrentDurationMs(): number {
    if (!this.isRecording) return 0;
    return performance.now() - this.startTime;
  }

  public getLastSession(): SpectralRecordingSession | null {
    return this.lastSession;
  }

  public startRecording(): void {
    this.isRecording = true;
    this.startTime = performance.now();
    this.currentFrames = [];
    this.lastRecordedFrameTime = 0;
    this.notifyState();
  }

  public stopRecording(sampleRate = 48000, fftSize = 2048): SpectralRecordingSession | null {
    if (!this.isRecording && this.currentFrames.length === 0) return this.lastSession;

    this.isRecording = false;
    const durationMs = Math.round(performance.now() - this.startTime);

    if (this.currentFrames.length === 0) {
      this.notifyState();
      return null;
    }

    // Calculate session aggregate metrics
    let maxPeakDb = -120;
    let maxPeakFreq = 0;
    let sumSub = 0, sumBass = 0, sumMid = 0, sumHigh = 0;

    this.currentFrames.forEach(f => {
      if (f.peakDb > maxPeakDb) {
        maxPeakDb = f.peakDb;
        maxPeakFreq = f.peakFreq;
      }
      sumSub += f.bands.sub;
      sumBass += f.bands.bass;
      sumMid += f.bands.mid;
      sumHigh += f.bands.high;
    });

    const frameCount = this.currentFrames.length;

    const session: SpectralRecordingSession = {
      id: `spec_session_${Date.now()}`,
      name: `Spectral Capture ${new Date().toLocaleTimeString()}`,
      timestamp: new Date().toISOString(),
      durationMs,
      totalFrames: frameCount,
      sampleRate,
      fftSize,
      maxPeakFreq,
      maxPeakDb: Math.round(maxPeakDb * 10) / 10,
      avgBands: {
        sub: Math.round(sumSub / frameCount),
        bass: Math.round(sumBass / frameCount),
        mid: Math.round(sumMid / frameCount),
        high: Math.round(sumHigh / frameCount),
      },
      frames: [...this.currentFrames]
    };

    this.lastSession = session;
    this.notifyState();
    return session;
  }

  public recordFrame(
    peakFreq: number,
    peakDb: number,
    bands: { sub: number; bass: number; mid: number; high: number },
    spectrumBands: number[]
  ): void {
    if (!this.isRecording) return;

    const now = performance.now();
    if (now - this.lastRecordedFrameTime < this.MIN_FRAME_INTERVAL_MS) {
      return;
    }
    this.lastRecordedFrameTime = now;

    if (this.currentFrames.length >= this.maxFrames) {
      this.stopRecording();
      return;
    }

    const timeOffsetMs = Math.round(now - this.startTime);

    this.currentFrames.push({
      timeOffsetMs,
      peakFreq,
      peakDb,
      bands: { ...bands },
      spectrumBands: Array.from(spectrumBands)
    });

    if (this.currentFrames.length % 5 === 0) {
      this.notifyState();
    }
  }

  public clearSession(): void {
    this.isRecording = false;
    this.currentFrames = [];
    this.lastSession = null;
    this.notifyState();
  }

  public exportJson(sessionToExport?: SpectralRecordingSession): void {
    const session = sessionToExport || this.lastSession;
    if (!session || session.frames.length === 0) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadAnchor.setAttribute("download", `master_spectral_capture_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  public exportCsv(sessionToExport?: SpectralRecordingSession): void {
    const session = sessionToExport || this.lastSession;
    if (!session || session.frames.length === 0) return;

    // Header row
    const numBands = session.frames[0]?.spectrumBands.length || 32;
    const bandHeaders = Array.from({ length: numBands }, (_, i) => `Band_${i + 1}`).join(',');
    let csv = `TimeOffsetMs,PeakFreqHz,PeakDb,SubPercent,BassPercent,MidPercent,HighPercent,${bandHeaders}\n`;

    session.frames.forEach(f => {
      const bandsStr = f.spectrumBands.join(',');
      csv += `${f.timeOffsetMs},${f.peakFreq},${f.peakDb},${f.bands.sub},${f.bands.bass},${f.bands.mid},${f.bands.high},${bandsStr}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadAnchor.setAttribute("download", `master_spectral_capture_${dateStr}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  }

  private notifyState(): void {
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange(
        this.isRecording,
        this.currentFrames.length,
        this.isRecording ? performance.now() - this.startTime : (this.lastSession?.durationMs || 0)
      );
    }
  }
}

export const spectralCaptureService = new SpectralCaptureService();
