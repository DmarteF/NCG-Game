import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../src/components/Button';
import Screen from '../src/components/Screen';
import { restoreGlobalMusic, suspendGlobalMusic } from '../src/musicControl';
import { theme } from '../src/theme';
import { BossDifficulty, MatchType } from '../src/types';

const scenes = [
  {
    title: 'O Abismo Vermelho',
    text: [
      'Muito antes das grandes vilas shinobi, existia uma dimensão esquecida entre o chakra, o espaço e o vazio.',
      'Esse lugar era conhecido como Abismo Vermelho.',
      'Ali, a energia não obedecia às mesmas leis do mundo comum. Não era chakra, nem energia natural. Era ENE — a Energia do Vazio.',
      'Dessa dimensão nasceu Kael’Zor, um soberano moldado pelo próprio Abismo.',
    ],
  },
  {
    title: 'O Soberano do Vazio',
    text: [
      'Kael’Zor não se contentou em reinar apenas sobre o Abismo.',
      'Ao descobrir outros mundos, passou a atravessar dimensões, abrindo fendas rubras por onde sua energia invadia a realidade.',
      'Reinos caíram. Exércitos desapareceram. Continentes foram engolidos pelo vazio.',
      'Seu objetivo era transformar todos os mundos em extensões do seu trono.',
    ],
  },
  {
    title: 'O Grande Selo',
    text: [
      'Para impedir sua conquista, antigos mestres do espaço-tempo se uniram contra Kael’Zor.',
      'Eles perceberam que não poderiam destruí-lo completamente.',
      'Então decidiram selá-lo.',
      'Seu corpo foi fragmentado, sua coroa foi quebrada e seu verdadeiro poder foi preso em camadas de selos dimensionais.',
      'Kael’Zor não morreu. Ele apenas adormeceu, preso entre mundos, esperando o momento em que os selos começariam a falhar.',
    ],
  },
  {
    title: 'O Despertar',
    text: [
      'Séculos depois, o mundo shinobi começou a rasgar o espaço com batalhas, técnicas proibidas e colisões de chakra cada vez mais intensas.',
      'Uma dessas rachaduras alcançou a prisão de Kael’Zor.',
      'O fragmento selado despertou.',
      'Agora, os shinobi foram puxados para o Abismo Vermelho, onde chakra e ENE colidem.',
      'Kael’Zor ainda não recuperou sua forma verdadeira. Mas cada batalha enfraquece seus selos.',
      'Se ele retornar ao máximo poder, o mundo shinobi será engolido pelo vazio.',
      'Enfrente Kael’Zor. Impeça o despertar do Soberano do Vazio. Ou veja o mundo shinobi cair diante do Abismo Vermelho.',
    ],
  },
];

export default function BossIntro() {
  const router = useRouter();
  const { matchType, turnMinutes, bossDifficulty } = useLocalSearchParams<{ matchType: MatchType; turnMinutes: string; bossDifficulty?: BossDifficulty }>();
  const soundRef = useRef<Audio.Sound | null>(null);
  const restoredRef = useRef(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const scene = scenes[sceneIndex];

  useEffect(() => {
    let mounted = true;
    suspendGlobalMusic();
    Audio.Sound.createAsync(require('../assets/boss/Boss.mp3'), {
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
      if (!restoredRef.current) restoreGlobalMusic();
    };
  }, []);

  const proceed = async () => {
    await soundRef.current?.stopAsync().catch(() => {});
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    restoredRef.current = true;
    restoreGlobalMusic();
    router.replace({
      pathname: '/battle',
      params: { matchType, turnMinutes: turnMinutes || '0', bossDifficulty: bossDifficulty || 'facil' },
    });
  };

  return (
    <Screen testID="boss-intro-screen">
      <View style={styles.hero}>
        <View style={styles.scenePlate}>
          <Text style={styles.sceneNumber}>{sceneIndex + 1}</Text>
          <Text style={styles.sceneCount}>/4</Text>
        </View>
        <Text style={styles.eyebrow}>{scene.title}</Text>
        <Text style={styles.title}>Kael’Zor</Text>
        <Text style={styles.subtitle}>Fragmento Selado do Vazio</Text>
      </View>

      <ScrollView style={styles.storyBox} contentContainerStyle={styles.storyContent}>
        {scene.text.map((paragraph, index) => <Text key={index} style={[styles.story, index === scene.text.length - 1 && sceneIndex === 3 && styles.finalLine]}>{paragraph}</Text>)}
      </ScrollView>

      <View style={styles.navRow}>
        <Pressable onPress={proceed} testID="boss-intro-skip" style={styles.linkBtn}><Text style={styles.linkText}>Pular</Text></Pressable>
        <Pressable disabled={sceneIndex === 0} onPress={() => setSceneIndex(i => Math.max(0, i - 1))} testID="boss-intro-prev" style={[styles.linkBtn, sceneIndex === 0 && { opacity: 0.35 }]}><Text style={styles.linkText}>Voltar</Text></Pressable>
      </View>
      <Button
        title={sceneIndex === scenes.length - 1 ? 'Prosseguir' : 'Próximo'}
        onPress={() => sceneIndex === scenes.length - 1 ? proceed() : setSceneIndex(i => Math.min(scenes.length - 1, i + 1))}
        testID={sceneIndex === scenes.length - 1 ? 'boss-intro-proceed' : 'boss-intro-next'}
        style={{ marginTop: 12 }}
      />
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
  scenePlate: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.colors.border },
  sceneNumber: { color: '#fff', fontSize: 24, fontWeight: '900' },
  sceneCount: { color: theme.colors.neon, fontSize: 12, fontWeight: '900', marginBottom: 4 },
  eyebrow: { color: theme.colors.neon, fontSize: 11, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 },
  title: { color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: 1 },
  subtitle: { color: '#FFD7B5', fontSize: 14, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  storyBox: { maxHeight: 360, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  storyContent: { padding: 16, gap: 12 },
  story: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
  finalLine: { color: '#fff', fontWeight: '900' },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  linkBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  linkText: { color: theme.colors.neon, fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
});
