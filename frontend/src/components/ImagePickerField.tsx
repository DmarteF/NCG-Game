import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type Props = {
  value?: string;
  onChange: (uri: string | undefined) => void;
  label?: string;
  shape?: 'circle' | 'rect';
  size?: number;
  testID?: string;
};

const MAX_BYTES = 3 * 1024 * 1024; // ~3MB after b64

export default function ImagePickerField({ value, onChange, label, shape = 'rect', size = 140, testID }: Props) {
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Autorize o acesso à galeria nas configurações para selecionar uma imagem.');
          return;
        }
      }
      setLoading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
        base64: true,
      });
      setLoading(false);
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      let dataUri: string | undefined;
      if (asset.base64) {
        const mime = asset.mimeType || (asset.uri?.endsWith('.png') ? 'image/png' : 'image/jpeg');
        dataUri = `data:${mime};base64,${asset.base64}`;
      } else if (asset.uri?.startsWith('data:')) {
        dataUri = asset.uri;
      } else {
        dataUri = asset.uri;
      }
      if (dataUri && dataUri.startsWith('data:') && dataUri.length > MAX_BYTES * 1.4) {
        Alert.alert('Imagem grande', 'A imagem é muito grande. Tente uma menor.');
        return;
      }
      onChange(dataUri);
    } catch (e) {
      setLoading(false);
      Alert.alert('Erro', 'Não foi possível carregar a imagem.');
    }
  };

  const radius = shape === 'circle' ? size / 2 : theme.radius.lg;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={pick}
        testID={testID}
        style={({ pressed }) => [
          styles.box,
          { width: size, height: size, borderRadius: radius, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        {value ? (
          <Image source={{ uri: value }} style={{ width: '100%', height: '100%', borderRadius: radius }} />
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Ionicons name="image-outline" size={28} color={theme.colors.primary} />
            <Text style={styles.hint}>{loading ? 'Carregando...' : 'Selecionar da galeria'}</Text>
          </View>
        )}
      </Pressable>
      {value ? (
        <Pressable onPress={() => onChange(undefined)} testID={testID ? `${testID}-remove` : undefined}>
          <Text style={styles.remove}>Remover</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  box: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hint: { color: theme.colors.textMuted, fontSize: 12 },
  remove: { color: theme.colors.danger, fontSize: 12, fontWeight: '700' },
});
