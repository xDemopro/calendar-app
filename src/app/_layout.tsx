import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useThemeColors } from '@/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const tokens = useThemeColors();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tokens.bg }}>
        <ActivityIndicator color={tokens.accent} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.bg },
      }}
    >
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

function ThemedShell() {
  const tokens = useThemeColors();
  return (
    <>
      <StatusBar style={tokens.name === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    // Alias used by the type token sheet (`fontFamily: 'HankenGrotesk'`).
    HankenGrotesk: HankenGrotesk_400Regular,
  });

  const onReady = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedShell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
