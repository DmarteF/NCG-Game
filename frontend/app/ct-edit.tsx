import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import Chip from '../src/components/Chip';
import { Storage, uid } from '../src/storage';
import { CT } from '../src/types';
import { Attr, CT_ATTRS, theme, CT_RANKS, Rank } from '../src/theme';
import { Header } from './profile';
import { sanitizeNum } from './card-edit';
import { formatNumberBR } from '../src/format';

const emptyAttrs = (): Record<Attr, number> => ({ Atk: 0, Def: 0, Dur: 0, Ag: 0, Ck: 0, Hp: 0 });
const ctBaseAttrs = (attrs: Partial<Record<Attr, number>> = {}) => {
  const next = emptyAttrs();
  CT_ATTRS.forEach((a) => { next[a] = attrs[a] ?? 0; });
  next.Dur = 0;
  return next;
};

export default function CTEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [rank, setRank] = useState<Rank>('E');
  const [image, setImage] = useState<string | undefined>();
  const [attrs, setAttrs] = useState<Record<Attr, number>>(emptyAttrs());

  useEffect(() => {
    if (!id) return;
    Storage.getCTs().then((cts) => {
      const c = cts.find(x => x.id === id);
      if (c) {
        setName(c.name); setRank(String(c.rank) === 'S-R' ? 'E' : c.rank); setImage(c.image);
        setAttrs(ctBaseAttrs(c.attrs));
      }
    });
  }, [id]);

  const save = async () => {
    const ct: CT = { id: id || uid(), name: name.trim(), rank: String(rank) === 'S-R' ? 'E' : rank, image, attrs: ctBaseAttrs(attrs), unlimited: {} };
    const list = await Storage.getCTs();
    const next = id ? list.map(x => x.id === id ? ct : x) : [...list, ct];
    await Storage.saveCTs(next);
    router.back();
  };

  return (
    <Screen testID="ct-edit-screen">
      <Header title={id ? 'Editar O C.T' : 'Novo O C.T'} onBack={() => router.back()} />

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <ImagePickerField value={image} onChange={setImage} label="Imagem do O C.T" size={180} testID="ct-image-picker" />
      </View>

      <Input label="Nome do O C.T (opcional)" value={name} onChangeText={setName} placeholder={`O C.T Rank ${rank}`} testID="ct-name-input" />

      <Text style={styles.label}>Rank</Text>
      <View style={styles.row}>
        {CT_RANKS.map(r => (
          <Chip key={r} label={r} active={r === rank} onPress={() => setRank(r)} testID={`rank-${r}`} />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 12 }]}>Atributos</Text>
      {CT_ATTRS.map(a => (
        <View key={a} style={{ marginBottom: 4 }}>
          <Input
            label={`${a} (${formatNumberBR(attrs[a] ?? 0)})`}
            keyboardType="numeric"
            value={String(attrs[a] ?? 0)}
            onChangeText={(t) => setAttrs({ ...attrs, [a]: sanitizeNum(t) })}
            placeholder="0"
            testID={`ct-attr-${a}-input`}
          />
        </View>
      ))}

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} testID="ct-cancel-btn" />
        <Button title="Salvar O C.T" onPress={save} testID="ct-save-btn" style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16, marginBottom: 20 },
});
