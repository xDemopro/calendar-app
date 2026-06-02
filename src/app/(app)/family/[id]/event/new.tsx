import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { EventForm, type EventFormValues } from '@/components/EventForm';
import { Screen } from '@/components/Screen';
import { createEvent } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function NewEventScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const router = useRouter();
  const t = useThemeColors();

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
  const [loading, setLoading] = useState(false);
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
    setLoading(true);
    setError(null);
    try {
      await createEvent({
        family_id: id!,
        title: v.title.trim(),
        description: v.description.trim() || null,
        location: v.location.trim() || null,
        starts_at: v.starts_at.toISOString(),
        ends_at: v.ends_at.toISOString(),
        all_day: v.all_day,
      });
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create event');
    } finally {
      setLoading(false);
    }
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
      <Button title="Create event" onPress={handleCreate} loading={loading} style={{ marginTop: space.md }} />
    </Screen>
  );
}
