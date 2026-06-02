import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { EventForm, type EventFormValues } from '@/components/EventForm';
import { Screen } from '@/components/Screen';
import { useCreateEventMutation } from '@/lib/mutations';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function NewEventScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const t = useThemeColors();
  const createEvent = useCreateEventMutation(id ?? '');

  const initial = useMemo<EventFormValues>(() => {
    const start = new Date();
    if (typeof date === 'string') {
      const [y, m, d] = date.split('-').map(Number);
      start.setFullYear(y, m - 1, d);
    }
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      title: '',
      description: '',
      location: '',
      starts_at: start,
      ends_at: end,
      all_day: false,
    };
  }, [date]);

  const valuesRef = useRef<EventFormValues>(initial);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    const v = valuesRef.current;
    if (!v.title.trim()) {
      setError('Please enter a title');
      return;
    }
    if (v.ends_at < v.starts_at) {
      setError('End must be after start');
      return;
    }
    setError(null);
    createEvent.mutate(
      {
        family_id: id!,
        title: v.title.trim(),
        description: v.description.trim() || null,
        location: v.location.trim() || null,
        starts_at: v.starts_at.toISOString(),
        ends_at: v.ends_at.toISOString(),
        all_day: v.all_day,
      },
      {
        onSuccess: () => router.back(),
        onError: (e: any) => setError(e.message ?? 'Failed to create event'),
      },
    );
  }

  return (
    <Screen scroll>
      <Text style={[type.title1, { color: t.ink }]}>New event</Text>
      <EventForm
        initial={initial}
        onChange={(v) => {
          valuesRef.current = v;
        }}
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
      <Button title="Create event" onPress={handleCreate} loading={createEvent.isPending} style={{ marginTop: space.md }} />
    </Screen>
  );
}
