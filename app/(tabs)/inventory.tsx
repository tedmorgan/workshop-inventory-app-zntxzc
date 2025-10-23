
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, Image, Alert, RefreshControl } from "react-native";
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@/integrations/supabase/client";

type ToolInventoryItem = {
  id: string;
  image_url: string;
  tools: string[];
  bin_name: string;
  bin_location: string;
  created_at: string;
};

export default function InventoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [inventory, setInventory] = useState<ToolInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load inventory when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadInventory();
    }, [])
  );

  const loadInventory = async () => {
    try {
      console.log('Loading inventory from Supabase...');
      
      const { data, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading inventory:', error);
        throw error;
      }

      console.log('Inventory loaded:', data);

      // Parse tools from JSON
      const parsedInventory = data.map(item => ({
        ...item,
        tools: Array.isArray(item.tools) ? item.tools : [],
      }));

      setInventory(parsedInventory);
    } catch (error) {
      console.error('Error loading inventory:', error);
      Alert.alert('Error', 'Failed to load inventory. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadInventory();
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
              console.log('Deleting item:', id);
              
              const { error } = await supabase
                .from('tool_inventory')
                .delete()
                .eq('id', id);

              if (error) {
                console.error('Error deleting item:', error);
                throw error;
              }

              // Update local state
              setInventory(prev => prev.filter(item => item.id !== id));
              
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        >
          {loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Loading inventory...</Text>
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
              <View style={styles.headerContainer}>
                <Text style={styles.headerText}>
                  {inventory.length} {inventory.length === 1 ? 'Collection' : 'Collections'}
                </Text>
                <View style={styles.aiPoweredBadge}>
                  <IconSymbol name="sparkles" color={colors.accent} size={14} />
                  <Text style={styles.aiPoweredText}>AI Powered</Text>
                </View>
              </View>
              {inventory.map((item) => (
                <View key={item.id} style={styles.inventoryCard}>
                  <Image source={{ uri: item.image_url }} style={styles.inventoryImage} />
                  <View style={styles.inventoryContent}>
                    <View style={styles.locationBadge}>
                      <IconSymbol name="location.fill" color={colors.primary} size={14} />
                      <Text style={styles.locationText}>
                        {item.bin_name} - {item.bin_location}
                      </Text>
                    </View>
                    
                    <Text style={styles.toolsTitle}>
                      Tools ({item.tools.length}):
                    </Text>
                    {item.tools.map((tool, index) => (
                      <View key={index} style={styles.toolItem}>
                        <Text style={styles.toolBullet}>•</Text>
                        <Text style={styles.toolText}>{tool}</Text>
                      </View>
                    ))}
                    
                    <Text style={styles.dateText}>
                      Added: {new Date(item.created_at).toLocaleDateString()} at {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  aiPoweredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  aiPoweredText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
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
