import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AudioFeedbackService {
  private audioCtx: AudioContext | null = null;

  private initCtx() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  playBeep(frequency = 880, duration = 0.12, type: OscillatorType = 'sine') {
    try {
      this.initCtx();
      if (!this.audioCtx) return;
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Ignorar erros de áudio caso bloqueado pelo navegador
    }
  }

  playScaleSuccess() {
    this.playBeep(1046.5, 0.08); // High C
    setTimeout(() => {
      this.playBeep(1318.5, 0.14); // E
    }, 90);
  }

  playClick() {
    this.playBeep(440, 0.04, 'triangle');
  }

  playDelete() {
    this.playBeep(320, 0.1, 'sawtooth');
  }

  playCompleteCelebration() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playBeep(freq, 0.15);
      }, idx * 110);
    });
  }
}
