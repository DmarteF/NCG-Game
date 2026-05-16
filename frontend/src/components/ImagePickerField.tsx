import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
} from 'react-native';

import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import ZoomableImageModal from './ZoomableImageModal';

type Props = {
  value?: string;
  onChange: (uri: string | undefined) => void;
  label?: string;
  shape?: 'circle' | 'rect';
  size?: number;
  testID?: string;
};

export default function ImagePickerField({
  value,
  onChange,
  label,
  shape = 'rect',
  size = 160,
  testID,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  async function pickImage() {
    try {
      setLoading(true);

      // pede permissão
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Permita acesso às fotos.'
        );
        return;
      }

      // abre galeria
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 1,
        });

      // cancelou
      if (result.canceled) {
        return;
      }

      // pega URI original
      const imageUri =
        result.assets?.[0]?.uri;

      if (!imageUri) {
        Alert.alert(
          'Erro',
          'Imagem inválida.'
        );
        return;
      }

      // salva URI ORIGINAL
      onChange(imageUri);

    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível selecionar imagem.'
      );
    } finally {
      setLoading(false);
    }
  }

  const radius =
    shape === 'circle'
      ? size / 2
      : theme.radius.lg;

  return (
    <View
      style={{
        alignItems: 'center',
        gap: 8,
      }}
    >
      {label ? (
        <Text style={styles.label}>
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={pickImage}
        onLongPress={() => value && setPreviewOpen(true)}
        disabled={loading}
        testID={testID}
        style={({ pressed }) => [
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radius,
            opacity:
              pressed || loading
                ? 0.75
                : 1,
          },
        ]}
      >
        {value ? (
          <Image
            source={{ uri: value }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: radius,
            }}
            resizeMode={shape === 'circle' ? 'cover' : 'contain'}
          />
        ) : (
          <View
            style={{
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Ionicons
              name="image-outline"
              size={28}
              color={theme.colors.primary}
            />

            <Text style={styles.hint}>
              {loading
                ? 'Carregando...'
                : 'Selecionar da galeria'}
            </Text>
          </View>
        )}
      </Pressable>

      {value ? (
        <>
          <Pressable onPress={() => setPreviewOpen(true)} style={styles.previewBtn} testID={`${testID || 'image'}-preview-btn`}>
            <Ionicons name="search" size={14} color="#fff" />
            <Text style={styles.previewText}>Ver imagem</Text>
          </Pressable>
          <Text style={styles.previewHint}>Toque para trocar. Segure ou use a lupa para ampliar.</Text>
        </>
      ) : null}

      {value ? (
        <Pressable
          onPress={() =>
            onChange(undefined)
          }
        >
          <Text style={styles.remove}>
            Remover
          </Text>
        </Pressable>
      ) : null}
      <ZoomableImageModal uri={previewOpen ? value || null : null} onClose={() => setPreviewOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  box: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  hint: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },

  remove: {
    color: theme.colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,59,0,0.18)',
    borderWidth: 1,
    borderColor: theme.colors.borderActive,
  },
  previewText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  previewHint: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
});
