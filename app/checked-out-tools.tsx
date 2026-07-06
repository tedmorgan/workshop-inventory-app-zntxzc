
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
  Alert, 
  RefreshControl,
  Image,
  ActivityIndicator,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { getSupabaseClient } from "@/app/integrations/supabase/client";
import { getDeviceId } from "@/utils/deviceId";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CHECKED_OUT_LOCATION = "__CHECKED_OUT__";
const CHECKED_OUT_BIN_NAME = "Checked Out Tools";

type CheckedOutTool = {
  name: string;
  quantity?: number;
  original_location: string;
  original_bin: string;
  checked_out_date: string;
  image_url?: string;
};

type CheckedOutBin = {
  id: string;
  tools: CheckedOutTool[];
  created_at: string;
  device_id: string;
};

export default function CheckedOutToolsScreen() {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [checkedOutTools, setCheckedOutTools] = useState<CheckedOutTool[]>([]);
  const [binId, setBinId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadCheckedOutTools();
  }, []);

  const loadCheckedOutTools = async () => {
    try {
      setLoading(true);
      console.log('📦 Loading checked out tools');

      const supabase = await getSupabaseClient();
      const deviceId = await getDeviceId();

      const { data, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .eq('device_id', deviceId)
        .eq('bin_location', CHECKED_OUT_LOCATION)
        .eq('bin_name', CHECKED_OUT_BIN_NAME)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Error loading checked out tools:', error);
        return;
      }

      if (data) {
        setBinId(data.id);
        const tools = Array.isArray(data.tools) ? data.tools : [];
        setCheckedOutTools(tools);
        console.log(`✅ Loaded ${tools.length} checked out tools`);
      } else {
        setCheckedOutTools([]);
        console.log('✅ No checked out tools found');
      }
    } catch (error) {
      console.error('❌ Error in loadCheckedOutTools:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCheckedOutTools();
    setRefreshing(false);
  }, []);

  const handleCheckIn = async (tool: CheckedOutTool, index: number) => {
    try {
      console.log(`📥 Checking in tool: ${tool.name}`);
      
      // Show alert with location info
      Alert.alert(
        'Check In Tool',
        `Return "${tool.name}" to:\n\nLocation: ${tool.original_location}\nBin: ${tool.original_bin}`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Confirm Check In',
            onPress: async () => {
              await performCheckIn(tool, index);
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error in handleCheckIn:', error);
      Alert.alert('Error', 'Failed to check in tool');
    }
  };

  const performCheckIn = async (tool: CheckedOutTool, index: number) => {
    try {
      const supabase = await getSupabaseClient();
      const deviceId = await getDeviceId();

      // Fetch all bins for this device and match flexibly.
      // The old exact-match + .single() lookup failed when the bin name/location
      // had different casing/whitespace, when duplicate bins existed, or when
      // the original bin was deleted after being emptied at check-out.
      const { data: allBins, error: fetchError } = await supabase
        .from('tool_inventory')
        .select('*')
        .eq('device_id', deviceId);

      if (fetchError) {
        console.error(`[${new Date().toISOString()}] ❌ Error fetching bins for check-in:`, fetchError);
        Alert.alert('Error', 'Failed to load inventory. Please try again.');
        return;
      }

      const normalize = (s: string | null | undefined) => (s || '').trim().toLowerCase();
      const regularBins = (allBins || []).filter(
        (b) => b.bin_location !== CHECKED_OUT_LOCATION
      );

      console.log(
        `[${new Date().toISOString()}] 📥 Check-in lookup for "${tool.name}" → target bin "${tool.original_bin}" @ "${tool.original_location}". ` +
        `Fetched ${allBins?.length ?? 0} rows, ${regularBins.length} regular bins.`
      );

      // Try exact match first, then case/whitespace-insensitive, then name-only
      let originalBinData =
        regularBins.find(
          (b) => b.bin_name === tool.original_bin && b.bin_location === tool.original_location
        ) ||
        regularBins.find(
          (b) =>
            normalize(b.bin_name) === normalize(tool.original_bin) &&
            normalize(b.bin_location) === normalize(tool.original_location)
        ) ||
        regularBins.find((b) => normalize(b.bin_name) === normalize(tool.original_bin));

      console.log(
        `[${new Date().toISOString()}] 📥 Match result: ${originalBinData ? `found bin id ${originalBinData.id}` : 'no match — will recreate'}`
      );

      if (!originalBinData) {
        // Original bin no longer exists (it was deleted when its last tool was
        // checked out) — recreate it so the tool has a home to return to.
        console.log(`[${new Date().toISOString()}] 📦 Original bin not found — recreating "${tool.original_bin}" at "${tool.original_location}"`);
        const { data: recreatedBin, error: createError } = await supabase
          .from('tool_inventory')
          .insert({
            device_id: deviceId,
            bin_name: tool.original_bin,
            bin_location: tool.original_location,
            tools: [],
            image_url: tool.image_url || '',
          })
          .select()
          .single();

        if (createError || !recreatedBin) {
          console.error(`[${new Date().toISOString()}] ❌ Error recreating original bin:`, createError);
          Alert.alert('Error', 'Could not find or recreate the original bin. Please try again.');
          return;
        }
        originalBinData = recreatedBin;
      }

      // Add tool back to original bin
      const originalTools = Array.isArray(originalBinData.tools) ? originalBinData.tools : [];
      
      // Check if tool already exists in bin (merge quantities if so)
      const existingToolIndex = originalTools.findIndex((t: any) => 
        typeof t === 'string' ? t === tool.name : t.name === tool.name
      );

      let updatedOriginalTools;
      if (existingToolIndex >= 0) {
        // Tool exists, increase quantity
        updatedOriginalTools = [...originalTools];
        const existingTool = updatedOriginalTools[existingToolIndex];
        if (typeof existingTool === 'string') {
          // Convert to object and add quantity
          updatedOriginalTools[existingToolIndex] = {
            name: existingTool,
            quantity: 1 + (tool.quantity || 1),
          };
        } else {
          // Increase existing quantity
          updatedOriginalTools[existingToolIndex] = {
            ...existingTool,
            quantity: (existingTool.quantity || 1) + (tool.quantity || 1),
          };
        }
      } else {
        // Tool doesn't exist, add it
        updatedOriginalTools = [
          ...originalTools,
          tool.quantity && tool.quantity > 1 
            ? { name: tool.name, quantity: tool.quantity }
            : tool.name
        ];
      }

      // Update original bin
      const { error: updateOriginalError } = await supabase
        .from('tool_inventory')
        .update({ tools: updatedOriginalTools })
        .eq('id', originalBinData.id);

      if (updateOriginalError) {
        console.error('❌ Error updating original bin:', updateOriginalError);
        Alert.alert('Error', 'Failed to return tool to bin');
        return;
      }

      // Remove from checked out list
      const updatedCheckedOutTools = checkedOutTools.filter((_, i) => i !== index);

      if (updatedCheckedOutTools.length === 0 && binId) {
        // Delete the checked out bin if empty
        const { error: deleteError } = await supabase
          .from('tool_inventory')
          .delete()
          .eq('id', binId);

        if (deleteError) {
          console.error('❌ Error deleting empty checked out bin:', deleteError);
        }
        
        setCheckedOutTools([]);
        setBinId(null);
      } else if (binId) {
        // Update checked out bin
        const { error: updateCheckedOutError } = await supabase
          .from('tool_inventory')
          .update({ tools: updatedCheckedOutTools })
          .eq('id', binId);

        if (updateCheckedOutError) {
          console.error('❌ Error updating checked out bin:', updateCheckedOutError);
          Alert.alert('Error', 'Failed to update checked out list');
          return;
        }

        setCheckedOutTools(updatedCheckedOutTools);
      }

      Alert.alert('Success', `"${tool.name}" has been returned to ${tool.original_bin}`);
      console.log(`✅ Tool checked in successfully`);
    } catch (error) {
      console.error('❌ Error in performCheckIn:', error);
      Alert.alert('Error', 'Failed to check in tool');
    }
  };

  const renderToolCard = (tool: CheckedOutTool, index: number) => {
    return (
      <View key={index} style={[styles.toolCard, { backgroundColor: colors.card }]}>
        <View style={styles.toolInfo}>
          <Text style={[styles.toolName, { color: colors.text }]}>
            {tool.name}
            {tool.quantity && tool.quantity > 1 && (
              <Text style={[styles.quantity, { color: colors.textSecondary }]}>
                {' '}× {tool.quantity}
              </Text>
            )}
          </Text>
          <View style={styles.locationInfo}>
            <IconSymbol name="location.fill" size={14} color={colors.secondary} />
            <Text style={[styles.locationText, { color: colors.textSecondary }]}>
              {tool.original_location} → {tool.original_bin}
            </Text>
          </View>
          {tool.checked_out_date && (
            <Text style={[styles.dateText, { color: colors.textSecondary }]}>
              Checked out: {new Date(tool.checked_out_date).toLocaleDateString()}
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.checkInButton, { backgroundColor: colors.primary }]}
          onPress={() => handleCheckIn(tool, index)}
        >
          <IconSymbol name="arrow.down.circle.fill" size={20} color="#FFFFFF" />
          <Text style={styles.checkInButtonText}>Check In</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Checked Out Tools",
          headerBackTitle: "Back",
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Loading checked out tools...
            </Text>
          </View>
        ) : checkedOutTools.length === 0 ? (
          <View style={styles.centerContainer}>
            <IconSymbol name="tray" size={64} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Tools Checked Out
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              When you check out tools, they'll appear here
            </Text>
            <Pressable
              style={[styles.findButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/find-tool')}
            >
              <Text style={styles.findButtonText}>Find a Tool</Text>
            </Pressable>
          </View>
        ) : (
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
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {checkedOutTools.length} {checkedOutTools.length === 1 ? 'Tool' : 'Tools'} Checked Out
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Return tools to their original bins
              </Text>
            </View>
            {checkedOutTools.map((tool, index) => renderToolCard(tool, index))}
            <View style={{ height: 100 }} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  findButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  toolCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  toolInfo: {
    flex: 1,
  },
  toolName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  quantity: {
    fontSize: 16,
    fontWeight: '400',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
  },
  dateText: {
    fontSize: 12,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
