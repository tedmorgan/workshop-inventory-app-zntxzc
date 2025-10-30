
import React, { useState } from "react";
import { useTheme } from "@react-navigation/native";
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
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "@integrations/supabase/client";
import * as Clipboard from 'expo-clipboard';

type ToolInventoryItem = {
  id: string;
  image_url: string;
  tools: string[];
  bin_name: string;
  bin_location: string;
  created_at: string;
};

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [exportingInventory, setExportingInventory] = useState(false);

  const renderHeaderRight = () => (
    <Pressable
      onPress={() => router.push('/add-tools')}
      style={styles.headerButtonContainer}
    >
      <IconSymbol name="plus" color={colors.primary} />
    </Pressable>
  );

  const downloadInventory = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('iOS Only', 'This feature is currently only available on iOS devices.');
      return;
    }

    setExportingInventory(true);
    console.log('Starting inventory export...');

    try {
      // Fetch all inventory data
      const { data: inventory, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory:', error);
        throw error;
      }

      if (!inventory || inventory.length === 0) {
        Alert.alert('No Inventory', 'You don\'t have any tools in your inventory yet. Add some tools first!');
        setExportingInventory(false);
        return;
      }

      console.log(`Exporting ${inventory.length} inventory items...`);

      // Parse tools from JSON
      const parsedInventory: ToolInventoryItem[] = inventory.map(item => ({
        ...item,
        tools: Array.isArray(item.tools) ? item.tools : [],
      }));

      // Generate plain text content with proper formatting
      const textContent = generateTextContent(parsedInventory);

      // Show options to user
      Alert.alert(
        'Export Inventory',
        'Choose how you want to export your inventory:',
        [
          {
            text: 'Copy to Clipboard',
            onPress: async () => {
              try {
                await Clipboard.setStringAsync(textContent);
                Alert.alert(
                  'Copied!',
                  'Your inventory has been copied to the clipboard.\n\n' +
                  '1. Open the Notes app\n' +
                  '2. Create a new note or open an existing one\n' +
                  '3. Tap and hold, then select "Paste"\n\n' +
                  'Note: Images are included as links. Tap them in Notes to view.',
                  [{ text: 'OK' }]
                );
              } catch (error) {
                console.error('Error copying to clipboard:', error);
                Alert.alert('Error', 'Failed to copy to clipboard');
              }
            }
          },
          {
            text: 'Share as Text',
            onPress: async () => {
              try {
                const shareResult = await Share.share({
                  message: textContent,
                  title: 'Workshop Tool Inventory',
                });

                console.log('Share result:', shareResult);

                if (shareResult.action === Share.sharedAction) {
                  Alert.alert(
                    'Export Successful',
                    'Select the Notes app to save your inventory.\n\n' +
                    'Note: Images are included as links. You can tap them to view.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                console.error('Error sharing:', error);
                Alert.alert('Error', 'Failed to share inventory');
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );

    } catch (error) {
      console.error('Error exporting inventory:', error);
      Alert.alert(
        'Export Failed',
        'Failed to export inventory. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExportingInventory(false);
    }
  };

  const generateTextContent = (inventory: ToolInventoryItem[]): string => {
    const totalTools = inventory.reduce((sum, item) => sum + item.tools.length, 0);
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let text = `🔧 WORKSHOP TOOL INVENTORY\n`;
    text += `═══════════════════════════════════\n\n`;
    text += `Generated: ${date}\n`;
    text += `Total Collections: ${inventory.length}\n`;
    text += `Total Tools: ${totalTools}\n\n`;
    text += `═══════════════════════════════════\n\n`;

    // Add each inventory item
    inventory.forEach((item, index) => {
      const itemDate = new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      text += `📦 COLLECTION ${index + 1}\n`;
      text += `───────────────────────────────────\n\n`;
      
      // Add image link
      text += `📷 Image: ${item.image_url}\n\n`;
      
      // Add location
      text += `📍 Location: ${item.bin_name} - ${item.bin_location}\n\n`;
      
      // Add tools
      text += `🔧 Tools (${item.tools.length}):\n`;
      item.tools.forEach((tool: string, toolIndex: number) => {
        text += `   ${toolIndex + 1}. ${tool}\n`;
      });
      
      text += `\n📅 Added: ${itemDate}\n\n`;
      text += `═══════════════════════════════════\n\n`;
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Generated by Workshop Inventory App\n`;
    text += `${inventory.length} collections • ${totalTools} tools\n`;

    return text;
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: "Workshop Inventory",
            headerRight: renderHeaderRight,
          }}
        />
      )}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <IconSymbol name="wrench.and.screwdriver.fill" color="#FFFFFF" size={48} />
            <Text style={styles.heroTitle}>Workshop Tool Inventory</Text>
            <Text style={styles.heroSubtitle}>
              Organize and track all your workshop tools with AI-powered identification
            </Text>
          </LinearGradient>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/add-tools')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <IconSymbol name="camera.fill" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Add Tools</Text>
                <Text style={styles.actionDescription}>
                  Take a photo and let AI identify your tools
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/find-tool')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                <IconSymbol name="magnifyingglass" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Find Tool</Text>
                <Text style={styles.actionDescription}>
                  Search for a tool and see which bin it&apos;s in
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/inventory')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="list.bullet" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>View Inventory</Text>
                <Text style={styles.actionDescription}>
                  Browse all your tools and storage locations
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>

            <Pressable
              style={[styles.actionCard, styles.downloadCard]}
              onPress={downloadInventory}
              disabled={exportingInventory}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.highlight }]}>
                {exportingInventory ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <IconSymbol name="square.and.arrow.down.fill" color="#FFFFFF" size={28} />
                )}
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Export to Notes</Text>
                <Text style={styles.actionDescription}>
                  {exportingInventory 
                    ? 'Preparing your inventory...' 
                    : 'Copy or share to iOS Notes'}
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            
            <View style={styles.featureCard}>
              <IconSymbol name="sparkles" color={colors.highlight} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>AI-Powered Recognition</Text>
                <Text style={styles.featureDescription}>
                  Automatically identify tools from photos using advanced AI
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="magnifyingglass" color={colors.accent} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Quick Tool Search</Text>
                <Text style={styles.featureDescription}>
                  Find any tool instantly and see exactly where it&apos;s stored
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="location.fill" color={colors.secondary} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Storage Tracking</Text>
                <Text style={styles.featureDescription}>
                  Keep track of which bin and location your tools are stored
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="photo.fill" color={colors.primary} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Photo Library</Text>
                <Text style={styles.featureDescription}>
                  Visual reference for all your tool collections
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="square.and.arrow.down" color={colors.highlight} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Export to Notes</Text>
                <Text style={styles.featureDescription}>
                  Copy or share your inventory to iOS Notes with image links
                </Text>
              </View>
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <IconSymbol name="info.circle.fill" color={colors.primary} size={20} />
            <Text style={styles.infoText}>
              <Text style={styles.infoBold}>Export Tip: </Text>
              When you export to Notes, images are included as clickable links. 
              Tap any image link in your note to view the full photo.
            </Text>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  scrollContentWithTabBar: {
    paddingBottom: 100,
  },
  heroCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  downloadCard: {
    borderWidth: 2,
    borderColor: colors.highlight,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  featureCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  featureContent: {
    flex: 1,
    marginLeft: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  headerButtonContainer: {
    padding: 6,
  },
  infoBox: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
    color: colors.text,
  },
});
