import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import {
  addEventParticipant,
  listEventParticipants,
  listFamilyMembers,
  type FamilyMemberWithProfile,
  type ParticipantWithProfile,
} from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

export default function AddParticipantScreen() {
  const { id: familyId, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const router = useRouter();
  const t = useThemeColors();

  const [members, setMembers] = useState<FamilyMemberWithProfile[]>([]);
  const [participants, setParticipants] = useState<ParticipantWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    if (!familyId || !eventId) return;
    setLoading(true);
    try {
      const [m, p] = await Promise.all([
        listFamilyMembers(familyId),
        listEventParticipants(eventId),
      ]);
      setMembers(m);
      setParticipants(p);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, eventId]);

  const candidates = useMemo(() => {
    const taken = new Set(participants.map((p) => p.user_id));
    return members.filter((m) => !taken.has(m.user_id));
  }, [members, participants]);

  async function handleAdd(userId: string) {
    if (!eventId) return;
    setBusy(userId);
    try {
      await addEventParticipant(eventId, userId);
      await refresh();
    } catch (e: any) {
      Alert.alert('Failed', e.message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[type.title1, { color: t.ink }]}>Add participants</Text>
      <Text style={[type.body, { color: t.fgMed }]}>Pick from your family members.</Text>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {candidates.length === 0 ? (
          <Text style={[type.body, { color: t.fgLow }]}>
            Everyone in this family is already on the event.
          </Text>
        ) : (
          candidates.map((m) => (
            <Pressable
              key={m.user_id}
              onPress={() => handleAdd(m.user_id)}
              disabled={busy === m.user_id}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: t.bgRaised, borderColor: t.border },
                pressed && { opacity: 0.85 },
              ]}
            >
              <UserAvatar profile={m.profile} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[type.headline, { color: t.ink }]}>
                  {m.profile?.display_name ?? 'Unnamed'}
                </Text>
                <Text style={[type.caption, { color: t.fgLow }]}>{m.role}</Text>
              </View>
              {busy === m.user_id ? (
                <ActivityIndicator color={t.accent} />
              ) : (
                <Text style={[type.callout, { color: t.accent }]}>Add</Text>
              )}
            </Pressable>
          ))
        )}
      </View>

      <View style={{ marginTop: space.xl }}>
        <Pressable onPress={() => router.back()}>
          <Text style={[type.callout, { color: t.accent, textAlign: 'center' }]}>Done</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
