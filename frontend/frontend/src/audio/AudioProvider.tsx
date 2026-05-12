import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AudioContextType = {
  muted: boolean;
  toggleMute: () => void;
};

const AudioContext = createContext<AudioContextType>({
  muted: false,
  toggleMute: () => {},
});

export const useAudioSystem = () => useContext(AudioContext);

export function AudioProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);

  const [muted, setMuted] = useState(false);

  async function loadMute() {
    const saved = await AsyncStorage.getItem('audio-muted');

    if (saved === 'true') {
      setMuted(true);
    }
  }

  async function toggleMute() {
    const next = !muted;

    setMuted(next);

    await AsyncStorage.setItem(
      'audio-muted',
      String(next)
    );

    if (soundRef.current) {
      await soundRef.current.setIsMutedAsync(next);
    }
  }

  async function playRandomMusic() {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const tracks = [
        require('./menu/menu1.mp3'),
        require('./menu/menu2.mp3'),
        require('./menu/menu3.mp3'),
      ];

      const random =
        tracks[Math.floor(Math.random() * tracks.length)];

      const { sound } =
        await Audio.Sound.createAsync(random, {
          shouldPlay: true,
          isLooping: false,
          volume: 1,
          isMuted: muted,
        });

      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate(async (status: any) => {
        if (status.didJustFinish) {
          playRandomMusic();
        }
      });
    } catch (e) {
      console.log('Audio error', e);
    }
  }

  useEffect(() => {
    loadMute();
  }, []);

  useEffect(() => {
    playRandomMusic();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [muted]);

  return (
    <AudioContext.Provider
      value={{
        muted,
        toggleMute,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}
