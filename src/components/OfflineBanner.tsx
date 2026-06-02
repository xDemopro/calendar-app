import { Feather } from '@expo/vector-icons';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { subscribeOutbox } from '@/lib/outbox';
import { useThemeColors } from '@/theme/ThemeContext';
import { type } from '@/theme/tokens';

export function OfflineBanner() {
  const t = useThemeColors();
  const [online, setOnline] = useState(onlineManager.isOnline());
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const unsubOnline = onlineManager.subscribe(setOnline);
    const unsubOutbox = subscribeOutbox((s) => setPending(s.items.length));
    return () => {
      unsubOnline();
      unsubOutbox();
    };
  }, []);

  // Show when offline, or while pending writes are draining.
  if (online && pending === 0) return null;

  const label = !online
    ? pending > 0
      ? `Offline · ${pending} ${pending === 1 ? 'change' : 'changes'} queued`
      : 'Offline'
    : `Syncing ${pending} ${pending === 1 ? 'change' : 'changes'}…`;

  const bg = !online ? t.warning : t.accent;
  const fg = !online ? '#1F1606' : t.onAccent;

  return (
    <View style={[styles.banner, { backgroundColor: bg }]} pointerEvents="none">
      <Feather name={online ? 'upload-cloud' : 'cloud-off'} size={13} color={fg} />
      <Text style={[type.caption, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
