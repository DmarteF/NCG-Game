import { Audio } from 'expo-av';

const musics = [
  require('../audio/1.mp3'),
  require('../audio/2.mp3'),
  require('../audio/3.mp3'),
  require('../audio/4.mp3'),
  require('../audio/5.mp3'),
  require('../audio/6.mp3'),
  require('../audio/7.mp3'),
  require('../audio/8.mp3'),
  require('../audio/9.mp3'),
  require('../audio/10.mp3'),
];

class AudioManager {
  private sound: Audio.Sound | null = null;
  private muted = false;
  private started = false;

  async play() {
    try {
      if (this.started) return;

      this.started = true;

      const randomMusic = musics[Math.floor(Math.random() * musics.length)];

      const { sound } = await Audio.Sound.createAsync(randomMusic, {
        shouldPlay: true,
        isLooping: true,
        volume: this.muted ? 0 : 0.35,
      });

      this.sound = sound;
    } catch (e) {
      console.log('Audio error:', e);
    }
  }

  async stop() {
    try {
      if (!this.sound) return;

      await this.sound.stopAsync();
      await this.sound.unloadAsync();

      this.sound = null;
      this.started = false;
    } catch {}
  }

  async toggleMute() {
    this.muted = !this.muted;

    if (this.sound) {
      await this.sound.setIsMutedAsync(this.muted);
    }
  }

  isMuted() {
    return this.muted;
  }
}

export default new AudioManager();
