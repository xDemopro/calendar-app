import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/theme/ThemeContext';
import { FONT_FAMILY_BY_WEIGHT, space, type } from '@/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const t = useThemeColors();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<null | 'email' | 'google' | 'apple'>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleEmail() {
    setError(null);
    setLoading('email');
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // Use the app's deep-link scheme as the post-confirmation redirect.
        // Until we have a real domain hosting a confirmation page, this routes
        // the user back into the app after Supabase confirms their email on
        // the server. Must be in the Supabase Auth redirect-URL allowlist.
        const emailRedirectTo = Linking.createURL('/');
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        Alert.alert('Check your email', 'We sent you a confirmation link.');
        setMode('signin');
      }
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null);
    setLoading(provider);
    try {
      const redirectTo = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No auth URL returned');
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) return;
      const url = new URL(result.url);
      const fragment = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (!access_token || !refresh_token) throw new Error('Missing tokens in OAuth response');
      const { error: sessionErr } = await supabase.auth.setSession({ access_token, refresh_token });
      if (sessionErr) throw sessionErr;
    } catch (e: any) {
      setError(e.message ?? 'OAuth failed');
    } finally {
      setLoading(null);
    }
  }

  async function handleNativeApple() {
    setError(null);
    setLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token from Apple');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return;
      setError(e.message ?? 'Apple sign-in failed');
    } finally {
      setLoading(null);
    }
  }

  return (
    <Screen scroll>
      <View style={{ marginTop: space.xxl, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: t.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 26 }}>🏠</Text>
          </View>
          <Text style={[type.display, { color: t.ink }]}>F&F Calendar</Text>
        </View>
        <Text style={[type.callout, { color: t.fgMed, marginTop: space.xs }]}>
          A shared calendar for the people you care about.
        </Text>
      </View>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
        <Button
          title={mode === 'signin' ? 'Sign in' : 'Create account'}
          onPress={handleEmail}
          loading={loading === 'email'}
        />
        <Button
          title={mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
          variant="ghost"
          onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        />
      </View>

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
        <Text style={[type.caption, { color: t.fgLow }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: t.border }]} />
      </View>

      <View style={{ gap: space.md }}>
        <Button
          title="Continue with Google"
          variant="secondary"
          onPress={() => handleOAuth('google')}
          loading={loading === 'google'}
        />
        {Platform.OS === 'ios' ? (
          <Button
            title="Continue with Apple"
            variant="secondary"
            onPress={handleNativeApple}
            loading={loading === 'apple'}
          />
        ) : (
          <Button
            title="Continue with Apple"
            variant="secondary"
            onPress={() => handleOAuth('apple')}
            loading={loading === 'apple'}
          />
        )}
      </View>

      <Text
        style={{
          color: t.fgLow,
          fontFamily: FONT_FAMILY_BY_WEIGHT['600'],
          fontSize: 11,
          textAlign: 'center',
          marginTop: space.xl,
          letterSpacing: 0.5,
        }}
      >
        By continuing you agree to be a kind family member.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginVertical: space.lg,
  },
  dividerLine: { flex: 1, height: 1 },
});
