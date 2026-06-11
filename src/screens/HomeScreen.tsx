import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Share, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeContext';
import { useMatches, StoredMatch } from '../store/MatchContext';
import { useLocale, LEVEL_NAMES, DATE_LOCALE } from '../i18n/LocaleContext';
import { AnimatedFlame, getLevel, getVisualTier, getLevelNext, getLevelPrev, TIER_BG, TIER_BORDER, TIER_CLRD, TIER_CLRL } from '../components/AnimatedFlame';

type NavProps = { navigation: any };

const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const fmtDate = (iso: string, dateLocale: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' });
};

export default function HomeScreen({ navigation }: NavProps) {
  const { colors, theme } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { matches } = useMatches();
  const { t, locale } = useLocale();
  const hasMatches = matches.length > 0;

  const handleShare = async () => {
    try {
      await Share.share({ message: t('home.shareMsg') });
    } catch {}
  };

  const totalHours = parseFloat((matches.reduce((a, m) => a + m.recordSeconds, 0) / 3600).toFixed(1));
  const avgScore = hasMatches
    ? Math.round(matches.reduce((a, m) => a + m.result.score, 0) / matches.length)
    : 0;
  const totalShots = matches.reduce((a, m) => a + m.result.shots, 0);
  const totalWinners = matches.reduce((a, m) => a + m.result.winners, 0);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerEyebrow}>
              {new Date().toLocaleDateString(DATE_LOCALE[locale], { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
            <Text style={s.headerTitle}>{t('home.title')}</Text>
          </View>
          <TouchableOpacity onPress={handleShare} activeOpacity={0.7} style={s.shareBtn}>
            <Ionicons name="share-outline" size={21} color={colors.text} />
          </TouchableOpacity>
        </View>

        <FlameStreakCard matchCount={matches.length} colors={colors} isDark={theme === 'dark'} levelNames={LEVEL_NAMES[locale]} sessionsToLevel={t('home.sessionsToLevel')} />

        {hasMatches ? (
          <>
            {/* Summary row */}
            <View style={s.statsRow}>
              <SummaryCard icon="tennisball-outline" label={t('home.shots')} value={totalShots.toString()} color={colors.primary} colors={colors} s={s} />
              <SummaryCard icon="stats-chart-outline" label={t('home.avgScore')} value={avgScore.toString()} color={colors.blue} colors={colors} s={s} />
              <SummaryCard icon="time-outline" label={t('home.hours')} value={`${totalHours}h`} color={colors.purple} colors={colors} s={s} />
              <SummaryCard icon="trophy-outline" label={t('home.winners')} value={totalWinners.toString()} color={colors.warning} colors={colors} s={s} />
            </View>

            {/* Session feed */}
            <Text style={s.sectionLabel}>{t('home.recentSessions')}</Text>
            {matches.map((m, i) => (
              <SessionCard
                key={m.id}
                match={m}
                index={i}
                total={matches.length}
                navigation={navigation}
                colors={colors}
                s={s}
                dateLocale={DATE_LOCALE[locale]}
                sessionLabel={t('home.sessionLabel')}
                onPlay={uri => navigation.navigate('VideoPlayer', { uri })}
              />
            ))}
          </>
        ) : (
          /* Empty state */
          <View style={s.emptyWrap}>
            <View style={s.emptyIconRing}>
              <Ionicons name="videocam" size={40} color={colors.primary} />
            </View>
            <Text style={s.emptyTitle}>{t('home.noSessionsTitle')}</Text>
            <Text style={s.emptySub}>{t('home.noSessionsSub')}</Text>
            <TouchableOpacity
              style={s.emptyBtnWrap}
              onPress={() => navigation.navigate('Analysis', { startRecord: true })}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#FF6B5E', '#EF4444']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.emptyBtn}
              >
                <Ionicons name="radio-button-on" size={18} color="#fff" />
                <Text style={s.emptyBtnText}>{t('home.recordFirst')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <View style={s.featureGrid}>
              {[
                { icon: 'analytics-outline', title: t('home.featureAI'), desc: t('home.featureAIDesc') },
                { icon: 'map-outline', title: t('home.featureHeatmap'), desc: t('home.featureHeatmapDesc') },
                { icon: 'trending-up-outline', title: t('home.featureProgress'), desc: t('home.featureProgressDesc') },
              ].map((f, i) => (
                <View key={i} style={s.featureCard}>
                  <View style={[s.featureIcon, { backgroundColor: colors.primaryDim }]}>
                    <Ionicons name={f.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.featureTitle}>{f.title}</Text>
                    <Text style={s.featureDesc}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionCard({ match, index, total, navigation, colors, s, dateLocale, sessionLabel, onPlay }: {
  match: StoredMatch; index: number; total: number; navigation: any; colors: any; s: any; dateLocale: string; sessionLabel: string; onPlay: (uri: string) => void;
}) {
  const scoreColor = match.result.score >= 65 ? colors.primary : match.result.score >= 50 ? colors.blue : colors.danger;

  return (
    <TouchableOpacity
      style={s.sessionCard}
      onPress={() => match.videoUri ? onPlay(match.videoUri) : navigation.navigate('Analysis')}
      activeOpacity={0.8}
    >
      {/* Video thumbnail */}
      <View style={s.sessionThumb}>
        {match.thumbnailUri ? (
          <Image source={{ uri: match.thumbnailUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={StyleSheet.absoluteFillObject}>
            <View style={s.courtCenterLine} />
            <View style={s.courtNetLine} />
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
        <View style={s.playBtn}>
          <Ionicons name="play" size={13} color="#fff" />
        </View>
      </View>

      {/* Session info */}
      <View style={s.sessionBody}>
        <View style={s.sessionHeader}>
          <Text style={s.sessionTitle}>{sessionLabel} {total - index}</Text>
          <View style={[s.scorePill, { backgroundColor: scoreColor + '22' }]}>
            <Text style={[s.scorePillText, { color: scoreColor }]}>{match.result.score}</Text>
          </View>
        </View>
        <Text style={s.sessionDate}>{fmtDate(match.date, dateLocale)} · {fmtTime(match.recordSeconds)}</Text>
        <View style={s.chips}>
          <Chip icon="tennisball-outline" label={`${match.result.shots}`} color={colors.textSec} />
          <Chip icon="trophy-outline" label={`${match.result.winners} W`} color={colors.primary} />
          <Chip icon="close-circle-outline" label={`${match.result.errors} F`} color={colors.danger} />
          <Chip icon="body-outline" label={`${match.result.coverage}%`} color={colors.blue} />
        </View>
      </View>

      <Ionicons name="chevron-forward" size={15} color={colors.textMuted} style={{ marginRight: 12 }} />
    </TouchableOpacity>
  );
}

function SummaryCard({ icon, label, value, color, colors, s }: any) {
  return (
    <View style={s.summaryCard}>
      <View style={[s.summaryIcon, { backgroundColor: color + '16' }]}>
        <Ionicons name={icon as any} size={14} color={color} />
      </View>
      <Text style={[s.summaryValue, { color }]}>{value}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
    </View>
  );
}

function Chip({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Ionicons name={icon as any} size={11} color={color} />
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function FlameStreakCard({ matchCount, colors, isDark, levelNames, sessionsToLevel }: { matchCount: number; colors: any; isDark: boolean; levelNames: string[]; sessionsToLevel: string }) {
  const level  = getLevel(matchCount);
  const tier   = getVisualTier(level);
  const t      = Math.min(tier, 7);
  const lColor = (isDark ? TIER_CLRD : TIER_CLRL)[t];
  const nextT  = getLevelNext(level);
  const prevT  = getLevelPrev(level);
  const prog   = Math.min(1, (matchCount - prevT) / (nextT - prevT));
  const label  = level < levelNames.length ? levelNames[level] : `Level ${level}`;

  return (
    <View style={{
      marginHorizontal: 16, marginBottom: 16,
      backgroundColor: TIER_BG[t], borderRadius: 20,
      borderWidth: 1.5, borderColor: TIER_BORDER[t],
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 12, paddingHorizontal: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
    }}>
      <AnimatedFlame tier={tier} isDark={isDark} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text style={{ fontSize: 30, fontWeight: '900', color: lColor, letterSpacing: -1 }}>{matchCount}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: lColor + 'CC' }}>Sessions</Text>
        </View>
        <Text style={{ fontSize: 10, fontWeight: '800', color: lColor, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 }}>
          {label}
        </Text>
        <View style={{ marginTop: 8, gap: 3 }}>
          <View style={{ height: 4, backgroundColor: 'rgba(128,128,128,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: 4, width: `${Math.round(prog * 100)}%` as any, backgroundColor: lColor, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 10, fontWeight: '600', color: lColor + 'AA' }}>
            {nextT - matchCount} {sessionsToLevel} {level + 1}
          </Text>
        </View>
      </View>
    </View>
  );
}


function createStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 16 },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18,
    },
    headerEyebrow: {
      fontSize: 11, fontWeight: '700', color: colors.textSec,
      textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 3,
    },
    headerTitle: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },
    shareBtn: {
      width: 40, height: 40, borderRadius: 12,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
      justifyContent: 'center', alignItems: 'center',
    },

    statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 24 },
    summaryCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 6,
      alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border,
    },
    summaryIcon: {
      width: 28, height: 28, borderRadius: 9,
      justifyContent: 'center', alignItems: 'center',
    },
    summaryValue: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
    summaryLabel: { color: colors.textSec, fontSize: 10, fontWeight: '600' },

    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: colors.textSec,
      marginLeft: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1,
    },

    sessionCard: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 16, marginBottom: 10,
      backgroundColor: colors.card, borderRadius: 18,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    sessionThumb: {
      width: 96, height: 76,
      backgroundColor: '#0A2014',
      justifyContent: 'center', alignItems: 'center',
      borderTopLeftRadius: 17, borderBottomLeftRadius: 17,
      overflow: 'hidden',
    },
    courtCenterLine: {
      position: 'absolute', top: 0, bottom: 0, left: '50%',
      width: 1, backgroundColor: 'rgba(255,255,255,0.18)',
    },
    courtNetLine: {
      position: 'absolute', top: '50%', left: 0, right: 0,
      height: 1, backgroundColor: 'rgba(255,255,255,0.32)',
    },
    playBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center', alignItems: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
      paddingLeft: 2,
    },

    sessionBody: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 5 },
    sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionTitle: { color: colors.text, fontWeight: '700', fontSize: 15 },
    scorePill: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3 },
    scorePillText: { fontSize: 14, fontWeight: '800' },
    sessionDate: { color: colors.textSec, fontSize: 12 },
    chips: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },

    // Empty state
    emptyWrap: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },
    emptyIconRing: {
      width: 100, height: 100, borderRadius: 50,
      backgroundColor: colors.primaryDim,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 22, borderWidth: 1, borderColor: colors.primary + '44',
    },
    emptyTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
    emptySub: { fontSize: 15, color: colors.textSec, textAlign: 'center', lineHeight: 23, marginBottom: 28 },
    emptyBtnWrap: {
      borderRadius: 18, marginBottom: 36,
      shadowColor: '#EF4444', shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
    },
    emptyBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 18, paddingHorizontal: 32, paddingVertical: 18,
    },
    emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
    featureGrid: { width: '100%', gap: 10 },
    featureCard: {
      backgroundColor: colors.card, borderRadius: 16,
      padding: 16, borderWidth: 1, borderColor: colors.border,
      flexDirection: 'row', alignItems: 'center', gap: 14,
    },
    featureIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    featureTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 3 },
    featureDesc: { color: colors.textSec, fontSize: 13 },
  });
}
