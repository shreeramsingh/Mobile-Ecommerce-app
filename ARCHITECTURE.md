# Bandookwale app — architecture

React Native (0.88, New Architecture, Hermes) client for the same backend as the
website (`https://api.bandookwale.com`). It covers everything the website's menus
link to: marketplace, store, cart and checkout, orders, payments, chat, selling,
profile, support, and the admin panel.

## Layout

```
src/
  api/          HTTP client + one module per backend area (no UI code)
    client.ts     fetch wrapper: auth header, timeouts, error shape, 401 → sign-out
    products.ts   product queries + mapping to the UI `Product` type
    payments.ts   manual payments, shop orders, admin payment/shipping APIs
    users.ts      users, profile, uploads, subscriptions, support tickets
    social.ts     favourites, reviews, view counts
    chat.ts       chat history / conversation list
    auth.ts       login, register, sign-up email OTP
  store/        Redux Toolkit store (redux-persist → MMKV)
    index.ts      configureStore, persistence, typed hooks (useAppSelector / useAppDispatch)
    slices/authSlice.ts       session + thunks (hydrate, signIn, signOut, refreshUser); JWT in Keychain/Keystore
    slices/cartSlice.ts       cart (persisted across restarts)
    slices/filtersSlice.ts    search + city filter (city persisted)
    slices/recentlyViewedSlice.ts
  features/     one folder per area: screens + hooks + components
  components/   shared UI (ui kit, header, images, error boundary)
  navigation/   root stack, user tabs, admin tabs, route types
  data/         static taxonomies copied from the website (weapon/shooting categories, cities, states, terms)
  lib/          storage, query client, formatting, validation, file picking, geocoding
  config/env.ts API / WebSocket URLs
```

## Key decisions

- **Server state = TanStack Query.** Caching, request de-duplication, retries
  with backoff, background refresh when the app returns to the foreground, and
  infinite scrolling for the product feed. Screens never call `fetch` directly.
- **App state = Redux Toolkit.** Slices for auth, cart, filters and recently
  viewed; `redux-persist` saves cart/filters/recently viewed to MMKV. Read with
  `useAppSelector`, change with `useAppDispatch` + slice actions/thunks.
- **Security.** The JWT is stored in the iOS Keychain / Android Keystore, never in
  plain storage. Any 401 signs the user out centrally. Without "Keep me logged
  in", the session ends after 15 minutes in the background (like the website).
- **Lists.** FlashList (recycling) for product grids; images are resized
  on-device before upload (≤1600px, 80% JPEG).
- **Chat.** One shared STOMP connection over a native WebSocket
  (`wss://api.bandookwale.com/ws/websocket`). It reconnects automatically,
  re-subscribes, refetches history after reconnecting, and queues messages
  typed while offline instead of dropping them.
- **Guests can browse.** Cart, chat, selling, reviews and wishlist ask the user
  to sign in first.
- **Admins** get their own tabs: Dashboard, Payments, Store, More.

## Fixes over the website's behaviour

- Checkout reuses an unpaid order instead of creating a duplicate when the
  payment step is reopened. Unpaid orders get a "Pay now" button in My Orders.
- The wishlist loads each saved product by id (the website only checked the
  first 50 products).
- The home feed includes store products (the website's feed only loaded
  listings).
- Product photo uploads show real previews.
- Users see only their own support tickets. Admins see all of them.

## Things that need the backend team (for 1–2M users)

1. **Search and filtering on the server.** Search, city and weapon-category
   filters run on the device over the loaded pages, because `getProduct` has no
   text or weapon-category filter. Add `search`, `city` and `weaponCategoryId`
   parameters to `/api/users/getProduct`.
2. **Sign-up OTP is checked on the device.** The OTP is fetched from an
   unauthenticated endpoint and compared in the app (same as the website). Add a
   `POST /api/v1/auth/verifyEmailOtp` that checks it on the server and stop
   returning OTPs to clients.
3. **Chat has no authentication.** The chat REST endpoints and the socket accept
   anyone (the app already sends the JWT in the STOMP CONNECT headers). Enforce
   it on the server and add push notifications (FCM/APNs) for new messages.
4. **Support tickets** require `transactionPassword` / `otp` fields that no
   client collects. The app sends `null` for both.
5. Put a CDN in front of product images and serve resized thumbnails for list
   views.

## Commands

```sh
npm start            # Metro
npm run android      # build + run on Android
npm run ios          # build + run on iOS (run `cd ios && pod install` after adding native libs)
npx tsc --noEmit     # type check
npm run lint
```
