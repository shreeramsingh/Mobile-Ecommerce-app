import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Handshake, ShieldPlus, Store } from 'lucide-react-native';
import { colors, font, radius } from '../../theme';

/** A slide is a store product (remote photo + name + price) or a static fallback photo. */
export interface HeroSlide {
  image: string | number;
  title?: string;
  subtitle?: string;
  onOpen?: () => void;
}

// Shown until store products load (outdoor shots that suit the dark card).
export const FALLBACK_SLIDES: HeroSlide[] = [
  { image: require('../../assets/hero/scroll_6.jpg') },
  { image: require('../../assets/hero/scroll_1.jpg') },
  { image: require('../../assets/hero/scroll_7.jpg') },
];
const AUTOPLAY_MS = 3500;
const MAX_DOTS = 10;
// Opacity of each 5%-wide strip over the photo's left edge (a stepped gradient).
const FADE_STEPS = [0.95, 0.88, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];

export function HeroCarousel({
  slides,
  onShopStore,
  onMarketplace,
}: {
  slides: HeroSlide[];
  onShopStore: () => void;
  onMarketplace: () => void;
}) {
  const list = slides.length ? slides : FALLBACK_SLIDES;
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const count = list.length;

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % count);
        Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [fade, count]);

  const slide = list[Math.min(index, count - 1)];
  const isProduct = typeof slide.image === 'string';

  return (
    <View style={{ marginHorizontal: 12, marginTop: 6 }}>
      <View style={styles.card}>
        {isProduct ? (
          // Product photo in a white frame with caption (product shots have white backgrounds).
          <View style={styles.productArt} pointerEvents="box-none">
            <View style={styles.slash} pointerEvents="none" />
            <Animated.View style={[styles.frame, { opacity: fade }]}>
              <Pressable onPress={slide.onOpen} style={{ flex: 1 }} accessibilityLabel={`Open ${slide.title ?? 'product'}`}>
                <Image source={{ uri: slide.image as string }} style={styles.frameImage} resizeMode="contain" />
                <View style={styles.caption}>
                  <Text style={styles.captionTitle} numberOfLines={1}>{slide.title}</Text>
                  <View style={styles.captionRow}>
                    <Text style={styles.captionPrice}>{slide.subtitle}</Text>
                    {slide.onOpen ? <Text style={styles.captionView}>View →</Text> : null}
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.art} pointerEvents="none">
            <Animated.Image source={slide.image as number} style={[styles.photo, { opacity: fade }]} resizeMode="cover" />
            <View style={[styles.shade, { left: 0, right: 0, opacity: 0.35 }]} />
            {FADE_STEPS.map((o, i) => (
              <View key={i} style={[styles.shade, { left: `${i * 5}%`, width: '5%', opacity: o }]} />
            ))}
            <View style={styles.slash} />
          </View>
        )}

        <View style={[styles.content, isProduct && { paddingRight: '50%' }]} pointerEvents="box-none">
          <View style={styles.kicker}>
            <ShieldPlus size={18} color={colors.gold500} />
            <Text style={[styles.kickerText, isProduct && { fontSize: 11 }]} numberOfLines={2}>BANDOOKWALE MARKETPLACE</Text>
          </View>
          <Text style={[styles.h1, isProduct && { fontSize: 26, lineHeight: 31, maxWidth: '100%' }]}>
            Buy, sell &{'\n'}collect — <Text style={{ color: colors.gold500 }}>all in{'\n'}one place</Text>
          </Text>
          <Text style={[styles.sub, isProduct && { maxWidth: '100%' }]}>
            Shop store products or chat directly with sellers near you to get the best deal.
          </Text>
          <View style={styles.ctaRow}>
            <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={onShopStore} accessibilityRole="button">
              <Store size={17} color={colors.onAccent} />
              <Text style={[styles.ctaText, { color: colors.onAccent }]}>Shop the store</Text>
            </Pressable>
            <Pressable style={[styles.cta, styles.ctaGhost]} onPress={onMarketplace} accessibilityRole="button">
              <Handshake size={17} color={colors.white} />
              <Text style={styles.ctaText}>Marketplace</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {count > 1 &&
        (count <= MAX_DOTS ? (
          <View style={styles.dots}>
            {list.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        ) : (
          <Text style={styles.counter}>
            {index + 1} / {count}
          </Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
    minHeight: 300,
  },
  art: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '62%' },
  productArt: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', justifyContent: 'center', paddingRight: 12 },
  slash: {
    position: 'absolute',
    top: -60,
    bottom: -60,
    right: -95,
    width: 140,
    backgroundColor: colors.gold500,
    transform: [{ rotate: '18deg' }],
  },
  frame: {
    height: 220,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  frameImage: { flex: 1, margin: 8 },
  caption: { backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 10, paddingVertical: 7 },
  captionTitle: { color: colors.white, fontWeight: '700', fontSize: font.sm },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  captionPrice: { color: colors.gold400, fontWeight: '800', fontSize: font.sm },
  captionView: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },
  photo: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' },
  shade: { position: 'absolute', top: 0, bottom: 0, backgroundColor: colors.surface },
  content: { padding: 20, paddingRight: 16 },
  kicker: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  kickerText: { color: colors.gold500, fontSize: 12, fontWeight: '800', letterSpacing: 0.6, flexShrink: 1 },
  h1: { color: colors.white, fontSize: 32, fontWeight: '900', marginTop: 14, lineHeight: 37, maxWidth: '72%' },
  sub: { color: colors.gray600, fontSize: font.sm, marginTop: 10, lineHeight: 19, maxWidth: '70%' },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 18, flexWrap: 'wrap' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 46, borderRadius: radius.pill },
  ctaPrimary: {
    backgroundColor: colors.gold500,
    shadowColor: colors.gold500,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ctaGhost: { backgroundColor: 'rgba(11,16,32,0.7)', borderWidth: 1.5, borderColor: colors.white },
  ctaText: { color: colors.white, fontWeight: '700', fontSize: font.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gray300 },
  dotActive: { width: 20, backgroundColor: colors.gold500 },
  counter: { textAlign: 'center', color: colors.gray500, fontSize: font.xs, marginTop: 10 },
});
