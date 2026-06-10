import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Image, Linking, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { MatchProvider } from './src/store/MatchContext';
import { LocaleProvider } from './src/i18n/LocaleContext';
import AuthContext from './src/store/AuthContext';
import TabNavigator from './src/navigation/TabNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SetupWizardScreen from './src/screens/SetupWizardScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import { supabase } from './src/services/supabase';
import { initPurchases, isProActive } from './src/services/purchases';
import PaywallScreen from './src/screens/PaywallScreen';
import type { Session } from '@supabase/supabase-js';

SplashScreen.preventAutoHideAsync();
initPurchases();

const USER_KEY = '@padelvision/user';

function SplashView() {
  const scale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 8, tension: 45, useNativeDriver: true }).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#090C14', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="light" />
      <Animated.Image
        source={require('./assets/splash-logo.png')}
        style={{ width: 110, height: 110, transform: [{ scale }] }}
        resizeMode="contain"
      />
    </View>
  );
}

function Root() {
  const { colors, theme } = useTheme();
  const [session,          setSession]          = useState<Session | null | undefined>(undefined);
  const [setupDone,        setSetupDone]        = useState<boolean | null>(null);
  const [isRecovery,       setIsRecovery]       = useState(false);
  const [isPro,            setIsPro]            = useState<boolean | null>(null);
  const [freeAnalysisDone, setFreeAnalysisDone] = useState<boolean | null>(null);
  const [paywallDismissed, setPaywallDismissed] = useState(false);
  const [minWaitDone, setMinWaitDone] = useState(false);

  const isLoading =
    session === undefined ||
    (session !== null && setupDone === null) ||
    (session !== null && setupDone === true && isPro === null) ||
    (session !== null && setupDone === true && isPro === false && freeAnalysisDone === null);

  useEffect(() => {
    const t = setTimeout(() => setMinWaitDone(true), 2200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if ((!isLoading && minWaitDone) || isRecovery) {
      SplashScreen.hideAsync();
    }
  }, [isLoading, isRecovery, minWaitDone]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') { setIsRecovery(true); return; }
      if (event === 'USER_UPDATED')      { setIsRecovery(false); }
      setSession(session);

      if (event === 'SIGNED_IN' && session) {
        const { email, user_metadata } = session.user;
        const username =
          user_metadata?.username ??
          user_metadata?.name ??
          user_metadata?.full_name ??
          email?.split('@')[0] ??
          '';
        AsyncStorage.setItem(USER_KEY, JSON.stringify({ username, email: email ?? '' })).catch(() => {});
      }

      if (event === 'SIGNED_OUT') { setSetupDone(null); setIsPro(null); setPaywallDismissed(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (!url.includes('reset-password')) return;

      // PKCE flow: code in query string
      const hashIdx = url.indexOf('#');
      const queryStr = (url.indexOf('?') !== -1)
        ? url.slice(url.indexOf('?') + 1, hashIdx !== -1 ? hashIdx : undefined)
        : '';
      const code = new URLSearchParams(queryStr).get('code');
      if (code) {
        try {
          // @ts-ignore — available in supabase-js v2.x
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) setIsRecovery(true);
        } catch {}
        return;
      }

      // Implicit flow: tokens in hash fragment
      const fragment = hashIdx !== -1 ? url.slice(hashIdx + 1) : '';
      const params   = new URLSearchParams(fragment);
      const token    = params.get('access_token');
      const refresh  = params.get('refresh_token') ?? '';
      if (token) {
        try {
          await supabase.auth.setSession({ access_token: token, refresh_token: refresh });
          setIsRecovery(true);
        } catch {}
      }
    };
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    Linking.getInitialURL().then(url => { if (url) handleUrl(url); }).catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setSetupDone(null); setIsPro(null); return; }
    if (session?.user?.user_metadata?.setup_done === true) {
      setSetupDone(true);
      return;
    }
    AsyncStorage.getItem(`@padelvision/setup_done_${uid}`)
      .then(val => setSetupDone(val === 'true'))
      .catch(() => setSetupDone(true));
  }, [session?.user?.id]);

  useEffect(() => {
    if (!setupDone || !session) return;
    if (session.user.email === 'soussiyassin2008@gmail.com') {
      AsyncStorage.setItem('@padelvision/dev_pro', 'true').catch(() => {});
      setIsPro(true);
      return;
    }
    AsyncStorage.removeItem('@padelvision/dev_pro').catch(() => {});
    isProActive()
      .then(active => setIsPro(active))
      .catch(() => setIsPro(false));
  }, [setupDone, session?.user?.id]);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || !setupDone || isPro === null) return;
    if (isPro) { setFreeAnalysisDone(false); return; }
    AsyncStorage.getItem(`@padelvision/free_analysis_done_${uid}`)
      .then(val => setFreeAnalysisDone(val === 'true'))
      .catch(() => setFreeAnalysisDone(false));
  }, [session?.user?.id, setupDone, isPro]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    await AsyncStorage.multiRemove(['@padelvision/registered', USER_KEY, '@padelvision/dev_pro']).catch(() => {});
  }, []);

  const markFreeAnalysisDone = useCallback(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    AsyncStorage.setItem(`@padelvision/free_analysis_done_${uid}`, 'true').catch(() => {});
    setFreeAnalysisDone(true);
  }, [session?.user?.id]);

  if (isRecovery) {
    return (
      <ResetPasswordScreen onDone={() => {
        setIsRecovery(false);
        setSession(null);
      }} />
    );
  }

  if (isLoading) {
    return <SplashView />;
  }

  const userId = session?.user?.id ?? '';

  return (
    <MatchProvider userId={userId}>
      <AuthContext.Provider value={{ signOut, userId, isPro: isPro ?? false, markFreeAnalysisDone }}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        {session ? (
          !setupDone ? (
            <SetupWizardScreen onDone={() => setSetupDone(true)} />
          ) : !isPro && freeAnalysisDone && !paywallDismissed ? (
            <PaywallScreen onDone={() => setIsPro(true)} onClose={() => setPaywallDismissed(true)} />
          ) : (
            <NavigationContainer>
              <TabNavigator />
            </NavigationContainer>
          )
        ) : (
          <OnboardingScreen />
        )}
      </AuthContext.Provider>
    </MatchProvider>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: '#090C14' }}>
          <Root />
        </SafeAreaProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
