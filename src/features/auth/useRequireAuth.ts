import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAppSelector } from '../../store';
import { toast } from '../../components/ui/Toast';

/**
 * Guests can browse; anything that needs an account (cart, chat, selling, reviews)
 * goes through this guard, which sends them to Sign In instead.
 */
export function useRequireAuth() {
  const navigation = useNavigation();
  const signedIn = useAppSelector((s) => s.auth.status === 'signedIn');
  return useCallback(
    (action: () => void, message = 'Please sign in to continue') => {
      if (signedIn) return action();
      toast.show(message, 'info');
      navigation.navigate('SignIn');
    },
    [signedIn, navigation],
  );
}
