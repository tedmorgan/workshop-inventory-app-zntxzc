
import React from "react";
import { useTheme } from "@react-navigation/native";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform } from "react-native";
import { Stack, useRouter } from "expo-router";
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { LinearGradient } from "expo-linear-gradient";

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();

  const renderHeaderRight = () => (
    <Pressable
      onPress={() => router.push('/add-tools')}
      style={styles.headerButtonContainer}
    >
      <IconSymbol name="plus" color={colors.primary} />
    </Pressable>
  );

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: "Workshop Inventory",
            headerRight: renderHeaderRight,
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
          {/* Hero Section */}
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
            style={styles.heroCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <IconSymbol name="wrench.and.screwdriver.fill" color="#FFFFFF" size={48} />
            <Text style={styles.heroTitle}>Workshop Tool Inventory</Text>
            <Text style={styles.heroSubtitle}>
              Organize and track all your workshop tools with AI-powered identification
            </Text>
          </LinearGradient>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            
            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/add-tools')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary }]}>
                <IconSymbol name="camera.fill" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Add Tools</Text>
                <Text style={styles.actionDescription}>
                  Take a photo and let AI identify your tools
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/find-tool')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.accent }]}>
                <IconSymbol name="magnifyingglass" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Find Tool</Text>
                <Text style={styles.actionDescription}>
                  Search for a tool and see which bin it&apos;s in
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>

            <Pressable
              style={styles.actionCard}
              onPress={() => router.push('/(tabs)/inventory')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary }]}>
                <IconSymbol name="list.bullet" color="#FFFFFF" size={28} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>View Inventory</Text>
                <Text style={styles.actionDescription}>
                  Browse all your tools and storage locations
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Features</Text>
            
            <View style={styles.featureCard}>
              <IconSymbol name="sparkles" color={colors.highlight} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>AI-Powered Recognition</Text>
                <Text style={styles.featureDescription}>
                  Automatically identify tools from photos using advanced AI
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="magnifyingglass" color={colors.accent} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Quick Tool Search</Text>
                <Text style={styles.featureDescription}>
                  Find any tool instantly and see exactly where it&apos;s stored
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="location.fill" color={colors.secondary} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Storage Tracking</Text>
                <Text style={styles.featureDescription}>
                  Keep track of which bin and location your tools are stored
                </Text>
              </View>
            </View>

            <View style={styles.featureCard}>
              <IconSymbol name="photo.fill" color={colors.primary} size={24} />
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>Photo Library</Text>
                <Text style={styles.featureDescription}>
                  Visual reference for all your tool collections
                </Text>
              </View>
            </View>
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
  heroCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  featureCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  featureContent: {
    flex: 1,
    marginLeft: 16,
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
    lineHeight: 18,
  },
  headerButtonContainer: {
    padding: 6,
  },
});
