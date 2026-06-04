import { useHeaderHeight } from '@react-navigation/elements';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardFocusContext } from '@/lib/keyboardFocus';
import { useThemeColors } from '@/theme/ThemeContext';
import { space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  padded?: boolean;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
};

export function Screen({
  children,
  scroll,
  contentStyle,
  padded = true,
  edges,
}: Props) {
  const tokens = useThemeColors();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const containerRef = useRef<View>(null);

  // <Input> reports its wrapper view here on focus/blur. We don't use the
  // ref for measuring anymore — kept so the focused-state CSS treatment in
  // <Input> can render (bright border, lifted look). This also lets us
  // know whether to fade in the dim overlay.
  const focusedViewRef = useRef<View | null>(null);
  const setFocusedView = useCallback((v: View | null) => {
    focusedViewRef.current = v;
  }, []);

  // Track keyboard visibility for the dim overlay's mount + fade.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const dimOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      Animated.timing(dimOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(dimOpacity, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setKeyboardVisible(false));
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [dimOpacity]);

  const resolvedEdges = edges ?? [];
  const Inner = scroll ? ScrollView : View;

  const scrollOnly = scroll
    ? {
        automaticallyAdjustKeyboardInsets: Platform.OS === 'ios',
        contentInsetAdjustmentBehavior: 'automatic' as const,
        keyboardDismissMode: Platform.OS === 'ios' ? ('interactive' as const) : ('on-drag' as const),
      }
    : {};

  // Backdrop dim — strong enough to push the rest of the form into the
  // background, soft enough that the focused input (which the dim is also
  // technically over) still reads as bright and clear.
  const dimColor = tokens.name === 'dark' ? 'rgba(0,0,0,0.42)' : 'rgba(20,16,10,0.28)';

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: tokens.bg }]}
      edges={resolvedEdges}
    >
      <KeyboardFocusContext.Provider value={{ setFocusedView, containerRef }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={headerHeight}
        >
          <View ref={containerRef} collapsable={false} style={{ flex: 1 }}>
            {/*
              TouchableWithoutFeedback fires onPress only when no deeper
              component (TextInput, Button) claims the touch. So tapping an
              input focuses it, long-pressing an input opens the paste menu,
              tapping a button fires the button — but tapping empty form
              areas dismisses the keyboard. This is the standard RN
              tap-to-dismiss pattern that preserves native gestures.
            */}
            <TouchableWithoutFeedback
              onPress={keyboardVisible ? Keyboard.dismiss : undefined}
              accessible={false}
            >
              <View style={{ flex: 1 }}>
                <Inner
                  style={{ flex: 1 }}
                  contentContainerStyle={[
                    padded && { padding: space.lg, gap: space.md },
                    { paddingBottom: (padded ? space.lg : 0) + insets.bottom },
                    contentStyle,
                  ] as StyleProp<ViewStyle>}
                  keyboardShouldPersistTaps="handled"
                  {...scrollOnly}
                >
                  {children}
                </Inner>
              </View>
            </TouchableWithoutFeedback>

            {/*
              Dim overlay — purely visual. pointerEvents="none" lets taps,
              long-presses, and selection gestures pass straight through to
              the inputs and buttons underneath. The overlay above
              (TouchableWithoutFeedback) handles dismiss when you tap empty
              space.
            */}
            {keyboardVisible ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: dimColor, opacity: dimOpacity },
                ]}
              />
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </KeyboardFocusContext.Provider>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
