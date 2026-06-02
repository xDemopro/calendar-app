import { Stack } from 'expo-router';

import { useThemeColors } from '@/theme/ThemeContext';

export default function AuthLayout() {
  const t = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.bg },
      }}
    />
  );
}
