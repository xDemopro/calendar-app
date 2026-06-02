import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import type { Profile } from '@/lib/database.types';
import { getProfile } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const t = useThemeColors();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!userId) return;
    (async () => {
      try {
        const p = await getProfile(userId);
        if (alive) setProfile(p);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }
  if (!profile) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.ink }]}>Profile not found.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.center}>
        <UserAvatar profile={profile} size={160} />
        <Text style={[type.title1, { color: t.ink, marginTop: space.lg, textAlign: 'center' }]}>
          {profile.display_name ?? 'Unnamed'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: space.xxl,
  },
});
