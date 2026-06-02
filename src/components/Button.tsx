import { Feather } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: Props) {
  const t = useThemeColors();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? { backgroundColor: t.accent }
      : variant === 'danger'
        ? {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: t.name === 'dark' ? 'rgba(224,121,106,0.4)' : 'rgba(192,80,63,0.35)',
          }
        : variant === 'secondary'
          ? { backgroundColor: t.bgRaised, borderWidth: 1, borderColor: t.borderStr }
          : { backgroundColor: 'transparent' };

  const textColor =
    variant === 'primary' ? t.onAccent : variant === 'danger' ? t.danger : variant === 'ghost' ? t.accent : t.ink;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        bg,
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {icon ? <Feather name={icon} size={20} color={textColor} /> : null}
          <Text style={[type.headline, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
