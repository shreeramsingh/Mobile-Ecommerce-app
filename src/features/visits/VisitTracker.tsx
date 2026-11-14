import { useEffect } from 'react';
import { AppState } from 'react-native';
import { store, useAppSelector } from '../../store';
import { visitsApi } from '../../api/visits';

/**
 * Counts app opens for the admin "Website Visitors" stats, like the website's
 * VisitTracker: one ping per app session, guests included, admins never counted.
 */
export function VisitTracker() {
  const status = useAppSelector((s) => s.auth.status);
  const isAdmin = useAppSelector((s) => s.auth.isAdmin);
  const nodeId = useAppSelector((s) => s.auth.user?.nodeId);

  useEffect(() => {
    if (status === 'loading' || isAdmin) return;
    visitsApi.recordOnce(nodeId);
  }, [status, isAdmin, nodeId]);

  // A return to the app after a long time in the background is a new session.
  useEffect(() => {
    let backgroundAt = 0;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundAt = Date.now();
      if (s === 'active' && backgroundAt && Date.now() - backgroundAt > 30 * 60 * 1000) {
        backgroundAt = 0;
        visitsApi.resetSession();
        const { auth } = store.getState();
        if (auth.status !== 'loading' && !auth.isAdmin) visitsApi.recordOnce(auth.user?.nodeId);
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}
