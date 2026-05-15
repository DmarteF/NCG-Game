import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import Chip from '../src/components/Chip';
import { theme } from '../src/theme';
import { apiCheckRoom, apiCreateRoom } from '../src/online';
import { Storage } from '../src/storage';
import { Header } from './profile';
import { Ionicons } from '@expo/vector-icons';
import { MatchType } from '../src/types';

const TIMES = [10, 20, 30];
const ONLINE_MATCHES: MatchType[] = ['1x1', '1x2', '2x2', '2x3', '3x3'];

export default function OnlineLobby() {
  const router = useRouter();
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [turnMinutes, setTurnMinutes] = useState(20);
  const [matchType, setMatchType] = useState<MatchType>('1x1');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const goWithProfile = async (role: 'host' | 'guest', roomCode: string, turn: number, roomMatch: MatchType = '1x1', team: 'team1' | 'team2' = 'team1') => {
    const p = await Storage.getProfile();
    const player = {
      name: (p?.name || 'Jogador').trim(),
      village: p?.village || '—',
      image: p?.image,
    };
    if (roomMatch === '1x1') {
      router.replace({
        pathname: '/online-battle',
        params: {
          role,
          code: roomCode,
          turnMinutes: String(turn),
          playerName: player.name,
          playerVillage: player.village,
          playerImage: player.image || '',
        },
      });
      return;
    }
    router.replace({
      pathname: '/team-online-battle',
      params: {
        code: roomCode,
        matchType: roomMatch,
        turnMinutes: String(turn),
        playerName: player.name,
        playerVillage: player.village,
        playerImage: player.image || '',
        team,
        leader: role === 'host' ? '1' : '0',
      },
    });
  };

  const createRoom = async () => {
    setErrMsg('');
    try {
      setBusy(true);
      const res = await apiCreateRoom(turnMinutes, { matchType });
      setBusy(false);
      await goWithProfile('host', res.code, turnMinutes, matchType, 'team1');
    } catch (e: any) {
      setBusy(false);
      const m = e?.message || 'Não foi possível criar a sala.';
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
      const roomMatch = (info.config?.matchType || '1x1') as MatchType;
      const team = roomMatch === '1x1'
        ? 'team2'
        : roomMatch === '1x2'
          ? 'team2'
          : (info.participants || []).filter(p => p.team === 'team1').length <= (info.participants || []).filter(p => p.team === 'team2').length
            ? 'team1'
            : 'team2';
      await goWithProfile('guest', c, info.config?.turnMinutes ?? 20, roomMatch, team);
    } catch (e: any) {
      setBusy(false);
      const m = e?.message || 'Sala não encontrada.';
      setErrMsg(m);
      Alert.alert('Erro', m);
    }
  };

  return (
    <Screen testID="online-screen">
      <Header title="Arena Online" onBack={() => router.back()} />

      <View style={styles.banner}>
        <Ionicons name="globe-outline" size={20} color={theme.colors.neon} />
        <Text style={styles.bannerText}>Multiplayer online — beta</Text>
      </View>

      {mode === 'home' && (
        <View style={{ gap: 14, marginTop: 8 }}>
          <Button title="Criar Sala" onPress={() => setMode('create')} testID="online-create-mode-btn" />
          <Button title="Entrar em Sala" variant="secondary" onPress={() => setMode('join')} testID="online-join-mode-btn" />
          <Text style={styles.hint}>
            1x1 usa o fluxo clássico. Equipes usam sala multi-jogador com relay, chat, cooldown e turnos por equipe.
          </Text>
        </View>
      )}

      {mode === 'create' && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.label}>Tempo por turno (host)</Text>
          <Text style={styles.label}>Tipo de luta</Text>
          <View style={styles.row}>
            {ONLINE_MATCHES.map(t => (
              <Chip key={t} label={t} active={t === matchType} onPress={() => setMatchType(t)} testID={`online-match-${t}`} />
            ))}
          </View>
          <View style={{ height: 12 }} />
          <Text style={styles.label}>Tempo por turno (host)</Text>
          <View style={styles.row}>
            {TIMES.map(t => (
              <Chip key={t} label={`${t} min`} active={t === turnMinutes} onPress={() => setTurnMinutes(t)} testID={`online-time-${t}`} />
            ))}
          </View>
          <View style={{ height: 16 }} />
          <Button title="Gerar código da sala" onPress={createRoom} loading={busy} testID="online-create-btn" />
          <View style={{ height: 8 }} />
          <Pressable onPress={() => setMode('home')} testID="online-back-mode-btn"><Text style={styles.back}>← Voltar</Text></Pressable>
        </View>
      )}

      {mode === 'join' && (
        <View style={{ marginTop: 8 }}>
          <Input
            label="Código da sala"
            value={code}
            onChangeText={(t) => { setErrMsg(''); setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)); }}
            placeholder="EX: K7B9X2"
            autoCapitalize="characters"
            testID="online-code-input"
          />
          {errMsg ? <Text style={styles.errorText} testID="online-error-text">{errMsg}</Text> : null}
          <Button title="Entrar" onPress={joinRoom} loading={busy} testID="online-join-btn" />
          <View style={{ height: 8 }} />
          <Pressable onPress={() => setMode('home')} testID="online-back-mode-btn-2"><Text style={styles.back}>← Voltar</Text></Pressable>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  bannerText: { color: theme.colors.neon, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  back: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 4 },
  hint: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  errorText: { color: theme.colors.danger, fontSize: 12, fontWeight: '700', marginBottom: 10 },
});
