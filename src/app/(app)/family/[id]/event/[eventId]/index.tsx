import { format, parseISO } from 'date-fns';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AttachmentsSection } from '@/components/AttachmentsSection';
import { ParticipantsRow } from '@/components/ParticipantsRow';
import { Screen } from '@/components/Screen';
import type { EventRow } from '@/lib/database.types';
import { colorForEvent } from '@/lib/eventColor';
import { getEvent } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

export default function EventDetailScreen() {
  const { id, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const t = useThemeColors();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const e = await getEvent(eventId);
      setEvent(e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }
  if (!event) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.ink }]}>Event not found.</Text>
      </Screen>
    );
  }

  const dot = colorForEvent(event.id, t.name);

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: event.title }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }} />
        <Text style={[type.title1, { color: t.ink, flex: 1 }]}>{event.title}</Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: t.bgRaised, borderColor: t.border },
        ]}
      >
        <Row label="When">
          {event.all_day
            ? format(parseISO(event.starts_at), 'EEEE, MMM d') +
              (event.ends_at ? ` – ${format(parseISO(event.ends_at), 'EEEE, MMM d')}` : '')
            : format(parseISO(event.starts_at), 'EEE, MMM d · h:mm a') +
              (event.ends_at ? ` – ${format(parseISO(event.ends_at), 'h:mm a')}` : '')}
        </Row>
        {event.location ? <Row label="Where">{event.location}</Row> : null}
        {event.description ? <Row label="Notes">{event.description}</Row> : null}
      </View>

      <View style={{ marginTop: space.lg }}>
        <ParticipantsRow familyId={id!} eventId={event.id} />
      </View>

      <View style={{ marginTop: space.lg }}>
        <AttachmentsSection familyId={id!} eventId={event.id} />
      </View>
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useThemeColors();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      <Text style={[type.subhead, { color: t.fgLow }]}>{label}</Text>
      <Text style={[type.body, { color: t.ink, flexShrink: 1, textAlign: 'right' }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    gap: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
