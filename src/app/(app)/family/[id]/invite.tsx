import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { Screen } from '@/components/Screen';
import type { Family } from '@/lib/database.types';
import { getFamily } from '@/lib/queries';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

const INVITE_BASE = 'https://familycal.app/join';

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useThemeColors();
  const [family, setFamily] = useState<Family | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!id) return;
    (async () => {
      try {
        const f = await getFamily(id);
        if (alive) setFamily(f);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator color={t.accent} />
      </Screen>
    );
  }
  if (!family) {
    return (
      <Screen>
        <Text style={[type.body, { color: t.ink }]}>Family not found.</Text>
      </Screen>
    );
  }

  const link = `${INVITE_BASE}/${family.invite_code}`;

  async function copy(text: string, which: 'code' | 'link') {
    await Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (which === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1600);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 1600);
    }
  }

  async function handleShare() {
    try {
      await Share.share({
        message: `Join "${family!.name}" on FamilyCal.\n\nCode: ${family!.invite_code}\nLink: ${link}`,
      });
    } catch {}
  }

  return (
    <Screen scroll>
      {/* Header cluster */}
      <View style={{ alignItems: 'center', gap: 10, marginTop: space.md, marginBottom: space.lg }}>
        <FamilyAvatar family={family} size={64} />
        <Text style={[type.title2, { color: t.ink, textAlign: 'center' }]}>{family.name}</Text>
        <Text style={[type.callout, { color: t.fgMed, textAlign: 'center', maxWidth: 320 }]}>
          Share the code or the link below. Anyone with either can join your family
          and see this calendar.
        </Text>
      </View>

      {/* Invite code */}
      <SectionLabel>Invite code</SectionLabel>
      <Pressable
        onPress={() => copy(family.invite_code, 'code')}
        style={({ pressed }) => [
          styles.codeBox,
          {
            backgroundColor: t.bgRaised,
            borderColor: copiedCode ? t.success : t.border,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text
          style={{
            fontFamily: type.display.fontFamily,
            fontSize: 30,
            fontWeight: '800',
            letterSpacing: 6,
            color: t.ink,
            textAlign: 'center',
            includeFontPadding: false,
          }}
        >
          {family.invite_code}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <Feather
            name={copiedCode ? 'check' : 'copy'}
            size={14}
            color={copiedCode ? t.success : t.fgMed}
          />
          <Text style={[type.caption, { color: copiedCode ? t.success : t.fgMed }]}>
            {copiedCode ? 'Copied' : 'Tap to copy'}
          </Text>
        </View>
      </Pressable>

      {/* Invite link */}
      <SectionLabel style={{ marginTop: space.lg }}>Invite link</SectionLabel>
      <View
        style={[
          styles.linkBox,
          { backgroundColor: t.bgRaised, borderColor: copiedLink ? t.success : t.border },
        ]}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[type.body, { color: t.ink, flex: 1 }]}
        >
          {link}
        </Text>
        <Pressable
          onPress={() => copy(link, 'link')}
          hitSlop={10}
          style={({ pressed }) => [
            styles.copyChip,
            { backgroundColor: copiedLink ? t.success : t.accent },
            pressed && { opacity: 0.85 },
          ]}
        >
          <Feather name={copiedLink ? 'check' : 'copy'} size={14} color={t.onAccent} />
          <Text
            style={{
              color: t.onAccent,
              fontFamily: type.subhead.fontFamily,
              fontWeight: '700',
              fontSize: 13,
              letterSpacing: 0.2,
            }}
          >
            {copiedLink ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
      <Text style={[type.footnote, { color: t.fgLow, marginTop: 6, paddingHorizontal: 4 }]}>
        Anyone you trust with this link can join. They'll need to sign in or create an
        account on FamilyCal first.
      </Text>

      {/* Share via OS */}
      <View style={{ marginTop: space.xl, gap: space.md }}>
        <Button title="Share invite…" icon="share" onPress={handleShare} />
        <Button title="Done" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: any }) {
  const t = useThemeColors();
  return (
    <Text
      style={[
        {
          fontFamily: type.caption.fontFamily,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: t.fgLow,
          paddingHorizontal: 4,
          paddingBottom: 8,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.md,
    alignItems: 'center',
  },
  linkBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingLeft: space.md,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  copyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
});
