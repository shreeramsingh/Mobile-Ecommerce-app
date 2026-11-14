/**
 * @format
 */

// STOMP (chat) needs TextEncoder/TextDecoder; Hermes may not provide TextDecoder.
if (typeof global.TextDecoder === 'undefined' || typeof global.TextEncoder === 'undefined') {
  require('fast-text-encoding');
}

import { AppRegistry } from 'react-native';
import { getApps } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Chat pushes carry a "notification" part, so the OS shows them itself when the app is
// in the background or closed. Firebase still requires a background handler to be set
// early; nothing else needs to run here (opening the chat happens on tap, in PushHost).
if (getApps().length > 0) {
  setBackgroundMessageHandler(getMessaging(), async () => {});
}

AppRegistry.registerComponent(appName, () => App);
