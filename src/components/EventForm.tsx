import DateTimePicker from '@react-native-community/datetimepicker';
import { format, startOfDay } from 'date-fns';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { Input } from './Input';
import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT, radius, space, type } from '@/theme/tokens';

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
    const next = { ...values, [key]: val };
    // No auto-adjust: changing the start date used to also bump the end,
    // which surprised users picking a range. Form's submit handler still
    // validates that end >= start.
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

      {picker?.mode === 'date' ? (
        <DateRangePickerCalendar
          activeDate={activeDate}
          startDate={values.starts_at}
          endDate={values.ends_at}
          onPick={(picked) => {
            // Preserve the time-of-day from the field being edited.
            const target = new Date(activeDate);
            target.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
            update(picker.field, target);
          }}
        />
      ) : picker?.mode === 'time' ? (
        <DateTimePicker
          value={activeDate}
          mode="time"
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
      {picker ? (
        <Pressable onPress={() => setPicker(null)} style={styles.doneBtn}>
          <Text style={[type.callout, { color: t.accent }]}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function DateRangePickerCalendar({
  activeDate,
  startDate,
  endDate,
  onPick,
}: {
  activeDate: Date;
  startDate: Date;
  endDate: Date;
  onPick: (date: Date) => void;
}) {
  const t = useThemeColors();

  // Build period marking from startDate to endDate so the user sees a bar
  // across the picked range. The endpoint they're editing (activeDate) keeps
  // the same color but the startingDay/endingDay flags handle the rounded
  // caps. If end < start, fall back to a single-day marker on whichever the
  // user is editing.
  const markedDates = useMemo(() => {
    const out: Record<string, any> = {};
    const startDay = startOfDay(startDate);
    const endDay = startOfDay(endDate);
    if (endDay.getTime() < startDay.getTime()) {
      // Invalid range — just mark the activeDate as a single-day selection.
      const key = format(activeDate, 'yyyy-MM-dd');
      out[key] = {
        startingDay: true,
        endingDay: true,
        color: t.accent,
        textColor: t.onAccent,
      };
      return out;
    }
    const cursor = new Date(startDay);
    while (cursor.getTime() <= endDay.getTime()) {
      const key = format(cursor, 'yyyy-MM-dd');
      out[key] = {
        color: t.accent,
        textColor: t.onAccent,
        startingDay: cursor.getTime() === startDay.getTime(),
        endingDay: cursor.getTime() === endDay.getTime(),
      };
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [startDate, endDate, activeDate, t.accent, t.onAccent]);

  return (
    <Calendar
      current={format(activeDate, 'yyyy-MM-dd')}
      markingType="period"
      markedDates={markedDates}
      onDayPress={(d: DateData) => {
        const [y, m, day] = d.dateString.split('-').map(Number);
        onPick(new Date(y, m - 1, day));
      }}
      firstDay={1}
      theme={{
        backgroundColor: t.bg,
        calendarBackground: t.bg,
        textSectionTitleColor: t.fgLow,
        monthTextColor: t.ink,
        dayTextColor: t.ink,
        todayTextColor: t.today,
        arrowColor: t.accent,
        textDisabledColor: t.fgLow,
        textMonthFontFamily: FONT_FAMILY_BY_WEIGHT['700'],
        textDayHeaderFontFamily: FONT_FAMILY_BY_WEIGHT['600'],
        textDayFontFamily: FONT_FAMILY_BY_WEIGHT['600'],
        textMonthFontSize: 17,
        textDayFontSize: 15,
        textDayHeaderFontSize: 12,
      }}
    />
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
