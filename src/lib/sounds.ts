export class SoundManager {
  private sounds: Record<string, HTMLAudioElement> = {};
  private enabled: boolean = true;

  constructor() {
    const urls = {
      draw: 'https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg',
      success: 'https://actions.google.com/sounds/v1/bell/bell_ring.ogg',
      fail: 'https://actions.google.com/sounds/v1/alarms/buzzer_alarm.ogg',
      win: 'https://actions.google.com/sounds/v1/crowds/crowd_cheer.ogg',
      lose: 'https://actions.google.com/sounds/v1/cartoon/slide_whistle.ogg'
    };

    // Preload sounds
    if (typeof window !== 'undefined') {
      for (const [key, url] of Object.entries(urls)) {
        const audio = new Audio(url);
        audio.volume = 0.4;
        this.sounds[key] = audio;
      }
    }
  }

  play(type: 'draw' | 'success' | 'fail' | 'win' | 'lose') {
    if (!this.enabled) return;
    const audio = this.sounds[type];
    if (audio) {
      // Clone the node to allow overlapping sounds (e.g. rapid draws)
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = type === 'draw' ? 0.2 : 0.4; // Draw sound should be quieter
      clone.play().catch(e => console.log('Audio play failed (user interaction required):', e));
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
  
  isEnabled() {
    return this.enabled;
  }
}

export const soundManager = new SoundManager();
