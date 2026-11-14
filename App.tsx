/**
 * Bandookwale mobile app — same backend as bandookwale.com.
 *
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, View, Image, Platform, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, type LinkingOptions } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/lib/queryClient';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { store, persistor, useAppDispatch, useAppSelector } from './src/store';
import { hydrate } from './src/store/slices/authSlice';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { ChatNotificationHost } from './src/features/chat/ChatNotificationHost';
import { VisitTracker } from './src/features/visits/VisitTracker';
import { PushHost } from './src/features/notifications/PushHost';
import { ToastHost } from './src/components/ui/Toast';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import type { RootStackParamList } from './src/navigation/types';
import { colors } from './src/theme';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold500,
    background: colors.navy,
    card: colors.navy,
    text: colors.white,
    border: colors.gray200,
  },
};

// Deep links: bandookwale://productdetails?id=123 and https://bandookwale.com/productdetails?id=123
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['bandookwale://', 'https://bandookwale.com', 'https://www.bandookwale.com'],
  config: {
    screens: {
      ProductDetails: { path: 'productdetails', parse: { id: Number } },
      Store: 'store/:sellerId?',
      Cart: 'cart',
      Orders: 'orders',
      Payments: 'payments',
      Track: 'track',
      SignIn: 'signin',
      SignUp: 'signup',
    },
  },
};

// Same badge, size and black background as the native splash screen, so the hand-off
// from the OS splash to the app is seamless while the session is restored.
const SPLASH_BADGE_SIZE = Platform.OS === 'ios' ? 160 : 130;

function Splash() {
  return (
    <View style={styles.splash}>
      <Image
        source={require('./src/assets/images/app-badge.png')}
        style={{ width: SPLASH_BADGE_SIZE, height: SPLASH_BADGE_SIZE }}
        resizeMode="contain"
        accessibilityLabel="Bandookwale"
      />
    </View>
  );
}

function AppContent() {
  const status = useAppSelector((s) => s.auth.status);
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(hydrate());
  }, [dispatch]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar barStyle="light-content" />
          {status === 'loading' ? (
            <Splash />
          ) : (
            <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking} fallback={<Splash />}>
              <RootNavigator />
              <ChatNotificationHost />
              <VisitTracker />
              <PushHost />
            </NavigationContainer>
          )}
          <ToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <Provider store={store}>
      <PersistGate loading={<Splash />} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: colors.black, alignItems: 'center', justifyContent: 'center' },
});

export default App;
