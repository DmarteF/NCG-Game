import { Attr } from './theme';
import { formatNumberBR, formatSpeed } from './format';
import { BossCard, BossState, KAELZOR_BOSS_CARDS, bossCard } from './bossData';
import { Card, CT, MomentaryAction, PlayedCard } from './types';

export const bossDebug = false;

export type PlayerActionAnalysis = {
  isAttack: boolean;
  isDefense: boolean;
  isGenjutsu: boolean;
  isSealing: boolean;
  isArea: boolean;
  isInstant: boolean;
  declaredKill: boolean;
  cloneCount: number;
  declaredTargets: number;
  maxSpeed: number | 'instant' | undefined;
  attackPower: number;
  defensePower: number;
  directHpThreat: boolean;
  hybridEvasion: boolean;
  flying: boolean;
  far: boolean;
  protectedByClones: boolean;
  activeMode: boolean;
  targetKind?: string;
  text: string;
};

export type BossDefenseResult = {
  boss: BossState;
  card?: BossCard;
  analysis: PlayerActionAnalysis;
  damageTaken: number;
  defeated: boolean;
  lines: string[];
};

export type BossAttackResult = {
  boss: BossState;
  card?: BossCard;
  playerAttrs: Record<Attr, number | 'ilimitado'>;
  damagePossible: number;
  defeatedPlayer: boolean;
  lines: string[];
};

const keyword = (text: string, words: string[]) => words.some(word => text.includes(word));
const numeric = (value: unknown) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};

function maxDeclaredNumber(text: string, nearWords: string[]) {
  const matches = [...text.matchAll(/(\d{1,6})\s*([a-zçãõéíóúâêô]+)?/gi)];
  let best = 0;
  matches.forEach((match) => {
    const value = Number(match[1]);
    const after = (match[2] || '').toLowerCase();
    if (nearWords.length === 0 || nearWords.some(word => after.includes(word))) best = Math.max(best, value);
  });
  return best;
}

function speedValue(speed: Card['speed']) {
  if (speed === 'instant') return 'instant' as const;
  if (typeof speed === 'number') return Math.max(0, Math.min(8, speed));
  return undefined;
}

function mergeMaxSpeed(a: PlayerActionAnalysis['maxSpeed'], b: PlayerActionAnalysis['maxSpeed']) {
  if (a === 'instant' || b === 'instant') return 'instant' as const;
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
}

function ownAttackFromCards(cards: PlayedCard[]) {
  return cards.reduce((sum, played) => {
    const card = played.cardSnapshot;
    const useAsAttack = card.actionType === 'attack' || card.countsAsAttack || card.battleUseType?.includes('ataque');
    return sum + numeric(card.momentaryAttrs?.Atk) + (useAsAttack ? numeric(card.boost?.Atk) : 0);
  }, 0);
}

function structuredCloneCount(cards: PlayedCard[]) {
  return cards.reduce((max, played) => {
    const card = played.cardSnapshot;
    if (card.actionType !== 'diverse_summon' && card.cardType !== 'invocação diversa') return max;
    return Math.max(max, numeric(card.summonQuantity) || numeric(card.targetCount));
  }, 0);
}

function structuredTargetCount(cards: PlayedCard[], cloneCount: number) {
  return cards.reduce((max, played) => {
    const card = played.cardSnapshot;
    const shapeTargets = card.targetShape && card.targetShape !== 'único' ? Math.max(2, numeric(card.targetCount), cloneCount) : 0;
    const summonTargets = card.actionType === 'diverse_summon' || card.cardType === 'invocação diversa' ? numeric(card.summonQuantity) : 0;
    return Math.max(max, numeric(card.actualTargets), numeric(card.targetCount), numeric(card.maxTargets), summonTargets, shapeTargets);
  }, Math.max(1, cloneCount));
}

function hasStructuredArea(cards: PlayedCard[]) {
  return cards.some(({ cardSnapshot: card }) => Boolean(
    card.targetShape && card.targetShape !== 'único'
    || numeric(card.maxTargets) > 1
    || numeric(card.actualTargets) > 1
    || numeric(card.targetCount) > 1
    || card.actionType === 'diverse_summon'
    || card.cardType === 'invocação diversa'
  ));
}

export function analyzePlayerAction(
  playedCards: PlayedCard[],
  observation: string,
  finalAttrs: Record<Attr, number | 'ilimitado'>,
  momentaryActions: MomentaryAction[] = [],
): PlayerActionAnalysis {
  const cardText = playedCards.map(item => `${item.cardSnapshot.name} ${item.cardSnapshot.caption}`).join(' ');
  const text = `${cardText} ${observation}`.toLowerCase();
  const structuredClones = structuredCloneCount(playedCards);
  const cloneCount = Math.max(structuredClones, maxDeclaredNumber(text, ['clone', 'clones']), keyword(text, ['clone', 'clones']) ? 1 : 0);
  const declaredTargets = Math.max(
    structuredTargetCount(playedCards, cloneCount),
    maxDeclaredNumber(text, ['alvo', 'alvos']),
    keyword(text, ['todos', 'grupo', 'área', 'area']) ? Math.max(cloneCount, 4) : 1,
  );
  let maxSpeed: PlayerActionAnalysis['maxSpeed'];
  for (const played of playedCards) maxSpeed = mergeMaxSpeed(maxSpeed, speedValue(played.cardSnapshot.speed));
  if (keyword(text, ['instantâneo', 'instantaneo', 'sem chance de defesa'])) maxSpeed = 'instant';

  const momentaryAtk = momentaryActions.reduce((sum, action) => sum + numeric(action.final.Atk), 0);
  const momentaryDef = momentaryActions.reduce((sum, action) => sum + numeric(action.final.Def), 0);
  const directHpThreat = playedCards.some(item => item.cardSnapshot.directHpDamage || item.cardSnapshot.ignoresCTDefense || item.cardSnapshot.ignoresCommonDefense);
  const hybridEvasion = playedCards.some(item => item.cardSnapshot.countsAsDodge || item.cardSnapshot.evasiveMovement || item.cardSnapshot.battleUseType?.includes('esquiva') || item.cardSnapshot.battleUseType?.includes('movimentação'));
  const activeMode = playedCards.some(item => item.cardSnapshot.actionType === 'mode' || item.cardSnapshot.cardType === 'modo/buff');
  const flying = playedCards.some(item => item.cardSnapshot.fieldPosition === 'voando') || keyword(text, ['voando', 'voo', 'aéreo', 'aereo']);
  const far = playedCards.some(item => item.cardSnapshot.fieldPosition === 'longe' || item.cardSnapshot.fieldPosition === 'outra dimensão') || keyword(text, ['longe', 'distante', 'outra dimensão', 'outra dimensao']);
  const protectedByClones = cloneCount > 0 || playedCards.some(item => item.cardSnapshot.fieldPosition === 'atrás de clones');
  const targetKind = playedCards.map(item => item.cardSnapshot.combatTargetKind).find(Boolean);
  const attackPower = momentaryAtk || ownAttackFromCards(playedCards) || (keyword(text, ['ataque', 'dano', 'golpe', 'rasengan', 'corte', 'explosão', 'explosao']) ? numeric(finalAttrs.Atk) : 0);
  const defensePower = momentaryDef || (playedCards.some(item => item.cardSnapshot.countsAsDefense) ? numeric(finalAttrs.Def) : 0) || (keyword(text, ['defesa', 'barreira', 'bloqueio', 'escudo', 'cúpula', 'cupula']) ? numeric(finalAttrs.Def) : 0);

  return {
    isAttack: attackPower > 0 || directHpThreat || keyword(text, ['ataque', 'dano', 'golpe', 'rasengan', 'corte', 'explosão', 'explosao']),
    isDefense: defensePower > 0 || keyword(text, ['defesa', 'barreira', 'bloqueio', 'escudo', 'cúpula', 'cupula']),
    isGenjutsu: keyword(text, ['genjutsu', 'ilusão', 'ilusao', 'mente', 'mental']),
    isSealing: keyword(text, ['selo', 'selamento', 'aprisionar', 'prender']),
    isArea: hasStructuredArea(playedCards) || keyword(text, ['área', 'area', 'todos', 'grupo', 'todos os lados']) || cloneCount > 3 || declaredTargets > 3,
    isInstant: maxSpeed === 'instant',
    declaredKill: keyword(text, ['hp: 0', 'te mato', 'te derroto', 'finalizo', 'acabou']),
    cloneCount,
    declaredTargets,
    maxSpeed,
    attackPower,
    defensePower,
    directHpThreat,
    hybridEvasion,
    flying,
    far,
    protectedByClones,
    activeMode,
    targetKind,
    text,
  };
}

function canPay(card: BossCard, boss: BossState) {
  const ene = card.cost?.ENE || 0;
  const ag = card.cost?.Ag || 0;
  return boss.stats.Ene >= ene && boss.stats.Ag >= ag && (boss.cooldowns[card.id] || 0) <= 0;
}

function pay(card: BossCard, boss: BossState): BossState {
  const cooldowns = Object.fromEntries(Object.entries(boss.cooldowns).map(([id, value]) => [id, Math.max(0, value - 1)]));
  const activates = ['mode', 'equipment', 'perception'].includes(card.kind);
  const currentActive = boss.activeCardIds || [];
  const activeCardIds = activates ? Array.from(new Set([...currentActive, card.id])) : currentActive;
  return {
    ...boss,
    stats: {
      ...boss.stats,
      Ene: Math.max(0, boss.stats.Ene - numeric(card.cost?.ENE)),
      Ag: Math.max(0, boss.stats.Ag - numeric(card.cost?.Ag)),
    },
    activeCardIds,
    cooldowns: card.cooldownTurns ? { ...cooldowns, [card.id]: card.cooldownTurns } : cooldowns,
  };
}

function chooseDefense(analysis: PlayerActionAnalysis, boss: BossState) {
  if (!analysis.isAttack && !analysis.isGenjutsu && !analysis.isSealing) return undefined;
  const speed = analysis.maxSpeed === 'instant' ? 99 : analysis.maxSpeed || 0;
  if (speed > 5) return undefined;
  const candidates: BossCard[] = [];
  const add = (id: string) => {
    const card = bossCard(id);
    const cardSpeed = card?.speed === 'instant' ? 99 : card?.speed ?? 0;
    if (card && speed <= cardSpeed) candidates.push(card);
  };
  if (analysis.isGenjutsu) add('mente-vazia-boss');
  add('olhos-vazio-rachado-boss');
  if (analysis.directHpThreat) add('deslocamento-vazio-rachado-boss');
  if (analysis.directHpThreat) add('reflexo-abissal-boss');
  if (analysis.isArea) add('cupula-vazio-boss');
  if (!analysis.isArea) add('barreira-rachada-boss');
  if (analysis.attackPower > 0 && analysis.attackPower <= 500000) add('reflexo-abissal-boss');
  add('deslocamento-vazio-rachado-boss');
  add('passo-instavel-boss');
  return candidates.find(card => card && canPay(card, boss));
}

export function resolveBossDefense(
  boss: BossState,
  playedCards: PlayedCard[],
  observation: string,
  finalAttrs: Record<Attr, number | 'ilimitado'>,
  momentaryActions: MomentaryAction[] = [],
): BossDefenseResult {
  const analysis = analyzePlayerAction(playedCards, observation, finalAttrs, momentaryActions);
  const lines: string[] = ['Kael’Zor reagiu à jogada do jogador.'];
  if (bossDebug) {
    lines.push(`Speed detectada: ${analysis.maxSpeed === 'instant' ? 'Instantânea' : analysis.maxSpeed ?? 'Sem Speed'}.`);
    if (analysis.cloneCount > 0) lines.push(`Clones/alvos estruturados: ${analysis.cloneCount}.`);
    if (analysis.declaredTargets > 1) lines.push(`Alvos considerados: ${analysis.declaredTargets}.`);
    if (analysis.declaredKill) lines.push('Declaração de finalização detectada; será validada pelo cálculo.');
  }
  if (!analysis.isAttack && !analysis.isGenjutsu && !analysis.isSealing) {
    lines.push('Nenhum dano direto foi aplicado ao Boss.');
    return { boss, analysis, damageTaken: 0, defeated: false, lines };
  }

  const defense = chooseDefense(analysis, boss);
  let nextBoss = boss;
  let defenseValue = 0;
  if (bossDebug && analysis.isInstant && (analysis.maxSpeed === 'instant')) {
    lines.push('A ação foi marcada como instantânea; Kael’Zor só reage se houver defesa compatível.');
  }
  if (bossDebug && (analysis.maxSpeed === 'instant' || (typeof analysis.maxSpeed === 'number' && analysis.maxSpeed > 5))) {
    lines.push('A Speed ultrapassou a reação Rank B disponível de Kael’Zor.');
  }
  if (defense) {
    nextBoss = pay(defense, boss);
    defenseValue = numeric(defense.def);
    if (defense.kind === 'movement') defenseValue = Math.floor(analysis.attackPower * 0.5);
    lines.push(`Kael’Zor usou ${defense.name}.`);
    if (defense.kind === 'movement') lines.push(`Resultado: ${defense.movementType || 'reposicionamento'} para reduzir o impacto.`);
    else lines.push(`Resultado: defesa aplicada${defense.def ? ` (${formatNumberBR(defense.def)})` : ''}.`);
    lines.push(`ENE restante: ${formatNumberBR(nextBoss.stats.Ene)}.`);
  } else {
    lines.push('Resultado: Kael’Zor recebeu o impacto.');
  }

  const rawDamage = Math.max(0, analysis.attackPower - defenseValue);
  const damageTaken = analysis.isGenjutsu && defense?.id === 'mente-vazia-boss' ? 0 : rawDamage;
  nextBoss = {
    ...nextBoss,
    stats: { ...nextBoss.stats, Hp: Math.max(0, nextBoss.stats.Hp - damageTaken) },
    bossMemory: {
      lastPlayerCards: playedCards.map(item => item.cardSnapshot.name).slice(-5),
      playerUsesClones: analysis.cloneCount > 0 || !!nextBoss.bossMemory?.playerUsesClones,
      playerUsesGenjutsu: analysis.isGenjutsu || !!nextBoss.bossMemory?.playerUsesGenjutsu,
      playerUsesStrongMode: analysis.activeMode || !!nextBoss.bossMemory?.playerUsesStrongMode,
      lastDamageTaken: damageTaken,
      threatScore: Math.max(0, Math.floor(damageTaken / 50000) + analysis.cloneCount + (analysis.directHpThreat ? 8 : 0) + (analysis.hybridEvasion ? 4 : 0) + (analysis.activeMode ? 5 : 0) + (analysis.isGenjutsu ? 5 : 0) + (analysis.isSealing ? 5 : 0) + (analysis.maxSpeed === 'instant' ? 8 : Number(analysis.maxSpeed || 0))),
    },
  };
  if (bossDebug) lines.push(`Atk final analisado: ${formatNumberBR(analysis.attackPower)}.`);
  lines.push(`Dano recebido: ${formatNumberBR(damageTaken)}.`);
  lines.push(`HP restante do Boss: ${formatNumberBR(nextBoss.stats.Hp)}.`);
  if (analysis.declaredKill && nextBoss.stats.Hp > 0) {
    lines.push('A declaração de finalização foi analisada, mas dano/condição não foram suficientes para derrotar Kael’Zor.');
  }
  return { boss: nextBoss, card: defense, analysis, damageTaken, defeated: nextBoss.stats.Hp <= 0, lines };
}

function cardCost(card: BossCard) {
  return numeric(card.cost?.ENE) + numeric(card.cost?.Ag);
}

function chooseBossAction(boss: BossState, analysis?: PlayerActionAnalysis) {
  const targets = Math.max(1, analysis?.cloneCount || analysis?.declaredTargets || 1);
  const hpRatio = boss.stats.Hp / 500000;
  const memory = boss.bossMemory;
  const speed = analysis?.maxSpeed === 'instant' ? 99 : analysis?.maxSpeed || 0;
  const available = KAELZOR_BOSS_CARDS.filter(card => canPay(card, boss));
  if (available.length === 0) return undefined;

  const scored = available.map((card) => {
    let score = 0;
    if (card.id === boss.lastAttackId) score -= 80;
    if (card.kind === 'attack') {
      score += 25;
      if (targets <= 1 && (card.maxTargets || 1) <= 3) score += card.id === 'corte-vazio-boss' ? 18 : 14;
      if (targets > 1 && (card.maxTargets || 1) >= Math.min(targets, 3)) score += 18;
      if (targets > 3 && (card.maxTargets || 1) >= 20) score += 36;
      if (targets > 50 && (card.maxTargets || 1) >= 100) score += 48;
      if (memory?.playerUsesClones && (card.maxTargets || 1) > 1) score += 16;
      if (analysis?.protectedByClones && (card.maxTargets || 1) > 1) score += 18;
      if (analysis?.flying && (card.targetShape === 'linha' || (card.maxTargets || 1) > 1)) score += 8;
      if (analysis?.far && ['lanca-fragmentada-boss', 'onda-abismo-partido-boss', 'ruptura-vazio-menor-boss'].includes(card.id)) score += 10;
      if (boss.turn >= 2 && (card.speed === 'instant' || Number(card.speed || 0) >= Number(analysis?.maxSpeed || 0))) score += 10;
      if ((memory?.threatScore || 0) > 10) score += 10;
      if (boss.stats.Ene < 250000) score -= Math.floor(cardCost(card) / 20000);
    }
    if (card.kind === 'movement') {
      score += 8;
      if (speed >= 4 || numeric(analysis?.attackPower) > 450000) score += 36;
      if (analysis?.directHpThreat || analysis?.hybridEvasion) score += 20;
      if ((memory?.lastDamageTaken || 0) > 250000) score += 16;
      if (boss.turn % 3 === 0) score += 18;
    }
    if (card.kind === 'defense') {
      score += 4;
      if (analysis?.isArea && card.id === 'cupula-vazio-boss') score += 24;
      if (numeric(analysis?.attackPower) > 400000 && card.id === 'reflexo-abissal-boss') score += 20;
      if (hpRatio < 0.45) score += 18;
      if (memory?.playerUsesStrongMode) score += 8;
      if (analysis?.directHpThreat && card.id === 'reflexo-abissal-boss') score += 14;
    }
    if (card.kind === 'mode' || card.kind === 'equipment' || card.kind === 'perception') {
      if ((boss.activeCardIds || []).includes(card.id)) score -= 100;
      else score += card.kind === 'mode' ? 20 : 14;
      if (boss.turn <= 2) score += 10;
      if (hpRatio < 0.55 && card.kind !== 'perception') score += 16;
      if (speed >= 4 && card.kind === 'perception') score += 24;
      if (memory?.playerUsesGenjutsu && card.kind === 'perception') score += 8;
      if (analysis?.activeMode && card.kind === 'mode') score += 8;
    }
    if (card.kind === 'mental') {
      score += analysis?.isGenjutsu || memory?.playerUsesGenjutsu ? 32 : -20;
    }
    return { card, score };
  }).sort((a, b) => b.score - a.score || cardCost(a.card) - cardCost(b.card));

  return scored[0]?.card;
}

function dynamicBossLegend(action: BossCard, analysis?: PlayerActionAnalysis) {
  const clones = (analysis?.cloneCount || 0) > 0;
  const manyTargets = (analysis?.declaredTargets || 0) > 3;
  const flying = !!analysis?.flying;
  const far = !!analysis?.far;
  const protectedByClones = !!analysis?.protectedByClones;
  if (action.kind === 'movement') return `Uso ${action.name} para escapar da ofensiva e reposicionar meu corpo no campo.`;
  if (action.kind === 'mode') return `Ativo ${action.name} para recuperar parte do meu poder selado.`;
  if (action.kind === 'equipment') return `Ativo ${action.name} para reforçar minha defesa contra sua pressão.`;
  if (action.kind === 'defense' || action.kind === 'mental' || action.kind === 'perception') return `Uso ${action.name} para responder à sua movimentação e manter o controle do campo.`;
  if (action.id === 'corte-vazio-boss') return `Utilizo ${action.name} para rasgar sua defesa e atingir seu corpo diretamente.`;
  if (action.id === 'lanca-fragmentada-boss') return `Utilizo ${action.name} para perfurar sua guarda e pressionar seu C.T.`;
  if (action.id === 'chuva-estilhacos-rubros-boss' && clones) return `Utilizo ${action.name} para destruir essas cópias espalhadas pelo campo.`;
  if (action.id === 'onda-abismo-partido-boss' && (manyTargets || protectedByClones)) return `Utilizo ${action.name} para varrer suas invocações e defesas do campo.`;
  if (action.id === 'ruptura-vazio-menor-boss') return `Utilizo ${action.name} para consumir os alvos próximos em uma fenda dimensional.`;
  if (flying) return `Utilizo ${action.name} mirando sua posição aérea antes que você se afaste.`;
  if (far) return `Utilizo ${action.name} para alcançar sua distância e cortar sua rota de fuga.`;
  return `Utilizo ${action.name} para pressionar seu C.T e forçar uma resposta imediata.`;
}

export function resolveBossAttack(
  boss: BossState,
  playerCT: CT | null,
  playerAttrs: Record<Attr, number | 'ilimitado'>,
  analysis?: PlayerActionAnalysis,
): BossAttackResult {
  const lines: string[] = [];
  const action = chooseBossAction(boss, analysis);
  if (!action) {
    lines.push('Kael’Zor não encontrou ENE/AG suficiente para agir neste turno.');
    lines.push('Aguardando resposta do jogador.');
    return { boss: { ...boss, turn: boss.turn + 1 }, playerAttrs, damagePossible: 0, defeatedPlayer: false, lines };
  }
  const targets = Math.max(1, analysis?.cloneCount || analysis?.declaredTargets || 1);
  const hitTargets = Math.min(targets, action.maxTargets || 1);
  let nextBoss = pay(action, { ...boss, lastAttackId: action.id });
  nextBoss = { ...nextBoss, turn: boss.turn + 1 };

  const playerDef = numeric(playerAttrs.Def);
  const damage = action.kind === 'attack' ? Math.max(0, numeric(action.atk) - playerDef) : 0;
  const nextPlayerAttrs = { ...playerAttrs };

  lines.push(dynamicBossLegend(action, analysis));
  if (action.kind === 'attack') {
    lines.push(`Atk: ${formatNumberBR(action.atk)}. ${formatSpeed(action.speed) || 'Sem Speed'}.`);
    if (targets > 1) {
      lines.push(`Resultado: ${hitTargets} alvo(s) atingido(s)${hitTargets < targets ? `; ${targets - hitTargets} permanecem fora do alcance.` : '.'}`);
    }
    if (bossDebug) lines.push(`Def atual de ${playerCT?.name?.trim() || 'O C.T'}: ${formatNumberBR(playerDef)}.`);
    lines.push(`Dano possível: ${formatNumberBR(damage)}.`);
  } else if (action.kind === 'movement') {
    lines.push(`Resultado: ${action.movementType || 'reposicionamento'} (${action.movementRange || 'alcance indefinido'}).`);
  } else if (action.kind === 'mode') {
    lines.push('Resultado: modo ativo no Boss.');
  } else if (action.kind === 'equipment') {
    lines.push('Resultado: equipamento ativo no Boss.');
  } else if (action.kind === 'defense' || action.kind === 'mental' || action.kind === 'perception') {
    lines.push('Resultado: reação/defesa preparada.');
  }
  lines.push(`ENE restante do Boss: ${formatNumberBR(nextBoss.stats.Ene)}.`);
  lines.push('Aguardando resposta do jogador. Nenhuma vitória automática foi aplicada.');
  return { boss: nextBoss, card: action, playerAttrs: nextPlayerAttrs, damagePossible: damage, defeatedPlayer: false, lines };
}
