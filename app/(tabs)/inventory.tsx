
import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "@react-navigation/native";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Platform, 
  Pressable, 
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
import { Stack, useRouter, useFocusEffect } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { supabase } from "@integrations/supabase/client";

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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ToolInventoryItem | null>(null);
  const [editBinName, setEditBinName] = useState('');
  const [editBinLocation, setEditBinLocation] = useState('');
  const [editTools, setEditTools] = useState<string[]>([]);
  const [newToolText, setNewToolText] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openEditModal = (item: ToolInventoryItem) => {
    console.log('Opening edit modal for item:', item.id);
    setEditingItem(item);
    setEditBinName(item.bin_name);
    setEditBinLocation(item.bin_location);
    setEditTools([...item.tools]);
    setNewToolText('');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingItem(null);
    setEditBinName('');
    setEditBinLocation('');
    setEditTools([]);
    setNewToolText('');
  };

  const addNewTool = () => {
    if (newToolText.trim()) {
      setEditTools([...editTools, newToolText.trim()]);
      setNewToolText('');
      Keyboard.dismiss();
    }
  };

  const removeTool = (index: number) => {
    const updatedTools = editTools.filter((_, i) => i !== index);
    setEditTools(updatedTools);
  };

  const updateTool = (index: number, newValue: string) => {
    const updatedTools = [...editTools];
    updatedTools[index] = newValue;
    setEditTools(updatedTools);
  };

  const saveChanges = async () => {
    if (!editingItem) return;

    if (!editBinName.trim()) {
      Alert.alert('Missing Bin Name', 'Please enter a bin name');
      return;
    }

    if (!editBinLocation.trim()) {
      Alert.alert('Missing Location', 'Please enter a bin location');
      return;
    }

    if (editTools.length === 0) {
      Alert.alert('No Tools', 'Please add at least one tool');
      return;
    }

    setSaving(true);
    console.log('Saving changes for item:', editingItem.id);

    try {
      const { data, error } = await supabase
        .from('tool_inventory')
        .update({
          bin_name: editBinName.trim(),
          bin_location: editBinLocation.trim(),
          tools: editTools.filter(t => t.trim().length > 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingItem.id)
        .select();

      if (error) {
        console.error('Error updating item:', error);
        throw error;
      }

      console.log('Item updated successfully:', data);

      // Update local state
      setInventory(prev => prev.map(item => 
        item.id === editingItem.id 
          ? {
              ...item,
              bin_name: editBinName.trim(),
              bin_location: editBinLocation.trim(),
              tools: editTools.filter(t => t.trim().length > 0),
            }
          : item
      ));

      Alert.alert('Success', 'Changes saved successfully!');
      closeEditModal();
    } catch (error) {
      console.error('Error saving changes:', error);
      Alert.alert('Error', 'Failed to save changes. Please try again.');
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
          contentContainerStyle={styles.scrollContent}
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
                    
                    <View style={styles.actionButtons}>
                      <Pressable
                        style={styles.editButton}
                        onPress={() => openEditModal(item)}
                      >
                        <IconSymbol name="pencil" color={colors.primary} size={18} />
                        <Text style={styles.editButtonText}>Edit</Text>
                      </Pressable>
                      
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => deleteItem(item.id)}
                      >
                        <IconSymbol name="trash" color="#FF3B30" size={18} />
                        <Text style={styles.deleteButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* Edit Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={closeEditModal}
        >
          <KeyboardAvoidingView
            style={[styles.modalContainer, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <View style={styles.modalHeader}>
              <Pressable onPress={closeEditModal} style={styles.modalCloseButton}>
                <IconSymbol name="xmark" color={colors.text} size={24} />
              </Pressable>
              <Text style={styles.modalTitle}>Edit Inventory</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {editingItem && (
                <>
                  <Image source={{ uri: editingItem.image_url }} style={styles.modalImage} />

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Storage Information</Text>
                    
                    <Text style={styles.modalLabel}>Bin Name</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., Red Toolbox, Bin A3"
                      placeholderTextColor={colors.textSecondary}
                      value={editBinName}
                      onChangeText={setEditBinName}
                      returnKeyType="next"
                    />

                    <Text style={styles.modalLabel}>Bin Location</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="e.g., Top shelf, Garage wall"
                      placeholderTextColor={colors.textSecondary}
                      value={editBinLocation}
                      onChangeText={setEditBinLocation}
                      returnKeyType="done"
                    />
                  </View>

                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Tools List</Text>
                    
                    {editTools.map((tool, index) => (
                      <View key={index} style={styles.toolEditItem}>
                        <TextInput
                          style={styles.toolEditInput}
                          value={tool}
                          onChangeText={(text) => updateTool(index, text)}
                          placeholder="Tool name"
                          placeholderTextColor={colors.textSecondary}
                        />
                        <Pressable
                          style={styles.removeToolButton}
                          onPress={() => removeTool(index)}
                        >
                          <IconSymbol name="minus.circle.fill" color="#FF3B30" size={24} />
                        </Pressable>
                      </View>
                    ))}

                    <View style={styles.addToolContainer}>
                      <TextInput
                        style={styles.addToolInput}
                        placeholder="Add new tool..."
                        placeholderTextColor={colors.textSecondary}
                        value={newToolText}
                        onChangeText={setNewToolText}
                        onSubmitEditing={addNewTool}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={[styles.addToolButton, !newToolText.trim() && styles.addToolButtonDisabled]}
                        onPress={addNewTool}
                        disabled={!newToolText.trim()}
                      >
                        <IconSymbol name="plus.circle.fill" color={newToolText.trim() ? colors.primary : colors.textSecondary} size={28} />
                      </Pressable>
                    </View>
                  </View>

                  <Pressable
                    style={[styles.saveChangesButton, saving && styles.saveChangesButtonDisabled]}
                    onPress={saveChanges}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <IconSymbol name="checkmark.circle.fill" color="#FFFFFF" size={24} />
                        <Text style={styles.saveChangesButtonText}>Save Changes</Text>
                      </>
                    )}
                  </Pressable>

                  <View style={styles.bottomSpacer} />
                </>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
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
    paddingBottom: 160,
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
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  editButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '500',
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
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  modalCloseButton: {
    padding: 4,
    width: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalScrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.background,
    marginBottom: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.background,
  },
  toolEditItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  toolEditInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.background,
  },
  removeToolButton: {
    padding: 4,
  },
  addToolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addToolInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.background,
  },
  addToolButton: {
    padding: 4,
  },
  addToolButtonDisabled: {
    opacity: 0.4,
  },
  saveChangesButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveChangesButtonDisabled: {
    opacity: 0.6,
  },
  saveChangesButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  bottomSpacer: {
    height: 100,
  },
});
