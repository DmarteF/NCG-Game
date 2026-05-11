import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import Chip from '../src/components/Chip';
import { Storage, uid } from '../src/storage';
import { CT, UnlimitedFlags } from '../src/types';
import { ATTRS, Attr, theme, RANKS, Rank } from '../src/theme';
import { Header } from './profile';
import { sanitizeNum, UnlimitedEditor } from './card-edit';

export default function CTEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [rank, setRank] = useState<Rank>('E');
  const [image, setImage] = useState<string | undefined>();
  const [attrs, setAttrs] = useState<Record<Attr, number>>({ Atk: 0, Def: 0, Ag: 0, Ck: 0, Hp: 0 });
  const [unlimited, setUnlimited] = useState<UnlimitedFlags>({});

  useEffect(() => {
    if (!id) return;
    Storage.getCTs().then((cts) => {
      const c = cts.find(x => x.id === id);
      if (c) {
        setName(c.name); setRank(c.rank); setImage(c.image);
        setAttrs(c.attrs); setUnlimited(c.unlimited);
      }
    });
  }, [id]);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do O C.T.');
    const ct: CT = { id: id || uid(), name: name.trim(), rank, image, attrs, unlimited };
    const list = await Storage.getCTs();
    const next = id ? list.map(x => x.id === id ? ct : x) : [...list, ct];
    await Storage.saveCTs(next);
    router.back();
  };

  return (
    <Screen testID="ct-edit-screen">
      <Header title={id ? 'Editar O C.T' : 'Novo O C.T'} onBack={() => router.back()} />

      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <ImagePickerField value={image} onChange={setImage} label="Imagem do O C.T" size={140} testID="ct-image-picker" />
      </View>

      <Input label="Nome do O C.T" value={name} onChangeText={setName} placeholder="Ex: Kage Mode" testID="ct-name-input" />

      <Text style={styles.label}>Rank</Text>
      <View style={styles.row}>
        {RANKS.map(r => (
          <Chip key={r} label={r} active={r === rank} onPress={() => setRank(r)} testID={`rank-${r}`} />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: 12 }]}>Atributos</Text>
      {ATTRS.map(a => (
        <View key={a} style={{ marginBottom: 4 }}>
          <Input
            label={`${a}${unlimited[a] ? ' (ilimitado)' : ''}`}
            keyboardType="numeric"
            editable={!unlimited[a]}
            value={unlimited[a] ? '' : String(attrs[a] ?? 0)}
            onChangeText={(t) => setAttrs({ ...attrs, [a]: sanitizeNum(t) })}
            placeholder={unlimited[a] ? 'ilimitado' : '0'}
            testID={`ct-attr-${a}-input`}
          />
        </View>
      ))}

      <UnlimitedEditor unlimited={unlimited} setUnlimited={setUnlimited} />

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
