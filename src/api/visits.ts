import { request } from './client';
import { storage } from '../lib/storage';

export interface VisitTotals {
  visitors: number; // distinct devices/browsers
  visits: number; // sessions
  loggedInVisitors: number; // distinct signed-in users
}
export interface VisitDay {
  date: string; // YYYY-MM-DD (IST)
  visitors: number;
  visits: number;
}
export interface VisitStats {
  today: VisitTotals;
  yesterday: VisitTotals;
  last7Days: VisitTotals;
  last30Days: VisitTotals;
  allTime: VisitTotals;
  daily: VisitDay[];
}

const VISITOR_ID_KEY = 'visits.visitorId';
let recordedThisSession = false;

/** Stable anonymous id for this install (same idea as the website's bw_visitor_id). */
function visitorId(): string {
  let id = storage.getString(VISITOR_ID_KEY);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    storage.set(VISITOR_ID_KEY, id);
  }
  return id;
}

export const visitsApi = {
  /** Records one visit per app session (guests included). Never throws. */
  async recordOnce(userId?: string | null) {
    if (recordedThisSession) return;
    recordedThisSession = true;
    try {
      await request('/api/site-visits', {
        method: 'POST',
        auth: false,
        body: { visitorId: visitorId(), userId: userId || null },
        responseType: 'none',
      });
    } catch {
      recordedThisSession = false; // try again next time
    }
  },

  /** Next recordOnce sends again (new app session). */
  resetSession() {
    recordedThisSession = false;
  },

  /** Admin: visitor stats for the last `days` days. */
  stats: (days = 30) => request<VisitStats>('/api/admin/site-visits/stats', { query: { days } }),
};
