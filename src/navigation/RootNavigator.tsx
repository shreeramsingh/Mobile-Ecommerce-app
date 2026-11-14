import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Heart, Home, LayoutDashboard, CheckCircle2, MessageCircle, MoreHorizontal, Plus, Store, User } from 'lucide-react-native';
import type { AdminTabParamList, RootStackParamList, UserTabParamList } from './types';
import { useAppSelector } from '../store';
import { selectUnreadTotal } from '../store/slices/chatSlice';
import { toast } from '../components/ui/Toast';
import { colors } from '../theme';

import { HomeScreen } from '../features/home/HomeScreen';
import { ProductDetailsScreen } from '../features/products/ProductDetailsScreen';
import { WishlistScreen } from '../features/wishlist/WishlistScreen';
import { ChatsListScreen } from '../features/chat/ChatsListScreen';
import { ChatScreen } from '../features/chat/ChatScreen';
import { AccountScreen } from '../features/account/AccountScreen';
import { ProfileScreen } from '../features/account/ProfileScreen';
import { SupportScreen } from '../features/account/SupportScreen';
import { SignInScreen } from '../features/auth/SignInScreen';
import { SignUpScreen } from '../features/auth/SignUpScreen';
import { CartScreen } from '../features/checkout/CartScreen';
import { OrdersScreen } from '../features/orders/OrdersScreen';
import { TrackScreen } from '../features/orders/TrackScreen';
import { PaymentsScreen } from '../features/payments/PaymentsScreen';
import { SellProductScreen } from '../features/sell/SellProductScreen';
import { StoreScreen } from '../features/store/StoreScreen';
import { StoreProductFormScreen } from '../features/store/StoreProductFormScreen';
import { AdminDashboardScreen } from '../features/admin/AdminDashboardScreen';
import { AdminUsersScreen } from '../features/admin/AdminUsersScreen';
import { AdminSubscriptionScreen } from '../features/admin/AdminSubscriptionScreen';
import { AdminListingsScreen } from '../features/admin/AdminListingsScreen';
import { AdminPaymentsScreen } from '../features/admin/AdminPaymentsScreen';
import { AdminPaymentMethodsScreen } from '../features/admin/AdminPaymentMethodsScreen';
import { AdminShipmentsScreen } from '../features/admin/AdminShipmentsScreen';
import { AdminMoreScreen } from '../features/admin/AdminMoreScreen';
import { AdminDiscountsScreen } from '../features/admin/promo/AdminDiscountsScreen';
import { AdminVouchersScreen } from '../features/admin/promo/AdminVouchersScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const UserTab = createBottomTabNavigator<UserTabParamList>();
const AdminTab = createBottomTabNavigator<AdminTabParamList>();

const darkHeader = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '700' as const },
  headerBackButtonDisplayMode: 'minimal' as const,
};

const tabBar = {
  tabBarActiveTintColor: colors.gold500,
  tabBarInactiveTintColor: colors.gray500,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopColor: colors.gray200,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  // Label with a yellow underline under the active tab (as in the design).
  tabBarLabel: ({ focused, color, children }: { focused: boolean; color: string; children: string }) => (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: 12, fontWeight: focused ? '700' : '500' }}>{children}</Text>
      <View style={{ height: 3, width: 34, borderRadius: 2, marginTop: 4, backgroundColor: focused ? colors.gold500 : 'transparent' }} />
    </View>
  ),
};

const Empty = () => null;

/** Tab bar tall enough for the underlined labels plus the phone's bottom inset (Android nav bar / iPhone home bar). */
function useTabBarOptions() {
  const insets = useSafeAreaInsets();
  return {
    ...tabBar,
    ...darkHeader,
    tabBarStyle: { ...tabBar.tabBarStyle, height: 66 + insets.bottom, paddingBottom: Math.max(insets.bottom, 6) },
  };
}

function UserTabs() {
  const tabOptions = useTabBarOptions();
  const unreadChats = useAppSelector(selectUnreadTotal);
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');
  return (
    <UserTab.Navigator screenOptions={tabOptions}>
      <UserTab.Screen name="Home" component={HomeScreen} options={{ headerShown: false, tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <UserTab.Screen name="Wishlist" component={WishlistScreen} options={{ tabBarIcon: ({ color, size }) => <Heart color={color} size={size} /> }} />
      <UserTab.Screen
        name="SellTab"
        component={Empty}
        options={{
          title: 'Sell',
          tabBarIcon: () => (
            <View style={styles.sellBtn}>
              <Plus color={colors.onAccent} size={26} strokeWidth={3} />
            </View>
          ),
          tabBarButton: (props) => <Pressable {...(props as any)} />,
        }}
        listeners={({ navigation }: { navigation: any }) => ({
          tabPress: (e) => {
            e.preventDefault();
            if (!signedIn) {
              toast.show('Sign in to post an ad', 'info');
              navigation.navigate('SignIn');
            } else {
              navigation.navigate('SellProduct');
            }
          },
        })}
      />
      <UserTab.Screen
        name="Chats"
        component={ChatsListScreen}
        options={{
          tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} />,
          tabBarBadge: unreadChats > 0 ? (unreadChats > 99 ? '99+' : unreadChats) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.red500, color: colors.white, fontSize: 10, fontWeight: '800' },
        }}
      />
      <UserTab.Screen name="Account" component={AccountScreen} options={{ headerShown: false, tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </UserTab.Navigator>
  );
}

function StoreRoute() {
  return <StoreScreen />;
}

function AdminStoreTab() {
  // Reuse the store screen for the admin's own store, with posting enabled.
  return <StoreScreen allowPosting />;
}

function AdminTabs() {
  const tabOptions = useTabBarOptions();
  return (
    <AdminTab.Navigator screenOptions={tabOptions}>
      <AdminTab.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Dashboard', tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <AdminTab.Screen name="AdminPayments" component={AdminPaymentsScreen} options={{ title: 'Payment Approvals', tabBarLabel: 'Payments', tabBarIcon: ({ color, size }) => <CheckCircle2 color={color} size={size} /> }} />
      <AdminTab.Screen name="AdminStore" component={AdminStoreTab} options={{ title: 'Store', tabBarIcon: ({ color, size }) => <Store color={color} size={size} /> }} />
      <AdminTab.Screen name="AdminMore" component={AdminMoreScreen} options={{ headerShown: false, title: 'More', tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }} />
    </AdminTab.Navigator>
  );
}

export function RootNavigator() {
  const status = useAppSelector((s) => s.auth.status);
  const isAdmin = useAppSelector((s) => s.auth.isAdmin);
  const signedIn = status === 'signedIn';

  return (
    <Stack.Navigator screenOptions={darkHeader}>
      {signedIn && isAdmin ? (
        <Stack.Screen name="AdminTabs" component={AdminTabs} options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="UserTabs" component={UserTabs} options={{ headerShown: false }} />
      )}

      {/* Shared screens */}
      <Stack.Screen name="ProductDetails" component={ProductDetailsScreen} options={{ title: '' }} />
      <Stack.Screen name="Store" component={StoreRoute} options={{ title: 'Store' }} />
      <Stack.Screen name="Track" component={TrackScreen} options={{ title: 'Track Order' }} />

      {!signedIn ? (
        <Stack.Group screenOptions={{ headerShown: false, presentation: 'fullScreenModal' }}>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
        </Stack.Group>
      ) : (
        <Stack.Group>
          <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'My Cart' }} />
          <Stack.Screen name="Orders" component={OrdersScreen} options={{ title: 'My Orders' }} />
          <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: 'My Payments' }} />
          <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
          <Stack.Screen name="SellProduct" component={SellProductScreen} options={({ route }) => ({ title: route.params?.productId ? 'Edit Your Ad' : 'Post Your Ad' })} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
          <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support' }} />
          {isAdmin && (
            <>
              <Stack.Screen name="Marketplace" component={HomeScreen} options={{ headerShown: true, title: 'Marketplace' }} />
              <Stack.Screen name="StoreProductForm" component={StoreProductFormScreen} options={{ title: 'Post Store Product' }} />
              <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'All Users' }} />
              <Stack.Screen name="AdminSubscription" component={AdminSubscriptionScreen} options={{ title: 'Manage Subscription' }} />
              <Stack.Screen name="AdminListings" component={AdminListingsScreen} options={{ title: 'User Listings' }} />
              <Stack.Screen name="AdminPaymentMethods" component={AdminPaymentMethodsScreen} options={{ title: 'Payment Methods' }} />
              <Stack.Screen name="AdminShipments" component={AdminShipmentsScreen} options={{ title: 'Shipments' }} />
              <Stack.Screen name="AdminDiscounts" component={AdminDiscountsScreen} options={{ title: 'Discounts' }} />
              <Stack.Screen name="AdminVouchers" component={AdminVouchersScreen} options={{ title: 'Vouchers' }} />
            </>
          )}
        </Stack.Group>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  sellBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.gold500,
    borderWidth: 3,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
    shadowColor: colors.gold500,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
