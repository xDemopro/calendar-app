import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { Family } from '@/lib/database.types';
import { FAMILY_AVATARS_BUCKET } from '@/lib/queries';
import { signedUrl } from '@/lib/storage';
import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT } from '@/theme/tokens';

type Props = {
  family: Pick<Family, 'name' | 'avatar_path'> | null;
  size?: number;
  style?: ViewStyle;
};

export function FamilyAvatar({ family, size = 48, style }: Props) {
  const t = useThemeColors();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (family?.avatar_path) {
      signedUrl(FAMILY_AVATARS_BUCKET, family.avatar_path, 60 * 60)
        .then((u) => {
          if (alive) setUrl(u);
        })
        .catch(() => {});
    } else {
      setUrl(null);
    }
    return () => {
      alive = false;
    };
  }, [family?.avatar_path]);

  const initial = (family?.name?.trim()?.[0] ?? '?').toUpperCase();

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accent },
        style,
      ]}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <Text
          style={{
            color: t.onAccent,
            fontSize: Math.round(size * 0.42),
            fontFamily: FONT_FAMILY_BY_WEIGHT['800'],
            fontWeight: '800',
            includeFontPadding: false,
          }}
        >
          {initial}
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
