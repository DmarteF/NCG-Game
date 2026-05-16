import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import ImagePickerField from '../src/components/ImagePickerField';
import { Storage } from '../src/storage';
import { VILLAGES, theme } from '../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [village, setVillage] = useState<string>('');
  const [image, setImage] = useState<string | undefined>();
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>();

  useEffect(() => {
    Storage.getProfile().then((p) => {
      if (p) {
        setName(p.name);
        setVillage(p.village);
        setImage(p.image);
        setBackgroundImage(p.backgroundImage);
      }
    });
  }, []);

  const save = async () => {
    if (!name.trim()) return Alert.alert('Atenção', 'Informe o nome do personagem.');
    if (!(VILLAGES as readonly string[]).includes(village)) return Alert.alert('Atenção', 'Selecione uma vila válida.');
    await Storage.saveProfile({ name: name.trim(), village, image, backgroundImage });
    router.back();
  };

  return (
    <Screen testID="profile-screen">
      <Header title={image ? 'Editar Perfil' : 'Criar Perfil'} onBack={() => router.back()} />

      <View style={styles.avatarWrap}>
        <ImagePickerField
          value={image}
          onChange={setImage}
          size={140}
          shape="circle"
          label="Foto do personagem"
          testID="profile-image-picker"
        />
      </View>

      <Input
        label="Nome do personagem"
        value={name}
        onChangeText={setName}
        placeholder="Ex: Hiroshi"
        testID="profile-name-input"
        maxLength={32}
      />

      <Text style={styles.label}>Vila</Text>
      <View style={styles.villageRow}>
        {VILLAGES.map((v) => {
          const active = v === village;
          return (
            <Pressable
              key={v}
              onPress={() => setVillage(v)}
              testID={`village-${v}`}
              style={({ pressed }) => [
                styles.village,
                active && styles.villageActive,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.villageText, active && styles.villageTextActive]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.backgroundBlock}>
        <ImagePickerField
          value={backgroundImage}
          onChange={setBackgroundImage}
          size={180}
          shape="rect"
          label="Background do app"
          testID="profile-background-picker"
        />
        <Text style={styles.bgHint}>Usado como fundo global nas telas principais. Se remover, o app volta ao fundo padrão.</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Cancelar" variant="ghost" onPress={() => router.back()} testID="profile-cancel-btn" />
        <Button title="Salvar" onPress={save} testID="profile-save-btn" style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

export function Header({ title, onBack, right }: { title: string; onBack: () => void; right?: React.ReactNode }) {
  return (
    <View style={hStyles.row}>
      <Pressable onPress={onBack} testID="header-back-btn" style={({ pressed }) => [hStyles.back, { opacity: pressed ? 0.7 : 1 }]}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
      </Pressable>
      <Text style={hStyles.title} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

const hStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
});

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginVertical: 16 },
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  villageRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  village: {
    flex: 1, minWidth: '30%',
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center',
  },
  villageActive: { backgroundColor: 'rgba(255,59,0,0.15)', borderColor: theme.colors.borderActive },
  villageText: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700' },
  villageTextActive: { color: '#fff' },
  backgroundBlock: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: 14,
    marginBottom: 10,
  },
  bgHint: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
});
