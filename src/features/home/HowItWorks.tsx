import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Handshake, MessageCircle, Search, ShieldCheck, Store, Truck } from 'lucide-react-native';
import { colors, font, radius } from '../../theme';

const HOW_IT_WORKS = [
  { icon: Search, title: 'Find it', text: 'Browse categories or search for exactly what you want, near you.' },
  { icon: MessageCircle, title: 'Chat or add to cart', text: 'Talk to sellers to negotiate, or buy store products in one click.' },
  { icon: Handshake, title: 'Get it', text: 'Meet the seller safely, or get store orders delivered to your door.' },
];

const TRUST_POINTS = [
  { icon: Store, title: 'Seller stores', text: 'Shop from sellers with their own store page and catalogue.' },
  { icon: Truck, title: 'Doorstep delivery', text: 'Store orders are delivered straight to your door.' },
  { icon: ShieldCheck, title: 'Safety first', text: 'Meet in public and inspect before you pay for listings.' },
];

export function HowItWorks() {
  return (
    <View style={{ marginTop: 28, paddingHorizontal: 6 }}>
      <Text style={styles.h2}>
        How <Text style={{ color: colors.gold500 }}>Bandookwale</Text> works
      </Text>
      {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
        <View key={title} style={styles.card}>
          <Text style={styles.bigNum}>{i + 1}</Text>
          <View style={styles.iconBox}>
            <Icon size={22} color={colors.onAccent} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{text}</Text>
        </View>
      ))}
      <View style={styles.grid}>
        {TRUST_POINTS.map(({ icon: Icon, title, text }) => (
          <View key={title} style={[styles.card, styles.gridCard]}>
            <View style={styles.iconBox}>
              <Icon size={20} color={colors.onAccent} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.text}>{text}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerBrand}>
          Bandook<Text style={{ color: colors.gold400 }}>Wale</Text>
        </Text>
        <Text style={styles.footerText}>
          India's trusted marketplace for licensed firearms, antiques & shooting accessories.
        </Text>
        <Text style={[styles.footerText, { marginTop: 10, fontSize: 10 }]}>
          Luthra Gun House Private Limited — All rights reserved © BandookWale
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: font.xxl, fontWeight: '800', textAlign: 'center', color: colors.gray900, marginBottom: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245,179,1,0.4)',
    padding: 18,
    marginBottom: 10,
    overflow: 'hidden',
  },
  bigNum: {
    position: 'absolute',
    right: 4,
    bottom: -30,
    fontSize: 110,
    fontWeight: '800',
    color: 'rgba(245,179,1,0.07)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.gold500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.white, fontSize: font.md, fontWeight: '700', marginTop: 12 },
  text: { color: colors.gray400, fontSize: font.sm, marginTop: 4, lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridCard: { width: '48%', flexGrow: 1, marginBottom: 0 },
  footer: { backgroundColor: colors.black, borderRadius: radius.lg, padding: 18, marginTop: 16 },
  footerBrand: { color: colors.white, fontSize: font.xl, fontWeight: '800' },
  footerText: { color: colors.gray400, fontSize: font.sm, marginTop: 6 },
});
