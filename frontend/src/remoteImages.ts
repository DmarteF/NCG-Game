import * as FileSystem from 'expo-file-system/legacy';
import { BattleEntity, Card, CT } from './types';

const MAX_RELAY_IMAGE_BYTES = 4 * 1024 * 1024;

export function isRemoteSafeImage(uri?: string) {
  return !!uri && (/^https?:\/\//i.test(uri) || /^data:image\//i.test(uri));
}

export async function imageToDataUri(uri?: string): Promise<string | undefined> {
  if (!uri) return undefined;
  if (isRemoteSafeImage(uri)) return uri;
  if (!uri.startsWith('file://')) return uri;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return undefined;
    if ('size' in info && info.size && info.size > MAX_RELAY_IMAGE_BYTES) return undefined;

    const ext = uri.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${mime};base64,${data}`;
  } catch {
    return undefined;
  }
}

export async function withRemoteImageCard(card: Card): Promise<Card> {
  return { ...card, image: await imageToDataUri(card.image) };
}

export async function withRemoteImageCT(ct: CT): Promise<CT> {
  return { ...ct, image: await imageToDataUri(ct.image) };
}

export async function withRemoteImageEntity(entity?: BattleEntity): Promise<BattleEntity | undefined> {
  return entity ? { ...entity, image: await imageToDataUri(entity.image) } : undefined;
}
