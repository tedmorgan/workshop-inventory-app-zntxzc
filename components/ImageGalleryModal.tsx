/**
 * Full-screen image gallery.
 *
 * Shows one or more images in a horizontally swipeable, paged view. Each page
 * supports pinch-to-zoom, double-tap-to-zoom and pan-when-zoomed. Horizontal
 * paging is automatically disabled while an image is zoomed so panning the
 * zoomed image doesn't fight the swipe-to-next gesture.
 *
 * Created: 2026-09-05
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  StatusBar,
  Dimensions,
  FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { IconSymbol } from '@/components/IconSymbol';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZoomablePageProps {
  uri: string;
  onRequestClose: () => void;
  /** Reports whether this page is currently zoomed, so the pager can disable swiping. */
  onZoomChange: (zoomed: boolean) => void;
}

function ZoomablePage({ uri, onRequestClose, onZoomChange }: ZoomablePageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  // React state mirror of "is zoomed" — drives pan.enabled and the parent pager.
  const [isZoomed, setIsZoomed] = useState(false);
  const setZoomed = useCallback(
    (z: boolean) => {
      setIsZoomed(z);
      onZoomChange(z);
    },
    [onZoomChange]
  );

  // Pan only active while zoomed (so single-finger horizontal swipes reach the pager).
  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .onUpdate((event) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      originX.value = event.focalX;
      originY.value = event.focalY;
    })
    .onUpdate((event) => {
      const newScale = Math.max(1, Math.min(savedScale.value * event.scale, 5));
      scale.value = newScale;
      const deltaX = event.focalX - originX.value;
      const deltaY = event.focalY - originY.value;
      const scaleChange = newScale - savedScale.value;
      translateX.value =
        savedTranslateX.value + deltaX - ((event.focalX - SCREEN_WIDTH / 2) * scaleChange) / savedScale.value;
      translateY.value =
        savedTranslateY.value + deltaY - ((event.focalY - SCREEN_HEIGHT / 2) * scaleChange) / savedScale.value;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      // Reset inline (must stay in the worklet — calling a JS helper here crashes).
      if (scale.value < 1.2) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setZoomed)(false);
      } else {
        runOnJS(setZoomed)(true);
      }
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        // Zoom out (reset inline, worklet-safe)
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(setZoomed)(false);
      } else {
        const newScale = 2;
        const targetX = SCREEN_WIDTH / 2 - event.x;
        const targetY = SCREEN_HEIGHT / 2 - event.y;
        scale.value = withSpring(newScale);
        savedScale.value = newScale;
        translateX.value = withSpring(targetX * newScale);
        translateY.value = withSpring(targetY * newScale);
        savedTranslateX.value = targetX * newScale;
        savedTranslateY.value = targetY * newScale;
        runOnJS(setZoomed)(true);
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1.1) {
        runOnJS(onRequestClose)();
      }
    });

  const composedGesture = Gesture.Simultaneous(
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
    pinchGesture,
    panGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={styles.page}>
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.imageContainer, animatedStyle]}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface ImageGalleryModalProps {
  images: string[];
  initialIndex?: number;
  visible: boolean;
  onClose: () => void;
}

export default function ImageGalleryModal({
  images,
  initialIndex = 0,
  visible,
  onClose,
}: ImageGalleryModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [pagingEnabled, setPagingEnabled] = useState(true);
  const listRef = useRef<FlatList<string>>(null);

  // Keep the reported index in sync when the gallery (re)opens.
  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setPagingEnabled(true);
    }
  }, [visible, initialIndex]);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setCurrentIndex(idx);
    },
    []
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<string> | null | undefined, index: number) => ({
      length: SCREEN_WIDTH,
      offset: SCREEN_WIDTH * index,
      index,
    }),
    []
  );

  const hasMultiple = images.length > 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.overlay}>
          <StatusBar hidden />

          <FlatList
            ref={listRef}
            data={images}
            keyExtractor={(item, index) => `${index}_${item}`}
            horizontal
            pagingEnabled
            scrollEnabled={pagingEnabled}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item }) => (
              <ZoomablePage
                uri={item}
                onRequestClose={onClose}
                onZoomChange={(zoomed) => setPagingEnabled(!zoomed)}
              />
            )}
          />

          {/* Close button */}
          <Pressable
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <View style={styles.closeButtonBackground}>
              <IconSymbol name="xmark" size={26} color="#FFFFFF" />
            </View>
          </Pressable>

          {/* Page counter */}
          {hasMultiple && (
            <View style={styles.counter} pointerEvents="none">
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}

          {/* Dot indicators */}
          {hasMultiple && images.length <= 10 && (
            <View style={styles.dotsRow} pointerEvents="none">
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}

          {/* Hint */}
          <View style={styles.hint} pointerEvents="none">
            <Text style={styles.hintText}>
              {hasMultiple ? 'Swipe left/right  •  ' : ''}Pinch or double-tap to zoom  •  Tap to close
            </Text>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
  },
  page: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: 58,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  hint: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
});
