import { Attr, CardRank, Rank } from './theme';

export type Profile = {
  name: string;
  village: string;
  image?: string;
  backgroundImage?: string;
};

export type AttrValues = Partial<Record<Attr, number>>;
export type UnlimitedFlags = Partial<Record<Attr, boolean>>;

export type CardEffect = 'none' | 'cost' | 'boost' | 'cost_boost' | 'unlimited';
export type EntityType = 'invocação' | 'marionete' | 'edo tensei';
export type CardActionType = 'attribute' | 'attack' | 'defense' | 'equipment' | 'mode' | 'entity' | 'movement' | 'diverse_summon';
export type CardType = 'técnica' | 'modo/buff' | 'arma/equipamento' | 'invocação' | 'edo tensei' | 'marionete' | 'movimentação' | 'invocação diversa';
export type DurationType = 'instantâneo' | 'turnos' | 'persistente';
export type StackBehavior = 'stack' | 'replace';
export type CardSpeed = number | 'instant';
export type BossDifficulty = 'facil' | 'medio' | 'dificil' | 'impossivel';
export type MovementRange = 'curto' | 'médio' | 'longo' | 'global/dimensional';
export type MovementType = 'avanço' | 'recuo' | 'esquiva' | 'aproximação' | 'reposicionamento' | 'voo' | 'teleporte' | 'deslocamento dimensional';
export type DiverseSummonType = 'clone' | 'grupo' | 'enxame' | 'constructo' | 'invocação menor' | 'objeto invocado';
export type TargetShape = 'único' | 'área' | 'linha' | 'cone' | 'todos ao redor' | 'grupo';

export type BossStats = {
  Hp: number;
  Atk: number;
  Def: number;
  Ag: number;
  Ene: number;
};

export type Card = {
  id: string;
  name: string;
  caption: string;
  image?: string;
  rank: CardRank;
  speed?: CardSpeed;
  cardType?: CardType;
  actionType?: CardActionType;
  momentaryAttrs?: AttrValues;
  useCTInfluence?: boolean;
  movementRange?: MovementRange;
  movementType?: MovementType;
  summonType?: DiverseSummonType;
  summonQuantity?: number;
  summonHpIndividual?: number;
  summonHpTotal?: number;
  summonAtkIndividual?: number;
  summonDefIndividual?: number;
  targetCount?: number;
  maxTargets?: number;
  targetShape?: TargetShape;
  durationType?: DurationType;
  durationTurns?: number;
  upkeepCost?: AttrValues;
  stackBehavior?: StackBehavior;
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
  resourceName?: 'ENE';
  resourceValue?: number;
};

export type MatchType =
  | '1x1' | '1x2' | '2x2' | '2x3' | '3x1' | '3x2' | '3x3'
  | '1xBoss' | '2xBoss' | '3xBoss';

export type BattleConfig = {
  matchType: MatchType;
  turnMinutes: number | null;
  startedAt: number;
  bossDifficulty?: BossDifficulty;
};

export type PlayedCard = {
  cardSnapshot: Card;
};

export type MomentaryAction = {
  cardId: string;
  cardName: string;
  type: CardActionType;
  own: AttrValues;
  usedCTInfluence: boolean;
  final: AttrValues;
  source: 'ct' | 'entity';
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
  finalEntityAttrs?: Record<Attr, number | 'ilimitado'>;
  momentaryActions?: MomentaryAction[];
};

export type BattleHistoryItem = {
  id: string;
  config: BattleConfig;
  messages: ChatMsg[];
  endedAt: number;
  result: string;
};
