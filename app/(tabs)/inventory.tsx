
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "@react-navigation/native";
import { colors } from "@/styles/commonStyles";
import { IconSymbol } from "@/components/IconSymbol";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Platform, 
  Pressable, 
  TouchableOpacity,
  Image, 
  Alert, 
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from "@integrations/supabase/client";
import { Stack, useRouter, useFocusEffect, useLocalSearchParams, usePathname } from "expo-router";
import { getDeviceId } from "@/utils/deviceId";
import { useNavigation } from "@/contexts/NavigationContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDecay,
  runOnJS,
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

export default function InventoryScreen() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [inventory, setInventory] = useState<ToolInventoryItem[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<ToolInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ToolInventoryItem | null>(null);
  const [editedTools, setEditedTools] = useState<string[]>([]);
  const [editedBinName, setEditedBinName] = useState('');
  const [editedBinLocation, setEditedBinLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [currentFilterBinId, setCurrentFilterBinId] = useState<string | null>(null);
  const filterBinReadRef = React.useRef(false);
  const params = useLocalSearchParams();
  const router = useRouter();
  const navContext = useNavigation();
  const pathname = usePathname();
  
  // Check navigation context when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('📋 Inventory screen focused');
      console.log('📋 Inventory screen focused');
      console.log('📋 Navigation context:', {
        returnToSearch: navContext.returnToSearch,
        filterBinId: navContext.filterBinId,
        editBinId: navContext.editBinId,
        currentFilterBinId: currentFilterBinId,
        filterBinReadRef: filterBinReadRef.current
      });
      
      // Read filterBinId when screen gains focus (in case screen was already mounted)
      // Only read if we haven't read it yet and it exists
      if (navContext.filterBinId && !filterBinReadRef.current) {
        console.log('🔍 Reading filterBinId on focus:', navContext.filterBinId);
        setCurrentFilterBinId(navContext.filterBinId);
        filterBinReadRef.current = true;
        // Don't clear it here - let the useEffect handle it
      } else if (!navContext.filterBinId && currentFilterBinId && !filterBinReadRef.current) {
        // If context is null but we have a local filter, keep using it (might be applying)
        console.log('🔍 Context filterBinId is null but keeping local filter:', currentFilterBinId);
        filterBinReadRef.current = true;
      }
      
      // Reset the ref when we lose focus (so we can read a new filter next time)
      // But only if we don't have an active filter
      return () => {
        if (!currentFilterBinId) {
          filterBinReadRef.current = false;
        }
      };
    }, [navContext.returnToSearch, navContext.filterBinId, navContext.editBinId, currentFilterBinId])
  );

  // Debug returnToSearch state changes
  useEffect(() => {
    console.log('🔄 returnToSearch changed to:', navContext.returnToSearch);
  }, [navContext.returnToSearch]);

  // Zoom and pan state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  useEffect(() => {
    if (navContext.editBinId && inventory.length > 0) {
      const itemToEdit = inventory.find(item => item.id === navContext.editBinId);
      if (itemToEdit) {
        openEditModal(itemToEdit);
        // Clear it after opening so it doesn't reopen
        navContext.setEditBinId(null);
      }
    }
  }, [navContext.editBinId, inventory]);

  // Read filterBinId from context and store it locally (one-time read)
  useEffect(() => {
    if (navContext.filterBinId) {
      if (!filterBinReadRef.current) {
        console.log('🔍 Received filterBinId from context in useEffect:', navContext.filterBinId);
        setCurrentFilterBinId(navContext.filterBinId);
        filterBinReadRef.current = true;
        console.log('🔍 Stored filterBinId in state:', navContext.filterBinId);
      } else if (currentFilterBinId !== navContext.filterBinId) {
        // If we already read one but context has a different one, update it
        console.log('🔍 Updating filterBinId from context:', navContext.filterBinId, 'old:', currentFilterBinId);
        setCurrentFilterBinId(navContext.filterBinId);
      }
      // Don't clear it yet - wait until filter is successfully applied
    } else if (navContext.filterBinId === null && currentFilterBinId && filterBinReadRef.current) {
      // If context was cleared but we still have a filter, keep it (might be applying)
      console.log('🔍 Context filterBinId cleared but keeping local filter:', currentFilterBinId);
    }
  }, [navContext.filterBinId, currentFilterBinId]);

  // Apply the filter when inventory loads or filter changes
  useEffect(() => {
    console.log('🔍 Filter effect - currentFilterBinId:', currentFilterBinId, 'inventory.length:', inventory.length);
    if (currentFilterBinId) {
      if (inventory.length > 0) {
        console.log('🔍 Filtering inventory by bin ID:', currentFilterBinId);
        console.log('🔍 Available bin IDs in inventory:', inventory.map(i => i.id).slice(0, 5));
        const filtered = inventory.filter(item => item.id === currentFilterBinId);
        console.log('🔍 Filtered to', filtered.length, 'items out of', inventory.length);
        
        // Always set filteredInventory, even if empty, to show we're filtering
        setFilteredInventory(filtered);
        
        if (filtered.length === 0) {
          console.log('⚠️ No items matched filter! Bin ID:', currentFilterBinId);
          console.log('⚠️ Checking if bin ID exists in inventory...');
          const binExists = inventory.some(item => item.id === currentFilterBinId);
          console.log('⚠️ Bin ID exists in inventory:', binExists);
          if (!binExists) {
            console.log('⚠️ Bin ID not found in inventory - this might be a stale or incorrect bin ID from GPT');
            console.log('⚠️ This suggests GPT may have returned an incorrect bin ID. Available bin IDs:', inventory.map(i => i.id).slice(0, 10));
            console.log('⚠️ Available bin names:', inventory.map(i => `${i.bin_name} (${i.bin_location})`).slice(0, 10));
            
            // Show all inventory since we can't match the bin ID
            // The user can manually find the bin they're looking for
            console.log('⚠️ Showing all inventory since bin ID does not exist');
            setFilteredInventory(inventory);
            
            // Clear the invalid filter
            setTimeout(() => {
              if (navContext.filterBinId === currentFilterBinId) {
                console.log('🔍 Clearing invalid filterBinId from context');
                navContext.setFilterBinId(null);
                setCurrentFilterBinId(null);
              }
            }, 1000);
          }
        } else {
          console.log('✅ Found matching bin:', filtered[0].bin_name, filtered[0].bin_location);
          
          // Only clear filterBinId from context after successfully filtering AND showing results
          // Use a small delay to ensure the UI has updated and state has propagated
          setTimeout(() => {
            if (navContext.filterBinId === currentFilterBinId && filtered.length > 0) {
              console.log('🔍 Clearing filterBinId from context after successful filter');
              navContext.setFilterBinId(null);
            }
          }, 500);
        }
      } else {
        console.log('🔍 Inventory not loaded yet, waiting...');
        // Don't update filteredInventory yet - wait for inventory to load
      }
    } else {
      console.log('🔍 No filter - showing all inventory');
      setFilteredInventory(inventory);
    }
  }, [currentFilterBinId, inventory]);

  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [])
  );

  const loadInventory = async () => {
    try {
      console.log('📦 Loading inventory');
      setLoading(true);

      // Get secure Supabase client with device ID header
      const supabase = await getSupabaseClient();
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Query with device_id filter (RLS will also verify via header)
      const { data, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading inventory:', error);
        Alert.alert('Error', 'Failed to load inventory');
        return;
      }

      console.log(`✅ Loaded ${data?.length || 0} items`);
      setInventory(data || []);
    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error', 'Failed to load inventory');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInventory();
  };

  const openEditModal = (item: ToolInventoryItem) => {
    setEditingItem(item);
    setEditedTools([...item.tools]);
    setEditedBinName(item.bin_name);
    setEditedBinLocation(item.bin_location);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingItem(null);
    setEditedTools([]);
    setEditedBinName('');
    setEditedBinLocation('');
  };

  const addNewTool = () => {
    setEditedTools([...editedTools, '']);
  };

  const removeTool = (index: number) => {
    const newTools = editedTools.filter((_, i) => i !== index);
    setEditedTools(newTools);
  };

  const updateTool = (index: number, newValue: string) => {
    const newTools = [...editedTools];
    newTools[index] = newValue;
    setEditedTools(newTools);
  };

  const saveChanges = async () => {
    if (!editingItem) return;

    const filteredTools = editedTools.filter(tool => tool.trim().length > 0);

    if (filteredTools.length === 0) {
      Alert.alert('Error', 'Please add at least one tool');
      return;
    }

    if (!editedBinName.trim()) {
      Alert.alert('Error', 'Please enter a bin name');
      return;
    }

    if (!editedBinLocation.trim()) {
      Alert.alert('Error', 'Please enter a bin location');
      return;
    }

    setSaving(true);

    try {
      const supabase = await getSupabaseClient();
      const { error } = await supabase
        .from('tool_inventory')
        .update({
          tools: filteredTools,
          bin_name: editedBinName.trim(),
          bin_location: editedBinLocation.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingItem.id);

      if (error) {
        console.error('❌ Error updating:', error);
        Alert.alert('Error', 'Failed to update inventory');
        return;
      }

      console.log('✅ Updated successfully');
      Alert.alert('Success', 'Inventory updated successfully');
      closeEditModal();
      loadInventory();
    } catch (error) {
      console.error('❌ Error:', error);
      Alert.alert('Error', 'Failed to update inventory');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this inventory item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = await getSupabaseClient();
              const { error } = await supabase
                .from('tool_inventory')
                .delete()
                .eq('id', id);

              if (error) {
                console.error('❌ Error deleting:', error);
                Alert.alert('Error', 'Failed to delete item');
                return;
              }

              console.log('✅ Deleted successfully');
              loadInventory();
            } catch (error) {
              console.error('❌ Error:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
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

  const renderHeaderRight = () => (
    <Pressable
      onPress={() => router.push('/add-tools')}
      style={{ marginRight: 16 }}
    >
      <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
    </Pressable>
  );

  if (loading) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Inventory',
            headerRight: renderHeaderRight,
          }}
        />
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>Loading inventory...</Text>
          </View>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Inventory',
          headerRight: renderHeaderRight,
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {navContext.returnToSearch && (
          <View 
            style={[styles.backButtonContainer, { paddingTop: insets.top + 8 }]}
          >
            <TouchableOpacity
              onPress={() => {
                console.log('🔙 [INVENTORY] Back to Search button pressed');
                console.log('🔙 [INVENTORY] Current pathname:', pathname);
                console.log('🔙 [INVENTORY] Navigation context BEFORE:', {
                  returnToSearch: navContext.returnToSearch,
                  filterBinId: navContext.filterBinId,
                });
                try {
                  console.log('🔙 [INVENTORY] Returning to Find Tool (stack back)');
                  // Clear state before navigating back
                  navContext.setReturnToSearch(false);
                  setCurrentFilterBinId(null);
                  filterBinReadRef.current = false;
                  router.back();
                  console.log('🔙 [INVENTORY] Back command sent');
                } catch (error) {
                  console.error('❌ [INVENTORY] Navigation error:', error);
                }
              }}
              activeOpacity={0.7}
              style={styles.backButton}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <IconSymbol name="chevron.left" size={24} color={colors.primary} />
              <Text style={[styles.backButtonText, { color: colors.primary }]}>Back to Search</Text>
            </TouchableOpacity>
          </View>
        )}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
            {filteredInventory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="tray.fill" size={64} color={colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Tools Yet</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Start building your inventory by adding your first set of tools
              </Text>
              <Pressable
                style={styles.addButton}
                onPress={() => router.push('/add-tools')}
              >
                <IconSymbol name="plus.circle.fill" size={20} color="#FFFFFF" />
                <Text style={styles.addButtonText}>Add Tools</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.statsContainer}>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <IconSymbol name="tray.fill" size={24} color={colors.primary} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>{inventory.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bins</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <IconSymbol name="wrench.fill" size={24} color={colors.accent} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {inventory.reduce((sum, item) => sum + item.tools.length, 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tools</Text>
                </View>
              </View>

              {filteredInventory.map((item) => (
                <View key={item.id} style={[styles.card, { backgroundColor: colors.card }]}>
                  <Pressable onPress={() => expandImage(item.image_url)}>
                    <Image source={{ uri: item.image_url }} style={styles.cardImage} />
                  </Pressable>
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.binInfo}>
                        <IconSymbol name="archivebox.fill" size={20} color={colors.primary} />
                        <Text style={[styles.binName, { color: colors.text }]}>{item.bin_name}</Text>
                      </View>
                      <View style={styles.cardActions}>
                        <Pressable
                          onPress={() => openEditModal(item)}
                          style={styles.iconButton}
                        >
                          <IconSymbol name="pencil" size={20} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => deleteItem(item.id)}
                          style={styles.iconButton}
                        >
                          <IconSymbol name="trash" size={20} color="#FF3B30" />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.locationRow}>
                      <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
                      <Text style={[styles.location, { color: colors.textSecondary }]}>
                        {item.bin_location}
                      </Text>
                    </View>

                    <View style={styles.toolsContainer}>
                      <Text style={[styles.toolsTitle, { color: colors.text }]}>Tools:</Text>
                      {item.tools.map((tool, index) => (
                        <View key={index} style={styles.toolRow}>
                          <Text style={[styles.toolBullet, { color: colors.primary }]}>•</Text>
                          <Text style={[styles.toolText, { color: colors.text }]}>{tool}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  <ScrollView
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.modalHeader}>
                      <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Inventory</Text>
                      <Pressable onPress={closeEditModal} style={styles.modalCloseButton}>
                        <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
                      </Pressable>
                    </View>

                    {editingItem && (
                      <Pressable onPress={() => expandImage(editingItem.image_url)}>
                        <Image source={{ uri: editingItem.image_url }} style={styles.modalImage} />
                      </Pressable>
                    )}

                    <Text style={[styles.modalLabel, { color: colors.text }]}>Bin Name</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                      value={editedBinName}
                      onChangeText={setEditedBinName}
                      placeholder="Bin name"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <Text style={[styles.modalLabel, { color: colors.text }]}>Bin Location</Text>
                    <TextInput
                      style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                      value={editedBinLocation}
                      onChangeText={setEditedBinLocation}
                      placeholder="Bin location"
                      placeholderTextColor={colors.textSecondary}
                    />

                    <Text style={[styles.modalLabel, { color: colors.text }]}>Tools</Text>
                    {editedTools.map((tool, index) => (
                      <View key={index} style={styles.toolInputRow}>
                        <TextInput
                          style={[styles.toolInput, { backgroundColor: colors.background, color: colors.text }]}
                          value={tool}
                          onChangeText={(text) => updateTool(index, text)}
                          placeholder="Tool name"
                          placeholderTextColor={colors.textSecondary}
                        />
                        <Pressable
                          onPress={() => removeTool(index)}
                          style={styles.removeToolButton}
                        >
                          <IconSymbol name="minus.circle.fill" size={24} color="#FF3B30" />
                        </Pressable>
                      </View>
                    ))}

                    <Pressable onPress={addNewTool} style={styles.addToolButton}>
                      <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
                      <Text style={[styles.addToolText, { color: colors.primary }]}>Add Tool</Text>
                    </Pressable>

                    <View style={styles.modalButtons}>
                      <Pressable
                        style={[styles.modalButton, styles.modalButtonCancel, { backgroundColor: colors.background }]}
                        onPress={closeEditModal}
                      >
                        <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modalButton, styles.modalButtonSave]}
                        onPress={saveChanges}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.modalButtonTextSave}>Save Changes</Text>
                        )}
                      </Pressable>
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

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
  backButtonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 44, // iOS minimum touch target
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
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
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.background,
  },
  toolInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  toolInput: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.background,
  },
  removeToolButton: {
    padding: 4,
  },
  addToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 8,
    marginBottom: 24,
  },
  addToolText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
    borderColor: colors.background,
  },
  modalButtonSave: {
    backgroundColor: colors.accent,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
