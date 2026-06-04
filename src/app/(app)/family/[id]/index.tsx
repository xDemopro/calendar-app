import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import type { GestureType } from 'react-native-gesture-handler';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CalendarList, type DateData } from 'react-native-calendars';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { BarMonthView } from '@/components/BarMonthView';
import { Button } from '@/components/Button';
import { ContextMenu, type ContextMenuAction } from '@/components/ContextMenu';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import { buildEventColorMap, colorForEvent } from '@/lib/eventColor';
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

  // Unique per-event color map. With the hash-only approach, 4 events have
  // a ~50% chance of two sharing a hue. This dedupes within the visible set.
  const colorMap = useMemo(() => buildEventColorMap(events), [events]);

  const marked = useMemo(() => {
    const dotsByDay = new Map<string, { key: string; color: string }[]>();
    for (const e of events) {
      const start = parseISO(e.starts_at);
      const end = effectiveEnd(e);
      for (const day of spannedDays(start, end)) {
        const arr = dotsByDay.get(day) ?? [];
        if (arr.length < MAX_DOTS_PER_DAY) {
          arr.push({ key: e.id, color: colorForEvent(e.id, t.name, colorMap) });
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
  }, [events, colorMap, selected, t.accent, t.name]);

  function filterDayEvents(ymd: string): EventWithParticipants[] {
    const [y, m, d] = ymd.split('-').map(Number);
    const selectedDay = startOfDay(new Date(y, m - 1, d));
    return events.filter((e) => {
      const startDay = startOfDay(parseISO(e.starts_at));
      const endDay = startOfDay(effectiveEnd(e));
      return selectedDay.getTime() >= startDay.getTime() && selectedDay.getTime() <= endDay.getTime();
    });
  }

  const dayEvents = useMemo(() => filterDayEvents(selected), [events, selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Adjacent days for the side-panel swipe effect.
  const prevSelected = useMemo(() => {
    const [y, m, d] = selected.split('-').map(Number);
    return format(new Date(y, m - 1, d - 1), 'yyyy-MM-dd');
  }, [selected]);
  const nextSelected = useMemo(() => {
    const [y, m, d] = selected.split('-').map(Number);
    return format(new Date(y, m - 1, d + 1), 'yyyy-MM-dd');
  }, [selected]);
  const prevDayEvents = useMemo(() => filterDayEvents(prevSelected), [events, prevSelected]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextDayEvents = useMemo(() => filterDayEvents(nextSelected), [events, nextSelected]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Refs let the PanResponder (created once below) read the latest selected
  // day/month instead of capturing stale values from the first render.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const monthRef = useRef(month);
  monthRef.current = month;

  // Day swipe — 3-panel pager. The Animated.View is 3 screens wide; we keep
  // its translateX at -screenWidth so the middle panel (the current day) is
  // visible. As the user drags, translateX = -screenWidth + dx, revealing
  // the prev/next panel. On commit, we animate the full slide, swap the
  // selected day in state, then reset translateX to -screenWidth (so the
  // new "current" day sits in the middle panel).
  const screenWidth = Dimensions.get('window').width;
  const dayTranslateX = useRef(new Animated.Value(-screenWidth)).current;
  const animatingRef = useRef(false);
  const pendingDirRef = useRef<1 | -1 | null>(null);

  function applyPendingSwap() {
    const dir = pendingDirRef.current;
    if (dir == null) return;
    const [y, m, d] = selectedRef.current.split('-').map(Number);
    const next = new Date(y, m - 1, d + dir);
    setSelected(format(next, 'yyyy-MM-dd'));
    const newMonth = format(next, 'yyyy-MM');
    if (newMonth !== monthRef.current) setMonth(newMonth);
    pendingDirRef.current = null;
  }

  function interruptDaySwipe() {
    dayTranslateX.stopAnimation();
    applyPendingSwap();
    dayTranslateX.setValue(-screenWidth);
    animatingRef.current = false;
  }

  function completeDaySwipe(dir: 1 | -1) {
    if (animatingRef.current) interruptDaySwipe();
    animatingRef.current = true;
    pendingDirRef.current = dir;
    Haptics.selectionAsync().catch(() => {});
    const target = -screenWidth + (dir === 1 ? -screenWidth : screenWidth);
    Animated.timing(dayTranslateX, {
      toValue: target,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      applyPendingSwap();
      // After state swap, the new "current day" content renders in the
      // middle panel. Reset translateX to base so it's visible.
      dayTranslateX.setValue(-screenWidth);
      animatingRef.current = false;
    });
  }

  function cancelDaySwipe() {
    Animated.spring(dayTranslateX, {
      toValue: -screenWidth,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }

  function shiftMonth(dir: 1 | -1): Date {
    const [y, m] = monthRef.current.split('-').map(Number);
    const next = new Date(y, m - 1 + dir, 1);
    setMonth(format(next, 'yyyy-MM'));
    // Shift the selected day to the same day-of-month in the new month
    // (clamped to the new month's length) so the day list stays meaningful.
    const [, , d] = selectedRef.current.split('-').map(Number);
    const lastDayOfNewMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    const day = Math.min(d, lastDayOfNewMonth);
    setSelected(format(new Date(next.getFullYear(), next.getMonth(), day), 'yyyy-MM-dd'));
    Haptics.selectionAsync().catch(() => {});
    return next;
  }

  // Day-swipe responder: interactive horizontal drag.
  // Native gesture for the outer ScrollView. Our Pan gestures declare
  // simultaneousWithExternalGesture(scrollGesture) so they don't block
  // vertical pan / pull-to-refresh — they only claim on horizontal motion.
  const scrollGesture = useMemo<GestureType>(() => Gesture.Native(), []);

  // Month-swipe via react-native-gesture-handler. RNGH runs at the native
  // gesture level (not JS responder) so it can actually compete with the
  // CalendarList's internal UIScrollView. activeOffsetX activates the
  // gesture at 5px horizontal; the Pan stays passive in BEGAN for vertical
  // motion AND is marked simultaneous with the parent ScrollView's Native
  // gesture, so pull-to-refresh fires from anywhere.
  const calendarRef = useRef<{ scrollToMonth?: (date: Date) => void } | null>(null);
  // Slide animation for the calendar block. Same pattern as the day swipe.
  const calendarTranslateX = useRef(new Animated.Value(0)).current;
  const calendarAnimatingRef = useRef(false);
  const calendarPendingDirRef = useRef<1 | -1 | null>(null);

  function applyPendingCalendarSwap() {
    const dir = calendarPendingDirRef.current;
    if (dir == null) return;
    const next = shiftMonth(dir);
    calendarRef.current?.scrollToMonth?.(next);
    calendarPendingDirRef.current = null;
  }

  function interruptCalendarSwipe() {
    calendarTranslateX.stopAnimation();
    applyPendingCalendarSwap();
    calendarTranslateX.setValue(0);
    calendarAnimatingRef.current = false;
  }

  function completeCalendarSwipe(dir: 1 | -1) {
    if (calendarAnimatingRef.current) interruptCalendarSwipe();
    calendarAnimatingRef.current = true;
    calendarPendingDirRef.current = dir;
    Haptics.selectionAsync().catch(() => {});
    const slideTo = -dir * screenWidth;
    Animated.timing(calendarTranslateX, {
      toValue: slideTo,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      applyPendingCalendarSwap();
      calendarTranslateX.setValue(dir * screenWidth);
      Animated.timing(calendarTranslateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: f2 }) => {
        if (f2) calendarAnimatingRef.current = false;
      });
    });
  }

  function cancelCalendarSwipe() {
    Animated.spring(calendarTranslateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }

  const calendarSwipeGesture = Gesture.Pan()
    // Higher activation threshold + larger release thresholds so an
    // accidental sideways drift during a vertical pull doesn't change the
    // month. A deliberate swipe still triggers reliably.
    .activeOffsetX([-18, 18])
    .simultaneousWithExternalGesture(scrollGesture)
    .runOnJS(true)
    .onStart(() => {
      if (calendarAnimatingRef.current) interruptCalendarSwipe();
    })
    .onUpdate((e) => {
      const max = screenWidth * 0.55;
      let v = e.translationX;
      if (v > max) v = max + (v - max) * 0.35;
      else if (v < -max) v = -max + (v + max) * 0.35;
      calendarTranslateX.setValue(v);
    })
    .onEnd((e) => {
      const enoughDistance = Math.abs(e.translationX) > 60;
      const enoughVelocity = Math.abs(e.velocityX) > 450;
      if (!enoughDistance && !enoughVelocity) {
        cancelCalendarSwipe();
        return;
      }
      completeCalendarSwipe(e.translationX < 0 ? 1 : -1);
    })
    .onFinalize((_, success) => {
      if (!success) cancelCalendarSwipe();
    });

  // Day-swipe via RNGH — live drag follows the finger, releases either
  // complete or spring back. Interrupt-and-commit handles spam-swipes.
  const daySwipeGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .simultaneousWithExternalGesture(scrollGesture)
    .runOnJS(true)
    .onStart(() => {
      if (animatingRef.current) interruptDaySwipe();
    })
    .onUpdate((e) => {
      // 3-panel pager: keep translateX around -screenWidth so the middle
      // panel (current day) is visible, with the side panels (prev/next
      // day) flanking. The drag reveals them naturally.
      dayTranslateX.setValue(-screenWidth + e.translationX);
    })
    .onEnd((e) => {
      const enoughDistance = Math.abs(e.translationX) > screenWidth * 0.14;
      const enoughVelocity = Math.abs(e.velocityX) > 350;
      if (!enoughDistance && !enoughVelocity) {
        cancelDaySwipe();
        return;
      }
      completeDaySwipe(e.translationX < 0 ? 1 : -1);
    })
    .onFinalize((e, success) => {
      if (!success) cancelDaySwipe();
    });

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
        <GestureDetector gesture={scrollGesture}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={t.accent}
              colors={[t.accent]}
              progressViewOffset={8}
            />
          }
          alwaysBounceVertical
          bounces
        >
          {/* Header row: prev arrow ← [Month Year ↻] → next arrow.
              Calendar's own internal header is fully suppressed below. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: space.lg,
              paddingTop: space.md,
              paddingBottom: space.xs,
            }}
          >
            <Pressable
              onPress={() => {
                const next = shiftMonth(-1);
                calendarRef.current?.scrollToMonth?.(next);
              }}
              hitSlop={14}
              accessibilityLabel="Previous month"
              style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
            >
              <Feather name="chevron-left" size={26} color={t.accent} />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[type.title1, { color: t.ink }]}>
                {format(parseISO(`${month}-01`), 'MMMM yyyy')}
              </Text>
              <Pressable
                onPress={handleRefresh}
                hitSlop={12}
                accessibilityLabel="Refresh"
                disabled={refreshing}
                style={({ pressed }) => ({ opacity: pressed || refreshing ? 0.4 : 1, padding: 4 })}
              >
                {refreshing ? (
                  <ActivityIndicator color={t.accent} size="small" />
                ) : (
                  <Feather name="refresh-cw" size={20} color={t.accent} />
                )}
              </Pressable>
            </View>

            <Pressable
              onPress={() => {
                const next = shiftMonth(1);
                calendarRef.current?.scrollToMonth?.(next);
              }}
              hitSlop={14}
              accessibilityLabel="Next month"
              style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
            >
              <Feather name="chevron-right" size={26} color={t.accent} />
            </Pressable>
          </View>

        <GestureDetector gesture={calendarSwipeGesture}>
          <Animated.View
            style={{ height: 380, transform: [{ translateX: calendarTranslateX }] }}
            collapsable={false}
          >
            <CalendarList
              ref={calendarRef}
              current={`${month}-01`}
              markingType="multi-dot"
              markedDates={marked as any}
              horizontal
              pagingEnabled
              scrollEnabled={false}
              showScrollIndicator={false}
            pastScrollRange={24}
            futureScrollRange={24}
            hideArrows
            firstDay={1}
            // Render an empty header but with a tiny non-zero height. Some
            // CalendarList versions misposition the day rows when the
            // header is 0px, cutting off the first week.
            renderHeader={() => <View style={{ height: 4 }} />}
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
          </Animated.View>
        </GestureDetector>

        <GestureDetector gesture={daySwipeGesture}>
          <View style={{ flex: 1, overflow: 'hidden' }} collapsable={false}>
            <Animated.View
              collapsable={false}
              style={{
                flexDirection: 'row',
                width: screenWidth * 3,
                height: '100%',
                transform: [{ translateX: dayTranslateX }],
              }}
            >
              {[prevSelected, selected, nextSelected].map((dateYmd, idx) => {
                const eventsForDay =
                  idx === 0 ? prevDayEvents : idx === 1 ? dayEvents : nextDayEvents;
                const isActive = idx === 1;
                return (
                  <View
                    key={`${dateYmd}-${idx}`}
                    style={{ width: screenWidth }}
                    pointerEvents={isActive ? 'auto' : 'none'}
                  >
                    <View style={styles.dayHeader}>
                      <Text style={[type.title3, { color: t.ink }]} numberOfLines={1}>
                        {format(parseISO(dateYmd), 'EEEE, MMMM d')}
                      </Text>
                      {loading && !refreshing && isActive ? <ActivityIndicator color={t.accent} /> : (
                        <Text style={[type.footnote, { color: t.fgLow }]}>
                          {eventsForDay.length} {eventsForDay.length === 1 ? 'event' : 'events'}
                        </Text>
                      )}
                    </View>

                    <View
                      style={{
                        paddingHorizontal: space.lg,
                        gap: space.sm,
                        flexGrow: 1,
                      }}
                    >
                      {eventsForDay.length === 0 ? (
                        <Text style={[type.body, { color: t.fgLow, textAlign: 'center', marginTop: space.lg }]}>
                          No events on this day.
                        </Text>
                      ) : (
                        eventsForDay.map((e) => {
                          const dotColor = colorForEvent(e.id, t.name, colorMap);
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
                    </View>
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>
        </ScrollView>
        </GestureDetector>

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
