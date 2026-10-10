import { ChannelSettings, MasterSettings, StripType, ConsolePreset, ChannelStripPreset, MasterBusPreset } from '../types';
import { TOTAL_INPUTS } from '../constants';

const STORAGE_KEY_CONSOLE = 'core_azero_console_presets';
const STORAGE_KEY_CHANNEL = 'core_azero_channel_presets';
const STORAGE_KEY_MASTER = 'core_azero_master_presets';
const STORAGE_KEY_ACTIVE_PRESET = 'core_azero_active_preset_id';

// Base helper to build full 8 channels
const createChannelConfig = (overrides: Partial<ChannelSettings>[]): ChannelSettings[] => {
  return Array.from({ length: TOTAL_INPUTS }, (_, i) => {
    const isPhysical = i < 5;
    const defaultCh: ChannelSettings = {
      id: i + 1,
      name: isPhysical ? `MIC ${i + 1}` : `V-AUX ${i - 4}`,
      type: isPhysical ? StripType.PHYSICAL : StripType.VIRTUAL,
      gain: 1,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { low: 0, mid: 0, high: 0 },
      gate: { threshold: -60, active: false },
      compressor: { threshold: -20, ratio: 1, active: false },
      routing: [],
    };

    const override = overrides[i] || {};
    return {
      ...defaultCh,
      ...override,
      eq: { ...defaultCh.eq, ...(override.eq || {}) },
      gate: { ...defaultCh.gate, ...(override.gate || {}) },
      compressor: { ...defaultCh.compressor, ...(override.compressor || {}) },
    };
  });
};

// ---------------- FACTORY PRESETS ---------------- //

export const FACTORY_CONSOLE_PRESETS: ConsolePreset[] = [
  {
    id: 'factory-console-broadcast',
    name: 'Broadcast & Live Stream Pro',
    description: 'Optimized for high-clarity voice streaming, sound alerts, game balance, and punchy master limiting.',
    isFactory: true,
    channels: createChannelConfig([
      // CH 1: Main Host Mic
      {
        name: 'HOST MIC',
        gain: 1.05,
        eq: { high: 2.5, mid: 0.5, low: -1.5 },
        gate: { active: true, threshold: -46 },
        compressor: { active: true, threshold: -22, ratio: 3.5 },
      },
      // CH 2: Co-Host / Guest
      {
        name: 'CO-HOST',
        gain: 1.0,
        eq: { high: 2.0, mid: 0.0, low: -1.0 },
        gate: { active: true, threshold: -48 },
        compressor: { active: true, threshold: -20, ratio: 3.0 },
      },
      // CH 3: Soundboard / SFX
      {
        name: 'SFX / CLIPS',
        gain: 0.85,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -16, ratio: 2.0 },
      },
      // CH 4: Comms / Discord
      {
        name: 'DISCORD',
        gain: 0.9,
        eq: { high: 1.5, mid: 1.0, low: -2.0 },
        gate: { active: true, threshold: -50 },
        compressor: { active: true, threshold: -18, ratio: 2.5 },
      },
      // CH 5: Desktop Audio
      {
        name: 'DESKTOP',
        gain: 0.88,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      // CH 6: BGM / Music
      {
        name: 'MUSIC BGM',
        gain: 0.65,
        eq: { high: -1.0, mid: -1.5, low: 0.5 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -14, ratio: 1.8 },
      },
      // CH 7: Game Audio
      {
        name: 'GAME SOUND',
        gain: 0.8,
        eq: { high: 2.0, mid: -1.0, low: 1.5 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -15, ratio: 2.2 },
      },
      // CH 8: Aux / Backup
      {
        name: 'AUX IN',
        gain: 0.9,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
    ]),
    master: {
      reverb: 0.04,
      delay: 0,
      noiseReduction: 0.1,
      aec: false,
      masterGain: 0.92,
      smartMastering: true,
    },
  },
  {
    id: 'factory-console-vrchat',
    name: 'VRChat & Metaverse Anti-Glitch',
    description: 'Hardened anti-sonic defense, DC blocking, echo cancellation, fast vocal gate to block background noise.',
    isFactory: true,
    channels: createChannelConfig([
      {
        name: 'VR HEADSET',
        gain: 1.1,
        eq: { high: 3.0, mid: 1.0, low: -3.0 },
        gate: { active: true, threshold: -42 },
        compressor: { active: true, threshold: -24, ratio: 4.0 },
      },
      {
        name: 'VR AVATAR',
        gain: 0.95,
        eq: { high: 1.0, mid: 0, low: 0 },
        gate: { active: true, threshold: -50 },
        compressor: { active: true, threshold: -18, ratio: 2.0 },
      },
      {
        name: 'SOUNDPAD',
        gain: 0.75,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -15, ratio: 2.5 },
      },
      {
        name: 'STREAM MIC',
        gain: 1.0,
        eq: { high: 2.0, mid: 0.5, low: -2.0 },
        gate: { active: true, threshold: -45 },
        compressor: { active: true, threshold: -20, ratio: 3.0 },
      },
      {
        name: 'VRC AUDIO',
        gain: 0.85,
        eq: { high: 0.5, mid: 0, low: 1.0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      {
        name: 'SPOTIFY',
        gain: 0.6,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      {
        name: 'DISCORD VR',
        gain: 0.85,
        eq: { high: 1.0, mid: 0.5, low: -1.0 },
        gate: { active: true, threshold: -48 },
        compressor: { active: true, threshold: -18, ratio: 2.5 },
      },
      {
        name: 'MEDIA VIRT',
        gain: 0.7,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
    ]),
    master: {
      reverb: 0.02,
      delay: 0,
      noiseReduction: 0.25,
      aec: true,
      masterGain: 0.85,
      smartMastering: true,
    },
  },
  {
    id: 'factory-console-music',
    name: 'Music Studio & Master Bus',
    description: 'Audiophile tracking profile with studio reverb, analog delay depth, and transparent dynamic mastering.',
    isFactory: true,
    channels: createChannelConfig([
      {
        name: 'VOCAL LEAD',
        gain: 1.0,
        eq: { high: 3.5, mid: -0.5, low: -1.0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -18, ratio: 2.5 },
      },
      {
        name: 'VOCAL DBL',
        gain: 0.8,
        pan: -0.25,
        eq: { high: 2.0, mid: -1.0, low: -2.0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -20, ratio: 3.0 },
      },
      {
        name: 'ACOUSTIC',
        gain: 0.9,
        pan: 0.25,
        eq: { high: 3.0, mid: -1.5, low: 1.0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -16, ratio: 2.0 },
      },
      {
        name: 'KEYS / SYNTH',
        gain: 0.85,
        eq: { high: 1.0, mid: 0, low: 1.0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      {
        name: 'DAW PLAYBACK',
        gain: 1.0,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      {
        name: 'REF TRACK',
        gain: 0.9,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      {
        name: 'DRUM BUS',
        gain: 0.85,
        eq: { high: 1.5, mid: -2.0, low: 2.5 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -14, ratio: 3.5 },
      },
      {
        name: 'RETURN FX',
        gain: 0.75,
        eq: { high: 1.0, mid: 0, low: -1.0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
    ]),
    master: {
      reverb: 0.18,
      delay: 0.12,
      noiseReduction: 0.0,
      aec: false,
      masterGain: 0.88,
      smartMastering: true,
    },
  },
  {
    id: 'factory-console-podcast',
    name: 'Podcast Roundtable 4-Mic',
    description: 'Multi-microphone isolation setup with calibrated gates to stop cross-bleed and normalize dialogue.',
    isFactory: true,
    channels: createChannelConfig([
      {
        name: 'HOST 1',
        gain: 1.0,
        eq: { high: 2.0, mid: 0.5, low: -1.0 },
        gate: { active: true, threshold: -44 },
        compressor: { active: true, threshold: -22, ratio: 4.0 },
      },
      {
        name: 'GUEST 1',
        gain: 1.0,
        eq: { high: 2.0, mid: 0.5, low: -1.0 },
        gate: { active: true, threshold: -44 },
        compressor: { active: true, threshold: -22, ratio: 4.0 },
      },
      {
        name: 'GUEST 2',
        gain: 1.0,
        eq: { high: 1.5, mid: 0.0, low: -1.5 },
        gate: { active: true, threshold: -44 },
        compressor: { active: true, threshold: -22, ratio: 4.0 },
      },
      {
        name: 'GUEST 3',
        gain: 1.0,
        eq: { high: 1.5, mid: 0.0, low: -1.5 },
        gate: { active: true, threshold: -44 },
        compressor: { active: true, threshold: -22, ratio: 4.0 },
      },
      {
        name: 'CALLER VIRT',
        gain: 0.95,
        eq: { high: 2.5, mid: 1.0, low: -2.5 },
        gate: { active: true, threshold: -48 },
        compressor: { active: true, threshold: -20, ratio: 3.0 },
      },
      {
        name: 'INTRO / JINGLE',
        gain: 0.75,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: true, threshold: -16, ratio: 2.0 },
      },
      {
        name: 'BED MUSIC',
        gain: 0.5,
        eq: { high: -2.0, mid: -2.0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
      {
        name: 'AUX CH',
        gain: 0.8,
        eq: { high: 0, mid: 0, low: 0 },
        gate: { active: false, threshold: -60 },
        compressor: { active: false, threshold: -20, ratio: 1 },
      },
    ]),
    master: {
      reverb: 0.01,
      delay: 0,
      noiseReduction: 0.15,
      aec: false,
      masterGain: 0.92,
      smartMastering: true,
    },
  },
  {
    id: 'factory-console-clean',
    name: 'Clean Unity / Zero FX Direct',
    description: 'Flat 0dB unity gain on all channels, DSP bypassed, pure transparent bit-accurate routing.',
    isFactory: true,
    channels: createChannelConfig([]),
    master: {
      reverb: 0,
      delay: 0,
      noiseReduction: 0,
      aec: false,
      masterGain: 0.8,
      smartMastering: false,
    },
  },
];

export const FACTORY_CHANNEL_PRESETS: ChannelStripPreset[] = [
  {
    id: 'ch-preset-sm7b',
    name: 'Shure SM7B Broadcast Voice',
    category: 'vocal',
    description: 'High air boost (+3dB), tight low cut, active gate at -48dB, and 3.5:1 optical voice compression.',
    isFactory: true,
    settings: {
      gain: 1.1,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 3.5, mid: 0.5, low: -2.0 },
      gate: { threshold: -48, active: true },
      compressor: { threshold: -22, ratio: 3.5, active: true },
    },
  },
  {
    id: 'ch-preset-condenser',
    name: 'Condenser Mic Studio Air',
    category: 'vocal',
    description: 'Smooth silk top end, gentle warm mids, soft threshold gate, and natural 2.5:1 compression.',
    isFactory: true,
    settings: {
      gain: 0.95,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 2.5, mid: 0.0, low: -1.0 },
      gate: { threshold: -52, active: true },
      compressor: { threshold: -20, ratio: 2.5, active: true },
    },
  },
  {
    id: 'ch-preset-noisy-room',
    name: 'Aggressive Noise Suppression Mic',
    category: 'cleanup',
    description: 'Aggressive gate (-38dB) to silence loud keyboard clicks, fans, or PC noise between words.',
    isFactory: true,
    settings: {
      gain: 1.05,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 1.0, mid: 0.5, low: -4.0 },
      gate: { threshold: -38, active: true },
      compressor: { threshold: -24, ratio: 4.0, active: true },
    },
  },
  {
    id: 'ch-preset-radio-announcer',
    name: 'Radio DJ FM Presence',
    category: 'vocal',
    description: 'Heavy low-end warmth (+4dB), crisp top end (+3dB), punchy 5:1 radio compressor.',
    isFactory: true,
    settings: {
      gain: 1.0,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 3.0, mid: 1.5, low: 4.0 },
      gate: { threshold: -45, active: true },
      compressor: { threshold: -25, ratio: 5.0, active: true },
    },
  },
  {
    id: 'ch-preset-acoustic',
    name: 'Acoustic Guitar / String Instrument',
    category: 'instrument',
    description: 'Spacious high end (+3dB), slight mid scoop (-1.5dB), body warmth (+1.5dB), no gate.',
    isFactory: true,
    settings: {
      gain: 0.9,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 3.0, mid: -1.5, low: 1.5 },
      gate: { threshold: -60, active: false },
      compressor: { threshold: -16, ratio: 2.0, active: true },
    },
  },
  {
    id: 'ch-preset-game-audio',
    name: 'Game Audio Virtual Bus (Tactical EQ)',
    category: 'game',
    description: 'High boost for footsteps and reload cues (+2.5dB), controlled bass, mild leveling.',
    isFactory: true,
    settings: {
      gain: 0.85,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 2.5, mid: -1.0, low: 1.5 },
      gate: { threshold: -60, active: false },
      compressor: { threshold: -15, ratio: 2.2, active: true },
    },
  },
  {
    id: 'ch-preset-discord',
    name: 'Discord / Voice Comms De-Harsh',
    category: 'stream',
    description: 'Cuts muddy lows and harsh sibilance from incoming VoIP calls with automatic leveling.',
    isFactory: true,
    settings: {
      gain: 0.95,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 1.0, mid: 1.0, low: -2.5 },
      gate: { threshold: -50, active: true },
      compressor: { threshold: -18, ratio: 2.8, active: true },
    },
  },
  {
    id: 'ch-preset-flat',
    name: 'Flat Clean Unity Bypass',
    category: 'custom',
    description: 'Everything bypassed, 0dB EQ flat, unity gain 1.0.',
    isFactory: true,
    settings: {
      gain: 1.0,
      mute: false,
      solo: false,
      monitor: false,
      pan: 0,
      eq: { high: 0, mid: 0, low: 0 },
      gate: { threshold: -60, active: false },
      compressor: { threshold: -20, ratio: 1.0, active: false },
    },
  },
];

export const FACTORY_MASTER_PRESETS: MasterBusPreset[] = [
  {
    id: 'master-preset-smart',
    name: 'Auto-Conditioning Master (Standard)',
    description: 'Universal smart limiter, loudness normalization, clean transparency, subtle room warmth.',
    isFactory: true,
    settings: {
      reverb: 0.04,
      delay: 0,
      noiseReduction: 0.1,
      aec: false,
      masterGain: 0.9,
      smartMastering: true,
    },
  },
  {
    id: 'master-preset-loud-punch',
    name: 'Loud & Punchy Commercial Bus',
    description: 'Higher output ceiling (+1dB), tight master presence, club-ready loudness.',
    isFactory: true,
    settings: {
      reverb: 0.08,
      delay: 0.05,
      noiseReduction: 0.05,
      aec: false,
      masterGain: 1.1,
      smartMastering: true,
    },
  },
  {
    id: 'master-preset-voice-clean',
    name: 'Conference & Voice Isolation (AEC On)',
    description: 'Full Acoustic Echo Cancellation enabled with 40% noise cutoff for echo-free calls.',
    isFactory: true,
    settings: {
      reverb: 0,
      delay: 0,
      noiseReduction: 0.4,
      aec: true,
      masterGain: 0.85,
      smartMastering: false,
    },
  },
  {
    id: 'master-preset-ambient-hall',
    name: 'Spacious Concert Reverb & Delay',
    description: 'Lush 45% cathedral reverb with 25% stereo tempo delay for live acoustic sets.',
    isFactory: true,
    settings: {
      reverb: 0.45,
      delay: 0.25,
      noiseReduction: 0,
      aec: false,
      masterGain: 0.8,
      smartMastering: false,
    },
  },
  {
    id: 'master-preset-purist',
    name: 'Audiophile Direct Wire (No DSP)',
    description: 'Zero FX, zero reverb, zero delay, unity gain 0.8.',
    isFactory: true,
    settings: {
      reverb: 0,
      delay: 0,
      noiseReduction: 0,
      aec: false,
      masterGain: 0.8,
      smartMastering: false,
    },
  },
];

// ---------------- SERVICE LOGIC ---------------- //

class PresetService {
  // --- Console Presets ---
  public getConsolePresets(): ConsolePreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONSOLE);
      const userPresets: ConsolePreset[] = stored ? JSON.parse(stored) : [];
      return [...FACTORY_CONSOLE_PRESETS, ...userPresets];
    } catch (e) {
      console.error('Failed to parse console presets:', e);
      return FACTORY_CONSOLE_PRESETS;
    }
  }

  public saveConsolePreset(
    name: string,
    channels: ChannelSettings[],
    master: MasterSettings,
    description?: string
  ): ConsolePreset {
    const newPreset: ConsolePreset = {
      id: `custom-console-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: description?.trim() || `User snapshot created on ${new Date().toLocaleDateString()}`,
      isFactory: false,
      createdAt: Date.now(),
      // Deep clone to isolate state
      channels: JSON.parse(JSON.stringify(channels)),
      master: JSON.parse(JSON.stringify(master)),
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONSOLE);
      const userPresets: ConsolePreset[] = stored ? JSON.parse(stored) : [];
      const updated = [newPreset, ...userPresets];
      localStorage.setItem(STORAGE_KEY_CONSOLE, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save console preset:', e);
    }

    return newPreset;
  }

  public deleteConsolePreset(id: string): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONSOLE);
      if (!stored) return false;
      const userPresets: ConsolePreset[] = JSON.parse(stored);
      const filtered = userPresets.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY_CONSOLE, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('Failed to delete console preset:', e);
      return false;
    }
  }

  // --- Channel Presets ---
  public getChannelPresets(): ChannelStripPreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CHANNEL);
      const userPresets: ChannelStripPreset[] = stored ? JSON.parse(stored) : [];
      return [...FACTORY_CHANNEL_PRESETS, ...userPresets];
    } catch (e) {
      console.error('Failed to parse channel presets:', e);
      return FACTORY_CHANNEL_PRESETS;
    }
  }

  public saveChannelPreset(
    name: string,
    channel: ChannelSettings,
    category: 'vocal' | 'instrument' | 'stream' | 'cleanup' | 'game' | 'custom' = 'custom',
    description?: string
  ): ChannelStripPreset {
    const newPreset: ChannelStripPreset = {
      id: `custom-ch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      category,
      description: description?.trim() || `Channel strip preset created on ${new Date().toLocaleDateString()}`,
      isFactory: false,
      createdAt: Date.now(),
      settings: {
        name: channel.name,
        gain: channel.gain,
        mute: channel.mute,
        solo: channel.solo,
        monitor: channel.monitor,
        pan: channel.pan,
        eq: { ...channel.eq },
        gate: { ...channel.gate },
        compressor: { ...channel.compressor },
        routing: [...(channel.routing || [])],
      },
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY_CHANNEL);
      const userPresets: ChannelStripPreset[] = stored ? JSON.parse(stored) : [];
      const updated = [newPreset, ...userPresets];
      localStorage.setItem(STORAGE_KEY_CHANNEL, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save channel preset:', e);
    }

    return newPreset;
  }

  public deleteChannelPreset(id: string): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CHANNEL);
      if (!stored) return false;
      const userPresets: ChannelStripPreset[] = JSON.parse(stored);
      const filtered = userPresets.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY_CHANNEL, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('Failed to delete channel preset:', e);
      return false;
    }
  }

  // --- Master Presets ---
  public getMasterPresets(): MasterBusPreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MASTER);
      const userPresets: MasterBusPreset[] = stored ? JSON.parse(stored) : [];
      return [...FACTORY_MASTER_PRESETS, ...userPresets];
    } catch (e) {
      console.error('Failed to parse master presets:', e);
      return FACTORY_MASTER_PRESETS;
    }
  }

  public saveMasterPreset(
    name: string,
    master: MasterSettings,
    description?: string
  ): MasterBusPreset {
    const newPreset: MasterBusPreset = {
      id: `custom-master-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      description: description?.trim() || `Master bus preset created on ${new Date().toLocaleDateString()}`,
      isFactory: false,
      createdAt: Date.now(),
      settings: JSON.parse(JSON.stringify(master)),
    };

    try {
      const stored = localStorage.getItem(STORAGE_KEY_MASTER);
      const userPresets: MasterBusPreset[] = stored ? JSON.parse(stored) : [];
      const updated = [newPreset, ...userPresets];
      localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save master preset:', e);
    }

    return newPreset;
  }

  public deleteMasterPreset(id: string): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MASTER);
      if (!stored) return false;
      const userPresets: MasterBusPreset[] = JSON.parse(stored);
      const filtered = userPresets.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('Failed to delete master preset:', e);
      return false;
    }
  }

  // --- Active Preset Memory ---
  public getActivePresetId(): string | null {
    return localStorage.getItem(STORAGE_KEY_ACTIVE_PRESET);
  }

  public setActivePresetId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PRESET, id);
    } else {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET);
    }
  }

  // --- Import / Export ---
  public exportAllPresetsJSON(): string {
    const data = {
      exportVersion: 1,
      appName: 'CORE AZERO',
      timestamp: Date.now(),
      consolePresets: this.getUserConsolePresets(),
      channelPresets: this.getUserChannelPresets(),
      masterPresets: this.getUserMasterPresets(),
    };
    return JSON.stringify(data, null, 2);
  }

  public getUserConsolePresets(): ConsolePreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONSOLE);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public getUserChannelPresets(): ChannelStripPreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CHANNEL);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public getUserMasterPresets(): MasterBusPreset[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MASTER);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  public importPresetsFromJSON(jsonString: string): {
    importedConsole: number;
    importedChannel: number;
    importedMaster: number;
  } {
    const parsed = JSON.parse(jsonString);
    let consoleCount = 0;
    let channelCount = 0;
    let masterCount = 0;

    if (Array.isArray(parsed.consolePresets)) {
      const existing = this.getUserConsolePresets();
      const existingIds = new Set(existing.map((p) => p.id));
      const valid = parsed.consolePresets.filter((p: any) => p && p.name && p.channels && !existingIds.has(p.id));
      if (valid.length > 0) {
        localStorage.setItem(STORAGE_KEY_CONSOLE, JSON.stringify([...valid, ...existing]));
        consoleCount = valid.length;
      }
    }

    if (Array.isArray(parsed.channelPresets)) {
      const existing = this.getUserChannelPresets();
      const existingIds = new Set(existing.map((p) => p.id));
      const valid = parsed.channelPresets.filter((p: any) => p && p.name && p.settings && !existingIds.has(p.id));
      if (valid.length > 0) {
        localStorage.setItem(STORAGE_KEY_CHANNEL, JSON.stringify([...valid, ...existing]));
        channelCount = valid.length;
      }
    }

    if (Array.isArray(parsed.masterPresets)) {
      const existing = this.getUserMasterPresets();
      const existingIds = new Set(existing.map((p) => p.id));
      const valid = parsed.masterPresets.filter((p: any) => p && p.name && p.settings && !existingIds.has(p.id));
      if (valid.length > 0) {
        localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify([...valid, ...existing]));
        masterCount = valid.length;
      }
    }

    return {
      importedConsole: consoleCount,
      importedChannel: channelCount,
      importedMaster: masterCount,
    };
  }

  public clearAllCustomPresets(): void {
    localStorage.removeItem(STORAGE_KEY_CONSOLE);
    localStorage.removeItem(STORAGE_KEY_CHANNEL);
    localStorage.removeItem(STORAGE_KEY_MASTER);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_PRESET);
  }
}

export const presetService = new PresetService();
