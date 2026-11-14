import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, Menu, MessageCircle, ShoppingCart, X } from 'lucide-react-native';
import type { Product } from '../../api/types';
import { SHOOTING_CATEGORIES, selectionIds, selectionLabel, type CategorySelection } from '../../data/shootingCategories';
import { WEAPON_CATEGORIES, WEAPON_TYPES } from '../../data/weaponCategories';
import { Sheet } from '../../components/ui/Sheet';
import { colors, font, radius } from '../../theme';

export type ShopMode = 'store' | 'listing';
export interface CategoryFilter {
  label: string;
  match: (p: Product) => boolean;
}

// Store products use the shop's category tree (categoryId / subcategoryId);
// Marketplace listings use the weapon taxonomy (licence category / type / sub type).
const storeFilter = (s: CategorySelection): CategoryFilter => {
  const ids = new Set(selectionIds(s));
  return {
    label: selectionLabel(s),
    match: (p) =>
      s.subcategory ? ids.has(p.subcategoryId ?? -1) : ids.has(p.categoryId ?? -1) || ids.has(p.subcategoryId ?? -1),
  };
};
const licenceFilter = (id: number, name: string): CategoryFilter => ({ label: name, match: (p) => p.weaponCategoryFkId === id });
const typeFilter = (id: number, name: string): CategoryFilter => ({ label: name, match: (p) => p.weaponTypeFkId === id });
const subTypeFilter = (typeName: string, id: number, name: string): CategoryFilter => ({
  label: `${typeName} › ${name}`,
  match: (p) => p.weaponSubTypeFkId === id,
});

const pillsFor = (mode: ShopMode): CategoryFilter[] =>
  mode === 'store'
    ? SHOOTING_CATEGORIES.map((g) => storeFilter({ group: g.name }))
    : [
        ...WEAPON_CATEGORIES.map((c) => licenceFilter(c.id, c.name)),
        ...WEAPON_TYPES.map((t) => typeFilter(t.id, t.name)),
      ];

export function CategoryBar({
  mode,
  selected,
  onSelect,
}: {
  mode: ShopMode;
  selected: CategoryFilter | null;
  onSelect: (f: CategoryFilter | null) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const accent = mode === 'store' ? colors.gold500 : colors.blue500;
  const onAccent = mode === 'store' ? colors.onAccent : colors.white;
  const pills = pillsFor(mode);
  const deepSelection = selected && !pills.some((p) => p.label === selected.label);

  const pick = (f: CategoryFilter | null) => {
    onSelect(f);
    setMenuOpen(false);
  };

  return (
    <View style={styles.bar}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={[styles.pill, (selected === null || menuOpen) && { backgroundColor: accent, borderColor: accent }]}
          accessibilityRole="button"
        >
          <Menu size={16} color={selected === null ? onAccent : colors.white} />
          <Text style={[styles.pillText, selected === null && { color: onAccent, fontWeight: '700' }]}>All Categories</Text>
          <ChevronDown size={14} color={selected === null ? onAccent : colors.gray500} />
        </Pressable>
        {deepSelection && (
          <Pressable onPress={() => onSelect(null)} style={[styles.pill, { backgroundColor: accent, borderColor: accent }]} accessibilityLabel="Clear category">
            <Text style={[styles.pillText, { color: onAccent, fontWeight: '700' }]}>{selected!.label}</Text>
            <X size={14} color={onAccent} />
          </Pressable>
        )}
        {pills.map((f) => {
          const active = selected?.label === f.label;
          return (
            <Pressable
              key={f.label}
              onPress={() => onSelect(active ? null : f)}
              style={[styles.pill, active && { backgroundColor: accent, borderColor: accent }]}
            >
              <Text style={[styles.pillText, active && { color: onAccent, fontWeight: '700' }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={mode === 'store' ? 'Store categories' : 'Marketplace categories'}>
        <Pressable onPress={() => pick(null)} style={styles.showAll}>
          {mode === 'store' ? <ShoppingCart size={16} color={accent} /> : <MessageCircle size={16} color={accent} />}
          <Text style={{ color: accent, fontWeight: '700' }}>Show all {mode === 'store' ? 'Store' : 'Marketplace'} items</Text>
        </Pressable>
        {mode === 'store' ? (
          SHOOTING_CATEGORIES.map((g) => (
            <View key={g.id} style={styles.group}>
              <MenuItem label={g.name.toUpperCase()} bold active={selected?.label === g.name} accent={accent} onPress={() => pick(storeFilter({ group: g.name }))} />
              {g.categories.map((c) => {
                const label = selectionLabel({ group: g.name, category: c.name });
                return (
                  <View key={c.id}>
                    <MenuItem label={c.name} active={selected?.label === label} accent={accent} bright={!!c.subcategories?.length} onPress={() => pick(storeFilter({ group: g.name, category: c.name }))} />
                    {c.subcategories?.length ? (
                      <View style={styles.subList}>
                        {c.subcategories.map((s) => {
                          const sel = { group: g.name, category: c.name, subcategory: s.name };
                          return (
                            <MenuItem key={s.id} label={s.name} small active={selected?.label === selectionLabel(sel)} accent={accent} onPress={() => pick(storeFilter(sel))} />
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))
        ) : (
          <>
            <View style={styles.group}>
              <Text style={styles.groupTitle}>LICENCE CATEGORY</Text>
              {WEAPON_CATEGORIES.map((c) => (
                <MenuItem key={c.id} label={c.name} active={selected?.label === c.name} accent={accent} onPress={() => pick(licenceFilter(c.id, c.name))} />
              ))}
            </View>
            {WEAPON_TYPES.map((t) => (
              <View key={t.id} style={styles.group}>
                <MenuItem label={t.name.toUpperCase()} bold active={selected?.label === t.name} accent={accent} onPress={() => pick(typeFilter(t.id, t.name))} />
                <View style={styles.subList}>
                  {t.subTypes.map((s) => (
                    <MenuItem
                      key={s.id}
                      label={s.name}
                      small
                      active={selected?.label === `${t.name} › ${s.name}`}
                      accent={accent}
                      onPress={() => pick(subTypeFilter(t.name, s.id, s.name))}
                    />
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </Sheet>
    </View>
  );
}

function MenuItem({
  label,
  onPress,
  active,
  accent,
  bold,
  small,
  bright,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  accent: string;
  bold?: boolean;
  small?: boolean;
  bright?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: small ? 7 : 9 }}>
      <Text
        style={{
          color: active ? accent : bold || bright ? colors.white : colors.gray600,
          fontWeight: active || bold ? '800' : '500',
          fontSize: small ? font.sm : font.md,
          letterSpacing: bold ? 0.5 : 0,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.navy, paddingTop: 4, paddingBottom: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  pillText: { color: colors.white, fontSize: font.md, fontWeight: '600' },
  showAll: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12 },
  group: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.gray200 },
  groupTitle: { color: colors.gray500, fontSize: font.xs, fontWeight: '800', letterSpacing: 0.8, paddingVertical: 6 },
  subList: { marginLeft: 6, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: colors.gray300 },
});
