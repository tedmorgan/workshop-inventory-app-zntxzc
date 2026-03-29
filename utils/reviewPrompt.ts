import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

const STORAGE_KEY = '@review_metrics';

interface ReviewMetrics {
  totalSessions: number;
  totalItemsScanned: number;
  successfulIdentifications: number;
  lastPromptDate: string | null;
  recentErrors: number;
  lastErrorDate: string | null;
  hasDeclinedReview: boolean;
}

const DEFAULT_METRICS: ReviewMetrics = {
  totalSessions: 0,
  totalItemsScanned: 0,
  successfulIdentifications: 0,
  lastPromptDate: null,
  recentErrors: 0,
  lastErrorDate: null,
  hasDeclinedReview: false,
};

async function getMetrics(): Promise<ReviewMetrics> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_METRICS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] reviewPrompt: Failed to read metrics`, e);
  }
  return { ...DEFAULT_METRICS };
}

async function saveMetrics(metrics: ReviewMetrics): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  } catch (e) {
    console.error(`[${new Date().toISOString()}] reviewPrompt: Failed to save metrics`, e);
  }
}

export async function trackSession(): Promise<void> {
  const metrics = await getMetrics();
  metrics.totalSessions += 1;
  await saveMetrics(metrics);
  console.log(`[${new Date().toISOString()}] reviewPrompt: Session tracked (total: ${metrics.totalSessions})`);
}

export async function trackItemsScanned(count: number): Promise<void> {
  const metrics = await getMetrics();
  metrics.totalItemsScanned += count;
  await saveMetrics(metrics);
  console.log(`[${new Date().toISOString()}] reviewPrompt: Items scanned +${count} (total: ${metrics.totalItemsScanned})`);
}

export async function trackSuccessfulIdentification(count: number): Promise<void> {
  const metrics = await getMetrics();
  metrics.successfulIdentifications += count;
  await saveMetrics(metrics);
  console.log(`[${new Date().toISOString()}] reviewPrompt: Successful IDs +${count} (total: ${metrics.successfulIdentifications})`);
}

export async function trackError(): Promise<void> {
  const metrics = await getMetrics();
  metrics.recentErrors += 1;
  metrics.lastErrorDate = new Date().toISOString();
  await saveMetrics(metrics);
  console.log(`[${new Date().toISOString()}] reviewPrompt: Error tracked (recent: ${metrics.recentErrors})`);
}

export async function clearRecentErrors(): Promise<void> {
  const metrics = await getMetrics();
  metrics.recentErrors = 0;
  metrics.lastErrorDate = null;
  await saveMetrics(metrics);
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return (now - then) / (1000 * 60 * 60 * 24);
}

async function meetsStandardCriteria(): Promise<boolean> {
  const m = await getMetrics();

  if (m.totalSessions < 3) return false;
  if (m.totalItemsScanned < 15) return false;
  if (m.successfulIdentifications < 10) return false;
  if (m.lastPromptDate && daysSince(m.lastPromptDate) < 90) return false;
  if (m.recentErrors > 0 && m.lastErrorDate && daysSince(m.lastErrorDate) < 7) return false;

  return true;
}

async function promptWithSentimentFilter(): Promise<void> {
  const metrics = await getMetrics();

  return new Promise<void>((resolve) => {
    Alert.alert(
      'Quick Question',
      'Is this app helping you keep track of your tools?',
      [
        {
          text: 'Not Really',
          style: 'cancel',
          onPress: async () => {
            console.log(`[${new Date().toISOString()}] reviewPrompt: User said "Not Really" — opening feedback path`);
            metrics.hasDeclinedReview = true;
            metrics.lastPromptDate = new Date().toISOString();
            await saveMetrics(metrics);
            Alert.alert(
              'We Want to Improve',
              'Sorry to hear that. We\'d love to know how we can do better. Please send us feedback at toolsinventory@feedback.com',
              [{ text: 'OK' }]
            );
            resolve();
          },
        },
        {
          text: 'Yes!',
          onPress: async () => {
            console.log(`[${new Date().toISOString()}] reviewPrompt: User said "Yes" — triggering store review`);
            metrics.lastPromptDate = new Date().toISOString();
            await saveMetrics(metrics);
            try {
              if (await StoreReview.isAvailableAsync()) {
                await StoreReview.requestReview();
              } else {
                console.log(`[${new Date().toISOString()}] reviewPrompt: StoreReview not available on this platform`);
              }
            } catch (e) {
              console.error(`[${new Date().toISOString()}] reviewPrompt: StoreReview error`, e);
            }
            resolve();
          },
        },
      ]
    );
  });
}

/**
 * Standard trigger: check accumulated metrics and prompt if thresholds are met.
 * Call after successful saves or other milestone moments.
 */
export async function checkAndPromptReview(): Promise<void> {
  try {
    if (await meetsStandardCriteria()) {
      console.log(`[${new Date().toISOString()}] reviewPrompt: Standard criteria met — showing sentiment filter`);
      await promptWithSentimentFilter();
    }
  } catch (e) {
    console.error(`[${new Date().toISOString()}] reviewPrompt: checkAndPromptReview error`, e);
  }
}

/**
 * High-ROI event-based triggers.
 * - 'batch_identify': user identified >= 5 items in one session
 * - 'fast_search': user found something via search in < 10 seconds
 * - 'already_own': user tapped a "you already own this" type warning
 */
export async function checkHighROITrigger(
  trigger: 'batch_identify' | 'fast_search' | 'already_own'
): Promise<void> {
  try {
    const metrics = await getMetrics();

    if (metrics.lastPromptDate && daysSince(metrics.lastPromptDate) < 90) {
      return;
    }

    if (metrics.totalSessions < 2) return;

    if (metrics.recentErrors > 0 && metrics.lastErrorDate && daysSince(metrics.lastErrorDate) < 7) {
      return;
    }

    console.log(`[${new Date().toISOString()}] reviewPrompt: High-ROI trigger fired — ${trigger}`);
    await promptWithSentimentFilter();
  } catch (e) {
    console.error(`[${new Date().toISOString()}] reviewPrompt: checkHighROITrigger error`, e);
  }
}
