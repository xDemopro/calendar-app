import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { joinFamilyByCode } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function JoinFamilyScreen() {
  const router = useRouter();
  const t = useThemeColors();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const clean = code.trim().toUpperCase();
    if (clean.length < 4) {
      setError('Enter a valid invite code');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const family = await joinFamilyByCode(clean);
      router.replace({ pathname: '/(app)/family/[id]', params: { id: family.id } });
    } catch (e: any) {
      setError(e.message ?? 'Invalid code');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={[type.title1, { color: t.ink }]}>Join a family</Text>
      <Text style={[type.body, { color: t.fgMed }]}>
        Type the invite code shared by a family member.
      </Text>
      <Input
        label="Invite code"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="ABCD2345"
        autoCapitalize="characters"
        autoCorrect={false}
        autoFocus
        maxLength={12}
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
      <Button title="Join" onPress={handleJoin} loading={loading} style={{ marginTop: space.md }} />
    </Screen>
  );
}
