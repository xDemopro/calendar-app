import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColors } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  padded?: boolean;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
};

export function Screen({ children, scroll, contentStyle, padded = true, edges }: Props) {
  const tokens = useThemeColors();
  const Inner = scroll ? ScrollView : View;
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: tokens.bg }]}
      edges={edges ?? ['top', 'bottom']}
    >
      <Inner
        style={{ flex: 1 }}
        contentContainerStyle={[
          padded && { padding: space.lg, gap: space.md },
          contentStyle,
        ] as StyleProp<ViewStyle>}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Inner>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
