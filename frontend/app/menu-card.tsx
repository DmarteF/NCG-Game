import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import { Storage } from '../src/storage';
import { Card, CT } from '../src/types';
import { theme, ATTRS, RANK_ORDER } from '../src/theme';
import { Header } from './profile';

type Tab = 'cards' | 'ct';

export default function MenuCard() {
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('cards');
  const [cards, setCards] = useState<Card[]>([]);
  const [cts, setCTs] = useState<CT[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCT, setSelectedCT] = useState<CT | null>(null);

  const reload = useCallback(() => {
    Storage.getCards().then(setCards);
    Storage.getCTs().then((data) => {
      setCTs(data);

      if (!selectedCT && data.length > 0) {
        setSelectedCT(data[0]);
      }
    });
  }, [selectedCT]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const deleteCard = (c: Card) => {
    Alert.alert('Apagar card', `Apagar "${c.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          const next = (await Storage.getCards()).filter(
            (x) => x.id !== c.id
          );

          await Storage.saveCards(next);
          reload();
        },
      },
    ]);
  };

  const deleteCT = (c: CT) => {
    Alert.alert('Apagar O C.T', `Apagar "${c.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          const next = (await Storage.getCTs()).filter(
            (x) => x.id !== c.id
          );

          await Storage.saveCTs(next);
          reload();
        },
      },
    ]);
  };

  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      const matchesSearch = card.name
        .toLowerCase()
        .includes(search.toLowerCase());

      if (!selectedCT) return matchesSearch;

      const cardRank = card.rank || 'Sem Rank';

      if (cardRank === 'Sem Rank') {
        return matchesSearch;
      }

      return (
        matchesSearch &&
        RANK_ORDER[cardRank] <= RANK_ORDER[selectedCT.rank]
      );
    });
  }, [cards, search, selectedCT]);

  return (
    <Screen scroll={false} testID="menu-card-screen">
      <Header title="Menu Card" onBack={() => router.back()} />

      <View style={styles.tabs}>
        <TabBtn
          label="Cards"
          active={tab === 'cards'}
          onPress={() => setTab('cards')}
          testID="tab-cards"
        />

        <TabBtn
          label="O C.T"
          active={tab === 'ct'}
          onPress={() => setTab('ct')}
          testID="tab-ct"
        />
      </View>

      {tab === 'cards' && (
        <>
          <TextInput
            placeholder="Buscar card..."
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />

          {cts.length > 0 && (
            <View style={styles.ctSelector}>
              <Text style={styles.selectorTitle}>
                Filtrar pelo C.T:
              </Text>

              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={cts}
                keyExtractor={(i) => i.id}
                contentContainerStyle={{ gap: 10 }}
                renderItem={({ item }) => {
                  const active = selectedCT?.id === item.id;

                  return (
                    <Pressable
                      onPress={() => setSelectedCT(item)}
                      style={[
                        styles.ctChip,
                        active && styles.ctChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.ctChipText,
                          active && styles.ctChipTextActive,
                        ]}
                      >
                        {item.name} ({item.rank})
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          )}
        </>
      )}

      {tab === 'cards' ? (
        <FlatList
          data={filteredCards}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingBottom: 120,
            gap: 14,
          }}
          ListEmptyComponent={
            <Empty text="Nenhum card encontrado." />
          }
          renderItem={({ item }) => (
            <CardItem
              card={item}
              onEdit={() =>
                router.push({
                  pathname: '/card-edit',
                  params: { id: item.id },
                })
              }
              onDelete={() => deleteCard(item)}
            />
          )}
        />
      ) : (
        <FlatList
          data={cts}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{
            paddingBottom: 120,
            gap: 14,
          }}
          ListEmptyComponent={
            <Empty text="Nenhum O C.T criado ainda." />
          }
          renderItem={({ item }) => (
            <CTItem
              ct={item}
              onEdit={() =>
                router.push({
                  pathname: '/ct-edit',
                  params: { id: item.id },
                })
              }
              onDelete={() => deleteCT(item)}
            />
          )}
        />
      )}

      <View style={styles.fab}>
        <Button
          title={tab === 'cards' ? '+ Novo Card' : '+ Novo O C.T'}
          onPress={() =>
            router.push(
              tab === 'cards' ? '/card-edit' : '/ct-edit'
            )
          }
          testID="fab-new-btn"
        />
      </View>
    </Screen>
  );
}

function TabBtn({
  label,
  active,
  onPress,
  testID,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.tab,
        active && styles.tabActive,
        { opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[
          styles.tabText,
          active && styles.tabTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function CardItem({
  card,
  onEdit,
  onDelete,
}: {
  card: Card;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const effects = describeCardEffects(card);

  return (
    <View
      style={styles.item}
      testID={`card-item-${card.id}`}
    >
      <View style={styles.thumbWrap}>
        {card.image ? (
          <Image
            source={{ uri: card.image }}
            style={styles.thumb}
          />
        ) : (
          <View
            style={[
              styles.thumb,
              styles.thumbFallback,
            ]}
          >
            <Ionicons
              name="albums"
              size={26}
              color={theme.colors.primary}
            />
          </View>
        )}

        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>
            {card.rank || 'Sem Rank'}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={styles.itemTitle}
          numberOfLines={1}
        >
          {card.name || 'Sem nome'}
        </Text>

        <Text
          style={styles.itemSub}
          numberOfLines={2}
        >
          {card.caption || 'Sem legenda'}
        </Text>

        {effects ? (
          <Text
            style={styles.itemEffects}
            numberOfLines={3}
          >
            {effects}
          </Text>
        ) : null}
      </View>

      <View style={styles.itemActions}>
        <IconBtn
          icon="create-outline"
          onPress={onEdit}
          testID={`edit-${card.id}`}
        />

        <IconBtn
          icon="trash-outline"
          onPress={onDelete}
          danger
          testID={`delete-${card.id}`}
        />
      </View>
    </View>
  );
}

function CTItem({
  ct,
  onEdit,
  onDelete,
}: {
  ct: CT;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const summary = ATTRS.map(
    (a) =>
      `${a}:${ct.unlimited[a] ? '∞' : ct.attrs[a] ?? 0}`
  ).join(' • ');

  return (
    <View
      style={styles.item}
      testID={`ct-item-${ct.id}`}
    >
      <View style={styles.thumbWrap}>
        {ct.image ? (
          <Image
            source={{ uri: ct.image }}
            style={styles.thumb}
          />
        ) : (
          <View
            style={[
              styles.thumb,
              styles.thumbFallback,
            ]}
          >
            <Ionicons
              name="shield"
              size={26}
              color={theme.colors.gold}
            />
          </View>
        )}

        <View style={styles.rankBadge}>
          <Text style={styles.rankBadgeText}>
            {ct.rank}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, gap: 6 }}>
        <Text
          style={styles.itemTitle}
          numberOfLines={1}
        >
          {ct.name || 'Sem nome'}
        </Text>

        <Text
          style={styles.itemSub}
          numberOfLines={3}
        >
          {summary}
        </Text>
      </View>

      <View style={styles.itemActions}>
        <IconBtn
          icon="create-outline"
          onPress={onEdit}
          testID={`edit-ct-${ct.id}`}
        />

        <IconBtn
          icon="trash-outline"
          onPress={onDelete}
          danger
          testID={`delete-ct-${ct.id}`}
        />
      </View>
    </View>
  );
}

function IconBtn({
  icon,
  onPress,
  danger,
  testID,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.iconBtn,
        danger && styles.iconBtnDanger,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={
          danger
            ? '#FFD0D5'
            : theme.colors.primary
        }
      />
    </Pressable>
  );
}

function describeCardEffects(card: Card): string {
  const parts: string[] = [];

  if (card.effect === 'none') return '';

  const cost = ATTRS.filter(
    (a) => card.cost[a] != null
  )
    .map((a) => `${a}:${card.cost[a]}`)
    .join(',');

  const boost = ATTRS.filter(
    (a) => card.boost[a] != null
  )
    .map((a) => `${a}:${card.boost[a]}`)
    .join(',');

  const unl = ATTRS.filter(
    (a) => card.unlimited[a]
  )
    .map((a) => `${a}:∞`)
    .join(',');

  if (cost) parts.push(`Custo: ${cost}`);
  if (boost) parts.push(`Aumento: ${boost}`);
  if (unl) parts.push(`Ilimitado: ${unl}`);

  return parts.join('  •  ');
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.radius.pill,
  },

  tabActive: {
    backgroundColor: 'rgba(255,59,0,0.2)',
  },

  tabText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },

  tabTextActive: {
    color: '#fff',
  },

  searchInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    marginBottom: 14,
    fontSize: 15,
  },

  ctSelector: {
    marginBottom: 16,
    gap: 10,
  },

  selectorTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },

  ctChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  ctChipActive: {
    backgroundColor: 'rgba(255,59,0,0.25)',
    borderColor: theme.colors.primary,
  },

  ctChipText: {
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },

  ctChipTextActive: {
    color: '#fff',
  },

  item: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },

  thumbWrap: {
    position: 'relative',
  },

  thumb: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: theme.colors.bg,
  },

  thumbFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  rankBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },

  rankBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
  },

  itemTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 17,
  },

  itemSub: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },

  itemEffects: {
    color: theme.colors.neon,
    fontSize: 12,
    fontWeight: '700',
  },

  itemActions: {
    gap: 8,
  },

  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,0,0.1)',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },

  iconBtnDanger: {
    backgroundColor: 'rgba(255,51,68,0.1)',
    borderColor: 'rgba(255,51,68,0.3)',
  },

  empty: {
    padding: 28,
    alignItems: 'center',
  },

  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
  },

  fab: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
  },
});
