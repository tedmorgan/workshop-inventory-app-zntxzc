
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { testGeminiIntegration, runMultipleTests } from '../testGemini';
import { colors } from '@/styles/commonStyles';
import { Stack } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useState } from 'react';
import { IconSymbol } from '@/components/IconSymbol';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 24,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
    padding: 15,
    marginBottom: 20,
    borderRadius: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
    marginBottom: 4,
  },
  infoBox: {
    backgroundColor: '#D1ECF1',
    borderLeftWidth: 4,
    borderLeftColor: '#17A2B8',
    padding: 15,
    marginBottom: 20,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0C5460',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#0C5460',
    lineHeight: 20,
    marginBottom: 4,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
  },
  statusText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  stepText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 12,
    backgroundColor: colors.cardBackground,
    padding: 8,
    borderRadius: 4,
    color: colors.text,
    marginVertical: 4,
  },
});

export default function TestGeminiScreen() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const runSimpleTest = async () => {
    setLoading(true);
    setStatus('Running simple test...');
    try {
      const result = await testGeminiIntegration();
      if (result.success) {
        setStatus('✅ Test passed! Check console for details.');
        Alert.alert('Success', 'Test completed successfully! Check console for detailed logs.');
      } else {
        setStatus('❌ Test failed. Check console for details.');
        Alert.alert(
          'Test Failed',
          'The test encountered an error. Check the console logs for details.\n\nCommon issues:\n- JWT verification is enabled (401 error)\n- Invalid request format (400 error)\n- Network issues'
        );
      }
    } catch (error) {
      console.error('Test error:', error);
      setStatus('❌ Test error. Check console.');
      Alert.alert('Error', 'An unexpected error occurred. Check console logs.');
    } finally {
      setLoading(false);
    }
  };

  const runTestWithImage = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Image picker is not supported on web.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1.0,
      });

      if (result.canceled) {
        return;
      }

      setLoading(true);
      setStatus('Converting image to base64...');

      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setStatus('Running test with your image...');
      const testResult = await testGeminiIntegration(base64);

      if (testResult.success) {
        setStatus('✅ Test passed! Check console for details.');
        Alert.alert('Success', 'Test completed successfully! Check console for detailed logs.');
      } else {
        setStatus('❌ Test failed. Check console for details.');
        Alert.alert('Test Failed', 'Check the console logs for detailed error information.');
      }
    } catch (error) {
      console.error('Image test error:', error);
      setStatus('❌ Error. Check console.');
      Alert.alert('Error', 'Failed to process image. Check console logs.');
    } finally {
      setLoading(false);
    }
  };

  const runMultipleTestsHandler = async () => {
    setLoading(true);
    setStatus('Running 3 test iterations...');
    try {
      const results = await runMultipleTests(3);
      const successCount = results.filter((r) => r.success).length;
      setStatus(`✅ Completed: ${successCount}/3 passed`);
      
      if (successCount === 3) {
        Alert.alert('All Tests Passed', 'All 3 tests completed successfully!');
      } else {
        Alert.alert(
          'Some Tests Failed',
          `${successCount}/3 tests passed. Check console for details.`
        );
      }
    } catch (error) {
      console.error('Multiple tests error:', error);
      setStatus('❌ Error. Check console.');
      Alert.alert('Error', 'Failed to run tests. Check console logs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Test Gemini Integration',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        }}
      />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Gemini Integration Test</Text>
        <Text style={styles.subtitle}>
          Test the Gemini API integration to identify tools in images.
        </Text>

        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>⚠️ Known Issue: JWT Verification</Text>
          <Text style={styles.warningText}>
            The Edge Function currently has JWT verification enabled, which may cause 401 Unauthorized errors.
          </Text>
          <Text style={styles.warningText}>
            If tests fail with FunctionsHttpError, follow the fix below.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>🔧 How to Fix JWT Verification</Text>
          <Text style={styles.infoText}>
            1. Go to Supabase Dashboard
          </Text>
          <Text style={styles.infoText}>
            2. Navigate to: Edge Functions → analyze-tools-image
          </Text>
          <Text style={styles.infoText}>
            3. Click on Settings or Configuration
          </Text>
          <Text style={styles.infoText}>
            4. Find "Verify JWT" option and disable it
          </Text>
          <Text style={styles.infoText}>
            5. Save changes and run the test again
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Test Options</Text>

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={runSimpleTest}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <IconSymbol name="play.circle.fill" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Run Simple Test</Text>
              </>
            )}
          </Pressable>

          {Platform.OS !== 'web' && (
            <Pressable
              style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
              onPress={runTestWithImage}
              disabled={loading}
            >
              <IconSymbol name="photo" size={20} color={colors.text} />
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                Test with Your Image
              </Text>
            </Pressable>
          )}

          <Pressable
            style={[styles.button, styles.secondaryButton, loading && styles.buttonDisabled]}
            onPress={runMultipleTestsHandler}
            disabled={loading}
          >
            <IconSymbol name="arrow.clockwise" size={20} color={colors.text} />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Run 3 Test Iterations
            </Text>
          </Pressable>

          {status ? <Text style={styles.statusText}>{status}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What This Tests</Text>
          <Text style={styles.stepText}>
            - Sends a sample image to the Edge Function
          </Text>
          <Text style={styles.stepText}>
            - Calls the Gemini API to analyze the image
          </Text>
          <Text style={styles.stepText}>
            - Returns a list of identified tools
          </Text>
          <Text style={styles.stepText}>
            - Measures response time and success rate
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Troubleshooting</Text>
          
          <Text style={styles.stepText}>
            <Text style={{ fontWeight: 'bold' }}>401 Unauthorized:</Text>
            {'\n'}JWT verification is enabled. Disable it in the Supabase Dashboard (see instructions above).
          </Text>
          
          <Text style={styles.stepText}>
            <Text style={{ fontWeight: 'bold' }}>400 Bad Request:</Text>
            {'\n'}Request format issue. Check Edge Function logs in Supabase Dashboard.
          </Text>
          
          <Text style={styles.stepText}>
            <Text style={{ fontWeight: 'bold' }}>500 Internal Error:</Text>
            {'\n'}Edge Function error. Check logs for Gemini API issues or code errors.
          </Text>
          
          <Text style={styles.stepText}>
            <Text style={{ fontWeight: 'bold' }}>Network Error:</Text>
            {'\n'}Check your internet connection and Supabase project status.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Check Logs</Text>
          <Text style={styles.stepText}>
            View detailed logs in:
          </Text>
          <Text style={styles.stepText}>
            - App console (React Native debugger)
          </Text>
          <Text style={styles.stepText}>
            - Supabase Dashboard → Edge Functions → Logs
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
