import React, { useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { musicTracks } from '../musicTracks';
import { theme } from '../theme';
import { subscribeGlobalMusic } from '../musicControl';

export default function GlobalMusicPlayer() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const soundRef = useRef<Audio.Sound | null>(null);
  const durationRef = useRef(0);
  const barWidthRef = useRef(1);
  const playingRef = useRef(false);
  const suspendedWasPlayingRef = useRef(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(0);
  const isBattleScreen = pathname.includes('battle');

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => subscribeGlobalMusic((action) => {
    if (action === 'suspend') {
      suspendedWasPlayingRef.current = playingRef.current;
      setPlaying(false);
      return;
    }
    if (suspendedWasPlayingRef.current) setPlaying(true);
    suspendedWasPlayingRef.current = false;
  }), []);

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
          if ('isLoaded' in status && status.isLoaded) {
            setPositionMillis(status.positionMillis || 0);
            setDurationMillis(status.durationMillis || 0);
            durationRef.current = status.durationMillis || 0;
          }
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

  const next = () => { setPositionMillis(0); setTrackIndex((i) => (i + 1) % musicTracks.length); };
  const prev = () => { setPositionMillis(0); setTrackIndex((i) => (i - 1 + musicTracks.length) % musicTracks.length); };
  const seekToRatio = (ratio: number) => {
    const duration = durationRef.current;
    if (!duration || !soundRef.current) return;
    const nextPosition = Math.max(0, Math.min(duration, Math.round(duration * ratio)));
    setPositionMillis(nextPosition);
    soundRef.current.setPositionAsync(nextPosition).catch(() => {});
  };
  const seekFromEvent = (event: GestureResponderEvent) => {
    seekToRatio(event.nativeEvent.locationX / Math.max(1, barWidthRef.current));
  };
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => seekFromEvent(event),
    onPanResponderMove: (event) => seekFromEvent(event),
  })).current;
  const progress = durationMillis ? Math.max(0, Math.min(1, positionMillis / durationMillis)) : 0;

  return (
    <View style={[styles.player, expanded && styles.playerExpanded, { top: insets.top + (isBattleScreen ? 88 : 10) }]} pointerEvents="box-none">
      <View style={styles.controls}>
        <Pressable onPress={prev} style={styles.iconBtn} testID="music-prev">
          <Ionicons name="play-skip-back" size={16} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setPlaying((p) => !p)} onLongPress={() => setExpanded((e) => !e)} style={styles.mainBtn} testID="music-toggle">
          <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" />
          <Text style={styles.track}>{trackIndex + 1}/{musicTracks.length}</Text>
        </Pressable>
        <Pressable onPress={next} style={styles.iconBtn} testID="music-next">
          <Ionicons name="play-skip-forward" size={16} color="#fff" />
        </Pressable>
        <Pressable onPress={() => setExpanded((e) => !e)} style={styles.iconBtn} testID="music-progress-toggle">
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#fff" />
        </Pressable>
      </View>
      {expanded ? (
        <Pressable
          onPress={seekFromEvent}
          onLayout={(event) => {
            const width = Math.max(1, event.nativeEvent.layout.width);
            barWidthRef.current = width;
          }}
          style={styles.progressWrap}
          testID="music-progress-bar"
          {...panResponder.panHandlers}
        >
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.time}>{fmt(positionMillis)} / {fmt(durationMillis)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function fmt(ms: number) {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  player: {
    position: 'absolute',
    right: 10,
    zIndex: 50,
    gap: 4,
    backgroundColor: 'rgba(20,10,10,0.92)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 5,
    width: 166,
  },
  playerExpanded: { width: 214 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' },
  mainBtn: { height: 28, flex: 1, borderRadius: 14, paddingHorizontal: 8, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary },
  track: { color: '#fff', fontWeight: '900', fontSize: 10 },
  progressWrap: { paddingHorizontal: 2, paddingVertical: 2, paddingTop: 5 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.16)' },
  progressFill: { height: '100%', backgroundColor: theme.colors.neon },
  time: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' },
});
