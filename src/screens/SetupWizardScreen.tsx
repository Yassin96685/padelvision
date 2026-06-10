import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import { useLocale, LANGUAGE_OPTIONS, LocaleCode } from '../i18n/LocaleContext';
import { supabase } from '../services/supabase';

const FLAGS: Record<LocaleCode, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  es: '🇪🇸',
  fr: '🇫🇷',
};

// Always dark — brand first impression
const C = {
  bg: '#090C14',
  card: '#0F1320',
  primaryDim: '#00E87D18',
  border: '#1D2535',
  primary: '#00E87D',
  text: '#FFFFFF',
  textSec: '#8B95A6',
} as const;

const LEVELS = [
  { key: 'beginner', emoji: '🌱', tk: 'setup.level.beginner', desc: 'setup.level.beginnerDesc' },
  { key: 'amateur',  emoji: '🎾', tk: 'setup.level.amateur',  desc: 'setup.level.amateurDesc'  },
  { key: 'advanced', emoji: '⚡', tk: 'setup.level.advanced', desc: 'setup.level.advancedDesc' },
  { key: 'pro',      emoji: '🏆', tk: 'setup.level.pro',      desc: 'setup.level.proDesc'      },
] as const;

const POSITIONS = [
  { key: 'left',  icon: 'arrow-back-outline'    as const, tk: 'setup.position.left',  desc: 'setup.position.leftDesc'  },
  { key: 'both',  icon: 'swap-horizontal-outline' as const, tk: 'setup.position.both',  desc: 'setup.position.bothDesc'  },
  { key: 'right', icon: 'arrow-forward-outline' as const, tk: 'setup.position.right', desc: 'setup.position.rightDesc' },
] as const;

const GOALS = [
  { key: 'fun',     emoji: '🎉', tk: 'setup.goal.fun',     desc: 'setup.goal.funDesc'     },
  { key: 'compete', emoji: '🏆', tk: 'setup.goal.compete', desc: 'setup.goal.competeDesc' },
  { key: 'fitness', emoji: '💪', tk: 'setup.goal.fitness', desc: 'setup.goal.fitnessDesc' },
  { key: 'social',  emoji: '👥', tk: 'setup.goal.social',  desc: 'setup.goal.socialDesc'  },
] as const;

const FREQUENCIES = [
  { key: 'low',  emoji: '🌙', tk: 'setup.freq.low',  desc: 'setup.freq.lowDesc'  },
  { key: 'mid',  emoji: '🔥', tk: 'setup.freq.mid',  desc: 'setup.freq.midDesc'  },
  { key: 'high', emoji: '⚡', tk: 'setup.freq.high', desc: 'setup.freq.highDesc' },
] as const;

const TOTAL = 7;

export default function SetupWizardScreen({ onDone }: { onDone: () => void }) {
  const { userId } = useAuth();
  const { t, setLocale } = useLocale();

  const [step,      setStep]      = useState(0);
  const [lang,      setLang]      = useState('');
  const [name,      setName]      = useState('');
  const [level,     setLevel]     = useState('');
  const [goal,      setGoal]      = useState('');
  const [position,  setPosition]  = useState('');
  const [frequency, setFrequency] = useState('');

  const fade  = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;

  const profilePrefix = `@padelvision/profile_${userId}`;

  function transition(next: number) {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 0,   duration: 150, useNativeDriver: true }),
      Animated.timing(slide, { toValue: -20, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slide.setValue(20);
      Animated.parallel([
        Animated.timing(fade,  { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    });
  }

  const canNext =
    step === 0 ? lang !== '' :
    step === 1 ? name.trim().length > 0 :
    step === 2 ? level !== '' :
    step === 3 ? goal !== '' :
    step === 4 ? position !== '' :
    step === 5 ? frequency !== '' :
    true;

  const finish = useCallback(async (skipAll = false) => {
    Keyboard.dismiss();
    try {
      const pairs: [string, string][] = [[`@padelvision/setup_done_${userId}`, 'true']];
      if (!skipAll) {
        if (name.trim()) pairs.push([`${profilePrefix}_name`,      name.trim()]);
        if (level)       pairs.push([`${profilePrefix}_level`,     level]);
        if (goal)        pairs.push([`${profilePrefix}_goal`,      goal]);
        if (position)    pairs.push([`${profilePrefix}_position`,  position]);
        if (frequency)   pairs.push([`${profilePrefix}_frequency`, frequency]);
      }
      await Promise.all([
        AsyncStorage.multiSet(pairs),
        supabase.auth.updateUser({ data: { setup_done: true } }),
      ]);
    } catch {}
    onDone();
  }, [userId, profilePrefix, name, level, goal, position, frequency, onDone]);

  const handleNext = useCallback(() => {
    Keyboard.dismiss();
    if (step < TOTAL - 1) transition(step + 1);
    else finish(false);
  }, [step, finish]);

  const displayName = name.trim() || t('setup.defaultName');

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.dots}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <View key={i} style={[s.dot, i < step && s.dotDone, i === step && s.dotActive]} />
            ))}
          </View>
        </View>

        {/* Animated step content */}
        <Animated.View style={[s.content, { opacity: fade, transform: [{ translateY: slide }] }]}>
          {step === 0 && <LangStep  lang={lang}           setLang={(c) => { setLang(c); setLocale(c as LocaleCode); }} t={t} />}
          {step === 1 && <NameStep  name={name}          setName={setName}           t={t} />}
          {step === 2 && <LevelStep level={level}        setLevel={setLevel}         t={t} />}
          {step === 3 && <GoalStep  goal={goal}          setGoal={setGoal}           t={t} />}
          {step === 4 && <PosStep   pos={position}       setPos={setPosition}        t={t} />}
          {step === 5 && <FreqStep  freq={frequency}     setFreq={setFrequency}      t={t} />}
          {step === 6 && <DoneStep  displayName={displayName}                        t={t} />}
        </Animated.View>

        {/* CTA */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.cta, !canNext && s.ctaOff]}
            onPress={canNext ? handleNext : undefined}
            activeOpacity={0.82}
          >
            <Text style={[s.ctaLabel, !canNext && s.ctaLabelOff]}>
              {step === TOTAL - 1 ? t('setup.getStarted') : t('setup.next')}
            </Text>
            {canNext && (
              <Ionicons
                name={step === TOTAL - 1 ? 'rocket-outline' : 'arrow-forward'}
                size={18}
                color="#000"
                style={{ marginLeft: 8 }}
              />
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function LangStep({
  lang, setLang, t,
}: { lang: string; setLang: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={s.step}>
      <Text style={s.bigEmoji}>🌍</Text>
      <Text style={s.title}>{t('setup.langTitle')}</Text>
      <Text style={s.sub}>{t('setup.langSub')}</Text>
      <View style={s.freqCol}>
        {LANGUAGE_OPTIONS.map(opt => {
          const on = lang === opt.code;
          return (
            <TouchableOpacity
              key={opt.code}
              style={[s.freqCard, on && s.freqCardOn]}
              onPress={() => setLang(opt.code)}
              activeOpacity={0.75}
            >
              <Text style={s.freqEmoji}>{FLAGS[opt.code]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.freqLabel, on && s.freqLabelOn]}>{opt.label}</Text>
                <Text style={[s.freqDesc,  on && s.freqDescOn]}>{opt.region}</Text>
              </View>
              {on && (
                <View style={s.cardCheck}>
                  <Ionicons name="checkmark" size={12} color="#000" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function NameStep({
  name, setName, t,
}: { name: string; setName: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={s.step}>
      <Text style={s.bigEmoji}>👋</Text>
      <Text style={s.title}>{t('setup.nameTitle')}</Text>
      <Text style={s.sub}>{t('setup.nameSub')}</Text>
      <View style={[s.inputBox, name.length > 0 && s.inputBoxActive]}>
        <TextInput
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder={t('setup.namePlaceholder')}
          placeholderTextColor={C.textSec}
          autoFocus
          returnKeyType="done"
          maxLength={30}
          autoCorrect={false}
          autoCapitalize="words"
        />
      </View>
    </View>
  );
}

function LevelStep({
  level, setLevel, t,
}: { level: string; setLevel: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={s.step}>
      <Text style={s.bigEmoji}>🎯</Text>
      <Text style={s.title}>{t('setup.levelTitle')}</Text>
      <Text style={s.sub}>{t('setup.levelSub')}</Text>
      <View style={s.grid}>
        {LEVELS.map(lv => {
          const on = level === lv.key;
          return (
            <TouchableOpacity
              key={lv.key}
              style={[s.card, on && s.cardOn]}
              onPress={() => setLevel(lv.key)}
              activeOpacity={0.75}
            >
              <Text style={s.cardEmoji}>{lv.emoji}</Text>
              <Text style={[s.cardLabel, on && s.cardLabelOn]}>{t(lv.tk)}</Text>
              <Text style={[s.cardDesc,  on && s.cardDescOn]}>{t(lv.desc)}</Text>
              {on && (
                <View style={s.cardCheck}>
                  <Ionicons name="checkmark" size={12} color="#000" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function GoalStep({
  goal, setGoal, t,
}: { goal: string; setGoal: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={s.step}>
      <Text style={s.bigEmoji}>🎯</Text>
      <Text style={s.title}>{t('setup.goalTitle')}</Text>
      <Text style={s.sub}>{t('setup.goalSub')}</Text>
      <View style={s.grid}>
        {GOALS.map(g => {
          const on = goal === g.key;
          return (
            <TouchableOpacity
              key={g.key}
              style={[s.card, on && s.cardOn]}
              onPress={() => setGoal(g.key)}
              activeOpacity={0.75}
            >
              <Text style={s.cardEmoji}>{g.emoji}</Text>
              <Text style={[s.cardLabel, on && s.cardLabelOn]}>{t(g.tk)}</Text>
              <Text style={[s.cardDesc, on && s.cardDescOn]}>{t(g.desc)}</Text>
              {on && (
                <View style={s.cardCheck}>
                  <Ionicons name="checkmark" size={12} color="#000" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function FreqStep({
  freq, setFreq, t,
}: { freq: string; setFreq: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={s.step}>
      <Text style={s.bigEmoji}>📅</Text>
      <Text style={s.title}>{t('setup.freqTitle')}</Text>
      <Text style={s.sub}>{t('setup.freqSub')}</Text>
      <View style={s.freqCol}>
        {FREQUENCIES.map(f => {
          const on = freq === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.freqCard, on && s.freqCardOn]}
              onPress={() => setFreq(f.key)}
              activeOpacity={0.75}
            >
              <Text style={s.freqEmoji}>{f.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.freqLabel, on && s.freqLabelOn]}>{t(f.tk)}</Text>
                <Text style={[s.freqDesc,  on && s.freqDescOn]}>{t(f.desc)}</Text>
              </View>
              {on && (
                <View style={s.cardCheck}>
                  <Ionicons name="checkmark" size={12} color="#000" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PosStep({
  pos, setPos, t,
}: { pos: string; setPos: (v: string) => void; t: (k: string) => string }) {
  return (
    <View style={s.step}>
      <Text style={s.bigEmoji}>🏟️</Text>
      <Text style={s.title}>{t('setup.positionTitle')}</Text>
      <Text style={s.sub}>{t('setup.positionSub')}</Text>

      {/* Mini court diagram */}
      <View style={s.court}>
        <View style={[s.courtSide, (pos === 'left' || pos === 'both') && s.courtSideOn]}>
          <Text style={[s.courtLetter, (pos === 'left' || pos === 'both') && s.courtLetterOn]}>L</Text>
        </View>
        <View style={s.courtNet} />
        <View style={[s.courtSide, (pos === 'right' || pos === 'both') && s.courtSideOn]}>
          <Text style={[s.courtLetter, (pos === 'right' || pos === 'both') && s.courtLetterOn]}>R</Text>
        </View>
      </View>

      <View style={s.posRow}>
        {POSITIONS.map(p => {
          const on = pos === p.key;
          return (
            <TouchableOpacity
              key={p.key}
              style={[s.posCard, on && s.posCardOn]}
              onPress={() => setPos(p.key)}
              activeOpacity={0.75}
            >
              <Ionicons name={p.icon} size={28} color={on ? C.primary : C.textSec} style={{ marginBottom: 8 }} />
              <Text style={[s.posLabel, on && s.posLabelOn]}>{t(p.tk)}</Text>
              <Text style={[s.posDesc,  on && s.posDescOn]}>{t(p.desc)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DoneStep({
  displayName, t,
}: { displayName: string; t: (k: string, a?: Record<string, string>) => string }) {
  const features = ['home.featureAI', 'home.featureHeatmap', 'home.featureProgress'];
  return (
    <View style={[s.step, { alignItems: 'center' }]}>
      <Text style={s.bigEmoji}>🚀</Text>
      <Text style={s.title}>{t('setup.doneTitle', { name: displayName })}</Text>
      <Text style={s.sub}>{t('setup.doneSub')}</Text>
      <View style={s.featureList}>
        {features.map(key => (
          <View key={key} style={s.featureRow}>
            <View style={s.featureCheck}>
              <Ionicons name="checkmark" size={14} color="#000" />
            </View>
            <Text style={s.featureTxt}>{t(key)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 8,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.border },
  dotDone: { backgroundColor: C.primary + '55' },
  dotActive: { width: 22, backgroundColor: C.primary },
  skipTxt: { color: C.textSec, fontSize: 14 },

  content: { flex: 1, paddingHorizontal: 24 },
  step: { flex: 1, justifyContent: 'center' },

  bigEmoji: { fontSize: 52, textAlign: 'center', marginBottom: 18 },
  title: {
    fontSize: 28, fontWeight: '700', color: C.text,
    textAlign: 'center', marginBottom: 10, lineHeight: 34,
  },
  sub: { fontSize: 15, color: C.textSec, textAlign: 'center', marginBottom: 32, lineHeight: 22 },

  // Name input
  inputBox: {
    borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.card, overflow: 'hidden',
  },
  inputBoxActive: { borderColor: C.primary },
  input: { padding: 18, fontSize: 18, color: C.text, fontWeight: '500' },

  // Level grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47%', minHeight: 110, backgroundColor: C.card,
    borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
    padding: 16, position: 'relative',
  },
  cardOn: { borderColor: C.primary, backgroundColor: C.primaryDim },
  cardEmoji: { fontSize: 26, marginBottom: 8 },
  cardLabel: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 3 },
  cardLabelOn: { color: C.primary },
  cardDesc: { fontSize: 11, color: C.textSec },
  cardDescOn: { color: C.primary + 'AA' },
  cardCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  // Frequency column
  freqCol: { gap: 12 },
  freqCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.card, borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
    padding: 18, position: 'relative',
  },
  freqCardOn: { borderColor: C.primary, backgroundColor: C.primaryDim },
  freqEmoji: { fontSize: 28, marginRight: 16 },
  freqLabel: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 2 },
  freqLabelOn: { color: C.primary },
  freqDesc: { fontSize: 12, color: C.textSec },
  freqDescOn: { color: C.primary + 'AA' },

  // Court diagram
  court: {
    flexDirection: 'row', height: 68, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden', marginBottom: 18,
  },
  courtSide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  courtSideOn: { backgroundColor: C.primaryDim },
  courtNet: { width: 2, backgroundColor: C.primary + '55' },
  courtLetter: { fontSize: 22, fontWeight: '700', color: C.border },
  courtLetterOn: { color: C.primary },

  // Position cards
  posRow: { flexDirection: 'row', gap: 12 },
  posCard: {
    flex: 1, minHeight: 120, backgroundColor: C.card,
    borderRadius: 16, borderWidth: 1.5, borderColor: C.border,
    padding: 20, alignItems: 'center', justifyContent: 'center',
  },
  posCardOn: { borderColor: C.primary, backgroundColor: C.primaryDim },
  posLabel: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  posLabelOn: { color: C.primary },
  posDesc: { fontSize: 11, color: C.textSec, textAlign: 'center' },
  posDescOn: { color: C.primary + 'AA' },

  // Done screen
  featureList: { gap: 14, alignSelf: 'stretch', marginTop: 4 },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
  featureCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  featureTxt: { fontSize: 16, color: C.text },

  // Footer CTA
  footer: { paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8 },
  cta: {
    backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  ctaOff: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  ctaLabel: { fontSize: 17, fontWeight: '700', color: '#000', letterSpacing: 0.2 },
  ctaLabelOff: { color: C.textSec },
});
