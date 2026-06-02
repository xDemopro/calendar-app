import { useQuery } from '@tanstack/react-query';
import { addMonths, format, isSameDay, isSameMonth, parseISO, startOfDay } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

import { UserAvatar } from './UserAvatar';
import { barBgForEvent, colorForEvent } from '@/lib/eventColor';
import { listEventsWithParticipants, type EventWithParticipants } from '@/lib/queries';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT, radius, space, type } from '@/theme/tokens';

const SCREEN = Dimensions.get('window');
const PAST_MONTHS = 24;
const FUTURE_MONTHS = 24;
const TOTAL_PAGES = PAST_MONTHS + 1 + FUTURE_MONTHS;
const INITIAL_INDEX = PAST_MONTHS;

const LANE_HEIGHT = 26;
const LANE_GAP = 3;
const MAX_LANES = 3;
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

function monthPageDate(referenceMonth: Date, index: number): Date {
  return addMonths(referenceMonth, index - INITIAL_INDEX);
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
  overflow: number[];
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

  const laneOccupiedThrough: number[] = new Array(MAX_LANES).fill(-1);
  const bars: WeekBar[] = [];
  const overflowPerCol = new Array(7).fill(0);

  for (const event of overlapping) {
    const start = startOfDay(parseISO(event.starts_at));
    const end = startOfDay(effectiveEnd(event));
    let startCol = 0;
    while (startCol < 7 && weekDays[startCol] < start) startCol++;
    let endCol = 6;
    while (endCol >= 0 && weekDays[endCol] > end) endCol--;
    if (startCol > endCol) continue;
    const eventStartsThisWeek = start >= weekStart && start < weekEnd;

    let lane = -1;
    for (let l = 0; l < MAX_LANES; l++) {
      if (laneOccupiedThrough[l] < startCol) {
        lane = l;
        break;
      }
    }
    if (lane === -1) {
      for (let c = startCol; c <= endCol; c++) overflowPerCol[c]++;
      continue;
    }
    laneOccupiedThrough[lane] = endCol;
    bars.push({ event, startCol, endCol, lane, isFirstSegment: eventStartsThisWeek });
  }

  return { bars, overflow: overflowPerCol };
}

// ---------- Components ----------

export function BarMonthView({
  familyId,
  referenceMonth,
  onMonthChange,
}: {
  familyId: string;
  referenceMonth: Date;
  onMonthChange?: (month: Date) => void;
}) {
  const listRef = useRef<FlatList>(null);
  const [pageWidth, setPageWidth] = useState<number>(SCREEN.width);
  const [currentIndex, setCurrentIndex] = useState<number>(INITIAL_INDEX);

  const onLayout = useCallback((e: { nativeEvent: { layout: { width: number } } }) => {
    setPageWidth(e.nativeEvent.layout.width);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
      if (idx !== currentIndex) {
        setCurrentIndex(idx);
        onMonthChange?.(monthPageDate(referenceMonth, idx));
      }
    },
    [pageWidth, currentIndex, referenceMonth, onMonthChange],
  );

  const data = useMemo(() => Array.from({ length: TOTAL_PAGES }, (_, i) => i), []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={INITIAL_INDEX}
        getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
        onMomentumScrollEnd={onMomentumScrollEnd}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        removeClippedSubviews
        renderItem={({ item: index }) => (
          <View style={{ width: pageWidth }}>
            <MonthPage familyId={familyId} month={monthPageDate(referenceMonth, index)} />
          </View>
        )}
      />
    </View>
  );
}

function MonthHeader({ month }: { month: Date }) {
  const t = useThemeColors();
  return (
    <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}>
      <Text>
        <Text style={[type.title1, { color: t.ink }]}>{format(month, 'LLLL')}</Text>
        <Text style={[type.title1, { color: t.fgLow }]}> {format(month, 'yyyy')}</Text>
      </Text>
    </View>
  );
}

function MonthPage({ familyId, month }: { familyId: string; month: Date }) {
  const t = useThemeColors();
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

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <MonthHeader month={month} />
      <View style={[styles.weekdayHeader, { borderBottomColor: t.border }]}>
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
      <View style={{ flex: 1 }}>
        {weeks.map((weekStart, i) => (
          <WeekRow
            key={i}
            weekStart={weekStart}
            month={month}
            events={events ?? []}
          />
        ))}
      </View>
    </View>
  );
}

function WeekRow({
  weekStart,
  month,
  events,
}: {
  weekStart: Date;
  month: Date;
  events: EventWithParticipants[];
}) {
  const router = useRouter();
  const t = useThemeColors();
  const { bars, overflow } = useMemo(() => packWeek(events, weekStart), [events, weekStart]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  return (
    <View style={[styles.weekRow, { borderBottomColor: t.border }]}>
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
            onPress={() => {
              const familyId = bar.event.family_id;
              router.push({
                pathname: '/(app)/family/[id]/event/[eventId]',
                params: { id: familyId, eventId: bar.event.id },
              });
            }}
          />
        ))}
        {overflow.map((n, i) =>
          n > 0 ? (
            <View
              key={`ov-${i}`}
              style={{
                position: 'absolute',
                left: (`${(i / 7) * 100}%`) as DimensionValue,
                bottom: 2,
                width: (`${100 / 7}%`) as DimensionValue,
                alignItems: 'center',
              }}
            >
              <Text style={[type.micro, { color: t.fgLow }]}>+{n}</Text>
            </View>
          ) : null,
        )}
      </View>
    </View>
  );
}

function BarItem({
  bar,
  scheme,
  onPress,
}: {
  bar: WeekBar;
  scheme: 'light' | 'dark';
  onPress: () => void;
}) {
  const span = bar.endCol - bar.startCol + 1;
  const left = `${(bar.startCol / 7) * 100}%` as DimensionValue;
  const width = `${(span / 7) * 100}%` as DimensionValue;
  const top = bar.lane * (LANE_HEIGHT + LANE_GAP);
  const solid = colorForEvent(bar.event.id, scheme);
  const bg = barBgForEvent(bar.event.id, scheme);

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
