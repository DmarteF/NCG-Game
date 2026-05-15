import { Attr } from './theme';
import { BossDifficulty, BossStats, CardSpeed, CT } from './types';

export type BossCardKind = 'perception' | 'mental' | 'movement' | 'defense' | 'equipment' | 'mode' | 'attack';

export type BossCard = {
  id: string;
  name: string;
  kind: BossCardKind;
  rank: 'B';
  speed?: CardSpeed;
  atk?: number;
  def?: number;
  cost?: Partial<Record<'ENE' | Attr, number>>;
  maxTargets?: number;
  cooldownTurns?: number;
  notes: string;
};

export type BossState = {
  name: string;
  title: string;
  rank: 'B';
  difficulty: BossDifficulty;
  stats: BossStats;
  lastAttackId?: string;
  cooldowns: Record<string, number>;
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
  { id: 'selo-olho-abissal-boss', name: 'Selo do Olho Abissal', kind: 'perception', rank: 'B', speed: 5, cost: { ENE: 40000 }, notes: 'Acompanha ações até Speed 5 pagando ENE por turno.' },
  { id: 'olhos-vazio-rachado-boss', name: 'Olhos do Vazio Rachado', kind: 'perception', rank: 'B', speed: 5, cost: { ENE: 60000 }, notes: 'Reação até Speed 5.' },
  { id: 'mente-vazia-boss', name: 'Mente Vazia', kind: 'mental', rank: 'B', speed: 5, def: 999999, cost: { ENE: 80000 }, notes: 'Resiste genjutsu comum até Rank B.' },
  { id: 'passo-instavel-boss', name: 'Passo Instável', kind: 'movement', rank: 'B', speed: 3, cost: { ENE: 70000, Ag: 40000 }, notes: 'Esquiva curta do vazio rachado.' },
  { id: 'deslocamento-vazio-rachado-boss', name: 'Deslocamento do Vazio Rachado', kind: 'movement', rank: 'B', speed: 5, cost: { ENE: 120000, Ag: 80000 }, notes: 'Reposicionamento rápido até Speed 5.' },
  { id: 'barreira-rachada-boss', name: 'Barreira Rachada', kind: 'defense', rank: 'B', speed: 3, def: 450000, cost: { ENE: 90000 }, notes: 'Defesa frontal.' },
  { id: 'cupula-vazio-boss', name: 'Cúpula do Vazio', kind: 'defense', rank: 'B', speed: 3, def: 600000, cost: { ENE: 160000 }, maxTargets: 100, notes: 'Defesa de área para ataques de vários lados.' },
  { id: 'reflexo-abissal-boss', name: 'Reflexo Abissal', kind: 'defense', rank: 'B', speed: 5, def: 500000, cost: { ENE: 180000 }, cooldownTurns: 1, notes: 'Defende e pode refletir ataques até 500.000.' },
  { id: 'armadura-abismo-partido-boss', name: 'Armadura do Abismo Partido', kind: 'equipment', rank: 'B', def: 200000, cost: { ENE: 120000 }, notes: 'Equipamento defensivo do fragmento.' },
  { id: 'fragmento-vazio-boss', name: 'Fragmento do Vazio', kind: 'mode', rank: 'B', atk: 100000, def: 100000, cost: { ENE: 150000 }, notes: 'Modo base do fragmento selado.' },
  { id: 'corte-vazio-boss', name: 'Corte do Vazio', kind: 'attack', rank: 'B', speed: 3, atk: 300000, cost: { ENE: 100000 }, maxTargets: 1, notes: 'Ataque contra um alvo.' },
  { id: 'lanca-fragmentada-boss', name: 'Lança Fragmentada', kind: 'attack', rank: 'B', speed: 4, atk: 420000, cost: { ENE: 140000 }, maxTargets: 3, notes: 'Perfura até três alvos.' },
  { id: 'chuva-estilhacos-rubros-boss', name: 'Chuva de Estilhaços Rubros', kind: 'attack', rank: 'B', speed: 3, atk: 380000, cost: { ENE: 180000 }, maxTargets: 20, notes: 'Pressiona grupos médios.' },
  { id: 'onda-abismo-partido-boss', name: 'Onda do Abismo Partido', kind: 'attack', rank: 'B', speed: 3, atk: 520000, cost: { ENE: 220000 }, maxTargets: 50, notes: 'Varre muitos alvos alinhados.' },
  { id: 'ruptura-vazio-menor-boss', name: 'Ruptura do Vazio Menor', kind: 'attack', rank: 'B', speed: 2, atk: 650000, cost: { ENE: 300000 }, maxTargets: 100, cooldownTurns: 1, notes: 'Ataque amplo. Não deve ser usado em turnos consecutivos.' },
];

export function createKaelzorState(difficulty: BossDifficulty = 'facil'): BossState {
  return {
    name: 'Kael’Zor',
    title: 'Fragmento Selado do Vazio',
    rank: 'B',
    difficulty,
    stats: { ...KAELZOR_BASE_STATS },
    cooldowns: {},
    turn: 1,
  };
}

export function createBossCT(state: BossState): CT {
  return {
    id: 'kaelzor-fragmento-boss',
    name: `${state.name} — ${state.title}`,
    rank: state.rank,
    attrs: {
      Atk: state.stats.Atk,
      Def: state.stats.Def,
      Dur: 0,
      Ag: state.stats.Ag,
      Ck: 0,
      Hp: state.stats.Hp,
    },
    unlimited: {},
  };
}

export function bossCard(id: string) {
  return KAELZOR_BOSS_CARDS.find(card => card.id === id);
}
