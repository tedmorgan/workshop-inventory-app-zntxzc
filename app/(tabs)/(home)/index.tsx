
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
import * as FileSystem from "expo-file-system";

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

      // Download all images as base64
      console.log('Downloading images...');
      const inventoryWithImages = await Promise.all(
        parsedInventory.map(async (item) => {
          try {
            // Download image from URL
            const imageUri = await FileSystem.downloadAsync(
              item.image_url,
              FileSystem.cacheDirectory + `temp_${item.id}.jpg`
            );
            
            // Read as base64
            const base64 = await FileSystem.readAsStringAsync(imageUri.uri, {
              encoding: FileSystem.EncodingType.Base64,
            });
            
            return {
              ...item,
              imageBase64: base64,
            };
          } catch (error) {
            console.error(`Error downloading image for item ${item.id}:`, error);
            return {
              ...item,
              imageBase64: null,
            };
          }
        })
      );

      // Create HTML content with embedded images
      const htmlContent = generateHTMLContent(inventoryWithImages);

      // Save to temporary file
      const fileUri = FileSystem.cacheDirectory + 'workshop_inventory.html';
      await FileSystem.writeAsStringAsync(fileUri, htmlContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      console.log('HTML file created at:', fileUri);

      // Share the file using iOS Share Sheet
      // User can select Notes app and choose folder
      const shareResult = await Share.share({
        url: fileUri,
        title: 'Workshop Tool Inventory',
        message: 'My Workshop Tool Inventory - Generated from Workshop Inventory App',
      });

      console.log('Share result:', shareResult);

      if (shareResult.action === Share.sharedAction) {
        Alert.alert(
          'Export Successful',
          'Your inventory has been exported! You can now save it to your Notes app and select the folder.',
          [{ text: 'OK' }]
        );
      }

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

  const generateHTMLContent = (inventory: any[]): string => {
    const totalTools = inventory.reduce((sum, item) => sum + item.tools.length, 0);
    const date = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Workshop Tool Inventory</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 32px;
    }
    .header p {
      margin: 5px 0;
      opacity: 0.9;
    }
    .stats {
      display: flex;
      justify-content: space-around;
      margin: 20px 0;
      padding: 20px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .stat {
      text-align: center;
    }
    .stat-number {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .inventory-item {
      background: white;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .inventory-image {
      width: 100%;
      max-width: 600px;
      height: auto;
      border-radius: 8px;
      margin-bottom: 15px;
    }
    .location-badge {
      display: inline-block;
      background: #e8eaf6;
      color: #667eea;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 15px;
    }
    .tools-title {
      font-size: 18px;
      font-weight: 600;
      margin: 15px 0 10px 0;
      color: #333;
    }
    .tool-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .tool-list li {
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
      font-size: 15px;
    }
    .tool-list li:last-child {
      border-bottom: none;
    }
    .tool-list li:before {
      content: "🔧 ";
      margin-right: 8px;
    }
    .date-text {
      font-size: 13px;
      color: #999;
      margin-top: 15px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding: 20px;
      color: #999;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔧 Workshop Tool Inventory</h1>
    <p>Complete inventory export</p>
    <p>Generated on ${date}</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-number">${inventory.length}</div>
      <div class="stat-label">Collections</div>
    </div>
    <div class="stat">
      <div class="stat-number">${totalTools}</div>
      <div class="stat-label">Total Tools</div>
    </div>
  </div>
`;

    // Add each inventory item
    inventory.forEach((item, index) => {
      const itemDate = new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      html += `
  <div class="inventory-item">
    <h2 style="margin-top: 0; color: #333;">Collection ${index + 1}</h2>
`;

      // Add image if available
      if (item.imageBase64) {
        html += `    <img src="data:image/jpeg;base64,${item.imageBase64}" alt="Tool collection ${index + 1}" class="inventory-image" />
`;
      }

      html += `    <div class="location-badge">
      📍 ${item.bin_name} - ${item.bin_location}
    </div>
    
    <div class="tools-title">Tools (${item.tools.length}):</div>
    <ul class="tool-list">
`;

      // Add tools
      item.tools.forEach((tool: string) => {
        html += `      <li>${tool}</li>
`;
      });

      html += `    </ul>
    
    <div class="date-text">Added: ${itemDate}</div>
  </div>
`;
    });

    html += `
  <div class="footer">
    <p>Generated by Workshop Inventory App</p>
    <p>Total: ${inventory.length} collections with ${totalTools} tools</p>
  </div>
</body>
</html>`;

    return html;
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
                <Text style={styles.actionTitle}>Download Inventory</Text>
                <Text style={styles.actionDescription}>
                  {exportingInventory 
                    ? 'Exporting your inventory...' 
                    : 'Export to iOS Notes with images'}
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
                  Download your complete inventory with images to iOS Notes
                </Text>
              </View>
            </View>
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
});
