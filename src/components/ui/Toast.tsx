import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radius } from '../../theme';

type Kind = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  text: string;
  kind: Kind;
}

let listener: ((m: ToastMsg) => void) | null = null;
let seq = 0;

/** Fire-and-forget toast callable from anywhere (hooks, API callbacks, screens). */
export const toast = {
  show(text: string, kind: Kind = 'success') {
    listener?.({ id: ++seq, text, kind });
  },
};

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    listener = setMsg;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
        setMsg((m) => (m?.id === msg.id ? null : m)),
      );
    }, 2600);
    return () => clearTimeout(t);
  }, [msg, opacity]);

  if (!msg) return null;
  const bg = msg.kind === 'error' ? colors.red600 : msg.kind === 'info' ? colors.gray800 : colors.green600;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + 80, opacity, backgroundColor: bg }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>{msg.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: colors.white, fontSize: font.sm, fontWeight: '600', textAlign: 'center' },
});
