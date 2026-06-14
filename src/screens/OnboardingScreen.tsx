import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme } from '../theme/ThemeContext';
import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../services/supabase';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_REDIRECT = 'padelvision://auth/callback';

const USER_KEY = '@padelvision/user';

type Mode = 'register' | 'login' | 'forgot';

// No onComplete prop needed — App.tsx handles navigation via onAuthStateChange
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();

  const [mode, setMode] = useState<Mode>('register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;


  // ── Social handlers ───────────────────────────────────────────────────────
  const handleGoogleAuth = async () => {
    setSocialLoading('google');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: GOOGLE_REDIRECT, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error('No URL');

      const result = await WebBrowser.openAuthSessionAsync(data.url, GOOGLE_REDIRECT);
      if (result.type === 'success' && result.url) {
        const url = result.url;
        // implicit flow: tokens in hash fragment
        const hash = url.includes('#') ? url.split('#')[1] : url.split('?')[1] ?? '';
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token') ?? '';
        if (accessToken) {
          const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionError) throw sessionError;
          // onAuthStateChange handles navigation
        }
      }
    } catch (e: any) {
      Alert.alert('Google Sign In', e?.message ?? t('onboarding.googleError'));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleAuth = async () => {
    setSocialLoading('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
        });
        if (!error) {
          const userEmail = credential.email ?? `apple_${credential.user}@privaterelay.appleid.com`;
          const firstName = credential.fullName?.givenName ?? '';
          const lastName = credential.fullName?.familyName ?? '';
          const userName = [firstName, lastName].filter(Boolean).join(' ') || 'Apple User';
          await AsyncStorage.setItem(USER_KEY, JSON.stringify({ username: userName, email: userEmail })).catch(() => {});
          setSocialLoading(null);
          return; // onAuthStateChange handles navigation
        }
        console.warn('[Apple] signInWithIdToken error:', error.message);
      }

      Alert.alert('Apple Sign In', t('onboarding.googleError'));
      setSocialLoading(null);
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err.code !== 'ERR_CANCELED' && err.code !== 'ERR_APPLE_AUTHENTICATION_CREDENTIAL') {
        Alert.alert('Apple Sign In', t('onboarding.appleIosOnly'));
      }
      setSocialLoading(null);
    }
  };

  // ── Form logic ────────────────────────────────────────────────────────────
  const switchMode = (next: Mode) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setMode(next);
      setErrors({});
      setPassword('');
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  };

  const validate = useCallback((): boolean => {
    const next: typeof errors = {};
    if (mode === 'register' && !username.trim()) {
      next.username = t('onboarding.usernameRequired');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = t('onboarding.emailRequired');
    }
    if (mode !== 'forgot' && password.length < 6) {
      next.password = t('onboarding.passwordRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [mode, username, email, password, t]);

  const submit = async () => {
    if (!validate() || loading) return;
    setLoading(true);
    const trimmedEmail = email.trim();

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: 'padelvision://reset-password',
        });
        if (error) {
          setErrors({ email: error.message });
          return;
        }
        Alert.alert(
          t('onboarding.resetSuccess'),
          t('onboarding.resetEmailSent'),
          [{ text: 'OK', onPress: () => switchMode('login') }],
        );
        return;
      }

      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
        if (error) {
          const isCredential =
            error.message.toLowerCase().includes('invalid') ||
            error.message.toLowerCase().includes('credentials') ||
            error.message.toLowerCase().includes('password');
          if (isCredential) {
            setErrors({ password: t('onboarding.passwordWrong') });
          } else {
            setErrors({ email: error.message });
          }
          return;
        }
        // onAuthStateChange in App.tsx handles navigation
        return;
      }

      // Register
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { username: username.trim() } },
      });
      if (error) {
        if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already exists')) {
          setErrors({ email: t('onboarding.emailExists') });
        } else {
          setErrors({ email: error.message });
        }
        return;
      }
      // Save username to AsyncStorage for SettingsScreen display
      await AsyncStorage.setItem(USER_KEY, JSON.stringify({ username: username.trim(), email: trimmedEmail })).catch(() => {});
      // If no session → email confirmation required
      if (!signUpData.session) {
        Alert.alert(
          t('onboarding.confirmTitle'),
          t('onboarding.confirmMsg'),
          [{ text: 'OK', onPress: () => switchMode('login') }],
        );
        return;
      }
      // onAuthStateChange handles navigation
    } catch (e: any) {
      setErrors({ email: e?.message ?? 'Unbekannter Fehler' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (hasError: boolean) => ({
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: hasError ? colors.danger : colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: colors.text,
    fontSize: 16,
    flex: 1,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 28, marginTop: 8 }}>
            <View style={{
              borderRadius: 24, marginBottom: 16,
              shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
            }}>
              <Image
                source={require('../../assets/logo.png')}
                style={{ width: 100, height: 100, borderRadius: 24 }}
                resizeMode="cover"
              />
            </View>
            <Text style={{ fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.8 }}>
              PadelVision
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSec, marginTop: 5 }}>
              {t('onboarding.tagline')}
            </Text>
          </View>

          {/* Mode toggle — hidden in forgot flow */}
          {mode !== 'forgot' && (
            <View style={{
              flexDirection: 'row',
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 4,
              marginBottom: 24,
            }}>
              {(['register', 'login'] as Mode[]).map(m => (
                <TouchableOpacity
                  key={m}
                  style={{
                    flex: 1,
                    paddingVertical: 10,
                    borderRadius: 11,
                    alignItems: 'center',
                    backgroundColor: mode === m ? colors.primary : 'transparent',
                  }}
                  onPress={() => switchMode(m)}
                  activeOpacity={0.75}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: mode === m ? '#0C1C0C' : colors.textSec,
                  }}>
                    {t(m === 'register' ? 'onboarding.register' : 'onboarding.login')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Animated.View style={{ opacity: fadeAnim, gap: 14 }}>
            {/* Username — only on register */}
            {mode === 'register' && (
              <View>
                <Text style={{ color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
                  {t('onboarding.username')}
                </Text>
                <TextInput
                  style={inputStyle(!!errors.username)}
                  placeholder={t('onboarding.usernamePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  value={username}
                  onChangeText={v => { setUsername(v); if (errors.username) setErrors(e => ({ ...e, username: undefined })); }}
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                {errors.username ? <ErrorMsg msg={errors.username} color={colors.danger} /> : null}
              </View>
            )}

            {/* Email */}
            <View>
              <Text style={{ color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
                {t('onboarding.email')}
              </Text>
              <TextInput
                style={inputStyle(!!errors.email)}
                placeholder={t('onboarding.emailPlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={v => { setEmail(v); if (errors.email) setErrors(e => ({ ...e, email: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType={mode === 'forgot' ? 'done' : 'next'}
                onSubmitEditing={mode === 'forgot' ? submit : undefined}
              />
              {errors.email ? <ErrorMsg msg={errors.email} color={colors.danger} /> : null}
            </View>

            {/* Password — hidden in forgot mode (Supabase sends email link) */}
            {mode !== 'forgot' && (
              <View>
                <Text style={{ color: colors.textSec, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 }}>
                  {t('onboarding.password')}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={inputStyle(!!errors.password)}
                    placeholder={t('onboarding.passwordPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={password}
                    onChangeText={v => { setPassword(v); if (errors.password) setErrors(e => ({ ...e, password: undefined })); }}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={submit}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(p => !p)}
                    style={{ position: 'absolute', right: 14 }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <ErrorMsg msg={errors.password} color={colors.danger} /> : null}
              </View>
            )}

            {/* Info text for forgot mode */}
            {mode === 'forgot' && (
              <Text style={{ color: colors.textSec, fontSize: 13, lineHeight: 20, marginTop: -4 }}>
                {t('onboarding.forgotInfo')}
              </Text>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={{
                borderRadius: 16, marginTop: 4,
                shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
                opacity: loading ? 0.75 : 1,
              }}
              onPress={submit}
              activeOpacity={0.82}
              disabled={loading}
            >
              <LinearGradient
                colors={['#00E87D', '#00C9A0']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  paddingVertical: 17,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading && <ActivityIndicator size="small" color="#04120B" />}
                <Text style={{ color: '#04120B', fontSize: 17, fontWeight: '800' }}>
                  {t(mode === 'register' ? 'onboarding.getStarted' : mode === 'login' ? 'onboarding.loginBtn' : 'onboarding.resetBtn')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Forgot password link — only on login */}
            {mode === 'login' && (
              <TouchableOpacity
                onPress={() => switchMode('forgot')}
                style={{ alignItems: 'center', marginTop: 2 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                  {t('onboarding.forgotPassword')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Back to login — only in forgot flow */}
            {mode === 'forgot' && (
              <TouchableOpacity
                onPress={() => switchMode('login')}
                style={{ alignItems: 'center', marginTop: 2 }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textSec, fontSize: 13 }}>
                  {t('onboarding.backToLogin')}
                </Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Divider + Social buttons — hidden in forgot flow */}
          {mode !== 'forgot' && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t('onboarding.orWith')}</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
              </View>

              <View style={{ gap: 10 }}>
                <SocialBtn
                  icon="logo-google"
                  label={t('onboarding.withGoogle')}
                  iconColor="#EA4335"
                  colors={colors}
                  loading={socialLoading === 'google'}
                  onPress={handleGoogleAuth}
                />
                <SocialBtn
                  icon="logo-apple"
                  label={t('onboarding.withApple')}
                  iconColor={colors.text}
                  colors={colors}
                  loading={socialLoading === 'apple'}
                  onPress={handleAppleAuth}
                />
              </View>

              <TouchableOpacity
                onPress={() => switchMode(mode === 'register' ? 'login' : 'register')}
                style={{ marginTop: 26, alignItems: 'center' }}
                activeOpacity={0.7}
              >
                <Text style={{ color: colors.textSec, fontSize: 13 }}>
                  {t(mode === 'register' ? 'onboarding.switchToLogin' : 'onboarding.switchToRegister')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Privacy note */}
          <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 20, lineHeight: 17 }}>
            {t('onboarding.privacyNote')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrorMsg({ msg, color }: { msg: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 }}>
      <Ionicons name="alert-circle" size={13} color={color} />
      <Text style={{ color, fontSize: 12 }}>{msg}</Text>
    </View>
  );
}

function SocialBtn({
  icon, label, iconColor, colors, loading, onPress,
}: {
  icon: string; label: string; iconColor: string; colors: any; loading: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 14,
        paddingVertical: 15,
        opacity: loading ? 0.6 : 1,
      }}
      onPress={onPress}
      activeOpacity={0.78}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name={icon as any} size={20} color={iconColor} />
      )}
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );
}
