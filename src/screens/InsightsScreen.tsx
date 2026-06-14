import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useMatches, AnalysisResult } from '../store/MatchContext';
import {
  useLocale, DATE_LOCALE, DRILLS_BY_LOCALE,
  AI_STRENGTHS_BY_LOCALE, AI_IMPROVEMENTS_BY_LOCALE,
  AI_STRENGTH_DETAIL_BY_LOCALE, AI_IMPROVEMENT_DETAIL_BY_LOCALE,
  IMPROVEMENT_DRILLS_BY_LOCALE,
} from '../i18n/LocaleContext';

function deriveMatchKeys(result: AnalysisResult): { strengthKeys: string[]; improvementKeys: string[] } {
  if (result.strengthKeys?.length && result.improvementKeys?.length) {
    return { strengthKeys: result.strengthKeys, improvementKeys: result.improvementKeys };
  }
  const { shots, winners, errorRate, coverage, avgRally } = result;
  const winRate = winners / Math.max(1, shots);
  const rally = parseFloat(avgRally);

  const condS: string[] = [];
  if (errorRate < 15) condS.push('low_errors');
  if (coverage >= 70) condS.push('high_coverage');
  if (winRate >= 0.17) condS.push('high_winners');
  if (rally >= 5.0) condS.push('good_rally');
  const generalS = ['net_control', 'serve_placement', 'consistent_defense', 'court_width', 'base_position', 'smash_execution'];
  const strengthKeys = [...condS, ...generalS.filter(k => !condS.includes(k))].slice(0, result.strengths.length);

  const condI: string[] = [];
  if (errorRate > 22) condI.push('reduce_errors');
  if (coverage < 63) condI.push('improve_coverage');
  if (winRate < 0.12) condI.push('more_winners');
  if (rally < 3.5) condI.push('rally_length');
  const generalI = ['net_approach', 'second_serve', 'opponent_smash', 'diagonal_shots', 'low_ball_reaction', 'serve_pressure'];
  const improvementKeys = [...condI, ...generalI.filter(k => !condI.includes(k))].slice(0, result.improvements.length);

  return { strengthKeys, improvementKeys };
}

const fmtDur = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export default function InsightsScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { matches } = useMatches();
  const { t, locale } = useLocale();
  const drills = DRILLS_BY_LOCALE[locale];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [expandedStrength, setExpandedStrength] = useState<number | null>(null);
  const [expandedImprovement, setExpandedImprovement] = useState<number | null>(null);

  if (matches.length === 0) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('insights.title')}</Text>
        </View>
        <View style={s.emptyWrap}>
          <View style={s.emptyIconRing}>
            <Ionicons name="bulb" size={38} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>{t('insights.noAnalysisTitle')}</Text>
          <Text style={s.emptySub}>{t('insights.noAnalysisSub')}</Text>
          <View style={s.coachFeatures}>
            {[
              { icon: 'analytics-outline', text: t('insights.feature1') },
              { icon: 'school-outline', text: t('insights.feature2') },
              { icon: 'trending-up-outline', text: t('insights.feature3') },
            ].map((f, i) => (
              <View key={i} style={s.featureRow}>
                <View style={[s.featureIcon, { backgroundColor: colors.primaryDim }]}>
                  <Ionicons name={f.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={s.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const safeIdx = Math.min(selectedIdx, matches.length - 1);
  const selected = matches[safeIdx];
  const scoreColor =
    selected.result.score >= 65 ? colors.primary :
    selected.result.score >= 50 ? colors.blue :
    colors.danger;

  const trend =
    safeIdx < matches.length - 1
      ? selected.result.score - matches[safeIdx + 1].result.score
      : 0;

  const sliceLen = Math.min(matches.length, 8);
  const reversedSlice = matches.slice(0, sliceLen).reverse();

  const sessionCount = matches.length === 1
    ? t('stats.sessionRecorded')
    : t('stats.sessionsRecorded', { n: matches.length });

  const strengthMap = AI_STRENGTHS_BY_LOCALE[locale];
  const improvementMap = AI_IMPROVEMENTS_BY_LOCALE[locale];
  const strengthDetailMap = AI_STRENGTH_DETAIL_BY_LOCALE[locale];
  const improvDetailMap = AI_IMPROVEMENT_DETAIL_BY_LOCALE[locale];
  const { strengthKeys: derivedStrengthKeys, improvementKeys: derivedImprovementKeys } = deriveMatchKeys(selected.result);

  // Drills based on improvement keys of selected match (derived so old matches also work)
  const drillMap = IMPROVEMENT_DRILLS_BY_LOCALE[locale];
  const weaknessDrills = derivedImprovementKeys
    .filter(k => Boolean(drillMap[k]))
    .map(k => drillMap[k]);
  const displayDrills = weaknessDrills.length > 0 ? weaknessDrills : drills;
  const drillsAreFromWeakness = weaknessDrills.length > 0;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('insights.title')}</Text>
          <Text style={s.headerSub}>{sessionCount}</Text>
        </View>

        {/* Match Picker */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pickerRow}
        >
          {matches.map((m, i) => {
            const sc =
              m.result.score >= 65 ? colors.primary :
              m.result.score >= 50 ? colors.blue :
              colors.danger;
            const isSel = i === safeIdx;
            const dateStr = new Date(m.date).toLocaleDateString(
              DATE_LOCALE[locale], { day: '2-digit', month: 'short' },
            );
            return (
              <TouchableOpacity
                key={m.id}
                style={[s.pickerCard, isSel && { borderColor: sc, backgroundColor: sc + '18' }]}
                onPress={() => { setSelectedIdx(i); setExpandedStrength(null); setExpandedImprovement(null); }}
                activeOpacity={0.72}
              >
                <Text style={[s.pickerDate, isSel && { color: colors.text }]}>{dateStr}</Text>
                <Text style={[s.pickerScore, { color: sc }]}>{m.result.score}</Text>
                <Text style={s.pickerMeta}>{fmtDur(m.recordSeconds)}</Text>
                {isSel && <View style={[s.pickerDot, { backgroundColor: sc }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Performance Score card */}
        <View style={s.scoreCard}>
          <View style={s.scoreCardClip}>
          <View style={[s.scoreAccent, { backgroundColor: scoreColor }]} />
          <View style={s.scoreCardInner}>
            <View style={s.scoreLeft}>
              <Text style={s.scoreLabel}>{t('insights.performanceScore')}</Text>
              <View style={s.scoreNumRow}>
                <Text style={[s.scoreNum, { color: scoreColor }]}>{selected.result.score}</Text>
                <Text style={s.scoreDenom}>/100</Text>
                {trend !== 0 && (
                  <View style={[s.trendBadge, { backgroundColor: trend > 0 ? colors.primaryDim : colors.dangerDim }]}>
                    <Ionicons
                      name={trend > 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={trend > 0 ? colors.primary : colors.danger}
                    />
                    <Text style={[s.trendText, { color: trend > 0 ? colors.primary : colors.danger }]}>
                      {trend > 0 ? '+' : ''}{trend}
                    </Text>
                  </View>
                )}
              </View>
              <View style={s.scoreBar}>
                <View style={[s.scoreBarFill, { width: `${selected.result.score}%` as any, backgroundColor: scoreColor }]} />
              </View>
              <Text style={s.scoreMeta}>
                {new Date(selected.date).toLocaleDateString(DATE_LOCALE[locale], {
                  weekday: 'short', day: 'numeric', month: 'long',
                })}
                {'  ·  '}{fmtDur(selected.recordSeconds)} {t('analysis.recorded')}
              </Text>
            </View>
            <View style={s.scoreRightCol}>
              <MiniStat label={t('stats.coverage')} value={`${selected.result.coverage}%`} color={colors.blue} labelColor={colors.textSec} />
              <MiniStat label={t('insights.errorRate')} value={`${selected.result.errorRate}%`} color={colors.danger} labelColor={colors.textSec} />
              <MiniStat label={t('analysis.avgRally')} value={selected.result.avgRally} color={colors.purple} labelColor={colors.textSec} />
            </View>
          </View>
          </View>
        </View>

        {/* Stats mini-grid */}
        <View style={s.statsRow}>
          <StatCard label={t('analysis.totalShots')} value={String(selected.result.shots)} color={colors.primary} colors={colors} />
          <StatCard label={t('analysis.winners')} value={String(selected.result.winners)} color={colors.primary} colors={colors} />
          <StatCard label={t('analysis.errors')} value={String(selected.result.errors)} color={colors.danger} colors={colors} />
        </View>

        {/* Strengths — tappable */}
        {selected.result.strengths.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t('insights.strengths')}</Text>
            <View style={s.listCard}>
              {selected.result.strengths.map((item, i) => {
                const key = derivedStrengthKeys[i];
                const label = (key && strengthMap[key]) ? strengthMap[key] : item;
                const detail = key ? strengthDetailMap[key] : null;
                const isOpen = expandedStrength === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.listRow, i > 0 && s.listRowBorder]}
                    onPress={() => setExpandedStrength(isOpen ? null : i)}
                    activeOpacity={detail ? 0.75 : 1}
                  >
                    <View style={[s.listIcon, { backgroundColor: colors.primaryDim }]}>
                      <Ionicons name="checkmark" size={14} color={colors.primary} />
                    </View>
                    <View style={s.listTextWrap}>
                      <Text style={s.listText}>{label}</Text>
                      {isOpen && detail ? (
                        <Text style={[s.listDetail, { color: colors.textSec }]}>{detail}</Text>
                      ) : null}
                      {!isOpen && detail ? (
                        <Text style={[s.listHint, { color: colors.textMuted }]}>{t('insights.tapForDetail')}</Text>
                      ) : null}
                    </View>
                    {detail ? (
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSec} style={{ flexShrink: 0 }} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Improvements — tappable */}
        {selected.result.improvements.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t('insights.improvements')}</Text>
            <View style={s.listCard}>
              {selected.result.improvements.map((item, i) => {
                const key = derivedImprovementKeys[i];
                const label = (key && improvementMap[key])
                  ? improvementMap[key].replace('{errorRate}', String(selected.result.errorRate))
                  : item;
                const detail = key ? improvDetailMap[key] : null;
                const isOpen = expandedImprovement === i;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[s.listRow, i > 0 && s.listRowBorder]}
                    onPress={() => setExpandedImprovement(isOpen ? null : i)}
                    activeOpacity={detail ? 0.75 : 1}
                  >
                    <View style={[s.listIcon, { backgroundColor: colors.warningDim }]}>
                      <Ionicons name="arrow-up" size={14} color={colors.warning} />
                    </View>
                    <View style={s.listTextWrap}>
                      <Text style={s.listText}>{label}</Text>
                      {isOpen && detail ? (
                        <Text style={[s.listDetail, { color: colors.textSec }]}>{detail}</Text>
                      ) : null}
                      {!isOpen && detail ? (
                        <Text style={[s.listHint, { color: colors.textMuted }]}>{t('insights.tapForDetail')}</Text>
                      ) : null}
                    </View>
                    {detail ? (
                      <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSec} style={{ flexShrink: 0 }} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Score Trend (tappable bars, improved) */}
        {matches.length > 1 && (
          <>
            <Text style={s.sectionTitle}>{t('insights.scoreTrend')}</Text>
            <View style={s.trendCard}>
              {/* Grid lines */}
              <View style={[s.trendGrid, { bottom: (75 / 100) * 110 }]} />
              <View style={[s.trendGrid, { bottom: (50 / 100) * 110 }]} />
              <View style={[s.trendGrid, { bottom: (25 / 100) * 110 }]} />
              <View style={s.trendGridLabels}>
                <Text style={s.trendGridLabel}>75</Text>
                <Text style={s.trendGridLabel}>50</Text>
                <Text style={s.trendGridLabel}>25</Text>
              </View>
              <View style={s.trendBarsArea}>
                {reversedSlice.map((m, i) => {
                  const origIdx = sliceLen - 1 - i;
                  const sc =
                    m.result.score >= 65 ? colors.primary :
                    m.result.score >= 50 ? colors.blue :
                    colors.danger;
                  const barH = Math.max(10, (m.result.score / 100) * 110);
                  const isActive = origIdx === safeIdx;
                  const dateStr = new Date(m.date).toLocaleDateString(
                    DATE_LOCALE[locale], { day: '2-digit', month: 'short' },
                  );
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={s.trendBarWrap}
                      onPress={() => { setSelectedIdx(origIdx); setExpandedStrength(null); setExpandedImprovement(null); }}
                      activeOpacity={0.65}
                    >
                      <Text style={[s.trendBarNum, { color: isActive ? sc : sc + '77' }]}>
                        {m.result.score}
                      </Text>
                      <View style={[s.trendBarFill, {
                        height: barH,
                        backgroundColor: isActive ? sc : sc + '40',
                        borderRadius: isActive ? 6 : 4,
                        borderWidth: isActive ? 1 : 0,
                        borderColor: isActive ? sc + 'AA' : 'transparent',
                      }]} />
                      <Text style={[s.trendBarDate, isActive && { color: colors.text, fontWeight: '700' as const }]}>
                        {dateStr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={s.trendHint}>{t('insights.tapBarHint')}</Text>
          </>
        )}

        {/* Train This Week */}
        <Text style={s.sectionTitle}>{t('insights.trainThisWeek')}</Text>
        {drillsAreFromWeakness && (
          <Text style={s.drillsSubtitle}>{t('insights.drillsFromWeakness')}</Text>
        )}
        <View style={s.listCard}>
          {displayDrills.map((drill, i) => (
            <View key={i} style={[s.listRow, i > 0 && s.listRowBorder]}>
              <View style={[s.listIcon, { backgroundColor: colors.primaryDim }]}>
                <Text style={[s.drillNum, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <View style={s.listTextWrap}>
                <Text style={s.listText}>{drill}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MiniStat({ label, value, color, labelColor }: { label: string; value: string; color: string; labelColor: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      <Text style={{ color, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>{value}</Text>
      <Text style={{ color: labelColor, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function StatCard({ label, value, color, colors }: { label: string; value: string; color: string; colors: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center' }}>
      <Text style={{ color, fontSize: 26, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: colors.textSec, fontSize: 11, marginTop: 3, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 16 },

    header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    headerSub: { fontSize: 12, color: colors.primary, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
    headerTitle: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },

    // Match picker
    pickerRow: { paddingHorizontal: 16, paddingBottom: 16, gap: 8, flexDirection: 'row' },
    pickerCard: {
      width: 80, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8,
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1.5, borderColor: colors.border,
    },
    pickerDate: { color: colors.textSec, fontSize: 10, fontWeight: '600', marginBottom: 4 },
    pickerScore: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    pickerMeta: { color: colors.textSec, fontSize: 10, marginTop: 3 },
    pickerDot: { width: 5, height: 5, borderRadius: 3, marginTop: 5 },

    // Score card
    scoreCard: {
      marginHorizontal: 16, marginBottom: 4,
      backgroundColor: colors.card, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    scoreCardClip: { borderRadius: 19, overflow: 'hidden', flexDirection: 'row' },
    scoreAccent: { width: 4 },
    scoreCardInner: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    scoreLeft: { flex: 1 },
    scoreLabel: { color: colors.textSec, fontSize: 12, fontWeight: '600', marginBottom: 6 },
    scoreNumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 10 },
    scoreNum: { fontSize: 56, fontWeight: '900', lineHeight: 62, letterSpacing: -2 },
    scoreDenom: { color: colors.textSec, fontSize: 20, fontWeight: '600', marginBottom: 6 },
    trendBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4,
    },
    trendText: { fontSize: 12, fontWeight: '700' },
    scoreBar: { height: 5, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
    scoreBarFill: { height: 5, borderRadius: 3 },
    scoreMeta: { color: colors.textSec, fontSize: 11, marginTop: 8 },
    scoreRightCol: { gap: 18, alignItems: 'center' },

    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: colors.textSec,
      marginLeft: 20, marginTop: 20, marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: 1,
    },

    // Strength/improvement list
    listCard: {
      marginHorizontal: 16, backgroundColor: colors.card,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    },
    listRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 12 },
    listRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    listIcon: { width: 30, height: 30, borderRadius: 9, justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
    listTextWrap: { flex: 1 },
    listText: { color: colors.text, fontSize: 14, lineHeight: 20 },
    listDetail: { fontSize: 13, lineHeight: 19, marginTop: 6 },
    listHint: { fontSize: 11, marginTop: 3, fontStyle: 'italic' },
    drillNum: { fontSize: 13, fontWeight: '800' },
    drillsSubtitle: { color: colors.primary, fontSize: 12, fontWeight: '600', marginLeft: 20, marginTop: -4, marginBottom: 6 },

    // Stats mini-grid
    statsRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginTop: 4 },

    // Score trend — improved chart
    trendCard: {
      marginHorizontal: 16, backgroundColor: colors.card,
      borderRadius: 16, borderWidth: 1, borderColor: colors.border,
      paddingTop: 16, paddingHorizontal: 8, paddingBottom: 8,
      flexDirection: 'row',
      height: 190,
      position: 'relative',
    },
    trendGrid: {
      position: 'absolute', left: 36, right: 8,
      height: 1, backgroundColor: colors.border, opacity: 0.6,
    },
    trendGridLabels: {
      position: 'absolute', left: 8, top: 0, bottom: 28,
      justifyContent: 'space-between', paddingTop: 16, paddingBottom: 4,
    },
    trendGridLabel: { color: colors.textSec, fontSize: 9, fontWeight: '600' },
    trendBarsArea: {
      flex: 1, flexDirection: 'row', alignItems: 'flex-end',
      justifyContent: 'space-around', paddingLeft: 28, paddingBottom: 24,
    },
    trendBarWrap: { alignItems: 'center', gap: 4, flex: 1 },
    trendBarNum: { fontSize: 10, fontWeight: '700' },
    trendBarFill: { width: 22 },
    trendBarDate: { color: colors.textSec, fontSize: 9, textAlign: 'center' },
    trendHint: {
      color: colors.textSec, fontSize: 11, textAlign: 'center',
      marginTop: 8, marginHorizontal: 16,
    },

    // Empty state
    emptyWrap: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 20 },
    emptyIconRing: {
      width: 96, height: 96, borderRadius: 48,
      backgroundColor: colors.primaryDim,
      justifyContent: 'center', alignItems: 'center',
      marginBottom: 22, borderWidth: 1, borderColor: colors.primary + '44',
    },
    emptyTitle: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
    emptySub: { fontSize: 15, color: colors.textSec, textAlign: 'center', lineHeight: 23, marginBottom: 28 },
    coachFeatures: { width: '100%', gap: 10 },
    featureRow: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: colors.card, borderRadius: 14, padding: 16,
      borderWidth: 1, borderColor: colors.border,
    },
    featureIcon: { width: 42, height: 42, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
    featureText: { flex: 1, color: colors.textSec, fontSize: 14 },
  });
}
