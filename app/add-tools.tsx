
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
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        // Auto-analyze the image
        analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking image:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Photo library permission is needed');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
        // Auto-analyze the image
        analyzeImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const analyzeImage = async (uri: string) => {
    setAnalyzing(true);
    try {
      // This is where you would call OpenAI Vision API
      // For now, we'll show a message that Supabase needs to be enabled
      
      Alert.alert(
        'AI Analysis',
        'To use AI-powered tool identification, you need to:\n\n' +
        '1. Enable Supabase by clicking the Supabase button\n' +
        '2. Connect to a Supabase project (create one if needed)\n' +
        '3. Set up an edge function for OpenAI Vision API\n\n' +
        'For now, you can manually enter the tools you see in the photo.',
        [{ text: 'OK' }]
      );
      
      // Placeholder: In a real implementation, you would:
      // 1. Convert image to base64
      // 2. Call Supabase edge function
      // 3. Edge function calls OpenAI Vision API
      // 4. Parse response and set toolsList
      
    } catch (error) {
      console.log('Error analyzing image:', error);
      Alert.alert('Error', 'Failed to analyze image. Please enter tools manually.');
    } finally {
      setAnalyzing(false);
    }
  };

  const saveInventory = async () => {
    if (!imageUri) {
      Alert.alert('Missing Image', 'Please take a photo of your tools');
      return;
    }

    if (!toolsList.trim()) {
      Alert.alert('Missing Tools', 'Please enter the tools in the photo');
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
      // Parse tools list (split by newlines)
      const tools = toolsList
        .split('\n')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Create new inventory item
      const newItem = {
        id: Date.now().toString(),
        imageUri,
        tools,
        binName,
        binLocation,
        dateAdded: new Date().toISOString(),
      };

      // Load existing inventory
      const stored = await AsyncStorage.getItem('tool_inventory');
      const inventory = stored ? JSON.parse(stored) : [];

      // Add new item
      inventory.unshift(newItem);

      // Save back to storage
      await AsyncStorage.setItem('tool_inventory', JSON.stringify(inventory));

      Alert.alert('Success', 'Tools added to inventory!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.log('Error saving inventory:', error);
      Alert.alert('Error', 'Failed to save inventory');
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
            <Text style={styles.sectionTitle}>2. List of Tools</Text>
            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.analyzingText}>Analyzing image with AI...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.helperText}>
                  Enter each tool on a new line (AI analysis coming soon with Supabase)
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
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
