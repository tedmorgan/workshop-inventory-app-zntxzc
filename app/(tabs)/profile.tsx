
import React from "react";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, Alert } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { Stack } from "expo-router";
import { colors } from "@/styles/commonStyles";
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const theme = useTheme();

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to delete all inventory data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('tool_inventory');
              Alert.alert('Success', 'All inventory data has been cleared');
            } catch (error) {
              console.log('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data');
            }
          },
        },
      ]
    );
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: "Settings",
          }}
        />
      )}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* App Info */}
          <View style={styles.section}>
            <View style={styles.appIconContainer}>
              <IconSymbol name="wrench.and.screwdriver.fill" color={colors.primary} size={64} />
            </View>
            <Text style={styles.appTitle}>Workshop Tool Inventory</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <Text style={styles.cardText}>
                This app helps you organize and track all your workshop tools using AI-powered identification.
                Take photos of your tools, let AI identify them, and keep track of where everything is stored.
              </Text>
            </View>
          </View>

          {/* Features Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            <View style={styles.featureItem}>
              <IconSymbol name="camera.fill" color={colors.primary} size={24} />
              <Text style={styles.featureText}>Photo-based tool cataloging</Text>
            </View>
            <View style={styles.featureItem}>
              <IconSymbol name="sparkles" color={colors.highlight} size={24} />
              <Text style={styles.featureText}>AI-powered tool identification (with Supabase)</Text>
            </View>
            <View style={styles.featureItem}>
              <IconSymbol name="location.fill" color={colors.secondary} size={24} />
              <Text style={styles.featureText}>Storage location tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <IconSymbol name="list.bullet" color={colors.accent} size={24} />
              <Text style={styles.featureText}>Complete inventory management</Text>
            </View>
          </View>

          {/* Setup Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Setup (Optional)</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Enable AI Tool Identification</Text>
              <Text style={styles.cardText}>
                To use AI-powered tool identification:
              </Text>
              <Text style={styles.bulletPoint}>1. Click the Supabase button to enable Supabase</Text>
              <Text style={styles.bulletPoint}>2. Connect to a Supabase project (create one if needed)</Text>
              <Text style={styles.bulletPoint}>3. Set up an edge function for OpenAI Vision API</Text>
              <Text style={styles.bulletPoint}>4. Add your OPENAI_API_KEY to Supabase secrets</Text>
              <Text style={[styles.cardText, styles.noteText]}>
                Note: The app works without AI - you can manually enter tools.
              </Text>
            </View>
          </View>

          {/* Data Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Data Management</Text>
            <Pressable style={styles.dangerButton} onPress={clearAllData}>
              <IconSymbol name="trash" color="#FFFFFF" size={20} />
              <Text style={styles.dangerButtonText}>Clear All Inventory Data</Text>
            </Pressable>
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
    marginBottom: 32,
  },
  appIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  appTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  appVersion: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  cardText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
    marginLeft: 8,
    marginBottom: 4,
  },
  noteText: {
    marginTop: 8,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  featureText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 16,
    flex: 1,
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
