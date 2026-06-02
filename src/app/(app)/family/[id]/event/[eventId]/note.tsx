import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text } from 'react-native';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { createNote, listAttachments, updateNote, type Attachment } from '@/lib/attachments';
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

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(!!attachmentId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!attachmentId || !eventId) return;
    (async () => {
      try {
        const items = await listAttachments(eventId);
        const found = items.find((a) => a.id === attachmentId) as Attachment | undefined;
        if (!alive || !found || found.kind !== 'note') return;
        setTitle(found.data.title);
        setBody(found.data.body);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [attachmentId, eventId]);

  async function handleSave() {
    if (!title.trim() && !body.trim()) {
      setError('Add a title or some text');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (attachmentId) {
        await updateNote(attachmentId, { title: title.trim(), body: body.trim() });
      } else {
        await createNote(eventId!, { title: title.trim(), body: body.trim() });
      }
      router.back();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }

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
