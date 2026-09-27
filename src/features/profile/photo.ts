import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { isRow, isUuid } from '@/lib/parse';
import { queryKeys } from '@/lib/query-client';
import { toApiError, unexpectedResponse } from '@/lib/rpc-errors';
import { getSupabase } from '@/lib/supabase';

/**
 * Foto de perfil (com consentimento): quadrada, 512 px, JPEG, num bucket privado. Quem vê são só
 * os membros das Legiões da pessoa, pela política do Storage; o app pede links que vencem em 1 h.
 */
const BUCKET = 'avatars';
const SIZE = 512;
const LINK_SECONDS = 60 * 60;

export function avatarPath(userId: string): string {
  return `${userId}/avatar.jpg`;
}

export type PickResult = 'done' | 'cancelled' | 'permission_denied';

/** Escolhe (câmera ou galeria), recorta em quadrado, reduz e envia. Só depois marca a troca. */
export async function pickAndUploadPhoto(userId: string, from: 'camera' | 'galeria'): Promise<PickResult> {
  if (!isUuid(userId)) throw unexpectedResponse();
  const permission =
    from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return 'permission_denied';

  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const picked = from === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const uri = picked.canceled ? null : (picked.assets[0]?.uri ?? null);
  if (!uri) return 'cancelled';

  // Reduzir no aparelho: sai uma foto pequena, sem os metadados da original (local, câmera).
  const rendered = await ImageManipulator.manipulate(uri).resize({ width: SIZE, height: SIZE }).renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const body = await (await fetch(saved.uri)).arrayBuffer();

  const { error: uploadError } = await getSupabase()
    .storage.from(BUCKET)
    .upload(avatarPath(userId), body, { contentType: 'image/jpeg', upsert: true, cacheControl: '3600' });
  if (uploadError) throw toApiError(uploadError);

  const { error } = await getSupabase().rpc('set_avatar', { p_present: true });
  if (error) throw toApiError(error);
  return 'done';
}

/** Tira a foto: primeiro deixa de valer (ninguém mais vê), depois apaga o arquivo. */
export async function removePhoto(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('set_avatar', { p_present: false });
  if (error) throw toApiError(error);
  await deletePhotoFile(userId);
}

/** Apaga o arquivo da própria foto. A política deixa, com ou sem consentimento. */
export async function deletePhotoFile(userId: string): Promise<void> {
  if (!isUuid(userId)) throw unexpectedResponse();
  const { error } = await getSupabase().storage.from(BUCKET).remove([avatarPath(userId)]);
  if (error) throw toApiError(error);
}

/** Links temporários das fotos de quem a pessoa pode ver. Quem não pode simplesmente não vem. */
export async function photoLinks(userIds: readonly string[]): Promise<Record<string, string>> {
  const valid = userIds.filter(isUuid);
  if (valid.length === 0) return {};
  const { data, error } = await getSupabase().storage.from(BUCKET).createSignedUrls(valid.map(avatarPath), LINK_SECONDS);
  if (error) throw toApiError(error);
  const links: Record<string, string> = {};
  for (const item of data ?? []) {
    const owner = typeof item.path === 'string' ? item.path.split('/')[0] : undefined;
    if (owner && isUuid(owner) && typeof item.signedUrl === 'string' && item.signedUrl.startsWith('https://') && !item.error) {
      links[owner] = item.signedUrl;
    }
  }
  return links;
}

type LegionPhoto = { userId: string; updatedAt: string };

function parseLegionPhotos(value: unknown): LegionPhoto[] | null {
  if (!Array.isArray(value)) return null;
  const photos: LegionPhoto[] = [];
  for (const row of value) {
    if (!isRow(row) || !isUuid(row.user_id) || typeof row.avatar_updated_at !== 'string') return null;
    photos.push({ userId: row.user_id, updatedAt: row.avatar_updated_at });
  }
  return photos;
}

async function fetchLegionPhotoLinks(legionId: string): Promise<Record<string, string>> {
  const { data, error } = await getSupabase().rpc('legion_photos', { p_group_id: legionId });
  if (error) throw toApiError(error);
  const photos = parseLegionPhotos(data);
  if (!photos) throw unexpectedResponse();
  return photoLinks(photos.map((photo) => photo.userId));
}

/** Fotos dos membros de uma Legião (id → link). Sem foto, o emblema continua no lugar. */
export function useLegionPhotos(legionId: string | null | undefined): Record<string, string> {
  const photos = useQuery({
    queryKey: queryKeys.photos(legionId ?? ''),
    queryFn: () => fetchLegionPhotoLinks(legionId as string),
    enabled: Boolean(legionId),
    // O link vale 1 h; renova antes de vencer.
    staleTime: 45 * 60 * 1000,
  });
  return photos.data ?? {};
}

/** Link da própria foto, se houver. A versão entra na chave: trocar a foto troca o link. */
export function useMyPhoto(userId: string | null | undefined, avatarUpdatedAt: string | null | undefined): string | null {
  const photo = useQuery({
    queryKey: queryKeys.myPhoto(avatarUpdatedAt ?? ''),
    queryFn: async () => (await photoLinks([userId as string]))[userId as string] ?? null,
    enabled: Boolean(userId && avatarUpdatedAt),
    staleTime: 45 * 60 * 1000,
  });
  return avatarUpdatedAt ? (photo.data ?? null) : null;
}
