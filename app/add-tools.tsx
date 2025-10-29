
import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@integrations/supabase/client';
import { decode } from 'base64-arraybuffer';

export default function AddToolsScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [toolsList, setToolsList] = useState<string>('');
  const [binName, setBinName] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Refs for TextInputs to enable keyboard navigation
  const binLocationRef = useRef<TextInput>(null);

  const pickImage = async () => {
    try {
      console.log('📸 Requesting camera permissions');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('❌ Camera permission denied');
        Alert.alert('Permission Required', 'Camera permission is needed to take photos');
        return;
      }

      console.log('✅ Launching camera');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log(`✅ Image captured: ${uri.substring(0, 50)}...`);
        setImageUri(uri);
        analyzeImage(uri);
      }
    } catch (error) {
      console.error(`❌ Error in pickImage: ${error}`);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    try {
      console.log('🖼️ Requesting gallery permissions');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('❌ Gallery permission denied');
        Alert.alert('Permission Required', 'Photo library permission is needed');
        return;
      }

      console.log('✅ Launching gallery');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log(`✅ Image selected: ${uri.substring(0, 50)}...`);
        setImageUri(uri);
        analyzeImage(uri);
      }
    } catch (error) {
      console.error(`❌ Error in pickFromGallery: ${error}`);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const analyzeImage = async (uri: string | null) => {
    if (!uri) {
      console.log('❌ No image URI provided');
      Alert.alert('Error', 'No image selected');
      return;
    }

    if (Platform.OS === 'web') {
      console.log('⚠️ Image analysis not supported on web');
      Alert.alert('Not Supported', 'Image analysis is not supported on web. Please enter tools manually.');
      return;
    }

    console.log(`🤖 Starting image analysis`);
    setAnalyzing(true);
    setToolsList('');
    
    try {
      console.log('📁 Checking file exists');
      const fileInfo = await FileSystem.getInfoAsync(uri);
      
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }

      console.log('🔄 Converting to base64');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`✅ Base64 ready (${base64.length} chars)`);

      // Validate size (20MB limit to match Gemini API)
      const sizeInMB = (base64.length * 0.75) / (1024 * 1024);
      if (sizeInMB > 20) {
        console.log(`❌ Image too large: ${sizeInMB.toFixed(2)}MB`);
        throw new Error(`Image is too large (${sizeInMB.toFixed(1)}MB). Maximum is 20MB. Please use a smaller image.`);
      }

      console.log(`📊 Image size: ${sizeInMB.toFixed(2)}MB`);
      console.log('🌐 Calling Edge Function');

      // Call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        const { data, error } = await supabase.functions.invoke('analyze-tools-image', {
          body: { imageBase64: base64 },
        });

        clearTimeout(timeoutId);

        if (error) {
          console.log(`❌ Edge Function error: ${JSON.stringify(error)}`);
          throw new Error(`API Error: ${error.message || 'Unknown error'}`);
        }

        console.log(`✅ Response received`);
        console.log('Full response data:', data);

        if (data.error) {
          console.log(`❌ API error: ${data.error}`);
          throw new Error(data.error);
        }

        if (data.tools && Array.isArray(data.tools) && data.tools.length > 0) {
          console.log(`✅ Found ${data.tools.length} tools`);
          const toolsText = data.tools.join('\n');
          setToolsList(toolsText);
          
          Alert.alert(
            '✨ AI Analysis Complete!',
            `Gemini identified ${data.tools.length} tool${data.tools.length === 1 ? '' : 's'}. You can edit the list if needed.`
          );
        } else {
          console.log('⚠️ No tools found');
          Alert.alert(
            'No Tools Found',
            'Gemini couldn\'t identify any tools. Please enter them manually.'
          );
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timeout after 60 seconds');
        }
        throw fetchError;
      }
      
    } catch (error) {
      console.error(`❌ Analysis error: ${error}`);
      
      let errorMessage = 'Failed to analyze image. ';
      if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      Alert.alert(
        'AI Analysis Error',
        errorMessage + '\n\nPlease enter tools manually or try again.',
        [{ text: 'OK' }]
      );
    } finally {
      console.log('🏁 Analysis complete');
      setAnalyzing(false);
    }
  };

  const uploadImageToSupabase = async (uri: string): Promise<string> => {
    try {
      console.log('☁️ Starting image upload to Supabase');
      
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      console.log(`📦 Base64 size: ${(base64.length * 0.75 / 1024).toFixed(2)} KB`);

      // Convert base64 to ArrayBuffer using decode
      const arrayBuffer = decode(base64);

      console.log(`📦 ArrayBuffer size: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);

      const fileName = `tool-${Date.now()}.jpg`;
      console.log(`📝 Uploading as: ${fileName}`);

      const { data, error } = await supabase.storage
        .from('tool-images')
        .upload(fileName, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.log(`❌ Upload error: ${error.message}`);
        console.error('Storage upload error:', error);
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      console.log(`✅ Upload successful: ${data.path}`);

      const { data: urlData } = supabase.storage
        .from('tool-images')
        .getPublicUrl(fileName);

      console.log(`✅ Public URL: ${urlData.publicUrl}`);
      return urlData.publicUrl;
    } catch (error) {
      console.error(`❌ Upload failed: ${error}`);
      throw error;
    }
  };

  const saveInventory = async () => {
    if (!imageUri) {
      Alert.alert('Missing Image', 'Please take a photo of your tools');
      return;
    }

    if (!toolsList.trim()) {
      Alert.alert('Missing Tools', 'Please enter the tools or wait for AI analysis');
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

    // Dismiss keyboard before saving
    Keyboard.dismiss();

    setSaving(true);
    console.log('💾 Starting save process');
    
    try {
      // Step 1: Upload image
      console.log('📤 Step 1: Uploading image');
      const imageUrl = await uploadImageToSupabase(imageUri);
      
      if (!imageUrl) {
        throw new Error('Image upload returned empty URL');
      }

      console.log(`✅ Image uploaded: ${imageUrl.substring(0, 50)}...`);

      // Step 2: Prepare tools array
      const tools = toolsList
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      console.log(`📝 Prepared ${tools.length} tools`);

      // Step 3: Insert into database
      console.log('💾 Step 2: Inserting into database');
      const insertData = {
        image_url: imageUrl,
        tools: tools,
        bin_name: binName,
        bin_location: binLocation,
      };

      console.log('Insert data:', insertData);

      const { data, error } = await supabase
        .from('tool_inventory')
        .insert(insertData)
        .select();

      if (error) {
        console.log(`❌ Database error: ${error.message}`);
        console.error('Database insert error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Saved successfully to database');
      console.log('Inserted data:', data);

      Alert.alert(
        '✅ Success!',
        'Tools added to inventory!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error(`❌ Save failed: ${error}`);
      
      let errorMessage = 'Failed to save inventory. ';
      if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setSaving(false);
      console.log('🏁 Save process complete');
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
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>1. Take a Photo</Text>
                {imageUri ? (
                  <View style={styles.imageContainer}>
                    <Image source={{ uri: imageUri }} style={styles.image} />
                    <Pressable
                      style={styles.changeImageButton}
                      onPress={() => {
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

              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>2. List of Tools</Text>
                  {imageUri && !analyzing && (
                    <Pressable
                      style={styles.reanalyzeButton}
                      onPress={() => analyzeImage(imageUri)}
                    >
                      <IconSymbol name="arrow.clockwise" color={colors.primary} size={18} />
                      <Text style={styles.reanalyzeText}>Re-analyze</Text>
                    </Pressable>
                  )}
                </View>
                {analyzing ? (
                  <View style={styles.analyzingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.analyzingText}>🤖 Analyzing with Gemini AI...</Text>
                    <Text style={styles.analyzingSubtext}>This may take 10-60 seconds</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.aiInfoBadge}>
                      <IconSymbol name="sparkles" color={colors.accent} size={16} />
                      <Text style={styles.aiInfoText}>AI-powered by Google Gemini</Text>
                    </View>
                    <Text style={styles.helperText}>
                      Enter each tool on a new line. AI will identify tools automatically when you take a photo.
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

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>3. Storage Information</Text>
                <Text style={styles.label}>Bin Name/ID</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Red Toolbox, Bin A3"
                  placeholderTextColor={colors.textSecondary}
                  value={binName}
                  onChangeText={setBinName}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    binLocationRef.current?.focus();
                  }}
                />

                <Text style={styles.label}>Bin Location</Text>
                <TextInput
                  ref={binLocationRef}
                  style={styles.input}
                  placeholder="e.g., Top shelf, Garage wall"
                  placeholderTextColor={colors.textSecondary}
                  value={binLocation}
                  onChangeText={setBinLocation}
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

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

              {/* Extra padding at bottom to ensure content is visible above keyboard */}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
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
  scrollContent: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  bottomSpacer: {
    height: 100,
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
