import { ATTRS, Attr } from './theme';
import { AttrValues, Card, CardActionType, CardEffect, CardSpeed, CardType, CT, DurationType, EntityType, StackBehavior, UnlimitedFlags } from './types';

const emptyAttrs = (): Record<Attr, number> => ({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
const validEntityTypes: EntityType[] = ['invocação', 'marionete', 'edo tensei'];
const validCardTypes: CardType[] = ['técnica', 'modo/buff', 'arma/equipamento', 'invocação', 'edo tensei', 'marionete'];
const validActionTypes: CardActionType[] = ['attribute', 'attack', 'defense', 'equipment', 'mode', 'entity'];
const validDurationTypes: DurationType[] = ['instantâneo', 'turnos', 'persistente'];
const validStack: StackBehavior[] = ['stack', 'replace'];

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
  return 'técnica';
}

function normalizeEntityType(entityType?: EntityType): EntityType | undefined {
  if (!entityType) return undefined;
  if (validEntityTypes.includes(entityType)) return entityType;
  return 'invocação';
}

function inferEffect(card: Partial<Card>): CardEffect {
  if (card.effect) return card.effect;
  const hasCost = Object.keys(card.cost || {}).length > 0;
  const hasBoost = Object.keys(card.boost || {}).length > 0;
  const hasUnlimited = Object.keys(card.unlimited || {}).length > 0;
  if (hasUnlimited) return 'unlimited';
  if (hasCost && hasBoost) return 'cost_boost';
  if (hasCost) return 'cost';
  if (hasBoost) return 'boost';
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
  const entityType = normalizeEntityType(card.entityType);
  const cardType = inferCardType({ ...card, entityType });
  const actionType = card.actionType && validActionTypes.includes(card.actionType)
    ? card.actionType
    : cardType === 'arma/equipamento'
      ? 'equipment'
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
  };
}
