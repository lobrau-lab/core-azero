
export enum StripType {
  PHYSICAL = 'PHYSICAL',
  VIRTUAL = 'VIRTUAL'
}

export interface VstPluginConfig {
  enabled: boolean;
  pluginId: 'warm_drive' | 'fet_76' | 'aetherspace_reverb' | 'precision_eq' | 'ott_multiband';
  pluginName: string;
  presetName: string;
  dryWet: number; // 0 to 100
  inputGain: number; // -12 to +12 dB
  outputGain: number; // -12 to +12 dB
  parameters: Record<string, number | string | boolean>;
}

export interface ChannelSettings {
  id: number;
  name: string;
  type: StripType;
  deviceId?: string; // Hardware Device ID
  gain: number; // 0 to 2 (where 1 is 0dB)
  mute: boolean;
  solo: boolean;
  monitor: boolean; // Input Monitoring (Playback Response)
  pan: number; // -1 to 1
  eq: {
    low: number; // dB
    mid: number; // dB
    high: number; // dB
  };
  gate: {
    threshold: number;
    active: boolean;
  };
  compressor: {
    threshold: number;
    ratio: number;
    active: boolean;
  };
  routing: boolean[]; // 8 output busses
  vst?: VstPluginConfig;
}

export interface MasterSettings {
  reverb: number; // 0 to 1
  delay: number; // 0 to 1
  noiseReduction: number; // 0 to 1 (Frequency cutoff factor)
  aec: boolean; // Echo Cancellation
  masterGain: number;
  outputDeviceId?: string;
  smartMastering: boolean;
}

export interface AudioMeterData {
  rms: number;
  peak: number;
}

// Preset Interfaces
export interface ChannelStripPreset {
  id: string;
  name: string;
  category?: 'vocal' | 'instrument' | 'stream' | 'cleanup' | 'game' | 'custom';
  description?: string;
  isFactory?: boolean;
  createdAt?: number;
  settings: {
    name?: string;
    gain: number;
    mute: boolean;
    solo: boolean;
    monitor: boolean;
    pan: number;
    eq: {
      low: number;
      mid: number;
      high: number;
    };
    gate: {
      threshold: number;
      active: boolean;
    };
    compressor: {
      threshold: number;
      ratio: number;
      active: boolean;
    };
    routing?: boolean[];
    vst?: VstPluginConfig;
  };
}

export interface MasterBusPreset {
  id: string;
  name: string;
  description?: string;
  isFactory?: boolean;
  createdAt?: number;
  settings: MasterSettings;
}

export interface ConsolePreset {
  id: string;
  name: string;
  description?: string;
  isFactory?: boolean;
  createdAt?: number;
  channels: ChannelSettings[];
  master: MasterSettings;
}

// MIDI Mapping Types
export type MidiTargetType =
  | 'channel_gain'
  | 'channel_mute'
  | 'channel_solo'
  | 'channel_monitor'
  | 'master_gain'
  | 'master_smart_mastering'
  | 'master_aec';

export interface MidiTarget {
  id: string; // e.g. "ch_1_gain", "ch_2_mute", "master_gain"
  type: MidiTargetType;
  channelId?: number; // 1 to 8 if channel target
  label: string;
}

export type MidiMessageType = 'cc' | 'note' | 'pitchbend';

export interface MidiMapping {
  id: string;
  targetId: string;
  targetType: MidiTargetType;
  channelId?: number;
  midiChannel: number; // 1-16 (or 0 for Any/Omni)
  messageType: MidiMessageType;
  controlNumber: number; // CC number or Note number (0-127)
  invert?: boolean;
}

export interface MidiInputPortInfo {
  id: string;
  name: string;
  manufacturer?: string;
  state: string; // 'connected' | 'disconnected'
}

export interface MidiLogEntry {
  id: string;
  timestamp: number;
  channel: number;
  type: MidiMessageType;
  controlNumber: number;
  value: number;
  mappedTargetLabel?: string;
}

// Health Monitor Types
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  REPAIRING = 'REPAIRING'
}

export enum AudioErrorCode {
  DEVICE_LOST = 'DEVICE_LOST',
  STREAM_STALL = 'STREAM_STALL',
  SILENT_FAILURE = 'SILENT_FAILURE',
  SAMPLE_RATE_MISMATCH = 'SAMPLE_RATE_MISMATCH'
}

export interface HealthReport {
  status: HealthStatus;
  lastError?: AudioErrorCode;
  timestamp: number;
  message: string;
}

// Fader Automation Lane Types
export type AutomationTargetId = 'master' | `channel_${number}`;

export interface AutomationPoint {
  id: string;
  timestamp: number; // elapsed milliseconds from start of recording
  targetId: AutomationTargetId;
  channelId?: number; // 1-8 if channel, undefined if master
  value: number; // raw fader value: master (0..1.5), channel (0..1.2)
  normalized: number; // 0..1 normalized for display
}

export type AutomationStatus = 'idle' | 'recording' | 'playing' | 'paused';

export interface AutomationLaneInfo {
  targetId: AutomationTargetId;
  label: string;
  channelId?: number;
  color: string;
  pointsCount: number;
  currentValue: number;
}

export interface AutomationBuffer {
  id: string;
  recordedAt: number;
  duration: number; // total duration in milliseconds
  points: AutomationPoint[];
  initialValues: {
    masterGain: number;
    channelGains: Record<number, number>;
  };
}
