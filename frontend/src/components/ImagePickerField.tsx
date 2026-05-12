import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
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

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function ImagePickerField({ value, onChange, label, shape = 'rect', size = 140, testID }: Props) {
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    if (loading) return;

    try {
      setLoading(true);

      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!perm.granted) {
          Alert.alert('Permissão necessária', 'Autorize o acesso à galeria.');
          return;
        }

        await wait(150);
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 1,
        base64: false,
        exif: false,
        selectionLimit: 1,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert('Erro', 'Falha ao carregar imagem.');
        return;
      }

      // Persist image inside app storage so it survives app restarts.
      const extension = asset.uri.split('.').pop() || 'jpg';
      const fileName = `img_${Date.now()}.${extension}`;
      const permanentUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.copyAsync({
        from: asset.uri,
        to: permanentUri,
      });

      onChange(permanentUri);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    } finally {
      setLoading(false);
    }
  };

  const radius = shape === 'circle' ? size / 2 : theme.radius.lg;

  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        onPress={pick}
        disabled={loading}
        testID={testID}
        style={({ pressed }) => [
          styles.box,
          {
            width: size,
            height: size,
            borderRadius: radius,
            opacity: pressed || loading ? 0.75 : 1,
          },
        ]}
      >
        {value ? (
          <Image
            source={{ uri: value }}
            style={{ width: '100%', height: '100%', borderRadius: radius }}
            resizeMode="cover"
          />
        ) : (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Ionicons name="image-outline" size={28} color={theme.colors.primary} />
            <Text style={styles.hint}>
              {loading ? 'Carregando...' : 'Selecionar da galeria'}
            </Text>
          </View>
        )}
      </Pressable>

      {value ? (
        <Pressable
          onPress={() => onChange(undefined)}
          testID={testID ? `${testID}-remove` : undefined}
        >
          <Text style={styles.remove}>Remover</Text>
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
