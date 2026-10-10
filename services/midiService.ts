import {
  MidiMapping,
  MidiTarget,
  MidiTargetType,
  MidiMessageType,
  MidiInputPortInfo,
  MidiLogEntry
} from '../types';

const STORAGE_KEY_MIDI_MAPPINGS = 'core_azero_midi_mappings';

// Default MIDI targets available across the mixer
export const AVAILABLE_MIDI_TARGETS: MidiTarget[] = [
  // 8 Channels Gain + Toggles
  ...Array.from({ length: 8 }, (_, i) => {
    const ch = i + 1;
    return [
      { id: `ch_${ch}_gain`, type: 'channel_gain' as MidiTargetType, channelId: ch, label: `CH ${ch} Fader Gain` },
      { id: `ch_${ch}_mute`, type: 'channel_mute' as MidiTargetType, channelId: ch, label: `CH ${ch} Mute Toggle` },
      { id: `ch_${ch}_solo`, type: 'channel_solo' as MidiTargetType, channelId: ch, label: `CH ${ch} Solo Toggle` },
      { id: `ch_${ch}_monitor`, type: 'channel_monitor' as MidiTargetType, channelId: ch, label: `CH ${ch} Monitor Toggle` },
    ];
  }).flat(),
  // Master Targets
  { id: 'master_gain', type: 'master_gain', label: 'Master Fader Gain' },
  { id: 'master_smart_mastering', type: 'master_smart_mastering', label: 'Smart Mastering Toggle' },
  { id: 'master_aec', type: 'master_aec', label: 'Echo Cancellation Toggle' },
];

export const HARDWARE_PROFILES = [
  {
    id: 'korg_nanokontrol2',
    name: 'Korg nanoKONTROL 2',
    description: 'Faders 1-8 to CH 1-8 Gain (CC 0-7), Solo buttons (CC 32-39), Mute buttons (CC 48-55), Master (CC 23)',
    createMappings: (): MidiMapping[] => {
      const maps: MidiMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        maps.push({
          id: `profile_korg_gain_${i}`,
          targetId: `ch_${i}_gain`,
          targetType: 'channel_gain',
          channelId: i,
          midiChannel: 0,
          messageType: 'cc',
          controlNumber: i - 1, // CC 0 to 7
        });
        maps.push({
          id: `profile_korg_solo_${i}`,
          targetId: `ch_${i}_solo`,
          targetType: 'channel_solo',
          channelId: i,
          midiChannel: 0,
          messageType: 'cc',
          controlNumber: 31 + i, // CC 32 to 39
        });
        maps.push({
          id: `profile_korg_mute_${i}`,
          targetId: `ch_${i}_mute`,
          targetType: 'channel_mute',
          channelId: i,
          midiChannel: 0,
          messageType: 'cc',
          controlNumber: 47 + i, // CC 48 to 55
        });
      }
      // Master fader
      maps.push({
        id: 'profile_korg_master',
        targetId: 'master_gain',
        targetType: 'master_gain',
        midiChannel: 0,
        messageType: 'cc',
        controlNumber: 23,
      });
      return maps;
    }
  },
  {
    id: 'standard_8_fader',
    name: 'Generic 8-Fader Controller (CC 1-8)',
    description: 'Standard 8 continuous sliders mapped to CC 1-8 for CH 1-8, CC 9 for Master Fader',
    createMappings: (): MidiMapping[] => {
      const maps: MidiMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        maps.push({
          id: `profile_gen_gain_${i}`,
          targetId: `ch_${i}_gain`,
          targetType: 'channel_gain',
          channelId: i,
          midiChannel: 0,
          messageType: 'cc',
          controlNumber: i, // CC 1 to 8
        });
      }
      maps.push({
        id: 'profile_gen_master',
        targetId: 'master_gain',
        targetType: 'master_gain',
        midiChannel: 0,
        messageType: 'cc',
        controlNumber: 9,
      });
      return maps;
    }
  },
  {
    id: 'novation_launchcontrol_xl',
    name: 'Novation Launch Control XL',
    description: 'Faders 1-8 (CC 77-84), Mute (Note 73-80), Solo (Note 89-96), Master Gain (CC 85)',
    createMappings: (): MidiMapping[] => {
      const maps: MidiMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        maps.push({
          id: `profile_nov_gain_${i}`,
          targetId: `ch_${i}_gain`,
          targetType: 'channel_gain',
          channelId: i,
          midiChannel: 0,
          messageType: 'cc',
          controlNumber: 76 + i,
        });
        maps.push({
          id: `profile_nov_mute_${i}`,
          targetId: `ch_${i}_mute`,
          targetType: 'channel_mute',
          channelId: i,
          midiChannel: 0,
          messageType: 'note',
          controlNumber: 72 + i,
        });
        maps.push({
          id: `profile_nov_solo_${i}`,
          targetId: `ch_${i}_solo`,
          targetType: 'channel_solo',
          channelId: i,
          midiChannel: 0,
          messageType: 'note',
          controlNumber: 88 + i,
        });
      }
      maps.push({
        id: 'profile_nov_master',
        targetId: 'master_gain',
        targetType: 'master_gain',
        midiChannel: 0,
        messageType: 'cc',
        controlNumber: 85,
      });
      return maps;
    }
  },
  {
    id: 'akai_midimix',
    name: 'Akai Professional MIDImix',
    description: 'Faders 1-8 (CC 19, 23, 27, 31, 49, 53, 57, 61), Master (CC 62), Mute (Notes 1-8)',
    createMappings: (): MidiMapping[] => {
      const faderCCs = [19, 23, 27, 31, 49, 53, 57, 61];
      const maps: MidiMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        maps.push({
          id: `profile_akai_gain_${i}`,
          targetId: `ch_${i}_gain`,
          targetType: 'channel_gain',
          channelId: i,
          midiChannel: 0,
          messageType: 'cc',
          controlNumber: faderCCs[i - 1],
        });
        maps.push({
          id: `profile_akai_mute_${i}`,
          targetId: `ch_${i}_mute`,
          targetType: 'channel_mute',
          channelId: i,
          midiChannel: 0,
          messageType: 'note',
          controlNumber: i,
        });
      }
      maps.push({
        id: 'profile_akai_master',
        targetId: 'master_gain',
        targetType: 'master_gain',
        midiChannel: 0,
        messageType: 'cc',
        controlNumber: 62,
      });
      return maps;
    }
  }
];

class MidiService {
  private midiAccess: any = null;
  private isInitialized = false;
  private mappings: MidiMapping[] = [];
  private learningTarget: MidiTarget | null = null;
  private connectedDevices: MidiInputPortInfo[] = [];
  private recentLogs: MidiLogEntry[] = [];
  private maxLogs = 25;

  // Callbacks
  public onContinuousControl: ((target: MidiTarget, normalizedValue: number) => void) | null = null;
  public onToggleControl: ((target: MidiTarget) => void) | null = null;
  public onMappingLearned: ((mapping: MidiMapping, target: MidiTarget) => void) | null = null;
  public onDeviceStateChange: ((devices: MidiInputPortInfo[]) => void) | null = null;
  public onRawMessageReceived: ((log: MidiLogEntry) => void) | null = null;
  public onMappingsUpdated: ((mappings: MidiMapping[]) => void) | null = null;

  constructor() {
    this.loadMappingsFromStorage();
  }

  public isWebMidiSupported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  public async initialize(): Promise<{ supported: boolean; error?: string }> {
    if (this.isInitialized && this.midiAccess) {
      return { supported: true };
    }

    if (!this.isWebMidiSupported()) {
      return {
        supported: false,
        error: 'Web MIDI API is not natively supported in this browser. You can still use the built-in Virtual MIDI Controller to test MIDI Learn.',
      };
    }

    try {
      this.midiAccess = await (navigator as any).requestMIDIAccess({ sysex: false });
      this.isInitialized = true;
      this.updateConnectedDevices();

      // Attach message listeners to all inputs
      this.bindInputs();

      // Listen for hot-plug events (device connect / disconnect)
      this.midiAccess.onstatechange = (e: any) => {
        this.updateConnectedDevices();
        this.bindInputs();
        if (this.onDeviceStateChange) {
          this.onDeviceStateChange(this.connectedDevices);
        }
      };

      return { supported: true };
    } catch (err: any) {
      console.warn('[MidiService] requestMIDIAccess rejected or unavailable:', err);
      return {
        supported: false,
        error: err?.message || 'Access to MIDI devices was declined or blocked by system permissions.',
      };
    }
  }

  private updateConnectedDevices() {
    if (!this.midiAccess) {
      this.connectedDevices = [];
      return;
    }

    const devices: MidiInputPortInfo[] = [];
    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      devices.push({
        id: input.id,
        name: input.name || `MIDI Port ${input.id}`,
        manufacturer: input.manufacturer || 'Generic MIDI Device',
        state: input.state || 'connected',
      });
    }
    this.connectedDevices = devices;
  }

  private bindInputs() {
    if (!this.midiAccess) return;
    const inputs = this.midiAccess.inputs.values();
    for (const input of inputs) {
      input.onmidimessage = (event: any) => {
        this.handleMidiEvent(event.data);
      };
    }
  }

  // --- Incoming MIDI Processing ---
  public handleMidiEvent(data: Uint8Array | number[]) {
    if (!data || data.length < 2) return;

    const status = data[0];
    const byte1 = data[1];
    const byte2 = data.length > 2 ? data[2] : 0;

    const command = status >> 4;
    const midiChannel = (status & 0x0f) + 1; // 1 to 16

    let messageType: MidiMessageType | null = null;
    let controlNumber = 0;
    let value = 0;

    // 0x9 = Note On, 0x8 = Note Off
    if (command === 0x9) {
      messageType = 'note';
      controlNumber = byte1;
      value = byte2;
      // Note On with velocity 0 is standard MIDI Note Off
      if (value === 0) {
        // We can treat velocity 0 as Note Off; don't trigger toggles
        return;
      }
    } else if (command === 0x8) {
      // Note Off: typically ignored for latching toggles
      return;
    } else if (command === 0xb) {
      // 0xB = Control Change (CC)
      messageType = 'cc';
      controlNumber = byte1;
      value = byte2; // 0-127
    } else if (command === 0xe) {
      // 0xE = Pitch Bend
      messageType = 'pitchbend';
      controlNumber = 0;
      value = (byte2 << 7) | byte1; // 14-bit
    } else {
      // Other system or channel messages
      return;
    }

    // --- MIDI LEARN MODE ACTIVE ---
    if (this.learningTarget) {
      const learnedTarget = this.learningTarget;
      const newMapping: MidiMapping = {
        id: `map_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        targetId: learnedTarget.id,
        targetType: learnedTarget.type,
        channelId: learnedTarget.channelId,
        midiChannel,
        messageType,
        controlNumber,
        invert: false,
      };

      // Replace any existing mapping for this target
      this.mappings = this.mappings.filter((m) => m.targetId !== learnedTarget.id);
      this.mappings.unshift(newMapping);
      this.saveMappingsToStorage();

      this.learningTarget = null; // Exit learning for this target

      // Create log
      const log: MidiLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        timestamp: Date.now(),
        channel: midiChannel,
        type: messageType,
        controlNumber,
        value,
        mappedTargetLabel: `[LEARNED] -> ${learnedTarget.label}`,
      };
      this.pushLog(log);

      if (this.onMappingLearned) {
        this.onMappingLearned(newMapping, learnedTarget);
      }
      if (this.onMappingsUpdated) {
        this.onMappingsUpdated(this.mappings);
      }
      return;
    }

    // --- NORMAL MODE: Match against registered mappings ---
    const matched = this.mappings.find((m) => {
      if (m.messageType !== messageType) return false;
      if (m.controlNumber !== controlNumber) return false;
      if (m.midiChannel !== 0 && m.midiChannel !== midiChannel) return false;
      return true;
    });

    const targetDef = matched
      ? AVAILABLE_MIDI_TARGETS.find((t) => t.id === matched.targetId) || {
          id: matched.targetId,
          type: matched.targetType,
          channelId: matched.channelId,
          label: matched.targetId,
        }
      : undefined;

    // Log the message
    const log: MidiLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      timestamp: Date.now(),
      channel: midiChannel,
      type: messageType,
      controlNumber,
      value,
      mappedTargetLabel: targetDef?.label,
    };
    this.pushLog(log);

    if (!matched || !targetDef) return;

    // Execute Target Actions
    const isContinuous =
      matched.targetType === 'channel_gain' || matched.targetType === 'master_gain';

    if (isContinuous) {
      let normalized = value / 127;
      if (matched.invert) normalized = 1 - normalized;

      if (this.onContinuousControl) {
        this.onContinuousControl(targetDef, normalized);
      }
    } else {
      // Toggle button (mute, solo, monitor, smartMastering, aec)
      // If CC, trigger on transition to active (>63)
      if (messageType === 'note') {
        if (this.onToggleControl) {
          this.onToggleControl(targetDef);
        }
      } else if (messageType === 'cc') {
        // Trigger toggle if value > 0 (or specifically > 63 for momentary switches)
        if (value > 63 && this.onToggleControl) {
          this.onToggleControl(targetDef);
        }
      }
    }
  }

  // --- Virtual MIDI Simulator (for Testing without Hardware) ---
  public simulateMessage(
    type: MidiMessageType,
    channel: number,
    controlNumber: number,
    value: number
  ) {
    let statusByte = 0xb0 | ((channel - 1) & 0x0f); // default CC
    if (type === 'note') {
      statusByte = 0x90 | ((channel - 1) & 0x0f);
    }
    const data = [statusByte, controlNumber & 0x7f, value & 0x7f];
    this.handleMidiEvent(data);
  }

  // --- Learn Mode Controls ---
  public startLearn(target: MidiTarget) {
    this.learningTarget = target;
  }

  public cancelLearn() {
    this.learningTarget = null;
  }

  public isLearning(): boolean {
    return this.learningTarget !== null;
  }

  public getLearningTarget(): MidiTarget | null {
    return this.learningTarget;
  }

  // --- Mapping Management ---
  public getMappings(): MidiMapping[] {
    return [...this.mappings];
  }

  public getMappingForTarget(targetId: string): MidiMapping | undefined {
    return this.mappings.find((m) => m.targetId === targetId);
  }

  public saveMapping(mapping: MidiMapping) {
    this.mappings = this.mappings.filter((m) => m.targetId !== mapping.targetId);
    this.mappings.unshift(mapping);
    this.saveMappingsToStorage();
    if (this.onMappingsUpdated) {
      this.onMappingsUpdated(this.mappings);
    }
  }

  public deleteMapping(mappingId: string) {
    this.mappings = this.mappings.filter((m) => m.id !== mappingId);
    this.saveMappingsToStorage();
    if (this.onMappingsUpdated) {
      this.onMappingsUpdated(this.mappings);
    }
  }

  public deleteMappingByTarget(targetId: string) {
    this.mappings = this.mappings.filter((m) => m.targetId !== targetId);
    this.saveMappingsToStorage();
    if (this.onMappingsUpdated) {
      this.onMappingsUpdated(this.mappings);
    }
  }

  public clearAllMappings() {
    this.mappings = [];
    this.saveMappingsToStorage();
    if (this.onMappingsUpdated) {
      this.onMappingsUpdated(this.mappings);
    }
  }

  public applyHardwareProfile(profileId: string): boolean {
    const profile = HARDWARE_PROFILES.find((p) => p.id === profileId);
    if (!profile) return false;
    const newMappings = profile.createMappings();
    this.mappings = newMappings;
    this.saveMappingsToStorage();
    if (this.onMappingsUpdated) {
      this.onMappingsUpdated(this.mappings);
    }
    return true;
  }

  public getConnectedDevices(): MidiInputPortInfo[] {
    return [...this.connectedDevices];
  }

  public getRecentLogs(): MidiLogEntry[] {
    return [...this.recentLogs];
  }

  public clearLogs() {
    this.recentLogs = [];
  }

  private pushLog(log: MidiLogEntry) {
    this.recentLogs.unshift(log);
    if (this.recentLogs.length > this.maxLogs) {
      this.recentLogs.pop();
    }
    if (this.onRawMessageReceived) {
      this.onRawMessageReceived(log);
    }
  }

  // --- Persistence ---
  private loadMappingsFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MIDI_MAPPINGS);
      if (saved) {
        this.mappings = JSON.parse(saved);
      } else {
        // Load default Generic 8-Fader template out of the box so standard controllers work immediately!
        const defaultProfile = HARDWARE_PROFILES.find((p) => p.id === 'standard_8_fader');
        if (defaultProfile) {
          this.mappings = defaultProfile.createMappings();
        }
      }
    } catch (e) {
      console.error('[MidiService] Failed to load mappings from storage:', e);
      this.mappings = [];
    }
  }

  private saveMappingsToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY_MIDI_MAPPINGS, JSON.stringify(this.mappings));
    } catch (e) {
      console.error('[MidiService] Failed to save mappings to storage:', e);
    }
  }
}

export const midiService = new MidiService();
