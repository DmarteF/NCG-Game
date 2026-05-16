import { ATTRS, Attr } from './theme';
import { AttrValues, Card, CardActionType, CardEffect, CardSpeed, CardType, CT, DiverseSummonType, DurationType, EntityType, MovementRange, MovementType, SensoryType, StackBehavior, TargetShape, UnlimitedFlags } from './types';

const emptyAttrs = (): Record<Attr, number> => ({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
const validEntityTypes: EntityType[] = ['invocação', 'marionete', 'edo tensei'];
const validCardTypes: CardType[] = ['técnica', 'modo/buff', 'arma/equipamento', 'invocação', 'edo tensei', 'marionete', 'movimentação', 'invocação diversa', 'percepção/rastreamento/reação'];
const validActionTypes: CardActionType[] = ['attribute', 'attack', 'defense', 'equipment', 'mode', 'entity', 'movement', 'diverse_summon', 'perception'];
const validDurationTypes: DurationType[] = ['instantâneo', 'turnos', 'persistente'];
const validStack: StackBehavior[] = ['stack', 'replace'];
const validMovementRanges: MovementRange[] = ['curto', 'médio', 'longo', 'global/dimensional'];
const validMovementTypes: MovementType[] = ['avanço', 'recuo', 'esquiva', 'aproximação', 'reposicionamento', 'voo', 'teleporte', 'deslocamento dimensional'];
const validDiverseSummonTypes: DiverseSummonType[] = ['clone', 'grupo', 'enxame', 'constructo', 'invocação menor', 'objeto invocado'];
const validTargetShapes: TargetShape[] = ['único', 'área', 'linha', 'cone', 'todos ao redor', 'grupo'];
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
    targetShape: cleanOption(card.targetShape, validTargetShapes),
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
