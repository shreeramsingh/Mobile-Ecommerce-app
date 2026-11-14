import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { CheckCircle2, Truck } from 'lucide-react-native';
import { request, errorMessage } from '../../api/client';
import { AppText, Button, Card, EmptyState, ErrorBox, Input, KeyValue, Row } from '../../components/ui';
import { colors, spacing } from '../../theme';

interface TrackingResult {
  status?: string;
  message?: string;
  courierName?: string;
  awbCode?: string;
  currentStatus?: string;
  trackingEvents?: { date: string; status: string; location?: string }[];
}

export function TrackScreen() {
  const [id, setId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TrackingResult | null>(null);

  const track = async () => {
    if (!id.trim()) return setError('Please enter a shipment ID');
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await request<TrackingResult>(`/api/shiprocket/track/${encodeURIComponent(id.trim())}`, { auth: false });
      if (res?.status === 'ERROR') setError(res.message || 'Could not find tracking information.');
      else setData(res);
    } catch (e) {
      setError(errorMessage(e) || 'Failed to fetch tracking information. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const status = data?.currentStatus || data?.status || 'In Transit';
  const delivered = /deliver/i.test(status);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.gray100 }} contentContainerStyle={{ padding: spacing.md }} keyboardShouldPersistTaps="handled">
      <Card>
        <Row style={{ marginBottom: 12 }}>
          <Truck size={22} color={colors.gold500} />
          <AppText variant="heading">Track Your Order</AppText>
        </Row>
        <Input
          label="Shipment ID"
          value={id}
          onChangeText={setId}
          placeholder="Enter your shipment ID"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={track}
        />
        <Button title="Track" onPress={track} loading={loading} />
      </Card>

      <View style={{ marginTop: spacing.md }}>
        {error ? <ErrorBox message={error} /> : null}
        {data ? (
          <Card>
            <Row>
              <CheckCircle2 size={22} color={delivered ? colors.green600 : colors.blue600} />
              <AppText variant="heading" style={{ flex: 1 }}>{status}</AppText>
            </Row>
            {data.courierName ? <AppText muted style={{ marginTop: 4 }}>via {data.courierName}</AppText> : null}
            <KeyValue label="AWB Number" value={data.awbCode} />
            <AppText variant="subheading" style={{ marginTop: 16, marginBottom: 8 }}>Tracking History</AppText>
            {(data.trackingEvents ?? []).map((ev, i) => (
              <Row key={i} style={{ alignItems: 'flex-start', marginBottom: 12 }} gap={12}>
                <View style={[styles.dot, i === 0 && { backgroundColor: colors.gold500 }]} />
                <View style={{ flex: 1 }}>
                  <AppText style={{ fontWeight: '600' }}>{ev.status}</AppText>
                  {ev.location ? <AppText variant="caption">{ev.location}</AppText> : null}
                  <AppText variant="caption">{ev.date}</AppText>
                </View>
              </Row>
            ))}
          </Card>
        ) : !error ? (
          <EmptyState icon={Truck} title="Enter your shipment ID above to see live tracking updates" />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gray300, marginTop: 4 },
});
