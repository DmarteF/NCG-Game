import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: ViewStyle;
};

export default function Chip({ label, active, onPress, testID, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        { opacity: pressed ? 0.8 : 1 },
        style,
      ]}
    >
      <Text style={[styles.text, active && styles.textActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipActive: {
    backgroundColor: 'rgba(255,59,0,0.18)',
    borderColor: theme.colors.borderActive,
  },
  text: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  textActive: { color: theme.colors.textPrimary },
});
