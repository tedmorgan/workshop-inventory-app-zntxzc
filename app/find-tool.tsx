
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

type SearchMode = 'simple' | 'advanced';

export default function FindToolScreen() {
  const router = useRouter();
  const [searchMode, setSearchMode] = useState<SearchMode>('simple');
  const [simpleSearchQuery, setSimpleSearchQuery] = useState('');
  const [advancedSearchQuery, setAdvancedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ToolInventoryItem[]>([]);
  const [aiResponse, setAiResponse] = useState<string>('');
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

  const searchToolsSimple = async () => {
    if (!simpleSearchQuery.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setHasSearched(true);
    setAiResponse('');

    try {
      console.log('🔍 Simple search for:', simpleSearchQuery);

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
      const searchLower = simpleSearchQuery.toLowerCase();
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

  const searchToolsAdvanced = async () => {
    if (!advancedSearchQuery.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setHasSearched(true);
    setSearchResults([]);
    setAiResponse('');

    try {
      console.log('🤖 Advanced AI search for:', advancedSearchQuery);

      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('advanced-tool-search', {
        body: {
          searchQuery: advancedSearchQuery,
          deviceId: deviceId,
        },
      });

      if (error) {
        console.error('❌ Edge Function error:', error);
        setAiResponse('Sorry, we encountered an error processing your request. Please try again.');
        return;
      }

      console.log('✅✅✅ AI RESPONSE RECEIVED - NEW CODE LOADED ✅✅✅');
      console.log('📝 Response preview (first 200 chars):', data.response?.substring(0, 200));
      console.log('📝 Full response length:', data.response?.length);
      setAiResponse(data.response || 'No response received from AI.');
    } catch (error) {
      console.error('❌ Error:', error);
      setAiResponse('Sorry, we encountered an error processing your request. Please try again.');
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

  const openInventoryForBin = (binName: string) => {
    router.push({
      pathname: '/(tabs)/inventory',
      params: { filterBin: binName }
    });
  };

  const renderAIResponse = (response: string) => {
    // Split response into lines and detect bin names
    const lines = response.split('\n');
    const elements: React.ReactNode[] = [];
    
    console.log('🔍 Rendering AI response, total lines:', lines.length);
    console.log('📄 First 3 lines of response:');
    lines.slice(0, 3).forEach((line, idx) => {
      console.log(`  Line ${idx}: "${line}"`);
    });
    
    lines.forEach((line, lineIndex) => {
      // Match patterns like "Bin Name: Something" or "- Bin Name: Something"
      // Only match "Bin Name:", not "Bin Location:"
      const binMatch = line.match(/Bin Name:\s*(.+?)$/i);
      
      if (binMatch) {
        const binName = binMatch[1].trim();
        const textBeforeBinName = line.substring(0, binMatch.index!);
        const binNameLabel = line.substring(binMatch.index!, binMatch.index! + 'Bin Name:'.length);
        
        console.log('✅ Found bin name match on line', lineIndex, ':', binName);
        
        elements.push(
          <Text key={`line-${lineIndex}`} style={[styles.aiResponseText, { color: colors.text }]} selectable={false}>
            {textBeforeBinName}
            {binNameLabel}{' '}
            <Text 
              style={[styles.aiResponseText, styles.binLink, { color: colors.primary }]}
              onPress={() => {
                console.log('🔗 Bin name pressed:', binName);
                openInventoryForBin(binName);
              }}
            >
              {binName}
            </Text>
            {'\n'}
          </Text>
        );
      } else {
        elements.push(
          <Text key={`line-${lineIndex}`} style={[styles.aiResponseText, { color: colors.text }]} selectable={false}>
            {line}{lineIndex < lines.length - 1 ? '\n' : ''}
          </Text>
        );
      }
    });
    
    console.log('✨ Finished rendering, total elements:', elements.length);
    return <>{elements}</>;
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

  const currentSearchQuery = searchMode === 'simple' ? simpleSearchQuery : advancedSearchQuery;
  const canSearch = currentSearchQuery.trim().length > 0;

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
            {/* Search Mode Toggle */}
            <View style={styles.modeToggleContainer}>
              <Pressable
                style={[
                  styles.modeButton,
                  searchMode === 'simple' && styles.modeButtonActive,
                  { backgroundColor: searchMode === 'simple' ? colors.primary : colors.card }
                ]}
                onPress={() => {
                  setSearchMode('simple');
                  setHasSearched(false);
                  setSearchResults([]);
                  setAiResponse('');
                }}
              >
                <IconSymbol 
                  name="magnifyingglass" 
                  size={18} 
                  color={searchMode === 'simple' ? '#FFFFFF' : colors.text} 
                />
                <Text style={[
                  styles.modeButtonText,
                  { color: searchMode === 'simple' ? '#FFFFFF' : colors.text }
                ]}>
                  Simple Tool Search
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeButton,
                  searchMode === 'advanced' && styles.modeButtonActive,
                  { backgroundColor: searchMode === 'advanced' ? colors.primary : colors.card }
                ]}
                onPress={() => {
                  setSearchMode('advanced');
                  setHasSearched(false);
                  setSearchResults([]);
                  setAiResponse('');
                }}
              >
                <IconSymbol 
                  name="sparkles" 
                  size={18} 
                  color={searchMode === 'advanced' ? '#FFFFFF' : colors.text} 
                />
                <Text style={[
                  styles.modeButtonText,
                  { color: searchMode === 'advanced' ? '#FFFFFF' : colors.text }
                ]}>
                  Advanced Search
                </Text>
              </Pressable>
            </View>

            {/* Search Section */}
            <View style={styles.searchSection}>
              {searchMode === 'simple' ? (
                <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
                  <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search for a tool, bin, or location..."
                    placeholderTextColor={colors.textSecondary}
                    value={simpleSearchQuery}
                    onChangeText={setSimpleSearchQuery}
                    onSubmitEditing={searchToolsSimple}
                    returnKeyType="search"
                  />
                  {simpleSearchQuery.length > 0 && (
                    <Pressable onPress={() => setSimpleSearchQuery('')}>
                      <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              ) : (
                <View style={[styles.advancedSearchContainer, { backgroundColor: colors.card }]}>
                  <View style={styles.advancedSearchHeader}>
                    <IconSymbol name="sparkles" size={20} color={colors.primary} />
                    <Text style={[styles.advancedSearchLabel, { color: colors.text }]}>
                      Advanced Search
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.advancedSearchInput, { color: colors.text }]}
                    placeholder="What would be good to use for removing drywall?"
                    placeholderTextColor={colors.textSecondary}
                    value={advancedSearchQuery}
                    onChangeText={setAdvancedSearchQuery}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  {advancedSearchQuery.length > 0 && (
                    <Pressable 
                      style={styles.clearButton}
                      onPress={() => setAdvancedSearchQuery('')}
                    >
                      <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              )}
              <Pressable
                style={[styles.searchButton, (!canSearch || searching) && styles.searchButtonDisabled]}
                onPress={searchMode === 'simple' ? searchToolsSimple : searchToolsAdvanced}
                disabled={!canSearch || searching}
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
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              removeClippedSubviews={false}
            >
              {!hasSearched ? (
                <View style={styles.emptyState}>
                  <IconSymbol 
                    name={searchMode === 'simple' ? 'magnifyingglass' : 'sparkles'} 
                    size={64} 
                    color={colors.textSecondary} 
                  />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {searchMode === 'simple' ? 'Find Your Tools' : 'AI-Powered Tool Search'}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {searchMode === 'simple' 
                      ? 'Search for any tool, bin name, or location to quickly find where your tools are stored'
                      : 'Ask questions like "What tools do I need for drywall work?" and get AI-powered recommendations from your inventory'
                    }
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
                  <Text style={[styles.loadingText, { color: colors.text }]}>
                    {searchMode === 'simple' ? 'Searching...' : 'AI is analyzing your inventory...'}
                  </Text>
                </View>
              ) : searchMode === 'advanced' && aiResponse ? (
                <View style={styles.aiResponseContainer}>
                  <View style={styles.aiResponseHeader}>
                    <IconSymbol name="sparkles" size={24} color={colors.primary} />
                    <Text style={[styles.aiResponseTitle, { color: colors.text }]}>
                      AI Recommendation
                    </Text>
                  </View>
                  <View style={[styles.aiResponseCard, { backgroundColor: colors.card }]}>
                    {renderAIResponse(aiResponse)}
                  </View>
                  <Pressable style={styles.viewInventoryButton} onPress={openViewInventory}>
                    <IconSymbol name="tray.fill" size={20} color={colors.primary} />
                    <Text style={[styles.viewInventoryText, { color: colors.primary }]}>
                      View Full Inventory
                    </Text>
                  </Pressable>
                </View>
              ) : searchMode === 'simple' && searchResults.length === 0 ? (
                <View style={styles.emptyState}>
                  <IconSymbol name="exclamationmark.triangle.fill" size={64} color={colors.textSecondary} />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No Results Found</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    We couldn&apos;t find any tools, bins, or locations matching &quot;{simpleSearchQuery}&quot;
                  </Text>
                  <Pressable style={styles.viewInventoryButton} onPress={openViewInventory}>
                    <IconSymbol name="tray.fill" size={20} color={colors.primary} />
                    <Text style={[styles.viewInventoryText, { color: colors.primary }]}>
                      View Full Inventory
                    </Text>
                  </Pressable>
                </View>
              ) : searchMode === 'simple' && searchResults.length > 0 ? (
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
              ) : null}

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
  modeToggleContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  modeButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  advancedSearchContainer: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  advancedSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  advancedSearchLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  advancedSearchInput: {
    fontSize: 16,
    minHeight: 80,
    maxHeight: 120,
  },
  clearButton: {
    position: 'absolute',
    top: 16,
    right: 16,
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
  aiResponseContainer: {
    flex: 1,
  },
  aiResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  aiResponseTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  aiResponseCard: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
  },
  aiResponseText: {
    fontSize: 16,
    lineHeight: 24,
  },
  binLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
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
