import { Image } from 'react-native';
import { formatNumberBR } from './format';
import { Attr } from './theme';
import { BossDifficulty, BossStats, Card, CardActionType, CardSpeed, CardType, CT, MovementRange, MovementType, SensoryType, TargetShape } from './types';

export type BossCardKind = 'perception' | 'mental' | 'movement' | 'defense' | 'equipment' | 'mode' | 'attack';

export type BossCard = {
  id: string;
  name: string;
  kind: BossCardKind;
  rank: 'B';
  image?: string;
  speed?: CardSpeed;
  atk?: number;
  def?: number;
  boost?: Partial<Record<'ENE' | Attr, number>>;
  cost?: Partial<Record<'ENE' | Attr, number>>;
  maxTargets?: number;
  targetShape?: TargetShape;
  movementRange?: MovementRange;
  movementType?: MovementType;
  sensoryType?: SensoryType;
  detectsUntilSpeed?: CardSpeed;
  reactionUntilSpeed?: CardSpeed;
  reducesSpeedBy?: number;
  detectsInvisibility?: boolean;
  detectsChakra?: boolean;
  detectsPresence?: boolean;
  tracksTarget?: boolean;
  tracksMovement?: boolean;
  cooldownTurns?: number;
  notes: string;
};

const assetUri = (asset: number) => Image.resolveAssetSource(asset).uri;

const BOSS_CT_IMAGE = assetUri(require('../assets/boss/CT_Boss.jpeg'));

const BOSS_CARD_IMAGES: Record<string, string> = {
  'selo-olho-abissal-boss': assetUri(require('../assets/boss/Selo_Boss.jpeg')),
  'olhos-vazio-rachado-boss': assetUri(require('../assets/boss/Olhos_Boss.jpeg')),
  'mente-vazia-boss': assetUri(require('../assets/boss/Mente_Boss.jpeg')),
  'passo-instavel-boss': assetUri(require('../assets/boss/Passo_Boss.jpeg')),
  'deslocamento-vazio-rachado-boss': assetUri(require('../assets/boss/Deslocamento_Boss.jpeg')),
  'barreira-rachada-boss': assetUri(require('../assets/boss/Barreira_Boss.jpeg')),
  'cupula-vazio-boss': assetUri(require('../assets/boss/Cupula_Boss.jpeg')),
  'reflexo-abissal-boss': assetUri(require('../assets/boss/Reflexo_Boss.jpeg')),
  'armadura-abismo-partido-boss': assetUri(require('../assets/boss/Armadura_Boss.jpeg')),
  'fragmento-vazio-boss': assetUri(require('../assets/boss/Fragmento_Boss.jpeg')),
  'corte-vazio-boss': assetUri(require('../assets/boss/Corte_Boss.jpeg')),
  'lanca-fragmentada-boss': assetUri(require('../assets/boss/Lanca_Boss.jpeg')),
  'chuva-estilhacos-rubros-boss': assetUri(require('../assets/boss/Chuva_Boss.jpeg')),
  'onda-abismo-partido-boss': assetUri(require('../assets/boss/Onda_Boss.jpeg')),
  'ruptura-vazio-menor-boss': assetUri(require('../assets/boss/Ruptura_Boss.jpeg')),
};

export type BossState = {
  name: string;
  title: string;
  rank: 'B';
  difficulty: BossDifficulty;
  stats: BossStats;
  lastAttackId?: string;
  activeCardIds: string[];
  cooldowns: Record<string, number>;
  bossMemory?: {
    lastPlayerCards: string[];
    playerUsesClones: boolean;
    playerUsesGenjutsu: boolean;
    playerUsesStrongMode: boolean;
    lastDamageTaken: number;
    threatScore: number;
  };
  turn: number;
};

export const KAELZOR_BASE_STATS: BossStats = {
  Hp: 500000,
  Atk: 600000,
  Def: 550000,
  Ag: 450000,
  Ene: 1000000,
};

export const KAELZOR_BOSS_CARDS: BossCard[] = [
  { id: 'selo-olho-abissal-boss', name: 'Selo do Olho Abissal', kind: 'perception', rank: 'B', speed: 5, cost: { ENE: 10000 }, sensoryType: 'percepção', detectsUntilSpeed: 5, reactionUntilSpeed: 5, detectsPresence: true, tracksMovement: true, notes: 'Persistente enquanto pagar 10.000 ENE por turno. Acompanha e permite reação contra ações até Speed 5; não defende sozinho.' },
  { id: 'olhos-vazio-rachado-boss', name: 'Olhos do Vazio Rachado', kind: 'perception', rank: 'B', speed: 5, cost: { ENE: 5000 }, sensoryType: 'reação', detectsUntilSpeed: 5, reactionUntilSpeed: 5, tracksTarget: true, notes: 'Reage a 1 ação por turno de até Speed 5. Precisa combinar com defesa, esquiva ou reação compatível.' },
  { id: 'mente-vazia-boss', name: 'Mente Vazia', kind: 'mental', rank: 'B', speed: 5, cost: { Ag: 5000 }, notes: 'Persistente enquanto pagar 5.000 AG por turno. Imunidade contra genjutsus comuns de até Rank B; não é imunidade absoluta.' },
  { id: 'passo-instavel-boss', name: 'Passo Instável', kind: 'movement', rank: 'B', speed: 3, cost: { ENE: 10000, Ag: 5000 }, movementRange: 'médio', movementType: 'reposicionamento', notes: 'Movimentação, esquiva, aproximação ou reposicionamento de curto a médio alcance, no solo ou no ar. Não causa dano.' },
  { id: 'deslocamento-vazio-rachado-boss', name: 'Deslocamento do Vazio Rachado', kind: 'movement', rank: 'B', speed: 5, cost: { ENE: 20000, Ag: 10000 }, movementRange: 'médio', movementType: 'deslocamento dimensional', notes: 'Movimentação defensiva ou reposicionamento em Speed 5, no solo ou no ar. Requer reação compatível contra ataques rápidos.' },
  { id: 'barreira-rachada-boss', name: 'Barreira Rachada', kind: 'defense', rank: 'B', speed: 3, def: 500000, cost: { ENE: 20000 }, targetShape: 'único', notes: 'Defesa frontal. Bloqueia até 500.000; dano excedente pode atravessar.' },
  { id: 'cupula-vazio-boss', name: 'Cúpula do Vazio', kind: 'defense', rank: 'B', speed: 3, def: 600000, cost: { ENE: 35000 }, maxTargets: 100, targetShape: 'área total', notes: 'Defesa de todos os lados. Bloqueia até 600.000; enquanto usa a cúpula, Kael’Zor não pode atacar.' },
  { id: 'reflexo-abissal-boss', name: 'Reflexo Abissal', kind: 'defense', rank: 'B', speed: 5, def: 500000, cost: { ENE: 40000, Ag: 10000 }, notes: 'Defesa instantânea com contra-ataque. Pode refletir até 500.000 de dano se Kael’Zor conseguir reagir à velocidade do ataque.' },
  { id: 'armadura-abismo-partido-boss', name: 'Armadura do Abismo Partido', kind: 'equipment', rank: 'B', def: 250000, boost: { Def: 250000 }, cost: { Ag: 10000 }, notes: 'Equipamento persistente até quebrar, remover ou desativar. Concede DEF +250.000 e não consome ENE para manter.' },
  { id: 'fragmento-vazio-boss', name: 'Fragmento do Vazio', kind: 'mode', rank: 'B', boost: { Atk: 200000, Def: 150000, Ag: 100000, ENE: 500000 }, notes: 'Modo base persistente que já começa ativo. Permite técnicas do vazio e não reaplica bônus várias vezes.' },
  { id: 'corte-vazio-boss', name: 'Corte do Vazio', kind: 'attack', rank: 'B', speed: 3, atk: 400000, cost: { ENE: 20000 }, maxTargets: 1, targetShape: 'único', notes: 'Ataque direto contra 1 alvo em alcance médio.' },
  { id: 'lanca-fragmentada-boss', name: 'Lança Fragmentada', kind: 'attack', rank: 'B', speed: 3, atk: 500000, cost: { ENE: 30000 }, maxTargets: 3, targetShape: 'área com quantidade', notes: 'Lanças de energia do vazio contra até 3 alvos. Cada alvo pode receber até 500.000 de dano.' },
  { id: 'chuva-estilhacos-rubros-boss', name: 'Chuva de Estilhaços Rubros', kind: 'attack', rank: 'B', speed: 2, atk: 550000, cost: { ENE: 45000 }, maxTargets: 20, targetShape: 'área com quantidade', notes: 'Ataque em área média contra até 20 alvos. Cada alvo pode receber até 550.000 de dano.' },
  { id: 'onda-abismo-partido-boss', name: 'Onda do Abismo Partido', kind: 'attack', rank: 'B', speed: 3, atk: 650000, cost: { ENE: 60000 }, maxTargets: 50, targetShape: 'área com quantidade', notes: 'Onda de energia em linha ou área direcionada, longo alcance, contra até 50 alvos.' },
  { id: 'ruptura-vazio-menor-boss', name: 'Ruptura do Vazio Menor', kind: 'attack', rank: 'B', speed: 2, atk: 800000, cost: { ENE: 80000 }, maxTargets: 100, targetShape: 'área com quantidade', cooldownTurns: 1, notes: 'Ataque mais forte do Kael’Zor Rank B. Grande área contra até 100 alvos. Não pode ser usada em turnos consecutivos.' },
];

export function createKaelzorState(difficulty: BossDifficulty = 'facil'): BossState {
  const fragment = bossCard('fragmento-vazio-boss');
  return {
    name: 'Kael’Zor',
    title: 'Fragmento Selado do Vazio',
    rank: 'B',
    difficulty,
    stats: {
      ...KAELZOR_BASE_STATS,
      Atk: KAELZOR_BASE_STATS.Atk + (fragment?.boost?.Atk || 0),
      Def: KAELZOR_BASE_STATS.Def + (fragment?.boost?.Def || 0),
      Ag: KAELZOR_BASE_STATS.Ag + (fragment?.boost?.Ag || 0),
      Ene: KAELZOR_BASE_STATS.Ene + (fragment?.boost?.ENE || 0),
    },
    activeCardIds: ['fragmento-vazio-boss'],
    cooldowns: {},
    bossMemory: {
      lastPlayerCards: [],
      playerUsesClones: false,
      playerUsesGenjutsu: false,
      playerUsesStrongMode: false,
      lastDamageTaken: 0,
      threatScore: 0,
    },
    turn: 1,
  };
}

export function createBossCT(state: BossState): CT {
  return {
    id: 'kaelzor-fragmento-boss',
    name: `${state.name} — ${state.title}`,
    rank: state.rank,
    image: BOSS_CT_IMAGE,
    attrs: {
      Atk: state.stats.Atk,
      Def: state.stats.Def,
      Dur: 0,
      Ag: state.stats.Ag,
      Ck: 0,
      Hp: state.stats.Hp,
    },
    unlimited: {},
    resourceName: 'ENE',
    resourceValue: state.stats.Ene,
  };
}

export function bossCard(id: string) {
  return KAELZOR_BOSS_CARDS.find(card => card.id === id);
}

function bossCardType(kind: BossCardKind): { cardType: CardType; actionType: CardActionType } {
  if (kind === 'attack') return { cardType: 'técnica', actionType: 'attack' };
  if (kind === 'movement') return { cardType: 'técnica', actionType: 'movement' };
  if (kind === 'perception') return { cardType: 'percepção/rastreamento/reação', actionType: 'perception' };
  if (kind === 'defense' || kind === 'mental') return { cardType: 'técnica', actionType: 'defense' };
  if (kind === 'equipment') return { cardType: 'arma/equipamento', actionType: 'equipment' };
  return { cardType: 'modo/buff', actionType: 'mode' };
}

export function bossCardToSnapshot(card: BossCard, extraCaption?: string): Card {
  const cost = Object.entries(card.cost || {}).map(([attr, value]) => `${attr}: ${formatNumberBR(value)}`).join(', ');
  const boost = Object.entries(card.boost || {}).map(([attr, value]) => `${attr}: +${formatNumberBR(value)}`).join(', ');
  const details = [
    card.notes,
    boost ? `Aumento: ${boost}` : '',
    cost ? `Custo: ${cost}` : '',
    extraCaption,
  ].filter(Boolean).join('\n');
  const type = bossCardType(card.kind);
  return {
    id: card.id,
    name: card.name,
    caption: details,
    image: card.image || BOSS_CARD_IMAGES[card.id],
    rank: card.rank,
    speed: card.speed,
    cardType: type.cardType,
    actionType: type.actionType,
    movementRange: card.movementRange,
    movementType: card.movementType,
    sensoryType: card.sensoryType,
    detectsUntilSpeed: card.detectsUntilSpeed,
    reactionUntilSpeed: card.reactionUntilSpeed,
    reducesSpeedBy: card.reducesSpeedBy,
    detectsInvisibility: card.detectsInvisibility,
    detectsChakra: card.detectsChakra,
    detectsPresence: card.detectsPresence,
    tracksTarget: card.tracksTarget,
    tracksMovement: card.tracksMovement,
    maxTargets: card.maxTargets,
    targetShape: card.targetShape,
    battleUseType: card.kind === 'attack' ? 'ataque' : card.kind === 'defense' || card.kind === 'mental' ? 'defesa' : card.kind === 'movement' ? 'movimentação' : 'suporte',
    countsAsAttack: card.kind === 'attack',
    countsAsDefense: card.kind === 'defense' || card.kind === 'mental',
    countsAsMovement: card.kind === 'movement',
    momentaryAttrs: {
      ...(card.atk ? { Atk: card.atk } : {}),
      ...(card.def ? { Def: card.def } : {}),
    },
    effect: 'none',
    cost: {},
    boost: {
      ...(card.boost?.Atk ? { Atk: card.boost.Atk } : {}),
      ...(card.boost?.Def ? { Def: card.boost.Def } : {}),
      ...(card.boost?.Ag ? { Ag: card.boost.Ag } : {}),
    },
    unlimited: {},
    temporaryNote: [cost ? `Custo ENE/AG do Boss: ${cost}` : '', boost ? `Aumento cadastrado: ${boost}` : ''].filter(Boolean).join('\n') || undefined,
  };
}
