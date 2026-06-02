import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
};

export function Input({ label, error, style, ...rest }: Props) {
  const t = useThemeColors();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[type.subhead, { color: t.fgMed }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.fgLow}
        {...rest}
        style={[
          styles.input,
          type.body,
          {
            color: t.ink,
            backgroundColor: t.bgRaised,
            borderColor: error ? t.danger : t.border,
          },
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
});
