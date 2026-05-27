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
import { BossDifficulty, MatchType } from '../src/types';
import { Header } from './profile';
import Chip from '../src/components/Chip';

const labels: Record<BossDifficulty, string> = {
  facil: 'Fácil',
  medio: 'Médio',
  dificil: 'Difícil',
  impossivel: 'Impossível',
};
const difficulties = Object.entries(labels) as [BossDifficulty, string][];
const bossPlayersFor = (roomMatchType: MatchType) => roomMatchType === '3xBoss' ? 3 : 2;

export default function BossOnlineLobby() {
  const router = useRouter();
  const { bossDifficulty, matchType: initialMatchType } = useLocalSearchParams<{ bossDifficulty?: BossDifficulty; matchType?: MatchType }>();
  const initialDifficulty = bossDifficulty || 'facil';
  const lockedMatchType = initialMatchType === '2xBoss' || initialMatchType === '3xBoss' ? initialMatchType : undefined;
  const [mode, setMode] = useState<'home' | 'create' | 'join'>('home');
  const [matchType, setMatchType] = useState<MatchType>(lockedMatchType || '2xBoss');
  const [difficulty, setDifficulty] = useState<BossDifficulty>(initialDifficulty);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const goWithProfile = async (role: 'host' | 'guest' | 'spectator', roomCode: string, roomMatchType = matchType, roomDifficulty: BossDifficulty = difficulty) => {
    const p = await Storage.getProfile();
    if (roomMatchType === '1xBoss') {
      router.replace({
        pathname: '/boss-intro',
        params: { matchType: '1xBoss', turnMinutes: '0', bossDifficulty: roomDifficulty },
      });
      return;
    }
    router.replace({
      pathname: '/team-online-battle',
      params: {
        code: roomCode,
        turnMinutes: '30',
        playerName: (p?.name || 'Jogador').trim(),
        playerVillage: p?.village || '—',
        playerImage: p?.image || '',
        bossMode: '1',
        bossDifficulty: roomDifficulty,
        matchType: roomMatchType,
        team: 'team1',
        leader: role === 'host' ? '1' : '0',
        spectator: role === 'spectator' ? '1' : '0',
      },
    });
  };

  const createRoom = async () => {
    setErrMsg('');
    try {
      setBusy(true);
      const res = await apiCreateRoom(30, { matchType, bossMode: true, bossDifficulty: difficulty, maxPlayers: bossPlayersFor(matchType) });
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
      const roomMatch = (info.config?.matchType || matchType) as MatchType;
      const roomDifficulty = ((info.config?.bossDifficulty || difficulty) as BossDifficulty);
      if (info.full) {
        const fullMessage = 'Sala cheia. Você pode assistir como espectador.';
        setErrMsg(fullMessage);
        Alert.alert('Sala cheia', fullMessage);
        return goWithProfile('spectator', c, roomMatch, roomDifficulty);
      }
      await goWithProfile('guest', c, roomMatch, roomDifficulty);
    } catch (e: any) {
      setBusy(false);
      const m = String(e?.message || '').includes('Sala não encontrada')
        ? 'Sala não encontrada. Verifique o código e tente novamente.'
        : e?.message || 'Sala não encontrada. Verifique o código e tente novamente.';
      setErrMsg(m);
      Alert.alert('Erro', m);
    }
  };

  const spectateRoom = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return Alert.alert('Atenção', 'Digite um código válido.');
    try {
      setBusy(true);
      const info = await apiCheckRoom(c);
      setBusy(false);
      await goWithProfile('spectator', c, (info.config?.matchType || matchType) as MatchType, (info.config?.bossDifficulty || difficulty) as BossDifficulty);
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
          <Text style={styles.bannerText}>MxH Online — Boss sincronizado</Text>
          <Text style={styles.bannerSub}>Kael’Zor • {labels[difficulty]} • cards reais, ENE e turnos em rede</Text>
        </View>
      </View>

      {mode === 'home' ? (
        <View style={{ gap: 14, marginTop: 8 }}>
          {lockedMatchType ? (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedText}>{lockedMatchType} • {labels[difficulty]}</Text>
              <Text style={styles.hint}>Você pode criar uma sala com esta configuração ou entrar em uma sala existente por código.</Text>
            </View>
          ) : null}
          <Button title="Criar Sala Boss" onPress={() => setMode('create')} testID="boss-online-create-mode-btn" />
          <Button title="Entrar em Sala Boss" variant="secondary" onPress={() => setMode('join')} testID="boss-online-join-mode-btn" />
          <Text style={styles.hint}>O líder gera a ação do Boss uma vez e a sala inteira recebe o mesmo card, cálculo e turno.</Text>
        </View>
      ) : null}

      {mode === 'create' ? (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.label}>Modo MxH</Text>
          {lockedMatchType ? (
            <View style={styles.lockedBox}>
              <Text style={styles.lockedText}>{lockedMatchType} • {labels[difficulty]}</Text>
              <Text style={styles.hint}>A sala será criada com este modo e esta dificuldade, sem nova seleção dentro da luta.</Text>
            </View>
          ) : (
            <View style={styles.row}>
              {(['2xBoss', '3xBoss'] as MatchType[]).map(item => (
                <Chip key={item} label={item} active={matchType === item} onPress={() => setMatchType(item)} testID={`boss-online-match-${item}`} />
              ))}
            </View>
          )}
          <Text style={styles.label}>Dificuldade</Text>
          <View style={styles.row}>
            {difficulties.map(([id, label]) => (
              <Chip key={id} label={label} active={difficulty === id} onPress={() => setDifficulty(id)} testID={`boss-online-difficulty-${id}`} />
            ))}
          </View>
          <Text style={styles.hint}>1xBoss é solo local. 2xBoss e 3xBoss usam sala online com Boss sincronizado. Tempo fixo: 30 min por turno.</Text>
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
          <Button title="Entrar como jogador" onPress={joinRoom} loading={busy} testID="boss-online-join-btn" />
          <Button title="Entrar como espectador" variant="secondary" onPress={spectateRoom} disabled={code.trim().length < 4} testID="boss-online-spectator-btn" />
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
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  lockedBox: { backgroundColor: 'rgba(255,59,0,0.08)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 10, marginBottom: 12 },
  lockedText: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'center' },
});
