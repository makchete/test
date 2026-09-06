// Web Audio API based sound synthesizer for calling and notifications
// Completely autonomous, no external audio files or dependencies required

class SoundService {
  private audioCtx: AudioContext | null = null;
  private currentLoopTimer: any = null;
  private activeOscillators: OscillatorNode[] = [];
  private activeGainNodes: GainNode[] = [];
  private isRinging: boolean = false;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Play Incoming Call Ringtone (Melodic modern polyphonic chime)
   * Loops until stop() is called.
   */
  public playIncomingRingtone() {
    this.stopAll();
    this.isRinging = true;

    // Trigger mobile vibration if supported
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 400, 1000]);
      } catch {}
    }

    const playChimeSequence = () => {
      if (!this.isRinging) return;

      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        // Notes: F5 (698.46Hz), A5 (880Hz), C6 (1046.5Hz), E6 (1318.51Hz), D6 (1174.66Hz)
        const notes = [
          { freq: 659.25, time: 0, duration: 0.18 },    // E5
          { freq: 783.99, time: 0.16, duration: 0.18 }, // G5
          { freq: 987.77, time: 0.32, duration: 0.22 }, // B5
          { freq: 1174.66, time: 0.52, duration: 0.35 },// D6
          { freq: 987.77, time: 0.95, duration: 0.18 }, // B5
          { freq: 1318.51, time: 1.12, duration: 0.45 },// E6
        ];

        notes.forEach(({ freq, time, duration }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);

          // Second harmonic for rich marimba/bell timbre
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(freq * 2, now + time);

          // Envelope
          gain.gain.setValueAtTime(0.001, now + time);
          gain.gain.exponentialRampToValueAtTime(0.28, now + time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

          gain2.gain.setValueAtTime(0.001, now + time);
          gain2.gain.exponentialRampToValueAtTime(0.08, now + time + 0.02);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + time + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc2.connect(gain2);
          gain2.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + duration);
          osc2.start(now + time);
          osc2.stop(now + time + duration);

          this.activeOscillators.push(osc, osc2);
          this.activeGainNodes.push(gain, gain2);
        });

        // Repeat every 2.4 seconds
        this.currentLoopTimer = setTimeout(playChimeSequence, 2400);
      } catch (err) {
        console.warn('Audio playIncomingRingtone error:', err);
      }
    };

    playChimeSequence();
  }

  /**
   * Play Outgoing Ringback Tone (Traditional standard tone: 425Hz pulsing)
   * Loops until stop() is called.
   */
  public playOutgoingRingback() {
    this.stopAll();
    this.isRinging = true;

    const playRingbackPulse = () => {
      if (!this.isRinging) return;

      try {
        const ctx = this.getAudioContext();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Dual tone (440Hz + 480Hz) or European standard (425Hz)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        // 1.5s pulse, then silence
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 1.5);
        osc2.start(now);
        osc2.stop(now + 1.5);

        this.activeOscillators.push(osc1, osc2);
        this.activeGainNodes.push(gain);

        // Repeat every 3.5 seconds
        this.currentLoopTimer = setTimeout(playRingbackPulse, 3500);
      } catch (err) {
        console.warn('Audio playOutgoingRingback error:', err);
      }
    };

    playRingbackPulse();
  }

  /**
   * Play Call Connected Tone (pleasant rising beep)
   */
  public playCallConnectedTone() {
    this.stopAll();
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.15); // G5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {}
  }

  /**
   * Play Call End / Rejected Tone (3 rapid descending beeps)
   */
  public playCallEndTone() {
    this.stopAll();
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;

      [0, 0.18, 0.36].forEach((timeOffset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        const freq = idx === 0 ? 440 : idx === 1 ? 392 : 349.23;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gain.gain.setValueAtTime(0.001, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.18, now + timeOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.13);
      });
    } catch {}
  }

  public playHangupSound() {
    this.playCallEndTone();
  }

  /**
   * Play New Message Notification chime
   */
  public playMessageNotification() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {}
  }

  /**
   * Stop all active sounds and loops immediately
   */
  public stopAll() {
    this.isRinging = false;
    if (this.currentLoopTimer) {
      clearTimeout(this.currentLoopTimer);
      this.currentLoopTimer = null;
    }

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    this.activeOscillators = [];

    this.activeGainNodes.forEach((gain) => {
      try {
        gain.disconnect();
      } catch {}
    });
    this.activeGainNodes = [];

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }
}

export const soundService = new SoundService();
