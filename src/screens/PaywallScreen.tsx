import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocale } from '../i18n/LocaleContext';
import { getOfferings, purchasePackage, restorePurchases } from '../services/purchases';
import type { PurchasesPackage } from 'react-native-purchases';

const C = {
  bg:         '#090C14',
  card:       '#0F1320',
  border:     '#1D2535',
  primary:    '#00E87D',
  primaryDim: '#00E87D12',
  text:       '#FFFFFF',
  textSec:    '#8B95A6',
} as const;

const { width, height } = Dimensions.get('window');

const FEATURES: [string, string, string][] = [
  ['flash', 'paywall.feat1', 'paywall.feat1d'],
  ['map',   'paywall.feat2', 'paywall.feat2d'],
  ['bar-chart', 'paywall.feat3', 'paywall.feat3d'],
  ['cloud-upload', 'paywall.feat4', 'paywall.feat4d'],
  ['bulb', 'paywall.feat5', 'paywall.feat5d'],
];

export default function PaywallScreen({ onDone, onClose }: { onDone: () => void; onClose?: () => void }) {
  const { t } = useLocale();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
  const [loading, setLoading] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [packages, setPackages] = useState<{ yearly: PurchasesPackage | null; monthly: PurchasesPackage | null }>({ yearly: null, monthly: null });

  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();

    getOfferings().then(offering => {
      if (offering) {
        setPackages({
          yearly:  offering.annual    ?? offering.availablePackages.find(p => p.identifier === 'yearly')  ?? null,
          monthly: offering.monthly   ?? offering.availablePackages.find(p => p.identifier === 'monthly') ?? null,
        });
      } else {
        Alert.alert('Debug', 'getOfferings returned null — no offering available');
      }
    }).catch((e: any) => {
      Alert.alert('Debug Error', e?.message ?? JSON.stringify(e) ?? 'unknown error');
    }).finally(() => setPackagesLoading(false));
  }, []);

  const handleSubscribe = async () => {
    const pkg = plan === 'yearly' ? packages.yearly : packages.monthly;
    if (!pkg) {
      Alert.alert('Nicht verfügbar', 'Abonnement momentan nicht verfügbar. Bitte stelle sicher, dass du mit deiner Apple ID eingeloggt bist und versuche es erneut.');
      return;
    }
    setLoading(true);
    try {
      await purchasePackage(pkg);
      onDone();
    } catch (e: any) {
      if (!e?.userCancelled) {
        Alert.alert('Fehler', 'Kauf fehlgeschlagen. Bitte versuche es erneut.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    try {
      const info = await restorePurchases();
      if (info.entitlements.active['pro']) {
        onDone();
      } else {
        Alert.alert('Keine aktiven Käufe gefunden.');
      }
    } catch {
      Alert.alert('Fehler beim Wiederherstellen.');
    } finally {
      setLoading(false);
    }
  };

  const yearlyPrice  = packages.yearly?.product.priceString  ?? '€39.99';
  const monthlyBreak = packages.yearly  ? `€${(packages.yearly.product.price / 12).toFixed(2)}` : '€3.33';
  const monthlyPrice = packages.monthly?.product.priceString ?? '€6.99';

  return (
    <View style={s.root}>
      <LinearGradient
        colors={['#071410', '#090C14', '#090C14']}
        style={StyleSheet.absoluteFill}
        locations={[0, 0.35, 1]}
      />

      <SafeAreaView style={s.safe}>
        <Animated.View style={[{ flex: 1 }, { opacity: fade, transform: [{ translateY: slide }] }]}>

          {onClose && (
            <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
              <Ionicons name="close" size={20} color={C.textSec} />
            </TouchableOpacity>
          )}

          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Hero */}
            <View style={s.hero}>
              <View style={s.logoWrap}>
                <Image
                  source={require('../../assets/logo.png')}
                  style={s.logo}
                  resizeMode="cover"
                />
              </View>
              <View style={s.trialBadge}>
                <Text style={s.trialBadgeTxt}>{t('paywall.badge')}</Text>
              </View>
              <Text style={s.headline}>{t('paywall.title')}</Text>
              <Text style={s.sub}>{t('paywall.sub')}</Text>
            </View>

            {/* Features */}
            <View style={s.featureList}>
              {FEATURES.map(([icon, labelKey, descKey], i) => (
                <View key={i} style={[s.featureRow, i < FEATURES.length - 1 && s.featureRowBorder]}>
                  <View style={s.featureIconWrap}>
                    <Ionicons name={icon as any} size={17} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.featureLabel}>{t(labelKey)}</Text>
                    <Text style={s.featureDesc}>{t(descKey)}</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                </View>
              ))}
            </View>

            {/* Plan Toggle */}
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, plan === 'yearly' && s.toggleActive]}
                onPress={() => setPlan('yearly')}
                activeOpacity={0.8}
              >
                {plan === 'yearly' && (
                  <View style={s.savePill}>
                    <Text style={s.saveTxt}>{t('paywall.save')}</Text>
                  </View>
                )}
                <Text style={[s.toggleTitle, plan === 'yearly' && s.toggleTitleActive]}>
                  {t('paywall.planYearly')}
                </Text>
                <Text style={[s.togglePrice, plan === 'yearly' && s.togglePriceActive]}>
                  {plan === 'yearly' ? `${monthlyBreak}/Mo` : yearlyPrice}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.toggleBtn, plan === 'monthly' && s.toggleActive]}
                onPress={() => setPlan('monthly')}
                activeOpacity={0.8}
              >
                <Text style={[s.toggleTitle, plan === 'monthly' && s.toggleTitleActive]}>
                  {t('paywall.planMonthly')}
                </Text>
                <Text style={[s.togglePrice, plan === 'monthly' && s.togglePriceActive]}>
                  {monthlyPrice}/Mo
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 220 }} />
          </ScrollView>

          {/* Sticky Footer */}
          <View style={s.footer}>
            <TouchableOpacity
              style={[s.cta, (loading || packagesLoading) && { opacity: 0.7 }]}
              onPress={handleSubscribe}
              activeOpacity={0.85}
              disabled={loading || packagesLoading}
            >
              {loading || packagesLoading
                ? <ActivityIndicator color="#000" />
                : <Text style={s.ctaLabel}>{t('paywall.cta')}</Text>
              }
            </TouchableOpacity>
            <View style={s.appleRow}>
              <Ionicons name="lock-closed" size={11} color={C.textSec} />
              <Text style={s.appleTxt}>
                {plan === 'yearly'
                  ? 'Sichere Zahlung über Apple · Jährliche Abrechnung'
                  : 'Sichere Zahlung über Apple · Monatlich kündbar'}
              </Text>
            </View>
            <Text style={s.legal}>
              {plan === 'yearly'
                ? t('paywall.legalYearly', { price: yearlyPrice }) + t('paywall.legalSuffixYearly')
                : t('paywall.legalMonthly', { price: monthlyPrice }) + t('paywall.legalSuffix')}
            </Text>
            <TouchableOpacity onPress={handleRestore} style={s.restoreBtn}>
              <Text style={s.restoreTxt}>Kauf wiederherstellen</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 22 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 32, paddingBottom: 32 },
  logoWrap: {
    width: 80, height: 80, borderRadius: 20,
    overflow: 'hidden', marginBottom: 20,
  },
  logo: { width: '100%', height: '100%' },
  trialBadge: {
    backgroundColor: C.primaryDim, borderWidth: 1, borderColor: C.primary + '50',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 18,
  },
  trialBadgeTxt: { color: C.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  headline: {
    fontSize: 34, fontWeight: '800', color: C.text,
    textAlign: 'center', lineHeight: 40, marginBottom: 12, letterSpacing: -0.5,
  },
  sub: {
    fontSize: 15, color: C.textSec, textAlign: 'center',
    lineHeight: 22, paddingHorizontal: 10,
  },

  // Features
  featureList: {
    backgroundColor: C.card, borderRadius: 18,
    borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, marginBottom: 20,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  featureRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  featureIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.primaryDim, alignItems: 'center', justifyContent: 'center',
  },
  featureLabel: { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 2 },
  featureDesc:  { fontSize: 12, color: C.textSec },

  // Toggle
  toggle: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  toggleBtn: {
    flex: 1, backgroundColor: C.card, borderRadius: 16,
    borderWidth: 1.5, borderColor: C.border,
    paddingVertical: 14, paddingHorizontal: 14,
    alignItems: 'flex-start', position: 'relative',
    minHeight: 80, justifyContent: 'flex-end',
  },
  toggleActive: { borderColor: C.primary, backgroundColor: C.primaryDim },
  savePill: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: C.primary, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  saveTxt: { fontSize: 9, fontWeight: '800', color: '#000', letterSpacing: 0.5 },
  toggleTitle: { fontSize: 13, fontWeight: '700', color: C.textSec, marginBottom: 4 },
  toggleTitleActive: { color: C.text },
  togglePrice: { fontSize: 20, fontWeight: '800', color: C.textSec },
  togglePriceActive: { color: C.primary },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg,
    paddingHorizontal: 22, paddingBottom: 30, paddingTop: 14,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  cta: {
    backgroundColor: C.primary, borderRadius: 16,
    paddingVertical: 17, alignItems: 'center', marginBottom: 10,
  },
  ctaLabel: { fontSize: 15, fontWeight: '800', color: '#000', letterSpacing: 0.3 },
  appleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 8 },
  appleTxt: { fontSize: 11, color: C.textSec },
  legal: { fontSize: 11, color: C.textSec, textAlign: 'center', lineHeight: 16 },
  restoreBtn: { marginTop: 10, alignItems: 'center' },
  restoreTxt: { color: C.textSec, fontSize: 12 },
  closeBtn: {
    position: 'absolute', top: 12, right: 16, zIndex: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
});
