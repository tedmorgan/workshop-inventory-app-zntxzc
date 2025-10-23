
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { IconSymbol } from '@/components/IconSymbol';
import { colors } from '@/styles/commonStyles';
import { testGeminiIntegration, runMultipleTests } from '../testGemini';

export default function TestGeminiScreen() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<string>('');

  const runSimpleTest = async () => {
    setTesting(true);
    setResults('🧪 Running simple test with sample image...\n\n');
    
    try {
      const result = await testGeminiIntegration();
      setResults(prev => prev + '\n✅ Test completed! Check console for detailed logs.\n\n' + JSON.stringify(result, null, 2));
    } catch (error) {
      setResults(prev => prev + '\n❌ Test failed: ' + error);
    } finally {
      setTesting(false);
    }
  };

  const runTestWithImage = async () => {
    if (Platform.OS === 'web') {
      setResults('⚠️ Image selection not supported on web. Use the simple test instead.');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        setResults('❌ Permission denied. Cannot access photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 1.0,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setTesting(true);
      setResults('🖼️ Converting image to base64...\n\n');

      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const sizeInMB = (base64.length * 0.75) / (1024 * 1024);
      setResults(prev => prev + `📊 Image size: ${sizeInMB.toFixed(2)}MB\n\n`);
      setResults(prev => prev + '🧪 Testing with your image...\n\n');

      const testResult = await testGeminiIntegration(base64);
      setResults(prev => prev + '\n✅ Test completed! Check console for detailed logs.\n\n' + JSON.stringify(testResult, null, 2));
    } catch (error) {
      setResults(prev => prev + '\n❌ Test failed: ' + error);
    } finally {
      setTesting(false);
    }
  };

  const runMultipleTestsHandler = async () => {
    setTesting(true);
    setResults('🔄 Running 3 test iterations...\n\n');
    
    try {
      const testResults = await runMultipleTests(3);
      setResults(prev => prev + '\n✅ All tests completed! Check console for detailed logs.\n\n' + JSON.stringify(testResults, null, 2));
    } catch (error) {
      setResults(prev => prev + '\n❌ Tests failed: ' + error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Test Gemini Integration',
          headerBackTitle: 'Back',
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <IconSymbol name="flask.fill" color={colors.primary} size={48} />
            <Text style={styles.title}>Gemini API Test Suite</Text>
            <Text style={styles.subtitle}>
              Test the Gemini integration with various scenarios
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Tests</Text>
            
            <Pressable
              style={[styles.testButton, testing && styles.testButtonDisabled]}
              onPress={runSimpleTest}
              disabled={testing}
            >
              <IconSymbol name="play.circle.fill" color="#FFFFFF" size={24} />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Simple Test</Text>
                <Text style={styles.buttonSubtext}>Test with sample image</Text>
              </View>
            </Pressable>

            {Platform.OS !== 'web' && (
              <Pressable
                style={[styles.testButton, styles.secondaryButton, testing && styles.testButtonDisabled]}
                onPress={runTestWithImage}
                disabled={testing}
              >
                <IconSymbol name="photo.fill" color="#FFFFFF" size={24} />
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.buttonText}>Test with Your Image</Text>
                  <Text style={styles.buttonSubtext}>Select from gallery</Text>
                </View>
              </Pressable>
            )}

            <Pressable
              style={[styles.testButton, styles.tertiaryButton, testing && styles.testButtonDisabled]}
              onPress={runMultipleTestsHandler}
              disabled={testing}
            >
              <IconSymbol name="arrow.clockwise.circle.fill" color="#FFFFFF" size={24} />
              <View style={styles.buttonTextContainer}>
                <Text style={styles.buttonText}>Run Multiple Tests</Text>
                <Text style={styles.buttonSubtext}>3 iterations for consistency</Text>
              </View>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Results</Text>
            {testing ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Running test...</Text>
              </View>
            ) : (
              <View style={styles.resultsContainer}>
                {results ? (
                  <ScrollView style={styles.resultsScroll} nestedScrollEnabled>
                    <Text style={styles.resultsText}>{results}</Text>
                  </ScrollView>
                ) : (
                  <Text style={styles.noResultsText}>
                    No results yet. Run a test to see output.
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>ℹ️ About This Test</Text>
            <Text style={styles.infoText}>
              This test suite validates the Gemini API integration by:
            </Text>
            <Text style={styles.infoText}>
              - Sending images to the Edge Function{'\n'}
              - Verifying API responses{'\n'}
              - Measuring response times{'\n'}
              - Checking tool identification accuracy
            </Text>
            <Text style={styles.infoText}>
              {'\n'}Check the console logs for detailed debugging information.
            </Text>
          </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  secondaryButton: {
    backgroundColor: colors.secondary,
  },
  tertiaryButton: {
    backgroundColor: colors.accent,
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  buttonTextContainer: {
    flex: 1,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13,
    marginTop: 2,
  },
  loadingContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.text,
    marginTop: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    minHeight: 200,
  },
  resultsScroll: {
    maxHeight: 400,
  },
  resultsText: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.text,
    lineHeight: 20,
  },
  noResultsText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 40,
  },
  infoSection: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
});
