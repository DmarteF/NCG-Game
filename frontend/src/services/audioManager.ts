import { Audio } from 'expo-av';

class AudioManager {
  private sound: Audio.Sound | null = null;

  private muted = false;

  async play(source: any) {
    try {
      if (this.muted) return;

      // para música anterior
      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      }

      const { sound } =
        await Audio.Sound.createAsync(
          source,
          {
            shouldPlay: true,
            isLooping: true,
            volume: 0.35,
          }
        );

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
    } catch {}
  }

  async setMuted(value: boolean) {
    this.muted = value;

    if (this.sound) {
      await this.sound.setIsMutedAsync(value);
    }
  }

  isMuted() {
    return this.muted;
  }
}

export default new AudioManager();
