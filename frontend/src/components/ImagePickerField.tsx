import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  Platform,
} from 'react-native';

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

const wait = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

export default function ImagePickerField({
  value,
  onChange,
  label,
  shape = 'rect',
  size = 140,
  testID,
}: Props) {
  const [loading, setLoading] = useState(false);

  const pick = async () => {
    if (loading) return;

    try {
      setLoading(true);

      // pede permissão
      if (Platform.OS !== 'web') {
        const perm =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!perm.granted) {
          Alert.alert(
            'Permissão necessária',
            'Autorize o acesso às imagens.'
          );
          return;
        }

        await wait(200);
      }

      // abre galeria
      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          allowsMultipleSelection: false,
          quality: 1,
          base64: false,
          exif: false,
          selectionLimit: 1,
        });

      if (result.canceled) return;

      const asset = result.assets?.[0];

      if (!asset?.uri) {
        Alert.alert(
          'Erro',
          'Imagem inválida.'
        );
        return;
      }

      // pasta interna do app
      const folder =
        `${FileSystem.documentDirectory}saved_images/`;

      const folderInfo =
        await FileSystem.getInfoAsync(folder);

      // cria pasta se não existir
      if (!folderInfo.exists) {
        await FileSystem.makeDirectoryAsync(
          folder,
          {
            intermediates: true,
          }
        );
      }

      // nome seguro da imagem
      const fileName =
        `img_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;

      const newPath =
        `${folder}${fileName}`;

      // Android moderno retorna content://
// então salvamos manualmente em base64
const base64 =
  await FileSystem.readAsStringAsync(
    asset.uri,
    {
      encoding:
        FileSystem.EncodingType.Base64,
    }
  );

// escreve arquivo REAL dentro do app
await FileSystem.writeAsStringAsync(
  newPath,
  base64,
  {
    encoding:
      FileSystem.EncodingType.Base64,
  }
);

// verifica se salvou
const verify =
  await FileSystem.getInfoAsync(newPath);

if (!verify.exists) {
  throw new Error(
    'Falha ao salvar imagem'
  );
}

      // salva caminho permanente
      onChange(newPath);

    } catch (e) {
      console.log('IMAGE ERROR', e);

      Alert.alert(
        'Erro',
        'Não foi possível salvar a imagem.'
      );
    } finally {
      setLoading(false);
    }
  };

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
        onPress={pick}
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
                ? 'Salvando imagem...'
                : 'Selecionar da galeria'}
            </Text>
          </View>
        )}
      </Pressable>

      {value ? (
        <Pressable
          onPress={() =>
            onChange(undefined)
          }
          testID={
            testID
              ? `${testID}-remove`
              : undefined
          }
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
