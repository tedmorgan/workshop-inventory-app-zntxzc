
import React, { useState } from "react";
import { useTheme } from "@react-navigation/native";
import { colors } from "@/styles/commonStyles";
import { Stack, useRouter } from "expo-router";
import * as Clipboard from 'expo-clipboard';
import { IconSymbol } from "@/components/IconSymbol";
import { supabase } from "@integrations/supabase/client";
import { LinearGradient } from "expo-linear-gradient";
import { 
  ScrollView, 
  Pressable, 
  StyleSheet, 
  View, 
  Text, 
  Platform,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { getDeviceId } from "@/utils/deviceId";

type ToolInventoryItem = {
  id: string;
  image_url: string;
  tools: string[];
  bin_name: string;
  bin_location: string;
  created_at: string;
  device_id: string;
};

export default function HomeScreen() {
  const { colors: themeColors } = useTheme();
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();

  const renderHeaderRight = () => (
    <Pressable
      onPress={downloadInventory}
      style={{ marginRight: 16 }}
      disabled={downloading}
    >
      {downloading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <IconSymbol name="square.and.arrow.down" size={24} color={colors.primary} />
      )}
    </Pressable>
  );

  const downloadInventory = async () => {
    try {
      setDownloading(true);
      console.log('📥 Starting inventory download');

      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Query with device_id filter
      const { data: inventory, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .eq('device_id', deviceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching inventory:', error);
        Alert.alert('Error', 'Failed to fetch inventory');
        return;
      }

      if (!inventory || inventory.length === 0) {
        Alert.alert('No Data', 'Your inventory is empty. Add some tools first!');
        return;
      }

      console.log(`✅ Fetched ${inventory.length} items`);

      const textContent = generateTextContent(inventory);

      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(textContent);
        Alert.alert('Copied!', 'Your inventory has been copied to clipboard');
      } else {
        try {
          await Share.share({
            message: textContent,
            title: 'My Tool Inventory',
          });
        } catch (shareError) {
          console.log('Share cancelled or failed, copying to clipboard instead');
          await Clipboard.setStringAsync(textContent);
          Alert.alert('Copied!', 'Your inventory has been copied to clipboard');
        }
      }
    } catch (error) {
      console.error('❌ Download error:', error);
      Alert.alert('Error', 'Failed to download inventory');
    } finally {
      setDownloading(false);
    }
  };

  const generateTextContent = (inventory: ToolInventoryItem[]): string => {
    let content = '🔧 MY TOOL INVENTORY 🔧\n';
    content += `Generated: ${new Date().toLocaleDateString()}\n`;
    content += `Total Bins: ${inventory.length}\n`;
    content += `Total Tools: ${inventory.reduce((sum, item) => sum + item.tools.length, 0)}\n`;
    content += '\n' + '='.repeat(40) + '\n\n';

    inventory.forEach((item, index) => {
      content += `📦 BIN ${index + 1}: ${item.bin_name}\n`;
      content += `📍 Location: ${item.bin_location}\n`;
      content += `🔧 Tools (${item.tools.length}):\n`;
      item.tools.forEach((tool, toolIndex) => {
        content += `   ${toolIndex + 1}. ${tool}\n`;
      });
      content += '\n' + '-'.repeat(40) + '\n\n';
    });

    return content;
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Workshop Inventory",
          headerRight: renderHeaderRight,
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient
          colors={[colors.primary, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroTitle}>Workshop Tool Inventory</Text>
          <Text style={styles.heroSubtitle}>
            Organize, track, and find your tools with AI-powered image recognition
          </Text>
        </LinearGradient>

        <View style={styles.actionsGrid}>
          <Pressable
            style={[styles.actionCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/add-tools')}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
              <IconSymbol name="plus.circle.fill" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Add Tools</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Take a photo and let AI identify your tools
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/(tabs)/inventory')}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}20` }]}>
              <IconSymbol name="tray.fill" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>View Inventory</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Browse all your tools and storage bins
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { backgroundColor: colors.card }]}
            onPress={() => router.push('/find-tool')}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${colors.secondary}20` }]}>
              <IconSymbol name="magnifyingglass" size={32} color={colors.secondary} />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Find Tool</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Search for any tool in your inventory
            </Text>
          </Pressable>

          <Pressable
            style={[styles.actionCard, { backgroundColor: colors.card }]}
            onPress={downloadInventory}
            disabled={downloading}
          >
            <View style={[styles.iconCircle, { backgroundColor: `${colors.primary}20` }]}>
              {downloading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <IconSymbol name="square.and.arrow.down" size={32} color={colors.primary} />
              )}
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>Export</Text>
            <Text style={[styles.actionDescription, { color: colors.textSecondary }]}>
              Download your inventory as text
            </Text>
          </Pressable>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoHeader}>
            <IconSymbol name="sparkles" size={24} color={colors.accent} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>AI-Powered Recognition</Text>
          </View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            This app uses Advanced AI models to automatically identify tools from photos. Simply take a picture of your tools, and the AI will create a detailed list for you.
          </Text>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.infoHeader}>
            <IconSymbol name="lock.fill" size={24} color={colors.primary} />
            <Text style={[styles.infoTitle, { color: colors.text }]}>Your Data, Your Device</Text>
          </View>
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            All your inventory data is stored securely and linked to your device. Your personal workshop inventory stays private and accessible only to you.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  heroCard: {
    padding: 32,
    borderRadius: 16,
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    opacity: 0.9,
    lineHeight: 24,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  infoCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  infoText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 20,
  },
});
