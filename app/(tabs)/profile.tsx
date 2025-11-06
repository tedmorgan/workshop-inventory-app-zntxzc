
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

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const info = await getDeviceInfo();
      setDeviceInfo(info);
    } catch (error) {
      console.error('Error loading device info:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    Alert.alert(
      'Clear All Data',
      'This will clear all cached data from this device. Your inventory data in the cloud will NOT be deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Clearing all AsyncStorage data...');
              await AsyncStorage.clear();
              console.log('All data cleared successfully');
              Alert.alert('Success', 'All cached data has been cleared. The app will reload.');
              // Reload device info
              await loadDeviceInfo();
            } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data. Please try again.');
            }
          },
        },
      ]
    );
  };

  const resetDeviceId = async () => {
    Alert.alert(
      'Reset Device ID',
      'This will generate a new device ID. You will lose access to your current inventory on this device. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('Resetting device ID...');
              await clearDeviceId();
              await loadDeviceInfo();
              Alert.alert(
                'Device ID Reset',
                'A new device ID has been generated. You now have a fresh inventory. Your old inventory is still in the cloud but associated with your previous device ID.'
              );
            } catch (error) {
              console.error('Error resetting device ID:', error);
              Alert.alert('Error', 'Failed to reset device ID. Please try again.');
            }
          },
        },
      ]
    );
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
        return platform;
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
                        {getPlatformName(deviceInfo.platform)} {deviceInfo.osVersion}
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
            ) : (
              <View style={styles.errorCard}>
                <IconSymbol name="exclamationmark.triangle" color={colors.textSecondary} size={32} />
                <Text style={styles.errorText}>Failed to load device information</Text>
              </View>
            )}
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

          {/* Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Advanced</Text>
            
            <Pressable style={styles.actionCard} onPress={clearAllData}>
              <View style={[styles.actionIcon, { backgroundColor: `${colors.highlight}20` }]}>
                <IconSymbol name="trash" color={colors.highlight} size={24} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Clear Cache</Text>
                <Text style={styles.actionDescription}>
                  Clear all cached data (inventory stays in cloud)
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>

            <Pressable style={styles.actionCard} onPress={resetDeviceId}>
              <View style={[styles.actionIcon, { backgroundColor: '#FF3B3020' }]}>
                <IconSymbol name="arrow.clockwise" color="#FF3B30" size={24} />
              </View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle, { color: '#FF3B30' }]}>Reset Device ID</Text>
                <Text style={styles.actionDescription}>
                  Generate new ID (you&apos;ll lose access to current inventory)
                </Text>
              </View>
              <IconSymbol name="chevron.right" color={colors.textSecondary} size={20} />
            </Pressable>
          </View>

          {/* App Info */}
          <View style={styles.appInfo}>
            <Text style={styles.appInfoText}>Workshop Tool Inventory</Text>
            <Text style={styles.appInfoVersion}>Version 1.0.0</Text>
            <Text style={styles.appInfoCopyright}>
              Device-based inventory management
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
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 12,
    textAlign: 'center',
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 18,
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
