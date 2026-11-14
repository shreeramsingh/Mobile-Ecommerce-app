# Push notifications (chat)

When someone sends a chat message, the recipient gets a push notification on their
phone — even when the app is closed. Tapping it opens that conversation.

## How it works

```
Sender's app ──STOMP──▶ Backend ChatController
                            ├─▶ /topic/inbox/{user}  (live, app open)
                            └─▶ PushNotificationService ──▶ Firebase (FCM) ──▶ Android
                                                                         └──▶ APNs ──▶ iPhone
```

| Piece | Where | Status |
|---|---|---|
| Device registration API (`POST/DELETE /api/push/devices`) | backend `PushDeviceController` | done |
| Sending a push per chat message, badge count, per-chat grouping, dead-token cleanup | backend `PushNotificationService` | done |
| Permission prompt, token registration + refresh, unregister on sign-out | app `src/features/notifications/push.ts` | done |
| Android channel `chat_messages`, notification icon + colour | app (native + `push.ts`) | done |
| Tap notification → open the chat (app in background **or** closed) | app `PushHost.tsx` | done |
| Push while the app is open → in-app banner (no duplicate system notification) | app `PushHost.tsx` | done |
| App icon badge = unread chats | app `PushHost.tsx` | done |
| **Firebase project + config files** | you | **to do** |
| **Apple push key (APNs)** | you | **to do** |
| **Backend Firebase credentials on the server** | you | **to do** |

Until the three "to do" items are finished the app builds and runs normally; push is
simply off (Android build logs `google-services.json not found … push notifications are disabled`).

## Setup (one time)

### 1. Create the Firebase project
1. <https://console.firebase.google.com> → **Add project** → name it `Bandookwale`.
2. **Add app → Android**
   - Package name: `com.bandookwale`
   - Download **`google-services.json`** → put it at `android/app/google-services.json`.
3. **Add app → iOS**
   - Bundle ID: `com.bandookwale`
   - Download **`GoogleService-Info.plist`** → in Xcode, drag it into the `Bandookwale`
     folder (tick "Copy items if needed" and the `Bandookwale` target).

### 2. Apple push key (iOS only)
1. <https://developer.apple.com/account/resources/authkeys/list> → **+** → tick
   **Apple Push Notifications service (APNs)** → download the `.p8` key (only downloadable once —
   keep it safe). Note the **Key ID** and your **Team ID**.
2. Firebase console → Project settings → **Cloud Messaging** → Apple app configuration →
   upload the `.p8` with Key ID and Team ID.
3. In Xcode → target `Bandookwale` → **Signing & Capabilities**: pick your team. The
   **Push Notifications** and **Background Modes → Remote notifications** capabilities are
   already configured (`Bandookwale.entitlements`, `Info.plist`).

### 3. Backend credentials
Firebase console → Project settings → **Service accounts** → **Generate new private key**
(a JSON file). On the server set **one** of:

```sh
FIREBASE_CREDENTIALS_FILE=/path/to/service-account.json
# or (e.g. Elastic Beanstalk env var)
FIREBASE_CREDENTIALS_BASE64=$(base64 -i service-account.json)
```

Restart the backend; its log should say `Push notifications are ON (Firebase project: …)`.
Never commit this JSON — it can send pushes to all your users.

### 4. Rebuild the apps
```sh
npm run android          # picks up google-services.json
cd ios && pod install && cd .. && npm run ios
```

## Testing
1. Sign in on phone A (allow notifications when asked) and on phone B / the website.
2. Close the app on phone A (swipe it away).
3. Send a chat message from B to A → A shows "**{sender}** — {message} · {product}".
4. Tap it → the app opens straight into that chat.
5. With A's app open on another screen → a banner appears at the top instead.
6. Sign out on A → messages to A no longer push to that phone.

Push only works on **real devices** for iOS (the simulator can't receive APNs pushes from
Firebase); Android emulators with Google Play work.

## Notes
- The backend sends a `notification` payload with priority HIGH, so Android shows it
  immediately even in battery-saver/Doze, and iOS delivers it through APNs.
- Notifications for one conversation replace each other (Android `tag`, iOS `thread-id`).
- iOS pods use **dynamic** frameworks (needed by Firebase); the Podfile links the system
  frameworks a few libraries rely on. Run `pod install` after adding native libraries.
- The iOS bundle id changed from the template default to **`com.bandookwale`**.
