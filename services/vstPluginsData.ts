import { VstPluginConfig } from '../types';

export interface VstPluginDefinition {
  id: VstPluginConfig['pluginId'];
  name: string;
  category: string;
  tagline: string;
  description: string;
  color: string; // Tailwind color class / hex accent
  accentHex: string;
  defaultPreset: string;
  presets: {
    name: string;
    description: string;
    parameters: Record<string, number | string | boolean>;
    dryWet: number;
    inputGain: number;
    outputGain: number;
  }[];
  defaultParameters: Record<string, number | string | boolean>;
  defaultDryWet: number;
  defaultInputGain: number;
  defaultOutputGain: number;
}

export const VST_PLUGINS: VstPluginDefinition[] = [
  {
    id: 'warm_drive',
    name: 'Azero WarmDrive VST3',
    category: 'Saturation & Harmonics',
    tagline: 'Dual-Triode 12AX7 Analog Tube & Tape Machine Emulator',
    description: 'Models vintage dual-triode tube saturation and tape hysteresis with warm low-order even harmonics and magnetic compression.',
    color: 'amber',
    accentHex: '#f59e0b',
    defaultPreset: 'Warm Broadcast Mic',
    defaultDryWet: 100,
    defaultInputGain: 0,
    defaultOutputGain: 0,
    defaultParameters: {
      drive: 32,
      tubeBias: 50,
      warmth: 3.0,
      tapeFlutter: 12,
      headroom: -6,
      tubeType: '12AX7'
    },
    presets: [
      {
        name: 'Warm Broadcast Mic',
        description: 'Smooth harmonic enrichment tailored for studio dynamic & condenser microphones.',
        parameters: { drive: 24, tubeBias: 45, warmth: 3.5, tapeFlutter: 8, headroom: -8, tubeType: '12AX7' },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Vintage Tape Saturation',
        description: '15 IPS reel-to-reel magnetic tape with subtle flutter and tape compression.',
        parameters: { drive: 48, tubeBias: 65, warmth: 4.8, tapeFlutter: 26, headroom: -4, tubeType: 'Tape Reel' },
        dryWet: 85,
        inputGain: 1.5,
        outputGain: -1.0
      },
      {
        name: 'Aggressive Germanium Fuzz',
        description: 'Hard-driven vintage Germanium transistor distortion for aggressive vocal drive.',
        parameters: { drive: 82, tubeBias: 78, warmth: 1.0, tapeFlutter: 32, headroom: -2, tubeType: 'Germanium' },
        dryWet: 65,
        inputGain: 4.0,
        outputGain: -3.5
      },
      {
        name: 'Subtle Master Glue',
        description: 'Gentle Class-A triode warmth for gluing mixes and streams with rich presence.',
        parameters: { drive: 14, tubeBias: 30, warmth: 1.8, tapeFlutter: 4, headroom: -12, tubeType: 'Triode Class A' },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Lo-Fi Cassette Nostalgia',
        description: 'Vintage cassette tape saturation with noticeable wow/flutter and mid-range bloom.',
        parameters: { drive: 62, tubeBias: 55, warmth: 5.5, tapeFlutter: 52, headroom: -5, tubeType: 'Tape Reel' },
        dryWet: 90,
        inputGain: 2.0,
        outputGain: -1.5
      }
    ]
  },
  {
    id: 'fet_76',
    name: 'BlackFace FET-76 VST3',
    category: 'Dynamics & Limiting',
    tagline: 'Ultra-Fast Class-A Discrete FET Peak Limiting Amplifier',
    description: 'Exact recreation of the iconic vintage solid-state peak limiter renowned for blazing sub-millisecond attack and punchy coloration.',
    color: 'emerald',
    accentHex: '#10b981',
    defaultPreset: 'In-Your-Face Vocals',
    defaultDryWet: 100,
    defaultInputGain: -18,
    defaultOutputGain: -12,
    defaultParameters: {
      input: -18,
      output: -12,
      attack: 250, // microseconds
      release: 300, // milliseconds
      ratio: '4:1',
      meterMode: 'GR'
    },
    presets: [
      {
        name: 'In-Your-Face Vocals',
        description: 'Locks lead vocals tight right at the front of the virtual console mix.',
        parameters: { input: -14, output: -10, attack: 180, release: 250, ratio: '4:1', meterMode: 'GR' },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Snare & Transient Smack',
        description: 'Fast attack pinches aggressive spikes while letting body ring through.',
        parameters: { input: -10, output: -14, attack: 380, release: 120, ratio: '8:1', meterMode: 'GR' },
        dryWet: 80,
        inputGain: 2.0,
        outputGain: -2.0
      },
      {
        name: 'All-Buttons "Nuke" Mode',
        description: 'Depresses all 4 ratio buttons simultaneously for explosive saturation and distortion.',
        parameters: { input: -6, output: -18, attack: 35, release: 75, ratio: 'ALL', meterMode: 'GR' },
        dryWet: 60,
        inputGain: 3.0,
        outputGain: -4.0
      },
      {
        name: 'Gentle Leveler 4:1',
        description: 'Slow attack transparent leveling for natural speech and acoustic elements.',
        parameters: { input: -24, output: -8, attack: 650, release: 550, ratio: '4:1', meterMode: 'GR' },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Podcast Broadcast Limiter',
        description: 'Zero runaway clipping protection with high speech intelligibility.',
        parameters: { input: -16, output: -12, attack: 140, release: 340, ratio: '8:1', meterMode: 'GR' },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      }
    ]
  },
  {
    id: 'aetherspace_reverb',
    name: 'AetherSpace Reverb VST3',
    category: 'Spatial & Ambient',
    tagline: 'Multi-Tap Modulated Algorithmic Hall & Plate Simulator',
    description: 'Immersive diffusion network generating everything from silky vocal plates to infinite cosmological shimmer spaces.',
    color: 'cyan',
    accentHex: '#06b6d4',
    defaultPreset: 'Silky Vocal Plate',
    defaultDryWet: 30,
    defaultInputGain: 0,
    defaultOutputGain: 0,
    defaultParameters: {
      decay: 2.2, // seconds
      predelay: 28, // ms
      damping: 6800, // Hz
      diffusion: 88, // %
      width: 125, // %
      modulation: 45, // %
      algo: 'Lush Plate'
    },
    presets: [
      {
        name: 'Silky Vocal Plate',
        description: 'Bright, dense plate reverb that floats vocal tracks above the stereo bed.',
        parameters: { decay: 1.8, predelay: 32, damping: 7200, diffusion: 90, width: 130, modulation: 45, algo: 'Lush Plate' },
        dryWet: 28,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Massive Concert Hall',
        description: 'Expansive wooden concert hall with natural decay and warm air reflections.',
        parameters: { decay: 4.8, predelay: 55, damping: 5400, diffusion: 95, width: 160, modulation: 60, algo: 'Concert Hall' },
        dryWet: 40,
        inputGain: 0,
        outputGain: -1.0
      },
      {
        name: 'Tight Drum & Speech Room',
        description: 'Short acoustic room reflections that add dimension without washing out intelligibility.',
        parameters: { decay: 0.8, predelay: 10, damping: 8500, diffusion: 75, width: 100, modulation: 20, algo: 'Vintage Ambience' },
        dryWet: 20,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Cosmic Shimmer Cathedral',
        description: 'Infinite pitch-shifted feedback tails for ethereal ambient soundscapes.',
        parameters: { decay: 11.5, predelay: 80, damping: 4200, diffusion: 98, width: 180, modulation: 85, algo: 'Cosmic Shimmer' },
        dryWet: 50,
        inputGain: 0,
        outputGain: -2.0
      },
      {
        name: 'Vintage Broadcast Slap',
        description: 'Quick retro slapback space modeled on early FM radio broadcast booths.',
        parameters: { decay: 0.5, predelay: 22, damping: 9000, diffusion: 60, width: 95, modulation: 15, algo: 'Vintage Ambience' },
        dryWet: 18,
        inputGain: 0,
        outputGain: 0
      }
    ]
  },
  {
    id: 'precision_eq',
    name: 'Precision Phase-EQ VST3',
    category: 'Equalization & Filtering',
    tagline: '5-Band Surgical Minimum-Phase Dynamic Equalizer',
    description: 'Studio-grade linear response equalizer with high-pass rumble filter, parametric bell nodes, and high-frequency air shelf.',
    color: 'sky',
    accentHex: '#38bdf8',
    defaultPreset: 'Vocal Air & Body',
    defaultDryWet: 100,
    defaultInputGain: 0,
    defaultOutputGain: 0,
    defaultParameters: {
      hpFreq: 85, // Hz
      hpSlope: '24dB/oct',
      lowGain: 1.5, // dB
      lowFreq: 140, // Hz
      midGain: -2.0, // dB
      midFreq: 480, // Hz
      midQ: 1.4,
      highGain: 2.5, // dB
      highFreq: 4500, // Hz
      airBoost: 3.5 // dB
    },
    presets: [
      {
        name: 'Vocal Air & Body',
        description: 'Cuts mud at 480Hz, adds chest weight at 140Hz and silky 12kHz sheen.',
        parameters: { hpFreq: 85, hpSlope: '24dB/oct', lowGain: 1.5, lowFreq: 140, midGain: -2.0, midFreq: 480, midQ: 1.4, highGain: 2.5, highFreq: 4500, airBoost: 3.5 },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Mud Remover & Clarity',
        description: 'Deep boxy scoop at 300Hz with high-mid speech articulation boost.',
        parameters: { hpFreq: 110, hpSlope: '24dB/oct', lowGain: -3.5, lowFreq: 250, midGain: 2.5, midFreq: 2800, midQ: 1.8, highGain: 1.5, highFreq: 6000, airBoost: 1.5 },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Radio Announcer Boom',
        description: 'Classic proximity effect bass punch with crisp modern transient presence.',
        parameters: { hpFreq: 65, hpSlope: '18dB/oct', lowGain: 4.5, lowFreq: 100, midGain: 2.0, midFreq: 3400, midQ: 1.1, highGain: 2.0, highFreq: 5000, airBoost: 3.0 },
        dryWet: 100,
        inputGain: 0,
        outputGain: -1.0
      },
      {
        name: 'Bass & Sub Tightener',
        description: 'Strips ultra-low sub rumble while consolidating kick & bass punch.',
        parameters: { hpFreq: 35, hpSlope: '24dB/oct', lowGain: 3.0, lowFreq: 75, midGain: -4.0, midFreq: 380, midQ: 2.5, highGain: -6.0, highFreq: 4000, airBoost: 0 },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Flat Reference Calibration',
        description: 'Zero coloration flat baseline setting for reference bypass comparison.',
        parameters: { hpFreq: 20, hpSlope: '12dB/oct', lowGain: 0, lowFreq: 120, midGain: 0, midFreq: 1000, midQ: 1.0, highGain: 0, highFreq: 8000, airBoost: 0 },
        dryWet: 100,
        inputGain: 0,
        outputGain: 0
      }
    ]
  },
  {
    id: 'ott_multiband',
    name: 'OTT Multiband Pump VST3',
    category: 'Multiband Dynamics',
    tagline: 'Hyper-Exciting Upward / Downward Tri-Band Brickwall Maximizer',
    description: 'Renowned aggressive upward/downward compressor that pulls buried micro-details up while squashing wild dynamic spikes.',
    color: 'orange',
    accentHex: '#f97316',
    defaultPreset: 'Hyper-Crisp Modern Vocal',
    defaultDryWet: 65,
    defaultInputGain: 0,
    defaultOutputGain: 0,
    defaultParameters: {
      depth: 65, // %
      time: 1.0, // multiplier
      upward: 70, // %
      downward: 60, // %
      highBandGain: 2.5, // dB
      midBandGain: 0.0, // dB
      lowBandGain: 1.0 // dB
    },
    presets: [
      {
        name: 'Hyper-Crisp Modern Vocal',
        description: 'Massively lifts vocal consonants and breath while locking gain in stone.',
        parameters: { depth: 75, time: 0.8, upward: 80, downward: 65, highBandGain: 4.0, midBandGain: 0, lowBandGain: -1.0 },
        dryWet: 70,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Subtle Mix Bus Secret Sauce',
        description: 'Tames unruly frequencies while lifting hidden harmonic sub-layers.',
        parameters: { depth: 32, time: 1.4, upward: 40, downward: 35, highBandGain: 1.5, midBandGain: 0.5, lowBandGain: 1.0 },
        dryWet: 45,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Aggressive VRChat Mic Punch',
        description: 'Cuts right through noisy lobbies with unshakeable broadcast presence.',
        parameters: { depth: 85, time: 0.6, upward: 90, downward: 75, highBandGain: 5.0, midBandGain: -1.0, lowBandGain: 2.0 },
        dryWet: 80,
        inputGain: 1.5,
        outputGain: -1.0
      },
      {
        name: 'Synth & Music Track Pump',
        description: 'Gives backing tracks pumping EDM energy and crisp top-end shimmer.',
        parameters: { depth: 60, time: 1.0, upward: 65, downward: 55, highBandGain: 2.0, midBandGain: 1.0, lowBandGain: 3.0 },
        dryWet: 65,
        inputGain: 0,
        outputGain: 0
      },
      {
        name: 'Ultra-Loud Radio Brickwall',
        description: 'Maximum density brickwall limiter for hyper-competitive loudness.',
        parameters: { depth: 95, time: 0.5, upward: 95, downward: 90, highBandGain: 3.0, midBandGain: 0, lowBandGain: 2.0 },
        dryWet: 90,
        inputGain: 2.0,
        outputGain: -2.0
      }
    ]
  }
];

export function getDefaultVstConfig(channelId: number): VstPluginConfig {
  // Give different channels interesting defaults so the user immediately sees variety!
  const pluginIndex = (channelId - 1) % VST_PLUGINS.length;
  const def = VST_PLUGINS[pluginIndex];
  
  return {
    enabled: false,
    pluginId: def.id,
    pluginName: def.name,
    presetName: def.defaultPreset,
    dryWet: def.defaultDryWet,
    inputGain: def.defaultInputGain,
    outputGain: def.defaultOutputGain,
    parameters: { ...def.defaultParameters }
  };
}
