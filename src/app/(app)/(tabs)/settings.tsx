import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { UserAvatar } from '@/components/UserAvatar';
import { useUser } from '@/lib/auth';
import type { Profile } from '@/lib/database.types';
import {
  clearMyAvatar,
  getProfile,
  pickAndUploadMyAvatar,
  updateMyDisplayName,
} from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useTheme, useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';
import type { ThemeMode } from '@/theme/tokens';

const MODE_OPTIONS: { key: ThemeMode; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function SettingsScreen() {
  const user = useUser();
  const t = useThemeColors();
  const { mode, setMode } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const p = await getProfile(user.id);
    setProfile(p);
    setName(p?.display_name ?? '');
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function handleSaveName() {
    setNameError(null);
    setSavingName(true);
    try {
      const updated = await updateMyDisplayName(name);
      setProfile(updated);
    } catch (e: any) {
      setNameError(e.message ?? 'Failed to save');
    } finally {
      setSavingName(false);
    }
  }

  async function handleChangeAvatar() {
    setAvatarBusy(true);
    try {
      const updated = await pickAndUploadMyAvatar();
      setProfile(updated);
    } catch (e: any) {
      if (e.message !== 'cancelled') Alert.alert('Could not update photo', e.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function handleAvatarPress() {
    const buttons: { text: string; style?: 'destructive' | 'cancel' | 'default'; onPress?: () => void }[] = [
      { text: profile?.avatar_path ? 'Change photo' : 'Pick photo', onPress: handleChangeAvatar },
    ];
    if (profile?.avatar_path) {
      buttons.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: async () => {
          setAvatarBusy(true);
          try {
            const updated = await clearMyAvatar();
            setProfile(updated);
          } catch (e: any) {
            Alert.alert('Failed', e.message);
          } finally {
            setAvatarBusy(false);
          }
        },
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Profile photo', undefined, buttons);
  }

  async function handleSignOut() {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
      {/* Large title */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10 }}>
        <Text style={{
          fontFamily: type.title1.fontFamily,
          fontSize: 32,
          fontWeight: '800',
          color: t.ink,
          letterSpacing: -0.6,
        }}>
          Settings
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: space.xxl * 2, gap: 22 }}>
        {/* Profile */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Pressable onPress={handleAvatarPress} hitSlop={10} style={styles.avatarWrapper}>
            <UserAvatar
              profile={profile ?? { display_name: null, avatar_path: null, avatar_url: null }}
              size={96}
            />
            <View
              style={[
                styles.cameraBadge,
                { backgroundColor: t.accent, borderColor: t.bg },
              ]}
            >
              <Feather name="camera" size={16} color={t.onAccent} />
            </View>
            {avatarBusy ? (
              <View style={[styles.avatarOverlay, { borderRadius: 48 }]}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
          </Pressable>
          <Text style={[type.footnote, { color: t.fgLow }]}>Tap photo to change</Text>

          <View style={{ width: '100%', marginTop: 6, gap: 8 }}>
            <Input
              value={name}
              onChangeText={setName}
              placeholder="What should we call you?"
              autoCapitalize="words"
            />
            <Text style={[type.footnote, { color: t.fgLow, paddingHorizontal: 4 }]}>{user?.email}</Text>
            {nameError ? <Text style={[type.footnote, { color: t.danger }]}>{nameError}</Text> : null}
          </View>
          <View style={{ width: '100%', marginTop: 4 }}>
            <Button title="Save name" variant="secondary" onPress={handleSaveName} loading={savingName} />
          </View>
        </View>

        {/* Appearance */}
        <View>
          <SectionLabel>Appearance</SectionLabel>
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: t.bgRaised,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: t.border,
              padding: 4,
            }}
          >
            {MODE_OPTIONS.map((opt) => {
              const selected = mode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => setMode(opt.key)}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: radius.sm,
                    backgroundColor: selected ? t.accent : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      fontFamily: type.headline.fontFamily,
                      fontSize: 14,
                      fontWeight: '700',
                      color: selected ? t.onAccent : t.fgMed,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[type.caption, { color: t.fgLow, marginTop: 8, paddingHorizontal: 4 }]}>
            System follows your device's appearance setting.
          </Text>
        </View>

        {/* Account */}
        <View>
          <SectionLabel>Account</SectionLabel>
          <Button title="Sign out" variant="danger" icon="log-out" onPress={handleSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useThemeColors();
  return (
    <Text
      style={{
        fontFamily: type.caption.fontFamily,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: t.fgLow,
        paddingHorizontal: 4,
        paddingBottom: 8,
      }}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  avatarWrapper: {
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
});
