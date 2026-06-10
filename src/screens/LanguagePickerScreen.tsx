import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useLocale, LANGUAGE_OPTIONS, LocaleCode } from '../i18n/LocaleContext';

const FLAGS: Record<LocaleCode, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
};

const CONTINUE_LABEL: Record<LocaleCode, string> = {
  en: 'Continue',
  de: 'Weiter',
  es: 'Continuar',
  fr: 'Continuer',
};

export default function LanguagePickerScreen() {
  const { setLocale } = useLocale();
  const [selected, setSelected] = useState<LocaleCode | null>(null);

  return (
    <LinearGradient colors={['#090C14', '#071410', '#00180D']} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="cover"
          />
          <Text style={styles.appName}>PadelVision</Text>
          <Text style={styles.title}>Choose your language</Text>
          <Text style={styles.sub}>Sprache · Idioma · Langue</Text>
        </View>

        <View style={styles.list}>
          {LANGUAGE_OPTIONS.map(opt => {
            const active = selected === opt.code;
            return (
              <TouchableOpacity
                key={opt.code}
                style={[styles.card, active && styles.cardActive]}
                onPress={() => setSelected(opt.code)}
                activeOpacity={0.75}
              >
                <Text style={styles.flag}>{FLAGS[opt.code]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.langName, active && styles.langNameActive]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.region}>{opt.region}</Text>
                </View>
                {active && (
                  <View style={styles.check}>
                    <Text style={styles.checkIcon}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.btn, !selected && styles.btnOff]}
          onPress={() => { if (selected) setLocale(selected); }}
          disabled={!selected}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>
            {selected ? CONTINUE_LABEL[selected] : 'Continue'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'android' ? 32 : 16,
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', marginTop: 56 },
  logo: { width: 88, height: 88, borderRadius: 22, marginBottom: 14 },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 28,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  sub: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  list: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    gap: 14,
  },
  cardActive: {
    borderColor: '#00E87D',
    backgroundColor: 'rgba(0,232,125,0.09)',
  },
  flag: { fontSize: 30 },
  langName: { fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  langNameActive: { color: '#00E87D' },
  region: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#00E87D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkIcon: { color: '#090C14', fontSize: 13, fontWeight: '800' },
  btn: {
    backgroundColor: '#00E87D',
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
  },
  btnOff: { opacity: 0.35 },
  btnText: { fontSize: 16, fontWeight: '700', color: '#090C14' },
});
