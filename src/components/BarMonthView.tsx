import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, isSameDay, isSameMonth, parseISO, startOfDay } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';

import { UserAvatar } from './UserAvatar';
import { barBgForEvent, buildEventColorMap, colorForEvent } from '@/lib/eventColor';
import { listEventsWithParticipants, type EventWithParticipants } from '@/lib/queries';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT, radius, space, type } from '@/theme/tokens';
import type { EventColor } from '@/theme/tokens';

const SCREEN = Dimensions.get('window');

const LANE_HEIGHT = 26;
const LANE_GAP = 3;
// Day-number row height (24px cell + ~2px breathing room before bars).
const DAYNUMS_HEIGHT = 26;
// Padding under the last bar so it doesn't kiss the week divider.
const BARS_BOTTOM_PAD = 6;
const BAR_RADIUS = radius.sm;

// ---------- Date helpers (Monday-start week) ----------

function dayOfWeekMondayStart(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function monthGridStart(month: Date): Date {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  return startOfDay(addDays(first, -dayOfWeekMondayStart(first)));
}

function effectiveEnd(e: EventWithParticipants): Date {
  return e.ends_at ? parseISO(e.ends_at) : parseISO(e.starts_at);
}

// ---------- Lane packing ----------

type WeekBar = {
  event: EventWithParticipants;
  startCol: number;
  endCol: number;
  lane: number;
  isFirstSegment: boolean;
};

function packWeek(events: EventWithParticipants[], weekStart: Date): {
  bars: WeekBar[];
  lanesUsed: number;
} {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 7);
  const overlapping = events.filter((e) => {
    const start = parseISO(e.starts_at);
    const end = effectiveEnd(e);
    return start < weekEnd && end >= weekStart;
  });
  overlapping.sort((a, b) => {
    const sa = parseISO(a.starts_at).getTime();
    const sb = parseISO(b.starts_at).getTime();
    if (sa !== sb) return sa - sb;
    const da = effectiveEnd(a).getTime() - sa;
    const db = effectiveEnd(b).getTime() - sb;
    return db - da;
  });

  // Lanes grow as needed — no hard cap. The week row's height adapts so the
  // parent ScrollView can scroll if a week ends up taller than the viewport.
  const laneOccupiedThrough: number[] = [];
  const bars: WeekBar[] = [];

  for (const event of overlapping) {
    const start = startOfDay(parseISO(event.starts_at));
    const end = startOfDay(effectiveEnd(event));
    let startCol = 0;
    while (startCol < 7 && weekDays[startCol] < start) startCol++;
    let endCol = 6;
    while (endCol >= 0 && weekDays[endCol] > end) endCol--;
    if (startCol > endCol) continue;
    const eventStartsThisWeek = start >= weekStart && start < weekEnd;

    let lane = laneOccupiedThrough.findIndex((occ) => occ < startCol);
    if (lane === -1) {
      lane = laneOccupiedThrough.length;
      laneOccupiedThrough.push(endCol);
    } else {
      laneOccupiedThrough[lane] = endCol;
    }
    bars.push({ event, startCol, endCol, lane, isFirstSegment: eventStartsThisWeek });
  }

  return { bars, lanesUsed: laneOccupiedThrough.length };
}

// ---------- Components ----------

export function BarMonthView({
  familyId,
  month,
  onMonthChange,
  refreshing,
  onRefresh,
  onPickMonthYear,
}: {
  familyId: string;
  // Controlled by parent so this view stays in sync with the dots view.
  month: Date;
  onMonthChange: (month: Date) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  onPickMonthYear?: () => void;
}) {
  const t = useThemeColors();
  const screenWidth = SCREEN.width;
  // Native gesture for the inner MonthPage's ScrollView. Our Pan claims
  // simultaneousWithExternalGesture(scrollGesture) so it doesn't block
  // vertical pulls / pull-to-refresh.
  const scrollGesture = useMemo<GestureType>(() => Gesture.Native(), []);
  // Keep the latest month accessible in animation callbacks (which capture
  // the value at the time of binding) without forcing useMemo recompute.
  const monthRef = useRef(month);
  monthRef.current = month;

  // RNGH-driven horizontal swipe with animated translate, same pattern as
  // the dots calendar's month swipe.
  const translateX = useRef(new Animated.Value(0)).current;
  const animatingRef = useRef(false);
  const pendingDirRef = useRef<1 | -1 | null>(null);

  function applyPending() {
    const dir = pendingDirRef.current;
    if (dir == null) return;
    onMonthChange(addMonths(monthRef.current, dir));
    pendingDirRef.current = null;
  }

  function interrupt() {
    translateX.stopAnimation();
    applyPending();
    translateX.setValue(0);
    animatingRef.current = false;
  }

  function complete(dir: 1 | -1) {
    if (animatingRef.current) interrupt();
    animatingRef.current = true;
    pendingDirRef.current = dir;
    Haptics.selectionAsync().catch(() => {});
    Animated.timing(translateX, {
      toValue: -dir * screenWidth,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      applyPending();
      translateX.setValue(dir * screenWidth);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished: f2 }) => {
        if (f2) animatingRef.current = false;
      });
    });
  }

  function cancel() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
  }

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-18, 18])
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onStart(() => {
      if (animatingRef.current) interrupt();
    })
    .onUpdate((e) => {
      const max = screenWidth * 0.55;
      let v = e.translationX;
      if (v > max) v = max + (v - max) * 0.35;
      else if (v < -max) v = -max + (v + max) * 0.35;
      translateX.setValue(v);
    })
    .onEnd((e) => {
      const enoughDistance = Math.abs(e.translationX) > screenWidth * 0.4;
      const enoughVelocity = Math.abs(e.velocityX) > 600;
      if (!enoughDistance && !enoughVelocity) {
        cancel();
        return;
      }
      complete(e.translationX < 0 ? 1 : -1);
    })
    .onFinalize((_, success) => {
      if (!success) cancel();
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <Animated.View
        style={{ flex: 1, backgroundColor: t.bg, transform: [{ translateX }] }}
        collapsable={false}
      >
        <MonthPage
          familyId={familyId}
          month={month}
          refreshing={refreshing}
          onRefresh={onRefresh}
          refreshTint={t.accent}
          onPrev={() => complete(-1)}
          onNext={() => complete(1)}
          onPickMonthYear={onPickMonthYear}
          scrollGesture={scrollGesture}
        />
      </Animated.View>
    </GestureDetector>
  );
}

function MonthHeader({
  month,
  refreshing,
  onRefresh,
  onPrev,
  onNext,
  onPickMonthYear,
}: {
  month: Date;
  refreshing?: boolean;
  onRefresh?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onPickMonthYear?: () => void;
}) {
  const t = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space.lg,
        paddingTop: space.md,
        paddingBottom: space.sm,
      }}
    >
      <Pressable
        onPress={onPrev}
        hitSlop={14}
        accessibilityLabel="Previous month"
        style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
        disabled={!onPrev}
      >
        <Feather name="chevron-left" size={26} color={onPrev ? t.accent : 'transparent'} />
      </Pressable>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={onPickMonthYear}
          hitSlop={8}
          disabled={!onPickMonthYear}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text>
            <Text style={[type.title1, { color: t.ink }]}>{format(month, 'LLLL')}</Text>
            <Text style={[type.title1, { color: t.fgLow }]}> {format(month, 'yyyy')}</Text>
          </Text>
          {onPickMonthYear ? <Feather name="chevron-down" size={20} color={t.fgMed} /> : null}
        </Pressable>
        {onRefresh ? (
          <Pressable
            onPress={onRefresh}
            hitSlop={12}
            accessibilityLabel="Refresh"
            disabled={!!refreshing}
            style={({ pressed }) => ({ opacity: pressed || refreshing ? 0.4 : 1, padding: 4 })}
          >
            {refreshing ? (
              <ActivityIndicator color={t.accent} size="small" />
            ) : (
              <Feather name="refresh-cw" size={20} color={t.accent} />
            )}
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onNext}
        hitSlop={14}
        accessibilityLabel="Next month"
        style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
        disabled={!onNext}
      >
        <Feather name="chevron-right" size={26} color={onNext ? t.accent : 'transparent'} />
      </Pressable>
    </View>
  );
}

function MonthPage({
  familyId,
  month,
  refreshing,
  onRefresh,
  refreshTint,
  onPrev,
  onNext,
  onPickMonthYear,
  scrollGesture,
}: {
  familyId: string;
  month: Date;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshTint: string;
  onPrev?: () => void;
  onNext?: () => void;
  onPickMonthYear?: () => void;
  scrollGesture: GestureType;
}) {
  const t = useThemeColors();
  void refreshing; void onRefresh; void refreshTint;
  const gridStart = monthGridStart(month);
  const gridEnd = addDays(gridStart, 42);
  const fromIso = gridStart.toISOString();
  const toIso = gridEnd.toISOString();
  const { data: events } = useQuery({
    queryKey: qk.eventsWithParticipants(familyId, fromIso, toIso),
    queryFn: () => listEventsWithParticipants(familyId, fromIso, toIso),
  });

  const weeks = useMemo(() => {
    const start = monthGridStart(month);
    const lastDayOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const dayDiff = Math.floor((lastDayOfMonth.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const weekCount = Math.ceil((dayDiff + 1) / 7);
    return Array.from({ length: weekCount }, (_, i) => addDays(start, i * 7));
  }, [month]);

  // De-duplicated color map for all events in this month grid.
  const colorMap = useMemo(() => buildEventColorMap(events ?? []), [events]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <GestureDetector gesture={scrollGesture}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 96 }}
        alwaysBounceVertical
        bounces
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={refreshTint}
              colors={[refreshTint]}
              progressViewOffset={8}
            />
          ) : undefined
        }
      >
        <MonthHeader
          month={month}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onPrev={onPrev}
          onNext={onNext}
          onPickMonthYear={onPickMonthYear}
        />
        <View style={[styles.weekdayHeader, { borderBottomColor: t.border, backgroundColor: t.bg }]}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text
              key={i}
              style={[
                type.caption,
                { color: i >= 5 ? t.fgLow : t.fgMed, flex: 1, textAlign: 'center' },
              ]}
            >
              {d}
            </Text>
          ))}
        </View>
        {weeks.map((weekStart, i) => (
          <WeekRow
            key={i}
            weekStart={weekStart}
            month={month}
            events={events ?? []}
            colorMap={colorMap}
          />
        ))}
      </ScrollView>
      </GestureDetector>
    </View>
  );
}

function WeekRow({
  weekStart,
  month,
  events,
  colorMap,
}: {
  weekStart: Date;
  month: Date;
  events: EventWithParticipants[];
  colorMap: Map<string, EventColor>;
}) {
  const router = useRouter();
  const t = useThemeColors();
  const { bars, lanesUsed } = useMemo(() => packWeek(events, weekStart), [events, weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // Grow the row's height to fit every lane — no overflow, no "+N", the
  // outer ScrollView handles tall weeks. Minimum keeps short weeks compact.
  const barsHeight = lanesUsed * (LANE_HEIGHT + LANE_GAP);
  const rowMinHeight = DAYNUMS_HEIGHT + Math.max(barsHeight, 12) + BARS_BOTTOM_PAD;

  return (
    <View style={[styles.weekRow, { borderBottomColor: t.border, minHeight: rowMinHeight }]}>
      <View style={{ flexDirection: 'row' }}>
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, month);
          const today = isSameDay(d, new Date());
          const isAfterMonth = !inMonth && d > month;
          if (isAfterMonth) {
            return <View key={i} style={styles.dayCell} />;
          }
          return (
            <View key={i} style={styles.dayCell}>
              <View
                style={[
                  styles.dayNumberContainer,
                  today && { backgroundColor: t.today },
                ]}
              >
                <Text
                  style={{
                    fontFamily: FONT_FAMILY_BY_WEIGHT['700'],
                    fontSize: 13,
                    fontWeight: '700',
                    fontVariant: ['tabular-nums'],
                    color: today ? t.onAccent : !inMonth ? t.fgLow : t.ink,
                    opacity: !inMonth ? 0.5 : 1,
                    includeFontPadding: false,
                  }}
                >
                  {d.getDate()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.barsContainer} pointerEvents="box-none">
        {bars.map((bar, i) => (
          <BarItem
            key={`${bar.event.id}-${i}`}
            bar={bar}
            scheme={t.name}
            colorMap={colorMap}
            onPress={() => {
              const familyId = bar.event.family_id;
              router.push({
                pathname: '/(app)/family/[id]/event/[eventId]',
                params: { id: familyId, eventId: bar.event.id },
              });
            }}
          />
        ))}
      </View>
    </View>
  );
}

function BarItem({
  bar,
  scheme,
  colorMap,
  onPress,
}: {
  bar: WeekBar;
  scheme: 'light' | 'dark';
  colorMap: Map<string, EventColor>;
  onPress: () => void;
}) {
  const span = bar.endCol - bar.startCol + 1;
  const left = `${(bar.startCol / 7) * 100}%` as DimensionValue;
  const width = `${(span / 7) * 100}%` as DimensionValue;
  const top = bar.lane * (LANE_HEIGHT + LANE_GAP);
  const solid = colorForEvent(bar.event.id, scheme, colorMap);
  const bg = barBgForEvent(bar.event.id, scheme, colorMap);

  const tinted: ViewStyle = {
    position: 'absolute',
    left,
    width,
    top,
    height: LANE_HEIGHT,
    paddingLeft: 3,
    paddingRight: 5,
    borderRadius: BAR_RADIUS,
    backgroundColor: bg,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  };

  return (
    <Pressable onPress={onPress} style={tinted}>
      {bar.isFirstSegment ? (
        <>
          <Participants participants={bar.event.participants} />
          <Text
            numberOfLines={1}
            style={{
              color: solid,
              fontFamily: FONT_FAMILY_BY_WEIGHT['700'],
              fontSize: 12,
              fontWeight: '700',
              flexShrink: 1,
              includeFontPadding: false,
            }}
          >
            {bar.event.title}
          </Text>
        </>
      ) : null}
    </Pressable>
  );
}

function Participants({ participants }: { participants: EventWithParticipants['participants'] }) {
  const t = useThemeColors();
  if (!participants || participants.length === 0) return null;
  const visible = participants.slice(0, 3);
  const extra = participants.length - visible.length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
      {visible.map((p, i) => (
        <View key={p.user_id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
          <UserAvatar profile={p.profile} size={18} />
        </View>
      ))}
      {extra > 0 ? (
        <Text
          style={{
            marginLeft: 3,
            color: t.onAccent,
            fontSize: 9,
            fontWeight: '700',
            backgroundColor: t.fgMed,
            borderRadius: 7,
            paddingHorizontal: 4,
            paddingVertical: 1,
            overflow: 'hidden',
          }}
        >
          +{extra}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  weekdayHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekRow: {
    flex: 1,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  dayCell: {
    flex: 1,
    paddingTop: 2,
    alignItems: 'center',
    height: 24,
  },
  dayNumberContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barsContainer: {
    position: 'absolute',
    top: 26,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
