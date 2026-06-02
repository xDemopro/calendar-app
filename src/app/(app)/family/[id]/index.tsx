import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfDay } from 'date-fns';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarList, type DateData } from 'react-native-calendars';

import { BarMonthView } from '@/components/BarMonthView';
import { Button } from '@/components/Button';
import { ContextMenu, type ContextMenuAction } from '@/components/ContextMenu';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import { colorForEvent } from '@/lib/eventColor';
import { useDeleteEventMutation } from '@/lib/mutations';
import {
  getFamily,
  listEventsWithParticipants,
  type EventWithParticipants,
} from '@/lib/queries';
import { qk, qkMatch } from '@/lib/queryKeys';
import { useFamilyRealtime } from '@/lib/realtime';
import { useCalendarViewMode } from '@/lib/viewMode';
import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT, radius, space, type } from '@/theme/tokens';

const MAX_DOTS_PER_DAY = 4;

function monthBounds(yyyymm: string): { from: string; to: string } {
  const [y, m] = yyyymm.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const next = new Date(y, m, 1);
  return { from: first.toISOString(), to: next.toISOString() };
}

function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function* spannedDays(start: Date, end: Date) {
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const stop = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d.getTime() <= stop.getTime()) {
    yield format(d, 'yyyy-MM-dd');
    d.setDate(d.getDate() + 1);
  }
}

function effectiveEnd(e: EventWithParticipants): Date {
  return e.ends_at ? parseISO(e.ends_at) : parseISO(e.starts_at);
}

export default function FamilyCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useThemeColors();
  const { mode: viewMode, setMode: setViewMode } = useCalendarViewMode();

  const [month, setMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [referenceMonth] = useState<Date>(new Date());
  const [selected, setSelected] = useState<string>(todayKey());
  const [refreshing, setRefreshing] = useState(false);

  const qc = useQueryClient();
  useFamilyRealtime(id);

  async function handleRefresh() {
    if (!id) return;
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.family(id) }),
        qc.invalidateQueries(qkMatch.anyEventsForFamily(id)),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const { data: family } = useQuery({
    queryKey: qk.family(id ?? ''),
    queryFn: () => getFamily(id!),
    enabled: !!id,
  });

  const { from, to } = monthBounds(month);
  const { data: events = [], isFetching: loading } = useQuery({
    queryKey: qk.eventsWithParticipants(id ?? '', from, to),
    queryFn: () => listEventsWithParticipants(id!, from, to),
    enabled: !!id,
  });

  const deleteEventMut = useDeleteEventMutation(id ?? '');

  const marked = useMemo(() => {
    const dotsByDay = new Map<string, { key: string; color: string }[]>();
    for (const e of events) {
      const start = parseISO(e.starts_at);
      const end = effectiveEnd(e);
      for (const day of spannedDays(start, end)) {
        const arr = dotsByDay.get(day) ?? [];
        if (arr.length < MAX_DOTS_PER_DAY) {
          arr.push({ key: e.id, color: colorForEvent(e.id, t.name) });
        }
        dotsByDay.set(day, arr);
      }
    }
    const acc: Record<
      string,
      { dots?: { key: string; color: string }[]; selected?: boolean; selectedColor?: string }
    > = {};
    for (const [day, dots] of dotsByDay.entries()) {
      acc[day] = { dots };
    }
    acc[selected] = {
      ...(acc[selected] ?? {}),
      selected: true,
      selectedColor: t.accent,
    };
    return acc;
  }, [events, selected, t.accent, t.name]);

  const dayEvents = useMemo(() => {
    if (!selected) return [];
    const [y, m, d] = selected.split('-').map(Number);
    const selectedDay = startOfDay(new Date(y, m - 1, d));
    return events.filter((e) => {
      const startDay = startOfDay(parseISO(e.starts_at));
      const endDay = startOfDay(effectiveEnd(e));
      return selectedDay.getTime() >= startDay.getTime() && selectedDay.getTime() <= endDay.getTime();
    });
  }, [events, selected]);

  function dayLabel(e: EventWithParticipants): string {
    const start = parseISO(e.starts_at);
    const end = effectiveEnd(e);
    const startDay = startOfDay(start);
    const endDay = startOfDay(end);
    const isMultiDay = startDay.getTime() !== endDay.getTime();
    if (e.all_day) {
      return isMultiDay
        ? `All day · ${format(start, 'MMM d')} → ${format(end, 'MMM d')}`
        : 'All day';
    }
    if (!isMultiDay) {
      return `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
    }
    return `${format(start, 'MMM d, h:mm a')} → ${format(end, 'MMM d, h:mm a')}`;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: family?.name ?? 'Calendar',
          headerBackTitle: 'Families',
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.accent,
          headerShadowVisible: false,
          headerTitle: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {family ? <FamilyAvatar family={family} size={28} /> : null}
              <View>
                <Text
                  numberOfLines={1}
                  style={[type.headline, { color: t.ink, maxWidth: 200 }]}
                >
                  {family?.name ?? 'Calendar'}
                </Text>
              </View>
            </View>
          ),
          headerRight: () => <ViewPill mode={viewMode} onChange={setViewMode} />,
        }}
      />
      <Screen padded={false} edges={['bottom']}>
        {viewMode === 'bars' ? (
          <>
            <BarMonthView
              familyId={id!}
              referenceMonth={referenceMonth}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
            <View style={styles.fabContainer}>
              <Button
                title="+  Add event"
                onPress={() =>
                  router.push({
                    pathname: '/(app)/family/[id]/event/new',
                    params: { id: id!, date: selected },
                  })
                }
              />
            </View>
          </>
        ) : (
          <DotsView />
        )}
      </Screen>
    </>
  );

  function DotsView() {
    return (
      <>
        <View style={{ height: 360 }}>
          <CalendarList
            current={`${month}-01`}
            markingType="multi-dot"
            markedDates={marked as any}
            horizontal
            pagingEnabled
            scrollEnabled
            showScrollIndicator={false}
            pastScrollRange={24}
            futureScrollRange={24}
            staticHeader
            firstDay={1}
            onVisibleMonthsChange={(months) => {
              if (months.length > 0) {
                const visible = months[Math.floor(months.length / 2)] ?? months[0];
                setMonth(visible.dateString.slice(0, 7));
              }
            }}
            onDayPress={(d: DateData) => setSelected(d.dateString)}
            theme={{
              backgroundColor: t.bg,
              calendarBackground: t.bg,
              textSectionTitleColor: t.fgLow,
              monthTextColor: t.ink,
              dayTextColor: t.ink,
              todayTextColor: t.today,
              arrowColor: t.accent,
              selectedDayTextColor: t.onAccent,
              selectedDayBackgroundColor: t.accent,
              textDisabledColor: t.fgLow,
              textMonthFontFamily: FONT_FAMILY_BY_WEIGHT['800'],
              textDayHeaderFontFamily: FONT_FAMILY_BY_WEIGHT['600'],
              textDayFontFamily: FONT_FAMILY_BY_WEIGHT['600'],
              textMonthFontSize: 22,
              textDayFontSize: 16,
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        <View style={styles.dayHeader}>
          <Text style={[type.title3, { color: t.ink }]}>
            {format(parseISO(selected), 'EEEE, MMMM d')}
          </Text>
          {loading ? <ActivityIndicator color={t.accent} /> : (
            <Text style={[type.footnote, { color: t.fgLow }]}>
              {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
            </Text>
          )}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96, gap: space.sm }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
            />
          }
        >
          {dayEvents.length === 0 ? (
            <Text style={[type.body, { color: t.fgLow, textAlign: 'center', marginTop: space.lg }]}>
              No events on this day.
            </Text>
          ) : (
            dayEvents.map((e) => {
              const dotColor = colorForEvent(e.id, t.name);
              const actions: ContextMenuAction[] = [
                {
                  title: 'Edit',
                  onPress: () =>
                    router.push({
                      pathname: '/(app)/family/[id]/event/[eventId]/edit',
                      params: { id: id!, eventId: e.id },
                    }),
                },
                {
                  title: 'Delete',
                  destructive: true,
                  onPress: () =>
                    Alert.alert('Delete event?', 'This cannot be undone.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          deleteEventMut.mutate(e.id, {
                            onError: (err: any) => Alert.alert('Failed', err.message),
                          });
                        },
                      },
                    ]),
                },
              ];
              return (
                <ContextMenu
                  key={e.id}
                  actions={actions}
                  subtitle={e.title}
                  onPress={() =>
                    router.push({
                      pathname: '/(app)/family/[id]/event/[eventId]',
                      params: { id: id!, eventId: e.id },
                    })
                  }
                >
                  <View style={[styles.eventCard, { backgroundColor: t.bgRaised, borderColor: t.border, borderLeftColor: dotColor }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.headline, { color: t.ink }]}>{e.title}</Text>
                      <Text style={[type.footnote, { color: t.fgMed }]}>{dayLabel(e)}</Text>
                      {e.location ? <Text style={[type.caption, { color: t.fgLow }]}>{e.location}</Text> : null}
                    </View>
                    <ParticipantStack participants={e.participants} />
                  </View>
                </ContextMenu>
              );
            })
          )}
        </ScrollView>

        <View style={styles.fabContainer}>
          <Button
            title="+  Add event"
            onPress={() =>
              router.push({
                pathname: '/(app)/family/[id]/event/new',
                params: { id: id!, date: selected },
              })
            }
          />
        </View>
      </>
    );
  }
}

function ParticipantStack({ participants }: { participants: EventWithParticipants['participants'] }) {
  const t = useThemeColors();
  if (!participants?.length) return null;
  const visible = participants.slice(0, 3);
  const extra = participants.length - visible.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {visible.map((p, i) => (
        <View key={p.user_id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <UserAvatar profile={p.profile} size={22} />
        </View>
      ))}
      {extra > 0 ? (
        <Text style={[type.caption, { color: t.fgMed, marginLeft: 4 }]}>+{extra}</Text>
      ) : null}
    </View>
  );
}

function ViewPill({ mode, onChange }: { mode: 'dots' | 'bars'; onChange: (m: 'dots' | 'bars') => void }) {
  const t = useThemeColors();
  const isBars = mode === 'bars';
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.bgRaised,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: t.border,
        padding: 2,
      }}
    >
      <Pressable
        onPress={() => onChange('bars')}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: isBars ? t.accent : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: FONT_FAMILY_BY_WEIGHT['700'],
            fontSize: 12,
            color: isBars ? t.onAccent : t.fgMed,
          }}
        >
          Bars
        </Text>
      </Pressable>
      <Pressable
        onPress={() => onChange('dots')}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.pill,
          backgroundColor: !isBars ? t.accent : 'transparent',
        }}
      >
        <Text
          style={{
            fontFamily: FONT_FAMILY_BY_WEIGHT['700'],
            fontSize: 12,
            color: !isBars ? t.onAccent : t.fgMed,
          }}
        >
          Dots
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  eventCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  fabContainer: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    bottom: space.lg,
  },
});
