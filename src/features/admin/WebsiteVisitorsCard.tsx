import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Globe } from 'lucide-react-native';
import { visitsApi, type VisitTotals } from '../../api/visits';
import { errorMessage } from '../../api/client';
import { colors, font, radius } from '../../theme';

const RANGES = [7, 30, 90] as const;
const n = (v: number) => v.toLocaleString('en-IN');

/** Admin dashboard: people who opened the site/app (guests included, admins excluded). */
export function WebsiteVisitorsCard() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const q = useQuery({
    queryKey: ['siteVisits', days],
    queryFn: () => visitsApi.stats(days),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const data = q.data;

  const daily = data?.daily ?? [];
  const max = Math.max(1, ...daily.map((d) => d.visitors));
  const labelEvery = daily.length <= 10 ? 1 : daily.length <= 31 ? 7 : 15;
  const todayDiff = data ? data.today.visitors - data.yesterday.visitors : 0;

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <Globe size={18} color={colors.gold500} />
        <Text style={styles.title}>Website Visitors</Text>
      </View>
      <Text style={styles.sub}>
        People who opened the site or app, guests included (each device counted once per day). Admin visits are not counted.
      </Text>

      <View style={styles.ranges}>
        {RANGES.map((r) => (
          <Pressable key={r} onPress={() => setDays(r)} style={[styles.range, days === r && styles.rangeActive]}>
            <Text style={[styles.rangeText, days === r && { color: colors.onAccent }]}>{r} days</Text>
          </Pressable>
        ))}
      </View>

      {q.isLoading ? (
        <ActivityIndicator color={colors.gold500} style={{ marginVertical: 24 }} />
      ) : q.error && !data ? (
        <Text style={styles.error}>Couldn't load visitor stats: {errorMessage(q.error)}</Text>
      ) : data ? (
        <>
          <View style={styles.tiles}>
            <Tile label="Today" t={data.today}
              note={todayDiff === 0
                ? `Same as yesterday (${n(data.yesterday.visitors)})`
                : `${n(Math.abs(todayDiff))} ${todayDiff > 0 ? 'more' : 'fewer'} than yesterday (${n(data.yesterday.visitors)})`} />
            <Tile label="Last 7 days" t={data.last7Days} />
            <Tile label="Last 30 days" t={data.last30Days} />
            <Tile label="All time" t={data.allTime} />
          </View>

          <Text style={styles.chartLabel}>Unique visitors per day</Text>
          <View style={[styles.chart, q.isFetching && { opacity: 0.6 }]}>
            <Text style={styles.maxLabel}>{n(max)}</Text>
            <View style={styles.bars}>
              {daily.map((d) => (
                <View key={d.date} style={styles.barSlot}>
                  <View
                    style={[styles.bar, { height: `${d.visitors > 0 ? Math.max(2, (d.visitors / max) * 100) : 0}%` }]}
                    accessibilityLabel={`${d.date}: ${d.visitors} visitors, ${d.visits} visits`}
                  />
                </View>
              ))}
            </View>
          </View>
          <View style={styles.axis}>
            {daily.map((d, i) => {
              const fromEnd = daily.length - 1 - i;
              const show = fromEnd === 0 || fromEnd % labelEvery === 0;
              return (
                <Text key={d.date} style={styles.axisText} numberOfLines={1}>
                  {fromEnd === 0
                    ? 'Today'
                    : show
                    ? new Date(`${d.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                    : ''}
                </Text>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

function Tile({ label, t, note }: { label: string; t: VisitTotals; note?: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{n(t.visitors)}</Text>
      <Text style={styles.tileSub}>
        {n(t.visits)} {t.visits === 1 ? 'visit' : 'visits'} · {n(t.loggedInVisitors)} signed in
      </Text>
      {note ? <Text style={[styles.tileSub, { color: colors.gold600 }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    padding: 16,
    marginTop: 14,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: colors.white, fontWeight: '800', fontSize: font.md },
  sub: { color: colors.gray500, fontSize: font.xs, marginTop: 4, lineHeight: 16 },
  ranges: { flexDirection: 'row', gap: 6, marginTop: 12 },
  range: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  rangeActive: { backgroundColor: colors.gold500 },
  rangeText: { color: colors.gray600, fontWeight: '700', fontSize: font.xs },
  error: { color: colors.red700, marginTop: 12, fontSize: font.sm },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 12 },
  tileLabel: { color: colors.gray500, fontSize: font.xs, fontWeight: '700' },
  tileValue: { color: colors.white, fontSize: font.xxl, fontWeight: '800', marginTop: 2 },
  tileSub: { color: colors.gray500, fontSize: 11, marginTop: 2 },
  chartLabel: { color: colors.gray600, fontSize: font.xs, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  chart: { height: 140, flexDirection: 'row' },
  maxLabel: { position: 'absolute', top: -2, left: 0, color: colors.gray400, fontSize: 10 },
  bars: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 1, paddingTop: 14 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.amber500, borderTopLeftRadius: 2, borderTopRightRadius: 2, minHeight: 0 },
  axis: { flexDirection: 'row', marginTop: 4 },
  axisText: { flex: 1, color: colors.gray400, fontSize: 9, textAlign: 'center', overflow: 'visible' },
});
