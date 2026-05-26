import { ATTRS, Attr } from './theme';
import { AttrValues, BattleUseType, Card, CardActionType, CardEffect, CardSpeed, CardType, CT, DiverseSummonType, DurationType, EntityType, MovementRange, MovementType, SensoryType, StackBehavior, TargetShape, UnlimitedFlags } from './types';

const emptyAttrs = (): Record<Attr, number> => ({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
const validEntityTypes: EntityType[] = ['invocação', 'marionete', 'edo tensei'];
export const SIMPLE_CARD_TYPES: CardType[] = ['técnica', 'modo/buff', 'arma/equipamento', 'invocação', 'invocação diversa', 'edo tensei', 'marionete', 'percepção/rastreamento/reação'];
export const SIMPLE_BATTLE_USES: BattleUseType[] = ['ataque', 'defesa', 'movimentação', 'suporte'];
export const SIMPLE_TARGET_SHAPES: TargetShape[] = ['único', 'área com quantidade', 'área total'];

const validCardTypes: CardType[] = [...SIMPLE_CARD_TYPES, 'movimentação'];
const validActionTypes: CardActionType[] = ['attribute', 'attack', 'defense', 'equipment', 'mode', 'entity', 'movement', 'diverse_summon', 'perception'];
const validDurationTypes: DurationType[] = ['instantâneo', 'turnos', 'persistente'];
const validStack: StackBehavior[] = ['stack', 'replace'];
const validMovementRanges: MovementRange[] = ['curto', 'médio', 'longo', 'global/dimensional'];
const validMovementTypes: MovementType[] = ['avanço', 'recuo', 'esquiva', 'aproximação', 'reposicionamento', 'voo', 'teleporte', 'deslocamento dimensional'];
const validDiverseSummonTypes: DiverseSummonType[] = ['clone', 'grupo', 'enxame', 'constructo', 'invocação menor', 'objeto invocado'];
const validTargetShapes: TargetShape[] = [...SIMPLE_TARGET_SHAPES, 'área', 'linha', 'cone', 'todos ao redor', 'grupo'];
const validBattleUses: BattleUseType[] = [...SIMPLE_BATTLE_USES, 'esquiva', 'aproximação', 'recuo', 'reposicionamento', 'ataque + movimentação', 'ataque + esquiva', 'defesa + movimentação'];
const validSensoryTypes: SensoryType[] = ['percepção', 'detecção', 'rastreamento', 'leitura sensorial', 'reação', 'reação instantânea'];

function cleanAttrValues(values?: AttrValues): AttrValues {
  const out: AttrValues = {};
  for (const attr of ATTRS) {
    const value = values?.[attr];
    if (typeof value === 'number' && Number.isFinite(value)) out[attr] = value;
  }
  return out;
}

function cleanUnlimited(values?: UnlimitedFlags): UnlimitedFlags {
  const out: UnlimitedFlags = {};
  for (const attr of ATTRS) {
    if (values?.[attr]) out[attr] = true;
  }
  return out;
}

function inferCardType(card: Partial<Card>): CardType {
  if (card.cardType && validCardTypes.includes(card.cardType)) return card.cardType;
  if (card.entityType === 'marionete') return 'marionete';
  if (card.entityType === 'edo tensei') return 'edo tensei';
  if (card.entityType) return 'invocação';
  if (card.actionType === 'equipment') return 'arma/equipamento';
  if (card.actionType === 'mode') return 'modo/buff';
  if (card.actionType === 'movement') return 'movimentação';
  if (card.actionType === 'diverse_summon') return 'invocação diversa';
  if (card.actionType === 'perception') return 'percepção/rastreamento/reação';
  return 'técnica';
}

function normalizeEntityType(entityType?: EntityType | string): EntityType | undefined {
  if (!entityType) return undefined;
  if (validEntityTypes.includes(entityType as EntityType)) return entityType as EntityType;
  return 'invocação';
}

function cleanOption<T extends string>(value: unknown, valid: readonly T[]): T | undefined {
  return typeof value === 'string' && valid.includes(value as T) ? value as T : undefined;
}

function cleanPositiveNumber(value: unknown) {
  const n = Math.trunc(Number(value || 0));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function normalizeCardTypeForUi(cardType?: CardType): CardType {
  return cardType === 'movimentação' ? 'técnica' : cardType || 'técnica';
}

export function normalizeTargetShape(shape?: TargetShape): TargetShape | undefined {
  if (!shape) return undefined;
  if (shape === 'linha' || shape === 'cone' || shape === 'grupo' || shape === 'área') return 'área com quantidade';
  if (shape === 'todos ao redor') return 'área total';
  return shape;
}

export function normalizeBattleUse(use?: BattleUseType): BattleUseType | undefined {
  if (!use) return undefined;
  if (use === 'esquiva' || use === 'aproximação' || use === 'recuo' || use === 'reposicionamento') return 'movimentação';
  if (use.includes('ataque')) return 'ataque';
  if (use.includes('defesa')) return 'defesa';
  return use;
}

export function cardUses(card: Partial<Card>): Record<'ataque' | 'defesa' | 'movimentação' | 'suporte', boolean> {
  const use = card.battleUseType;
  return {
    ataque: !!(card.countsAsAttack || card.actionType === 'attack' || use?.includes('ataque')),
    defesa: !!(card.countsAsDefense || card.actionType === 'defense' || use?.includes('defesa')),
    movimentação: !!(card.countsAsMovement || card.countsAsDodge || card.actionType === 'movement' || card.cardType === 'movimentação' || use?.includes('movimentação') || ['esquiva', 'aproximação', 'recuo', 'reposicionamento'].includes(use || '')),
    suporte: !!(card.actionType === 'attribute' || card.actionType === 'mode' || card.actionType === 'entity' || card.actionType === 'diverse_summon' || card.actionType === 'perception' || ['modo/buff', 'invocação', 'invocação diversa', 'edo tensei', 'marionete', 'percepção/rastreamento/reação'].includes(card.cardType || '') || use === 'suporte'),
  };
}

export function battleUseLabel(card: Partial<Card>) {
  const uses = cardUses(card);
  return SIMPLE_BATTLE_USES.filter(use => uses[use as keyof typeof uses]).map(use => use[0].toUpperCase() + use.slice(1)).join(' + ') || (card.battleUseType || 'Suporte');
}

export function targetShapeLabel(shape?: TargetShape) {
  return normalizeTargetShape(shape) || shape;
}

export function ignoresCTDefense(card: Partial<Card>) {
  return !!(card.ignoresCTDefense || card.directHpDamage || card.piercing);
}

export function ignoresCTAndModeDefense(card: Partial<Card>) {
  return !!card.ignoresCommonDefense;
}

function inferEffect(card: Partial<Card>): CardEffect {
  const hasCost = Object.keys(card.cost || {}).length > 0;
  const hasBoost = Object.keys(card.boost || {}).length > 0;
  const hasUnlimited = Object.keys(card.unlimited || {}).length > 0;
  if (hasCost && hasBoost && hasUnlimited) return 'cost_boost_unlimited';
  if (hasCost && hasUnlimited) return 'cost_unlimited';
  if (hasBoost && hasUnlimited) return 'boost_unlimited';
  if (hasCost && hasBoost) return 'cost_boost';
  if (hasCost) return 'cost';
  if (hasBoost) return 'boost';
  if (hasUnlimited) return 'unlimited';
  if (card.effect) return card.effect;
  return 'none';
}

function normalizeSpeed(speed: Partial<Card>['speed']): CardSpeed | undefined {
  if (speed == null) return undefined;
  if (speed === 'instant') return 'instant';
  const n = Number(speed);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(8, Math.trunc(n)));
}

export function normalizeCard(card: Partial<Card>): Card {
  const inferredEntityType = normalizeEntityType(card.entityType);
  const cardType = inferCardType({ ...card, entityType: inferredEntityType });
  const entityType = ['invocação', 'edo tensei', 'marionete'].includes(cardType) ? inferredEntityType || (cardType as EntityType) : undefined;
  const actionType = card.actionType && validActionTypes.includes(card.actionType)
    ? card.actionType
      : cardType === 'arma/equipamento'
        ? 'equipment'
      : cardType === 'movimentação'
        ? 'movement'
      : cardType === 'invocação diversa'
        ? 'diverse_summon'
      : cardType === 'percepção/rastreamento/reação'
        ? 'perception'
      : ['invocação', 'edo tensei', 'marionete'].includes(cardType)
        ? 'entity'
        : 'attribute';
  const entityAttrs = { ...emptyAttrs(), ...(card.entityAttrs || {}) };

  return {
    id: card.id || Date.now().toString(36),
    name: card.name || '',
    caption: card.caption || '',
    image: card.image,
    rank: card.rank || 'E',
    speed: normalizeSpeed(card.speed),
    cardType,
    actionType,
    momentaryAttrs: cleanAttrValues(card.momentaryAttrs),
    useCTInfluence: !!card.useCTInfluence,
    movementRange: cleanOption(card.movementRange, validMovementRanges),
    movementType: cleanOption(card.movementType, validMovementTypes),
    sensoryType: cleanOption(card.sensoryType, validSensoryTypes),
    detectsUntilSpeed: normalizeSpeed(card.detectsUntilSpeed),
    reactionUntilSpeed: normalizeSpeed(card.reactionUntilSpeed),
    reducesSpeedBy: cleanPositiveNumber(card.reducesSpeedBy),
    detectsInvisibility: !!card.detectsInvisibility,
    detectsChakra: !!card.detectsChakra,
    detectsPresence: !!card.detectsPresence,
    tracksTarget: !!card.tracksTarget,
    tracksMovement: !!card.tracksMovement,
    summonType: cleanOption(card.summonType, validDiverseSummonTypes),
    summonQuantity: cleanPositiveNumber(card.summonQuantity),
    summonHpIndividual: cleanPositiveNumber(card.summonHpIndividual),
    summonHpTotal: cleanPositiveNumber(card.summonHpTotal),
    summonAtkIndividual: cleanPositiveNumber(card.summonAtkIndividual),
    summonDefIndividual: cleanPositiveNumber(card.summonDefIndividual),
    targetCount: cleanPositiveNumber(card.targetCount),
    maxTargets: cleanPositiveNumber(card.maxTargets),
    targetShape: normalizeTargetShape(cleanOption(card.targetShape, validTargetShapes)),
    battleUseType: normalizeBattleUse(cleanOption(card.battleUseType, validBattleUses)),
    costTargetLabel: card.costTargetLabel,
    effectTargetLabel: card.effectTargetLabel,
    combatTargetKind: card.combatTargetKind,
    fieldPosition: card.fieldPosition,
    actualTargets: cleanPositiveNumber(card.actualTargets),
    ignoresCTDefense: ignoresCTDefense(card),
    ignoresCommonDefense: ignoresCTAndModeDefense(card),
    directHpDamage: undefined,
    piercing: undefined,
    compatibleDefenseOnly: !!card.compatibleDefenseOnly,
    stoppedBySpecificDefense: !!card.stoppedBySpecificDefense,
    compatibleDefenseNote: card.compatibleDefenseNote,
    countsAsAttack: cardUses(card).ataque,
    countsAsDefense: cardUses(card).defesa,
    countsAsMovement: cardUses(card).movimentação,
    countsAsDodge: undefined,
    offensiveMovement: !!card.offensiveMovement,
    evasiveMovement: !!card.evasiveMovement,
    temporaryNote: card.temporaryNote,
    durationType: card.durationType && validDurationTypes.includes(card.durationType) ? card.durationType : card.durationType && ['manual', 'destruir', 'luta'].includes(card.durationType) ? 'persistente' : 'instantâneo',
    durationTurns: Math.max(0, Math.trunc(Number(card.durationTurns || 0))),
    upkeepCost: cleanAttrValues(card.upkeepCost),
    stackBehavior: card.stackBehavior && validStack.includes(card.stackBehavior) ? card.stackBehavior : 'stack',
    effect: inferEffect(card),
    entityType,
    entityAttrs: entityType ? entityAttrs : undefined,
    entityUnlimited: entityType ? cleanUnlimited(card.entityUnlimited) : undefined,
    cost: cleanAttrValues(card.cost),
    boost: cleanAttrValues(card.boost),
    unlimited: cleanUnlimited(card.unlimited),
  };
}

export function normalizeCT(ct: Partial<CT>): CT {
  return {
    id: ct.id || Date.now().toString(36),
    name: ct.name || '',
    rank: ct.rank || 'E',
    image: ct.image,
    attrs: { ...emptyAttrs(), ...(ct.attrs || {}), Dur: 0 },
    unlimited: {},
    resourceName: ct.resourceName === 'ENE' ? 'ENE' : undefined,
    resourceValue: ct.resourceName === 'ENE' ? cleanPositiveNumber(ct.resourceValue) || 0 : undefined,
  };
}
