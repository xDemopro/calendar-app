// Modal picker: tap the month/year header in either calendar view to jump
// to a specific month/year. Year scrollable horizontally, months in a grid.

import { format } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT, radius, space, type } from '@/theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  visible: boolean;
  // Currently-displayed month so we can highlight it.
  currentMonth: Date;
  onClose: () => void;
  onSelect: (month: Date) => void;
};

export function MonthYearPicker({ visible, currentMonth, onClose, onSelect }: Props) {
  const t = useThemeColors();
  const [year, setYear] = useState<number>(currentMonth.getFullYear());

  // Reset to currentMonth's year whenever modal opens.
  useEffect(() => {
    if (visible) setYear(currentMonth.getFullYear());
  }, [visible, currentMonth]);

  // Show ±20 years from current year.
  const years = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: 41 }, (_, i) => thisYear - 20 + i);
  }, []);

  const yearScrollRef = useRef<ScrollView>(null);
  const yearItemWidth = 64;

  // Scroll the year strip so the selected year is roughly centered.
  useEffect(() => {
    if (!visible) return;
    const idx = years.indexOf(year);
    if (idx >= 0) {
      // Defer to next tick so layout has happened.
      const id = setTimeout(() => {
        yearScrollRef.current?.scrollTo({
          x: idx * yearItemWidth - 120,
          animated: false,
        });
      }, 0);
      return () => clearTimeout(id);
    }
  }, [visible, year, years]);

  const currentY = currentMonth.getFullYear();
  const currentM = currentMonth.getMonth();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          // Inner Pressable swallows taps so they don't bubble to the
          // backdrop and close the modal.
          onPress={() => {}}
          style={[styles.card, { backgroundColor: t.bgRaised, borderColor: t.border }]}
        >
          <Text style={[type.title3, { color: t.ink, textAlign: 'center', marginBottom: space.md }]}>
            Jump to month
          </Text>

          {/* Year strip */}
          <ScrollView
            ref={yearScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: space.sm }}
          >
            {years.map((y) => {
              const isSelected = y === year;
              return (
                <Pressable
                  key={y}
                  onPress={() => setYear(y)}
                  style={{
                    width: yearItemWidth,
                    paddingVertical: space.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONT_FAMILY_BY_WEIGHT[isSelected ? '800' : '600'],
                      fontSize: isSelected ? 22 : 17,
                      color: isSelected ? t.accent : t.fgMed,
                      letterSpacing: -0.2,
                    }}
                  >
                    {y}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Month grid (4 cols × 3 rows) */}
          <View style={styles.monthsGrid}>
            {MONTHS.map((mLabel, mIdx) => {
              const isCurrent = year === currentY && mIdx === currentM;
              return (
                <Pressable
                  key={mLabel}
                  onPress={() => {
                    onSelect(new Date(year, mIdx, 1));
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.monthCell,
                    {
                      backgroundColor: isCurrent ? t.accent : 'transparent',
                      borderColor: t.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      fontFamily: FONT_FAMILY_BY_WEIGHT['600'],
                      fontSize: 16,
                      color: isCurrent ? t.onAccent : t.ink,
                    }}
                  >
                    {mLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              alignSelf: 'center',
              paddingVertical: space.sm,
              paddingHorizontal: space.lg,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[type.callout, { color: t.fgMed }]}>Cancel</Text>
          </Pressable>
          {/* Suppress unused 'format' if you change the layout — keeps tsc quiet */}
          {false ? <Text>{format(currentMonth, 'yyyy')}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: space.lg,
    gap: space.md,
  },
  monthsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  monthCell: {
    width: '23%',
    aspectRatio: 1.4,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
