import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import {
  listAttachments,
  normalizeUrl,
  type Attachment,
} from '@/lib/attachments';
import { useCreateLinkMutation, useUpdateLinkMutation } from '@/lib/mutations';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function LinkEditorScreen() {
  const { eventId, attachmentId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    attachmentId?: string;
  }>();
  const router = useRouter();
  const t = useThemeColors();

  const createLink = useCreateLinkMutation(eventId ?? '');
  const updateLink = useUpdateLinkMutation(eventId ?? '');

  // For edit: read from the cached attachments list so we get offline support too.
  const { data: attachments } = useQuery({
    queryKey: qk.attachments(eventId ?? ''),
    queryFn: () => listAttachments(eventId!),
    enabled: !!eventId && !!attachmentId,
  });

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [loaded, setLoaded] = useState(!attachmentId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachmentId || !attachments) return;
    const found = attachments.find((a) => a.id === attachmentId) as Attachment | undefined;
    if (found && found.kind === 'link') {
      setUrl(found.data.url);
      setTitle(found.data.title ?? '');
    }
    setLoaded(true);
  }, [attachmentId, attachments]);

  async function handleSave() {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError('Enter a URL');
      return;
    }
    // Minimal sanity check — we don't want to validate every edge case, but a
    // URL with no dot in the host is almost certainly a typo.
    try {
      const parsed = new URL(normalized);
      if (!parsed.hostname.includes('.')) {
        setError("That doesn't look like a URL");
        return;
      }
    } catch {
      setError("That doesn't look like a URL");
      return;
    }
    setError(null);
    const data = { url: normalized, title: title.trim() || undefined };
    const onError = (e: any) => setError(e.message ?? 'Failed to save');
    const onSuccess = () => router.back();
    if (attachmentId) {
      updateLink.mutate({ id: attachmentId, data }, { onSuccess, onError });
    } else {
      createLink.mutate(data, { onSuccess, onError });
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

  const saving = createLink.isPending || updateLink.isPending;

  return (
    <Screen scroll>
      <Text style={[type.title1, { color: t.ink }]}>
        {attachmentId ? 'Edit link' : 'New link'}
      </Text>
      <Input
        label="URL"
        value={url}
        onChangeText={setUrl}
        placeholder="example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        autoFocus
      />
      <Input
        label="Title"
        value={title}
        onChangeText={setTitle}
        placeholder="Optional label"
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
      <Button title="Save link" onPress={handleSave} loading={saving} style={{ marginTop: space.md }} />
    </Screen>
  );
}
