import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Chip from '../src/components/Chip';
import { theme } from '../src/theme';
import { MatchType } from '../src/types';
import { Storage } from '../src/storage';
import { Header } from './profile';

const NORMAL_MATCHES: MatchType[] = ['1x1', '1x2', '2x2', '3x1', '3x2', '3x3'];
const BOSS_MATCHES: MatchType[] = ['1xBoss', '2xBoss', '3xBoss'];
const TIMES = [10, 20, 30];

export default function Arena() {
  const router = useRouter();
  const [matchType, setMatchType] = useState<MatchType>('1x1');
  const [turnMinutes, setTurnMinutes] = useState<number>(20);
  const isBoss = matchType.includes('Boss');

  const start = async () => {
    const cts = await Storage.getCTs();
    if (cts.length === 0) {
      Alert.alert('Atenção', 'Crie pelo menos um C.T antes de iniciar a luta.');
      return;
    }
    router.push({
      pathname: '/battle',
      params: { matchType, turnMinutes: isBoss ? '0' : String(turnMinutes) },
    });
  };

  return (
    <Screen testID="arena-screen">
      <Header title="Arena" onBack={() => router.back()} />

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

      <Text style={[styles.label, { marginTop: 12 }]}>Contra Boss</Text>
      <View style={styles.row}>
        {BOSS_MATCHES.map(t => (
          <Chip key={t} label={t} active={t === matchType} onPress={() => setMatchType(t)} testID={`match-${t}`} />
        ))}
      </View>

      {!isBoss && (
        <>
          <Text style={[styles.label, { marginTop: 16 }]}>Tempo por turno</Text>
          <View style={styles.row}>
            {TIMES.map(t => (
              <Chip key={t} label={`${t} min`} active={t === turnMinutes} onPress={() => setTurnMinutes(t)} testID={`time-${t}`} />
            ))}
          </View>
        </>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryLine}>Modo: <Text style={styles.summaryVal}>Teste Local</Text></Text>
        <Text style={styles.summaryLine}>Tipo: <Text style={styles.summaryVal}>{matchType}</Text></Text>
        {!isBoss && <Text style={styles.summaryLine}>Tempo: <Text style={styles.summaryVal}>{turnMinutes} min/turno</Text></Text>}
      </View>

      <Pressable onPress={() => Alert.alert('Em breve', 'Modo online será implementado futuramente.')} style={styles.onlineHint} testID="arena-online-btn">
        <Text style={styles.onlineHintText}>Modo Online — em breve</Text>
      </Pressable>

      <Button title="Iniciar Luta" onPress={start} testID="arena-start-btn" style={{ marginTop: 16 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  subtitle: { color: theme.colors.neon, fontSize: 12, marginTop: 4, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { marginTop: 20, backgroundColor: 'rgba(255,59,0,0.07)', borderRadius: theme.radius.lg, padding: 14, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  summaryLine: { color: theme.colors.textSecondary, fontSize: 13 },
  summaryVal: { color: '#fff', fontWeight: '800' },
  onlineHint: { marginTop: 12, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  onlineHintText: { color: theme.colors.textMuted, fontSize: 12, letterSpacing: 1 },
});
