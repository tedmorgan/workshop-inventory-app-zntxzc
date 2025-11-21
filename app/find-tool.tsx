
import React, { useState, useEffect } from 'react';
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
  Dimensions,
  StatusBar,
  Linking,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@integrations/supabase/client';
import { getDeviceId } from '@/utils/deviceId';
import { useNavigation } from '@/contexts/NavigationContext';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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

export default function FindToolScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const [advancedSearchQuery, setAdvancedSearchQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set());
  const [toolImageUrls, setToolImageUrls] = useState<Map<string, string>>(new Map());

  // Zoom and pan state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const originX = useSharedValue(0);
  const originY = useSharedValue(0);

  // Save search state to AsyncStorage
  const saveSearchState = async () => {
    try {
      const state = {
        advancedSearchQuery,
        aiResponse,
        hasSearched,
      };
      await AsyncStorage.setItem('findToolSearchState', JSON.stringify(state));
      console.log('💾 Saved search state');
    } catch (error) {
      console.error('❌ Failed to save search state:', error);
    }
  };

  // Restore search state from AsyncStorage
  const restoreSearchState = async () => {
    try {
      const stateStr = await AsyncStorage.getItem('findToolSearchState');
      if (stateStr) {
        const state = JSON.parse(stateStr);
        console.log('📂 Restoring search state:', {
          hasSearched: state.hasSearched,
          hasAiResponse: !!state.aiResponse
        });
        setAdvancedSearchQuery(state.advancedSearchQuery || '');
        setAiResponse(state.aiResponse || '');
        setHasSearched(state.hasSearched || false);
      }
    } catch (error) {
      console.error('❌ Failed to restore search state:', error);
    }
  };

  // Restore state when screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      console.log('🔍 Find Tool screen focused');
      restoreSearchState();
    }, [])
  );

  // Save state whenever search results change
  useEffect(() => {
    if (hasSearched) {
      saveSearchState();
    }
  }, [advancedSearchQuery, aiResponse, hasSearched]);

  const searchToolsAdvanced = async () => {
    if (!advancedSearchQuery.trim()) {
      return;
    }

    Keyboard.dismiss();
    setSearching(true);
    setHasSearched(true);
    setAiResponse('');
    setFailedImageUrls(new Set());
    setToolImageUrls(new Map());

    try {
      console.log('🤖 Advanced AI search for:', advancedSearchQuery);

      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Call the Edge Function
      const { data, error } = await supabase.functions.invoke('advanced-tool-search', {
        body: {
          searchQuery: advancedSearchQuery,
          deviceId: deviceId,
        },
      });

      if (error) {
        console.error('❌ Edge Function error:', error);
        setAiResponse('Sorry, we encountered an error processing your request. Please try again.');
        return;
      }

      console.log('✅✅✅ AI RESPONSE RECEIVED - NEW CODE LOADED ✅✅✅');
      console.log('📝 Response preview (first 200 chars):', data.response?.substring(0, 200));
      console.log('📝 Full response length:', data.response?.length);
      setAiResponse(data.response || 'No response received from AI.');
    } catch (error) {
      console.error('❌ Error:', error);
      setAiResponse('Sorry, we encountered an error processing your request. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const openViewInventory = () => {
    console.log('📤 Setting returnToSearch = true');
    navigation.setReturnToSearch(true);
    navigation.setFilterBinId(null);
    navigation.setEditBinId(null);
    router.push('/(tabs)/inventory');
  };

  const openInventoryForBin = async (binId: string | null, binName: string, binLocation?: string) => {
    if (binId && binId.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
      console.log('📤 Using bin ID directly:', binId, 'for bin:', binName);
      navigation.setReturnToSearch(true);
      navigation.setFilterBinId(binId);
      navigation.setEditBinId(null);
    router.push('/(tabs)/inventory');
    } else {
      console.warn('⚠️ Invalid or missing bin ID:', binId, '- attempting lookup by name/location');
      // Fallback: try to find bin by name and location
      try {
        const deviceId = await getDeviceId();
        const { data, error } = await supabase
          .from('tool_inventory')
          .select('id, bin_name, bin_location')
          .eq('device_id', deviceId);
        
        if (error) {
          console.error('❌ Error fetching inventory for bin lookup:', error);
          navigation.setReturnToSearch(true);
          navigation.setFilterBinId(null);
          navigation.setEditBinId(null);
          router.push('/(tabs)/inventory');
          return;
        }
        
        // Find the bin matching name and location (flexible matching)
        const matchingBin = data?.find(item => {
          const itemBinName = item.bin_name?.trim().toLowerCase() || '';
          const searchBinName = binName.trim().toLowerCase();
          // Try exact match first
          let nameMatch = itemBinName === searchBinName;
          // If no exact match, try partial match (either contains the other)
          if (!nameMatch) {
            nameMatch = itemBinName.includes(searchBinName) || searchBinName.includes(itemBinName);
          }
          const locationMatch = !binLocation || 
            item.bin_location?.trim().toLowerCase() === binLocation.trim().toLowerCase() ||
            item.bin_location?.trim().toLowerCase().includes(binLocation.trim().toLowerCase()) ||
            binLocation.trim().toLowerCase().includes(item.bin_location?.trim().toLowerCase() || '');
          return nameMatch && (locationMatch || !binLocation);
        });
        
        console.log('🔍 Fallback lookup - searching for:', binName, binLocation);
        console.log('🔍 Available bins:', data?.map(i => `${i.bin_name} (${i.bin_location})`).slice(0, 5));
        
        if (matchingBin) {
          console.log('✅ Found bin ID via lookup:', matchingBin.id, 'for bin:', binName);
          navigation.setReturnToSearch(true);
          navigation.setFilterBinId(matchingBin.id);
          navigation.setEditBinId(null);
          router.push('/(tabs)/inventory');
        } else {
          console.warn('⚠️ Could not find matching bin for:', binName, binLocation, '- navigating without filter');
          navigation.setReturnToSearch(true);
          navigation.setFilterBinId(null);
          navigation.setEditBinId(null);
          router.push('/(tabs)/inventory');
        }
      } catch (error) {
        console.error('❌ Error in openInventoryForBin fallback:', error);
        navigation.setReturnToSearch(true);
        navigation.setFilterBinId(null);
        navigation.setEditBinId(null);
        router.push('/(tabs)/inventory');
      }
    }
  };

  const openAmazonLink = (url: string) => {
    Linking.openURL(url).catch(err => {
      console.error('Failed to open Amazon link:', err);
    });
  };

  const fetchToolImage = async (toolName: string) => {
    // Check if we already have this image
    if (toolImageUrls.has(toolName)) {
      return toolImageUrls.get(toolName) || null;
    }

    try {
      console.log('🖼️ Fetching image for:', toolName);
      const { data, error } = await supabase.functions.invoke('search-tool-image', {
        body: { toolName: toolName },
      });

      if (error) {
        console.error('❌ Error fetching image:', error);
        // Log more details if available
        if (error.message) {
          console.error('Error message:', error.message);
        }
        if (error.context) {
          console.error('Error context:', JSON.stringify(error.context, null, 2));
        }
        // Try to get response body if available
        if ((error as any).response) {
          console.error('Error response:', (error as any).response);
        }
        return null;
      }

      if (data?.imageUrl) {
        console.log('✅ Image found for', toolName, ':', data.imageUrl);
        setToolImageUrls(prev => new Map(prev).set(toolName, data.imageUrl));
        return data.imageUrl;
      }

      if (data?.error) {
        console.error('❌ Function returned error:', data.error);
        if (data.details) {
          console.error('Error details:', data.details);
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Exception fetching tool image:', error);
      return null;
    }
  };

  const getToolImageUrl = (tool: { name: string; imageUrl: string; amazonUrl: string }): string | null => {
    // First check if we've already fetched an image for this tool
    if (toolImageUrls.has(tool.name)) {
      return toolImageUrls.get(tool.name) || null;
    }
    
    // Return null to show placeholder while fetching
    return null;
  };

  // Fetch images for recommended tools when AI response changes
  useEffect(() => {
    if (!aiResponse) return;

    const { recommendedTools } = parseRecommendedTools(aiResponse);
    
    // Fetch images for each recommended tool
    recommendedTools.forEach((tool) => {
      // Only fetch if we don't already have an image for this tool
      if (!toolImageUrls.has(tool.name)) {
        fetchToolImage(tool.name).catch(err => {
          console.error('Failed to fetch image for', tool.name, ':', err);
        });
      }
    });
  }, [aiResponse]);

  const parseRecommendedTools = (response: string): { inventorySection: string; recommendedTools: Array<{ name: string; description: string; amazonUrl: string; imageUrl: string }> } => {
    const separator = '---';
    const parts = response.split(separator);
    
    const inventorySection = parts[0]?.trim() || response;
    const recommendedSection = parts[1]?.trim() || '';
    
    const recommendedTools: Array<{ name: string; description: string; amazonUrl: string }> = [];
    
    if (recommendedSection) {
      // Parse recommended tools section
      // Look for patterns like:
      // 1. Tool Name
      //    - Description: ...
      //    - Amazon Search: https://...
      //    - Image URL: https://...
      // Handle variations in formatting
      const lines = recommendedSection.split('\n');
      let currentTool: { name: string; description: string; amazonUrl: string; imageUrl: string } | null = null;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if this is a numbered tool name (1., 2., 3.)
        const toolNameMatch = line.match(/^(\d+)\.\s*(.+)$/);
        if (toolNameMatch) {
          // Save previous tool if exists
          if (currentTool && currentTool.amazonUrl) {
            recommendedTools.push(currentTool);
          }
          // Start new tool
          currentTool = {
            name: toolNameMatch[2].trim(),
            description: '',
            amazonUrl: '',
            imageUrl: ''
          };
        }
        
        // Check for Description line
        const descMatch = line.match(/^-\s*Description:\s*(.+)$/i);
        if (descMatch && currentTool) {
          currentTool.description = descMatch[1].trim();
        }
        
        // Check for Amazon Search line
        const amazonMatch = line.match(/^-\s*Amazon Search:\s*(https?:\/\/[^\s]+)/i);
        if (amazonMatch && currentTool) {
          currentTool.amazonUrl = amazonMatch[1].trim();
        }
        
        // Check for Image URL line - handle variations
        const imageMatch = line.match(/^-\s*Image URL:\s*(https?:\/\/[^\s]+)/i) || 
                          line.match(/^-\s*Image:\s*(https?:\/\/[^\s]+)/i) ||
                          line.match(/Image URL:\s*(https?:\/\/[^\s]+)/i);
        if (imageMatch && currentTool) {
          currentTool.imageUrl = imageMatch[1].trim();
          console.log('🖼️ Found image URL:', currentTool.imageUrl);
        }
      }
      
      // Add last tool if exists
      if (currentTool && currentTool.amazonUrl) {
        recommendedTools.push(currentTool);
      }
    }
    
    return { inventorySection, recommendedTools };
  };

  // Parse inventory section into structured tool cards
  const parseInventoryTools = (inventoryText: string) => {
    const tools: Array<{
      name: string;
      binId: string | null;
      binName: string;
      binLocation: string;
      description: string;
    }> = [];
    
    const lines = inventoryText.split('\n');
    let currentTool: any = null;
    let description: string[] = [];
    
    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;
      
      // Check if this is a tool name (starts with number. OR starts with -)
      const numberedMatch = trimmedLine.match(/^(\d+)\.\s*(.+)$/);
      const bulletMatch = trimmedLine.match(/^-\s*(.+)$/);
      
      // Check if this line is a tool name
      // It's a tool name if:
      // 1. It starts with a number (1., 2., etc.) OR
      // 2. It starts with "-" followed by text that is NOT "Bin ID:", "Bin Name:", "Bin Location:", "Explanation:", or "Description:"
      //    Specifically, if it starts with "- Bin ID", "- Bin Name", "- Bin Location", "- Explanation", or "- Description", it's NOT a tool name
      const isSubItem = bulletMatch && trimmedLine.match(/^-\s*(Bin [Ii][Dd]|Bin [Nn]ame|Bin [Ll]ocation|Explanation|Description):/i);
      const isToolName = numberedMatch || (bulletMatch && !isSubItem);
      
      if (isToolName) {
        // Save previous tool if exists
        if (currentTool && currentTool.binName) {
          currentTool.description = description.join(' ').trim();
          tools.push(currentTool);
        }
        // Start new tool
        const toolName = numberedMatch ? numberedMatch[2].trim() : bulletMatch![1].trim();
        currentTool = {
          name: toolName,
          binId: null,
          binName: '',
          binLocation: '',
          description: ''
        };
        description = [];
        return;
      }
      
      // Check for bin ID (with or without leading dash) - must come before bin name check
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (8-4-4-4-12 hex digits)
      const binIdMatch = trimmedLine.match(/^[-]?\s*Bin [Ii][Dd]:\s*(.+)$/i);
      if (binIdMatch && currentTool) {
        const rawBinId = binIdMatch[1].trim();
        console.log('🔍 Raw bin ID text:', rawBinId);
        
        // Extract UUID from the text (might have extra characters)
        const uuidMatch = rawBinId.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (uuidMatch) {
          const binId = uuidMatch[1].toLowerCase();
          // Validate it's a proper UUID format
          if (binId.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
            currentTool.binId = binId;
            console.log('✅ Valid bin ID parsed:', binId);
          } else {
            console.warn('⚠️ Invalid bin ID format after extraction:', binId);
            currentTool.binId = null;
          }
        } else {
          console.warn('⚠️ No UUID found in bin ID text:', rawBinId);
          currentTool.binId = null;
        }
        return;
      }
      
      // Check for bin name (with or without leading dash)
      const binNameMatch = trimmedLine.match(/^[-]?\s*Bin [Nn]ame:\s*(.+)$/i);
      if (binNameMatch && currentTool) {
        currentTool.binName = binNameMatch[1].trim();
        return;
      }
      
      // Check for bin location (with or without leading dash)
      const binLocationMatch = trimmedLine.match(/^[-]?\s*Bin [Ll]ocation:\s*(.+)$/i);
      if (binLocationMatch && currentTool) {
        currentTool.binLocation = binLocationMatch[1].trim();
        return;
      }
      
      // Check for explanation/description (with or without leading dash)
      const explanationMatch = trimmedLine.match(/^[-]?\s*(Explanation|Description):\s*(.+)$/i);
      if (explanationMatch && currentTool) {
        // Add the explanation text (everything after "Explanation:" or "Description:")
        const explanationText = explanationMatch[2].trim();
        if (explanationText) {
          description.push(explanationText);
        }
        // Don't return - continue to capture any continuation lines
      }
      
      // Otherwise, if we have a current tool and it's not a known field, it's description/explanation continuation text
      if (currentTool && trimmedLine && !trimmedLine.match(/^[-]?\s*(Bin [Ii][Dd]|Bin [Nn]ame|Bin [Ll]ocation|Explanation|Description):/i)) {
        // Skip section headers and tool name lines
        if (!trimmedLine.match(/^SECTION/i) && 
            !trimmedLine.match(/^(\d+\.|-)\s/) && // Not a numbered or bulleted tool name
            !trimmedLine.match(/^---/)) { // Not a separator
          // This is continuation text for explanation/description
          description.push(trimmedLine);
        }
      }
    });
    
    // Add last tool if exists
    if (currentTool && currentTool.binName) {
      // Join description with spaces, but preserve structure
      currentTool.description = description.filter(d => d.trim()).join(' ').trim();
      console.log('🔍 Tool parsed:', { name: currentTool.name, binId: currentTool.binId, binName: currentTool.binName, descriptionLength: currentTool.description.length });
      tools.push(currentTool);
    }
    
    return tools;
  };

  const renderInventorySection = (inventoryText: string, isEmptyInventory: boolean = false) => {
    console.log('🔍 Parsing inventory section, text length:', inventoryText.length);
    console.log('🔍 First 200 chars:', inventoryText.substring(0, 200));
    
    // Show message if inventory is empty
    if (isEmptyInventory) {
      return (
        <View style={[styles.emptyInventoryCard, { backgroundColor: colors.background }]}>
          <IconSymbol name="exclamationmark.triangle" size={32} color={colors.textSecondary} />
          <Text style={[styles.emptyInventoryTitle, { color: colors.text }]}>
            No Tools Found in Your Inventory
          </Text>
          <Text style={[styles.emptyInventoryMessage, { color: colors.textSecondary }]}>
            We couldn't find any tools in your inventory that match your request. Check out the recommended tools below, or try a different search.
          </Text>
        </View>
      );
    }
    
    // Check if this is JSON format (should have been converted, but check anyway)
    const isJsonFormat = /"inventory_tools"\s*:\s*\[\s*\]/.test(inventoryText) || 
                         (inventoryText.includes('"inventory_tools"') && inventoryText.trim().startsWith('{'));
    
    if (isJsonFormat) {
      // Check if it's an empty array
      if (/"inventory_tools"\s*:\s*\[\s*\]/.test(inventoryText)) {
        console.log('📦 Empty inventory_tools array - showing empty message');
        return (
          <View style={[styles.emptyInventoryCard, { backgroundColor: colors.background }]}>
            <IconSymbol name="exclamationmark.triangle" size={32} color={colors.textSecondary} />
            <Text style={[styles.emptyInventoryTitle, { color: colors.text }]}>
              No Tools Found in Your Inventory
            </Text>
            <Text style={[styles.emptyInventoryMessage, { color: colors.textSecondary }]}>
              We couldn't find any tools in your inventory that match your request. Check out the recommended tools below, or try a different search.
            </Text>
          </View>
        );
      }
      // If it's JSON but not empty, it should have been converted already
      // But if it wasn't, skip it to avoid showing raw JSON
      console.log('⚠️ JSON format detected but not converted - skipping to avoid raw JSON display');
      return null;
    }
    
    const tools = parseInventoryTools(inventoryText);
    console.log('🔍 Parsed tools:', tools.length, tools.map(t => ({ name: t.name, binId: t.binId, binName: t.binName })));
    
    // Check for missing bin IDs
    const toolsWithoutBinId = tools.filter(t => !t.binId);
    if (toolsWithoutBinId.length > 0) {
      console.warn('⚠️ WARNING: Found', toolsWithoutBinId.length, 'tools without bin IDs:', toolsWithoutBinId.map(t => t.name));
      console.warn('⚠️ GPT did not include bin IDs for these tools. They will use fallback lookup by name/location.');
    }
    
    if (tools.length === 0) {
      // Only show text if it's not empty/whitespace and not JSON
      const cleanedText = inventoryText
        .replace(/SECTION 1[^\n]*/i, '')
        .replace(/Tools in Your Inventory:/i, '')
        .replace(/\(JSON FORMAT\)/i, '')
        .trim();
      
      if (!cleanedText || cleanedText.length === 0 || cleanedText.startsWith('{')) {
        // Empty or JSON - don't render
        return null;
      }
      
      console.log('⚠️ No tools parsed, showing text fallback');
      return (
        <Text style={[styles.aiResponseText, { color: colors.text }]}>
          {cleanedText}
        </Text>
      );
    }
    
    return (
      <>
        {tools.map((tool, index) => (
          <View key={index} style={[styles.toolCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.toolCardName, { color: colors.text }]}>
              {index + 1}. {tool.name}
            </Text>
            
            {tool.description && (
              <Text style={[styles.toolCardDescription, { color: colors.textSecondary }]}>
                {tool.description}
              </Text>
            )}
            
            <View style={styles.toolCardBinInfo}>
              <View style={styles.toolCardBinDetails}>
                <View style={styles.toolCardBinRow}>
                  <IconSymbol name="archivebox.fill" size={16} color={colors.primary} />
                  <Text style={[styles.toolCardBinText, { color: colors.text }]}>
                    {tool.binName}
                  </Text>
                </View>
                {tool.binLocation && (
                  <View style={styles.toolCardBinRow}>
                    <IconSymbol name="location.fill" size={16} color={colors.textSecondary} />
                    <Text style={[styles.toolCardLocationText, { color: colors.textSecondary }]}>
                      {tool.binLocation}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            
            <Pressable
              style={styles.viewBinButton}
              onPress={() => {
                console.log('🔗 View bin pressed:', tool.binName, 'location:', tool.binLocation, 'binId:', tool.binId);
                openInventoryForBin(tool.binId, tool.binName, tool.binLocation);
              }}
            >
              <Text style={styles.viewBinButtonText}>View Bin</Text>
              <IconSymbol name="arrow.right" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ))}
      </>
    );
  };

  const renderRecommendedTools = (tools: Array<{ name: string; description: string; amazonUrl: string; imageUrl: string }>) => {
    if (tools.length === 0) return null;
    
    return (
      <View style={styles.recommendedToolsSection}>
        <Text style={[styles.recommendedToolsTitle, { color: colors.text }]}>
          Recommended Tools to Purchase
        </Text>
        {tools.map((tool, index) => {
          const imageUrl = getToolImageUrl(tool);
          const hasFailed = imageUrl ? failedImageUrls.has(imageUrl) : true;
          const shouldShowImage = imageUrl && !hasFailed;
          
          console.log(`🖼️ Tool ${index + 1} (${tool.name}): Using image URL:`, imageUrl, 'Failed:', hasFailed);
          
          return (
            <View key={index} style={styles.recommendedToolCard}>
              {shouldShowImage ? (
                <Image
                  source={{ uri: imageUrl! }}
                  style={styles.recommendedToolImage}
                  resizeMode="contain"
                  onError={() => {
                    // Silently handle image load failures - show placeholder instead
                    if (imageUrl) {
                      setFailedImageUrls(prev => new Set(prev).add(imageUrl));
                    }
                  }}
                />
              ) : (
                <View style={styles.recommendedToolImagePlaceholder}>
                  <IconSymbol name="photo" size={48} color={colors.textSecondary} />
                  <Text style={[styles.placeholderText, { color: colors.textSecondary }]}>
                    {tool.name}
                  </Text>
                </View>
              )}
              <Text style={[styles.recommendedToolName, { color: colors.text }]}>
                {index + 1}. {tool.name}
              </Text>
              <Text style={[styles.recommendedToolDescription, { color: colors.textSecondary }]}>
                {tool.description}
              </Text>
              <Pressable
                onPress={() => openAmazonLink(tool.amazonUrl)}
                style={styles.amazonLinkButton}
              >
                <IconSymbol name="link" size={16} color="#FFFFFF" />
                <Text style={styles.amazonLinkText}>View on Amazon</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    );
  };

  const renderAIResponse = (response: string) => {
    console.log('🔍 Rendering AI response');
    
    // Check if response contains JSON format and convert it first
    let processedResponse = response;
    let isEmptyInventory = false; // Track if inventory is empty
    
    // Look for JSON - try multiple patterns
    let jsonStr = '';
    
    // Check if response mentions JSON format
    const hasJsonFormat = /JSON FORMAT|json format|```json/i.test(response);
    const jsonCodeBlockMatch = response.match(/```json\s*(\{[\s\S]*?)\s*```/i);
    
    if (jsonCodeBlockMatch) {
      jsonStr = jsonCodeBlockMatch[1];
    } else if (hasJsonFormat || response.includes('"inventory_tools"')) {
      // Find the start of the JSON object (look for opening brace before "inventory_tools")
      const inventoryToolsIndex = response.indexOf('"inventory_tools"');
      if (inventoryToolsIndex !== -1) {
        // Find the opening brace before "inventory_tools"
        let jsonStart = -1;
        for (let i = inventoryToolsIndex; i >= 0; i--) {
          if (response[i] === '{') {
            jsonStart = i;
            break;
          }
        }
        
        if (jsonStart !== -1) {
          // Find the matching closing brace for the root JSON object
          let braceCount = 0;
          let inString = false;
          let escapeNext = false;
          let jsonEnd = -1;
          
          for (let i = jsonStart; i < response.length; i++) {
            const char = response[i];
            
            if (escapeNext) {
              escapeNext = false;
              continue;
            }
            
            if (char === '\\') {
              escapeNext = true;
              continue;
            }
            
            if (char === '"') {
              inString = !inString;
              continue;
            }
            
            if (!inString) {
              if (char === '{') braceCount++;
              if (char === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i + 1;
                  break;
                }
              }
            }
          }
          
          if (jsonEnd === -1) {
            // JSON might be incomplete - try to find end by separator or end of line
            const separatorIndex = response.indexOf('---', jsonStart);
            const section2Index = response.indexOf('SECTION 2', jsonStart);
            const endIndex = separatorIndex !== -1 ? separatorIndex : 
                           (section2Index !== -1 ? section2Index : response.length);
            jsonStr = response.substring(jsonStart, endIndex).trim();
            
            // Try to close incomplete JSON
            const openBraces = (jsonStr.match(/\{/g) || []).length;
            const closeBraces = (jsonStr.match(/\}/g) || []).length;
            const openBrackets = (jsonStr.match(/\[/g) || []).length;
            const closeBrackets = (jsonStr.match(/\]/g) || []).length;
            
            if (openBrackets > closeBrackets) {
              jsonStr += ']'.repeat(openBrackets - closeBrackets);
            }
            if (openBraces > closeBraces) {
              jsonStr += '}'.repeat(openBraces - closeBraces);
            }
          } else {
            // Extract complete JSON object
            jsonStr = response.substring(jsonStart, jsonEnd);
          }
        }
      }
    }
    
    if (jsonStr) {
      try {
        // Try to parse complete JSON first
        const jsonData = JSON.parse(jsonStr);
        
        if (jsonData && jsonData.inventory_tools && Array.isArray(jsonData.inventory_tools)) {
          if (jsonData.inventory_tools.length > 0) {
            console.log('📦 Client-side: Found complete JSON format, converting to text');
            
            // Convert JSON to text format
            let textFormat = 'SECTION 1 - Tools in Your Inventory:\n\n';
            jsonData.inventory_tools.forEach((tool: any, index: number) => {
              if (!tool || !tool.tool_name) return;
              textFormat += `${index + 1}. ${String(tool.tool_name || 'Unknown Tool')}\n`;
              textFormat += `   - Bin ID: ${tool.bin_id || 'MISSING'}\n`;
              textFormat += `   - Bin Name: ${String(tool.bin_name || '')}\n`;
              textFormat += `   - Bin Location: ${String(tool.bin_location || '')}\n`;
              if (tool.explanation) {
                textFormat += `   - Explanation: ${String(tool.explanation)}\n`;
              }
              textFormat += '\n';
            });
            
            // Replace JSON section with text format, keep recommended tools section if present
            const recommendedToolsSection = response.split('---').slice(1).join('---');
            processedResponse = textFormat + (recommendedToolsSection ? '---' + recommendedToolsSection : '');
          } else {
            // Empty array - mark as empty and keep recommended tools
            console.log('📦 Client-side: Found empty inventory_tools array');
            isEmptyInventory = true;
            const jsonStartIndex = response.indexOf('{');
            const jsonEndIndex = response.indexOf('}', jsonStartIndex);
            if (jsonStartIndex !== -1) {
              const beforeJson = response.substring(0, jsonStartIndex).replace(/\(JSON FORMAT\)/i, '').trim();
              const afterJson = jsonEndIndex !== -1 ? response.substring(jsonEndIndex + 1) : response.substring(jsonStartIndex);
              // Remove empty JSON and section header, keep recommended tools
              const recommendedToolsSection = afterJson.includes('SECTION 2') ? afterJson.substring(afterJson.indexOf('SECTION 2')) : afterJson;
              processedResponse = recommendedToolsSection.trim();
            }
          }
        }
      } catch (error) {
        // JSON might be truncated - try to extract individual tool objects manually
        console.warn('⚠️ Client-side: JSON parse failed, trying to extract incomplete JSON:', error);
        console.log('📝 JSON string preview:', jsonStr.substring(0, 500));
        
        try {
          // Extract tool objects by finding individual JSON objects
          // Use original response to ensure we have the full context
          const searchText = jsonStr || response;
          const tools: Array<{tool_name: string, bin_id: string, bin_name: string, bin_location: string, explanation?: string}> = [];
          
          // Find all tool objects using regex to handle whitespace variations
          const toolPattern = /\{\s*"tool_name"\s*:/g;
          let match;
          
          while ((match = toolPattern.exec(searchText)) !== null) {
            const toolStart = match.index;
            
            // Find the matching closing brace
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            let toolEnd = -1;
            
            for (let i = toolStart; i < searchText.length; i++) {
              const char = searchText[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                continue;
              }
              
              if (char === '"') {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '{') braceCount++;
                if (char === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    toolEnd = i + 1;
                    break;
                  }
                }
              }
            }
            
            if (toolEnd === -1) {
              // Incomplete object - try to extract what we can
              const partialJson = searchText.substring(toolStart);
              // Try to parse fields individually
              const toolNameMatch = partialJson.match(/"tool_name"\s*:\s*"([^"]+)"/);
              const binIdMatch = partialJson.match(/"bin_id"\s*:\s*"([^"]+)"/);
              const binNameMatch = partialJson.match(/"bin_name"\s*:\s*"([^"]+)"/);
              const binLocationMatch = partialJson.match(/"bin_location"\s*:\s*"([^"]+)"/);
              const explanationMatch = partialJson.match(/"explanation"\s*:\s*"([^"]*)"/);
              
              if (toolNameMatch && binIdMatch && binNameMatch && binLocationMatch) {
                tools.push({
                  tool_name: toolNameMatch[1],
                  bin_id: binIdMatch[1],
                  bin_name: binNameMatch[1],
                  bin_location: binLocationMatch[1],
                  explanation: explanationMatch ? explanationMatch[1] : undefined
                });
              }
              break; // Stop after incomplete object
            } else {
              // Try to parse the complete object
              try {
                const toolJson = searchText.substring(toolStart, toolEnd);
                const tool = JSON.parse(toolJson);
                if (tool.tool_name && tool.bin_id) {
                  tools.push({
                    tool_name: tool.tool_name,
                    bin_id: tool.bin_id,
                    bin_name: tool.bin_name || '',
                    bin_location: tool.bin_location || '',
                    explanation: tool.explanation
                  });
                }
              } catch (e) {
                // Skip this object if it doesn't parse
                console.warn('⚠️ Failed to parse tool object:', e);
              }
            }
          }
          
          if (tools.length > 0) {
            console.log(`✅ Client-side: Extracted ${tools.length} tools from incomplete JSON`);
            console.log('📋 Extracted tools:', tools.map(t => t.tool_name));
            
            // Convert to text format
            let textFormat = 'SECTION 1 - Tools in Your Inventory:\n\n';
            tools.forEach((tool, index) => {
              textFormat += `${index + 1}. ${tool.tool_name}\n`;
              textFormat += `   - Bin ID: ${tool.bin_id}\n`;
              textFormat += `   - Bin Name: ${tool.bin_name}\n`;
              textFormat += `   - Bin Location: ${tool.bin_location}\n`;
              if (tool.explanation) {
                textFormat += `   - Explanation: ${tool.explanation}\n`;
              }
              textFormat += '\n';
            });
            
            // Replace JSON section with text format
            const jsonStartIndex = response.indexOf('{');
            if (jsonStartIndex !== -1) {
              const beforeJson = response.substring(0, jsonStartIndex).replace(/\(JSON FORMAT\)/i, '').trim();
              const afterJson = response.includes('---') ? response.split('---').slice(1).join('---') : '';
              processedResponse = beforeJson + '\n\n' + textFormat + (afterJson ? '---' + afterJson : '');
              console.log('✅ Converted JSON to text format, length:', processedResponse.length);
            } else {
              console.warn('⚠️ Could not find JSON start in response');
            }
          } else {
            console.warn('⚠️ No tools extracted from JSON');
          }
        } catch (extractError) {
          console.warn('⚠️ Client-side: Failed to extract incomplete JSON, using original response:', extractError);
        }
      }
    }
    
    const { inventorySection, recommendedTools } = parseRecommendedTools(processedResponse);
    
    return (
      <>
        {renderInventorySection(inventorySection, isEmptyInventory)}
        {renderRecommendedTools(recommendedTools)}
      </>
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

  const canSearch = advancedSearchQuery.trim().length > 0;

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
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            {/* Search Section */}
            <View style={styles.searchSection}>
                <View style={[styles.advancedSearchContainer, { backgroundColor: colors.card }]}>
                  <View style={styles.advancedSearchHeader}>
                    <IconSymbol name="sparkles" size={20} color={colors.primary} />
                    <Text style={[styles.advancedSearchLabel, { color: colors.text }]}>
                      Advanced Search
                    </Text>
                  </View>
                  <TextInput
                    style={[styles.advancedSearchInput, { color: colors.text }]}
                    placeholder="What would be good to use for removing drywall?"
                    placeholderTextColor={colors.textSecondary}
                    value={advancedSearchQuery}
                    onChangeText={setAdvancedSearchQuery}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  {advancedSearchQuery.length > 0 && (
                    <Pressable 
                      style={styles.clearButton}
                      onPress={() => setAdvancedSearchQuery('')}
                    >
                      <IconSymbol name="xmark.circle.fill" size={20} color={colors.textSecondary} />
                    </Pressable>
                  )}
                </View>
              <Pressable
                style={[styles.searchButton, (!canSearch || searching) && styles.searchButtonDisabled]}
                onPress={searchToolsAdvanced}
                disabled={!canSearch || searching}
              >
                {searching ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.searchButtonText}>Search</Text>
                )}
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              removeClippedSubviews={false}
              scrollEnabled={true}
              bounces={true}
              directionalLockEnabled={true}
              alwaysBounceVertical={true}
            >
              {!hasSearched ? (
                <View style={styles.emptyState}>
                  <IconSymbol 
                    name="sparkles" 
                    size={64} 
                    color={colors.textSecondary} 
                  />
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    AI-Powered Tool Search
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Ask questions like "What tools do I need for drywall work?" and get AI-powered recommendations from your inventory
                  </Text>
                  <Pressable style={styles.viewInventoryButton} onPress={openViewInventory}>
                    <IconSymbol name="tray.fill" size={20} color={colors.primary} />
                    <Text style={[styles.viewInventoryText, { color: colors.primary }]}>
                      View Full Inventory
                    </Text>
                  </Pressable>
                </View>
              ) : searching ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.text }]}>
                    AI is analyzing your inventory...
                  </Text>
                </View>
              ) : aiResponse ? (
                <View style={styles.aiResponseContainer}>
                  <View style={styles.aiResponseHeader}>
                    <IconSymbol name="sparkles" size={24} color={colors.primary} />
                    <Text style={[styles.aiResponseTitle, { color: colors.text }]}>
                      AI Recommendation
                    </Text>
                  </View>
                  <View style={[styles.aiResponseCard, { backgroundColor: colors.card }]}>
                    {renderAIResponse(aiResponse)}
                  </View>
                  <Pressable style={styles.viewInventoryButton} onPress={openViewInventory}>
                    <IconSymbol name="tray.fill" size={20} color={colors.primary} />
                    <Text style={[styles.viewInventoryText, { color: colors.primary }]}>
                      View Full Inventory
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

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
  innerContainer: {
    flex: 1,
  },
  modeToggleContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  modeButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  advancedSearchContainer: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  advancedSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  advancedSearchLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  advancedSearchInput: {
    fontSize: 16,
    minHeight: 80,
    maxHeight: 120,
  },
  clearButton: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonDisabled: {
    opacity: 0.6,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
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
  viewInventoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 12,
  },
  viewInventoryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  aiResponseContainer: {
    flex: 1,
  },
  aiResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  aiResponseTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  aiResponseCard: {
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  aiResponseText: {
    fontSize: 16,
    lineHeight: 28,
  },
  toolName: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  binLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  toolCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
  },
  toolCardName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  toolCardDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  toolCardBinInfo: {
    marginTop: 8,
    gap: 12,
  },
  toolCardBinDetails: {
    gap: 4,
    marginBottom: 12,
  },
  toolCardBinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  toolCardBinText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  toolCardLocationText: {
    fontSize: 14,
    flex: 1,
  },
  emptyInventoryCard: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    gap: 12,
  },
  emptyInventoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyInventoryMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  viewBinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'stretch',
  },
  viewBinButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  recommendedToolsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
  },
  recommendedToolsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  recommendedToolCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Platform.OS === 'ios' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.2)',
  },
  recommendedToolImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
  },
  recommendedToolImagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  recommendedToolName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendedToolDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  amazonLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FF9900',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  amazonLinkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultsHeader: {
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultCard: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  resultImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.background,
  },
  resultContent: {
    padding: 16,
  },
  resultHeader: {
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
  moreTools: {
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 20,
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
