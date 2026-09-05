
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "expo-router/react-navigation";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from "@/app/integrations/supabase/client";
import { Stack, useRouter, useFocusEffect, useLocalSearchParams, usePathname } from "expo-router";
import { getDeviceId } from "@/utils/deviceId";
import {
  groupBins,
  distinctBinCount,
  binCountByLocation,
  toolLabel,
  planRowUpdates,
  type MergedBin,
  type EditedTool,
} from "@/utils/mergeBins";
import { useNavigation } from "@/contexts/NavigationContext";
import ImageGalleryModal from "@/components/ImageGalleryModal";
const CHECKED_OUT_LOCATION = "__CHECKED_OUT__";
const CHECKED_OUT_BIN_NAME = "Checked Out Tools";

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
  const [editingBin, setEditingBin] = useState<MergedBin | null>(null);
  const [editedTools, setEditedTools] = useState<EditedTool[]>([]);
  const [editedBinName, setEditedBinName] = useState('');
  const [editedBinLocation, setEditedBinLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  const [currentFilterBinId, setCurrentFilterBinId] = useState<string | null>(null);
  const [locationsModalVisible, setLocationsModalVisible] = useState(false);
  const [binsModalVisible, setBinsModalVisible] = useState(false);
  const [binsInLocationModalVisible, setBinsInLocationModalVisible] = useState(false);
  const [binsInLocationName, setBinsInLocationName] = useState<string | null>(null);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string | null>(null);
  const [checkOutModalVisible, setCheckOutModalVisible] = useState(false);
  const [checkOutBin, setCheckOutBin] = useState<MergedBin | null>(null);
  // Track if we've processed the initial navigation for this focus session
  const hasProcessedNavigationRef = React.useRef(false);
  const params = useLocalSearchParams();
  const router = useRouter();
  const navContext = useNavigation();
  const pathname = usePathname();
  
  // Process navigation context ONLY when screen gains focus (no dependencies)
  // This ensures the callback only runs on actual focus, not on context changes
  useFocusEffect(
    useCallback(() => {
      console.log('📋 Inventory screen focused');
      
      // Read the current context value at focus time
      const filterBinId = navContext.filterBinId;
      
      console.log('📋 Navigation context at focus:', {
        returnToSearch: navContext.returnToSearch,
        filterBinId: filterBinId,
        editBinId: navContext.editBinId,
        currentFilterBinId: currentFilterBinId,
        hasProcessed: hasProcessedNavigationRef.current
      });
      
      // Process the filter from context
      if (filterBinId) {
        // User navigated with a specific bin filter - apply it
        console.log('🔍 Applying filter from navigation:', filterBinId);
        setCurrentFilterBinId(filterBinId);
      } else {
        // User navigated without a filter (e.g., "View Full Inventory")
        console.log('🔍 No filter in navigation - showing all inventory');
        setCurrentFilterBinId(null);
      }
      
      hasProcessedNavigationRef.current = true;
      
      // Reset when screen loses focus
      return () => {
        console.log('📋 Inventory screen losing focus');
        hasProcessedNavigationRef.current = false;
      };
    }, []) // Empty deps - only run on actual focus/blur
  );

  // Debug returnToSearch state changes
  useEffect(() => {
    console.log('🔄 returnToSearch changed to:', navContext.returnToSearch);
  }, [navContext.returnToSearch]);

  // Zoom and pan state
  // Merge rows that share a bin name + location into a single logical bin for
  // display. Zero DB changes — the underlying rows are untouched; this only
  // controls what the user sees. See utils/mergeBins.ts.
  const mergedBins = React.useMemo(() => groupBins(inventory as any), [inventory]);

  useEffect(() => {
    if (navContext.editBinId && mergedBins.length > 0) {
      const binToEdit = mergedBins.find(bin => bin.rowIds.includes(navContext.editBinId!));
      if (binToEdit) {
        openEditModal(binToEdit);
        // Clear it after opening so it doesn't reopen
        navContext.setEditBinId(null);
      }
    }
  }, [navContext.editBinId, mergedBins]);

  // Handle filter updates while screen is visible (e.g., if context changes without navigation)
  // This only applies a NEW filter, never clears (clearing only happens on navigation via useFocusEffect)
  useEffect(() => {
    // Only update if we have a NEW filter that's different from current
    // AND we've already processed the initial navigation
    if (hasProcessedNavigationRef.current && 
        navContext.filterBinId && 
        navContext.filterBinId !== currentFilterBinId) {
      console.log('🔍 FilterBinId changed while on screen:', navContext.filterBinId);
      setCurrentFilterBinId(navContext.filterBinId);
    }
    // Note: We intentionally DON'T clear when filterBinId becomes null here
    // because that happens after successful filter application (setTimeout in filter effect)
    // Clearing is only done in useFocusEffect when user navigates TO the screen with null
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

      // Filter out the checked-out bin from regular inventory view
      const regularInventory = (data || []).filter(
        item => item.bin_location !== CHECKED_OUT_LOCATION
      );

      console.log(`✅ Loaded ${regularInventory.length} items (excluding checked-out)`);
      setInventory(regularInventory);
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

  // Compute unique locations from inventory (count DISTINCT bins per location,
  // not raw rows, so merged duplicates don't inflate the count).
  const uniqueLocations = React.useMemo(() => {
    const counts = binCountByLocation(inventory as any);
    return Array.from(counts.entries())
      .map(([name, binCount]) => ({ name, binCount }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory]);

  const totalLocations = uniqueLocations.length;

  // Merged bins within a selected location, sorted alphabetically
  const binsForSelectedLocation = React.useMemo(() => {
    if (!binsInLocationName) return [];
    return mergedBins
      .filter(bin => (bin.bin_location || 'Unspecified') === binsInLocationName)
      .sort((a, b) => a.bin_name.localeCompare(b.bin_name));
  }, [mergedBins, binsInLocationName]);

  // Merged bins to render as cards, respecting active filters. A single-bin
  // filter (from Find Tool) carries one row id; match the whole group that
  // contains that row. If the id no longer matches anything, show all bins.
  const displayMergedBins = React.useMemo(() => {
    let groups = mergedBins;
    if (currentFilterBinId) {
      const match = groups.filter(bin => bin.rowIds.includes(currentFilterBinId));
      if (match.length > 0) groups = match;
    }
    if (selectedLocationFilter) {
      groups = groups.filter(
        bin => (bin.bin_location || 'Unspecified') === selectedLocationFilter
      );
    }
    return groups;
  }, [mergedBins, currentFilterBinId, selectedLocationFilter]);

  // Handle location selection — show bins in that location
  const handleLocationSelect = (locationName: string) => {
    setLocationsModalVisible(false);
    setBinsInLocationName(locationName);
    setBinsInLocationModalVisible(true);
  };

  // Handle bin selection from the bins-in-location modal
  const handleBinFromLocationSelect = (binId: string) => {
    setBinsInLocationModalVisible(false);
    setBinsInLocationName(null);
    setSelectedLocationFilter(null);
    setCurrentFilterBinId(binId);
  };

  // Handle bin selection from bins modal
  const handleBinSelect = (binId: string) => {
    setBinsModalVisible(false);
    // Clear location filter when selecting a specific bin to avoid conflicts
    setSelectedLocationFilter(null);
    setCurrentFilterBinId(binId);
  };

  // Clear all filters
  const clearLocationFilter = () => {
    setSelectedLocationFilter(null);
  };

  const clearAllFilters = () => {
    setSelectedLocationFilter(null);
    setCurrentFilterBinId(null);
  };

  const openEditModal = (bin: MergedBin) => {
    setEditingBin(bin);
    // Flatten all tools across the merged bin, keeping each tool's source row
    // so we can write edits back to the correct underlying row on save.
    setEditedTools(bin.tools.map(t => ({ value: toolLabel(t.value), rowId: t.rowId })));
    setEditedBinName(bin.bin_name);
    setEditedBinLocation(bin.bin_location);
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingBin(null);
    setEditedTools([]);
    setEditedBinName('');
    setEditedBinLocation('');
  };

  const addNewTool = () => {
    // New tools have no source row yet; they get assigned to the bin's
    // representative row on save.
    setEditedTools([...editedTools, { value: '', rowId: null }]);
  };

  const removeTool = (index: number) => {
    const newTools = editedTools.filter((_, i) => i !== index);
    setEditedTools(newTools);
  };

  const updateTool = (index: number, newValue: string) => {
    const newTools = [...editedTools];
    newTools[index] = { ...newTools[index], value: newValue };
    setEditedTools(newTools);
  };

  const saveChanges = async () => {
    if (!editingBin) return;

    const filteredTools = editedTools.filter(tool => tool.value.trim().length > 0);

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

      // Distribute the edited tool list back to the underlying rows this bin
      // was merged from. Rows left with no tools are deleted.
      const plan = planRowUpdates(editingBin, editedTools);
      const newName = editedBinName.trim();
      const newLocation = editedBinLocation.trim();

      for (const update of plan.updates) {
        const { error } = await supabase
          .from('tool_inventory')
          .update({
            tools: update.tools,
            bin_name: newName,
            bin_location: newLocation,
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);

        if (error) {
          console.error('❌ Error updating row', update.id, error);
          Alert.alert('Error', 'Failed to update inventory');
          return;
        }
      }

      if (plan.deletes.length > 0) {
        const { error: deleteError } = await supabase
          .from('tool_inventory')
          .delete()
          .in('id', plan.deletes);

        if (deleteError) {
          console.error('❌ Error removing emptied rows:', deleteError);
          Alert.alert('Error', 'Failed to update inventory');
          return;
        }
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

  const deleteBin = async (bin: MergedBin) => {
    const toolWord = bin.toolCount === 1 ? 'tool' : 'tools';
    Alert.alert(
      'Delete Bin',
      `Are you sure you want to delete "${bin.bin_name}" and all ${bin.toolCount} ${toolWord}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = await getSupabaseClient();
              // Remove every underlying row that was merged into this bin.
              const { error } = await supabase
                .from('tool_inventory')
                .delete()
                .in('id', bin.rowIds);

              if (error) {
                console.error('❌ Error deleting:', error);
                Alert.alert('Error', 'Failed to delete bin');
                return;
              }

              console.log('✅ Deleted successfully');
              loadInventory();
            } catch (error) {
              console.error('❌ Error:', error);
              Alert.alert('Error', 'Failed to delete bin');
            }
          },
        },
      ]
    );
  };

  const openCheckOutModal = (bin: MergedBin) => {
    setCheckOutBin(bin);
    setCheckOutModalVisible(true);
  };

  const closeCheckOutModal = () => {
    setCheckOutModalVisible(false);
    setCheckOutBin(null);
  };

  const handleCheckOut = async (mergedToolIndex: number) => {
    if (!checkOutBin) return;

    try {
      console.log(`📤 Checking out tool at merged index ${mergedToolIndex}`);
      const mergedTool = checkOutBin.tools[mergedToolIndex];
      if (!mergedTool) return;

      // Locate the exact underlying row + position this tool came from.
      const sourceRow = checkOutBin.sourceRows.find(r => r.id === mergedTool.rowId);
      if (!sourceRow) {
        console.error('❌ Source row not found for checked-out tool');
        Alert.alert('Error', 'Failed to check out tool');
        return;
      }

      // Parse tool if it has quantity
      const toolToCheckOut = mergedTool.value;
      let toolName: any = toolToCheckOut;
      let quantity = 1;
      if (toolToCheckOut && typeof toolToCheckOut === 'object' && 'name' in toolToCheckOut) {
        toolName = (toolToCheckOut as any).name;
        quantity = (toolToCheckOut as any).quantity || 1;
      }

      const supabase = await getSupabaseClient();
      const deviceId = await getDeviceId();

      // Remove just this tool instance from its source row
      const sourceTools = Array.isArray(sourceRow.tools) ? sourceRow.tools : [];
      const updatedTools = sourceTools.filter((_: any, i: number) => i !== mergedTool.indexInRow);

      if (updatedTools.length === 0) {
        // If that row is now empty, delete it
        const { error: deleteError } = await supabase
          .from('tool_inventory')
          .delete()
          .eq('id', sourceRow.id);

        if (deleteError) {
          console.error('❌ Error deleting empty bin:', deleteError);
          Alert.alert('Error', 'Failed to check out tool');
          return;
        }
      } else {
        // Update the source row
        const { error: updateError } = await supabase
          .from('tool_inventory')
          .update({ tools: updatedTools })
          .eq('id', sourceRow.id);

        if (updateError) {
          console.error('❌ Error updating bin:', updateError);
          Alert.alert('Error', 'Failed to check out tool');
          return;
        }
      }

      // Find or create checked-out bin
      const { data: checkedOutBin, error: fetchError } = await supabase
        .from('tool_inventory')
        .select('*')
        .eq('device_id', deviceId)
        .eq('bin_location', CHECKED_OUT_LOCATION)
        .eq('bin_name', CHECKED_OUT_BIN_NAME)
        .single();

      const checkedOutTool = {
        name: toolName,
        quantity: quantity,
        original_location: checkOutBin.bin_location,
        original_bin: checkOutBin.bin_name,
        checked_out_date: new Date().toISOString(),
      };

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error fetching checked-out bin:', fetchError);
        Alert.alert('Error', 'Failed to check out tool');
        return;
      }

      if (checkedOutBin) {
        // Add to existing checked-out bin
        const currentTools = Array.isArray(checkedOutBin.tools) ? checkedOutBin.tools : [];
        const { error: updateCheckedOutError } = await supabase
          .from('tool_inventory')
          .update({ tools: [...currentTools, checkedOutTool] })
          .eq('id', checkedOutBin.id);

        if (updateCheckedOutError) {
          console.error('❌ Error updating checked-out bin:', updateCheckedOutError);
          Alert.alert('Error', 'Failed to check out tool');
          return;
        }
      } else {
        // Create new checked-out bin
        const { error: createError } = await supabase
          .from('tool_inventory')
          .insert({
            device_id: deviceId,
            bin_name: CHECKED_OUT_BIN_NAME,
            bin_location: CHECKED_OUT_LOCATION,
            tools: [checkedOutTool],
            image_url: sourceRow.image_url,
          });

        if (createError) {
          console.error('❌ Error creating checked-out bin:', createError);
          Alert.alert('Error', 'Failed to check out tool');
          return;
        }
      }

      Alert.alert('Success', `"${toolName}" has been checked out`);
      closeCheckOutModal();
      loadInventory();
      console.log('✅ Tool checked out successfully');
    } catch (error) {
      console.error('❌ Error in handleCheckOut:', error);
      Alert.alert('Error', 'Failed to check out tool');
    }
  };

  // Open the full-screen swipeable gallery starting at a specific image.
  const openGallery = (urls: string[], index: number) => {
    const clean = (urls || []).filter(Boolean);
    if (clean.length === 0) return;
    setGalleryImages(clean);
    setGalleryIndex(Math.max(0, Math.min(index, clean.length - 1)));
    setGalleryVisible(true);
  };

  const closeGallery = () => {
    setGalleryVisible(false);
  };

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
                  hasProcessedNavigationRef.current = false;
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
            {mergedBins.length === 0 ? (
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
                <Pressable 
                  style={[styles.statCard, styles.statCardTappable, { backgroundColor: colors.card }]}
                  onPress={() => setLocationsModalVisible(true)}
                >
                  <IconSymbol name="location.fill" size={24} color="#34C759" />
                  <Text style={[styles.statNumber, { color: colors.text }]}>{totalLocations}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Locations</Text>
                </Pressable>
                <Pressable 
                  style={[styles.statCard, styles.statCardTappable, { backgroundColor: colors.card }]}
                  onPress={() => setBinsModalVisible(true)}
                >
                  <IconSymbol name="tray.fill" size={24} color={colors.primary} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>{mergedBins.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Bins</Text>
                </Pressable>
                <View style={[styles.statCard, { backgroundColor: colors.card }]}>
                  <IconSymbol name="wrench.fill" size={24} color={colors.accent} />
                  <Text style={[styles.statNumber, { color: colors.text }]}>
                    {inventory.reduce((sum, item) => sum + item.tools.length, 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tools</Text>
                </View>
              </View>

              {/* Active Filter Indicator */}
              {selectedLocationFilter && (
                <View style={[styles.filterIndicator, { backgroundColor: colors.card }]}>
                  <IconSymbol name="location.fill" size={16} color="#34C759" />
                  <Text style={[styles.filterText, { color: colors.text }]}>
                    Showing bins in: {selectedLocationFilter}
                  </Text>
                  <Pressable onPress={clearAllFilters} style={styles.clearFilterButton}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              )}
              {currentFilterBinId && !selectedLocationFilter && (
                <View style={[styles.filterIndicator, { backgroundColor: colors.card }]}>
                  <IconSymbol name="tray.fill" size={16} color={colors.primary} />
                  <Text style={[styles.filterText, { color: colors.text }]}>
                    Showing single bin: {inventory.find(i => i.id === currentFilterBinId)?.bin_name || 'Selected bin'}
                  </Text>
                  <Pressable onPress={clearAllFilters} style={styles.clearFilterButton}>
                    <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                  </Pressable>
                </View>
              )}

              {displayMergedBins.map((bin) => (
                <View key={bin.id} style={[styles.card, { backgroundColor: colors.card }]}>
                  {bin.images.length <= 1 ? (
                    <Pressable onPress={() => openGallery(bin.images.map(x => x.url), 0)}>
                      <Image source={{ uri: bin.images[0]?.url }} style={styles.cardImage} />
                    </Pressable>
                  ) : (
                    <View style={styles.collageContainer}>
                      {bin.images.slice(0, 4).map((img, i) => {
                        const showMore = i === 3 && bin.images.length > 4;
                        return (
                          <Pressable
                            key={`${img.rowId}_${i}`}
                            style={styles.collageTile}
                            onPress={() => openGallery(bin.images.map(x => x.url), i)}
                          >
                            <Image source={{ uri: img.url }} style={styles.collageImage} />
                            {showMore && (
                              <View style={styles.collageOverlay}>
                                <Text style={styles.collageOverlayText}>
                                  +{bin.images.length - 4}
                                </Text>
                              </View>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.binInfo}>
                        <IconSymbol name="archivebox.fill" size={20} color={colors.primary} />
                        <Text style={[styles.binName, { color: colors.text }]}>{bin.bin_name}</Text>
                      </View>
                      <View style={styles.cardActions}>
                        <Pressable
                          onPress={() => openCheckOutModal(bin)}
                          style={styles.iconButton}
                        >
                          <IconSymbol name="arrow.up.circle.fill" size={20} color="#34C759" />
                        </Pressable>
                        <Pressable
                          onPress={() => openEditModal(bin)}
                          style={styles.iconButton}
                        >
                          <IconSymbol name="pencil" size={20} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          onPress={() => deleteBin(bin)}
                          style={styles.iconButton}
                        >
                          <IconSymbol name="trash" size={20} color="#FF3B30" />
                        </Pressable>
                      </View>
                    </View>

                    <View style={styles.locationRow}>
                      <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
                      <Text style={[styles.location, { color: colors.textSecondary }]}>
                        {bin.bin_location}
                      </Text>
                    </View>

                    <View style={styles.toolsContainer}>
                      <Text style={[styles.toolsTitle, { color: colors.text }]}>Tools:</Text>
                      {bin.tools.map((tool, index) => (
                        <View key={index} style={styles.toolRow}>
                          <Text style={[styles.toolBullet, { color: colors.primary }]}>•</Text>
                          <Text style={[styles.toolText, { color: colors.text }]}>
                            {toolLabel(tool.value)}
                          </Text>
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

                    {editingBin && editingBin.images.length <= 1 && (
                      <Pressable onPress={() => editingBin && openGallery(editingBin.images.map(x => x.url), 0)}>
                        <Image source={{ uri: editingBin.images[0]?.url }} style={styles.modalImage} />
                      </Pressable>
                    )}
                    {editingBin && editingBin.images.length > 1 && (
                      <View style={styles.modalCollageContainer}>
                        {editingBin.images.map((img, i) => (
                          <Pressable
                            key={`${img.rowId}_${i}`}
                            style={styles.modalCollageTile}
                            onPress={() => editingBin && openGallery(editingBin.images.map(x => x.url), i)}
                          >
                            <Image source={{ uri: img.url }} style={styles.modalCollageImage} />
                          </Pressable>
                        ))}
                      </View>
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
                          value={tool.value}
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

      {/* Check Out Modal */}
      <Modal
        visible={checkOutModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeCheckOutModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Check Out Tool</Text>
              <Pressable onPress={closeCheckOutModal} style={styles.modalCloseButton}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>

            {checkOutBin && (
              <>
                <View style={[styles.checkOutBinInfo, { backgroundColor: colors.background }]}>
                  <Text style={[styles.checkOutBinName, { color: colors.text }]}>
                    {checkOutBin.bin_name}
                  </Text>
                  <Text style={[styles.checkOutBinLocation, { color: colors.textSecondary }]}>
                    {checkOutBin.bin_location}
                  </Text>
                </View>

                <Text style={[styles.checkOutInstructions, { color: colors.textSecondary }]}>
                  Select a tool to check out:
                </Text>

                <ScrollView style={styles.checkOutToolsList}>
                  {checkOutBin.tools.map((tool, index) => {
                    const value = tool.value;
                    const toolName = typeof value === 'string' ? value : (value as any).name || value;
                    const toolQuantity =
                      value && typeof value === 'object' && 'quantity' in value
                        ? (value as any).quantity
                        : null;

                    return (
                      <Pressable
                        key={index}
                        style={[styles.checkOutToolItem, { backgroundColor: colors.background }]}
                        onPress={() => handleCheckOut(index)}
                      >
                        <View style={styles.checkOutToolInfo}>
                          <IconSymbol name="wrench.fill" size={18} color={colors.primary} />
                          <Text style={[styles.checkOutToolName, { color: colors.text }]}>
                            {toolName}
                          </Text>
                          {toolQuantity && toolQuantity > 1 && (
                            <Text style={[styles.checkOutToolQuantity, { color: colors.textSecondary }]}>
                              × {toolQuantity}
                            </Text>
                          )}
                        </View>
                        <IconSymbol name="arrow.right" size={18} color={colors.textSecondary} />
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Full Screen Swipeable Image Gallery */}
      <ImageGalleryModal
        images={galleryImages}
        initialIndex={galleryIndex}
        visible={galleryVisible}
        onClose={closeGallery}
      />

      {/* Locations List Modal */}
      <Modal
        visible={locationsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLocationsModalVisible(false)}
      >
        <View style={styles.listModalOverlay}>
          <View style={[styles.listModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.listModalHeader}>
              <Text style={[styles.listModalTitle, { color: colors.text }]}>Locations</Text>
              <Pressable onPress={() => setLocationsModalVisible(false)} style={styles.modalCloseButton}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.listModalScroll} showsVerticalScrollIndicator={false}>
              {uniqueLocations.length === 0 ? (
                <View style={styles.emptyListContainer}>
                  <IconSymbol name="location.slash" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                    No locations found
                  </Text>
                </View>
              ) : (
                uniqueLocations.map((location, index) => (
                  <Pressable
                    key={location.name}
                    style={[
                      styles.listItem,
                      { backgroundColor: colors.background },
                      index === uniqueLocations.length - 1 && styles.listItemLast
                    ]}
                    onPress={() => handleLocationSelect(location.name)}
                  >
                    <View style={styles.listItemLeft}>
                      <IconSymbol name="location.fill" size={24} color="#34C759" />
                      <Text style={[styles.listItemTitle, { color: colors.text }]}>
                        {location.name}
                      </Text>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={[styles.listItemCount, { color: colors.textSecondary }]}>
                        {location.binCount} {location.binCount === 1 ? 'bin' : 'bins'}
                      </Text>
                      <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bins List Modal (All Bins, sorted alphabetically) */}
      <Modal
        visible={binsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBinsModalVisible(false)}
      >
        <View style={styles.listModalOverlay}>
          <View style={[styles.listModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.listModalHeader}>
              <Text style={[styles.listModalTitle, { color: colors.text }]}>All Bins</Text>
              <Pressable onPress={() => setBinsModalVisible(false)} style={styles.modalCloseButton}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.listModalScroll} showsVerticalScrollIndicator={false}>
              {mergedBins.length === 0 ? (
                <View style={styles.emptyListContainer}>
                  <IconSymbol name="tray" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                    No bins found
                  </Text>
                </View>
              ) : (
                [...mergedBins]
                  .sort((a, b) => a.bin_name.localeCompare(b.bin_name))
                  .map((bin, index, arr) => (
                  <Pressable
                    key={bin.id}
                    style={[
                      styles.listItem,
                      { backgroundColor: colors.background },
                      index === arr.length - 1 && styles.listItemLast
                    ]}
                    onPress={() => handleBinSelect(bin.id)}
                  >
                    <View style={styles.listItemLeft}>
                      <Image source={{ uri: bin.images[0]?.url }} style={styles.listItemImage} />
                      <View style={styles.listItemInfo}>
                        <Text style={[styles.listItemTitle, { color: colors.text }]}>
                          {bin.bin_name}
                        </Text>
                        <View style={styles.listItemSubtitle}>
                          <IconSymbol name="location.fill" size={12} color={colors.textSecondary} />
                          <Text style={[styles.listItemLocation, { color: colors.textSecondary }]}>
                            {bin.bin_location || 'Unspecified'}
                          </Text>
                          {bin.images.length > 1 && (
                            <View style={styles.photoBadge}>
                              <IconSymbol name="photo.on.rectangle" size={11} color={colors.primary} />
                              <Text style={[styles.photoBadgeText, { color: colors.primary }]}>
                                {bin.images.length}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.listItemRight}>
                      <Text style={[styles.listItemCount, { color: colors.textSecondary }]}>
                        {bin.toolCount} {bin.toolCount === 1 ? 'tool' : 'tools'}
                      </Text>
                      <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Bins in Location Modal — intermediate hierarchy level */}
      <Modal
        visible={binsInLocationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBinsInLocationModalVisible(false)}
      >
        <View style={styles.listModalOverlay}>
          <View style={[styles.listModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.listModalHeader}>
              <View style={styles.listModalHeaderLeft}>
                <Pressable
                  onPress={() => {
                    setBinsInLocationModalVisible(false);
                    setBinsInLocationName(null);
                    setLocationsModalVisible(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconSymbol name="chevron.left" size={22} color={colors.primary} />
                </Pressable>
                <Text style={[styles.listModalTitle, { color: colors.text }]}>
                  {binsInLocationName || 'Bins'}
                </Text>
              </View>
              <Pressable onPress={() => setBinsInLocationModalVisible(false)} style={styles.modalCloseButton}>
                <IconSymbol name="xmark.circle.fill" size={28} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.listModalScroll} showsVerticalScrollIndicator={false}>
              {binsForSelectedLocation.length === 0 ? (
                <View style={styles.emptyListContainer}>
                  <IconSymbol name="tray" size={48} color={colors.textSecondary} />
                  <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                    No bins in this location
                  </Text>
                </View>
              ) : (
                binsForSelectedLocation.map((bin, index) => (
                  <Pressable
                    key={bin.id}
                    style={[
                      styles.listItem,
                      { backgroundColor: colors.background },
                      index === binsForSelectedLocation.length - 1 && styles.listItemLast
                    ]}
                    onPress={() => handleBinFromLocationSelect(bin.id)}
                  >
                    <View style={styles.listItemLeft}>
                      <Image source={{ uri: bin.images[0]?.url }} style={styles.listItemImage} />
                      <View style={styles.listItemInfo}>
                        <Text style={[styles.listItemTitle, { color: colors.text }]}>
                          {bin.bin_name}
                        </Text>
                        <Text style={[styles.listItemToolCount, { color: colors.textSecondary }]}>
                          {bin.toolCount} {bin.toolCount === 1 ? 'tool' : 'tools'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.listItemRight}>
                      <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                    </View>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
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
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
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
  collageContainer: {
    width: '100%',
    height: 200,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.background,
  },
  collageTile: {
    width: '50%',
    height: 100,
    padding: 1,
  },
  collageImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.background,
  },
  collageOverlay: {
    position: 'absolute',
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collageOverlayText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
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
  modalCollageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    marginHorizontal: -3,
  },
  modalCollageTile: {
    width: '50%',
    padding: 3,
  },
  modalCollageImage: {
    width: '100%',
    height: 110,
    borderRadius: 10,
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
  // Tappable stat card styles
  statCardTappable: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  // Filter indicator styles
  filterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  filterText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  clearFilterButton: {
    padding: 4,
  },
  // List modal styles
  listModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  listModalContent: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  listModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  listModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  listModalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  listModalScroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  listItemLast: {
    marginBottom: 16,
  },
  listItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listItemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  listItemCount: {
    fontSize: 14,
  },
  listItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  listItemInfo: {
    flex: 1,
    gap: 4,
  },
  listItemSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listItemLocation: {
    fontSize: 13,
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: 6,
  },
  photoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listItemToolCount: {
    fontSize: 13,
  },
  emptyListContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 16,
  },
  emptyListText: {
    fontSize: 16,
    textAlign: 'center',
  },
  // Check-out modal styles
  checkOutBinInfo: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    marginHorizontal: 24,
  },
  checkOutBinName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  checkOutBinLocation: {
    fontSize: 14,
  },
  checkOutInstructions: {
    fontSize: 14,
    marginHorizontal: 24,
    marginBottom: 12,
  },
  checkOutToolsList: {
    maxHeight: 400,
    paddingHorizontal: 24,
  },
  checkOutToolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  checkOutToolInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkOutToolName: {
    fontSize: 16,
    flex: 1,
  },
  checkOutToolQuantity: {
    fontSize: 14,
  },
});
