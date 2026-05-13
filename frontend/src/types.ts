import { Attr, Rank } from './theme';

export type Profile = {
  name: string;
  village: string;
  image?: string;
};

export type AttrValues = Partial<Record<Attr, number>>;
export type UnlimitedFlags = Partial<Record<Attr, boolean>>;

export type CardEffect =
  | 'none'
  | 'cost'
  | 'boost'
  | 'cost_boost'
  | 'unlimited';

export type Card = {
  id: string;

  // nome do card
  name: string;

  // rank do card
  // S-R = utilizável por qualquer C.T
  rank?: Rank | 'S-R';

  // descrição/legenda
  caption: string;

  // imagem
  image?: string;

  // tipo do efeito
  effect: CardEffect;

  // custos
  cost: AttrValues;

  // boosts
  boost: AttrValues;

  // ilimitado
  unlimited: UnlimitedFlags;
};

export type CT = {
  id: string;

  name: string;

  // rank do C.T
  rank: Rank;

  image?: string;

  attrs: Record<Attr, number>;

  unlimited: UnlimitedFlags;
};

export type MatchType =
  | '1x1'
  | '1x2'
  | '2x2'
  | '3x1'
  | '3x2'
  | '3x3'
  | '1xBoss'
  | '2xBoss'
  | '3xBoss';

export type BattleConfig = {
  matchType: MatchType;
  turnMinutes: number | null;
  startedAt: number;
};

export type PlayedCard = {
  cardSnapshot: Card;
};

export type ChatMsg = {
  id: string;

  turn: number;

  team: 'team1' | 'team2' | 'system';

  timestamp: number;

  text?: string;

  playedCards?: PlayedCard[];

  ctSnapshot?: CT;

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
