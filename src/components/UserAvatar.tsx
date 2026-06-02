import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { Profile } from '@/lib/database.types';
import { USER_AVATARS_BUCKET } from '@/lib/queries';
import { publicUrl } from '@/lib/storage';
import { useThemeColors } from '@/theme/ThemeContext';
import { EVENT_PALETTE, FONT_FAMILY_BY_WEIGHT } from '@/theme/tokens';

type ProfileLike = Pick<Profile, 'display_name' | 'avatar_path' | 'avatar_url'> & {
  email?: string | null;
};

type Props = {
  profile: ProfileLike | null | undefined;
  size?: number;
  style?: ViewStyle;
};

function pickInitial(p: ProfileLike | null | undefined): string {
  const src = p?.display_name?.trim() || p?.email?.trim() || '?';
  return src[0]?.toUpperCase() ?? '?';
}

// Deterministic hue from the user's display name (or fallback to '?').
function paletteColorFor(seed: string, scheme: 'light' | 'dark'): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  }
  const e = EVENT_PALETTE[Math.abs(h) % EVENT_PALETTE.length];
  return scheme === 'dark' ? e.solidDark : e.solidLight;
}

export function UserAvatar({ profile, size = 40, style }: Props) {
  const t = useThemeColors();
  const uri = profile?.avatar_path
    ? publicUrl(USER_AVATARS_BUCKET, profile.avatar_path)
    : profile?.avatar_url ?? null;
  const seed = profile?.display_name ?? profile?.email ?? '?';
  const bg = paletteColorFor(seed, t.name);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
        style,
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text
          style={{
            color: '#FFFCF4',
            fontSize: Math.round(size * 0.44),
            fontFamily: FONT_FAMILY_BY_WEIGHT['700'],
            fontWeight: '700',
            includeFontPadding: false,
          }}
        >
          {pickInitial(profile)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
