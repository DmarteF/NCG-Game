import { Image } from 'react-native';
import { formatNumberBR } from './format';
import { Attr } from './theme';
import { BossDifficulty, BossStats, Card, CardActionType, CardSpeed, CardType, CT, MovementRange, MovementType, SensoryType, TargetShape } from './types';

export type BossRank = 'B' | 'A' | 'S' | 'SS';
export type BossCardKind = 'perception' | 'mental' | 'movement' | 'defense' | 'equipment' | 'mode' | 'attack' | 'charge';

export type BossCard = {
  id: string;
  name: string;
  kind: BossCardKind;
  rank: BossRank;
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
  unique?: boolean;
  minDifficulty?: BossDifficulty;
  unlocksRanks?: BossRank[];
  notes: string;
};

const assetUri = (asset: number) => Image.resolveAssetSource(asset).uri;

const BOSS_CT_IMAGE = assetUri(require('../assets/boss/CT_Boss.jpeg'));

const BOSS_CARD_IMAGES: Record<string, string> = {
  'selo-olho-abissal-boss': assetUri(require('../assets/boss/cards/Selo_Boss.jpeg')),
  'olhos-vazio-rachado-boss': assetUri(require('../assets/boss/cards/Olhos_Boss.jpeg')),
  'mente-vazia-boss': assetUri(require('../assets/boss/cards/Mente_Boss.jpeg')),
  'passo-instavel-boss': assetUri(require('../assets/boss/cards/Passo_Boss.jpeg')),
  'deslocamento-vazio-rachado-boss': assetUri(require('../assets/boss/cards/Deslocamento_Boss.jpeg')),
  'barreira-rachada-boss': assetUri(require('../assets/boss/cards/Barreira_Boss.jpeg')),
  'cupula-vazio-boss': assetUri(require('../assets/boss/cards/Cupula_Boss.jpeg')),
  'reflexo-abissal-boss': assetUri(require('../assets/boss/cards/Reflexo_Boss.jpeg')),
  'armadura-abismo-partido-boss': assetUri(require('../assets/boss/cards/Armadura_Boss.jpeg')),
  'fragmento-vazio-boss': assetUri(require('../assets/boss/cards/Fragmento_Boss.jpeg')),
  'corte-vazio-boss': assetUri(require('../assets/boss/cards/Corte_Boss.jpeg')),
  'lanca-fragmentada-boss': assetUri(require('../assets/boss/cards/Lanca_Boss.jpeg')),
  'chuva-estilhacos-rubros-boss': assetUri(require('../assets/boss/cards/Chuva_Boss.jpeg')),
  'onda-abismo-partido-boss': assetUri(require('../assets/boss/cards/Onda_Boss.jpeg')),
  'ruptura-vazio-menor-boss': assetUri(require('../assets/boss/cards/Ruptura_Boss.jpeg')),
  'primeiro-veu-abismo-boss': assetUri(require('../assets/boss/cards/primeiro_veu.png')),
  'muralha-primeiro-veu-boss': assetUri(require('../assets/boss/cards/muralha_primeiro.png')),
  'casca-abissal-boss': assetUri(require('../assets/boss/cards/casca_abissal.png')),
  'circulo-veu-partido-boss': assetUri(require('../assets/boss/cards/circulo_veu.png')),
  'fuga-veu-dimensional-boss': assetUri(require('../assets/boss/cards/fuga_veu.png')),
  'corte-veu-rubro-boss': assetUri(require('../assets/boss/cards/corte_veu.png')),
  'laminas-abismo-boss': assetUri(require('../assets/boss/cards/lamina_abismo.png')),
  'erupcao-primeiro-veu-boss': assetUri(require('../assets/boss/cards/erupcao_primeiro.png')),
  'prisao-abismo-menor-boss': assetUri(require('../assets/boss/cards/prisao_abismo.png')),
  'coroa-eclipse-rubro-boss': assetUri(require('../assets/boss/cards/coroa_eclipse.png')),
  'mandato-coroa-rubra-boss': assetUri(require('../assets/boss/cards/mandato_coroa.png')),
  'pele-eclipse-boss': assetUri(require('../assets/boss/cards/pele_eclipse.png')),
  'retorno-eclipse-boss': assetUri(require('../assets/boss/cards/retorno_eclipse.png')),
  'passagem-eclipse-boss': assetUri(require('../assets/boss/cards/passagem_eclipse.png')),
  'passo-entre-dimensoes-boss': assetUri(require('../assets/boss/cards/passo_dimensoes.png')),
  'decreto-eclipse-boss': assetUri(require('../assets/boss/cards/decreto_eclipse.png')),
  'fenda-eclipse-boss': assetUri(require('../assets/boss/cards/fenda_eclipse.png')),
  'julgamento-vazio-boss': assetUri(require('../assets/boss/cards/julgamento_vazio.png')),
  'mare-abismo-rubro-boss': assetUri(require('../assets/boss/cards/mare_abismo.png')),
  'prisao-dimensional-rubra-boss': assetUri(require('../assets/boss/cards/prisao_dimensional.png')),
  'autoridade-vazio-absoluto-boss': assetUri(require('../assets/boss/cards/autoridade_vazio.png')),
  'eclipse-existencia-boss': assetUri(require('../assets/boss/cards/eclipse_existencia.png')),
  'passo-vazio-absoluto-boss': assetUri(require('../assets/boss/cards/passos_vazio.png')),
  'olhos-singularidade-boss': assetUri(require('../assets/boss/cards/olhos_singularidade.png')),
  'big-bang-eclipse-rubro-boss': assetUri(require('../assets/boss/cards/big_bang.png')),
  'colapso-realidade-boss': assetUri(require('../assets/boss/cards/colapso_realidade.png')),
};

const FALLBACK_BOSS_CARD_IMAGE = BOSS_CARD_IMAGES['fragmento-vazio-boss'];

export type BossState = {
  name: string;
  title: string;
  rank: 'B';
  difficulty: BossDifficulty;
  stats: BossStats;
  lastAttackId?: string;
  activeCardIds: string[];
  usedCardIds: string[];
  pendingTechniqueId?: string;
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
  { id: 'primeiro-veu-abismo-boss', name: 'Primeiro Véu do Abismo', kind: 'mode', rank: 'A', minDifficulty: 'medio', cost: { ENE: 80000 }, boost: { Atk: 400000, Def: 350000, Ag: 250000, ENE: 700000 }, unlocksRanks: ['A'], notes: 'Modo persistente. Ativa no segundo turno a partir do Médio, soma por cima do Fragmento do Vazio, libera Rank A e não reaplica bônus.' },
  { id: 'muralha-primeiro-veu-boss', name: 'Muralha do Primeiro Véu', kind: 'defense', rank: 'A', minDifficulty: 'medio', speed: 4, def: 900000, cost: { ENE: 50000 }, targetShape: 'único', notes: 'Defesa frontal. Bloqueia até 900.000; dano excedente pode atravessar. Não defende costas, lados ou cima se o ataque não for frontal.' },
  { id: 'casca-abissal-boss', name: 'Casca Abissal', kind: 'defense', rank: 'A', minDifficulty: 'medio', speed: 4, def: 750000, cost: { ENE: 45000, Ag: 10000 }, targetShape: 'único', notes: 'Defesa corporal no impacto. Cobre o corpo de Kael’Zor contra ataques diretos até 750.000, sem proteger grande área.' },
  { id: 'circulo-veu-partido-boss', name: 'Círculo do Véu Partido', kind: 'defense', rank: 'A', minDifficulty: 'medio', speed: 3, def: 850000, cost: { ENE: 65000 }, targetShape: 'área total', notes: 'Defesa de todos os lados até 850.000. Enquanto usa, Kael’Zor não ataca no mesmo momento.' },
  { id: 'fuga-veu-dimensional-boss', name: 'Fuga pelo Véu Dimensional', kind: 'movement', rank: 'A', minDifficulty: 'medio', speed: 5, cost: { ENE: 100000, Ag: 30000 }, movementRange: 'global/dimensional', movementType: 'deslocamento dimensional', unique: true, notes: 'Escape dimensional. Evita ataque, prisão, área de dano ou reposiciona. No Médio, só pode ser usada 1 vez por luta.' },
  { id: 'corte-veu-rubro-boss', name: 'Corte do Véu Rubro', kind: 'attack', rank: 'A', minDifficulty: 'medio', speed: 4, atk: 900000, cost: { ENE: 55000 }, maxTargets: 1, targetShape: 'único', notes: 'Ataque direto contra 1 alvo. Causa até 900.000.' },
  { id: 'laminas-abismo-boss', name: 'Lâminas do Abismo', kind: 'attack', rank: 'A', minDifficulty: 'medio', speed: 3, atk: 1000000, cost: { ENE: 80000 }, maxTargets: 5, targetShape: 'área com quantidade', notes: 'Atinge até 5 alvos; cada alvo pode receber até 1.000.000.' },
  { id: 'erupcao-primeiro-veu-boss', name: 'Erupção do Primeiro Véu', kind: 'attack', rank: 'A', minDifficulty: 'medio', speed: 2, atk: 1200000, cost: { ENE: 120000 }, maxTargets: 100, targetShape: 'área com quantidade', notes: 'Ataque em área contra até 100 alvos. Cada alvo pode receber até 1.200.000.' },
  { id: 'prisao-abismo-menor-boss', name: 'Prisão do Abismo Menor', kind: 'attack', rank: 'A', minDifficulty: 'medio', speed: 3, atk: 700000, cost: { ENE: 90000 }, maxTargets: 10, targetShape: 'área com quantidade', notes: 'Prende até 10 alvos com correntes dimensionais. Cada alvo recebe até 700.000; sem força, defesa, escape ou técnica dimensional compatível, fica preso por 1 turno.' },
  { id: 'coroa-eclipse-rubro-boss', name: 'Coroa do Eclipse Rubro', kind: 'mode', rank: 'S', minDifficulty: 'dificil', cost: { ENE: 180000 }, boost: { Atk: 800000, Def: 700000, Ag: 500000, ENE: 1500000 }, unlocksRanks: ['S'], notes: 'Modo persistente. Ativa no terceiro turno a partir do Difícil, soma aos modos anteriores, libera Rank S e não reaplica bônus.' },
  { id: 'mandato-coroa-rubra-boss', name: 'Mandato da Coroa Rubra', kind: 'defense', rank: 'S', minDifficulty: 'dificil', speed: 4, def: 1500000, cost: { ENE: 130000 }, targetShape: 'área total', notes: 'Defesa total contra ataques de qualquer direção até 1.500.000. Enquanto usa, Kael’Zor não ataca no mesmo momento.' },
  { id: 'pele-eclipse-boss', name: 'Pele do Eclipse', kind: 'defense', rank: 'S', minDifficulty: 'dificil', speed: 5, def: 1200000, cost: { ENE: 110000, Ag: 25000 }, targetShape: 'único', notes: 'Defesa corporal instantânea contra ataques rápidos e diretos ao corpo até 1.200.000.' },
  { id: 'retorno-eclipse-boss', name: 'Retorno do Eclipse', kind: 'defense', rank: 'S', minDifficulty: 'dificil', speed: 5, def: 1200000, cost: { ENE: 160000, Ag: 40000 }, notes: 'Versão superior do Reflexo Abissal. Devolve até 1.200.000 contra o atacante; excedente pode passar.' },
  { id: 'passagem-eclipse-boss', name: 'Passagem do Eclipse', kind: 'movement', rank: 'S', minDifficulty: 'dificil', speed: 5, cost: { ENE: 150000, Ag: 50000 }, movementRange: 'global/dimensional', movementType: 'deslocamento dimensional', unique: true, notes: 'Escape dimensional Rank S. Escapa de ataques, prisões, áreas perigosas ou selamentos. Pode ser usada mesmo se a Fuga pelo Véu já foi usada.' },
  { id: 'passo-entre-dimensoes-boss', name: 'Passo Entre Dimensões', kind: 'movement', rank: 'S', minDifficulty: 'dificil', speed: 5, cost: { ENE: 80000, Ag: 25000 }, movementRange: 'global/dimensional', movementType: 'deslocamento dimensional', notes: 'Movimentação dimensional comum para esquivar, reposicionar, aproximar ou fugir. Não é uso único.' },
  { id: 'decreto-eclipse-boss', name: 'Decreto do Eclipse', kind: 'attack', rank: 'S', minDifficulty: 'dificil', speed: 'instant', atk: 1000000, cost: { ENE: 180000 }, maxTargets: 1, targetShape: 'único', cooldownTurns: 2, notes: 'Ataque instantâneo contra 1 alvo percebido. Só pode usar 1 vez a cada 2 turnos e não deve ser o primeiro ataque do modo.' },
  { id: 'fenda-eclipse-boss', name: 'Fenda do Eclipse', kind: 'attack', rank: 'S', minDifficulty: 'dificil', speed: 4, atk: 1500000, cost: { ENE: 150000 }, maxTargets: 50, targetShape: 'área com quantidade', notes: 'Fenda horizontal de energia rubra. Atinge até 50 alvos; cada alvo recebe até 1.500.000.' },
  { id: 'julgamento-vazio-boss', name: 'Julgamento do Vazio', kind: 'attack', rank: 'S', minDifficulty: 'dificil', speed: 3, atk: 1800000, cost: { ENE: 220000 }, maxTargets: 200, targetShape: 'área com quantidade', notes: 'Grande área com fendas e pilares de energia. Atinge até 200 alvos; cada alvo recebe até 1.800.000.' },
  { id: 'mare-abismo-rubro-boss', name: 'Maré do Abismo Rubro', kind: 'attack', rank: 'S', minDifficulty: 'dificil', speed: 2, atk: 2000000, cost: { ENE: 300000 }, maxTargets: 500, targetShape: 'área com quantidade', cooldownTurns: 1, notes: 'Ataque massivo contra até 500 alvos. Cada alvo pode receber até 2.000.000. Não pode ser usado em turnos consecutivos nem junto com Decreto do Eclipse.' },
  { id: 'prisao-dimensional-rubra-boss', name: 'Prisão Dimensional Rubra', kind: 'attack', rank: 'S', minDifficulty: 'dificil', speed: 4, atk: 1300000, cost: { ENE: 180000 }, maxTargets: 20, targetShape: 'área com quantidade', notes: 'Prende até 20 alvos em cubos dimensionais rubros. Cada alvo recebe até 1.300.000 e pode prender por 1 turno sem técnica compatível.' },
  { id: 'trono-vazio-absoluto-boss', name: 'Trono do Vazio Absoluto', kind: 'mode', rank: 'SS', minDifficulty: 'impossivel', boost: { Atk: 1500000, Def: 1300000, Ag: 1000000, ENE: 3000000 }, unlocksRanks: ['SS'], notes: 'Modo final de Kael’Zor. Usado apenas no Impossível, representa autoridade sobre o espaço, libera Rank SS e pode ser interrompido antes da ativação por selamento, morte ou bloqueio de ENE.' },
  { id: 'autoridade-vazio-absoluto-boss', name: 'Autoridade do Vazio Absoluto', kind: 'defense', rank: 'SS', minDifficulty: 'impossivel', speed: 'instant', def: 3000000, notes: 'Defesa instantânea que deforma, quebra ou desvia ataques pelo espaço. Pode ser superada por dano acima de 3.000.000, ataques simultâneos, desgaste de ENE ou selamento espacial.' },
  { id: 'eclipse-existencia-boss', name: 'Eclipse da Existência', kind: 'defense', rank: 'SS', minDifficulty: 'impossivel', speed: 'instant', def: 2500000, notes: 'Defesa instantânea de absorção/anulação. Melhor contra ataques diretos; pode ser vencida por ataques massivos, luz/purificação, dano contínuo superior ou habilidades que ignorem absorção.' },
  { id: 'passo-vazio-absoluto-boss', name: 'Passo do Vazio Absoluto', kind: 'movement', rank: 'SS', minDifficulty: 'impossivel', speed: 'instant', movementRange: 'global/dimensional', movementType: 'deslocamento dimensional', notes: 'Movimentação instantânea dimensional para esquiva, reposicionamento, fuga, aproximação e evitar finalizações. Pode ser limitada por selamento dimensional ou anti-teleporte.' },
  { id: 'olhos-singularidade-boss', name: 'Olhos da Singularidade', kind: 'perception', rank: 'SS', minDifficulty: 'impossivel', speed: 'instant', sensoryType: 'reação instantânea', detectsUntilSpeed: 'instant', reactionUntilSpeed: 'instant', tracksTarget: true, tracksMovement: true, detectsPresence: true, notes: 'Percepção absoluta e leitura dimensional extrema. Permite reação instantânea, mas não bloqueia automaticamente e pode sofrer sobrecarga sensorial.' },
  { id: 'big-bang-eclipse-rubro-boss', name: 'Big Bang do Eclipse Rubro', kind: 'charge', rank: 'SS', minDifficulty: 'impossivel', speed: 2, atk: 5000000, maxTargets: 999, targetShape: 'área total', cooldownTurns: 3, notes: 'Técnica carregada. Kael’Zor cria uma estrela dimensional gigantesca; o histórico avisa o carregamento e jogadores podem responder antes da explosão. Não é instantânea nem hit-kill inevitável.' },
  { id: 'colapso-realidade-boss', name: 'Colapso da Realidade', kind: 'attack', rank: 'SS', minDifficulty: 'impossivel', speed: 4, atk: 3500000, maxTargets: 999, targetShape: 'área total', cooldownTurns: 2, notes: 'Destrói a estabilidade do espaço ao redor do campo. Pode ser escapado saindo da área, voando acima da ruptura, atravessando zonas intactas, usando movimento instantâneo, defesa dimensional ou barreiras massivas.' },
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
    usedCardIds: [],
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
  if (kind === 'attack' || kind === 'charge') return { cardType: 'técnica', actionType: 'attack' };
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
    image: card.image || BOSS_CARD_IMAGES[card.id] || FALLBACK_BOSS_CARD_IMAGE,
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
    battleUseType: card.kind === 'attack' || card.kind === 'charge' ? 'ataque' : card.kind === 'defense' || card.kind === 'mental' ? 'defesa' : card.kind === 'movement' ? 'movimentação' : 'suporte',
    countsAsAttack: card.kind === 'attack' || card.kind === 'charge',
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
