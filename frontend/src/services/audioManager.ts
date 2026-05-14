import { Audio } from 'expo-av';
import { musicTracks } from '../musicTracks';

class AudioManager {
  private sound: Audio.Sound | null = null;
  private muted = false;
  private started = false;

  async play() {
    try {
      if (this.started) return;

      this.started = true;

      if (musicTracks.length === 0) return;

      const randomMusic = musicTracks[Math.floor(Math.random() * musicTracks.length)];

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
