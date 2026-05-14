import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import Chip from '../src/components/Chip';
import { Storage } from '../src/storage';
import { Card, CT } from '../src/types';
import { theme, ATTRS, CT_ATTRS, CARD_RANKS, CT_RANKS, CardRank, Rank } from '../src/theme';
import { Header } from './profile';
import { ctDisplayName, formatNumberBR } from '../src/format';

type Tab = 'cards' | 'ct';

export default function MenuCard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('cards');
  const [cards, setCards] = useState<Card[]>([]);
  const [cts, setCTs] = useState<CT[]>([]);
  const [query, setQuery] = useState('');
  const [cardRanks, setCardRanks] = useState<CardRank[]>([]);
  const [ctRanks, setCTRanks] = useState<Rank[]>([]);
  const [ctFilter, setCTFilter] = useState<'all' | string>('all');

  const reload = useCallback(() => {
    Storage.getCards().then(setCards);
    Storage.getCTs().then(setCTs);
  }, []);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const deleteCard = (c: Card) => {
    Alert.alert('Apagar card', `Apagar "${c.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
        const next = (await Storage.getCards()).filter(x => x.id !== c.id);
        await Storage.saveCards(next);
        reload();
      }},
    ]);
  };
  const deleteCT = (c: CT) => {
    Alert.alert('Apagar O C.T', `Apagar "${ctDisplayName(c)}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: async () => {
        const next = (await Storage.getCTs()).filter(x => x.id !== c.id);
        await Storage.saveCTs(next);
        reload();
      }},
    ]);
  };

  const toggleCardRank = (rank: CardRank) => setCardRanks((ranks) => (
    ranks.includes(rank) ? ranks.filter(r => r !== rank) : [...ranks, rank]
  ));
  const toggleCTRank = (rank: Rank) => setCTRanks((ranks) => (
    ranks.includes(rank) ? ranks.filter(r => r !== rank) : [...ranks, rank]
  ));
  const normalizedQuery = query.trim().toLowerCase();
  const visibleCards = cards.filter((card) => {
    const haystack = `${card.name} ${card.caption} ${card.rank || ''}`.toLowerCase();
    const queryOk = !normalizedQuery || haystack.includes(normalizedQuery);
    const rankOk = cardRanks.length === 0 || cardRanks.includes(card.rank || 'E');
    const ctOk = ctFilter === 'all' || canCTUseCard(cts.find(ct => ct.id === ctFilter), card);
    return queryOk && rankOk && ctOk;
  });
  const visibleCTs = cts.filter((ct) => {
    const summary = CT_ATTRS.map(a => `${a}:${formatNumberBR(ct.attrs[a] ?? 0)}`).join(' ');
    const haystack = `${ctDisplayName(ct)} ${ct.rank} ${summary}`.toLowerCase();
    const queryOk = !normalizedQuery || haystack.includes(normalizedQuery);
    const rankOk = ctRanks.length === 0 || ctRanks.includes(ct.rank);
    return queryOk && rankOk;
  });

  return (
    <Screen scroll={false} testID="menu-card-screen">
      <Header title="Menu Card" onBack={() => router.back()} />

      <View style={styles.tabs}>
        <TabBtn label="Cards" active={tab==='cards'} onPress={() => setTab('cards')} testID="tab-cards" />
        <TabBtn label="O C.T" active={tab==='ct'} onPress={() => setTab('ct')} testID="tab-ct" />
      </View>

      <Input
        label="Busca"
        value={query}
        onChangeText={setQuery}
        placeholder={tab === 'cards' ? 'Nome, legenda ou rank do card' : 'Nome, rank ou atributo do O C.T'}
        testID="menu-search-input"
      />

      {tab === 'cards' ? (
        <View style={styles.filters}>
          <Text style={styles.filterTitle}>Rank do card</Text>
          <View style={styles.chipsRow}>
            {CARD_RANKS.map(r => <Chip key={r} label={r} active={cardRanks.includes(r)} onPress={() => toggleCardRank(r)} testID={`filter-card-rank-${r}`} />)}
          </View>
          <Text style={styles.filterTitle}>Compatível com O C.T</Text>
          <View style={styles.chipsRow}>
            <Chip label="Todos" active={ctFilter === 'all'} onPress={() => setCTFilter('all')} testID="filter-ct-all" />
            {cts.map(ct => <Chip key={ct.id} label={ctDisplayName(ct)} active={ctFilter === ct.id} onPress={() => setCTFilter(ct.id)} testID={`filter-ct-${ct.id}`} />)}
          </View>
        </View>
      ) : (
        <View style={styles.filters}>
          <Text style={styles.filterTitle}>Rank do O C.T</Text>
          <View style={styles.chipsRow}>
            {CT_RANKS.map(r => <Chip key={r} label={r} active={ctRanks.includes(r)} onPress={() => toggleCTRank(r)} testID={`filter-ct-rank-${r}`} />)}
          </View>
        </View>
      )}

      {tab === 'cards' ? (
        <FlatList
          data={visibleCards}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
          ListEmptyComponent={<Empty text="Nenhum card criado ainda." />}
          renderItem={({ item }) => (
            <CardItem card={item}
              onEdit={() => router.push({ pathname: '/card-edit', params: { id: item.id } })}
              onDelete={() => deleteCard(item)} />
          )}
        />
      ) : (
        <FlatList
          data={visibleCTs}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ paddingBottom: 100, gap: 12 }}
          ListEmptyComponent={<Empty text="Nenhum O C.T criado ainda." />}
          renderItem={({ item }) => (
            <CTItem ct={item}
              onEdit={() => router.push({ pathname: '/ct-edit', params: { id: item.id } })}
              onDelete={() => deleteCT(item)} />
          )}
        />
      )}

      <View style={styles.fab}>
        <Button
          title={tab === 'cards' ? '+ Novo Card' : '+ Novo O C.T'}
          onPress={() => router.push(tab === 'cards' ? '/card-edit' : '/ct-edit')}
          testID="fab-new-btn"
        />
      </View>
    </Screen>
  );
}

function TabBtn({ label, active, onPress, testID }: any) {
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => [styles.tab, active && styles.tabActive, { opacity: pressed ? 0.85 : 1 }]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>;
}

function CardItem({ card, onEdit, onDelete }: { card: Card; onEdit: () => void; onDelete: () => void }) {
  const effects = describeCardEffects(card);
  return (
    <View style={styles.item} testID={`card-item-${card.id}`}>
      <View style={styles.thumbWrap}>
        {card.image ? <Image source={{ uri: card.image }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback]}><Ionicons name="albums" size={24} color={theme.colors.primary} /></View>}
        <RankBadge rank={card.rank || 'E'} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{card.name || 'Sem nome'}</Text>
        <Text style={styles.itemSub} numberOfLines={2}>{card.caption || 'Sem legenda'}</Text>
        <Text style={styles.itemEffects}>Speed: {card.speed ?? 0}</Text>
        {card.entityType ? <Text style={styles.itemEffects}>{card.entityType}</Text> : null}
        {effects ? <Text style={styles.itemEffects} numberOfLines={2}>{effects}</Text> : null}
      </View>
      <View style={styles.itemActions}>
        <IconBtn icon="create-outline" onPress={onEdit} testID={`edit-${card.id}`} />
        <IconBtn icon="trash-outline" onPress={onDelete} danger testID={`delete-${card.id}`} />
      </View>
    </View>
  );
}

function CTItem({ ct, onEdit, onDelete }: { ct: CT; onEdit: () => void; onDelete: () => void }) {
  const summary = CT_ATTRS.map(a => `${a}:${formatNumberBR(ct.attrs[a] ?? 0)}`).join(' • ');
  return (
    <View style={styles.item} testID={`ct-item-${ct.id}`}>
      <View style={styles.thumbWrap}>
        {ct.image ? <Image source={{ uri: ct.image }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback]}><Ionicons name="shield" size={24} color={theme.colors.gold} /></View>}
        <RankBadge rank={ct.rank} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.itemTitle} numberOfLines={1}>{ctDisplayName(ct)}</Text>
        <Text style={styles.itemSub} numberOfLines={2}>{summary}</Text>
      </View>
      <View style={styles.itemActions}>
        <IconBtn icon="create-outline" onPress={onEdit} testID={`edit-ct-${ct.id}`} />
        <IconBtn icon="trash-outline" onPress={onDelete} danger testID={`delete-ct-${ct.id}`} />
      </View>
    </View>
  );
}

function IconBtn({ icon, onPress, danger, testID }: any) {
  return (
    <Pressable onPress={onPress} testID={testID} style={({ pressed }) => [styles.iconBtn, danger && styles.iconBtnDanger, { opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={18} color={danger ? '#FFD0D5' : theme.colors.primary} />
    </Pressable>
  );
}

function RankBadge({ rank }: { rank: CardRank | Rank }) {
  return <View style={[styles.rankBadge, rank === 'S-R' && styles.rankBadgeSpecial]}><Text style={styles.rankBadgeText}>{rank}</Text></View>;
}

function canCTUseCard(ct: CT | undefined, card: Card) {
  if (!ct) return true;
  if (ct.rank === 'B') return ['S-R', 'E', 'D', 'C', 'B'].includes(card.rank || 'E');
  const order: Record<CardRank, number> = { 'S-R': 0, E: 1, D: 2, C: 3, B: 4, A: 5, S: 6 };
  return order[card.rank || 'E'] <= order[ct.rank];
}

function describeCardEffects(card: Card): string {
  const parts: string[] = [];
  if (card.effect === 'none') return '';
  const cost = ATTRS.filter(a => card.cost[a] != null).map(a => `${a}:${formatNumberBR(card.cost[a])}`).join(',');
  const boost = ATTRS.filter(a => card.boost[a] != null).map(a => `${a}:${formatNumberBR(card.boost[a])}`).join(',');
  const unl = ATTRS.filter(a => card.unlimited[a]).map(a => `${a}:∞`).join(',');
  if (cost) parts.push(`Custo: ${cost}`);
  if (boost) parts.push(`Aumento: ${boost}`);
  if (unl) parts.push(`Ilimitado: ${unl}`);
  return parts.join('  •  ');
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: 'rgba(255,59,0,0.2)' },
  tabText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 1 },
  tabTextActive: { color: '#fff' },
  filters: { marginBottom: 12 },
  filterTitle: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  item: { flexDirection: 'row', gap: 12, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' },
  thumbWrap: { position: 'relative' },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: theme.colors.bg },
  thumbFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  rankBadge: { position: 'absolute', bottom: -6, right: -6, backgroundColor: theme.colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rankBadgeSpecial: { backgroundColor: theme.colors.gold },
  rankBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },
  itemTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  itemSub: { color: theme.colors.textSecondary, fontSize: 12 },
  itemEffects: { color: theme.colors.neon, fontSize: 11, fontWeight: '700' },
  itemActions: { gap: 6 },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,59,0,0.1)', borderWidth: 1, borderColor: theme.colors.border },
  iconBtnDanger: { backgroundColor: 'rgba(255,51,68,0.1)', borderColor: 'rgba(255,51,68,0.3)' },
  empty: { padding: 28, alignItems: 'center' },
  emptyText: { color: theme.colors.textMuted, fontSize: 13 },
  fab: { position: 'absolute', left: 20, right: 20, bottom: 20 },
});
