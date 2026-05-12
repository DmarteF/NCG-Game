import { Audio } from 'expo-av';

const playlists = {
  menu: [
    require('../audio/menu/Naruto Shippuden 16 - Silhouette (Kana Boon)(MP3_128K).mp3'),
    require('../audio/menu/Naruto Shippuden 3 - Blue Bird(MP3_128K).mp3'),
    require('../audio/menu/Tipo Hashirama 🍁 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/menu/Tipo Hiruzen 🍂 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/menu/Tipo Jiraiya 🐸😈 (Naruto) _ Style Trap _ Prod. Sidney Scaccio x Johnny Lowd _ MHRAP(MP3_128K).mp3'),
    require('../audio/menu/Tipo Kisame 🦈 (Naruto) _ Samehada Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
  ],

  battle: [
    require('../audio/battle/Madara Flexzone 💀🔥 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/battle/Rap do Deidara ( Naruto ) _ Spider Beats 26(MP3_128K).mp3'),
    require('../audio/battle/Rap do Hashirama (Naruto) - O PRIMEIRO HOKAGE _ NERD HITS(MP3_128K).mp3'),
    require('../audio/battle/Rap do Itachi (Naruto) _ Tauz RapTributo 18(MP3_128K).mp3'),
    require('../audio/battle/Rap do Kakashi (Naruto) - AQUELE QUE COPIA OS 1.000 JUTSUS _ NERD HITS(MP3_128K).mp3'),
  ],

  arena: [
    require('../audio/arena/Tipo Narutin 🍜 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/arena/Tipo Pain 🔥 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/arena/Tipo Sasuke 😎 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/arena/Tipo Tobirama 🌊 (Naruto) _ Style Trap _ Prod. Sidney Scaccio x Johnny Lowd _ MHRAP(MP3_128K).mp3'),
    require('../audio/arena/Tipo Zetsu 🌗 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/arena/VIBE ZABUZA 💨 (Animes) _ MHRAP(MP3_128K).mp3'),
  ],

  online: [
    require('../audio/online/Rap do Sasuke Pt II (Naruto) _ Tauz RapTributo 19(MP3_128K).mp3'),
    require('../audio/online/Rap do Shisui (Naruto) _ Enygma 26 [prod. tunnA Beatz](MP3_128K).mp3'),
    require('../audio/online/Rap do Tobirama (Naruto) - SEGUNDO HOKAGE _ NERD HITS(MP3_128K).mp3'),
    require('../audio/online/Rap do Zabuza (Naruto) - O DEMÔNIO DA NÉVOA OCULTA _ NERD HITS(MP3_128K).mp3'),
    require('../audio/online/Rap dos Uchihas (Naruto) _ Sharingan _ EnyGroup 16(MP3_128K).mp3'),
    require('../audio/online/Seu pior Inimigo 2 _ Ft. VG Beats e Yuri Black _ Team Tauz 04 - Vendetta Beats(MP3_128K).mp3'),
    require('../audio/online/Tipo Kakashi 👁 (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
    require('../audio/online/Tipo Madara ☣️ (Naruto) _ Style Trap _ MHRAP(MP3_128K).mp3'),
    require('../audio/online/Tipo Minato ⚡️ (Naruto) _ Style Trap _ Prod. Sidney Scaccio _ MHRAP(MP3_128K).mp3'),
  ],
};

class AudioManager {
  private sound: Audio.Sound | null = null;
  private muted = false;
  private currentType = '';

  async play(type: keyof typeof playlists) {
    try {
      if (this.muted) return;

      if (this.currentType === type && this.sound) {
        return;
      }

      this.currentType = type;

      if (this.sound) {
        await this.sound.stopAsync();
        await this.sound.unloadAsync();
      }

      const playlist = playlists[type];

      const randomMusic =
        playlist[Math.floor(Math.random() * playlist.length)];

      const { sound } = await Audio.Sound.createAsync(
        randomMusic,
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
      this.currentType = '';
    } catch {}
  }

  async toggleMute() {
    this.muted = !this.muted;

    if (this.sound) {
      await this.sound.setIsMutedAsync(this.muted);
    }
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
