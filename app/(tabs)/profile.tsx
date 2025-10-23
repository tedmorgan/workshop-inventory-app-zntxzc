
import React from "react";
import { useTheme } from "@react-navigation/native";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, Alert, Linking } from "react-native";
import { Stack } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";

export default function ProfileScreen() {
  const theme = useTheme();

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will clear all locally stored data. Your Supabase inventory will remain intact.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Success', 'All local data has been cleared');
            } catch (error) {
              console.log('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  const openGeminiSetup = () => {
    Alert.alert(
      '🤖 Gemini AI Setup',
      'To enable AI-powered tool recognition:\n\n' +
      '1. Get a Gemini API key from Google AI Studio\n' +
      '2. Add it to your Supabase project secrets as GEMINI_API_KEY\n' +
      '3. The app will automatically use it for image analysis\n\n' +
      'Would you like to open Google AI Studio?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open',
          onPress: () => Linking.openURL('https://aistudio.google.com/app/apikey'),
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: "Profile & Settings",
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* App Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workshop Tool Inventory</Text>
            <Text style={styles.sectionDescription}>
              AI-powered tool management for your workshop
            </Text>
          </View>

          {/* AI Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>✨ AI Features</Text>
            <View style={styles.card}>
              <View style={styles.featureItem}>
                <IconSymbol name="sparkles" color={colors.accent} size={24} />
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Gemini AI Recognition</Text>
                  <Text style={styles.featureDescription}>
                    Automatically identifies tools in photos using Google&apos;s Gemini AI
                  </Text>
                </View>
              </View>
              
              <View style={styles.featureItem}>
                <IconSymbol name="photo.on.rectangle" color={colors.primary} size={24} />
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Smart Image Analysis</Text>
                  <Text style={styles.featureDescription}>
                    Take a photo and get an instant list of all tools detected
                  </Text>
                </View>
              </View>
              
              <View style={styles.featureItem}>
                <IconSymbol name="cloud" color={colors.secondary} size={24} />
                <View style={styles.featureContent}>
                  <Text style={styles.featureTitle}>Cloud Storage</Text>
                  <Text style={styles.featureDescription}>
                    All data stored securely in Supabase with automatic backups
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Setup Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Setup</Text>
            <Pressable style={styles.setupCard} onPress={openGeminiSetup}>
              <View style={styles.setupHeader}>
                <IconSymbol name="key.fill" color={colors.primary} size={20} />
                <Text style={styles.setupTitle}>Gemini API Configuration</Text>
              </View>
              <Text style={styles.setupDescription}>
                Configure your Gemini API key for AI-powered tool recognition
              </Text>
              <View style={styles.setupAction}>
                <Text style={styles.setupActionText}>Setup Guide</Text>
                <IconSymbol name="chevron.right" color={colors.primary} size={16} />
              </View>
            </Pressable>
          </View>

          {/* Data Management Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🗄️ Data Management</Text>
            <Pressable style={styles.dangerCard} onPress={clearAllData}>
              <View style={styles.dangerHeader}>
                <IconSymbol name="trash" color="#FF3B30" size={20} />
                <Text style={styles.dangerTitle}>Clear Local Data</Text>
              </View>
              <Text style={styles.dangerDescription}>
                Remove all locally cached data. Your Supabase inventory will remain safe.
              </Text>
            </Pressable>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.aboutText}>
              Built with React Native, Expo, Supabase, and Google Gemini AI
            </Text>
            <Text style={styles.versionText}>Version 1.0.0</Text>
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
  },
  scrollContentWithTabBar: {
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  setupCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
    borderWidth: 2,
    borderColor: `${colors.primary}30`,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  setupDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  setupAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.background,
  },
  setupActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  dangerCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 3,
    borderWidth: 2,
    borderColor: '#FF3B3030',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dangerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
  },
  dangerDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  aboutText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  versionText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
