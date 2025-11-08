
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
  Modal,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { supabase } from '@integrations/supabase/client';
import { decode } from 'base64-arraybuffer';
import { getDeviceId } from '@/utils/deviceId';

// Conditionally import FileSystem only for native platforms
let FileSystem: any = null;
if (Platform.OS !== 'web') {
  FileSystem = require('expo-file-system/legacy');
}

export default function AddToolsScreen() {
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [toolsList, setToolsList] = useState<string>('');
  const [binName, setBinName] = useState('');
  const [binLocation, setBinLocation] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // State for existing bin names and locations
  const [existingBinNames, setExistingBinNames] = useState<string[]>([]);
  const [existingBinLocations, setExistingBinLocations] = useState<string[]>([]);
  const [loadingExistingData, setLoadingExistingData] = useState(true);
  
  // State for re-analysis
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [reanalyzeReason, setReanalyzeReason] = useState('');
  const [previousResponse, setPreviousResponse] = useState<string[]>([]);
  const [imageBase64, setImageBase64] = useState<string>('');

  // State for introductory modal
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [checkingInventory, setCheckingInventory] = useState(true);

  // Refs for TextInputs to enable keyboard navigation and scrolling
  const scrollViewRef = useRef<ScrollView>(null);
  const modalScrollViewRef = useRef<ScrollView>(null);
  const introModalScrollViewRef = useRef<ScrollView>(null);
  const toolsListRef = useRef<TextInput>(null);
  const binNameRef = useRef<TextInput>(null);
  const binLocationRef = useRef<TextInput>(null);
  const reanalyzeReasonRef = useRef<TextInput>(null);

  useEffect(() => {
    checkInventoryAndShowIntro();
    loadExistingBinData();
  }, []);

  // Scroll intro modal to top when it opens - FIXED VERSION
  useEffect(() => {
    if (showIntroModal) {
      console.log('📜 Intro modal opened - forcing scroll to top');
      
      // Immediately scroll to top
      setTimeout(() => {
        introModalScrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        console.log('📜 Executed immediate scroll to top');
      }, 0);
      
      // Also scroll after a delay to ensure content is rendered
      setTimeout(() => {
        introModalScrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        console.log('📜 Executed delayed scroll to top');
      }, 100);
      
      // Final scroll to be absolutely sure
      setTimeout(() => {
        introModalScrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        console.log('📜 Executed final scroll to top');
      }, 300);
    }
  }, [showIntroModal]);

  const loadExistingBinData = async () => {
    try {
      console.log('🔍 Loading existing bin names and locations');
      setLoadingExistingData(true);

      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Fetch all inventory items for this device
      const { data, error } = await supabase
        .from('tool_inventory')
        .select('bin_name, bin_location')
        .eq('device_id', deviceId);

      if (error) {
        console.error('❌ Error loading existing bin data:', error);
        return;
      }

      if (data && data.length > 0) {
        // Extract unique bin names
        const uniqueBinNames = Array.from(
          new Set(data.map(item => item.bin_name).filter(name => name && name.trim()))
        ) as string[];

        // Extract unique bin locations
        const uniqueBinLocations = Array.from(
          new Set(data.map(item => item.bin_location).filter(loc => loc && loc.trim()))
        ) as string[];

        console.log(`✅ Found ${uniqueBinNames.length} unique bin names`);
        console.log(`✅ Found ${uniqueBinLocations.length} unique bin locations`);

        setExistingBinNames(uniqueBinNames);
        setExistingBinLocations(uniqueBinLocations);
      } else {
        console.log('📊 No existing inventory data found');
        setExistingBinNames([]);
        setExistingBinLocations([]);
      }
    } catch (error) {
      console.error('❌ Error in loadExistingBinData:', error);
    } finally {
      setLoadingExistingData(false);
    }
  };

  const checkInventoryAndShowIntro = async () => {
    try {
      console.log('🔍 Checking if inventory is empty');

      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID:', deviceId.substring(0, 8) + '...');

      // Check if inventory is empty for this device
      const { data, error } = await supabase
        .from('tool_inventory')
        .select('id')
        .eq('device_id', deviceId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking inventory:', error);
        setCheckingInventory(false);
        return;
      }

      const isEmpty = !data || data.length === 0;
      console.log(`📊 Inventory empty: ${isEmpty}`);

      if (isEmpty) {
        console.log('🎉 Showing introductory modal');
        setShowIntroModal(true);
      }

      setCheckingInventory(false);
    } catch (error) {
      console.error('❌ Error in checkInventoryAndShowIntro:', error);
      setCheckingInventory(false);
    }
  };

  const closeIntroModal = () => {
    setShowIntroModal(false);
  };

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert(
        'Web Preview',
        'Camera is not available in web preview. Please use the gallery option or test on a mobile device.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      console.log('📸 Requesting camera permissions');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        console.log('❌ Camera permission denied');
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to take photos. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('✅ Camera permission granted, launching camera');
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log(`✅ Image captured: ${uri.substring(0, 50)}...`);
        setImageUri(uri);
        setPreviousResponse([]);
        analyzeImage(uri);
      } else {
        console.log('📷 Camera was canceled');
      }
    } catch (error) {
      console.error(`❌ Error in pickImage:`, error);
      Alert.alert(
        'Camera Error',
        `Failed to take photo: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        [{ text: 'OK' }]
      );
    }
  };

  const pickFromGallery = async () => {
    try {
      console.log('🖼️ Starting gallery picker');
      console.log(`📱 Platform: ${Platform.OS}`);
      
      if (Platform.OS !== 'web') {
        console.log('📋 Requesting media library permissions...');
        
        // Request permissions with better error handling
        const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('📋 Permission result:', JSON.stringify(permissionResult));
        
        if (permissionResult.status !== 'granted') {
          console.log(`❌ Gallery permission denied. Status: ${permissionResult.status}`);
          
          // Provide more specific error messages based on permission status
          let message = 'Photo library permission is needed to select images of your tools.';
          
          if (permissionResult.status === 'denied') {
            message += '\n\nPlease enable photo library access in your device settings:\nSettings > Apps > Workshop > Permissions > Photos';
          }
          
          Alert.alert(
            'Permission Required',
            message,
            [{ text: 'OK' }]
          );
          return;
        }
        
        console.log('✅ Gallery permission granted');
      }

      console.log('🚀 Launching image library...');
      
      // Launch image library with proper configuration
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      console.log('📊 Image picker result:', JSON.stringify({
        canceled: result.canceled,
        hasAssets: result.assets ? result.assets.length : 0
      }));

      if (!result.canceled && result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        console.log(`✅ Image selected successfully`);
        console.log(`📸 URI: ${uri.substring(0, 50)}...`);
        console.log(`📏 Dimensions: ${result.assets[0].width}x${result.assets[0].height}`);
        console.log(`📦 File size: ${result.assets[0].fileSize ? (result.assets[0].fileSize / 1024).toFixed(2) + ' KB' : 'unknown'}`);
        
        setImageUri(uri);
        setPreviousResponse([]);
        
        if (Platform.OS === 'web') {
          Alert.alert(
            'Web Preview',
            'AI image analysis is not available in web preview. Please enter tools manually or test on a mobile device.',
            [{ text: 'OK' }]
          );
        } else {
          analyzeImage(uri);
        }
      } else {
        console.log('📷 Gallery picker was canceled by user');
      }
    } catch (error) {
      console.error(`❌ Error in pickFromGallery:`, error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'unknown',
        message: error instanceof Error ? error.message : 'unknown',
        stack: error instanceof Error ? error.stack : 'unknown'
      });
      
      // Provide detailed error message
      let errorMessage = 'Failed to select photo from gallery.';
      
      if (error instanceof Error) {
        errorMessage += `\n\nError: ${error.message}`;
        
        // Check for common Android errors
        if (error.message.includes('permission')) {
          errorMessage += '\n\nPlease check that photo library permissions are enabled in your device settings.';
        } else if (error.message.includes('activity')) {
          errorMessage += '\n\nPlease try again. If the problem persists, restart the app.';
        }
      }
      
      Alert.alert('Gallery Error', errorMessage, [{ text: 'OK' }]);
    }
  };

  const analyzeImage = async (uri: string | null, userFeedback?: string, previousTools?: string[]) => {
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

    if (!FileSystem) {
      console.log('⚠️ FileSystem not available');
      Alert.alert('Not Supported', 'Image analysis is not available. Please enter tools manually.');
      return;
    }

    console.log('🤖 Starting image analysis');
    console.log(`📊 Has userFeedback: ${!!userFeedback}`);
    console.log(`📊 Has previousTools: ${!!previousTools}`);
    console.log(`📊 previousTools length: ${previousTools?.length || 0}`);
    
    if (userFeedback) {
      console.log(`💬 User feedback: "${userFeedback}"`);
      console.log(`📝 Previous tools: ${JSON.stringify(previousTools)}`);
    }
    
    setAnalyzing(true);
    
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
      
      setImageBase64(base64);

      const sizeInMB = (base64.length * 0.75) / (1024 * 1024);
      if (sizeInMB > 20) {
        console.log(`❌ Image too large: ${sizeInMB.toFixed(2)}MB`);
        throw new Error(`Image is too large (${sizeInMB.toFixed(1)}MB). Maximum is 20MB. Please use a smaller image.`);
      }

      console.log(`📊 Image size: ${sizeInMB.toFixed(2)}MB`);
      console.log('🌐 Calling Edge Function');

      const requestBody: {
        imageBase64: string;
        previousResponse?: string[];
        userFeedback?: string;
      } = {
        imageBase64: base64,
      };

      if (userFeedback && previousTools && previousTools.length > 0) {
        requestBody.previousResponse = previousTools;
        requestBody.userFeedback = userFeedback;
        console.log('🔄 RE-ANALYSIS MODE ACTIVATED');
      } else {
        console.log('🆕 INITIAL ANALYSIS MODE');
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      try {
        console.log('🔑 Calling Edge Function with anon key');
        const { data, error } = await supabase.functions.invoke('analyze-tools-image', {
          body: requestBody,
        });

        clearTimeout(timeoutId);
        console.log('✅ Edge Function call completed');

        if (error) {
          console.log(`❌ Edge Function error: ${JSON.stringify(error)}`);
          
          // Enhanced error handling with specific messages
          let errorTitle = 'AI Analysis Error';
          let errorMessage = 'Failed to analyze image.';
          
          if (error.message) {
            const errorStr = error.message.toLowerCase();
            
            if (errorStr.includes('401') || errorStr.includes('unauthorized')) {
              errorTitle = '🔑 API Key Not Configured';
              errorMessage = 'The Gemini API key is not set up correctly.\n\nPlease contact the app administrator to configure the GEMINI_API_KEY in Supabase.\n\nYou can still enter tools manually.';
            } else if (errorStr.includes('403') || errorStr.includes('forbidden')) {
              errorTitle = '🚫 Permission Denied';
              errorMessage = 'The API key does not have the required permissions.\n\nPlease contact the app administrator.\n\nYou can still enter tools manually.';
            } else if (errorStr.includes('429') || errorStr.includes('rate limit')) {
              errorTitle = '⏱️ Too Many Requests';
              errorMessage = 'The API rate limit has been exceeded.\n\nPlease wait a moment and try again, or enter tools manually.';
            } else if (errorStr.includes('timeout')) {
              errorTitle = '⏰ Request Timeout';
              errorMessage = 'The request took too long.\n\nPlease try again with a smaller image or enter tools manually.';
            } else {
              errorMessage = `${error.message}\n\nYou can still enter tools manually.`;
            }
          }
          
          Alert.alert(errorTitle, errorMessage);
          return;
        }

        console.log(`✅ Response received`);

        if (data.error) {
          console.log(`❌ API error: ${data.error}`);
          
          // Enhanced error handling for API errors
          let errorTitle = 'AI Analysis Error';
          let errorMessage = data.error;
          
          if (data.hint) {
            errorMessage += `\n\n💡 ${data.hint}`;
          }
          
          if (data.error.includes('GEMINI_API_KEY')) {
            errorTitle = '🔑 API Key Missing';
            errorMessage = 'The Gemini API key is not configured in Supabase.\n\n';
            errorMessage += 'Administrator: Please run:\n';
            errorMessage += 'supabase secrets set GEMINI_API_KEY=your_key\n\n';
            errorMessage += 'You can still enter tools manually.';
          }
          
          Alert.alert(errorTitle, errorMessage);
          return;
        }

        if (data.tools && Array.isArray(data.tools) && data.tools.length > 0) {
          console.log(`✅ Found ${data.tools.length} tools`);
          
          setPreviousResponse(data.tools);
          console.log('💾 Stored tools in previousResponse state');
          
          const toolsText = data.tools.join('\n');
          setToolsList(toolsText);
          
          const analysisType = data.isReanalysis ? 'Re-analysis' : 'Analysis';
          Alert.alert(
            `✨ AI ${analysisType} Complete!`,
            `We identified ${data.tools.length} tool${data.tools.length === 1 ? '' : 's'}. You can edit the list or re-analyze if needed.`
          );
        } else {
          console.log('⚠️ No tools found');
          Alert.alert(
            'No Tools Found',
            'AI couldn\'t identify any tools. Please enter them manually or try re-analyzing.'
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
      
      let errorTitle = 'AI Analysis Error';
      let errorMessage = 'Failed to analyze image.\n\n';
      
      if (error instanceof Error) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Unknown error occurred.';
      }
      
      errorMessage += '\n\nPlease enter tools manually or try again.';
      
      Alert.alert(errorTitle, errorMessage, [{ text: 'OK' }]);
    } finally {
      console.log('🏁 Analysis complete');
      setAnalyzing(false);
    }
  };

  const handleReanalyzePress = () => {
    if (!imageUri) {
      Alert.alert('Error', 'No image to re-analyze');
      return;
    }
    
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Re-analysis is not supported on web. Please test on a mobile device.');
      return;
    }
    
    console.log('🔄 Re-analyze button pressed');
    
    if (previousResponse.length === 0) {
      console.log('⚠️ No previous response, doing fresh analysis');
      analyzeImage(imageUri);
      return;
    }
    
    console.log('✅ Opening re-analyze modal');
    setShowReanalyzeModal(true);
    setReanalyzeReason('');
  };

  const handleReanalyzeSubmit = () => {
    if (!reanalyzeReason.trim()) {
      Alert.alert('Missing Reason', 'Please provide a reason for re-analysis (e.g., "you missed 2 tools" or "that is not a hammer")');
      return;
    }
    
    console.log('🔄 User submitted re-analysis request');
    
    if (previousResponse.length === 0) {
      console.error('❌ ERROR: previousResponse is empty when it should have data!');
      Alert.alert('Error', 'Previous analysis data is missing. Please try analyzing the image again.');
      setShowReanalyzeModal(false);
      return;
    }
    
    setShowReanalyzeModal(false);
    analyzeImage(imageUri, reanalyzeReason.trim(), previousResponse);
  };

  const uploadImageToSupabase = async (uri: string): Promise<string> => {
    try {
      console.log('☁️ Starting image upload to Supabase');
      
      let base64: string;
      
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64String = result.split(',')[1];
            resolve(base64String);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        if (!FileSystem) {
          throw new Error('FileSystem not available');
        }
        base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      console.log(`📦 Base64 size: ${(base64.length * 0.75 / 1024).toFixed(2)} KB`);

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

    Keyboard.dismiss();

    setSaving(true);
    console.log('💾 Starting save process');
    
    try {
      // Get device ID
      const deviceId = await getDeviceId();
      console.log('📱 Device ID obtained:', deviceId.substring(0, 8) + '...');

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

      // Step 3: Insert into database with device_id
      console.log('💾 Step 2: Inserting into database');
      const insertData = {
        image_url: imageUrl,
        tools: tools,
        bin_name: binName,
        bin_location: binLocation,
        device_id: deviceId,
      };

      console.log('Insert data:', { ...insertData, device_id: deviceId.substring(0, 8) + '...' });

      const { data, error } = await supabase
        .from('tool_inventory')
        .insert(insertData)
        .select();

      if (error) {
        console.log(`❌ Database error: ${error.message}`);
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('✅ Saved successfully to database');

      Alert.alert(
        '✅ Success!',
        'Tools added to your personal inventory!',
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
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {Platform.OS === 'web' && (
            <View style={styles.webNotice}>
              <IconSymbol name="info.circle.fill" color={colors.primary} size={20} />
              <Text style={styles.webNoticeText}>
                You&apos;re viewing the web preview. AI analysis and camera features work best on mobile devices.
              </Text>
            </View>
          )}

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
                    setPreviousResponse([]);
                    setImageBase64('');
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
                  {Platform.OS !== 'web' && (
                    <Pressable style={styles.imageButton} onPress={pickImage}>
                      <IconSymbol name="camera" color="#FFFFFF" size={20} />
                      <Text style={styles.imageButtonText}>Camera</Text>
                    </Pressable>
                  )}
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
              {imageUri && !analyzing && Platform.OS !== 'web' && (
                <Pressable
                  style={styles.reanalyzeButton}
                  onPress={handleReanalyzePress}
                >
                  <IconSymbol name="arrow.clockwise" color={colors.primary} size={18} />
                  <Text style={styles.reanalyzeText}>Re-analyze</Text>
                </Pressable>
              )}
            </View>
            {analyzing ? (
              <View style={styles.analyzingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.analyzingText}>🤖 Analyzing with AI...</Text>
                <Text style={styles.analyzingSubtext}>This may take 10-60 seconds</Text>
              </View>
            ) : (
              <>
                {Platform.OS !== 'web' && (
                  <View style={styles.aiInfoBadge}>
                    <IconSymbol name="sparkles" color={colors.accent} size={16} />
                    <Text style={styles.aiInfoText}>AI-powered</Text>
                  </View>
                )}
                <Text style={styles.helperText}>
                  Enter each tool on a new line. {Platform.OS !== 'web' ? 'AI will identify tools automatically when you take a photo.' : 'Enter tools manually in web preview.'}
                </Text>
                <TextInput
                  ref={toolsListRef}
                  style={styles.textArea}
                  placeholder="Example:&#10;Hammer&#10;Screwdriver set&#10;Wrench&#10;Pliers"
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  numberOfLines={8}
                  value={toolsList}
                  onChangeText={setToolsList}
                  textAlignVertical="top"
                  onFocus={() => {
                    // Scroll to make the text area visible when focused
                    setTimeout(() => {
                      toolsListRef.current?.measureLayout(
                        scrollViewRef.current as any,
                        (x, y) => {
                          scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
                        },
                        () => console.log('Failed to measure layout')
                      );
                    }, 100);
                  }}
                />
              </>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Storage Information</Text>
            
            {/* Bin Name Section */}
            <Text style={styles.label}>Bin Name/ID</Text>
            
            {/* Existing Bin Names Buttons */}
            {!loadingExistingData && existingBinNames.length > 0 && (
              <View style={styles.quickSelectContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickSelectScrollContent}
                >
                  {existingBinNames.map((name, index) => (
                    <Pressable
                      key={`bin-name-${index}`}
                      style={[
                        styles.quickSelectButton,
                        binName === name && styles.quickSelectButtonActive
                      ]}
                      onPress={() => {
                        console.log(`📦 Selected bin name: ${name}`);
                        setBinName(name);
                      }}
                    >
                      <Text style={[
                        styles.quickSelectButtonText,
                        binName === name && styles.quickSelectButtonTextActive
                      ]}>
                        {name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            
            <TextInput
              ref={binNameRef}
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

            {/* Bin Location Section */}
            <Text style={styles.label}>Bin Location</Text>
            
            {/* Existing Bin Locations Buttons */}
            {!loadingExistingData && existingBinLocations.length > 0 && (
              <View style={styles.quickSelectContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickSelectScrollContent}
                >
                  {existingBinLocations.map((location, index) => (
                    <Pressable
                      key={`bin-location-${index}`}
                      style={[
                        styles.quickSelectButton,
                        binLocation === location && styles.quickSelectButtonActive
                      ]}
                      onPress={() => {
                        console.log(`📍 Selected bin location: ${location}`);
                        setBinLocation(location);
                      }}
                    >
                      <Text style={[
                        styles.quickSelectButtonText,
                        binLocation === location && styles.quickSelectButtonTextActive
                      ]}>
                        {location}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            
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
      </KeyboardAvoidingView>

      {/* Introductory Modal - FIXED FOR ANDROID */}
      <Modal
        visible={showIntroModal}
        transparent={true}
        animationType="fade"
        onRequestClose={closeIntroModal}
      >
        <View style={styles.introModalOverlay}>
          <View style={[styles.introModalContent, { backgroundColor: colors.card }]}>
            <ScrollView
              ref={introModalScrollViewRef}
              style={styles.introModalScrollView}
              contentContainerStyle={styles.introModalScrollContent}
              showsVerticalScrollIndicator={true}
              bounces={false}
              onContentSizeChange={() => {
                // Force scroll to top when content size changes
                console.log('📜 Content size changed - scrolling to top');
                introModalScrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: false });
              }}
            >
              <View style={styles.introModalHeader}>
                <IconSymbol name="info.circle.fill" color={colors.primary} size={32} />
                <Text style={[styles.introModalTitle, { color: colors.text }]}>
                  Welcome to Workshop!
                </Text>
              </View>

              <Text style={[styles.introModalText, { color: colors.text }]}>
                Workshop can help you keep track of where your tools are located. For each bin, remove all the tools & materials and place on a table spaced out like in the image. Take a photo and Workshop AI will identify each item. You can then edit and add to your Tool Inventory.
              </Text>

              <View style={styles.introImageContainer}>
                <Image
                  source={require('@/assets/images/59a6d842-e6a8-4050-b2cd-0a1df289bf14.jpeg')}
                  style={styles.introImage}
                  resizeMode="contain"
                />
                <Text style={[styles.introImageCaption, { color: colors.textSecondary }]}>
                  Example: Tools laid out on a table for AI identification
                </Text>
              </View>

              <Pressable
                style={styles.introModalButton}
                onPress={closeIntroModal}
              >
                <Text style={styles.introModalButtonText}>Got it!</Text>
                <IconSymbol name="arrow.right" color="#FFFFFF" size={20} />
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Re-analyze Modal */}
      <Modal
        visible={showReanalyzeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReanalyzeModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                  <ScrollView
                    ref={modalScrollViewRef}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Re-Analyze Image</Text>
                      <Pressable
                        onPress={() => setShowReanalyzeModal(false)}
                        style={styles.modalCloseButton}
                      >
                        <IconSymbol name="xmark.circle.fill" color={colors.textSecondary} size={28} />
                      </Pressable>
                    </View>

                    <Text style={styles.modalDescription}>
                      Please provide a reason for re-analysis. This helps the AI understand what to look for or correct.
                    </Text>

                    <View style={styles.examplesContainer}>
                      <Text style={styles.examplesTitle}>Examples:</Text>
                      <Pressable
                        style={styles.exampleChip}
                        onPress={() => setReanalyzeReason('You missed 2 tools')}
                      >
                        <Text style={styles.exampleChipText}>You missed 2 tools</Text>
                      </Pressable>
                      <Pressable
                        style={styles.exampleChip}
                        onPress={() => setReanalyzeReason('That is not a hammer')}
                      >
                        <Text style={styles.exampleChipText}>That is not a hammer</Text>
                      </Pressable>
                      <Pressable
                        style={styles.exampleChip}
                        onPress={() => setReanalyzeReason('Be more specific with tool names')}
                      >
                        <Text style={styles.exampleChipText}>Be more specific with tool names</Text>
                      </Pressable>
                    </View>

                    <TextInput
                      ref={reanalyzeReasonRef}
                      style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                      placeholder="e.g., you missed 2 tools, that is not a hammer"
                      placeholderTextColor={colors.textSecondary}
                      value={reanalyzeReason}
                      onChangeText={setReanalyzeReason}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                      autoFocus={true}
                      onFocus={() => {
                        // Scroll to make the text input visible when focused
                        setTimeout(() => {
                          reanalyzeReasonRef.current?.measureLayout(
                            modalScrollViewRef.current as any,
                            (x, y) => {
                              modalScrollViewRef.current?.scrollTo({ y: y - 50, animated: true });
                            },
                            () => console.log('Failed to measure layout in modal')
                          );
                        }, 300);
                      }}
                    />

                    <View style={styles.modalButtons}>
                      <Pressable
                        style={[styles.modalButton, styles.modalButtonCancel]}
                        onPress={() => setShowReanalyzeModal(false)}
                      >
                        <Text style={styles.modalButtonTextCancel}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.modalButton, styles.modalButtonSubmit]}
                        onPress={handleReanalyzeSubmit}
                      >
                        <IconSymbol name="arrow.clockwise" color="#FFFFFF" size={18} />
                        <Text style={styles.modalButtonTextSubmit}>Re-Analyze</Text>
                      </Pressable>
                    </View>

                    {/* Extra padding at bottom to ensure content is visible above keyboard */}
                    <View style={styles.modalBottomSpacer} />
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingBottom: Platform.OS === 'ios' ? 400 : 350, // Extra padding for keyboard
  },
  bottomSpacer: {
    height: 50,
  },
  webNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${colors.primary}15`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 10,
  },
  webNoticeText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
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
  // Quick Select Buttons Styles
  quickSelectContainer: {
    marginBottom: 12,
  },
  quickSelectScrollContent: {
    paddingVertical: 4,
    gap: 8,
  },
  quickSelectButton: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  quickSelectButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickSelectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  quickSelectButtonTextActive: {
    color: '#FFFFFF',
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
  // Introductory Modal Styles - FIXED FOR ANDROID
  introModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  introModalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '85%', // Reduced from 90% to ensure space for scrolling
    borderRadius: 24,
    overflow: 'hidden', // Important for Android
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  introModalScrollView: {
    flex: 1, // Critical for Android scrolling
  },
  introModalScrollContent: {
    padding: 24,
    flexGrow: 1, // Ensures content can grow and be scrollable
  },
  introModalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  introModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 12,
    textAlign: 'center',
  },
  introModalText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'left',
  },
  introImageContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  introImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  introImageCaption: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  introModalButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
    marginBottom: 16, // Extra bottom margin for scrolling
  },
  introModalButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Re-analyze Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 400 : 350, // Extra padding for keyboard
  },
  modalBottomSpacer: {
    height: 50,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalDescription: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  examplesContainer: {
    marginBottom: 20,
  },
  examplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
  },
  exampleChip: {
    backgroundColor: `${colors.primary}15`,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 8,
  },
  exampleChipText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  modalInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.background,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 6,
  },
  modalButtonCancel: {
    backgroundColor: colors.background,
  },
  modalButtonSubmit: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  modalButtonTextSubmit: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
