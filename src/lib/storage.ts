// Shared helpers for uploading files to Supabase Storage from React Native.
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from './supabase';

export async function uploadFileToBucket(opts: {
  bucket: string;
  path: string;
  uri: string;
  mimeType: string;
  upsert?: boolean;
}): Promise<void> {
  const { bucket, path, uri, mimeType, upsert = false } = opts;
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bytes = decodeBase64(base64);
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: mimeType,
    upsert,
  });
  if (error) throw error;
}

export async function signedUrl(bucket: string, path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Synchronous URL for objects in a PUBLIC bucket. No network roundtrip. */
export function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function deleteObject(bucket: string, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
}
