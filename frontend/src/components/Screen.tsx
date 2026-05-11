import React from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  noPadding?: boolean;
  testID?: string;
};

export default function Screen({ children, scroll = true, noPadding, testID }: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <LinearGradient colors={['#0a0303', '#050202', '#0a0303']} style={styles.gradient}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* radial-ish glow overlays */}
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowBottom} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']} testID={testID}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <Body
            style={{ flex: 1 }}
            contentContainerStyle={[
              scroll && { paddingBottom: 32, flexGrow: 1 },
              !noPadding && { paddingHorizontal: 20, paddingTop: 12 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </Body>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, backgroundColor: theme.colors.bg },
  safe: { flex: 1 },
  glowTop: {
    position: 'absolute', top: -160, left: -80, width: 360, height: 360, borderRadius: 360,
    backgroundColor: theme.colors.secondary, opacity: 0.18,
  },
  glowBottom: {
    position: 'absolute', bottom: -200, right: -100, width: 420, height: 420, borderRadius: 420,
    backgroundColor: theme.colors.primary, opacity: 0.15,
  },
});
