
import React, { useState, useEffect } from "react";
import { useTheme } from "@react-navigation/native";
import { View, Text, StyleSheet, ScrollView, Platform, Pressable, Alert, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { IconSymbol } from "@/components/IconSymbol";
import { colors } from "@/styles/commonStyles";
import { getDeviceInfo, clearDeviceId } from "@/utils/deviceId";

export default function ProfileScreen() {
  const theme = useTheme();
  const [deviceInfo, setDeviceInfo] = useState<{
    deviceId: string;
    deviceName: string | null;
    platform: string;
    osVersion: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading device info...');
      const info = await getDeviceInfo();
      console.log('Device info loaded:', info);
      setDeviceInfo(info);
    } catch (error) {
      console.error('Error loading device info:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getPlatformName = (platform: string): string => {
    switch (platform) {
      case 'ios':
        return 'iOS';
      case 'android':
        return 'Android';
      case 'web':
        return 'Web';
      default:
        return platform.charAt(0).toUpperCase() + platform.slice(1);
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            title: "Profile",
          }}
        />
      )}
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Device Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Device Information</Text>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>Loading device info...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorCard}>
                <IconSymbol name="exclamationmark.triangle" color="#FF3B30" size={32} />
                <Text style={styles.errorText}>Failed to load device information</Text>
                <Text style={styles.errorDetails}>{error}</Text>
                <Pressable 
                  style={styles.retryButton}
                  onPress={loadDeviceInfo}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : deviceInfo ? (
              <>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <IconSymbol name="iphone" color={colors.primary} size={24} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Device Name</Text>
                      <Text style={styles.infoValue}>
                        {deviceInfo.deviceName || 'Unknown Device'}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <IconSymbol name="cpu" color={colors.secondary} size={24} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Platform</Text>
                      <Text style={styles.infoValue}>
                        {getPlatformName(deviceInfo.platform)} {deviceInfo.osVersion !== 'unknown' ? deviceInfo.osVersion : ''}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <IconSymbol name="key.fill" color={colors.accent} size={24} />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>Device ID</Text>
                      <Text style={styles.infoValueMono}>
                        {deviceInfo.deviceId.substring(0, 8)}...{deviceInfo.deviceId.substring(deviceInfo.deviceId.length - 8)}
                      </Text>
                      <Text style={styles.infoDescription}>
                        This unique ID links your inventory to this device
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </View>

          {/* Privacy Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Privacy & Data</Text>
            
            <View style={styles.privacyCard}>
              <IconSymbol name="lock.shield.fill" color={colors.primary} size={32} />
              <Text style={styles.privacyTitle}>Your Privacy Matters</Text>
              <Text style={styles.privacyText}>
                Your tool inventory is private and associated with your device ID. 
                No account creation or personal information is required.
              </Text>
              <View style={styles.privacyPoints}>
                <View style={styles.privacyPoint}>
                  <Text style={styles.privacyBullet}>•</Text>
                  <Text style={styles.privacyPointText}>
                    Your device ID is automatically generated
                  </Text>
                </View>
                <View style={styles.privacyPoint}>
                  <Text style={styles.privacyBullet}>•</Text>
                  <Text style={styles.privacyPointText}>
                    Only you can access your inventory on this device
                  </Text>
                </View>
                <View style={styles.privacyPoint}>
                  <Text style={styles.privacyBullet}>•</Text>
                  <Text style={styles.privacyPointText}>
                    No personal data is collected or shared
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>Workshop AI</Text>
            <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
            <Text style={styles.appInfoCopyright}>
              Personal tool inventory management
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
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  loadingContainer: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  infoValueMono: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
  },
  infoDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF3B30',
    marginTop: 12,
    textAlign: 'center',
  },
  errorDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  privacyCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 2,
  },
  privacyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  privacyPoints: {
    alignSelf: 'stretch',
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 16,
  },
  privacyPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  privacyBullet: {
    fontSize: 16,
    color: colors.primary,
    marginRight: 8,
    lineHeight: 22,
  },
  privacyPointText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  appInfoVersion: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  appInfoCopyright: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
