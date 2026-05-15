import { ATTRS, CT_ATTRS, Attr } from './theme';
import { AttrValues, BattleEntity, Card, CT, MomentaryAction } from './types';

export type CombatResolution = {
  finalAttrs: Record<Attr, number | 'ilimitado'>;
  finalEntityAttrs?: Record<Attr, number | 'ilimitado'>;
  momentaryActions: MomentaryAction[];
};

const emptyFinal = (): Record<Attr, number | 'ilimitado'> => ({
  Atk: 0,
  Def: 0,
  Dur: 0,
  Ag: 0,
  Ck: 0,
  Hp: 0,
});

export function numeric(value: number | string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function ctBase(ct: CT) {
  const base = emptyFinal();
  CT_ATTRS.forEach((attr) => { base[attr] = numeric(ct.attrs[attr]); });
  base.Dur = 0;
  return base;
}

export function subtractAttrs(base: Record<Attr, number | 'ilimitado'>, values?: AttrValues) {
  const next = { ...base };
  for (const attr of ATTRS) {
    if (next[attr] === 'ilimitado') continue;
    if (values?.[attr] != null) next[attr] = numeric(next[attr]) - numeric(values[attr]);
  }
  return next;
}

export function applyUpkeep(base: Record<Attr, number | 'ilimitado'>, values?: AttrValues) {
  return subtractAttrs(base, values);
}

function entityBase(entity: BattleEntity) {
  const base = emptyFinal();
  ATTRS.forEach((attr) => { base[attr] = numeric(entity.attrs[attr]); });
  return base;
}

function applyCardToTarget(target: Record<Attr, number | 'ilimitado'>, card: Card, mode: 'cost' | 'boost') {
  for (const attr of ATTRS) {
    if (target[attr] === 'ilimitado') continue;
    let value = numeric(target[attr] as number);
    if (mode === 'cost' && card.cost[attr] != null) value -= numeric(card.cost[attr]);
    if (mode === 'boost' && card.boost[attr] != null) value += numeric(card.boost[attr]);
    target[attr] = value;
    if (mode === 'boost' && card.unlimited[attr]) target[attr] = 'ilimitado';
  }
}

function momentaryAttrsFor(card: Card): AttrValues {
  if (card.actionType === 'attack') return { Atk: numeric(card.momentaryAttrs?.Atk) };
  if (card.actionType === 'defense') return { Def: numeric(card.momentaryAttrs?.Def) };
  if (card.actionType === 'equipment') {
    return {
      Atk: numeric(card.momentaryAttrs?.Atk),
      Def: numeric(card.momentaryAttrs?.Def),
    };
  }
  return {};
}

function computeMomentary(card: Card, base: Record<Attr, number | 'ilimitado'>, source: 'ct' | 'entity'): MomentaryAction | null {
  if (!['attack', 'defense', 'equipment'].includes(card.actionType || 'attribute')) return null;

  const own = momentaryAttrsFor(card);
  const final: AttrValues = {};
  for (const attr of Object.keys(own) as Attr[]) {
    const ownValue = numeric(own[attr]);
    const influence = card.useCTInfluence ? numeric(base[attr] as number) : 0;
    final[attr] = ownValue + influence;
  }

  return {
    cardId: card.id,
    cardName: card.name,
    type: card.actionType || 'attack',
    own,
    usedCTInfluence: !!card.useCTInfluence,
    final,
    source,
  };
}

export function resolveCombat(activeCT: CT, activeEntity: BattleEntity | undefined, selectedCards: Card[], entityCostCardIds: string[], entityBoostCardIds: string[] = []): CombatResolution {
  const ctFinal = ctBase(activeCT);
  const entityFinal = activeEntity ? entityBase(activeEntity) : undefined;
  const entityCostSet = new Set(entityCostCardIds);
  const entityBoostSet = new Set(entityBoostCardIds);
  const momentaryActions: MomentaryAction[] = [];

  for (const card of selectedCards) {
    const costTargetsEntity = !!entityFinal && entityCostSet.has(card.id);
    const boostTargetsEntity = !!entityFinal && entityBoostSet.has(card.id);
    const costTarget = costTargetsEntity ? entityFinal! : ctFinal;
    const boostTarget = boostTargetsEntity ? entityFinal! : ctFinal;

    if (!['attack', 'defense', 'equipment'].includes(card.actionType || 'attribute')) {
      applyCardToTarget(costTarget, card, 'cost');
      applyCardToTarget(boostTarget, card, 'boost');
    } else {
      for (const attr of ATTRS) {
        if (card.cost[attr] != null) {
          if (costTarget[attr] !== 'ilimitado') costTarget[attr] = numeric(costTarget[attr] as number) - numeric(card.cost[attr]);
        }
      }
    }
  }

  for (const card of selectedCards) {
    const costTargetsEntity = !!entityFinal && entityCostSet.has(card.id);
    const boostTargetsEntity = !!entityFinal && entityBoostSet.has(card.id);
    const boostTarget = boostTargetsEntity ? entityFinal! : ctFinal;
    const source = costTargetsEntity || boostTargetsEntity ? 'entity' : 'ct';
    const momentary = computeMomentary(card, boostTarget, source);
    if (momentary) momentaryActions.push(momentary);
  }

  return {
    finalAttrs: ctFinal,
    finalEntityAttrs: entityFinal,
    momentaryActions,
  };
}

export function visibleFinalAttrs(finalAttrs: Record<Attr, number | 'ilimitado'>) {
  const hasDurEffect = finalAttrs.Dur === 'ilimitado' || Number(finalAttrs.Dur || 0) !== 0;
  return hasDurEffect ? ATTRS : CT_ATTRS;
}
