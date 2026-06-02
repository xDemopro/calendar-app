import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT } from '@/theme/tokens';

export default function TabsLayout() {
  const t = useThemeColors();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        headerTitleStyle: { color: t.ink, fontFamily: FONT_FAMILY_BY_WEIGHT['800'], fontSize: 18 },
        tabBarStyle: {
          backgroundColor: t.bgElev,
          borderTopColor: t.border,
        },
        tabBarLabelStyle: { fontFamily: FONT_FAMILY_BY_WEIGHT['700'], fontSize: 11, letterSpacing: 0.2 },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.fgLow,
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'Families',
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="users" size={size ?? 22} color={color} {...({ strokeWidth: focused ? 2.1 : 1.9 } as object)} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          headerShown: false,
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="settings" size={size ?? 22} color={color} {...({ strokeWidth: focused ? 2.1 : 1.9 } as object)} />
          ),
        }}
      />
    </Tabs>
  );
}
