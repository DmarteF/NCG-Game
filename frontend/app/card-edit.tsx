import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import Chip from '../src/components/Chip';
import { Storage, uid } from '../src/storage';
import { Card, CardActionType, CardEffect, AttrValues, UnlimitedFlags, EntityType, CardType, DurationType, CardSpeed } from '../src/types';
import { ATTRS, Attr, theme, CARD_RANKS, CardRank } from '../src/theme';
import { Header } from './profile';
import { formatNumberBR } from '../src/format';

const EFFECTS: { id: CardEffect; label: string }[] = [
  { id: 'none', label: 'Sem efeito' },
  { id: 'cost', label: 'Possui custo' },
  { id: 'boost', label: 'Possui aumento' },
  { id: 'cost_boost', label: 'Custo e aumento' },
  { id: 'unlimited', label: 'Atributo ilimitado' },
];
const ENTITY_TYPES: EntityType[] = ['invocação', 'marionete', 'edo tensei'];
const CARD_TYPES: { id: CardType; label: string }[] = [
  { id: 'técnica', label: 'Técnica' },
  { id: 'modo/buff', label: 'Modo/buff' },
  { id: 'arma/equipamento', label: 'Arma/equip.' },
  { id: 'invocação', label: 'Invocação' },
  { id: 'edo tensei', label: 'Edo tensei' },
  { id: 'marionete', label: 'Marionete' },
];
const DURATIONS: { id: DurationType; label: string }[] = [
  { id: 'instantâneo', label: 'Instantâneo' },
  { id: 'turnos', label: 'Por turnos' },
  { id: 'persistente', label: 'Persistente' },
];
const ACTION_TYPES: { id: CardActionType; label: string }[] = [
  { id: 'attribute', label: 'Atributo/buff' },
  { id: 'attack', label: 'Ataque' },
  { id: 'defense', label: 'Defesa' },
  { id: 'equipment', label: 'Arma/equip.' },
  { id: 'mode', label: 'Modo' },
  { id: 'entity', label: 'Invocação' },
];
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
        setCardType(c.cardType || (c.entityType ? c.entityType === 'edo tensei' ? 'edo tensei' : c.entityType === 'marionete' ? 'marionete' : 'invocação' : 'técnica'));
        setActionType(c.actionType || (c.entityType ? 'entity' : 'attribute'));
        setMomentaryAttrs(c.momentaryAttrs || {});
        setUseCTInfluence(!!c.useCTInfluence);
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
    const card: Card = {
      id: id || uid(),
      name: name.trim(),
      caption: caption.trim(),
      image,
      rank,
      speed: normalizeSpeed(speed),
      cardType,
      actionType,
      momentaryAttrs: cleanAttrs(momentaryAttrs),
      useCTInfluence,
      durationType,
      durationTurns: sanitizeNum(String(durationTurns)),
      upkeepCost: cleanAttrs(upkeepCost),
      effect,
      entityType: ['invocação', 'edo tensei', 'marionete'].includes(cardType) ? (cardType as EntityType) : entityType,
      entityAttrs: entityType ? entityAttrs : undefined,
      entityUnlimited: undefined,
      cost: cleanAttrs(cost),
      boost: cleanAttrs(boost),
      unlimited,
    };
    const list = await Storage.getCards();
    const next = id ? list.map(x => x.id === id ? card : x) : [...list, card];
    await Storage.saveCards(next);
    router.back();
  };

  const showMomentary = actionType === 'attack' || actionType === 'defense' || actionType === 'equipment';

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
              if (['invocação', 'edo tensei', 'marionete'].includes(t.id)) {
                setActionType('entity');
                setEntityType(t.id as EntityType);
              }
            }}
            testID={`card-type-${t.id}`}
          />
        ))}
      </View>

      <Text style={styles.label}>Tipo de uso</Text>
      <View style={styles.chipsRow}>
        {ACTION_TYPES.map(a => (
          <Chip
            key={a.id}
            label={a.label}
            active={actionType === a.id}
            onPress={() => {
              setActionType(a.id);
              if (a.id === 'entity') setEntityType(entityType || 'invocação');
              if (a.id !== 'entity' && entityType && actionType === 'entity') setEntityType(undefined);
            }}
            testID={`card-action-${a.id}`}
          />
        ))}
      </View>

      {showMomentary ? (
        <View>
          <AttrEditor
            label={actionType === 'defense' ? 'Defesa momentânea' : actionType === 'equipment' ? 'Atk/Def da arma' : 'Ataque momentâneo'}
            values={momentaryAttrs}
            setValues={setMomentaryAttrs}
            keyPrefix="momentary"
            allowedAttrs={actionType === 'attack' ? ['Atk'] : actionType === 'defense' ? ['Def'] : ['Atk', 'Def']}
          />
          <Text style={styles.label}>Usar atributo do O C.T/alvo no cálculo?</Text>
          <View style={styles.chipsRow}>
            <Chip label="Não" active={!useCTInfluence} onPress={() => setUseCTInfluence(false)} testID="ct-influence-no" />
            <Chip label="Sim" active={useCTInfluence} onPress={() => setUseCTInfluence(true)} testID="ct-influence-yes" />
          </View>
        </View>
      ) : null}

      <Text style={styles.label}>Entidade invocada</Text>
      <View style={styles.chipsRow}>
        <Chip label="Nenhuma" active={!entityType} onPress={() => setEntityType(undefined)} testID="entity-none" />
        {ENTITY_TYPES.map(t => (
          <Chip key={t} label={t} active={entityType === t} onPress={() => setEntityType(t)} testID={`entity-${t}`} />
        ))}
      </View>

      {entityType ? (
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

      <AttrEditor label="Custo" values={cost} setValues={setCost} keyPrefix="cost" />
      <AttrEditor label="Aumento" values={boost} setValues={setBoost} keyPrefix="boost" />
      <UnlimitedEditor unlimited={unlimited} setUnlimited={setUnlimited} />

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

const styles = StyleSheet.create({
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 20 },
});
