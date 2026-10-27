import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { audioHealthMonitor } from './AudioHealthMonitor';
import { audioEngine } from './audioEngine';
import { AudioErrorCode, HealthStatus, StripType, ChannelSettings } from '../types';

// Mock audioEngine
vi.mock('./audioEngine', () => ({
  audioEngine: {
    getContextTime: vi.fn(),
    getContextState: vi.fn(),
    getMeter: vi.fn(),
    tryResumeContext: vi.fn(),
    switchChannelToDefault: vi.fn(),
    onNeedsHealing: vi.fn(),
  },
}));

describe('AudioHealthMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    audioHealthMonitor.onHealthUpdate = vi.fn();

    // Default mocks
    vi.mocked(audioEngine.getContextTime).mockReturnValue(0);
    vi.mocked(audioEngine.getContextState).mockReturnValue('running');
    vi.mocked(audioEngine.getMeter).mockReturnValue({ rms: -40, peak: -40 });

    // Mock navigator.mediaDevices.enumerateDevices
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockResolvedValue([]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    audioHealthMonitor.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const createChannel = (id: number, type: StripType, deviceId?: string): ChannelSettings => ({
    id,
    name: `Channel ${id}`,
    type,
    deviceId,
    gain: 1,
    mute: false,
    solo: false,
    monitor: false,
    pan: 0,
    eq: { low: 0, mid: 0, high: 0 },
    gate: { threshold: -80, active: false },
    compressor: { threshold: -20, ratio: 4, active: false },
    routing: Array(8).fill(false),
  });

  it('should report HEALTHY on normal operation', async () => {
    const channels = [createChannel(1, StripType.VIRTUAL)];
    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);

    // Advance time and mock context time advancing
    vi.mocked(audioEngine.getContextTime).mockReturnValue(1);
    await vi.advanceTimersByTimeAsync(1000);

    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HealthStatus.HEALTHY,
        message: "System Nominal"
      })
    );
  });

  it('should report STREAM_STALL if context is closed', async () => {
    vi.mocked(audioEngine.getContextState).mockReturnValue('closed');
    const channels = [createChannel(1, StripType.VIRTUAL)];

    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HealthStatus.WARNING,
        lastError: AudioErrorCode.STREAM_STALL,
        message: "Audio Context is offline."
      })
    );
  });

  it('should trigger Protocol C (tryResumeContext) if context time stalls for 3 checks', async () => {
    vi.mocked(audioEngine.getContextState).mockReturnValue('running');
    // Keep context time at 0
    vi.mocked(audioEngine.getContextTime).mockReturnValue(0);

    const channels = [createChannel(1, StripType.VIRTUAL)];
    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);

    // Check 1 - same time
    await vi.advanceTimersByTimeAsync(1000);
    expect(audioEngine.tryResumeContext).not.toHaveBeenCalled();

    // Check 2 - same time
    await vi.advanceTimersByTimeAsync(1000);
    expect(audioEngine.tryResumeContext).not.toHaveBeenCalled();

    // Check 3 - same time -> STALL_THRESHOLD_COUNT reached
    await vi.advanceTimersByTimeAsync(1000);

    expect(audioEngine.tryResumeContext).toHaveBeenCalled();
    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HealthStatus.WARNING,
        lastError: AudioErrorCode.STREAM_STALL,
        message: "Audio stream stalled."
      })
    );
  });

  it('should trigger Protocol A if a physical device is disconnected', async () => {
    const deviceId = 'test-mic-123';
    const channels = [createChannel(1, StripType.PHYSICAL, deviceId)];

    // Initially devices connected
    vi.mocked(global.navigator.mediaDevices.enumerateDevices).mockResolvedValue([
      { deviceId, kind: 'audioinput', label: 'Test Mic', groupId: 'group1' } as MediaDeviceInfo
    ]);

    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(audioEngine.getContextTime).mockReturnValue(1);
    await vi.advanceTimersByTimeAsync(1000);

    // Still connected, should be HEALTHY
    expect(audioEngine.switchChannelToDefault).not.toHaveBeenCalled();

    // Now disconnect it
    vi.mocked(global.navigator.mediaDevices.enumerateDevices).mockResolvedValue([]);
    const listenerCall = vi.mocked(global.navigator.mediaDevices.addEventListener).mock.calls.find(c => c[0] === 'devicechange');
    if (listenerCall) {
        await (listenerCall[1] as EventListener)(new Event('devicechange'));
    }
    vi.mocked(audioEngine.getContextTime).mockReturnValue(2);
    await vi.advanceTimersByTimeAsync(1000);

    expect(audioEngine.switchChannelToDefault).toHaveBeenCalledWith(1);
    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HealthStatus.WARNING,
        lastError: AudioErrorCode.DEVICE_LOST,
        message: `Physical device ${deviceId} disconnected.`
      })
    );
  });

  it('should trigger Sonic Attack Detection if meter returns NaN', async () => {
    const channels = [createChannel(1, StripType.VIRTUAL, 'virtual-mic')];
    vi.mocked(audioEngine.getMeter).mockReturnValue({ rms: NaN, peak: NaN });

    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);
    vi.mocked(audioEngine.getContextTime).mockReturnValue(1);
    await vi.advanceTimersByTimeAsync(1000);

    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: HealthStatus.WARNING,
        lastError: AudioErrorCode.STREAM_STALL,
        message: "NaN detected on Ch 1. Possible sonic attack."
      })
    );
    expect(audioEngine.onNeedsHealing).toHaveBeenCalledWith("Corrupt Audio Stream (NaN)");
  });

  it('should stop periodic checks when stop() is called', async () => {
    const channels = [createChannel(1, StripType.VIRTUAL)];
    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);

    vi.mocked(audioEngine.getContextTime).mockReturnValue(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledTimes(1);

    audioHealthMonitor.stop();

    vi.mocked(audioEngine.getContextTime).mockReturnValue(2);
    await vi.advanceTimersByTimeAsync(1000);

    // Shouldn't be called again
    expect(audioHealthMonitor.onHealthUpdate).toHaveBeenCalledTimes(1);
  });

  it('should try resume context immediately if context is suspended but time has not advanced', async () => {
    vi.mocked(audioEngine.getContextState).mockReturnValue('suspended');
    vi.mocked(audioEngine.getContextTime).mockReturnValue(0);

    const channels = [createChannel(1, StripType.VIRTUAL)];
    audioHealthMonitor.start(channels);
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(1000);
    expect(audioEngine.tryResumeContext).toHaveBeenCalled();
  });
});
