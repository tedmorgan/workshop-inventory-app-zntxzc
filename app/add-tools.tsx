
import React, { useState } from 'react';
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
import * as FileSystem from 'expo-file-system';
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

  const pickImage = async () => {
    try {
      console.log('📸 Requesting camera permissions...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos');
        return;
      }

      console.log('📸 Launching camera...');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      console.log('📸 Camera result:', result);

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log('📸 Image selected from camera:', uri);
        setImageUri(uri);
        // Auto-analyze the image with Gemini
        console.log('🤖 Triggering analyzeImage...');
        await analyzeImage(uri);
      } else {
        console.log('📸 Camera was canceled');
      }
    } catch (error) {
      console.error('❌ Error picking image:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    try {
      console.log('🖼️ Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is needed');
        return;
      }

      console.log('🖼️ Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      console.log('🖼️ Gallery result:', result);

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log('🖼️ Image selected from gallery:', uri);
        setImageUri(uri);
        // Auto-analyze the image with Gemini
        console.log('🤖 Triggering analyzeImage...');
        await analyzeImage(uri);
      } else {
        console.log('🖼️ Gallery was canceled');
      }
    } catch (error) {
      console.error('❌ Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const analyzeImage = async (uri: string) => {
    console.log('🤖 analyzeImage called with URI:', uri);
    setAnalyzing(true);
    setToolsList(''); // Clear previous results
    
    try {
      console.log('🤖 Starting image analysis with Gemini...');
      
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📁 File info:', fileInfo);
      
      if (!fileInfo.exists) {
        throw new Error('Image file does not exist');
      }

      // Convert image to base64
      console.log('🔄 Converting image to base64...');
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      console.log('✅ Image converted to base64, length:', base64.length);
      
      // Validate base64 string
      if (!base64 || base64.length === 0) {
        throw new Error('Failed to convert image to base64');
      }

      console.log('🌐 Calling Supabase Edge Function: analyze-tools-image');
      console.log('📦 Request body size:', JSON.stringify({ imageBase64: base64 }).length);

      // Call Supabase Edge Function with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const { data, error } = await supabase.functions.invoke('analyze-tools-image', {
          body: { imageBase64: base64 },
        });

        clearTimeout(timeoutId);

        console.log('📥 Edge Function response - data:', data);
        console.log('📥 Edge Function response - error:', error);

        if (error) {
          console.error('❌ Edge Function error:', error);
          throw new Error(`Edge Function error: ${error.message || JSON.stringify(error)}`);
        }

        if (!data) {
          throw new Error('No data returned from Edge Function');
        }

        console.log('✅ Gemini analysis response:', data);

        if (data.error) {
          console.error('❌ Data contains error:', data.error);
          throw new Error(data.error);
        }

        if (data.tools && Array.isArray(data.tools) && data.tools.length > 0) {
          console.log('✅ Tools identified:', data.tools);
          // Convert array to newline-separated string
          const toolsText = data.tools.join('\n');
          setToolsList(toolsText);
          
          Alert.alert(
            '✨ AI Analysis Complete!',
            `Gemini identified ${data.tools.length} tool${data.tools.length === 1 ? '' : 's'} in your image. You can edit the list if needed.`,
            [{ text: 'OK' }]
          );
        } else {
          console.log('⚠️ No tools found in response');
          Alert.alert(
            'No Tools Found',
            'Gemini couldn\'t identify any tools in this image. Please enter them manually.',
            [{ text: 'OK' }]
          );
        }
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw fetchError;
      }
      
    } catch (error) {
      console.error('❌ Error analyzing image:', error);
      
      let errorMessage = 'Failed to analyze image with AI. ';
      
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred. Please enter tools manually.';
      }
      
      Alert.alert('AI Analysis Error', errorMessage, [{ text: 'OK' }]);
    } finally {
      console.log('🏁 Analysis complete, setting analyzing to false');
      setAnalyzing(false);
    }
  };

  const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
    try {
      console.log('☁️ Uploading image to Supabase Storage...');
      
      // Read the file as base64
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: 'base64',
      });

      // Convert base64 to blob
      const response = await fetch(`data:image/jpeg;base64,${base64}`);
      const blob = await response.blob();

      // Generate unique filename
      const fileName = `tool-${Date.now()}.jpg`;
      const filePath = `${fileName}`;

      console.log('☁️ Uploading to storage bucket:', filePath);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('tool-images')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        console.error('❌ Storage upload error:', error);
        throw error;
      }

      console.log('✅ Image uploaded successfully:', data);

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('tool-images')
        .getPublicUrl(filePath);

      console.log('✅ Public URL:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error) {
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
      console.log('💾 Saving inventory to Supabase...');
      
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

      console.log('💾 Inserting into database:', { imageUrl, tools, binName, binLocation });

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
        console.error('❌ Database insert error:', error);
        throw error;
      }

      console.log('✅ Inventory saved successfully:', data);

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
          {/* Image Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Take a Photo</Text>
            {imageUri ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.image} />
                <Pressable
                  style={styles.changeImageButton}
                  onPress={() => {
                    console.log('🗑️ Clearing image');
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
                    console.log('🔄 Re-analyzing image');
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
                <Text style={styles.analyzingSubtext}>This may take a few seconds</Text>
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
