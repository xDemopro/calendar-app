import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ContextMenu } from './ContextMenu';
import { UserAvatar } from './UserAvatar';
import { useRemoveParticipantMutation } from '@/lib/mutations';
import { listEventParticipants, type ParticipantWithProfile } from '@/lib/queries';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export function ParticipantsRow({ familyId, eventId }: { familyId: string; eventId: string }) {
  const router = useRouter();
  const t = useThemeColors();
  const remove = useRemoveParticipantMutation(eventId);

  const { data: participants = [], isFetching: loading } = useQuery({
    queryKey: qk.participants(eventId),
    queryFn: () => listEventParticipants(eventId),
  });

  function actionsFor(p: ParticipantWithProfile) {
    return [
      {
        title: 'View profile',
        onPress: () =>
          router.push({ pathname: '/(app)/profile/[userId]', params: { userId: p.user_id } }),
      },
      {
        title: 'Remove from event',
        destructive: true,
        onPress: () =>
          remove.mutate(p.user_id, {
            onError: (e: any) => Alert.alert('Failed', e.message),
          }),
      },
    ];
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.title3, { color: t.ink }]}>Participants</Text>
        {loading ? <ActivityIndicator color={t.accent} /> : null}
      </View>

      <View style={styles.row}>
        {participants.map((p) => (
          <ContextMenu
            key={p.user_id}
            actions={actionsFor(p)}
            subtitle={p.profile?.display_name ?? 'Member'}
            onPress={() =>
              router.push({ pathname: '/(app)/profile/[userId]', params: { userId: p.user_id } })
            }
          >
            <UserAvatar profile={p.profile} size={48} />
          </ContextMenu>
        ))}
        <Pressable
          accessibilityLabel="Add participant"
          onPress={() =>
            router.push({
              pathname: '/(app)/family/[id]/event/[eventId]/add-participant',
              params: { id: familyId, eventId },
            })
          }
          style={({ pressed }) => [
            styles.addCircle,
            { borderColor: t.borderStr },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text
            style={{
              color: t.accent,
              fontSize: 22,
              fontWeight: '600',
              lineHeight: 24,
              includeFontPadding: false,
            }}
          >
            +
          </Text>
        </Pressable>
      </View>

      {participants.length === 0 && !loading ? (
        <Text style={[type.footnote, { color: t.fgLow }]}>
          No one added yet. Long-press an avatar for options.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  addCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
