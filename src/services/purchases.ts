import { LOG_LEVEL } from 'react-native-purchases';
import type { PurchasesPackage } from 'react-native-purchases';

const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';

function getPurchases() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('react-native-purchases').default as typeof import('react-native-purchases').default;
  } catch {
    return null;
  }
}

export function initPurchases() {
  const P = getPurchases();
  if (!P || !API_KEY) return;
  try {
    P.setLogLevel(LOG_LEVEL.ERROR);
    P.configure({ apiKey: API_KEY });
  } catch {}
}

export async function getOfferings() {
  const P = getPurchases();
  if (!P) return null;
  const offerings = await P.getOfferings();
  return offerings.current;
}

export async function purchasePackage(pkg: PurchasesPackage) {
  const P = getPurchases();
  if (!P) throw new Error('Purchases not available');
  const { customerInfo } = await P.purchasePackage(pkg);
  return customerInfo;
}

export async function restorePurchases() {
  const P = getPurchases();
  if (!P) throw new Error('Purchases not available');
  return P.restorePurchases();
}

export async function isProActive(): Promise<boolean> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const dev = await AsyncStorage.getItem('@padelvision/dev_pro');
    if (dev === 'true') return true;
  } catch {}
  const P = getPurchases();
  if (!P) return false;
  const customerInfo = await P.getCustomerInfo();
  return customerInfo.entitlements.active['pro'] !== undefined;
}
