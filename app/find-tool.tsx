
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@integrations/supabase/client';
import { getDeviceId } from '@/utils/deviceId';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ToolInventoryItem = {
  id: string;
  image_url: string;
  tools: string[];
  bin_name: string;
  bin_location: string;
  created_at: string;
  device_id: string;
};

export default function FindToolScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ToolInventoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);

  // Zoom and pan state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  const searchTools = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setHasSearched(true);

    try {
      console.log('🔍 Searching for:', searchQuery);

      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Query with device_id filter
      const { data, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Search error:', error);
        return;
      }

      console.log(`📦 Found ${data?.length || 0} total items`);

      // Filter results on client side
      const searchLower = searchQuery.toLowerCase();
      const filtered = (data || []).filter((item) => {
        const toolsMatch = item.tools.some((tool) =>
          tool.toLowerCase().includes(searchLower)
        );
        const binNameMatch = item.bin_name.toLowerCase().includes(searchLower);
        const binLocationMatch = item.bin_location.toLowerCase().includes(searchLower);
        return toolsMatch || binNameMatch || binLocationMatch;
      });

      console.log(`✅ Filtered to ${filtered.length} matching items`);
      setSearchResults(filtered);
    } catch (error) {
      console.error('❌ Error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleBinSelect = (item: ToolInventoryItem) => {
    router.push({
      pathname: '/(tabs)/inventory',
      params: { editBinId: item.id },
    });
  };

  const openViewInventory = () => {
    router.push('/(tabs)/inventory');
  };

  const expandImage = (imageUrl: string) => {
    console.log('🖼️ Expanding image');
    setExpandedImageUrl(imageUrl);
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    originX.value = 0;
    originY.value = 0;
  };

  const closeExpandedImage = () => {
    console.log('❌ Closing expanded image');
    setExpandedImageUrl(null);
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    originX.value = 0;
    originY.value = 0;
  };

  // Pan gesture for dragging the zoomed image
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow panning when zoomed in
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Pinch gesture for zooming with proper focal point handling
  const pinchGesture = Gesture.Pinch()
    .onStart((event) => {
      // Store the focal point at the start of the pinch
      originX.value = event.focalX;
      originY.value = event.focalY;
    })
    .onUpdate((event) => {
      // Calculate new scale with limits
      const newScale = Math.max(1, Math.min(savedScale.value * event.scale, 5));
      scale.value = newScale;

      // Calculate translation to keep the focal point stationary
      // The focal point should remain at the same screen position
      const deltaX = event.focalX - originX.value;
      const deltaY = event.focalY - originY.value;
      
      // Adjust translation based on scale change
      const scaleChange = newScale - savedScale.value;
      translateX.value = savedTranslateX.value + deltaX - (event.focalX - SCREEN_WIDTH / 2) * scaleChange / savedScale.value;
      translateY.value = savedTranslateY.value + deltaY - (event.focalY - SCREEN_HEIGHT / 2) * scaleChange / savedScale.value;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      // Reset if zoomed out too much
      if (scale.value < 1.2) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Double tap to zoom in/out
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x at tap location
        const newScale = 2;
        const centerX = SCREEN_WIDTH / 2;
        const centerY = SCREEN_HEIGHT / 2;
        
        // Calculate translation to center on tap point
        const targetX = centerX - event.x;
        const targetY = centerY - event.y;
        
        scale.value = withSpring(newScale);
        savedScale.value = newScale;
        translateX.value = withSpring(targetX * newScale);
        translateY.value = withSpring(targetY * newScale);
        savedTranslateX.value = targetX * newScale;
        savedTranslateY.value = targetY * newScale;
      }
    });

  // Combine all gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTapGesture, pinchGesture),
    panGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Find Tool',
          headerBackTitle: 'Back',
        }}
      />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <View style={styles.searchSection}>
              <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
                <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search for a tool, bin, or location..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={searchTools}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
              <Pressable
                style={[styles.searchButton, searching && styles.searchButtonDisabled]}
                onPress={searchTools}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {!hasSearched ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="magnifyingglass" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Find Your Tools</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Search for any tool, bin name, or location to quickly find where your tools are stored
                  </Text>
                  <Pressable style={styles.viewInventoryButton} onPress={openViewInventory}>
                    <IconSymbol name="tray.fill" size={20} color={colors.primary} />
                    <Text style={[styles.viewInventoryText, { color: colors.primary }]}>
                      View Full Inventory
                    </Text>
                  </Pressable>
                </View>
              ) : searching ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.text }]}>Searching...</Text>
                </View>
              ) : searchResults.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Results Found</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    We couldn&apos;t find any tools, bins, or locations matching &quot;{searchQuery}&quot;
                  </Text>
                  <Pressable style={styles.viewInventoryButton} onPress={openViewInventory}>
                    <IconSymbol name="tray.fill" size={20} color={colors.primary} />
                    <Text style={[styles.viewInventoryText, { color: colors.primary }]}>
                      View Full Inventory
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.resultsHeader}>
                    <Text style={[styles.resultsCount, { color: colors.text }]}>
                      {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
                    </Text>
                  </View>

                  {searchResults.map((item) => (
                    <Pressable
                      key={item.id}
                      style={[styles.resultCard, { backgroundColor: colors.card }]}
                      onPress={() => handleBinSelect(item)}
                    >
                      <Pressable onPress={() => expandImage(item.image_url)}>
                        <Image source={{ uri: item.image_url }} style={styles.resultImage} />
                      </Pressable>
                      <View style={styles.resultContent}>
                        <View style={styles.resultHeader}>
                          <View style={styles.binInfo}>
                            <IconSymbol name="archivebox.fill" size={20} color={colors.primary} />
                            <Text style={[styles.binName, { color: colors.text }]}>{item.bin_name}</Text>
                          </View>
                          <IconSymbol name="chevron.right" size={20} color={colors.textSecondary} />
                        </View>

                        <View style={styles.locationRow}>
                          <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
                          <Text style={[styles.location, { color: colors.textSecondary }]}>
                            {item.bin_location}
                          </Text>
                        </View>

                        <View style={styles.toolsContainer}>
                          <Text style={[styles.toolsTitle, { color: colors.text }]}>Tools in this bin:</Text>
                          {item.tools.slice(0, 3).map((tool, index) => (
                            <View key={index} style={styles.toolRow}>
                              <Text style={[styles.toolBullet, { color: colors.primary }]}>•</Text>
                              <Text style={[styles.toolText, { color: colors.text }]}>{tool}</Text>
                            </View>
                          ))}
                          {item.tools.length > 3 && (
                            <Text style={[styles.moreTools, { color: colors.textSecondary }]}>
                              +{item.tools.length - 3} more tool{item.tools.length - 3 !== 1 ? 's' : ''}
                            </Text>
                          )}
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}

              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Full Screen Image Zoom Modal */}
      <Modal
        visible={expandedImageUrl !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={closeExpandedImage}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={styles.fullScreenContainer}>
          <View style={styles.fullScreenOverlay}>
            <StatusBar hidden />
            
            {/* Close Button */}
            <Pressable
              onPress={closeExpandedImage}
              style={styles.closeButton}
            >
              <View style={styles.closeButtonBackground}>
                <IconSymbol name="xmark" size={24} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* Zoom Instructions */}
            <View style={styles.zoomInstructions}>
              <Text style={styles.zoomInstructionsText}>Pinch to zoom • Drag to pan • Double tap</Text>
            </View>

            {/* Zoomable and Pannable Image */}
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageContainer, animatedStyle]}>
                {expandedImageUrl && (
                  <Image
                    source={{ uri: expandedImageUrl }}
                    style={styles.fullScreenImage}
                    resizeMode="contain"
                  />
                )}
              </Animated.View>
            </GestureDetector>
          </View>
        </GestureHandlerRootView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 32,
    lineHeight: 24,
  },
  viewInventoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 12,
  },
  viewInventoryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
  },
  resultContent: {
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  binInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  binName: {
    fontSize: 18,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  location: {
    fontSize: 14,
  },
  toolsContainer: {
    marginTop: 8,
  },
  toolsTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  toolBullet: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 2,
  },
  toolText: {
    fontSize: 15,
    flex: 1,
  },
  moreTools: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 20,
  },
  fullScreenContainer: {
    flex: 1,
  },
  fullScreenOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
  },
  closeButtonBackground: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomInstructions: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zoomInstructionsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});
