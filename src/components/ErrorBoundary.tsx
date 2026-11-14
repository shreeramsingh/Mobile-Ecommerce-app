import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';

interface State {
  error: Error | null;
}

/** Last line of defence: a crash in any screen shows a recovery screen instead of a white app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Hook a crash reporter (e.g. Sentry / Firebase Crashlytics) in here.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>Please try again. If this keeps happening, contact support.</Text>
        <Pressable style={styles.btn} onPress={() => this.setState({ error: null })}>
          <Text style={{ color: colors.white, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.navy },
  title: { color: colors.white, fontSize: font.xl, fontWeight: '800' },
  text: { color: colors.gray400, textAlign: 'center', marginTop: 8 },
  btn: { marginTop: 20, backgroundColor: colors.gold500, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
});
