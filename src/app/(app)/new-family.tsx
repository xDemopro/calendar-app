import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { createFamily } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function NewFamilyScreen() {
  const router = useRouter();
  const t = useThemeColors();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const family = await createFamily(name.trim());
      router.replace({ pathname: '/(app)/family/[id]', params: { id: family.id } });
    } catch (e: any) {
      setError(e.message ?? 'Failed to create family');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={[type.title1, { color: t.ink }]}>Create a family</Text>
      <Text style={[type.body, { color: t.fgMed }]}>
        After creating, share the invite code with your family so they can join.
      </Text>
      <Input
        label="Family name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. The Smiths"
        autoFocus
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
      <Button title="Create" onPress={handleCreate} loading={loading} style={{ marginTop: space.md }} />
    </Screen>
  );
}
