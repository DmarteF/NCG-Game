import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, CT, Profile, BattleHistoryItem } from './types';

const K = {
  profile: '@shinobi:profile',
  cards: '@shinobi:cards',
  cts: '@shinobi:cts',
  history: '@shinobi:history',
};

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function setJSON(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const Storage = {
  // profile
  getProfile: () => getJSON<Profile | null>(K.profile, null),
  saveProfile: (p: Profile) => setJSON(K.profile, p),

  // cards
  getCards: () => getJSON<Card[]>(K.cards, []),
  saveCards: (cards: Card[]) => setJSON(K.cards, cards),

  // cts
  getCTs: () => getJSON<CT[]>(K.cts, []),
  saveCTs: (cts: CT[]) => setJSON(K.cts, cts),

  // history
  getHistory: () => getJSON<BattleHistoryItem[]>(K.history, []),
  saveHistory: (h: BattleHistoryItem[]) => setJSON(K.history, h),
  appendHistory: async (item: BattleHistoryItem) => {
    const h = await getJSON<BattleHistoryItem[]>(K.history, []);
    h.unshift(item);
    await setJSON(K.history, h.slice(0, 50));
  },
};

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
