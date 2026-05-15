import { Attr } from './theme';
import { formatNumberBR, formatSpeed } from './format';
import { BossCard, BossState, KAELZOR_BOSS_CARDS, bossCard } from './bossData';
import { Card, CT, MomentaryAction, PlayedCard } from './types';

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
  text: string;
};

export type BossDefenseResult = {
  boss: BossState;
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
    return sum + numeric(card.momentaryAttrs?.Atk) + (card.actionType === 'attack' ? numeric(card.boost?.Atk) : 0);
  }, 0);
}

export function analyzePlayerAction(
  playedCards: PlayedCard[],
  observation: string,
  finalAttrs: Record<Attr, number | 'ilimitado'>,
  momentaryActions: MomentaryAction[] = [],
): PlayerActionAnalysis {
  const cardText = playedCards.map(item => `${item.cardSnapshot.name} ${item.cardSnapshot.caption}`).join(' ');
  const text = `${cardText} ${observation}`.toLowerCase();
  const cloneCount = Math.max(maxDeclaredNumber(text, ['clone', 'clones']), keyword(text, ['clone', 'clones']) ? 1 : 0);
  const declaredTargets = Math.max(
    maxDeclaredNumber(text, ['alvo', 'alvos']),
    keyword(text, ['todos', 'grupo', 'área', 'area']) ? Math.max(cloneCount, 4) : 1,
  );
  let maxSpeed: PlayerActionAnalysis['maxSpeed'];
  for (const played of playedCards) maxSpeed = mergeMaxSpeed(maxSpeed, speedValue(played.cardSnapshot.speed));
  if (keyword(text, ['instantâneo', 'instantaneo', 'sem chance de defesa'])) maxSpeed = 'instant';

  const momentaryAtk = momentaryActions.reduce((sum, action) => sum + numeric(action.final.Atk), 0);
  const momentaryDef = momentaryActions.reduce((sum, action) => sum + numeric(action.final.Def), 0);
  const attackPower = momentaryAtk || ownAttackFromCards(playedCards) || (keyword(text, ['ataque', 'dano', 'golpe', 'rasengan', 'corte', 'explosão', 'explosao']) ? numeric(finalAttrs.Atk) : 0);
  const defensePower = momentaryDef || (keyword(text, ['defesa', 'barreira', 'bloqueio', 'escudo', 'cúpula', 'cupula']) ? numeric(finalAttrs.Def) : 0);

  return {
    isAttack: attackPower > 0 || keyword(text, ['ataque', 'dano', 'golpe', 'rasengan', 'corte', 'explosão', 'explosao']),
    isDefense: defensePower > 0 || keyword(text, ['defesa', 'barreira', 'bloqueio', 'escudo', 'cúpula', 'cupula']),
    isGenjutsu: keyword(text, ['genjutsu', 'ilusão', 'ilusao', 'mente', 'mental']),
    isSealing: keyword(text, ['selo', 'selamento', 'aprisionar', 'prender']),
    isArea: keyword(text, ['área', 'area', 'todos', 'grupo', 'todos os lados']) || cloneCount > 3 || declaredTargets > 3,
    isInstant: maxSpeed === 'instant',
    declaredKill: keyword(text, ['hp: 0', 'te mato', 'te derroto', 'finalizo', 'acabou']),
    cloneCount,
    declaredTargets,
    maxSpeed,
    attackPower,
    defensePower,
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
  return {
    ...boss,
    stats: {
      ...boss.stats,
      Ene: Math.max(0, boss.stats.Ene - numeric(card.cost?.ENE)),
      Ag: Math.max(0, boss.stats.Ag - numeric(card.cost?.Ag)),
    },
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
  const lines: string[] = ['Kael’Zor analisou a ofensiva inimiga.'];
  lines.push(`Speed detectada: ${analysis.maxSpeed === 'instant' ? 'Instantânea' : analysis.maxSpeed ?? 'Sem Speed'}.`);
  if (analysis.cloneCount > 0) lines.push(`Clones declarados: ${analysis.cloneCount}.`);
  if (analysis.declaredTargets > 1) lines.push(`Alvos declarados: ${analysis.declaredTargets}.`);
  if (analysis.declaredKill) lines.push('Declaração de finalização detectada; será validada pelo cálculo.');
  if (!analysis.isAttack && !analysis.isGenjutsu && !analysis.isSealing) {
    lines.push('Nenhuma ofensiva clara foi identificada. O Boss não recebeu dano direto.');
    return { boss, analysis, damageTaken: 0, defeated: false, lines };
  }

  const defense = chooseDefense(analysis, boss);
  let nextBoss = boss;
  let defenseValue = 0;
  if (analysis.isInstant && (analysis.maxSpeed === 'instant')) {
    lines.push('A ação foi marcada como instantânea; Kael’Zor só reage se houver defesa compatível.');
  }
  if (analysis.maxSpeed === 'instant' || (typeof analysis.maxSpeed === 'number' && analysis.maxSpeed > 5)) {
    lines.push('A Speed ultrapassou a reação Rank B disponível de Kael’Zor.');
  }
  if (defense) {
    nextBoss = pay(defense, boss);
    defenseValue = numeric(defense.def);
    if (defense.kind === 'movement') defenseValue = Math.floor(analysis.attackPower * 0.5);
    lines.push(`${defense.name} foi escolhido. ${defense.notes}`);
    if (defense.speed != null) lines.push(`${formatSpeed(defense.speed)}.`);
    if (defense.def) lines.push(`DEF da resposta: ${formatNumberBR(defense.def)}.`);
    lines.push(`ENE restante: ${formatNumberBR(nextBoss.stats.Ene)}.`);
  } else {
    lines.push('Nenhuma defesa/reação disponível foi suficiente ou pagável; Kael’Zor recebe o impacto.');
  }

  const rawDamage = Math.max(0, analysis.attackPower - defenseValue);
  const damageTaken = analysis.isGenjutsu && defense?.id === 'mente-vazia-boss' ? 0 : rawDamage;
  nextBoss = { ...nextBoss, stats: { ...nextBoss.stats, Hp: Math.max(0, nextBoss.stats.Hp - damageTaken) } };
  lines.push(`Atk final analisado: ${formatNumberBR(analysis.attackPower)}.`);
  lines.push(`Dano recebido após resposta: ${formatNumberBR(damageTaken)}.`);
  lines.push(`HP restante do Boss: ${formatNumberBR(nextBoss.stats.Hp)}.`);
  if (analysis.declaredKill && nextBoss.stats.Hp > 0) {
    lines.push('A declaração de finalização foi analisada, mas dano/condição não foram suficientes para derrotar Kael’Zor.');
  }
  return { boss: nextBoss, analysis, damageTaken, defeated: nextBoss.stats.Hp <= 0, lines };
}

function chooseAttack(boss: BossState, analysis?: PlayerActionAnalysis) {
  const targets = Math.max(1, analysis?.cloneCount || analysis?.declaredTargets || 1);
  const ordered = targets <= 1
    ? ['corte-vazio-boss', 'lanca-fragmentada-boss']
    : targets <= 3
      ? ['lanca-fragmentada-boss', 'chuva-estilhacos-rubros-boss']
      : targets <= 20
        ? ['chuva-estilhacos-rubros-boss', 'onda-abismo-partido-boss']
        : ['onda-abismo-partido-boss', 'ruptura-vazio-menor-boss', 'chuva-estilhacos-rubros-boss'];
  if (targets > 50 && boss.lastAttackId !== 'ruptura-vazio-menor-boss') ordered.unshift('ruptura-vazio-menor-boss');
  return ordered.map(id => bossCard(id)).find((card): card is BossCard => !!card && canPay(card, boss))
    || KAELZOR_BOSS_CARDS.find(card => card.kind === 'attack' && canPay(card, boss));
}

export function resolveBossAttack(
  boss: BossState,
  playerCT: CT | null,
  playerAttrs: Record<Attr, number | 'ilimitado'>,
  analysis?: PlayerActionAnalysis,
): BossAttackResult {
  const lines: string[] = [];
  const attack = chooseAttack(boss, analysis);
  if (!attack) {
    lines.push('Kael’Zor não encontrou ENE/AG suficiente para atacar neste turno.');
    lines.push('Aguardando resposta do jogador.');
    return { boss: { ...boss, turn: boss.turn + 1 }, playerAttrs, damagePossible: 0, defeatedPlayer: false, lines };
  }
  const targets = Math.max(1, analysis?.cloneCount || analysis?.declaredTargets || 1);
  const hitTargets = Math.min(targets, attack.maxTargets || 1);
  let nextBoss = pay(attack, { ...boss, lastAttackId: attack.id });
  nextBoss = { ...nextBoss, turn: boss.turn + 1 };

  const playerDef = numeric(playerAttrs.Def);
  const damage = Math.max(0, numeric(attack.atk) - playerDef);
  const nextPlayerAttrs = { ...playerAttrs };

  lines.push(`Kael’Zor escolheu ${attack.name}.`);
  lines.push(`Motivo: ${targets <= 1 ? 'alvo único' : targets <= 3 ? 'até três alvos' : targets <= 20 ? 'grupo médio' : 'muitos alvos declarados'}.`);
  lines.push(`Atk do Boss: ${formatNumberBR(attack.atk)}. ${formatSpeed(attack.speed) || 'Sem Speed'}.`);
  lines.push(`Alvos máximos: ${attack.maxTargets || 1}. Alvos declarados pelo jogador: ${targets}. Até ${hitTargets} alvo(s) foram atingidos.`);
  if (hitTargets < targets) lines.push(`${targets - hitTargets} alvo(s) podem permanecer fora do alcance desta técnica.`);
  lines.push(`Def atual de ${playerCT?.name?.trim() || 'O C.T'}: ${formatNumberBR(playerDef)}.`);
  lines.push(`Dano possível no HP principal: ${formatNumberBR(damage)}.`);
  lines.push(`ENE restante do Boss: ${formatNumberBR(nextBoss.stats.Ene)}.`);
  lines.push('Aguardando resposta do jogador. Nenhuma vitória automática foi aplicada.');
  return { boss: nextBoss, card: attack, playerAttrs: nextPlayerAttrs, damagePossible: damage, defeatedPlayer: false, lines };
}
