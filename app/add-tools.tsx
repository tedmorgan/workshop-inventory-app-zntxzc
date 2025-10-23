
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@integrations/supabase/client';

export default function AddToolsScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [toolsList, setToolsList] = useState<string>('');
  const [binName, setBinName] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Add debug logging helper
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugLog(prev => [...prev, logMessage].slice(-10)); // Keep last 10 logs
  };

  useEffect(() => {
    addDebugLog('🚀 AddToolsScreen mounted');
  }, []);

  const pickImage = async () => {
    try {
      addDebugLog('📸 pickImage() called - requesting camera permissions');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        addDebugLog('❌ Camera permission denied');
        Alert.alert('Permission Required', 'Camera permission is needed to take photos');
        return;
      }

      addDebugLog('✅ Camera permission granted - launching camera');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      addDebugLog(`📸 Camera result - canceled: ${result.canceled}, assets: ${result.assets?.length || 0}`);

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        addDebugLog(`✅ Image captured: ${uri.substring(0, 50)}...`);
        setImageUri(uri);
        
        // Trigger analysis
        addDebugLog('🤖 About to call analyzeImage()');
        setTimeout(() => {
          addDebugLog('🤖 Calling analyzeImage() now');
          analyzeImage(uri);
        }, 100);
      } else {
        addDebugLog('📸 Camera was canceled by user');
      }
    } catch (error) {
      addDebugLog(`❌ Error in pickImage: ${error}`);
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    try {
      addDebugLog('🖼️ pickFromGallery() called - requesting permissions');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        addDebugLog('❌ Gallery permission denied');
        Alert.alert('Permission Required', 'Photo library permission is needed');
        return;
      }

      addDebugLog('✅ Gallery permission granted - launching picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      addDebugLog(`🖼️ Gallery result - canceled: ${result.canceled}, assets: ${result.assets?.length || 0}`);

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        addDebugLog(`✅ Image selected: ${uri.substring(0, 50)}...`);
        setImageUri(uri);
        
        // Trigger analysis
        addDebugLog('🤖 About to call analyzeImage()');
        setTimeout(() => {
          addDebugLog('🤖 Calling analyzeImage() now');
          analyzeImage(uri);
        }, 100);
      } else {
        addDebugLog('🖼️ Gallery was canceled by user');
      }
    } catch (error) {
      addDebugLog(`❌ Error in pickFromGallery: ${error}`);
      console.error('❌ Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const analyzeImage = async (uri: string) => {
    addDebugLog(`🤖 analyzeImage() STARTED with URI: ${uri.substring(0, 50)}...`);
    setAnalyzing(true);
    setToolsList(''); // Clear previous results
    
    try {
      addDebugLog('🤖 Step 1: Checking if file exists');
      
      // Check if file exists using legacy API
      const fileInfo = await FileSystem.getInfoAsync(uri);
      addDebugLog(`📁 File exists: ${fileInfo.exists}, size: ${fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 'unknown'}`);
      
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }

      // Convert image to base64
      addDebugLog('🤖 Step 2: Converting to base64');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      addDebugLog(`✅ Base64 conversion complete - length: ${base64.length} chars`);
      
      // Validate base64 string
      if (!base64 || base64.length === 0) {
        throw new Error('Failed to convert image to base64');
      }

      addDebugLog('🤖 Step 3: Getting Supabase session for authentication');
      
      // Get the current session to include auth token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        addDebugLog(`⚠️ Session error (will try anonymous): ${sessionError.message}`);
      }
      
      addDebugLog(`🔑 Session status: ${session ? 'authenticated' : 'anonymous'}`);

      addDebugLog('🤖 Step 4: Calling Edge Function via Supabase client');
      const requestBody = { imageBase64: base64 };
      addDebugLog(`📦 Request body size: ${JSON.stringify(requestBody).length} bytes`);

      // Call Edge Function using Supabase client (handles auth automatically)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        addDebugLog('⏰ Request timeout - aborting');
        controller.abort();
      }, 60000); // 60 second timeout

      try {
        addDebugLog('🌐 Invoking Edge Function: analyze-tools-image');
        
        const { data, error } = await supabase.functions.invoke('analyze-tools-image', {
          body: requestBody,
          headers: {
            'Content-Type': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (error) {
          addDebugLog(`❌ Edge Function error: ${error.message}`);
          throw new Error(`Edge Function failed: ${error.message}`);
        }

        addDebugLog(`📥 Response data: ${JSON.stringify(data)?.substring(0, 200)}`);

        if (data.error) {
          addDebugLog(`❌ Data contains error: ${data.error}`);
          throw new Error(data.error);
        }

        if (data.tools && Array.isArray(data.tools) && data.tools.length > 0) {
          addDebugLog(`✅ Tools identified: ${data.tools.length} tools`);
          addDebugLog(`✅ Tools list: ${data.tools.join(', ')}`);
          
          // Convert array to newline-separated string
          const toolsText = data.tools.join('\n');
          setToolsList(toolsText);
          
          Alert.alert(
            '✨ AI Analysis Complete!',
            `Gemini identified ${data.tools.length} tool${data.tools.length === 1 ? '' : 's'} in your image. You can edit the list if needed.`,
            [{ text: 'OK' }]
          );
        } else {
          addDebugLog('⚠️ No tools found in response');
          Alert.alert(
            'No Tools Found',
            'Gemini couldn\'t identify any tools in this image. Please enter them manually.',
            [{ text: 'OK' }]
          );
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          addDebugLog('❌ Request timed out after 60 seconds');
          throw new Error('Request timed out. The AI is taking too long to respond. Please try again.');
        }
        throw fetchError;
      }
      
    } catch (error) {
      addDebugLog(`❌ Error in analyzeImage: ${error}`);
      console.error('❌ Error analyzing image:', error);
      
      let errorMessage = 'Failed to analyze image with AI. ';
      
      if (error instanceof Error) {
        addDebugLog(`❌ Error message: ${error.message}`);
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred. Please enter tools manually.';
      }
      
      Alert.alert('AI Analysis Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      addDebugLog('🏁 analyzeImage() FINISHED - setting analyzing to false');
      setAnalyzing(false);
    }
  };

  const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
    try {
      addDebugLog('☁️ Uploading image to Supabase Storage');
      
      // Read the file as base64 using legacy API
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to blob
      const response = await fetch(`data:image/jpeg;base64,${base64}`);
      const blob = await response.blob();

      // Generate unique filename
      const fileName = `tool-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      addDebugLog(`☁️ Uploading to storage bucket: ${filePath}`);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('tool-images')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        addDebugLog(`❌ Storage upload error: ${error.message}`);
        throw error;
      }

      addDebugLog('✅ Image uploaded successfully');

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('tool-images')
        .getPublicUrl(filePath);

      addDebugLog(`✅ Public URL: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      addDebugLog(`❌ Error uploading image: ${error}`);
      console.error('❌ Error uploading image:', error);
      return null;
    }
  };

  const saveInventory = async () => {
    if (!imageUri) {
      Alert.alert('Missing Image', 'Please take a photo of your tools');
      return;
    }

    if (!toolsList.trim()) {
      Alert.alert('Missing Tools', 'Please enter the tools in the photo or wait for AI analysis to complete');
      return;
    }

    if (!binName.trim()) {
      Alert.alert('Missing Bin Name', 'Please enter the storage bin name');
      return;
    }

    if (!binLocation.trim()) {
      Alert.alert('Missing Location', 'Please enter where the bin is located');
      return;
    }

    setSaving(true);
    try {
      addDebugLog('💾 Saving inventory to Supabase');
      
      // Upload image to Supabase Storage
      const imageUrl = await uploadImageToSupabase(imageUri);
      
      if (!imageUrl) {
        throw new Error('Failed to upload image');
      }

      // Parse tools list (split by newlines)
      const tools = toolsList
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      addDebugLog(`💾 Inserting into database: ${tools.length} tools`);

      // Save to Supabase database
      const { data, error } = await supabase
        .from('tool_inventory')
        .insert({
          image_url: imageUrl,
          tools: tools,
          bin_name: binName,
          bin_location: binLocation,
        })
        .select()
        .single();

      if (error) {
        addDebugLog(`❌ Database insert error: ${error.message}`);
        throw error;
      }

      addDebugLog('✅ Inventory saved successfully');

      Alert.alert(
        '✅ Success!',
        'Tools added to inventory!',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      addDebugLog(`❌ Error saving inventory: ${error}`);
      console.error('❌ Error saving inventory:', error);
      Alert.alert(
        'Error',
        'Failed to save inventory. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Add Tools',
          headerBackTitle: 'Back',
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Debug Log Section - Only show if there are logs */}
          {debugLog.length > 0 && (
            <View style={styles.debugSection}>
              <Text style={styles.debugTitle}>🔍 Debug Log (Last 10 events)</Text>
              <ScrollView style={styles.debugLogContainer} nestedScrollEnabled>
                {debugLog.map((log, index) => (
                  <Text key={index} style={styles.debugLogText}>{log}</Text>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Image Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Take a Photo</Text>
            {imageUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <Pressable
                  style={styles.changeImageButton}
                  onPress={() => {
                    addDebugLog('🗑️ Clearing image and resetting form');
                    setImageUri(null);
                    setToolsList('');
                  }}
                >
                  <IconSymbol name="xmark.circle.fill" color="#FFFFFF" size={24} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.imagePlaceholder}>
                <IconSymbol name="camera.fill" color={colors.textSecondary} size={48} />
                <Text style={styles.placeholderText}>No photo taken yet</Text>
                <View style={styles.buttonRow}>
                  <Pressable style={styles.imageButton} onPress={pickImage}>
                    <IconSymbol name="camera" color="#FFFFFF" size={20} />
                    <Text style={styles.imageButtonText}>Camera</Text>
                  </Pressable>
                  <Pressable style={[styles.imageButton, styles.galleryButton]} onPress={pickFromGallery}>
                    <IconSymbol name="photo" color="#FFFFFF" size={20} />
                    <Text style={styles.imageButtonText}>Gallery</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Tools List Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>2. List of Tools</Text>
              {imageUri && !analyzing && (
                <Pressable
                  style={styles.reanalyzeButton}
                  onPress={() => {
                    addDebugLog('🔄 Manual re-analyze triggered');
                    analyzeImage(imageUri);
                  }}
                >
                  <IconSymbol name="arrow.clockwise" color={colors.primary} size={18} />
                  <Text style={styles.reanalyzeText}>Re-analyze</Text>
                </Pressable>
              )}
            </View>
            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.analyzingText}>🤖 Analyzing image with Gemini AI...</Text>
                <Text style={styles.analyzingSubtext}>This may take up to 60 seconds</Text>
                <Text style={styles.analyzingSubtext}>Check debug log above for progress</Text>
              </View>
            ) : (
              <>
                <View style={styles.aiInfoBadge}>
                  <IconSymbol name="sparkles" color={colors.accent} size={16} />
                  <Text style={styles.aiInfoText}>
                    AI-powered by Google Gemini
                  </Text>
                </View>
                <Text style={styles.helperText}>
                  Enter each tool on a new line. The AI will automatically identify tools when you take a photo.
                </Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Example:&#10;Hammer&#10;Screwdriver set&#10;Wrench&#10;Pliers"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={8}
                  value={toolsList}
                  onChangeText={setToolsList}
                  textAlignVertical="top"
                />
              </>
            )}
          </View>

          {/* Storage Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Storage Information</Text>
            <Text style={styles.label}>Bin Name/ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Red Toolbox, Bin A3"
              placeholderTextColor={colors.textSecondary}
              value={binName}
              onChangeText={setBinName}
            />

            <Text style={styles.label}>Bin Location</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Top shelf, Garage wall"
              placeholderTextColor={colors.textSecondary}
              value={binLocation}
              onChangeText={setBinLocation}
            />
          </View>

          {/* Save Button */}
          <Pressable
            style={[styles.saveButton, (saving || analyzing) && styles.saveButtonDisabled]}
            onPress={saveInventory}
            disabled={saving || analyzing}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="checkmark.circle.fill" color="#FFFFFF" size={24} />
                <Text style={styles.saveButtonText}>Save to Inventory</Text>
              </>
            )}
          </Pressable>
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
    paddingBottom: 40,
  },
  debugSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#00ff00',
    marginBottom: 8,
  },
  debugLogContainer: {
    maxHeight: 200,
  },
  debugLogText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#00ff00',
    marginBottom: 2,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  reanalyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: `${colors.primary}15`,
    borderRadius: 16,
  },
  reanalyzeText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  image: {
    width: '100%',
    height: 300,
    backgroundColor: colors.background,
  },
  changeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    padding: 4,
  },
  imagePlaceholder: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  galleryButton: {
    backgroundColor: colors.secondary,
  },
  imageButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  analyzingContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  analyzingText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
    fontWeight: '600',
  },
  analyzingSubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  aiInfoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.accent}15`,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  aiInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  helperText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    minHeight: 160,
    borderWidth: 1,
    borderColor: colors.background,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.background,
  },
  saveButton: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
});
