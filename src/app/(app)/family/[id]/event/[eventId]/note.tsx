import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { listAttachments, type Attachment } from '@/lib/attachments';
import { useCreateNoteMutation, useUpdateNoteMutation } from '@/lib/mutations';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { space, type } from '@/theme/tokens';

export default function NoteEditorScreen() {
  const { eventId, attachmentId } = useLocalSearchParams<{
    id: string;
    eventId: string;
    attachmentId?: string;
  }>();
  const router = useRouter();
  const t = useThemeColors();

  const createNote = useCreateNoteMutation(eventId ?? '');
  const updateNote = useUpdateNoteMutation(eventId ?? '');

  // For edit: read from the cached attachments list so we get offline support too.
  const { data: attachments } = useQuery({
    queryKey: qk.attachments(eventId ?? ''),
    queryFn: () => listAttachments(eventId!),
    enabled: !!eventId && !!attachmentId,
  });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loaded, setLoaded] = useState(!attachmentId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!attachmentId || !attachments) return;
    const found = attachments.find((a) => a.id === attachmentId) as Attachment | undefined;
    if (found && found.kind === 'note') {
      setTitle(found.data.title);
      setBody(found.data.body);
    }
    setLoaded(true);
  }, [attachmentId, attachments]);

  async function handleSave() {
    if (!title.trim() && !body.trim()) {
      setError('Add a title or some text');
      return;
    }
    setError(null);
    const data = { title: title.trim(), body: body.trim() };
    const onError = (e: any) => setError(e.message ?? 'Failed to save');
    const onSuccess = () => router.back();
    if (attachmentId) {
      updateNote.mutate({ id: attachmentId, data }, { onSuccess, onError });
    } else {
      createNote.mutate(data, { onSuccess, onError });
    }
  }

  if (!loaded) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

  const saving = createNote.isPending || updateNote.isPending;

  return (
    <Screen scroll>
      <Text style={[type.title1, { color: t.ink }]}>
        {attachmentId ? 'Edit note' : 'New note'}
      </Text>
      <Input label="Title" value={title} onChangeText={setTitle} placeholder="Optional title" autoFocus />
      <Input
        label="Note"
        value={body}
        onChangeText={setBody}
        placeholder="Write your note…"
        multiline
        numberOfLines={8}
        style={{ minHeight: 180, textAlignVertical: 'top' }}
      />
      {error ? <Text style={[type.footnote, { color: t.danger }]}>{error}</Text> : null}
      <Button title="Save note" onPress={handleSave} loading={saving} style={{ marginTop: space.md }} />
    </Screen>
  );
}
