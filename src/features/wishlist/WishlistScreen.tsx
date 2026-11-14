import React from 'react';
import { View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { useQueries } from '@tanstack/react-query';
import { Heart } from 'lucide-react-native';
import { productsApi } from '../../api/products';
import type { Product } from '../../api/types';
import { useWishlist } from './useWishlist';
import { useAppSelector } from '../../store';
import { productKeys } from '../products/queries';
import { ProductCard } from '../products/ProductCard';
import { AppText, Button, EmptyState, Loader } from '../../components/ui';
import { colors } from '../../theme';

/**
 * Loads each favourited product by id (the website filtered the first 50 products,
 * so favourites beyond those never showed up).
 */
export function WishlistScreen() {
  const navigation = useNavigation();
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');
  const { favorites, isReady, refetch } = useWishlist();

  const results = useQueries({
    queries: favorites
      .filter((f) => f.favoritesPkId > 0)
      .map((f) => ({
        queryKey: productKeys.detail(f.productFkId),
        queryFn: () => productsApi.byId(f.productFkId),
        staleTime: 5 * 60_000,
      })),
  });
  const products = results.map((r) => r.data).filter((p): p is Product => !!p);
  const loading = !isReady || results.some((r) => r.isLoading);

  if (!signedIn) {
    return (
      <EmptyState
        icon={Heart}
        title="Your wishlist"
        message="Sign in to save items you like."
        action={<Button title="Sign In" onPress={() => navigation.navigate('SignIn')} />}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.gray100 }}>
      <FlashList
        data={products}
        numColumns={2}
        keyExtractor={(p) => String(p.id)}
        onRefresh={() => refetch()}
        refreshing={false}
        contentContainerStyle={{ padding: 6 }}
        ListHeaderComponent={
          <AppText variant="heading" style={{ padding: 6 }}>
            Wishlist ({loading ? '...' : products.length})
          </AppText>
        }
        ListEmptyComponent={
          loading ? (
            <Loader label="Loading wishlist..." />
          ) : (
            <EmptyState
              icon={Heart}
              title="Your wishlist is empty"
              message="Tap the heart on any product to save it here."
              action={<Button title="Browse products" variant="ghost" onPress={() => navigation.navigate('UserTabs', { screen: 'Home' })} />}
            />
          )
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: 5 }}>
            <ProductCard item={item} />
          </View>
        )}
      />
    </View>
  );
}
