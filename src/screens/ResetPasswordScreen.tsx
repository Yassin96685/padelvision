import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useLocale } from '../i18n/LocaleContext';
import { supabase } from '../services/supabase';

export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const { t } = useLocale();

  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

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

  const submit = async () => {
    setError('');
    if (password.length < 6) { setError(t('resetPw.tooShort')); return; }
    if (password !== confirm) { setError(t('resetPw.mismatch')); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) { setError(updateError.message); return; }

      Alert.alert('PadelVision', t('resetPw.success'), [
        { text: 'OK', onPress: async () => { await supabase.auth.signOut(); onDone(); } },
      ]);
    } catch (e: any) {
      setError(e?.message ?? 'Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
      <View style={s.container}>
        {/* Icon */}
        <View style={[s.iconWrap, { backgroundColor: colors.primaryDim, borderColor: colors.primary + '40' }]}>
          <Ionicons name="lock-closed" size={32} color={colors.primary} />
        </View>

        <Text style={[s.title, { color: colors.text }]}>{t('resetPw.title')}</Text>
        <Text style={[s.subtitle, { color: colors.textSec }]}>{t('resetPw.subtitle')}</Text>

        {/* New password */}
        <View style={s.field}>
          <Text style={[s.label, { color: colors.textSec }]}>
            {t('resetPw.newPassword').toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={inputStyle(!!error)}
              value={password}
              onChangeText={v => { setPassword(v); setError(''); }}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              returnKeyType="next"
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              onPress={() => setShowPw(p => !p)}
              style={s.eyeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Confirm password */}
        <View style={s.field}>
          <Text style={[s.label, { color: colors.textSec }]}>
            {t('resetPw.confirmPassword').toUpperCase()}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput
              style={inputStyle(!!error)}
              value={confirm}
              onChangeText={v => { setConfirm(v); setError(''); }}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={submit}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(p => !p)}
              style={s.eyeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name={showConfirm ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error */}
        {!!error && (
          <View style={s.errorRow}>
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text style={[s.errorTxt, { color: colors.danger }]}>{error}</Text>
          </View>
        )}

        {/* Submit */}
        <TouchableOpacity
          style={[s.btn, { backgroundColor: loading ? colors.primaryDim : colors.primary }]}
          onPress={submit}
          activeOpacity={0.82}
          disabled={loading}
        >
          {loading && <ActivityIndicator size="small" color="#0C1C0C" style={{ marginRight: 8 }} />}
          <Text style={s.btnTxt}>{t('resetPw.submit')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1 },
  container: { flex: 1, paddingHorizontal: 26, paddingTop: 60, gap: 0 },
  iconWrap:  {
    width: 72, height: 72, borderRadius: 22,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, alignSelf: 'center',
  },
  title:    { fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  field:    { marginBottom: 16 },
  label:    { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  eyeBtn:   { position: 'absolute', right: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  errorTxt: { fontSize: 13 },
  btn: {
    borderRadius: 16, paddingVertical: 17,
    alignItems: 'center', marginTop: 8,
    flexDirection: 'row', justifyContent: 'center',
  },
  btnTxt: { color: '#0C1C0C', fontSize: 17, fontWeight: '800' },
});
