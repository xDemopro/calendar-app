// Shared state for the TikTok/IG-style keyboard overlay in Screen.tsx.
//
// When a TextInput inside <Screen> focuses, it reports its on-screen rect to
// this context. Screen renders a dim overlay made of four <Pressable> rects
// surrounding that area, leaving a transparent "hole" where the focused
// input is. Tap any overlay piece → keyboard.dismiss.
//
// Each <Input> wires itself up via the useKeyboardFocus() hook below.

import React, { createContext, useContext } from 'react';
import type { View } from 'react-native';

export type FocusRect = { x: number; y: number; width: number; height: number };

type Ctx = {
  setFocusedView: (v: View | null) => void;
  // The Screen-level ref the Input measures against. measureLayout(ref, ...)
  // gives coords relative to that ref, matching the absolute positioning of
  // the overlay pieces.
  containerRef: React.RefObject<View | null> | null;
};

export const KeyboardFocusContext = createContext<Ctx>({
  setFocusedView: () => {},
  containerRef: null,
});

export function useKeyboardFocus() {
  return useContext(KeyboardFocusContext);
}
