import { useQuery } from '@tanstack/react-query';
import { parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/Button';
import { EventForm, type EventFormValues } from '@/components/EventForm';
import { Screen } from '@/components/Screen';
import { useUpdateEventMutation } from '@/lib/mutations';
import { getEvent } from '@/lib/queries';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function EditEventScreen() {
  const { id: familyId, eventId } = useLocalSearchParams<{ id: string; eventId: string }>();
  const router = useRouter();
  const t = useThemeColors();
  const updateEvent = useUpdateEventMutation(familyId ?? '');

  const { data: event, isLoading: loading } = useQuery({
    queryKey: qk.event(eventId ?? ''),
    queryFn: () => getEvent(eventId!),
    enabled: !!eventId,
  });

  const [error, setError] = useState<string | null>(null);
  const valuesRef = useRef<EventFormValues | null>(null);

  async function handleSave() {
    const v = valuesRef.current;
    if (!v || !event) return;
    if (!v.title.trim()) {
      setError('Title is required');
      return;
    }
    setError(null);
    updateEvent.mutate(
      {
        id: event.id,
        patch: {
          title: v.title.trim(),
          description: v.description.trim() || null,
          location: v.location.trim() || null,
          starts_at: v.starts_at.toISOString(),
          ends_at: v.ends_at.toISOString(),
          all_day: v.all_day,
        },
      },
      {
        onSuccess: () => router.back(),
        onError: (e: any) => setError(e.message ?? 'Failed to save'),
      },
    );
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
      <Button title="Save" onPress={handleSave} loading={updateEvent.isPending} style={{ marginTop: space.md }} />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
