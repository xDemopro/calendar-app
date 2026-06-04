// Native two-column wheel picker for month + year, using iOS's
// UIPickerView under the hood via @react-native-picker/picker.

import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  visible: boolean;
  currentMonth: Date;
  onClose: () => void;
  onSelect: (month: Date) => void;
};

export function MonthYearPicker({ visible, currentMonth, onClose, onSelect }: Props) {
  const t = useThemeColors();

  const [monthIdx, setMonthIdx] = useState<number>(currentMonth.getMonth());
  const [year, setYear] = useState<number>(currentMonth.getFullYear());

  // Reset when modal opens.
  useEffect(() => {
    if (visible) {
      setMonthIdx(currentMonth.getMonth());
      setYear(currentMonth.getFullYear());
    }
  }, [visible, currentMonth]);

  // ±20 years from today's year.
  const years = useMemo(() => {
    const thisYear = new Date().getFullYear();
    return Array.from({ length: 41 }, (_, i) => thisYear - 20 + i);
  }, []);

  function commit() {
    onSelect(new Date(year, monthIdx, 1));
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={[styles.card, { backgroundColor: t.bgRaised, borderColor: t.border }]}
        >
          <Text style={[type.title3, { color: t.ink, textAlign: 'center', marginBottom: space.md }]}>
            Jump to month
          </Text>

          <View style={styles.wheels}>
            <Picker
              selectedValue={monthIdx}
              onValueChange={(v) => setMonthIdx(Number(v))}
              style={styles.wheel}
              itemStyle={{ color: t.ink, fontSize: 22 }}
            >
              {MONTHS.map((m, i) => (
                <Picker.Item key={m} label={m} value={i} color={t.ink} />
              ))}
            </Picker>
            <Picker
              selectedValue={year}
              onValueChange={(v) => setYear(Number(v))}
              style={styles.wheel}
              itemStyle={{ color: t.ink, fontSize: 22 }}
            >
              {years.map((y) => (
                <Picker.Item key={y} label={String(y)} value={y} color={t.ink} />
              ))}
            </Picker>
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingVertical: space.sm,
                paddingHorizontal: space.lg,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[type.callout, { color: t.fgMed }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={commit}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingVertical: space.sm,
                paddingHorizontal: space.lg,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[type.callout, { color: t.accent, fontWeight: '700' }]}>Done</Text>
            </Pressable>
          </View>
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
  },
  wheels: {
    flexDirection: 'row',
    height: 200,
  },
  wheel: { flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
});
