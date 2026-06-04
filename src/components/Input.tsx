import { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useKeyboardFocus } from '@/lib/keyboardFocus';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, style, onFocus, onBlur, ...rest }: Props) {
  const t = useThemeColors();
  const { setFocusedView } = useKeyboardFocus();
  const wrapperRef = useRef<View>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus: TextInputProps['onFocus'] = (e) => {
    setIsFocused(true);
    setFocusedView(wrapperRef.current);
    onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = (e) => {
    setIsFocused(false);
    setFocusedView(null);
    onBlur?.(e);
  };

  // When focused: brightest possible bg + highest-contrast text. The dim
  // overlay (Screen.tsx) is light enough that this combination reads as the
  // brightest thing on the screen.
  const focusedBg = t.name === 'dark' ? '#6E6250' : '#FFFFFF';
  const inputBackground = isFocused ? focusedBg : t.bgRaised;
  // Boost text contrast on focus: pure white on dark, pure black on light.
  const focusedTextColor = t.name === 'dark' ? '#FFFFFF' : '#000000';
  const textColor = isFocused ? focusedTextColor : t.ink;
  const placeholderColor = isFocused
    ? (t.name === 'dark' ? '#B8AC9A' : '#5C5145')
    : t.fgLow;

  return (
    <View ref={wrapperRef} style={{ gap: 6 }} collapsable={false}>
      {label ? <Text style={[type.subhead, { color: t.fgMed }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={placeholderColor}
        {...rest}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={[
          styles.input,
          type.body,
          {
            color: textColor,
            backgroundColor: inputBackground,
            borderColor: error ? t.danger : t.border,
          },
          isFocused && styles.focusedShadow,
          style,
        ]}
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  focusedShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
});
