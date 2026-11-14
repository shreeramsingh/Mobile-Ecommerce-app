import React, { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Maximize2, X } from 'lucide-react-native';
import { ProductImage } from '../../components/ProductImage';
import { colors, radius } from '../../theme';

/** Swipeable photo gallery with thumbnails and a full-screen pinch-to-zoom viewer. */
export function Gallery({ images, title }: { images: string[]; title: string }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const mainRef = useRef<FlatList<string>>(null);
  const list = images.length ? images : [''];
  const slideW = width;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width));

  const goTo = (i: number) => {
    setIndex(i);
    mainRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <View>
      <View style={{ backgroundColor: colors.black }}>
        <FlatList
          ref={mainRef}
          data={list}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(u, i) => `${i}-${u}`}
          onMomentumScrollEnd={onEnd}
          getItemLayout={(_, i) => ({ length: slideW, offset: slideW * i, index: i })}
          renderItem={({ item }) => (
            <Pressable onPress={() => setFullscreen(true)} accessibilityLabel={`${title} photo, open full screen`}>
              <ProductImage uri={item} style={{ width: slideW, height: slideW * 0.75 }} resizeMode="contain" />
            </Pressable>
          )}
        />
        <Pressable style={styles.fullBtn} onPress={() => setFullscreen(true)} accessibilityLabel="View full screen">
          <Maximize2 size={16} color={colors.white} />
        </Pressable>
        {list.length > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {index + 1} / {list.length}
            </Text>
          </View>
        )}
      </View>

      {list.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 10, gap: 8 }}>
          {list.map((img, i) => (
            <Pressable key={i} onPress={() => goTo(i)}>
              <ProductImage
                uri={img}
                style={[styles.thumb, i === index ? { borderColor: colors.gold500 } : { opacity: 0.6 }]}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Modal visible={fullscreen} animationType="fade" onRequestClose={() => setFullscreen(false)} statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <FlatList
            data={list}
            horizontal
            pagingEnabled
            initialScrollIndex={index}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(u, i) => `fs-${i}-${u}`}
            onMomentumScrollEnd={onEnd}
            renderItem={({ item }) => (
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                maximumZoomScale={3}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <ProductImage uri={item} style={{ width, height: height * 0.8 }} resizeMode="contain" />
              </ScrollView>
            )}
          />
          <Pressable
            style={[styles.closeBtn, { top: insets.top + 12 }]}
            onPress={() => setFullscreen(false)}
            accessibilityLabel="Close"
          >
            <X size={24} color={colors.white} />
          </Pressable>
          <Text style={[styles.fsCaption, { bottom: insets.bottom + 20 }]}>
            {index + 1} / {list.length} · pinch to zoom
          </Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  counterText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  thumb: { width: 64, height: 64, borderRadius: 10, borderWidth: 2, borderColor: 'transparent' },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsCaption: { position: 'absolute', alignSelf: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 13 },
});
