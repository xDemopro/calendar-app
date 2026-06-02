import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import { useUser } from '@/lib/auth';
import type { Family } from '@/lib/database.types';
import {
  clearFamilyAvatar,
  getFamily,
  kickMember,
  listFamilyMembers,
  pickAndUploadFamilyAvatar,
  renameFamily,
  type FamilyMemberWithProfile,
} from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

export default function EditFamilyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useUser();
  const t = useThemeColors();

  const [family, setFamily] = useState<Family | null>(null);
  const [members, setMembers] = useState<FamilyMemberWithProfile[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [fam, mems] = await Promise.all([getFamily(id), listFamilyMembers(id)]);
      setFamily(fam);
      setMembers(mems);
      setName(fam?.name ?? '');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isOwner = !!family && !!user && family.created_by === user.id;

  async function handleSaveName() {
    if (!family) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Name cannot be empty');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await renameFamily(family.id, trimmed);
      setFamily(updated);
    } catch (e: any) {
      setError(e.message ?? 'Failed to rename');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangeAvatar() {
    if (!family) return;
    setAvatarBusy(true);
    try {
      const updated = await pickAndUploadFamilyAvatar(family.id);
      setFamily(updated);
    } catch (e: any) {
      if (e.message !== 'cancelled') Alert.alert('Could not update photo', e.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function handleAvatarPress() {
    if (!family) return;
    const buttons: { text: string; style?: 'destructive' | 'cancel' | 'default'; onPress?: () => void }[] = [
      { text: family.avatar_path ? 'Change photo' : 'Pick photo', onPress: handleChangeAvatar },
    ];
    if (family.avatar_path) {
      buttons.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true);
          try {
            const updated = await clearFamilyAvatar(family.id);
            setFamily(updated);
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          } finally {
            setAvatarBusy(false);
          }
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Family photo', undefined, buttons);
  }

  function handleKick(member: FamilyMemberWithProfile) {
    if (!family || !user) return;
    Alert.alert(
      `Remove ${member.profile?.display_name ?? 'member'}?`,
      'They will lose access to this family immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await kickMember(family.id, member.user_id);
              await load();
            } catch (e: any) {
              Alert.alert('Failed', e.message);
            }
          },
        },
      ],
    );
  }

  if (loading || !family) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

  if (!isOwner) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.ink }]}>Only the owner can edit this family.</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.md }}>
        <Pressable onPress={handleAvatarPress} hitSlop={10} style={styles.avatarWrapper}>
          <FamilyAvatar family={family} size={104} />
          {avatarBusy ? (
            <View style={[styles.avatarOverlay, { borderRadius: 52 }]}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </Pressable>
        <Text style={[type.footnote, { color: t.fgLow }]}>Tap photo to change</Text>
      </View>

      <View style={{ gap: space.md, marginTop: space.lg }}>
        <Text style={[type.title3, { color: t.ink }]}>Name</Text>
        <Input value={name} onChangeText={setName} />
        {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
        <Button title="Save name" onPress={handleSaveName} loading={saving} />
      </View>

      <View style={{ gap: space.md, marginTop: space.xxl }}>
        <Text style={[type.title3, { color: t.ink }]}>Members ({members.length})</Text>
        {members.map((m) => {
          const self = m.user_id === user!.id;
          return (
            <View
              key={m.user_id}
              style={[styles.row, { backgroundColor: t.bgRaised, borderColor: t.border }]}
            >
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(app)/profile/[userId]',
                    params: { userId: m.user_id },
                  })
                }
                hitSlop={6}
              >
                <UserAvatar profile={m.profile} size={44} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[type.headline, { color: t.ink }]}>
                  {m.profile?.display_name ?? 'Unknown'}
                  {self ? ' (you)' : ''}
                </Text>
                <Text style={[type.caption, { color: t.fgLow }]}>{m.role}</Text>
              </View>
              {!self && m.role !== 'owner' ? (
                <Button title="Remove" variant="danger" onPress={() => handleKick(m)} />
              ) : null}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: space.md,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
