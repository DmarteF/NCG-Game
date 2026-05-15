import React, { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../src/components/Button';
import Screen from '../src/components/Screen';
import { restoreGlobalMusic, suspendGlobalMusic } from '../src/musicControl';
import { theme } from '../src/theme';
import { MatchType } from '../src/types';

export default function BossIntro() {
  const router = useRouter();
  const { matchType, turnMinutes } = useLocalSearchParams<{ matchType: MatchType; turnMinutes: string }>();
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;
    suspendGlobalMusic();
    Audio.Sound.createAsync(require('../Boss.mp3'), {
      shouldPlay: true,
      isLooping: true,
      volume: 0.55,
    }).then(({ sound }) => {
      if (!mounted) {
        sound.unloadAsync().catch(() => {});
        return;
      }
      soundRef.current = sound;
    }).catch(() => {});

    return () => {
      mounted = false;
      soundRef.current?.stopAsync().catch(() => {});
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
      restoreGlobalMusic();
    };
  }, []);

  const proceed = async () => {
    await soundRef.current?.stopAsync().catch(() => {});
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    restoreGlobalMusic();
    router.replace({
      pathname: '/battle',
      params: { matchType, turnMinutes: turnMinutes || '0' },
    });
  };

  return (
    <Screen testID="boss-intro-screen">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Abismo Vermelho</Text>
        <Text style={styles.title}>{"Kael'Zor"}</Text>
        <Text style={styles.subtitle}>Fragmento Selado do Vazio</Text>
      </View>

      <ScrollView style={styles.storyBox} contentContainerStyle={styles.storyContent}>
        <Text style={styles.story}>
          Durante uma ruptura impossível no tecido do espaço-tempo, uma fenda se abriu entre o mundo shinobi e uma dimensão esquecida pelo próprio chakra.
        </Text>
        <Text style={styles.story}>
          Do outro lado não havia uma vila, nem uma nação, nem uma besta com cauda.
        </Text>
        <Text style={styles.story}>Havia apenas o Vazio.</Text>
        <Text style={styles.story}>
          {"Preso por selos antigos, Kael'Zor despertou ao sentir o chakra dos shinobi atravessando sua prisão. Cada batalha enfraquece um fragmento do selo que mantém sua verdadeira forma adormecida."}
        </Text>
        <Text style={styles.story}>
          Agora, os ninjas foram puxados para o Abismo Vermelho, um campo onde chakra e energia do vazio colidem.
        </Text>
        <Text style={styles.story}>
          Para retornar ao mundo shinobi, será necessário enfrentar o Fragmento Selado do Vazio antes que ele recupere seu trono.
        </Text>
      </ScrollView>

      <Button title="Prosseguir" onPress={proceed} testID="boss-intro-proceed" style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 190,
    justifyContent: 'flex-end',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#130205',
    borderWidth: 1,
    borderColor: 'rgba(255,59,0,0.45)',
  },
  eyebrow: { color: theme.colors.neon, fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#FFD7B5', fontSize: 14, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  storyBox: { maxHeight: 360, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  storyContent: { padding: 16, gap: 12 },
  story: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
