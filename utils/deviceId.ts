
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@workshop_inventory_device_id';

/**
 * Get a unique device identifier for this device.
 * On iOS, uses the IOS Identifier For Vendor (IDFV).
 * On Android, uses the Android ID.
 * On Web, generates and stores a UUID.
 * 
 * The ID is cached in AsyncStorage for consistency.
 */
export async function getDeviceId(): Promise<string> {
  try {
    // First, check if we have a cached device ID
    const cachedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (cachedId) {
      console.log('📱 Using cached device ID:', cachedId.substring(0, 8) + '...');
      return cachedId;
    }

    let deviceId: string | null = null;

    if (Platform.OS === 'ios') {
      // On iOS, use the IOS Identifier For Vendor (IDFV)
      // This is unique per device and vendor (app developer)
      deviceId = await Application.getIosIdForVendorAsync();
      console.log('📱 iOS IDFV obtained:', deviceId?.substring(0, 8) + '...');
    } else if (Platform.OS === 'android') {
      // On Android, use the Android ID
      deviceId = Application.getAndroidId();
      console.log('📱 Android ID obtained:', deviceId?.substring(0, 8) + '...');
    } else if (Platform.OS === 'web') {
      // On web, generate a UUID and store it
      deviceId = generateUUID();
      console.log('📱 Web UUID generated:', deviceId.substring(0, 8) + '...');
    }

    if (!deviceId) {
      // Fallback: generate a UUID if we couldn't get a device-specific ID
      deviceId = generateUUID();
      console.log('📱 Fallback UUID generated:', deviceId.substring(0, 8) + '...');
    }

    // Cache the device ID for future use
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('💾 Device ID cached successfully');

    return deviceId;
  } catch (error) {
    console.error('❌ Error getting device ID:', error);
    // Last resort: generate and cache a UUID
    const fallbackId = generateUUID();
    try {
      await AsyncStorage.setItem(DEVICE_ID_KEY, fallbackId);
    } catch (storageError) {
      console.error('❌ Error caching fallback device ID:', storageError);
    }
    return fallbackId;
  }
}

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Clear the cached device ID (useful for testing or troubleshooting)
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
    console.log('🗑️ Device ID cleared from cache');
  } catch (error) {
    console.error('❌ Error clearing device ID:', error);
  }
}

/**
 * Get device information for display purposes
 */
export async function getDeviceInfo(): Promise<{
  deviceId: string;
  deviceName: string | null;
  platform: string;
  osVersion: string;
}> {
  try {
    const deviceId = await getDeviceId();
    
    let deviceName: string | null = null;
    try {
      deviceName = await Application.getDeviceNameAsync();
    } catch (error) {
      console.error('Error getting device name:', error);
      deviceName = 'Unknown Device';
    }

    let platform = 'unknown';
    let osVersion = 'unknown';
    
    try {
      // Safely access Platform.OS
      if (Platform && Platform.OS) {
        platform = Platform.OS;
      }
      
      // Safely access Platform.Version
      if (Platform && Platform.Version) {
        osVersion = Platform.Version.toString();
      }
    } catch (error) {
      console.error('Error accessing Platform info:', error);
    }

    return {
      deviceId,
      deviceName,
      platform,
      osVersion,
    };
  } catch (error) {
    console.error('❌ Error in getDeviceInfo:', error);
    // Return fallback values
    return {
      deviceId: generateUUID(),
      deviceName: 'Unknown Device',
      platform: 'unknown',
      osVersion: 'unknown',
    };
  }
}
