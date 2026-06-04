import { Stack } from 'expo-router';

import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT } from '@/theme/tokens';

export default function AppLayout() {
  const t = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.accent,
        headerShadowVisible: false,
        headerTitleStyle: { color: t.ink, fontFamily: FONT_FAMILY_BY_WEIGHT['700'], fontSize: 17 },
        contentStyle: { backgroundColor: t.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="new-family" options={{ title: 'New family', presentation: 'modal' }} />
      <Stack.Screen name="join-family" options={{ title: 'Join a family', presentation: 'modal' }} />
      <Stack.Screen name="family/[id]/index" options={{ title: 'Calendar' }} />
      <Stack.Screen name="family/[id]/edit" options={{ title: 'Edit family' }} />
      <Stack.Screen
        name="family/[id]/invite"
        options={{ title: 'Invite', presentation: 'modal' }}
      />
      <Stack.Screen
        name="family/[id]/event/new"
        options={{ title: 'New event', presentation: 'modal' }}
      />
      <Stack.Screen
        name="profile/[userId]"
        options={{ title: 'Profile', presentation: 'modal' }}
      />
      <Stack.Screen name="family/[id]/event/[eventId]/index" options={{ title: 'Event' }} />
      <Stack.Screen
        name="family/[id]/event/[eventId]/edit"
        options={{ title: 'Edit event', presentation: 'modal' }}
      />
      <Stack.Screen
        name="family/[id]/event/[eventId]/note"
        options={{ title: 'Note', presentation: 'modal' }}
      />
      <Stack.Screen
        name="family/[id]/event/[eventId]/link"
        options={{ title: 'Link', presentation: 'modal' }}
      />
      <Stack.Screen
        name="family/[id]/event/[eventId]/add-participant"
        options={{ title: 'Add participants', presentation: 'modal' }}
      />
    </Stack>
  );
}
