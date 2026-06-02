import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { type ReactNode, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useThemeColors } from '@/theme/ThemeContext';
import { radius, space, type, motion } from '@/theme/tokens';

export type ContextMenuAction = {
  title: string;
  icon?: keyof typeof Feather.glyphMap;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  children: ReactNode;
  actions: ContextMenuAction[];
  subtitle?: string;
  style?: ViewStyle;
  onPress?: () => void;
};

type Rect = { x: number; y: number; w: number; h: number };

const SCREEN = Dimensions.get('window');
const MENU_WIDTH = 244;
const MENU_GAP = 12;
const EDGE_PADDING = 16;

export function ContextMenu({ children, actions, subtitle, style, onPress }: Props) {
  const t = useThemeColors();
  const sourceRef = useRef<View>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const scale = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);
  const menuTranslate = useSharedValue(8);
  const menuOpacity = useSharedValue(0);

  function open() {
    sourceRef.current?.measureInWindow((x, y, w, h) => {
      setRect({ x, y, w, h });
      requestAnimationFrame(() => {
        scale.value = withSpring(1.04, motion.contextSpring);
        overlayOpacity.value = withTiming(1, { duration: motion.fade });
        menuOpacity.value = withTiming(1, { duration: motion.fade });
        menuTranslate.value = withSpring(0, motion.contextSpring);
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    });
  }

  function close() {
    scale.value = withTiming(1, { duration: motion.tap });
    overlayOpacity.value = withTiming(0, { duration: motion.tap });
    menuOpacity.value = withTiming(0, { duration: motion.tap });
    menuTranslate.value = withTiming(8, { duration: motion.tap });
    setTimeout(() => setRect(null), 140);
  }

  const focusedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: menuOpacity.value,
    transform: [{ translateY: menuTranslate.value }],
  }));

  let menuTop: number | null = null;
  let menuBottom: number | null = null;
  if (rect) {
    const spaceBelow = SCREEN.height - (rect.y + rect.h);
    const spaceAbove = rect.y;
    if (spaceBelow >= spaceAbove) {
      menuTop = rect.y + rect.h + MENU_GAP;
    } else {
      menuBottom = SCREEN.height - rect.y + MENU_GAP;
    }
  }

  return (
    <>
      <Pressable
        ref={sourceRef}
        onPress={onPress}
        onLongPress={open}
        delayLongPress={280}
        style={style}
      >
        {children}
      </Pressable>

      <Modal visible={!!rect} transparent statusBarTranslucent onRequestClose={close} animationType="none">
        {rect ? (
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
              <BlurView intensity={32} tint={t.name === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: t.sheet }]} />
              <Pressable style={StyleSheet.absoluteFill} onPress={close} />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                },
                focusedStyle,
              ]}
            >
              {children}
            </Animated.View>

            <Animated.View
              style={[
                styles.menu,
                {
                  backgroundColor: t.bgRaised,
                  borderColor: t.border,
                  left: Math.min(
                    Math.max(rect.x, EDGE_PADDING),
                    SCREEN.width - MENU_WIDTH - EDGE_PADDING,
                  ),
                  width: MENU_WIDTH,
                  ...(menuTop !== null ? { top: menuTop } : {}),
                  ...(menuBottom !== null ? { bottom: menuBottom } : {}),
                  shadowColor: '#000',
                  shadowOpacity: t.name === 'dark' ? 0.55 : 0.18,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 12 },
                },
                menuStyle,
              ]}
            >
              {subtitle ? (
                <View style={[styles.subtitle, { borderBottomColor: t.border }]}>
                  <Text style={[type.caption, { color: t.fgLow }]} numberOfLines={1}>
                    {subtitle.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {actions.map((action, i) => (
                <Pressable
                  key={i}
                  onPress={() => {
                    close();
                    setTimeout(() => action.onPress(), 120);
                  }}
                  style={({ pressed }) => [
                    styles.action,
                    i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                    pressed && { backgroundColor: t.accentSoft },
                  ]}
                >
                  {action.icon ? (
                    <Feather
                      name={action.icon}
                      size={18}
                      color={action.destructive ? t.danger : t.ink}
                    />
                  ) : null}
                  <Text style={[type.headline, { color: action.destructive ? t.danger : t.ink }]}>
                    {action.title}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    elevation: 16,
  },
  subtitle: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  action: {
    paddingHorizontal: space.md,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
