import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import Chip from '../src/components/Chip';
import { Storage, uid } from '../src/storage';
import { BattleUseType, Card, CardActionType, CardEffect, AttrValues, UnlimitedFlags, EntityType, CardType, DurationType, CardSpeed, MovementRange, MovementType, DiverseSummonType, TargetShape, SensoryType } from '../src/types';
import { ATTRS, Attr, theme, CARD_RANKS, CardRank } from '../src/theme';
import { Header } from './profile';
import { formatNumberBR } from '../src/format';
import { SIMPLE_BATTLE_USES, SIMPLE_CARD_TYPES, SIMPLE_TARGET_SHAPES, cardUses, normalizeBattleUse, normalizeCardTypeForUi, normalizeTargetShape } from '../src/normalize';

const EFFECTS: { id: CardEffect; label: string }[] = [
  { id: 'none', label: 'Sem efeito' },
  { id: 'cost', label: 'Possui custo' },
  { id: 'boost', label: 'Possui aumento' },
  { id: 'cost_boost', label: 'Custo e aumento' },
  { id: 'unlimited', label: 'Atributo ilimitado' },
  { id: 'cost_unlimited', label: 'Custo + ilimitado' },
  { id: 'boost_unlimited', label: 'Aumento + ilimitado' },
  { id: 'cost_boost_unlimited', label: 'Custo + aumento + ilimitado' },
];
const ENTITY_TYPES: EntityType[] = ['invocação', 'marionete', 'edo tensei'];
const CARD_TYPES: { id: CardType; label: string }[] = SIMPLE_CARD_TYPES.map(id => ({
  id,
  label: id === 'arma/equipamento' ? 'Arma/equip.'
    : id === 'invocação diversa' ? 'Invocação diversa/Clone'
    : id === 'percepção/rastreamento/reação' ? 'Percepção/reação'
    : id[0].toUpperCase() + id.slice(1),
}));
const DURATIONS: { id: DurationType; label: string }[] = [
  { id: 'instantâneo', label: 'Instantâneo' },
  { id: 'turnos', label: 'Por turnos' },
  { id: 'persistente', label: 'Persistente' },
];
const MOVEMENT_RANGES: { id: MovementRange; label: string }[] = [
  { id: 'curto', label: 'Curto' },
  { id: 'médio', label: 'Médio' },
  { id: 'longo', label: 'Longo' },
  { id: 'global/dimensional', label: 'Global/dimensional' },
];
const MOVEMENT_TYPES: { id: MovementType; label: string }[] = [
  { id: 'avanço', label: 'Avanço' },
  { id: 'recuo', label: 'Recuo' },
  { id: 'esquiva', label: 'Esquiva' },
  { id: 'aproximação', label: 'Aproximação' },
  { id: 'reposicionamento', label: 'Reposicionamento' },
  { id: 'voo', label: 'Voo' },
  { id: 'teleporte', label: 'Teleporte' },
  { id: 'deslocamento dimensional', label: 'Deslocamento dimensional' },
];
const DIVERSE_SUMMON_TYPES: { id: DiverseSummonType; label: string }[] = [
  { id: 'clone', label: 'Clone' },
  { id: 'grupo', label: 'Grupo' },
  { id: 'enxame', label: 'Enxame' },
  { id: 'constructo', label: 'Constructo' },
  { id: 'invocação menor', label: 'Invocação menor' },
  { id: 'objeto invocado', label: 'Objeto invocado' },
];
const TARGET_SHAPES: { id: TargetShape; label: string }[] = SIMPLE_TARGET_SHAPES.map(id => ({
  id,
  label: id === 'área com quantidade' ? 'Área com quantidade' : id === 'área total' ? 'Área total' : 'Único',
}));
const SENSORY_TYPES: { id: SensoryType; label: string }[] = [
  { id: 'percepção', label: 'Percepção' },
  { id: 'detecção', label: 'Detecção' },
  { id: 'rastreamento', label: 'Rastreamento' },
  { id: 'leitura sensorial', label: 'Leitura sensorial' },
  { id: 'reação', label: 'Reação' },
  { id: 'reação instantânea', label: 'Reação instantânea' },
];
const SENSOR_FLAGS: { key: 'detectsInvisibility' | 'detectsChakra' | 'detectsPresence' | 'tracksTarget' | 'tracksMovement'; label: string }[] = [
  { key: 'detectsInvisibility', label: 'Detecta invisibilidade' },
  { key: 'detectsChakra', label: 'Detecta chakra/energia' },
  { key: 'detectsPresence', label: 'Detecta presença' },
  { key: 'tracksTarget', label: 'Rastreia alvo' },
  { key: 'tracksMovement', label: 'Rastreia movimento' },
];
const BATTLE_USE_TYPES: { id: BattleUseType; label: string }[] = SIMPLE_BATTLE_USES.map(id => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
const SPEED_OPTIONS: { value: CardSpeed | undefined; label: string }[] = [
  { value: undefined, label: 'Sem Speed' },
  { value: 0, label: 'Speed 0' },
  { value: 1, label: 'Speed 1' },
  { value: 2, label: 'Speed 2' },
  { value: 3, label: 'Speed 3' },
  { value: 4, label: 'Speed 4' },
  { value: 5, label: 'Speed 5' },
  { value: 6, label: 'Speed 6' },
  { value: 7, label: 'Speed 7' },
  { value: 8, label: 'Speed 8' },
  { value: 'instant', label: 'Instantânea' },
];

function inferActionType(cardType: CardType, flags: Record<string, boolean>): CardActionType {
  if (cardType === 'arma/equipamento') return 'equipment';
  if (cardType === 'modo/buff') return 'mode';
  if (cardType === 'invocação diversa') return 'diverse_summon';
  if (cardType === 'percepção/rastreamento/reação') return 'perception';
  if (['invocação', 'edo tensei', 'marionete'].includes(cardType)) return 'entity';
  if (flags.countsAsAttack) return 'attack';
  if (flags.countsAsDefense) return 'defense';
  return 'attribute';
}

export default function CardEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [rank, setRank] = useState<CardRank>('E');
  const [speed, setSpeed] = useState<CardSpeed | undefined>();
  const [cardType, setCardType] = useState<CardType>('técnica');
  const [actionType, setActionType] = useState<CardActionType>('attribute');
  const [momentaryAttrs, setMomentaryAttrs] = useState<AttrValues>({});
  const [useCTInfluence, setUseCTInfluence] = useState(false);
  const [movementRange, setMovementRange] = useState<MovementRange | undefined>();
  const [movementType, setMovementType] = useState<MovementType | undefined>();
  const [sensoryType, setSensoryType] = useState<SensoryType | undefined>();
  const [detectsUntilSpeed, setDetectsUntilSpeed] = useState<CardSpeed | undefined>();
  const [reactionUntilSpeed, setReactionUntilSpeed] = useState<CardSpeed | undefined>();
  const [reducesSpeedBy, setReducesSpeedBy] = useState(0);
  const [sensorFlags, setSensorFlags] = useState<Record<string, boolean>>({});
  const [summonType, setSummonType] = useState<DiverseSummonType | undefined>();
  const [summonQuantity, setSummonQuantity] = useState(0);
  const [summonHpIndividual, setSummonHpIndividual] = useState(0);
  const [summonHpTotal, setSummonHpTotal] = useState(0);
  const [summonAtkIndividual, setSummonAtkIndividual] = useState(0);
  const [summonDefIndividual, setSummonDefIndividual] = useState(0);
  const [targetCount, setTargetCount] = useState(0);
  const [maxTargets, setMaxTargets] = useState(0);
  const [targetShape, setTargetShape] = useState<TargetShape | undefined>();
  const [battleUseType, setBattleUseType] = useState<BattleUseType | undefined>();
  const [combatFlags, setCombatFlags] = useState<Record<string, boolean>>({});
  const [compatibleDefenseNote, setCompatibleDefenseNote] = useState('');
  const [durationType, setDurationType] = useState<DurationType>('instantâneo');
  const [durationTurns, setDurationTurns] = useState(0);
  const [upkeepCost, setUpkeepCost] = useState<AttrValues>({});
  const [effect, setEffect] = useState<CardEffect>('none');
  const [entityType, setEntityType] = useState<EntityType | undefined>();
  const [entityAttrs, setEntityAttrs] = useState<Record<Attr, number>>({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
  const [cost, setCost] = useState<AttrValues>({});
  const [boost, setBoost] = useState<AttrValues>({});
  const [unlimited, setUnlimited] = useState<UnlimitedFlags>({});

  useEffect(() => {
    if (!id) return;
    Storage.getCards().then((cards) => {
      const c = cards.find(x => x.id === id);
      if (c) {
        setName(c.name); setCaption(c.caption); setImage(c.image);
        setRank(c.rank || 'E'); setSpeed(normalizeSpeed(c.speed)); setEntityType(c.entityType);
        setCardType(normalizeCardTypeForUi(c.cardType || (c.entityType ? c.entityType === 'edo tensei' ? 'edo tensei' : c.entityType === 'marionete' ? 'marionete' : 'invocação' : 'técnica')));
        setActionType(c.actionType || (c.entityType ? 'entity' : 'attribute'));
        setMomentaryAttrs(c.momentaryAttrs || {});
        setUseCTInfluence(!!c.useCTInfluence);
        setMovementRange(c.movementRange);
        setMovementType(c.movementType);
        setSensoryType(c.sensoryType);
        setDetectsUntilSpeed(normalizeSpeed(c.detectsUntilSpeed));
        setReactionUntilSpeed(normalizeSpeed(c.reactionUntilSpeed));
        setReducesSpeedBy(c.reducesSpeedBy || 0);
        setSensorFlags({
          detectsInvisibility: !!c.detectsInvisibility,
          detectsChakra: !!c.detectsChakra,
          detectsPresence: !!c.detectsPresence,
          tracksTarget: !!c.tracksTarget,
          tracksMovement: !!c.tracksMovement,
        });
        setSummonType(c.summonType);
        setSummonQuantity(c.summonQuantity || 0);
        setSummonHpIndividual(c.summonHpIndividual || 0);
        setSummonHpTotal(c.summonHpTotal || 0);
        setSummonAtkIndividual(c.summonAtkIndividual || 0);
        setSummonDefIndividual(c.summonDefIndividual || 0);
        setTargetCount(c.targetCount || 0);
        setMaxTargets(c.maxTargets || 0);
        setTargetShape(normalizeTargetShape(c.targetShape));
        setBattleUseType(normalizeBattleUse(c.battleUseType));
        setCombatFlags({
          ignoresCTDefense: !!(c.ignoresCTDefense || c.directHpDamage || c.piercing),
          ignoresCommonDefense: !!c.ignoresCommonDefense,
          compatibleDefenseOnly: !!c.compatibleDefenseOnly,
          stoppedBySpecificDefense: !!c.stoppedBySpecificDefense,
          countsAsAttack: cardUses(c).ataque,
          countsAsDefense: cardUses(c).defesa,
          countsAsMovement: cardUses(c).movimentação,
          countsAsSupport: cardUses(c).suporte,
          offensiveMovement: !!c.offensiveMovement,
          evasiveMovement: !!c.evasiveMovement,
        });
        setCompatibleDefenseNote(c.compatibleDefenseNote || '');
        setDurationType(c.durationType || 'instantâneo');
        setDurationTurns(c.durationTurns || 0);
        setUpkeepCost(c.upkeepCost || {});
        setEntityAttrs({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0, ...(c.entityAttrs || {}) });
        setEffect(c.effect); setCost(c.cost); setBoost(c.boost); setUnlimited(c.unlimited);
      }
    });
  }, [id]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do card.');
    const inferredActionType = inferActionType(cardType, combatFlags);
    const card: Card = {
      id: id || uid(),
      name: name.trim(),
      caption: caption.trim(),
      image,
      rank,
      speed: normalizeSpeed(speed),
      cardType,
      actionType: inferredActionType,
      momentaryAttrs: cleanAttrs(momentaryAttrs),
      useCTInfluence,
      movementRange: showMovementFields ? movementRange : undefined,
      movementType: showMovementFields ? movementType : undefined,
      sensoryType: showPerceptionFields ? sensoryType : undefined,
      detectsUntilSpeed: showPerceptionFields ? normalizeSpeed(detectsUntilSpeed) : undefined,
      reactionUntilSpeed: showPerceptionFields ? normalizeSpeed(reactionUntilSpeed) : undefined,
      reducesSpeedBy: showPerceptionFields ? cleanOptionalNum(reducesSpeedBy) : undefined,
      detectsInvisibility: showPerceptionFields ? !!sensorFlags.detectsInvisibility : undefined,
      detectsChakra: showPerceptionFields ? !!sensorFlags.detectsChakra : undefined,
      detectsPresence: showPerceptionFields ? !!sensorFlags.detectsPresence : undefined,
      tracksTarget: showPerceptionFields ? !!sensorFlags.tracksTarget : undefined,
      tracksMovement: showPerceptionFields ? !!sensorFlags.tracksMovement : undefined,
      summonType: showDiverseSummonFields ? summonType : undefined,
      summonQuantity: showDiverseSummonFields ? cleanOptionalNum(summonQuantity) : undefined,
      summonHpIndividual: showDiverseSummonFields ? cleanOptionalNum(summonHpIndividual) : undefined,
      summonHpTotal: showDiverseSummonFields ? cleanOptionalNum(summonHpTotal) : undefined,
      summonAtkIndividual: showDiverseSummonFields ? cleanOptionalNum(summonAtkIndividual) : undefined,
      summonDefIndividual: showDiverseSummonFields ? cleanOptionalNum(summonDefIndividual) : undefined,
      targetCount: showTargeting ? cleanOptionalNum(targetCount) : undefined,
      maxTargets: showTargeting ? cleanOptionalNum(maxTargets) : undefined,
      targetShape: showTargeting ? targetShape : undefined,
      battleUseType: normalizeBattleUse(battleUseType) || (combatFlags.countsAsAttack ? 'ataque' : combatFlags.countsAsDefense ? 'defesa' : combatFlags.countsAsMovement ? 'movimentação' : 'suporte'),
      ignoresCTDefense: !!combatFlags.ignoresCTDefense,
      ignoresCommonDefense: !!combatFlags.ignoresCommonDefense,
      directHpDamage: undefined,
      piercing: undefined,
      compatibleDefenseOnly: !!combatFlags.compatibleDefenseOnly,
      stoppedBySpecificDefense: !!combatFlags.stoppedBySpecificDefense,
      compatibleDefenseNote: compatibleDefenseNote.trim() || undefined,
      countsAsAttack: !!combatFlags.countsAsAttack,
      countsAsDefense: !!combatFlags.countsAsDefense,
      countsAsMovement: !!combatFlags.countsAsMovement,
      countsAsDodge: undefined,
      offensiveMovement: !!combatFlags.offensiveMovement,
      evasiveMovement: !!combatFlags.evasiveMovement,
      durationType,
      durationTurns: sanitizeNum(String(durationTurns)),
      upkeepCost: durationType !== 'instantâneo' ? cleanAttrs(upkeepCost) : {},
      effect,
      entityType: ['invocação', 'edo tensei', 'marionete'].includes(cardType) ? (cardType as EntityType) : entityType,
      entityAttrs: showEntityFields && entityType ? entityAttrs : undefined,
      entityUnlimited: undefined,
      cost: showCost ? cleanAttrs(cost) : {},
      boost: showBoost ? cleanAttrs(boost) : {},
      unlimited: showUnlimited ? unlimited : {},
    };
    const list = await Storage.getCards();
    const next = id ? list.map(x => x.id === id ? card : x) : [...list, card];
    await Storage.saveCards(next);
    router.back();
  };

  const uses = {
    ataque: !!combatFlags.countsAsAttack || battleUseType === 'ataque',
    defesa: !!combatFlags.countsAsDefense || battleUseType === 'defesa',
    movimentação: !!combatFlags.countsAsMovement || battleUseType === 'movimentação',
    suporte: !!combatFlags.countsAsSupport || battleUseType === 'suporte',
  };
  const showMomentary = uses.ataque || uses.defesa || cardType === 'arma/equipamento';
  const showCost = effectHasCost(effect);
  const showBoost = effectHasBoost(effect);
  const showUnlimited = effectHasUnlimited(effect);
  const showTargeting = uses.ataque || cardType === 'invocação diversa';
  const showEntityFields = actionType === 'entity' || ['invocação', 'edo tensei', 'marionete'].includes(cardType);
  const showMovementFields = uses.movimentação;
  const showDiverseSummonFields = cardType === 'invocação diversa';
  const showPerceptionFields = cardType === 'percepção/rastreamento/reação';
  const showIgnoreDefense = uses.ataque || cardType === 'arma/equipamento';

  return (
    <Screen testID="card-edit-screen">
      <Header title={id ? 'Editar Card' : 'Novo Card'} onBack={() => router.back()} />

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <ImagePickerField value={image} onChange={setImage} label="Imagem do Card" size={180} testID="card-image-picker" />
      </View>

      <Input label="Nome do Card" value={name} onChangeText={setName} placeholder="Ex: Rasengan" testID="card-name-input" />
      <Input label="Legenda padrão" value={caption} onChangeText={setCaption} placeholder="Descrição da técnica" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} testID="card-caption-input" />

      <Text style={styles.label}>Rank</Text>
      <View style={styles.chipsRow}>
        {CARD_RANKS.map(r => (
          <Chip key={r} label={r} active={rank === r} onPress={() => setRank(r)} testID={`card-rank-${r}`} />
        ))}
      </View>

      <Text style={styles.label}>Speed</Text>
      <View style={styles.chipsRow}>
        {SPEED_OPTIONS.map(option => (
          <Chip
            key={String(option.value ?? 'none')}
            label={option.label}
            active={speed === option.value}
            onPress={() => setSpeed(option.value)}
            testID={`card-speed-${String(option.value ?? 'none')}`}
          />
        ))}
      </View>

      <Text style={styles.label}>Categoria RPG</Text>
      <View style={styles.chipsRow}>
        {CARD_TYPES.map(t => (
          <Chip
            key={t.id}
            label={t.label}
            active={cardType === t.id}
            onPress={() => {
              setCardType(t.id);
              if (t.id === 'arma/equipamento') setActionType('equipment');
              if (t.id === 'modo/buff') setActionType('mode');
              if (t.id === 'invocação diversa') {
                setActionType('diverse_summon');
                setEntityType(undefined);
              }
              if (t.id === 'percepção/rastreamento/reação') {
                setActionType('perception');
                setEntityType(undefined);
              }
              if (['invocação', 'edo tensei', 'marionete'].includes(t.id)) {
                setActionType('entity');
                setEntityType(t.id as EntityType);
              }
            }}
            testID={`card-type-${t.id}`}
          />
        ))}
      </View>

      {showMomentary ? (
        <View>
          <AttrEditor
            label={uses.defesa && !uses.ataque ? 'Defesa' : cardType === 'arma/equipamento' ? 'Atk/Def da arma' : 'Ataque'}
            values={momentaryAttrs}
            setValues={setMomentaryAttrs}
            keyPrefix="momentary"
            allowedAttrs={uses.ataque && uses.defesa || cardType === 'arma/equipamento' ? ['Atk', 'Def'] : uses.defesa ? ['Def'] : ['Atk']}
          />
          <Text style={styles.label}>Usar atributo do O C.T/alvo no cálculo?</Text>
          <View style={styles.chipsRow}>
            <Chip label="Não" active={!useCTInfluence} onPress={() => setUseCTInfluence(false)} testID="ct-influence-no" />
            <Chip label="Sim" active={useCTInfluence} onPress={() => setUseCTInfluence(true)} testID="ct-influence-yes" />
          </View>
        </View>
      ) : null}

      {showMovementFields ? (
        <View>
          <Text style={styles.label}>Alcance da movimentação</Text>
          <View style={styles.chipsRow}>
            {MOVEMENT_RANGES.map(option => (
              <Chip key={option.id} label={option.label} active={movementRange === option.id} onPress={() => setMovementRange(option.id)} testID={`movement-range-${option.id}`} />
            ))}
          </View>
          <Text style={styles.label}>Tipo de movimentação</Text>
          <View style={styles.chipsRow}>
            {MOVEMENT_TYPES.map(option => (
              <Chip key={option.id} label={option.label} active={movementType === option.id} onPress={() => setMovementType(option.id)} testID={`movement-type-${option.id}`} />
            ))}
          </View>
        </View>
      ) : null}

      {showDiverseSummonFields ? (
        <View>
          <Text style={styles.label}>Tipo de invocação diversa</Text>
          <View style={styles.chipsRow}>
            {DIVERSE_SUMMON_TYPES.map(option => (
              <Chip key={option.id} label={option.label} active={summonType === option.id} onPress={() => setSummonType(option.id)} testID={`summon-type-${option.id}`} />
            ))}
          </View>
          <Input label={`Quantidade (${formatNumberBR(summonQuantity)})`} value={String(summonQuantity)} onChangeText={(t) => setSummonQuantity(sanitizeNum(t))} keyboardType="numeric" testID="summon-quantity-input" />
          <Input label={`HP individual (${formatNumberBR(summonHpIndividual)})`} value={String(summonHpIndividual)} onChangeText={(t) => setSummonHpIndividual(sanitizeNum(t))} keyboardType="numeric" testID="summon-hp-individual-input" />
          <Input label={`HP total (${formatNumberBR(summonHpTotal)})`} value={String(summonHpTotal)} onChangeText={(t) => setSummonHpTotal(sanitizeNum(t))} keyboardType="numeric" testID="summon-hp-total-input" />
          <Input label={`Atk individual (${formatNumberBR(summonAtkIndividual)})`} value={String(summonAtkIndividual)} onChangeText={(t) => setSummonAtkIndividual(sanitizeNum(t))} keyboardType="numeric" testID="summon-atk-individual-input" />
          <Input label={`Def individual (${formatNumberBR(summonDefIndividual)})`} value={String(summonDefIndividual)} onChangeText={(t) => setSummonDefIndividual(sanitizeNum(t))} keyboardType="numeric" testID="summon-def-individual-input" />
        </View>
      ) : null}

      {showPerceptionFields ? (
        <View>
          <Text style={styles.label}>Tipo sensorial</Text>
          <View style={styles.chipsRow}>
            {SENSORY_TYPES.map(option => (
              <Chip key={option.id} label={option.label} active={sensoryType === option.id} onPress={() => setSensoryType(option.id)} testID={`sensory-type-${option.id}`} />
            ))}
          </View>

          <Text style={styles.label}>Detecta até Speed</Text>
          <View style={styles.chipsRow}>
            {SPEED_OPTIONS.map(option => (
              <Chip
                key={`detect-${String(option.value ?? 'none')}`}
                label={option.label}
                active={detectsUntilSpeed === option.value}
                onPress={() => setDetectsUntilSpeed(option.value)}
                testID={`detects-speed-${String(option.value ?? 'none')}`}
              />
            ))}
          </View>

          <Text style={styles.label}>Permite reação até Speed</Text>
          <View style={styles.chipsRow}>
            {SPEED_OPTIONS.map(option => (
              <Chip
                key={`reaction-${String(option.value ?? 'none')}`}
                label={option.label}
                active={reactionUntilSpeed === option.value}
                onPress={() => setReactionUntilSpeed(option.value)}
                testID={`reaction-speed-${String(option.value ?? 'none')}`}
              />
            ))}
          </View>

          <Input label={`Reduz Speed em (${formatNumberBR(reducesSpeedBy)})`} value={String(reducesSpeedBy)} onChangeText={(t) => setReducesSpeedBy(sanitizeNum(t))} keyboardType="numeric" testID="reduces-speed-input" />
          <Text style={styles.label}>Capacidades</Text>
          <View style={styles.chipsRow}>
            {SENSOR_FLAGS.map(flag => (
              <Chip
                key={flag.key}
                label={flag.label}
                active={!!sensorFlags[flag.key]}
                onPress={() => setSensorFlags(flags => ({ ...flags, [flag.key]: !flags[flag.key] }))}
                testID={`sensor-flag-${flag.key}`}
              />
            ))}
          </View>
        </View>
      ) : null}

      {showTargeting ? (
        <View>
          <Text style={styles.label}>Alvos / área</Text>
          <View style={styles.chipsRow}>
            {TARGET_SHAPES.map(option => (
              <Chip key={option.id} label={option.label} active={targetShape === option.id} onPress={() => setTargetShape(option.id)} testID={`target-shape-${option.id}`} />
            ))}
          </View>
          <Input label={`Alvos declarados/criados (${formatNumberBR(targetCount)})`} value={String(targetCount)} onChangeText={(t) => setTargetCount(sanitizeNum(t))} keyboardType="numeric" testID="target-count-input" />
          <Input label={`Máximo de alvos atingidos (${formatNumberBR(maxTargets)})`} value={String(maxTargets)} onChangeText={(t) => setMaxTargets(sanitizeNum(t))} keyboardType="numeric" testID="max-targets-input" />
        </View>
      ) : null}

      <Text style={styles.label}>Uso em batalha</Text>
      <View style={styles.chipsRow}>
        {BATTLE_USE_TYPES.map(option => (
          <Chip
            key={option.id}
            label={option.label}
            active={!!uses[option.id as keyof typeof uses]}
            onPress={() => {
              const key = option.id === 'ataque' ? 'countsAsAttack' : option.id === 'defesa' ? 'countsAsDefense' : option.id === 'movimentação' ? 'countsAsMovement' : 'countsAsSupport';
              setCombatFlags(flags => {
                const next = { ...flags, [key]: !flags[key] };
                const first = BATTLE_USE_TYPES.find(item => !!next[item.id === 'ataque' ? 'countsAsAttack' : item.id === 'defesa' ? 'countsAsDefense' : item.id === 'movimentação' ? 'countsAsMovement' : 'countsAsSupport']);
                setBattleUseType(first?.id);
                return next;
              });
            }}
            testID={`battle-use-${option.id}`}
          />
        ))}
      </View>

      {showIgnoreDefense ? (
        <>
          <Text style={styles.label}>Ignorar DEF</Text>
          <View style={styles.chipsRow}>
            <Chip label="Ignora DEF C.T" active={!!combatFlags.ignoresCTDefense} onPress={() => setCombatFlags(flags => ({ ...flags, ignoresCTDefense: !flags.ignoresCTDefense }))} testID="combat-flag-ignoresCTDefense" />
            <Chip label="Ignora DEF C.T + Modo" active={!!combatFlags.ignoresCommonDefense} onPress={() => setCombatFlags(flags => ({ ...flags, ignoresCommonDefense: !flags.ignoresCommonDefense }))} testID="combat-flag-ignoresCommonDefense" />
            <Chip label="Só defesa compatível" active={!!combatFlags.compatibleDefenseOnly} onPress={() => setCombatFlags(flags => ({ ...flags, compatibleDefenseOnly: !flags.compatibleDefenseOnly }))} testID="combat-flag-compatibleDefenseOnly" />
            <Chip label="Barreira/arma específica" active={!!combatFlags.stoppedBySpecificDefense} onPress={() => setCombatFlags(flags => ({ ...flags, stoppedBySpecificDefense: !flags.stoppedBySpecificDefense }))} testID="combat-flag-stoppedBySpecificDefense" />
          </View>
          <Input
            label="Defesa compatível / exceção"
            value={compatibleDefenseNote}
            onChangeText={setCompatibleDefenseNote}
            placeholder="Ex: só barreira dimensional ou arma específica bloqueia."
            testID="compatible-defense-note"
          />
        </>
      ) : null}

      {showEntityFields ? (
        <>
          <Text style={styles.label}>Entidade invocada</Text>
          <View style={styles.chipsRow}>
            <Chip label="Nenhuma" active={!entityType} onPress={() => setEntityType(undefined)} testID="entity-none" />
            {ENTITY_TYPES.map(t => (
              <Chip key={t} label={t} active={entityType === t} onPress={() => setEntityType(t)} testID={`entity-${t}`} />
            ))}
          </View>
        </>
      ) : null}

      {entityType && showEntityFields ? (
        <View>
          <Text style={styles.label}>Atributos próprios da entidade</Text>
          {ATTRS.map(a => (
            <Input
              key={a}
              label={`${a} (${formatNumberBR(entityAttrs[a] ?? 0)})`}
              keyboardType="numeric"
              value={String(entityAttrs[a] ?? 0)}
              onChangeText={(t) => setEntityAttrs({ ...entityAttrs, [a]: sanitizeNum(t) })}
              placeholder="0"
              testID={`entity-attr-${a}`}
            />
          ))}
        </View>
      ) : null}

      <Text style={styles.label}>Efeito</Text>
      <View style={styles.chipsRow}>
        {EFFECTS.map(e => (
          <Chip key={e.id} label={e.label} active={effect === e.id} onPress={() => setEffect(e.id)} testID={`effect-${e.id}`} />
        ))}
      </View>

      {showCost ? <AttrEditor label="Custo" values={cost} setValues={setCost} keyPrefix="cost" /> : null}
      {showBoost ? <AttrEditor label="Aumento" values={boost} setValues={setBoost} keyPrefix="boost" /> : null}
      {showUnlimited ? <UnlimitedEditor unlimited={unlimited} setUnlimited={setUnlimited} /> : null}

      <Text style={styles.label}>Duração persistente</Text>
      <View style={styles.chipsRow}>
        {DURATIONS.map(d => (
          <Chip key={d.id} label={d.label} active={durationType === d.id} onPress={() => setDurationType(d.id)} testID={`duration-${d.id}`} />
        ))}
      </View>
      {durationType === 'turnos' ? (
        <Input label="Quantidade de turnos" value={String(durationTurns)} onChangeText={(t) => setDurationTurns(sanitizeNum(t))} keyboardType="numeric" testID="duration-turns-input" />
      ) : null}
      {durationType !== 'instantâneo' ? (
        <>
          <AttrEditor label="Custo por turno" values={upkeepCost} setValues={setUpkeepCost} keyPrefix="upkeep" />
        </>
      ) : null}

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} testID="card-cancel-btn" />
        <Button title="Salvar Card" onPress={save} testID="card-save-btn" style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

export function AttrEditor({ label, values, setValues, keyPrefix, allowedAttrs = ATTRS }: { label: string; values: AttrValues; setValues: (v: AttrValues) => void; keyPrefix: string; allowedAttrs?: readonly Attr[] }) {
  const toggle = (a: Attr) => {
    const next = { ...values };
    if (a in next) delete next[a];
    else next[a] = 0;
    setValues(next);
  };
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipsRow}>
        {allowedAttrs.map(a => (
          <Chip key={a} label={a} active={a in values} onPress={() => toggle(a)} testID={`${keyPrefix}-toggle-${a}`} />
        ))}
      </View>
      {allowedAttrs.filter(a => a in values).map(a => (
        <Input
          key={a}
          label={`${label} ${a} (${formatNumberBR(values[a] ?? 0)})`}
          keyboardType="numeric"
          value={String(values[a] ?? '')}
          onChangeText={(t) => setValues({ ...values, [a]: sanitizeNum(t) })}
          placeholder="0"
          testID={`${keyPrefix}-${a}-input`}
        />
      ))}
    </View>
  );
}

export function UnlimitedEditor({ unlimited, setUnlimited }: { unlimited: UnlimitedFlags; setUnlimited: (v: UnlimitedFlags) => void }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.label}>Atributos ilimitados</Text>
      <View style={styles.chipsRow}>
        {ATTRS.map(a => (
          <Chip key={a} label={`${a} ∞`} active={!!unlimited[a]} onPress={() => setUnlimited({ ...unlimited, [a]: !unlimited[a] })} testID={`unlimited-${a}`} />
        ))}
      </View>
    </View>
  );
}

export function sanitizeNum(t: string): number {
  const n = parseInt(t.replace(/[^0-9-]/g, ''), 10);
  if (!isFinite(n) || isNaN(n)) return 0;
  return n;
}

export function normalizeSpeed(value: CardSpeed | undefined): CardSpeed | undefined {
  if (value == null) return undefined;
  if (value === 'instant') return 'instant';
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(8, Math.trunc(n)));
}

function cleanAttrs(v: AttrValues): AttrValues {
  const out: AttrValues = {};
  for (const k of Object.keys(v) as Attr[]) {
    const n = v[k];
    if (n != null && isFinite(n) && !isNaN(n)) out[k] = n;
  }
  return out;
}

function cleanOptionalNum(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : undefined;
}

function effectHasCost(effect: CardEffect) {
  return effect === 'cost' || effect === 'cost_boost' || effect === 'cost_unlimited' || effect === 'cost_boost_unlimited';
}

function effectHasBoost(effect: CardEffect) {
  return effect === 'boost' || effect === 'cost_boost' || effect === 'boost_unlimited' || effect === 'cost_boost_unlimited';
}

function effectHasUnlimited(effect: CardEffect) {
  return effect === 'unlimited' || effect === 'cost_unlimited' || effect === 'boost_unlimited' || effect === 'cost_boost_unlimited';
}

const styles = StyleSheet.create({
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 20 },
});
