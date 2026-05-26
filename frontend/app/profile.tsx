import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import { Storage } from '../src/storage';
import { VILLAGES, theme } from '../src/theme';
import { BattleHistoryItem } from '../src/types';
import { copyOrShareHistory, exportHistoryPdf, exportHistoryText, exportSummaryCard, videoExportNotice } from '../src/historyExport';
import { battleUseLabel, ignoresCTAndModeDefense, ignoresCTDefense, targetShapeLabel } from '../src/normalize';

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [village, setVillage] = useState<string>('');
  const [image, setImage] = useState<string | undefined>();
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();
  const [history, setHistory] = useState<BattleHistoryItem[]>([]);
  const [replay, setReplay] = useState<BattleHistoryItem | null>(null);
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    Storage.getProfile().then((p) => {
      if (p) {
        setName(p.name);
        setVillage(p.village);
        setImage(p.image);
        setBackgroundImage(p.backgroundImage);
      }
    });
    Storage.getHistory().then(setHistory);
  }, []);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do personagem.');
    if (!(VILLAGES as readonly string[]).includes(village)) return Alert.alert('Atenção', 'Selecione uma vila válida.');
    await Storage.saveProfile({ name: name.trim(), village, image, backgroundImage });
    router.back();
  };

  return (
    <Screen testID="profile-screen">
      <Header title={image ? 'Editar Perfil' : 'Criar Perfil'} onBack={() => router.back()} />

      <View style={styles.avatarWrap}>
        <ImagePickerField
          value={image}
          onChange={setImage}
          size={140}
          shape="circle"
          label="Foto do personagem"
          testID="profile-image-picker"
        />
      </View>

      <Input
        label="Nome do personagem"
        value={name}
        onChangeText={setName}
        placeholder="Ex: Hiroshi"
        testID="profile-name-input"
        maxLength={32}
      />

      <Text style={styles.label}>Vila</Text>
      <View style={styles.villageRow}>
        {VILLAGES.map((v) => {
          const active = v === village;
          return (
            <Pressable
              key={v}
              onPress={() => setVillage(v)}
              testID={`village-${v}`}
              style={({ pressed }) => [
                styles.village,
                active && styles.villageActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.villageText, active && styles.villageTextActive]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.backgroundBlock}>
        <ImagePickerField
          value={backgroundImage}
          onChange={setBackgroundImage}
          size={180}
          shape="rect"
          label="Background do app"
          testID="profile-background-picker"
        />
        <Text style={styles.bgHint}>Usado como fundo global nas telas principais. Se remover, o app volta ao fundo padrão.</Text>
      </View>

      <View style={styles.replayBlock}>
        <Text style={styles.label}>Últimas lutas / Replays</Text>
        {history.length === 0 ? <Text style={styles.bgHint}>Nenhuma luta finalizada salva localmente.</Text> : null}
        {history.map((item, index) => (
          <View key={item.id} style={styles.replayItem}>
            <Text style={styles.replayTitle}>{index + 1}. {item.config.matchType} • {new Date(item.endedAt).toLocaleString()}</Text>
            <Text style={styles.bgHint}>{item.result || 'Sem resultado'}{item.config.bossDifficulty ? ` • Boss ${item.config.bossDifficulty}` : ''}</Text>
            <View style={styles.replayActions}>
              <Button title="Ver replay" variant="secondary" small onPress={() => { setReplay(item); setReplayIndex(0); }} />
              <Button title="Copiar histórico" small onPress={() => copyOrShareHistory(item)} />
              <Button title="Exportar PDF" small variant="secondary" onPress={() => exportHistoryPdf(item)} />
              <Button title="Apagar" variant="ghost" small onPress={async () => {
                const next = history.filter(saved => saved.id !== item.id);
                setHistory(next);
                await Storage.saveHistory(next);
              }} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} testID="profile-cancel-btn" />
        <Button title="Salvar" onPress={save} testID="profile-save-btn" style={{ flex: 1 }} />
      </View>

      <Modal visible={!!replay} transparent animationType="slide" onRequestClose={() => setReplay(null)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Header title="Replay espectador" onBack={() => setReplay(null)} />
            {replay ? <ReplaySpectator item={replay} index={replayIndex} setIndex={setReplayIndex} /> : null}
            {replay ? (
              <View style={styles.replayExportBar}>
                <Button title="Copiar histórico" small onPress={() => copyOrShareHistory(replay)} />
                <Button title="Exportar PDF" small variant="secondary" onPress={() => exportHistoryPdf(replay)} />
                <Button title="Exportar card resumo" small variant="secondary" onPress={() => exportSummaryCard(replay)} />
                <Button title="Exportar vídeo" small variant="ghost" onPress={videoExportNotice} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function ReplaySpectator({ item, index, setIndex }: { item: BattleHistoryItem; index: number; setIndex: (value: number) => void }) {
  const messages = item.messages;
  const current = messages[index];
  const started = new Date(item.config.startedAt).toLocaleString();
  const ended = new Date(item.endedAt).toLocaleString();
  const durationMs = Math.max(0, item.endedAt - item.config.startedAt);
  const duration = `${Math.floor(durationMs / 60000)}min ${Math.floor((durationMs % 60000) / 1000)}s`;
  const clamp = (value: number) => Math.max(0, Math.min(messages.length - 1, value));
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.spectatorHeader}>
        <Text style={styles.replayTitle}>{item.config.matchType} • {item.result || 'Sem resultado'}</Text>
        <Text style={styles.bgHint}>Início {started} • Fim {ended} • Duração {duration}{item.config.bossDifficulty ? ` • Boss ${item.config.bossDifficulty}` : ''}</Text>
      </View>
      <View style={styles.replayNav}>
        <Button title="Início" small variant="ghost" onPress={() => setIndex(0)} disabled={index === 0} />
        <Button title="Voltar" small variant="secondary" onPress={() => setIndex(clamp(index - 1))} disabled={index === 0} />
        <Text style={styles.replayCounter}>{messages.length ? `${index + 1}/${messages.length}` : '0/0'}</Text>
        <Button title="Avançar" small variant="secondary" onPress={() => setIndex(clamp(index + 1))} disabled={index >= messages.length - 1} />
        <Button title="Final" small variant="ghost" onPress={() => setIndex(messages.length - 1)} disabled={index >= messages.length - 1} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 20, gap: 8 }}>
        {current ? (
          <View style={styles.spectatorTurn}>
            <Text style={styles.replayTitle}>Turno {current.turn} • {current.team}</Text>
            {current.text ? <Text style={styles.replayText}>{current.text}</Text> : null}
            {(current.playedCards || []).map((played, cardIndex) => (
              <View key={`${played.cardSnapshot.id}-${cardIndex}`} style={styles.spectatorCard}>
                <Text style={styles.replayTitle}>{played.cardSnapshot.name} • Rank {played.cardSnapshot.rank || 'E'}</Text>
                {played.cardSnapshot.caption ? <Text style={styles.bgHint}>{played.cardSnapshot.caption}</Text> : null}
                <Text style={styles.bgHint}>{[
                  battleUseLabel(played.cardSnapshot),
                  targetShapeLabel(played.cardSnapshot.targetShape),
                  played.cardSnapshot.actualTargets ? `${played.cardSnapshot.actualTargets} alvos reais` : '',
                  ignoresCTAndModeDefense(played.cardSnapshot) ? 'ignora DEF C.T + Modo' : ignoresCTDefense(played.cardSnapshot) ? 'ignora DEF C.T' : '',
                ].filter(Boolean).join(' • ') || 'Card sem ajuste extra'}</Text>
              </View>
            ))}
            {(current.calculationDetails || []).length > 0 ? (
              <View style={styles.calcReplayBox}>
                {(current.calculationDetails || []).map((line, lineIndex) => <Text key={lineIndex} style={styles.bgHint}>{line}</Text>)}
              </View>
            ) : null}
          </View>
        ) : <Text style={styles.bgHint}>Replay vazio.</Text>}
        <Text style={styles.replayText}>{exportHistoryText(item)}</Text>
      </ScrollView>
    </View>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={hStyles.row}>
      <Pressable onPress={onBack} testID="header-back-btn" style={({ pressed }) => [hStyles.back, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
      </Pressable>
      <Text style={hStyles.title} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

const hStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
});

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginVertical: 16 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  villageRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  village: {
    flex: 1, minWidth: '30%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
  },
  villageActive: { backgroundColor: 'rgba(255,59,0,0.15)', borderColor: theme.colors.borderActive },
  villageText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  villageTextActive: { color: '#fff' },
  backgroundBlock: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  bgHint: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  replayBlock: { gap: 8, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, padding: 12, marginBottom: 10 },
  replayItem: { gap: 6, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: 10 },
  replayTitle: { color: '#fff', fontWeight: '900', fontSize: 12 },
  replayActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modalCard: { height: '86%', backgroundColor: theme.colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  replayText: { color: '#fff', fontSize: 12, lineHeight: 18 },
  spectatorHeader: { gap: 4, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: 'rgba(255,255,255,0.04)', marginBottom: 8 },
  replayNav: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  replayCounter: { color: '#fff', fontWeight: '900', fontSize: 12, minWidth: 44, textAlign: 'center' },
  spectatorTurn: { gap: 8, backgroundColor: 'rgba(0,0,0,0.22)', borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, padding: 10 },
  spectatorCard: { gap: 4, backgroundColor: 'rgba(255,59,0,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,59,0,0.24)', padding: 8 },
  calcReplayBox: { gap: 3, borderTopWidth: 1, borderColor: theme.colors.border, paddingTop: 8 },
  replayExportBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8, borderTopWidth: 1, borderColor: theme.colors.border },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
