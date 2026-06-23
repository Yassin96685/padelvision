import React, { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, Image, Linking, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

// Number of free analyses a non-Pro user gets before the paywall.
const FREE_ANALYSIS_LIMIT = 3;

// Quadrat mit zwei voll abgerundeten, gegenueberliegenden Ecken, um 45 Grad
// gedreht = mandelfoermiges Auge mit spitzen Augenwinkeln (kein SVG noetig)
const EYE_SIZE = 184;
const EYE_BOX = Math.ceil(EYE_SIZE * Math.SQRT2); // Bounding-Box des rotierten Quadrats

// Weisse Wimpern als gefaecherte, zugespitzte Striche ueber dem Oberlid.
// Vorberechnet aus t in [-1,1]: aussen laenger und staerker nach aussen geneigt.
const LASH_SPAN = EYE_BOX * 0.82;
const LASH_TH   = 4;
const LASHES = (() => {
  const ts = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
  const maxAngDeg = 34;
  const Lmin = 17, Lext = 20;
  const baseLineY = 34, arcDip = 18; // Lid-Linie woelbt sich an den Ecken nach unten
  return ts.map((t) => {
    const ang = (t * maxAngDeg * Math.PI) / 180;
    const x   = t * (LASH_SPAN / 2);
    const baseY = baseLineY + t * t * arcDip;
    const L = Lmin + Math.abs(t) * Lext;
    const cx = LASH_SPAN / 2 + x + (L / 2) * Math.sin(ang);
    const cy = baseY - (L / 2) * Math.cos(ang);
    return {
      left: cx - LASH_TH / 2,
      top: cy - L / 2,
      width: LASH_TH,
      height: L,
      rotate: `${t * maxAngDeg}deg`,
      opacity: 0.8 + 0.2 * Math.abs(t),
    };
  });
})();

function SplashView() {
  const eyeOpen    = useRef(new Animated.Value(0)).current;   // 0 = geschlossen, 1 = offen
  const racketY    = useRef(new Animated.Value(150)).current; // Schlaeger startet unterhalb, vom Lid verdeckt
  const dotOpacity = useRef(new Animated.Value(0)).current;
  const dotScale   = useRef(new Animated.Value(0.3)).current;
  const glow       = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      Animated.delay(250),
      Animated.timing(eyeOpen, {
        toValue: 1,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      // Schlaegerkopf-Mitte landet im Augenzentrum (Kopf 78 + Hals 8 + Griff 31 → Offset 19)
      Animated.timing(racketY, {
        toValue: 19,
        duration: 650,
        easing: Easing.out(Easing.back(1.3)),
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(dotOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(dotScale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      ]),
    ]).start(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ).start();
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#090C14', justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="light" />

      {/* Weicher gruener Halo hinter dem Auge */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: EYE_BOX * 1.3,
          height: EYE_BOX * 1.3,
          borderRadius: EYE_BOX,
          backgroundColor: '#00E87D',
          opacity: Animated.multiply(dotOpacity, glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.13] })),
        }}
      />

      <Animated.View style={{ transform: [{ scaleY: eyeOpen.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.92] }) }] }}>

        {/* Weisse Wimpern ueber dem Oberlid — fahren mit dem Lid auf */}
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, right: 0, top: -8, height: 56, alignItems: 'center', opacity: eyeOpen }}
        >
          <View style={{ width: LASH_SPAN, height: 56 }}>
            {LASHES.map((l, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: l.left,
                  top: l.top,
                  width: l.width,
                  height: l.height,
                  borderRadius: l.width / 2,
                  backgroundColor: '#FFFFFF',
                  opacity: l.opacity,
                  transform: [{ rotate: l.rotate }],
                }}
              />
            ))}
          </View>
        </Animated.View>

        <View
          style={{
            width: EYE_SIZE,
            height: EYE_SIZE,
            borderTopLeftRadius: EYE_SIZE,
            borderBottomRightRadius: EYE_SIZE,
            borderWidth: 2.5,
            borderColor: '#22304A',
            backgroundColor: '#0F1320',
            overflow: 'hidden',
            justifyContent: 'center',
            alignItems: 'center',
            transform: [{ rotate: '45deg' }],
          }}
        >
          <View
            style={{
              position: 'absolute',
              width: EYE_BOX,
              height: EYE_BOX,
              top: (EYE_SIZE - EYE_BOX) / 2,
              left: (EYE_SIZE - EYE_BOX) / 2,
              justifyContent: 'center',
              alignItems: 'center',
              transform: [{ rotate: '-45deg' }],
            }}
          >
            {/* Padel-Schlaeger steigt von unten ins Auge */}
            <Animated.View style={{ position: 'absolute', alignItems: 'center', transform: [{ translateY: racketY }] }}>
              <View
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 39,
                  backgroundColor: '#141B2E',
                  borderWidth: 2.5,
                  borderColor: 'rgba(0,232,125,0.45)',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {[[-27, 0], [27, 0], [-14, -24], [14, -24], [-14, 24], [14, 24]].map(([x, y], i) => (
                  <View
                    key={i}
                    style={{
                      position: 'absolute',
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: 'rgba(255,255,255,0.14)',
                      transform: [{ translateX: x }, { translateY: y }],
                    }}
                  />
                ))}
                <Animated.View
                  style={{
                    position: 'absolute',
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: '#00E87D',
                    opacity: Animated.multiply(dotOpacity, glow.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.30] })),
                    transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) }],
                  }}
                />
                <Animated.View
                  style={{
                    width: 25,
                    height: 25,
                    borderRadius: 12.5,
                    backgroundColor: '#00E87D',
                    opacity: dotOpacity,
                    transform: [{ scale: dotScale }],
                    shadowColor: '#00E87D',
                    shadowOpacity: 0.9,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 0 },
                  }}
                />
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 21,
                    left: 25,
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    opacity: dotOpacity,
                  }}
                />
              </View>
              <View
                style={{
                  width: 20,
                  height: 8,
                  backgroundColor: '#141B2E',
                  borderLeftWidth: 2.5,
                  borderRightWidth: 2.5,
                  borderColor: 'rgba(0,232,125,0.45)',
                  marginTop: -1,
                }}
              />
              <View
                style={{
                  width: 15,
                  height: 31,
                  borderRadius: 7,
                  backgroundColor: '#1D2535',
                  borderWidth: 1.5,
                  borderColor: '#2A3550',
                }}
              />
            </Animated.View>
            {/* Lidschatten oben fuer Tiefe */}
            <LinearGradient
              colors={['rgba(0,0,0,0.55)', 'transparent']}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, height: EYE_BOX * 0.44 }}
              pointerEvents="none"
            />
            {/* Unterlid-Schatten — Schlaeger wirkt dahinter hervorkommend */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.30)']}
              style={{ position: 'absolute', bottom: EYE_BOX * 0.28, left: 0, right: 0, height: EYE_BOX * 0.20 }}
              pointerEvents="none"
            />
          </View>
        </View>
      </Animated.View>
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
    // Only wall the app once the user has used up all their free analyses.
    (async () => {
      try {
        const { count } = await supabase
          .from('matches')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', uid);
        if ((count ?? 0) >= FREE_ANALYSIS_LIMIT) {
          AsyncStorage.setItem(`@padelvision/free_analysis_done_${uid}`, 'true').catch(() => {});
          setFreeAnalysisDone(true);
        }
      } catch {}
    })();
  }, [session?.user?.id]);

  if (isRecovery) {
    return (
      <ResetPasswordScreen onDone={() => {
        setIsRecovery(false);
        setSession(null);
      }} />
    );
  }

  if (isLoading || !minWaitDone) {
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
