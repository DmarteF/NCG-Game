import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import Screen from '../src/components/Screen';
import { apiCheckRoom, apiCreateRoom } from '../src/online';
import { Storage } from '../src/storage';
import { theme } from '../src/theme';
import { BossDifficulty } from '../src/types';
import { Header } from './profile';

const labels: Record<BossDifficulty, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
  impossivel: 'Impossível',
};

export default function BossOnlineLobby() {
  const router = useRouter();
  const { bossDifficulty } = useLocalSearchParams<{ bossDifficulty?: BossDifficulty }>();
  const difficulty = bossDifficulty || 'facil';
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const goWithProfile = async (role: 'host' | 'guest', roomCode: string) => {
    const p = await Storage.getProfile();
    router.replace({
      pathname: '/online-battle',
      params: {
        role,
        code: roomCode,
        turnMinutes: '0',
        playerName: (p?.name || 'Jogador').trim(),
        playerVillage: p?.village || '—',
        playerImage: p?.image || '',
        bossMode: '1',
        bossDifficulty: difficulty,
        matchType: '3xBoss',
      },
    });
  };

  const createRoom = async () => {
    setErrMsg('');
    try {
      setBusy(true);
      const res = await apiCreateRoom(0);
      setBusy(false);
      await goWithProfile('host', res.code);
    } catch (e: any) {
      setBusy(false);
      const m = e?.message || 'Não foi possível criar a sala Boss.';
      setErrMsg(m);
      Alert.alert('Erro', m);
    }
  };

  const joinRoom = async () => {
    setErrMsg('');
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setErrMsg('Digite um código válido.'); return Alert.alert('Atenção', 'Digite um código válido.'); }
    try {
      setBusy(true);
      const info = await apiCheckRoom(c);
      setBusy(false);
      if (info.full) { setErrMsg('Sala cheia.'); return Alert.alert('Sala cheia', 'Esta sala já está cheia.'); }
      await goWithProfile('guest', c);
    } catch (e: any) {
      setBusy(false);
      const m = e?.message || 'Sala não encontrada.';
      setErrMsg(m);
      Alert.alert('Erro', m);
    }
  };

  return (
    <Screen testID="boss-online-screen">
      <Header title="Boss Online" onBack={() => mode === 'home' ? router.back() : setMode('home')} />

      <View style={styles.banner}>
        <Ionicons name="skull-outline" size={20} color={theme.colors.neon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerText}>MxH Online — estrutura inicial</Text>
          <Text style={styles.bannerSub}>Kael’Zor • {labels[difficulty]} • HP/Atk/Def/Ag/ENE preparados</Text>
        </View>
      </View>

      {mode === 'home' ? (
        <View style={{ gap: 14, marginTop: 8 }}>
          <Button title="Criar Sala Boss" onPress={() => setMode('create')} testID="boss-online-create-mode-btn" />
          <Button title="Entrar em Sala Boss" variant="secondary" onPress={() => setMode('join')} testID="boss-online-join-mode-btn" />
          <Text style={styles.hint}>Usa o relay/WebSocket existente. O Boss fica manual por enquanto, sem IA avançada.</Text>
        </View>
      ) : null}

      {mode === 'create' ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.label}>Sala MxH</Text>
          <Button title="Gerar código da sala Boss" onPress={createRoom} loading={busy} testID="boss-online-create-btn" />
          <Pressable onPress={() => setMode('home')} testID="boss-online-back-mode-btn"><Text style={styles.back}>Voltar</Text></Pressable>
        </View>
      ) : null}

      {mode === 'join' ? (
        <View style={{ marginTop: 8 }}>
          <Input
            label="Código da sala"
            value={code}
            onChangeText={(t) => { setErrMsg(''); setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); }}
            placeholder="EX: K7B9X2"
            autoCapitalize="characters"
            testID="boss-online-code-input"
          />
          {errMsg ? <Text style={styles.errorText} testID="boss-online-error-text">{errMsg}</Text> : null}
          <Button title="Entrar" onPress={joinRoom} loading={busy} testID="boss-online-join-btn" />
          <Pressable onPress={() => setMode('home')} testID="boss-online-back-mode-btn-2"><Text style={styles.back}>Voltar</Text></Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  bannerText: { color: theme.colors.neon, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 },
  bannerSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 3 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  back: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 12 },
  hint: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  errorText: { color: theme.colors.danger, fontSize: 12, fontWeight: '700', marginBottom: 10 },
});
