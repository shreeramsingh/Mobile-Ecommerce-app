import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/** Lets code outside screens (notification banner, deep handlers) navigate. */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
