import { Attr, CardRank, Rank } from './theme';

export type Profile = {
  name: string;
  village: string;
  image?: string;
};

export type AttrValues = Partial<Record<Attr, number>>;
export type UnlimitedFlags = Partial<Record<Attr, boolean>>;

export type CardEffect = 'none' | 'cost' | 'boost' | 'cost_boost' | 'unlimited';
export type EntityType = 'invocação' | 'marionete' | 'edo tensei' | 'entidade' | 'criatura';

export type Card = {
  id: string;
  name: string;
  caption: string;
  image?: string;
  rank: CardRank;
  speed?: number;
  effect: CardEffect;
  entityType?: EntityType;
  entityAttrs?: Record<Attr, number>;
  entityUnlimited?: UnlimitedFlags;
  cost: AttrValues;
  boost: AttrValues;
  unlimited: UnlimitedFlags;
};

export type CT = {
  id: string;
  name: string;
  rank: Rank;
  image?: string;
  attrs: Record<Attr, number>;
  unlimited: UnlimitedFlags;
};

export type MatchType =
  | '1x1' | '1x2' | '2x2' | '3x1' | '3x2' | '3x3'
  | '1xBoss' | '2xBoss' | '3xBoss';

export type BattleConfig = {
  matchType: MatchType;
  turnMinutes: number | null;
  startedAt: number;
};

export type PlayedCard = {
  cardSnapshot: Card;
};

export type BattleEntity = {
  id: string;
  name: string;
  image?: string;
  rank: CardRank;
  attrs: Record<Attr, number>;
  unlimited: UnlimitedFlags;
  sourceCardId?: string;
  entityType?: EntityType;
};

export type ChatMsg = {
  id: string;
  turn: number;
  team: 'team1' | 'team2' | 'system';
  timestamp: number;
  text?: string;
  playedCards?: PlayedCard[];
  ctSnapshot?: CT;
  activeEntitySnapshot?: BattleEntity;
  ctObservation?: string;
  finalAttrs?: Record<Attr, number | 'ilimitado'>;
};

export type BattleHistoryItem = {
  id: string;
  config: BattleConfig;
  messages: ChatMsg[];
  endedAt: number;
  result: string;
};
