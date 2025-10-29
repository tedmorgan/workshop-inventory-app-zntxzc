
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
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@integrations/supabase/client';

type ToolInventoryItem = {
  id: string;
  image_url: string;
  tools: string[];
  bin_name: string;
  bin_location: string;
  created_at: string;
};

export default function FindToolScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ToolInventoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [selectedBin, setSelectedBin] = useState<ToolInventoryItem | null>(null);

  const searchTools = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setHasSearched(true);
    console.log('Searching for tool:', searchQuery);

    try {
      // Fetch all inventory items
      const { data, error } = await supabase
        .from('tool_inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching tools:', error);
        throw error;
      }

      console.log('Fetched inventory data:', data);

      // Filter items that contain the search query in their tools array
      const searchLower = searchQuery.toLowerCase().trim();
      const matchingItems = data.filter(item => {
        const tools = Array.isArray(item.tools) ? item.tools : [];
        return tools.some(tool => 
          tool.toLowerCase().includes(searchLower)
        );
      });

      console.log('Matching items:', matchingItems.length);
      setSearchResults(matchingItems);
    } catch (error) {
      console.error('Error searching tools:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleBinSelect = (item: ToolInventoryItem) => {
    console.log('Bin selected:', item.id);
    setSelectedBin(item);
  };

  const openViewInventory = () => {
    if (selectedBin) {
      // Close the modal and navigate to inventory screen
      setSelectedBin(null);
      // Navigate to inventory tab which will show all items including the selected one
      router.push('/(tabs)/inventory');
    }
  };

  const expandImage = (imageUrl: string) => {
    console.log('Expanding image:', imageUrl);
    setExpandedImageUrl(imageUrl);
  };

  const closeExpandedImage = () => {
    setExpandedImageUrl(null);
  };

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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.innerContainer}>
          {/* Search Header */}
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <IconSymbol name="magnifyingglass" color={colors.textSecondary} size={20} />
              <TextInput
                style={styles.searchInput}
                placeholder="Enter tool name..."
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchTools}
                returnKeyType="search"
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <IconSymbol name="xmark.circle.fill" color={colors.textSecondary} size={20} />
                </Pressable>
              )}
            </View>
            <Pressable
              style={[styles.searchButton, !searchQuery.trim() && styles.searchButtonDisabled]}
              onPress={searchTools}
              disabled={!searchQuery.trim() || searching}
            >
              {searching ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </Pressable>
          </View>

          {/* Search Instructions */}
          {!hasSearched && (
            <View style={styles.instructionsContainer}>
              <IconSymbol name="magnifyingglass.circle.fill" color={colors.primary} size={64} />
              <Text style={styles.instructionsTitle}>Find Your Tools</Text>
              <Text style={styles.instructionsText}>
                Enter a tool name to search across all your storage bins. 
                We&apos;ll show you which bins contain that tool.
              </Text>
              <View style={styles.exampleContainer}>
                <Text style={styles.exampleTitle}>Example searches:</Text>
                <Text style={styles.exampleText}>• Hammer</Text>
                <Text style={styles.exampleText}>• Screwdriver</Text>
                <Text style={styles.exampleText}>• Wrench</Text>
              </View>
            </View>
          )}

          {/* Search Results */}
          {hasSearched && !searching && (
            <ScrollView
              contentContainerStyle={styles.resultsContainer}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.length === 0 ? (
                <View style={styles.noResultsContainer}>
                  <IconSymbol name="exclamationmark.triangle" color={colors.textSecondary} size={64} />
                  <Text style={styles.noResultsTitle}>No Bins Found</Text>
                  <Text style={styles.noResultsText}>
                    No bins contain &quot;{searchQuery}&quot;. Try a different search term.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.resultsHeader}>
                    <Text style={styles.resultsCount}>
                      {searchResults.length} {searchResults.length === 1 ? 'Bin' : 'Bins'} Found
                    </Text>
                    <View style={styles.searchQueryBadge}>
                      <IconSymbol name="magnifyingglass" color={colors.primary} size={14} />
                      <Text style={styles.searchQueryText}>{searchQuery}</Text>
                    </View>
                  </View>

                  {searchResults.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.resultCard}
                      onPress={() => handleBinSelect(item)}
                    >
                      <Pressable
                        style={styles.resultImageContainer}
                        onPress={() => expandImage(item.image_url)}
                      >
                        <Image source={{ uri: item.image_url }} style={styles.resultImage} />
                        <View style={styles.expandIconOverlay}>
                          <IconSymbol name="arrow.up.left.and.arrow.down.right" color="#FFFFFF" size={20} />
                        </View>
                      </Pressable>
                      
                      <View style={styles.resultContent}>
                        <View style={styles.binBadge}>
                          <IconSymbol name="archivebox.fill" color={colors.primary} size={16} />
                          <Text style={styles.binName}>{item.bin_name}</Text>
                        </View>
                        
                        <View style={styles.locationRow}>
                          <IconSymbol name="location.fill" color={colors.textSecondary} size={14} />
                          <Text style={styles.locationText}>{item.bin_location}</Text>
                        </View>

                        <Text style={styles.toolsLabel}>
                          Tools in this bin ({item.tools.length}):
                        </Text>
                        <View style={styles.toolsList}>
                          {item.tools.map((tool, index) => {
                            const isMatch = tool.toLowerCase().includes(searchQuery.toLowerCase().trim());
                            return (
                              <View key={index} style={styles.toolItem}>
                                <Text style={styles.toolBullet}>•</Text>
                                <Text style={[styles.toolText, isMatch && styles.toolTextHighlight]}>
                                  {tool}
                                </Text>
                              </View>
                            );
                          })}
                        </View>

                        <Pressable
                          style={styles.viewBinButton}
                          onPress={() => handleBinSelect(item)}
                        >
                          <IconSymbol name="arrow.right.circle.fill" color={colors.accent} size={20} />
                          <Text style={styles.viewBinButtonText}>View & Edit Bin</Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  ))}
                </>
              )}
            </ScrollView>
          )}
        </View>

        {/* Expanded Image Modal */}
        <Modal
          visible={expandedImageUrl !== null}
          transparent
          animationType="fade"
          onRequestClose={closeExpandedImage}
        >
          <Pressable style={styles.expandedImageModal} onPress={closeExpandedImage}>
            <View style={styles.expandedImageContainer}>
              <Pressable style={styles.closeExpandedButton} onPress={closeExpandedImage}>
                <IconSymbol name="xmark.circle.fill" color="#FFFFFF" size={36} />
              </Pressable>
              {expandedImageUrl && (
                <Image
                  source={{ uri: expandedImageUrl }}
                  style={styles.expandedImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.expandedImageHint}>Tap anywhere to close</Text>
            </View>
          </Pressable>
        </Modal>

        {/* Bin Selection Modal */}
        <Modal
          visible={selectedBin !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setSelectedBin(null)}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setSelectedBin(null)} style={styles.modalCloseButton}>
                <IconSymbol name="xmark" color={colors.text} size={24} />
              </Pressable>
              <Text style={styles.modalTitle}>Bin Details</Text>
              <View style={{ width: 40 }} />
            </View>

            {selectedBin && (
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Image source={{ uri: selectedBin.image_url }} style={styles.modalImage} />
                
                <View style={styles.modalInfoSection}>
                  <View style={styles.modalBinBadge}>
                    <IconSymbol name="archivebox.fill" color={colors.primary} size={20} />
                    <Text style={styles.modalBinName}>{selectedBin.bin_name}</Text>
                  </View>
                  
                  <View style={styles.modalLocationRow}>
                    <IconSymbol name="location.fill" color={colors.textSecondary} size={18} />
                    <Text style={styles.modalLocationText}>{selectedBin.bin_location}</Text>
                  </View>

                  <Text style={styles.modalToolsTitle}>
                    Tools ({selectedBin.tools.length}):
                  </Text>
                  {selectedBin.tools.map((tool, index) => {
                    const isMatch = tool.toLowerCase().includes(searchQuery.toLowerCase().trim());
                    return (
                      <View key={index} style={styles.modalToolItem}>
                        <Text style={styles.modalToolBullet}>•</Text>
                        <Text style={[styles.modalToolText, isMatch && styles.modalToolTextHighlight]}>
                          {tool}
                        </Text>
                      </View>
                    );
                  })}

                  <Pressable
                    style={styles.openInventoryButton}
                    onPress={openViewInventory}
                  >
                    <IconSymbol name="pencil.circle.fill" color="#FFFFFF" size={24} />
                    <Text style={styles.openInventoryButtonText}>Open in Inventory to Edit</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </View>
        </Modal>
      </KeyboardAvoidingView>
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
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: 12,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.5,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructionsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  instructionsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  exampleContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignSelf: 'stretch',
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  resultsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  searchQueryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  searchQueryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  noResultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  resultCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  resultImageContainer: {
    position: 'relative',
  },
  resultImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
  },
  expandIconOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 8,
  },
  resultContent: {
    padding: 16,
  },
  binBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 8,
    gap: 6,
  },
  binName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  toolsLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  toolsList: {
    marginBottom: 12,
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
  toolTextHighlight: {
    fontWeight: '700',
    color: colors.accent,
  },
  viewBinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}15`,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  viewBinButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  // Expanded Image Modal
  expandedImageModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  expandedImageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeExpandedButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
  },
  expandedImage: {
    width: '100%',
    height: '80%',
  },
  expandedImageHint: {
    position: 'absolute',
    bottom: 40,
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.7,
  },
  // Bin Selection Modal
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
  modalContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  modalImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: colors.background,
    marginBottom: 20,
  },
  modalInfoSection: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  modalBinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  modalBinName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  modalLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  modalLocationText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  modalToolsTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  modalToolItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  modalToolBullet: {
    fontSize: 18,
    color: colors.text,
    marginRight: 8,
    lineHeight: 24,
  },
  modalToolText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
    lineHeight: 24,
  },
  modalToolTextHighlight: {
    fontWeight: '700',
    color: colors.accent,
  },
  openInventoryButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 20,
  },
  openInventoryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
