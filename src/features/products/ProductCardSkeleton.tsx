import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';

export function ProductCardSkeleton() {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      <View style={styles.image} />
      <View style={{ padding: 10, gap: 8 }}>
        <View style={[styles.line, { width: '50%', height: 16 }]} />
        <View style={[styles.line, { width: '90%' }]} />
        <View style={[styles.line, { width: '70%' }]} />
        <View style={[styles.line, { height: 30, marginTop: 4 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.gray200, overflow: 'hidden' },
  image: { aspectRatio: 1, backgroundColor: colors.gray200 },
  line: { height: 10, borderRadius: 5, backgroundColor: colors.gray200 },
});
