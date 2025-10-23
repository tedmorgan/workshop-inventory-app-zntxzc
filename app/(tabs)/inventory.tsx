
import React, { useState, useEffect } from "react";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, Image, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from '@react-native-async-storage/async-storage';

type ToolInventoryItem = {
  id: string;
  imageUri: string;
  tools: string[];
  binName: string;
  binLocation: string;
  dateAdded: string;
};

export default function InventoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [inventory, setInventory] = useState<ToolInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const stored = await AsyncStorage.getItem('tool_inventory');
      if (stored) {
        const parsed = JSON.parse(stored);
        setInventory(parsed);
      }
    } catch (error) {
      console.log('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory');
    } finally {
      setLoading(false);
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
              const updated = inventory.filter(item => item.id !== id);
              await AsyncStorage.setItem('tool_inventory', JSON.stringify(updated));
              setInventory(updated);
            } catch (error) {
              console.log('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const renderHeaderRight = () => (
    <Pressable
      onPress={() => router.push('/add-tools')}
      style={styles.headerButtonContainer}
    >
      <IconSymbol name="plus" color={colors.primary} />
    </Pressable>
  );

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: "Tool Inventory",
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
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading...</Text>
            </View>
          ) : inventory.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="wrench.and.screwdriver" color={colors.textSecondary} size={64} />
              <Text style={styles.emptyTitle}>No Tools Yet</Text>
              <Text style={styles.emptyText}>
                Start by adding your first set of tools using the camera
              </Text>
              <Pressable
                style={styles.addButton}
                onPress={() => router.push('/add-tools')}
              >
                <IconSymbol name="plus" color="#FFFFFF" size={20} />
                <Text style={styles.addButtonText}>Add Tools</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.headerText}>
                {inventory.length} {inventory.length === 1 ? 'Collection' : 'Collections'}
              </Text>
              {inventory.map((item) => (
                <View key={item.id} style={styles.inventoryCard}>
                  <Image source={{ uri: item.imageUri }} style={styles.inventoryImage} />
                  <View style={styles.inventoryContent}>
                    <View style={styles.locationBadge}>
                      <IconSymbol name="location.fill" color={colors.primary} size={14} />
                      <Text style={styles.locationText}>
                        {item.binName} - {item.binLocation}
                      </Text>
                    </View>
                    
                    <Text style={styles.toolsTitle}>Tools:</Text>
                    {item.tools.map((tool, index) => (
                      <View key={index} style={styles.toolItem}>
                        <Text style={styles.toolBullet}>•</Text>
                        <Text style={styles.toolText}>{tool}</Text>
                      </View>
                    ))}
                    
                    <Text style={styles.dateText}>
                      Added: {new Date(item.dateAdded).toLocaleDateString()}
                    </Text>
                    
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => deleteItem(item.id)}
                    >
                      <IconSymbol name="trash" color="#FF3B30" size={18} />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </>
          )}
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
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  addButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  inventoryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  inventoryImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
  },
  inventoryContent: {
    padding: 16,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  toolsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  toolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  toolBullet: {
    fontSize: 16,
    color: colors.text,
    marginRight: 8,
    lineHeight: 22,
  },
  toolText: {
    fontSize: 15,
    color: colors.text,
    flex: 1,
    lineHeight: 22,
  },
  dateText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '500',
  },
  headerButtonContainer: {
    padding: 6,
  },
});
