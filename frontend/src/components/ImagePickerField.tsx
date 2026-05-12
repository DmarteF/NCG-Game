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
  size = 140,
  testID,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function pickImage() {
    try {
      setLoading(true);

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permissão necessária',
          'Permita acesso às fotos para escolher imagens.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const imageUri = result.assets?.[0]?.uri;

      if (!imageUri) {
        Alert.alert('Erro', 'Imagem inválida.');
        return;
      }

      // SALVA DIRETO A URI
      onChange(imageUri);
    } catch (err) {
      console.log(err);

      Alert.alert(
        'Erro',
        'Não foi possível selecionar a imagem.'
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
    <View style={{ alignItems: 'center', gap: 8 }}>
      {label ? (
        <Text style={styles.label}>
          {label}
        </Text>
      ) : null}

      <Pressable
        onPress={pickImage}
        disabled={loading}
        testID={testID}
        style={({ pressed }) => [
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radius,
            opacity:
              pressed || loading ? 0.75 : 1,
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
            resizeMode="cover"
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
        <Pressable
          onPress={() => onChange(undefined)}
        >
          <Text style={styles.remove}>
            Remover
          </Text>
        </Pressable>
      ) : null}
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
});
