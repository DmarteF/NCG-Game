import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { musicTracks } from '../musicTracks';
import { theme } from '../theme';

export default function GlobalMusicPlayer() {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadTrack() {
      try {
        await soundRef.current?.unloadAsync();
        const { sound } = await Audio.Sound.createAsync(musicTracks[trackIndex], {
          shouldPlay: playing,
          isLooping: false,
          volume: 0.35,
        });
        sound.setOnPlaybackStatusUpdate((status) => {
          if ('didJustFinish' in status && status.didJustFinish) {
            setTrackIndex((i) => (i + 1) % musicTracks.length);
            setPlaying(true);
          }
        });
        if (mounted) soundRef.current = sound;
      } catch {}
    }
    loadTrack();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackIndex]);

  useEffect(() => {
    if (!soundRef.current) return;
    if (playing) soundRef.current.playAsync().catch(() => {});
    else soundRef.current.pauseAsync().catch(() => {});
  }, [playing]);

  const next = () => setTrackIndex((i) => (i + 1) % musicTracks.length);
  const prev = () => setTrackIndex((i) => (i - 1 + musicTracks.length) % musicTracks.length);

  return (
    <View style={styles.player} pointerEvents="box-none">
      <Pressable onPress={prev} style={styles.iconBtn} testID="music-prev">
        <Ionicons name="play-skip-back" size={16} color="#fff" />
      </Pressable>
      <Pressable onPress={() => setPlaying((p) => !p)} style={styles.mainBtn} testID="music-toggle">
        <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
        <Text style={styles.track}>{trackIndex + 1}</Text>
      </Pressable>
      <Pressable onPress={next} style={styles.iconBtn} testID="music-next">
        <Ionicons name="play-skip-forward" size={16} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  player: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(20,10,10,0.92)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 20,
    padding: 6,
  },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  mainBtn: { height: 32, minWidth: 50, borderRadius: 16, paddingHorizontal: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  track: { color: '#fff', fontWeight: '900', fontSize: 12 },
});
