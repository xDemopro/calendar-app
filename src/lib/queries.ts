import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';
import { deleteObject, uploadFileToBucket } from './storage';
import type {
  EventInsert,
  EventRow,
  EventUpdate,
  Family,
  Profile,
} from './database.types';

export const FAMILY_AVATARS_BUCKET = 'family-avatars';
export const USER_AVATARS_BUCKET = 'user-avatars';

// ----- Profile -----

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyDisplayName(name: string): Promise<Profile> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: name.trim() || null })
    .eq('id', u.user.id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function pickAndUploadMyAvatar(): Promise<Profile> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission denied');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) throw new Error('cancelled');
  const asset = result.assets[0];
  const ext =
    (asset.uri.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${u.user.id}/${Date.now()}.${ext}`;
  await uploadFileToBucket({
    bucket: USER_AVATARS_BUCKET,
    path,
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  });

  const { data: prev } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', u.user.id)
    .single();

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_path: path })
    .eq('id', u.user.id)
    .select('*')
    .single();
  if (error) throw error;
  if (prev?.avatar_path && prev.avatar_path !== path) {
    await deleteObject(USER_AVATARS_BUCKET, prev.avatar_path).catch(() => {});
  }
  return data;
}

export async function clearMyAvatar(): Promise<Profile> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { data: prev } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', u.user.id)
    .single();
  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_path: null })
    .eq('id', u.user.id)
    .select('*')
    .single();
  if (error) throw error;
  if (prev?.avatar_path) {
    await deleteObject(USER_AVATARS_BUCKET, prev.avatar_path).catch(() => {});
  }
  return data;
}

// ----- Event participants -----

export type ParticipantWithProfile = {
  user_id: string;
  added_at: string;
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_path' | 'avatar_url'> | null;
};

export async function listEventParticipants(eventId: string): Promise<ParticipantWithProfile[]> {
  const { data, error } = await supabase
    .from('event_participants')
    .select(
      'user_id, added_at, profiles!event_participants_user_profile_fkey(id, display_name, avatar_path, avatar_url)',
    )
    .eq('event_id', eventId)
    .order('added_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    added_at: row.added_at,
    profile: row.profiles ?? null,
  }));
}

export async function addEventParticipant(eventId: string, userId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { error } = await supabase.from('event_participants').insert({
    event_id: eventId,
    user_id: userId,
    added_by: u.user.id,
  });
  if (error) throw error;
}

export async function removeEventParticipant(eventId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_participants')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId);
  if (error) throw error;
}

// ----- Families -----

export async function listMyFamilies(): Promise<Family[]> {
  const { data, error } = await supabase
    .from('families')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getFamily(id: string): Promise<Family | null> {
  const { data, error } = await supabase.from('families').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createFamily(name: string): Promise<Family> {
  const { data, error } = await supabase.rpc('create_family', { p_name: name });
  if (error) throw error;
  return data as Family;
}

export async function joinFamilyByCode(code: string): Promise<Family> {
  const { data, error } = await supabase.rpc('join_family_by_code', { p_code: code });
  if (error) throw error;
  return data as Family;
}

/** Replace the family's avatar with a new image picked from the user's library. */
export async function pickAndUploadFamilyAvatar(familyId: string): Promise<Family> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission denied');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) {
    // Caller should treat null-ish as "user cancelled"
    throw new Error('cancelled');
  }
  const asset = result.assets[0];
  const ext = (asset.uri.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const path = `${familyId}/${Date.now()}.${ext}`;
  await uploadFileToBucket({
    bucket: FAMILY_AVATARS_BUCKET,
    path,
    uri: asset.uri,
    mimeType: asset.mimeType ?? 'image/jpeg',
  });

  // Fetch existing path so we can clean up the old object after the row is updated.
  const { data: prev } = await supabase
    .from('families')
    .select('avatar_path')
    .eq('id', familyId)
    .single();

  const { data, error } = await supabase
    .from('families')
    .update({ avatar_path: path })
    .eq('id', familyId)
    .select('*')
    .single();
  if (error) throw error;

  if (prev?.avatar_path && prev.avatar_path !== path) {
    await deleteObject(FAMILY_AVATARS_BUCKET, prev.avatar_path).catch(() => {});
  }
  return data;
}

export async function clearFamilyAvatar(familyId: string): Promise<Family> {
  const { data: prev } = await supabase
    .from('families')
    .select('avatar_path')
    .eq('id', familyId)
    .single();
  const { data, error } = await supabase
    .from('families')
    .update({ avatar_path: null })
    .eq('id', familyId)
    .select('*')
    .single();
  if (error) throw error;
  if (prev?.avatar_path) {
    await deleteObject(FAMILY_AVATARS_BUCKET, prev.avatar_path).catch(() => {});
  }
  return data;
}

export async function renameFamily(id: string, name: string): Promise<Family> {
  const { data, error } = await supabase
    .from('families')
    .update({ name })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFamily(id: string): Promise<void> {
  const { error } = await supabase.from('families').delete().eq('id', id);
  if (error) throw error;
}

export async function leaveFamily(familyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_id', familyId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function kickMember(familyId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('kick_family_member', {
    p_family: familyId,
    p_user: userId,
  });
  if (error) throw error;
}

// Member row joined with the user's profile.
export type FamilyMemberWithProfile = {
  user_id: string;
  role: string;
  joined_at: string;
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_path' | 'avatar_url'> | null;
};

export async function listFamilyMembers(familyId: string): Promise<FamilyMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('family_members')
    .select(
      'user_id, role, joined_at, profiles!family_members_user_profile_fkey(id, display_name, avatar_path, avatar_url)',
    )
    .eq('family_id', familyId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    role: row.role,
    joined_at: row.joined_at,
    profile: row.profiles ?? null,
  }));
}

// ----- Events -----

export type EventWithParticipants = EventRow & {
  participants: { user_id: string; profile: Pick<Profile, 'id' | 'display_name' | 'avatar_path' | 'avatar_url'> | null }[];
};

export async function listEventsWithParticipants(
  familyId: string,
  fromIso: string,
  toIso: string,
): Promise<EventWithParticipants[]> {
  const { data, error } = await supabase
    .from('events')
    .select(
      '*, event_participants(user_id, profiles!event_participants_user_profile_fkey(id, display_name, avatar_path, avatar_url))',
    )
    .eq('family_id', familyId)
    .lt('starts_at', toIso)
    .or(`ends_at.gte.${fromIso},and(ends_at.is.null,starts_at.gte.${fromIso})`)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...row,
    participants: (row.event_participants ?? []).map((p: any) => ({
      user_id: p.user_id,
      profile: p.profiles ?? null,
    })),
  }));
}

// An event "occupies" the day window [from, to) if it starts before `to`
// AND its (effective) end is at or after `from`.
export async function listEvents(familyId: string, fromIso: string, toIso: string): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('family_id', familyId)
    .lt('starts_at', toIso)
    .or(`ends_at.gte.${fromIso},and(ends_at.is.null,starts_at.gte.${fromIso})`)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createEvent(input: Omit<EventInsert, 'created_by'>): Promise<EventRow> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('events')
    .insert({ ...input, created_by: userData.user.id })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(id: string, patch: EventUpdate): Promise<EventRow> {
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}
