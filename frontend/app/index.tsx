import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Screen from '../src/components/Screen';
import Button from '../src/components/Button';
import { Storage } from '../src/storage';
import { Profile } from '../src/types';
import { theme } from '../src/theme';

export default function Home() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  useFocusEffect(useCallback(() => {
    Storage.getProfile().then(setProfile);
  }, []));

  return (
    <Screen testID="home-screen">
      <View style={styles.topRow}>
        <Pressable onPress={() => router.push('/profile')} style={styles.profileCard} testID="home-profile-card">
          {profile?.image ? (
            <Image source={{ uri: profile.image }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={28} color={theme.colors.primary} />
            </View>
          )}
          <View>
            <Text style={styles.profileName} numberOfLines={1}>{profile?.name || 'Perfil'}</Text>
            <Text style={styles.profileVillage} numberOfLines={1}>{profile?.village || 'Editar'}</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.header}>
        <Text style={styles.brand}>SHINOBI ARENA</Text>
        <Text style={styles.subtitle}>Naruto Card Game</Text>
        <View style={styles.bar} />
      </View>

      <View style={styles.menu}>
        <Button
          title="Arena"
          onPress={() => router.push('/arena')}
          variant="secondary"
          testID="open-arena-btn"
        />
        <Button
          title="Menu Card"
          onPress={() => router.push('/menu-card')}
          variant="secondary"
          testID="open-menu-card-btn"
        />
      </View>

      <Text style={styles.footer}>v1.0 Prototype</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { alignItems: 'flex-start', marginTop: 4, marginBottom: 8 },
  header: { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  brand: {
    color: theme.colors.textPrimary,
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 4,
    textShadowColor: theme.colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    color: theme.colors.neon,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 6,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  bar: {
    width: 60, height: 3, borderRadius: 3, marginTop: 14,
    backgroundColor: theme.colors.primary,
  },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: 8,
    borderWidth: 1, borderColor: theme.colors.border,
    maxWidth: 190,
  },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.bg },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  profileName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  profileVillage: { color: theme.colors.neon, fontSize: 10, marginTop: 2, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  menu: { gap: 14, marginTop: 8 },
  footer: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 28, letterSpacing: 2 },
});
