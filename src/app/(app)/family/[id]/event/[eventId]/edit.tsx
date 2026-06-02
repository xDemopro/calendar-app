import { parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/Button';
import { EventForm, type EventFormValues } from '@/components/EventForm';
import { Screen } from '@/components/Screen';
import type { EventRow } from '@/lib/database.types';
import { getEvent, updateEvent } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function EditEventScreen() {
  const { eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const router = useRouter();
  const t = useThemeColors();

  const [event, setEvent] = useState<EventRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valuesRef = useRef<EventFormValues | null>(null);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      try {
        const e = await getEvent(eventId);
        setEvent(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  async function handleSave() {
    const v = valuesRef.current;
    if (!v || !event) return;
    if (!v.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateEvent(event.id, {
        title: v.title.trim(),
        description: v.description.trim() || null,
        location: v.location.trim() || null,
        starts_at: v.starts_at.toISOString(),
        ends_at: v.ends_at.toISOString(),
        all_day: v.all_day,
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !event) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

  const startDate = parseISO(event.starts_at);
  const initial: EventFormValues = {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    starts_at: startDate,
    ends_at: event.ends_at
      ? parseISO(event.ends_at)
      : new Date(startDate.getTime() + 60 * 60 * 1000),
    all_day: event.all_day,
  };
  valuesRef.current = initial;

  return (
    <Screen scroll>
      <Text style={[type.title1, { color: t.ink }]}>Edit event</Text>
      <EventForm
        initial={initial}
        onChange={(v) => {
          valuesRef.current = v;
        }}
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
      <Button title="Save" onPress={handleSave} loading={saving} style={{ marginTop: space.md }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
