import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Chip from '../src/components/Chip';
import { theme } from '../src/theme';
import { BossDifficulty, MatchType } from '../src/types';
import { Storage } from '../src/storage';
import { Header } from './profile';

const NORMAL_MATCHES: MatchType[] = ['1x1', '1x2', '2x2', '3x1', '3x2', '3x3'];
const TIMES = [10, 20, 30];
const DIFFICULTIES: { id: BossDifficulty; label: string; help: string }[] = [
  { id: 'facil', label: 'Fácil', help: 'Cards até Rank B' },
  { id: 'medio', label: 'Médio', help: 'Cards até Rank A' },
  { id: 'dificil', label: 'Difícil', help: 'Cards até Rank S' },
  { id: 'impossivel', label: 'Impossível', help: 'Cards até Rank S' },
];

type ArenaMode = 'select' | 'local' | 'mxh' | 'bossLocal' | 'bossOnline';

export default function Arena() {
  const router = useRouter();
  const [mode, setMode] = useState<ArenaMode>('select');
  const [matchType, setMatchType] = useState<MatchType>('1x1');
  const [turnMinutes, setTurnMinutes] = useState<number>(20);
  const [bossDifficulty, setBossDifficulty] = useState<BossDifficulty>('facil');

  const handleBack = () => {
    if (mode === 'local' || mode === 'mxh') {
      setMode('select');
      return;
    }
    if (mode === 'bossLocal' || mode === 'bossOnline') {
      setMode('mxh');
      return;
    }
    router.back();
  };

  const startLocal = async () => {
    const cts = await Storage.getCTs();
    if (cts.length === 0) {
      alert('Crie pelo menos um C.T antes de iniciar a luta.');
      return;
    }
    router.push({
      pathname: '/battle',
      params: { matchType, turnMinutes: String(turnMinutes) },
    });
  };

  const startBossLocal = async () => {
    const cts = await Storage.getCTs();
    if (cts.length === 0) {
      alert('Crie pelo menos um C.T antes de iniciar a luta.');
      return;
    }
    router.push({
      pathname: '/boss-intro',
      params: { matchType: '1xBoss', turnMinutes: '0', bossDifficulty },
    });
  };

  if (mode === 'select') {
    return (
      <Screen testID="arena-screen">
        <Header title="Arena" onBack={handleBack} />

        <View style={styles.panel}>
          <Text style={styles.title}>Arena</Text>
          <Text style={styles.subtitle}>Escolha o modo de batalha</Text>
        </View>

        <View style={styles.modeCards}>
          <Button
            title="Modo Local"
            onPress={() => setMode('local')}
            testID="arena-local-mode-btn"
          />
          <Text style={styles.modeHelp}>Teste e jogue no mesmo aparelho, controlando os lados manualmente.</Text>

          <Button
            title="Modo Online"
            onPress={() => router.push('/online')}
            variant="secondary"
            testID="arena-online-btn"
            style={{ marginTop: 8 }}
          />
          <Text style={styles.modeHelp}>Crie ou entre em uma sala online 1x1 usando código.</Text>

          <Button
            title="MxH"
            onPress={() => setMode('mxh')}
            variant="secondary"
            testID="arena-mxh-mode-btn"
            style={{ marginTop: 8 }}
          />
          <Text style={styles.modeHelp}>Enfrente Bosses no modo jogador contra monstro.</Text>
        </View>
      </Screen>
    );
  }

  if (mode === 'mxh') {
    return (
      <Screen testID="arena-mxh-screen">
        <Header title="MxH" onBack={handleBack} />

        <View style={styles.panel}>
          <Text style={styles.title}>MxH</Text>
          <Text style={styles.subtitle}>Jogador contra Boss</Text>
        </View>

        <View style={styles.modeCards}>
          <Button title="Boss Local" onPress={() => setMode('bossLocal')} testID="mxh-boss-local-btn" />
          <Text style={styles.modeHelp}>Luta 1x1 local contra Boss, com introdução e dificuldade.</Text>

          <Button title="Boss Online" variant="secondary" onPress={() => setMode('bossOnline')} testID="mxh-boss-online-btn" />
          <Text style={styles.modeHelp}>Estrutura inicial de sala para até 3 jogadores contra Boss.</Text>
        </View>
      </Screen>
    );
  }

  if (mode === 'bossLocal' || mode === 'bossOnline') {
    return (
      <Screen testID={mode === 'bossLocal' ? 'arena-boss-local-screen' : 'arena-boss-online-screen'}>
        <Header title={mode === 'bossLocal' ? 'Boss Local' : 'Boss Online'} onBack={handleBack} />

        <View style={styles.panel}>
          <Text style={styles.title}>{mode === 'bossLocal' ? 'Boss Local' : 'Boss Online'}</Text>
          <Text style={styles.subtitle}>Kael’Zor • ENE preparada</Text>
        </View>

        <Text style={styles.label}>Dificuldade</Text>
        <View style={styles.row}>
          {DIFFICULTIES.map(item => (
            <Chip key={item.id} label={item.label} active={item.id === bossDifficulty} onPress={() => setBossDifficulty(item.id)} testID={`boss-difficulty-${item.id}`} />
          ))}
        </View>
        <Text style={styles.modeHelp}>{DIFFICULTIES.find(item => item.id === bossDifficulty)?.help}</Text>

        <View style={styles.summary}>
          <Text style={styles.summaryLine}>Boss: <Text style={styles.summaryVal}>Kael’Zor</Text></Text>
          <Text style={styles.summaryLine}>Atributos preparados: <Text style={styles.summaryVal}>HP • Atk • Def • Ag • ENE</Text></Text>
          <Text style={styles.summaryLine}>Dificuldade: <Text style={styles.summaryVal}>{DIFFICULTIES.find(item => item.id === bossDifficulty)?.label}</Text></Text>
        </View>

        {mode === 'bossLocal' ? (
          <Button title="Iniciar Boss Local" onPress={startBossLocal} testID="boss-local-start-btn" style={{ marginTop: 16 }} />
        ) : (
          <Button title="Abrir Sala Boss Online" onPress={() => router.push({ pathname: '/boss-online', params: { bossDifficulty } })} testID="boss-online-open-btn" style={{ marginTop: 16 }} />
        )}
      </Screen>
    );
  }

  return (
    <Screen testID="arena-local-config-screen">
      <Header title="Modo Local" onBack={handleBack} />

      <View style={styles.panel}>
        <Text style={styles.title}>Teste Local</Text>
        <Text style={styles.subtitle}>Configure sua batalha</Text>
      </View>

      <Text style={styles.label}>Tipo de luta</Text>
      <View style={styles.row}>
        {NORMAL_MATCHES.map(t => (
          <Chip key={t} label={t} active={t === matchType} onPress={() => setMatchType(t)} testID={`match-${t}`} />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>Tempo por turno</Text>
      <View style={styles.row}>
        {TIMES.map(t => (
          <Chip key={t} label={`${t} min`} active={t === turnMinutes} onPress={() => setTurnMinutes(t)} testID={`time-${t}`} />
        ))}
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>Modo: <Text style={styles.summaryVal}>Local</Text></Text>
        <Text style={styles.summaryLine}>Tipo: <Text style={styles.summaryVal}>{matchType}</Text></Text>
        <Text style={styles.summaryLine}>Tempo: <Text style={styles.summaryVal}>{turnMinutes} min/turno</Text></Text>
      </View>

      <Button title="Iniciar Luta Local" onPress={startLocal} testID="arena-start-btn" style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: theme.colors.neon, fontSize: 12, marginTop: 4, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  modeCards: { gap: 10, marginTop: 8 },
  modeHelp: { color: theme.colors.textMuted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 10 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { marginTop: 20, backgroundColor: 'rgba(255,59,0,0.07)', borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  summaryLine: { color: theme.colors.textSecondary, fontSize: 13 },
  summaryVal: { color: '#fff', fontWeight: '800' },
});
