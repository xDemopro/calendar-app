import { Feather } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ContextMenu, type ContextMenuAction } from '@/components/ContextMenu';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { useUser } from '@/lib/auth';
import type { Family } from '@/lib/database.types';
import { deleteFamily, leaveFamily, listMyFamilies } from '@/lib/queries';
import { qk } from '@/lib/queryKeys';
import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type } from '@/theme/tokens';

export default function FamiliesScreen() {
  const router = useRouter();
  const user = useUser();
  const t = useThemeColors();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: families, error } = useQuery({
    queryKey: qk.families(),
    queryFn: listMyFamilies,
  });

  function actionsFor(family: Family): { actions: ContextMenuAction[]; subtitle: string } {
    const isOwner = user?.id === family.created_by;
    const actions: ContextMenuAction[] = [
      {
        title: 'Invite',
        icon: 'share',
        onPress: () =>
          router.push({
            pathname: '/(app)/family/[id]/invite',
            params: { id: family.id },
          }),
      },
    ];
    if (isOwner) {
      actions.push({
        title: 'Edit',
        icon: 'edit-2',
        onPress: () =>
          router.push({ pathname: '/(app)/family/[id]/edit', params: { id: family.id } }),
      });
      actions.push({
        title: 'Delete family',
        icon: 'trash-2',
        destructive: true,
        onPress: () =>
          Alert.alert(
            `Delete "${family.name}"?`,
            'This will permanently delete the family, all members, and all events.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteFamily(family.id);
                    qc.invalidateQueries({ queryKey: qk.families() });
                  } catch (e: any) {
                    Alert.alert('Failed', e.message);
                  }
                },
              },
            ],
          ),
      });
    } else {
      actions.push({
        title: 'Leave family',
        icon: 'log-out',
        destructive: true,
        onPress: () =>
          Alert.alert(`Leave "${family.name}"?`, "You'll need a new invite code to rejoin.", [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                try {
                  if (!user) return;
                  await leaveFamily(family.id, user.id);
                  qc.invalidateQueries({ queryKey: qk.families() });
                } catch (e: any) {
                  Alert.alert('Failed', e.message);
                }
              },
            },
          ]),
      });
    }
    return { actions, subtitle: isOwner ? 'You own this family' : 'You are a member' };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top', 'bottom']}>
      {/* Large title header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Text style={{
          fontFamily: type.title1.fontFamily,
          fontSize: 32,
          fontWeight: '800',
          color: t.ink,
          letterSpacing: -0.6,
        }}>
          Families
        </Text>
        <Pressable hitSlop={10} style={{ paddingBottom: 4 }}>
          <Feather name="search" size={22} color={t.accent} />
        </Pressable>
      </View>

      {/* Primary actions */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Create"
            icon="plus"
            onPress={() => router.push('/(app)/new-family')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Join"
            icon="users"
            variant="secondary"
            onPress={() => router.push('/(app)/join-family')}
          />
        </View>
      </View>

      {families === undefined ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.accent} />
        </View>
      ) : (
        <FlatList
          data={families}
          keyExtractor={(f) => f.id}
          // flex:1 + contentContainerStyle.flexGrow:1 make the list fill the
          // viewport even when there are zero or few families, so the
          // RefreshControl works from anywhere below the top bar (not just on
          // top of an item).
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: space.xxl * 2, gap: 12, flexGrow: 1 }}
          alwaysBounceVertical
          refreshControl={
            <RefreshControl
              tintColor={t.accent}
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await qc.invalidateQueries({ queryKey: qk.families() });
                setRefreshing(false);
              }}
            />
          }
          ListHeaderComponent={
            error ? <Text style={[type.footnote, { color: t.danger, marginBottom: space.md }]}>{(error as Error).message}</Text> : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
              <Text style={[type.title2, { color: t.ink }]}>No families yet</Text>
              <Text style={[type.body, { color: t.fgMed, textAlign: 'center' }]}>
                Open the Settings tab to create one or join with an invite code.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const { actions, subtitle } = actionsFor(item);
            const isOwner = user?.id === item.created_by;
            return (
              <ContextMenu
                actions={actions}
                subtitle={subtitle}
                onPress={() =>
                  router.push({ pathname: '/(app)/family/[id]', params: { id: item.id } })
                }
              >
                <View
                  style={[
                    styles.card,
                    { backgroundColor: t.bgRaised, borderColor: t.border },
                  ]}
                >
                  <FamilyAvatar family={item} size={52} />
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: type.headline.fontFamily,
                        fontSize: 18,
                        fontWeight: '700',
                        color: t.ink,
                        letterSpacing: -0.2,
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text style={{
                      fontFamily: type.subhead.fontFamily,
                      fontSize: 13.5,
                      fontWeight: '600',
                      color: isOwner ? t.accent : t.fgMed,
                      marginTop: 2,
                    }}>
                      {isOwner ? 'Owner' : 'Member'}
                    </Text>
                    <Text style={[type.caption, { color: t.fgLow, marginTop: 1 }]}>
                      Long-press for more
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color={t.fgLow} />
                </View>
              </ContextMenu>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
