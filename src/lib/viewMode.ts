import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'familycal.viewMode';

export type CalendarViewMode = 'dots' | 'bars';

export function useCalendarViewMode() {
  const [mode, setMode] = useState<CalendarViewMode>('dots');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      if (v === 'bars' || v === 'dots') setMode(v);
    });
  }, []);

  const update = (next: CalendarViewMode) => {
    setMode(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  };

  return { mode, setMode: update };
}
