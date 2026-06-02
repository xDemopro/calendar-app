import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

export const BUCKET = 'event-attachments';

export type AttachmentKind = 'note' | 'picture' | 'file';

export type NoteData = { title: string; body: string };
export type PictureData = {
  path: string;
  mime_type: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  title?: string;
};
export type FileData = {
  path: string;
  name: string;
  mime_type: string;
  size_bytes?: number;
};

export type Attachment =
  | { id: string; event_id: string; created_by: string; created_at: string; kind: 'note'; data: NoteData }
  | { id: string; event_id: string; created_by: string; created_at: string; kind: 'picture'; data: PictureData }
  | { id: string; event_id: string; created_by: string; created_at: string; kind: 'file'; data: FileData };

export async function listAttachments(eventId: string): Promise<Attachment[]> {
  const { data, error } = await supabase
    .from('event_attachments')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Attachment[];
}

export async function deleteAttachment(att: Attachment): Promise<void> {
  // Remove storage object first (best-effort) so the row delete cleans the path reference.
  if (att.kind === 'picture' || att.kind === 'file') {
    const path = (att.data as any).path as string | undefined;
    if (path) {
      await supabase.storage.from(BUCKET).remove([path]);
    }
  }
  const { error } = await supabase.from('event_attachments').delete().eq('id', att.id);
  if (error) throw error;
}

// ----- Notes -----

export async function createNote(eventId: string, note: NoteData): Promise<Attachment> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('event_attachments')
    .insert({
      event_id: eventId,
      kind: 'note',
      data: note as any,
      created_by: userData.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as Attachment;
}

export async function updateNote(id: string, note: NoteData): Promise<Attachment> {
  const { data, error } = await supabase
    .from('event_attachments')
    .update({ data: note as any })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data as unknown as Attachment;
}

// ----- Pictures / Files -----

async function uploadFile(opts: {
  eventId: string;
  uri: string;
  fileName: string;
  mimeType: string;
}): Promise<string> {
  const { eventId, uri, fileName, mimeType } = opts;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decodeBase64(base64);
  // Unique path inside the event folder.
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${eventId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function addPictureFromLibrary(eventId: string): Promise<Attachment | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission denied');

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mime = asset.mimeType ?? 'image/jpeg';
  const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;
  const path = await uploadFile({
    eventId,
    uri: asset.uri,
    fileName,
    mimeType: mime,
  });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const data: PictureData = {
    path,
    mime_type: mime,
    size_bytes: asset.fileSize,
    width: asset.width,
    height: asset.height,
  };
  const { data: row, error } = await supabase
    .from('event_attachments')
    .insert({
      event_id: eventId,
      kind: 'picture',
      data: data as any,
      created_by: userData.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return row as unknown as Attachment;
}

export async function addFileFromDocuments(eventId: string): Promise<Attachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const path = await uploadFile({
    eventId,
    uri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType ?? 'application/octet-stream',
  });

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');

  const data: FileData = {
    path,
    name: asset.name,
    mime_type: asset.mimeType ?? 'application/octet-stream',
    size_bytes: asset.size,
  };
  const { data: row, error } = await supabase
    .from('event_attachments')
    .insert({
      event_id: eventId,
      kind: 'file',
      data: data as any,
      created_by: userData.user.id,
    })
    .select('*')
    .single();
  if (error) throw error;
  return row as unknown as Attachment;
}

export async function createSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}
