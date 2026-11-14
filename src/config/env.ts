// Runtime configuration. The app talks to the same backend as the website
// (https://api.bandookwale.com). To point a debug build at another server, change
// DEV_API_BASE_URL — release builds always use the production URL.

const PROD_API_BASE_URL = 'https://api.bandookwale.com';
const DEV_API_BASE_URL = PROD_API_BASE_URL;

export const API_BASE_URL = __DEV__ ? DEV_API_BASE_URL : PROD_API_BASE_URL;

// Chat runs over STOMP. The backend exposes it through SockJS at /ws; native
// clients use SockJS's raw WebSocket transport at /ws/websocket.
export const WS_URL = `${API_BASE_URL.replace(/^http/, 'ws')}/ws/websocket`;

// Public web origin, used for share links so they open on the website too.
export const WEB_ORIGIN = 'https://bandookwale.com';

export const REQUEST_TIMEOUT_MS = 25_000;

// Signed-in sessions without "keep me logged in" end after this long in the background,
// matching the website's 15-minute idle sign-out.
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
