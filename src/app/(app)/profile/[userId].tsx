import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { UserAvatar } from '@/components/UserAvatar';
import { getProfile } from '@/lib/queries';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const t = useThemeColors();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: qk.profile(userId ?? ''),
    queryFn: () => getProfile(userId!),
    enabled: !!userId,
  });

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
