import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from './Button';
import { ContextMenu, type ContextMenuAction } from './ContextMenu';
import {
  addFileFromDocuments,
  addPictureFromLibrary,
  createSignedUrl,
  deleteAttachment,
  listAttachments,
  type Attachment,
} from '@/lib/attachments';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

export function AttachmentsSection({ familyId, eventId }: { familyId: string; eventId: string }) {
  const router = useRouter();
  const t = useThemeColors();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: attachments = [], isLoading: loading } = useQuery({
    queryKey: qk.attachments(eventId),
    queryFn: () => listAttachments(eventId),
  });
  // unused but reserved for future use
  void familyId;

  function refresh() {
    qc.invalidateQueries({ queryKey: qk.attachments(eventId) });
  }

  function handleAdd() {
    Alert.alert('Add to event', undefined, [
      {
        text: 'Note',
        onPress: () =>
          router.push({
            pathname: '/(app)/family/[id]/event/[eventId]/note',
            params: { id: familyId, eventId },
          }),
      },
      {
        text: 'Picture',
        onPress: async () => {
          setBusy(true);
          try {
            const att = await addPictureFromLibrary(eventId);
            if (att) refresh();
          } catch (e: any) {
            Alert.alert('Upload failed', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
      {
        text: 'File',
        onPress: async () => {
          setBusy(true);
          try {
            const att = await addFileFromDocuments(eventId);
            if (att) refresh();
          } catch (e: any) {
            Alert.alert('Upload failed', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function actionsFor(att: Attachment): ContextMenuAction[] {
    const actions: ContextMenuAction[] = [];
    if (att.kind === 'note') {
      actions.push({
        title: 'Edit',
        icon: 'edit-2',
        onPress: () =>
          router.push({
            pathname: '/(app)/family/[id]/event/[eventId]/note',
            params: { id: familyId, eventId, attachmentId: att.id },
          }),
      });
    }
    actions.push({
      title: 'Delete',
      icon: 'trash-2',
      destructive: true,
      onPress: () =>
        Alert.alert('Delete this?', undefined, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteAttachment(att);
                refresh();
              } catch (e: any) {
                Alert.alert('Failed', e.message);
              }
            },
          },
        ]),
    });
    return actions;
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={[type.title3, { color: t.ink }]}>Attachments</Text>
        {busy || loading ? <ActivityIndicator color={t.accent} /> : null}
      </View>

      {!loading && attachments.length === 0 ? (
        <Text style={[type.footnote, { color: t.fgLow }]}>No attachments yet.</Text>
      ) : null}

      {attachments.map((att) => (
        <ContextMenu
          key={att.id}
          actions={actionsFor(att)}
          subtitle={kindLabel(att)}
          onPress={() => handleTap(att)}
        >
          <AttachmentCard attachment={att} />
        </ContextMenu>
      ))}

      <Button title="+ Add component" variant="secondary" onPress={handleAdd} />
    </View>
  );
}

function kindLabel(att: Attachment): string {
  if (att.kind === 'note') return 'Note';
  if (att.kind === 'picture') return 'Picture';
  return 'File';
}

async function handleTap(att: Attachment) {
  if (att.kind === 'picture' || att.kind === 'file') {
    try {
      const url = await createSignedUrl((att.data as any).path);
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Could not open', e.message);
    }
  }
}

function AttachmentCard({ attachment }: { attachment: Attachment }) {
  const t = useThemeColors();
  if (attachment.kind === 'note') {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: t.bgRaised, borderColor: t.border },
        ]}
      >
        {attachment.data.title ? (
          <Text style={[type.headline, { color: t.ink }]}>{attachment.data.title}</Text>
        ) : null}
        {attachment.data.body ? (
          <Text style={[type.body, { color: t.fgMed }]} numberOfLines={6}>
            {attachment.data.body}
          </Text>
        ) : null}
      </View>
    );
  }
  if (attachment.kind === 'picture') {
    return <PictureCard attachment={attachment} />;
  }
  return (
    <View
      style={[
        styles.fileCard,
        { backgroundColor: t.bgRaised, borderColor: t.border },
      ]}
    >
      <Text style={{ fontSize: 26 }}>📄</Text>
      <View style={{ flex: 1 }}>
        <Text style={[type.headline, { color: t.ink }]} numberOfLines={1}>
          {attachment.data.name}
        </Text>
        <Text style={[type.footnote, { color: t.fgLow }]}>
          {attachment.data.mime_type}
          {attachment.data.size_bytes ? ` · ${formatBytes(attachment.data.size_bytes)}` : ''}
        </Text>
      </View>
    </View>
  );
}

function PictureCard({ attachment }: { attachment: Extract<Attachment, { kind: 'picture' }> }) {
  const t = useThemeColors();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    createSignedUrl(attachment.data.path, 60 * 60).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [attachment.data.path]);
  const aspect =
    attachment.data.width && attachment.data.height
      ? attachment.data.width / attachment.data.height
      : 16 / 9;
  return (
    <View style={[styles.pictureCard, { backgroundColor: t.bgRaised, borderColor: t.border }]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', aspectRatio: aspect }} resizeMode="cover" />
      ) : (
        <View style={{ width: '100%', aspectRatio: aspect, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} />
        </View>
      )}
    </View>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    gap: 4,
  },
  fileCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space.md,
    gap: space.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pictureCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
