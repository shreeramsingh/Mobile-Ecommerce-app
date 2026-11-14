import React, { useMemo, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, Heart, MapPin, MessageCircle, Search, ShoppingCart, User, X } from 'lucide-react-native';
import { useAppDispatch, useAppSelector } from '../store';
import { selectCartCount } from '../store/slices/cartSlice';
import { selectUnreadTotal } from '../store/slices/chatSlice';
import { setSearchQuery as setSearchQueryAction, setSelectedCity as setSelectedCityAction } from '../store/slices/filtersSlice';
import { useWishlist } from '../features/wishlist/useWishlist';
import { INDIAN_CITIES } from '../data/indianCities';
import { Sheet } from './ui/Sheet';
import { colors, font, radius } from '../theme';

const LOGO = require('../assets/images/logo-white.png');

/** Marketplace header: logo, city, wishlist, cart, profile, then search. */
export function AppHeader({ showSearch = true }: { showSearch?: boolean }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const cartCount = useAppSelector(selectCartCount);
  const user = useAppSelector((s) => s.auth.user);
  const unreadChats = useAppSelector(selectUnreadTotal);
  const { favorites } = useWishlist();
  const searchQuery = useAppSelector((s) => s.filters.searchQuery);
  const selectedCity = useAppSelector((s) => s.filters.selectedCity);
  const setSearchQuery = (q: string) => dispatch(setSearchQueryAction(q));
  const setSelectedCity = (c: string) => dispatch(setSelectedCityAction(c));
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const avatar = user?.profileImageUrl || user?.imageUrl;

  const cities = useMemo(
    () => INDIAN_CITIES.filter((c) => c.toLowerCase().includes(citySearch.trim().toLowerCase())),
    [citySearch],
  );

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topRow}>
        <View style={styles.logoBox}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" accessibilityLabel="Bandookwale" />
        </View>

        <Pressable style={styles.cityBtn} onPress={() => setCityOpen(true)} accessibilityLabel="Choose city">
          <MapPin size={20} color={colors.blue500} />
          <Text style={styles.cityText} numberOfLines={1}>{selectedCity || 'India'}</Text>
          {selectedCity ? (
            <Pressable onPress={() => setSelectedCity('')} hitSlop={8} accessibilityLabel="Clear city">
              <X size={16} color={colors.gray500} />
            </Pressable>
          ) : (
            <ChevronDown size={18} color={colors.gray500} />
          )}
        </Pressable>

        <View style={{ flex: 1 }} />

        <IconWithBadge count={favorites.length} label="Wishlist" onPress={() => navigation.navigate('UserTabs', { screen: 'Wishlist' })}>
          <Heart size={26} color={colors.white} strokeWidth={2.2} />
        </IconWithBadge>
        {user ? (
          <IconWithBadge count={unreadChats} label="Chats" onPress={() => navigation.navigate('UserTabs', { screen: 'Chats' })}>
            <MessageCircle size={25} color={colors.white} strokeWidth={2.2} />
          </IconWithBadge>
        ) : null}
        <IconWithBadge count={cartCount} label="Cart" onPress={() => navigation.navigate('Cart')}>
          <ShoppingCart size={26} color={colors.white} strokeWidth={2.2} />
        </IconWithBadge>

        <Pressable
          onPress={() => (user ? navigation.navigate('UserTabs', { screen: 'Account' }) : navigation.navigate('SignIn'))}
          accessibilityLabel={user ? 'Account' : 'Sign in'}
          style={styles.avatarWrap}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <User size={20} color={colors.gray500} />
            </View>
          )}
        </Pressable>
      </View>

      {showSearch && (
        <View style={styles.searchBox}>
          <Search size={20} color={colors.gray500} style={{ marginLeft: 14 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search products..."
            placeholderTextColor={colors.gray500}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={{ paddingHorizontal: 8 }} accessibilityLabel="Clear search">
              <X size={18} color={colors.gray500} />
            </Pressable>
          ) : null}
          <View style={styles.searchBtn}>
            <Search size={20} color={colors.onAccent} strokeWidth={2.6} />
          </View>
        </View>
      )}

      <Sheet visible={cityOpen} onClose={() => { setCityOpen(false); setCitySearch(''); }} title="Choose city" scroll={false}>
        <TextInput
          value={citySearch}
          onChangeText={setCitySearch}
          placeholder="Search city..."
          placeholderTextColor={colors.gray400}
          style={styles.citySearch}
          autoCorrect={false}
        />
        <FlatList
          data={cities}
          keyExtractor={(c) => c}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 440 }}
          ListEmptyComponent={<Text style={{ padding: 20, textAlign: 'center', color: colors.gray400 }}>No cities found</Text>}
          renderItem={({ item }) => {
            const active = (item === 'All India' && !selectedCity) || item === selectedCity;
            return (
              <Pressable
                onPress={() => {
                  setSelectedCity(item);
                  setCityOpen(false);
                  setCitySearch('');
                }}
                style={[styles.cityRow, active && { backgroundColor: 'rgba(245,179,1,0.1)' }]}
              >
                <MapPin size={14} color={active ? colors.gold500 : colors.gray400} />
                <Text style={[styles.cityRowText, active && { color: colors.gold600, fontWeight: '700' }]}>{item}</Text>
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}

function IconWithBadge({ children, count, label, onPress }: { children: React.ReactNode; count: number; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={`${label}, ${count} items`} style={{ padding: 4 }}>
      {children}
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.navy, paddingHorizontal: 14, paddingBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: '84%', height: '84%' },
  cityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    height: 44,
    maxWidth: 150,
  },
  cityText: { flexShrink: 1, fontSize: font.md, fontWeight: '600', color: colors.white },
  badge: {
    position: 'absolute',
    top: -3,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: colors.red500,
    borderWidth: 2,
    borderColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  avatarWrap: { borderRadius: 22, borderWidth: 2, borderColor: colors.gray300 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    height: 50,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, paddingHorizontal: 10, fontSize: font.md, color: colors.white, height: 50 },
  searchBtn: {
    backgroundColor: colors.gold500,
    height: 50,
    width: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  citySearch: {
    margin: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 44,
    color: colors.white,
    backgroundColor: colors.surfaceAlt,
  },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 13 },
  cityRowText: { fontSize: font.md, color: colors.gray700 },
});
