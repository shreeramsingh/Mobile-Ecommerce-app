import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Product } from '../api/types';
import { effectivePrice, hasSale } from '../api/products';
import { colors } from '../theme';

const inr = (n: number) => `₹ ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

/** Price with an optional sale: sale price, struck-through list price and a "% OFF" chip. */
export function PriceTag({ item, size = 'md' }: { item: Product; size?: 'md' | 'lg' }) {
  const big = size === 'lg';
  const priceStyle = [styles.price, { fontSize: big ? 30 : 18 }];
  if (!hasSale(item)) {
    return <Text style={priceStyle} numberOfLines={1}>{inr(item.price)}</Text>;
  }
  return (
    <View>
      <Text style={priceStyle} numberOfLines={1}>{inr(effectivePrice(item))}</Text>
      <View style={styles.row}>
        <Text style={[styles.was, { fontSize: big ? 14 : 11 }]}>{inr(item.price)}</Text>
        {item.discountLabel ? (
          <View style={styles.chip}>
            <Text style={[styles.chipText, { fontSize: big ? 12 : 10 }]}>{item.discountLabel}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  price: { fontWeight: '800', color: colors.gold500 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 },
  was: { color: colors.gray400, textDecorationLine: 'line-through' },
  chip: { backgroundColor: 'rgba(34,197,94,0.18)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 },
  chipText: { color: colors.green700, fontWeight: '700' },
});
