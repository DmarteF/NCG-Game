import React from 'react';
import { Text, StyleSheet, Pressable, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
  small?: boolean;
};

export default function Button({
  title, onPress, variant = 'primary', disabled, loading, style, textStyle, testID, small,
}: Props) {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';

  const content = (
    <Text style={[
      styles.text,
      small && styles.textSmall,
      variant === 'secondary' && { color: theme.colors.primary },
      variant === 'ghost' && { color: theme.colors.textSecondary },
      isDanger && { color: '#FFD0D5' },
      textStyle,
    ]}>
      {loading ? '...' : title}
    </Text>
  );

  if (isPrimary) {
    return (
      <Pressable
        onPress={disabled ? undefined : onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.wrap,
          small && styles.wrapSmall,
          { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[theme.colors.secondary, theme.colors.primary, theme.colors.neon]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.gradient, small && styles.gradientSmall]}
        >
          {loading ? <ActivityIndicator color="#fff" /> : content}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.wrap,
        small && styles.wrapSmall,
        styles.outline,
        variant === 'ghost' && { borderColor: 'rgba(255,255,255,0.1)' },
        isDanger && { borderColor: 'rgba(255,51,68,0.5)', backgroundColor: 'rgba(255,51,68,0.08)' },
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  wrapSmall: { shadowRadius: 6 },
  gradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientSmall: { paddingVertical: 10, paddingHorizontal: 16 },
  outline: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,59,0,0.05)',
    borderWidth: 1.5,
    borderColor: theme.colors.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0,
  },
  text: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  textSmall: { fontSize: 13, letterSpacing: 0.5 },
});
