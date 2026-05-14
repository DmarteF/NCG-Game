import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import Chip from '../src/components/Chip';
import { Storage, uid } from '../src/storage';
import { Card, CardEffect, AttrValues, UnlimitedFlags, EntityType } from '../src/types';
import { ATTRS, Attr, theme, CARD_RANKS, CardRank } from '../src/theme';
import { Header } from './profile';

const EFFECTS: { id: CardEffect; label: string }[] = [
  { id: 'none', label: 'Sem efeito' },
  { id: 'cost', label: 'Possui custo' },
  { id: 'boost', label: 'Possui aumento' },
  { id: 'cost_boost', label: 'Custo e aumento' },
  { id: 'unlimited', label: 'Atributo ilimitado' },
];
const ENTITY_TYPES: EntityType[] = ['invocação', 'marionete', 'edo tensei', 'entidade', 'criatura'];

export default function CardEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<string | undefined>();
  const [rank, setRank] = useState<CardRank>('E');
  const [effect, setEffect] = useState<CardEffect>('none');
  const [entityType, setEntityType] = useState<EntityType | undefined>();
  const [entityAttrs, setEntityAttrs] = useState<Record<Attr, number>>({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
  const [entityUnlimited, setEntityUnlimited] = useState<UnlimitedFlags>({});
  const [cost, setCost] = useState<AttrValues>({});
  const [boost, setBoost] = useState<AttrValues>({});
  const [unlimited, setUnlimited] = useState<UnlimitedFlags>({});

  useEffect(() => {
    if (!id) return;
    Storage.getCards().then((cards) => {
      const c = cards.find(x => x.id === id);
      if (c) {
        setName(c.name); setCaption(c.caption); setImage(c.image);
        setRank(c.rank || 'E'); setEntityType(c.entityType);
        setEntityAttrs({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0, ...(c.entityAttrs || {}) });
        setEntityUnlimited(c.entityUnlimited || {});
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
      effect,
      entityType,
      entityAttrs: entityType ? entityAttrs : undefined,
      entityUnlimited: entityType ? entityUnlimited : undefined,
      cost: cleanAttrs(cost),
      boost: cleanAttrs(boost),
      unlimited,
    };
    const list = await Storage.getCards();
    const next = id ? list.map(x => x.id === id ? card : x) : [...list, card];
    await Storage.saveCards(next);
    router.back();
  };

  const showCost = effect === 'cost' || effect === 'cost_boost';
  const showBoost = effect === 'boost' || effect === 'cost_boost';
  const showUnl = effect === 'unlimited';

  return (
    <Screen testID="card-edit-screen">
      <Header title={id ? 'Editar Card' : 'Novo Card'} onBack={() => router.back()} />

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <ImagePickerField value={image} onChange={setImage} label="Imagem do Card" size={140} testID="card-image-picker" />
      </View>

      <Input label="Nome do Card" value={name} onChangeText={setName} placeholder="Ex: Rasengan" testID="card-name-input" />
      <Input label="Legenda padrão" value={caption} onChangeText={setCaption} placeholder="Descrição da técnica" multiline numberOfLines={3} style={{ minHeight: 80, textAlignVertical: 'top' }} testID="card-caption-input" />

      <Text style={styles.label}>Rank</Text>
      <View style={styles.chipsRow}>
        {CARD_RANKS.map(r => (
          <Chip key={r} label={r} active={rank === r} onPress={() => setRank(r)} testID={`card-rank-${r}`} />
        ))}
      </View>

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
              label={`${a}${entityUnlimited[a] ? ' (ilimitado)' : ''}`}
              keyboardType="numeric"
              editable={!entityUnlimited[a]}
              value={entityUnlimited[a] ? '' : String(entityAttrs[a] ?? 0)}
              onChangeText={(t) => setEntityAttrs({ ...entityAttrs, [a]: sanitizeNum(t) })}
              placeholder={entityUnlimited[a] ? 'ilimitado' : '0'}
              testID={`entity-attr-${a}`}
            />
          ))}
          <UnlimitedEditor unlimited={entityUnlimited} setUnlimited={setEntityUnlimited} />
        </View>
      ) : null}

      <Text style={styles.label}>Efeito</Text>
      <View style={styles.chipsRow}>
        {EFFECTS.map(e => (
          <Chip key={e.id} label={e.label} active={effect === e.id} onPress={() => setEffect(e.id)} testID={`effect-${e.id}`} />
        ))}
      </View>

      {showCost && <AttrEditor label="Custo" values={cost} setValues={setCost} keyPrefix="cost" />}
      {showBoost && <AttrEditor label="Aumento" values={boost} setValues={setBoost} keyPrefix="boost" />}
      {showUnl && <UnlimitedEditor unlimited={unlimited} setUnlimited={setUnlimited} />}

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} testID="card-cancel-btn" />
        <Button title="Salvar Card" onPress={save} testID="card-save-btn" style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

export function AttrEditor({ label, values, setValues, keyPrefix }: { label: string; values: AttrValues; setValues: (v: AttrValues) => void; keyPrefix: string }) {
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
        {ATTRS.map(a => (
          <Chip key={a} label={a} active={a in values} onPress={() => toggle(a)} testID={`${keyPrefix}-toggle-${a}`} />
        ))}
      </View>
      {ATTRS.filter(a => a in values).map(a => (
        <Input
          key={a}
          label={`${label} ${a}`}
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
