import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme, typography } from '../theme';

export function Action({ children, onPress, disabled = false, secondary = false, busy = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; secondary?: boolean; busy?: boolean }>) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.action, { backgroundColor: secondary ? 'transparent' : colors.primary, borderColor: colors.outline, borderWidth: secondary ? 1 : 0, opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1 }]}>
    {busy ? <ActivityIndicator color={secondary ? colors.foreground : colors.onPrimary} /> : null}
    <Text style={[typography.label, { color: secondary ? colors.foreground : colors.onPrimary, textAlign: 'center', flexShrink: 1 }]}>{children}</Text>
  </Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const colors = useTheme();
  return <View style={styles.field}><Text style={[typography.label, { color: colors.foreground }]}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={colors.secondary} selectionColor={colors.primary}
      style={[typography.body, styles.input, { color: colors.foreground, backgroundColor: colors.surface, borderColor: colors.outline }]} {...props} />
  </View>;
}

export function Message({ children, error = false }: PropsWithChildren<{ error?: boolean }>) {
  const colors = useTheme();
  return <Text accessibilityRole={error ? 'alert' : undefined} accessibilityLiveRegion="polite" style={[typography.body, { color: error ? colors.error : colors.secondary }]}>{children}</Text>;
}

export function Loading({ label = 'Carregando...' }: { label?: string }) {
  const colors = useTheme();
  return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Message>{label}</Message></View>;
}

const styles = StyleSheet.create({
  action: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  field: { gap: 8 }, input: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderRadius: 10 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
});
