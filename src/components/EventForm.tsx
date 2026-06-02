import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Input } from './Input';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

export type EventFormValues = {
  title: string;
  description: string;
  location: string;
  starts_at: Date;
  ends_at: Date;
  all_day: boolean;
};

type Props = {
  initial?: Partial<EventFormValues>;
  onChange: (v: EventFormValues) => void;
};

function defaultStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function plusOneHour(d: Date): Date {
  return new Date(d.getTime() + 60 * 60 * 1000);
}

export function EventForm({ initial, onChange }: Props) {
  const t = useThemeColors();
  const initialStart = initial?.starts_at ?? defaultStart();
  const [values, setValues] = useState<EventFormValues>({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    location: initial?.location ?? '',
    starts_at: initialStart,
    ends_at: initial?.ends_at ?? plusOneHour(initialStart),
    all_day: initial?.all_day ?? false,
  });
  const [picker, setPicker] = useState<null | { field: 'starts_at' | 'ends_at'; mode: 'date' | 'time' }>(null);

  function update<K extends keyof EventFormValues>(key: K, val: EventFormValues[K]) {
    let next = { ...values, [key]: val };
    if (key === 'starts_at' && next.ends_at < next.starts_at) {
      next.ends_at = plusOneHour(next.starts_at);
    }
    setValues(next);
    onChange(next);
  }

  function fieldRow(label: string, value: string, onPress: () => void, key: string) {
    return (
      <Pressable key={key} style={[styles.row, { borderBottomColor: t.border }]} onPress={onPress}>
        <Text style={[type.subhead, { color: t.fgLow }]}>{label}</Text>
        <Text style={[type.body, { color: t.ink }]}>{value}</Text>
      </Pressable>
    );
  }

  const activeDate =
    picker?.field === 'starts_at' ? values.starts_at : picker?.field === 'ends_at' ? values.ends_at : values.starts_at;

  return (
    <View style={{ gap: space.md }}>
      <Input label="Title" value={values.title} onChangeText={(v) => update('title', v)} placeholder="What's happening?" />
      <Input
        label="Location"
        value={values.location}
        onChangeText={(v) => update('location', v)}
        placeholder="Optional"
      />
      <Input
        label="Notes"
        value={values.description}
        onChangeText={(v) => update('description', v)}
        placeholder="Optional"
        multiline
        numberOfLines={4}
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <View style={[styles.card, { backgroundColor: t.bgRaised, borderColor: t.border }]}>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={[type.body, { color: t.ink }]}>All day</Text>
          <Switch
            value={values.all_day}
            onValueChange={(v) => update('all_day', v)}
            trackColor={{ true: t.accent, false: t.border }}
          />
        </View>

        {fieldRow(
          values.all_day ? 'Starts' : 'Starts date',
          format(values.starts_at, 'EEE, MMM d, yyyy'),
          () => setPicker({ field: 'starts_at', mode: 'date' }),
          'sd',
        )}
        {!values.all_day &&
          fieldRow(
            'Starts time',
            format(values.starts_at, 'h:mm a'),
            () => setPicker({ field: 'starts_at', mode: 'time' }),
            'st',
          )}
        {fieldRow(
          values.all_day ? 'Ends' : 'Ends date',
          format(values.ends_at, 'EEE, MMM d, yyyy'),
          () => setPicker({ field: 'ends_at', mode: 'date' }),
          'ed',
        )}
        {!values.all_day &&
          fieldRow(
            'Ends time',
            format(values.ends_at, 'h:mm a'),
            () => setPicker({ field: 'ends_at', mode: 'time' }),
            'et',
          )}
      </View>

      {picker ? (
        <DateTimePicker
          value={activeDate}
          mode={picker.mode}
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_event, date) => {
            if (Platform.OS !== 'ios') setPicker(null);
            if (!date) return;
            update(picker.field, date);
          }}
          themeVariant={t.name}
          accentColor={t.accent}
        />
      ) : null}
      {picker && Platform.OS === 'ios' ? (
        <Pressable onPress={() => setPicker(null)} style={styles.doneBtn}>
          <Text style={[type.callout, { color: t.accent }]}>Done</Text>
        </Pressable>
      ) : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  doneBtn: { alignSelf: 'flex-end', padding: space.sm },
});
