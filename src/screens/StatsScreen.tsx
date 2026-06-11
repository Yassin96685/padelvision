import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useMatches, StoredMatch } from '../store/MatchContext';
import { useLocale, DAY_LABELS, POSITIONS_BY_LOCALE } from '../i18n/LocaleContext';
import { AnimatedFlame } from '../components/AnimatedFlame';

const { width } = Dimensions.get('window');

function getWeekKey(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return (
    d.getFullYear() * 100 +
    Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  );
}

function calcStreak(matches: StoredMatch[]): number {
  if (matches.length === 0) return 0;
  const weeks = new Set(matches.map((m) => getWeekKey(new Date(m.date))));
  let streak = 0;
  const check = new Date();
  while (weeks.has(getWeekKey(check))) {
    streak++;
    check.setDate(check.getDate() - 7);
  }
  return streak;
}

function getWeekDays(weekOffset: number = 0): Date[] {
  const now = new Date();
  const day = now.getDay() || 7;
  const mon = new Date(now);
  mon.setDate(now.getDate() - (day - 1) + weekOffset * 7);
  mon.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function fmtWeekRange(weekDays: Date[]): string {
  const s = weekDays[0];
  const e = weekDays[6];
  return `${s.getDate()}.${s.getMonth() + 1}. – ${e.getDate()}.${e.getMonth() + 1}.`;
}

// shot name → translation key
const SHOT_KEY_MAP: Record<string, string> = {
  Smash: 'shot.smash',
  Serve: 'shot.serve',
  Bandeja: 'shot.bandeja',
  Forehand: 'shot.forehand',
  Vibora: 'shot.vibora',
  Backhand: 'shot.backhand',
  Lob: 'shot.lob',
};

type ShotStat = { name: string; success: number; attempts: number; color: string };

type ShotConfig = { name: string; color: string; ratio: number; getDelta: (wb: number) => number };
const SHOT_CONFIGS: ShotConfig[] = [
  { name: 'Smash',    color: '#FFA502', ratio: 0.10, getDelta: (wb) => wb * 0.8 + 6 },
  { name: 'Serve',    color: '#00D97E', ratio: 0.15, getDelta: () => 9 },
  { name: 'Bandeja',  color: '#8B5CF6', ratio: 0.08, getDelta: (wb) => wb * 0.5 + 2 },
  { name: 'Forehand', color: '#3D8EF5', ratio: 0.28, getDelta: (wb) => wb * 0.35 },
  { name: 'Vibora',   color: '#EC4899', ratio: 0.06, getDelta: (wb) => wb * 0.6 + 1 },
  { name: 'Backhand', color: '#06B6D4', ratio: 0.21, getDelta: () => -4 },
  { name: 'Lob',      color: '#F97316', ratio: 0.12, getDelta: () => -8 },
];

function deriveShotStats(matches: StoredMatch[]): ShotStat[] {
  const n = matches.length;
  const totalShots = matches.reduce((a, m) => a + m.result.shots, 0);
  const avgErrorRate = n > 0 ? matches.reduce((a, m) => a + m.result.errorRate, 0) / n : 18;
  const avgWinners  = n > 0 ? matches.reduce((a, m) => a + m.result.winners, 0) / n : 14;
  const avgShots    = n > 0 ? totalShots / n : 80;

  const winnerRate = (avgWinners / Math.max(1, avgShots)) * 100;
  const base = Math.round(100 - avgErrorRate * 0.55);
  const wb   = Math.round(winnerRate * 1.4);
  const effectiveTotal = totalShots > 0 ? totalShots : 230;

  return SHOT_CONFIGS.map(c => ({
    name: c.name,
    color: c.color,
    success: Math.min(96, Math.max(40, Math.round(base + c.getDelta(wb)))),
    attempts: Math.round(effectiveTotal * c.ratio),
  }));
}

export default function StatsScreen({ navigation }: { navigation: any }) {
  const { colors, theme } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { matches } = useMatches();
  const { t, locale } = useLocale();
  const dayLabels = DAY_LABELS[locale];
  const positions = POSITIONS_BY_LOCALE[locale];
  const hasMatches = matches.length > 0;
  const [tab, setTab] = useState(0);
  const [expandedShot, setExpandedShot] = useState<string | null>(null);
  const [selectedHeatMatchId, setSelectedHeatMatchId] = useState<string | null>(null);

  const TABS = useMemo(() => [
    t('stats.tabShots'),
    t('stats.tabHeatmap'),
    t('stats.tabPositioning'),
  ], [locale]);

  const computedShotStats = useMemo(() => deriveShotStats(matches), [matches]);

  const avgSuccess = Math.round(computedShotStats.reduce((a, b) => a + b.success, 0) / computedShotStats.length);
  const totalShotsCount = computedShotStats.reduce((a, b) => a + b.attempts, 0);
  const bestShot = Math.max(...computedShotStats.map((s2) => s2.success));

  const latestMatch = matches.length > 0 ? matches[0] : null;

  const selectedHeatMatch = useMemo(() => {
    if (!selectedHeatMatchId) return latestMatch;
    return matches.find(m => m.id === selectedHeatMatchId) ?? latestMatch;
  }, [selectedHeatMatchId, matches]);

  const matchHeatmap = useMemo(() => {
    const m = selectedHeatMatch;
    if (m) {
      const { coverage, errorRate, winners, shots, zones } = m.result;
      return buildHeatmapFromMatch(coverage, errorRate, winners, shots, zones, m.playerPosition);
    }
    return buildHeatmapFromMatch(63, 18, 14, 80);
  }, [selectedHeatMatch?.id]);

  const heatStatValues = useMemo(() => {
    const m = selectedHeatMatch;
    if (!m) return { coveragePct: '63%', range: '7.9m', avgSpeed: '5.1 km/h' };
    const { coverage, shots } = m.result;
    const secs = m.recordSeconds;
    const movesPerSec = shots / Math.max(1, secs);
    const speed = Math.min(8.5, Math.max(3.5, 3.0 + movesPerSec * 120 + coverage * 0.02));
    return {
      coveragePct: `${Math.round(coverage)}%`,
      range: `${(5.5 + coverage * 0.038).toFixed(1)}m`,
      avgSpeed: `${speed.toFixed(1)} km/h`,
    };
  }, [selectedHeatMatch?.id]);

  const zonePercents = useMemo<[number, number, number, number]>(() => {
    if (matches.length === 0) return [38, 28, 22, 12];
    const avgCoverage = matches.reduce((a, m) => a + m.result.coverage, 0) / matches.length;
    const netTotal = Math.round(20 + avgCoverage * 0.46);
    const netL  = Math.round(netTotal * 0.58);
    const netR  = netTotal - netL;
    const backL = Math.round((100 - netTotal) * 0.65);
    const backR = 100 - netTotal - backL;
    return [netL, netR, backL, backR];
  }, [matches]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>{t('stats.title')}</Text>
        <Text style={s.sub}>
          {hasMatches
            ? matches.length === 1
              ? t('stats.sessionRecorded')
              : t('stats.sessionsRecorded', { n: matches.length })
            : t('stats.noData')}
        </Text>
      </View>

      {!hasMatches ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIconRing}>
            <Ionicons name="stats-chart" size={36} color={colors.primary} />
          </View>
          <Text style={s.emptyTitle}>{t('stats.noStatsTitle')}</Text>
          <Text style={s.emptySub}>{t('stats.noStatsSub')}</Text>
          <View style={s.emptyFeatures}>
            {[
              { icon: 'tennisball-outline', text: t('stats.noFeature1') },
              { icon: 'map-outline', text: t('stats.noFeature2') },
              { icon: 'body-outline', text: t('stats.noFeature3') },
            ].map((f, i) => (
              <View key={i} style={s.emptyFeatureRow}>
                <Ionicons name={f.icon as any} size={16} color={colors.primary} />
                <Text style={s.emptyFeatureText}>{f.text}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <>
          <StreakCard matches={matches} colors={colors} s={s} dayLabels={dayLabels} t={t} isDark={theme === 'dark'} />

          <View style={s.tabs}>
            {TABS.map((label, i) => (
              <TouchableOpacity key={i} style={[s.tab, tab === i && s.tabActive]} onPress={() => setTab(i)}>
                <Text style={[s.tabText, tab === i && s.tabTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
            {/* ── Shots Tab ── */}
            {tab === 0 && (
              <View>
                <View style={s.overviewRow}>
                  <OvCard value={`${avgSuccess}%`} label={t('stats.avgSuccess')} color={colors.primary} s={s} />
                  <OvCard value={`${totalShotsCount}`} label={t('stats.totalShotsCount')} color={colors.blue} s={s} />
                  <OvCard value={`${bestShot}%`} label={t('stats.bestShot')} color={colors.primary} s={s} />
                </View>
                <Text style={s.sectionTitle}>{t('stats.shotOverview')}</Text>
                {computedShotStats.map((shot) => {
                  const made = Math.round((shot.attempts * shot.success) / 100);
                  const expanded = expandedShot === shot.name;
                  const shotName = t(SHOT_KEY_MAP[shot.name] ?? shot.name);
                  return (
                    <TouchableOpacity
                      key={shot.name}
                      style={s.shotCard}
                      onPress={() => setExpandedShot(expanded ? null : shot.name)}
                      activeOpacity={0.8}
                    >
                      <View style={s.shotCardTop}>
                        <View style={{ flex: 1 }}>
                          <View style={s.shotCardRow}>
                            <Text style={s.shotCardName}>{shotName}</Text>
                            <View style={s.shotCardRight}>
                              <Text style={[s.shotCardPct, { color: colors.primary }]}>{shot.success}%</Text>
                              <Ionicons
                                name={expanded ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color={colors.textSec}
                              />
                            </View>
                          </View>
                          <View style={s.shotTrack}>
                            <View
                              style={[s.shotFill, { width: `${shot.success}%` as any, backgroundColor: colors.primary }]}
                            />
                          </View>
                        </View>
                      </View>
                      {expanded && (
                        <View style={s.shotDetail}>
                          <View style={s.shotDetailRow}>
                            <DetailStat label={t('stats.made')} value={`${made}`} color={colors.primary} labelColor={colors.textSec} />
                            <DetailStat label={t('stats.missed')} value={`${shot.attempts - made}`} color={colors.danger} labelColor={colors.textSec} />
                            <DetailStat label={t('stats.total')} value={`${shot.attempts}`} color={colors.textSec} labelColor={colors.textSec} />
                            <DetailStat label={t('stats.rate')} value={`${shot.success}%`} color={colors.primary} labelColor={colors.textSec} />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Heatmap Tab ── */}
            {tab === 1 && (
              <View>
                {/* Match selector */}
                <MatchSelector
                  matches={matches}
                  selectedId={selectedHeatMatchId ?? latestMatch?.id ?? null}
                  onSelect={setSelectedHeatMatchId}
                  colors={colors}
                />

                {/* Title */}
                <Text style={s.sectionTitle}>{t('stats.heatmapTitle')}</Text>

                {/* Heatmap */}
                <HeatmapCourt s={s} width={width} colors={colors} matchHeatmap={matchHeatmap} playerPosition={selectedHeatMatch?.playerPosition} />

                {/* Color legend */}
                <View style={s.heatLegend}>
                  <Text style={s.heatLegendLabel}>{t('stats.heatLow')}</Text>
                  <View style={s.heatLegendBar}>
                    {Array.from({ length: 20 }, (_, i) => (
                      <View key={i} style={[s.heatLegendCell, { backgroundColor: heatColor(0.05 + (i / 19) * 0.95) }]} />
                    ))}
                  </View>
                  <Text style={s.heatLegendLabel}>{t('stats.heatHigh')}</Text>
                </View>

                {/* Explanation card */}
                <View style={[s.heatExplainCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                  <Text style={[s.heatExplainText, { color: colors.textSec }]}>{t('stats.heatmapExplain')}</Text>
                </View>

                {/* Stats */}
                <View style={s.heatStats}>
                  <HeatStat icon="footsteps" label={t('stats.mostActive')} value={t('stats.heatNetLeft')} colors={colors} s={s} />
                  <HeatStat icon="resize" label={t('stats.coverage')} value={heatStatValues.coveragePct} colors={colors} s={s} color={colors.blue} />
                  <HeatStat icon="swap-horizontal" label={t('stats.range')} value={heatStatValues.range} colors={colors} s={s} color={colors.blue} />
                  <HeatStat icon="speedometer" label={t('stats.avgSpeed')} value={heatStatValues.avgSpeed} colors={colors} s={s} />
                </View>
              </View>
            )}

            {/* ── Positioning Tab ── */}
            {tab === 2 && (
              <View>
                <Text style={s.sectionTitle}>{t('stats.timePerZone')}</Text>
                {positions.map((p) => (
                  <View key={p.label} style={s.posCard}>
                    <View style={s.posRow}>
                      <Text style={s.posLabel}>{p.label}</Text>
                      <Text style={[s.posPct, { color: colors.primary }]}>{p.pct}%</Text>
                    </View>
                    <View style={s.posTrack}>
                      <View style={[s.posFill, { width: `${p.pct}%` as any, backgroundColor: colors.primary }]} />
                    </View>
                  </View>
                ))}
                <Text style={[s.sectionTitle, { marginTop: 20 }]}>{t('stats.courtZones')}</Text>
                <CourtDiagram s={s} colors={colors} width={width} zonePercents={zonePercents} />
                <View style={s.insight}>
                  <Ionicons name="information-circle" size={16} color={colors.primary} />
                  <Text style={[s.insightText, { color: colors.textSec }]}>{t('stats.insightText')}</Text>
                </View>
              </View>
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const WEEK_COUNT = 12;
const PAGE_W = width - 32 - 36 - 2; // card margins(32) + padding(36) + border(2)

function StreakCard({ matches, colors, s, dayLabels, t, isDark }: { matches: StoredMatch[]; colors: any; s: any; dayLabels: string[]; t: (key: string, args?: any) => string; isDark: boolean }) {
  const streak = calcStreak(matches);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scrollRef = useRef<ScrollView>(null);
  const hasScrolled = useRef(false);

  const matchDates = useMemo(() => new Set(
    matches.map((m) => {
      const d = new Date(m.date);
      d.setHours(0, 0, 0, 0);
      return d.toDateString();
    })
  ), [matches]);

  // Generate WEEK_COUNT weeks oldest → newest (offset from -(WEEK_COUNT-1) to 0)
  const allWeeks = useMemo(() =>
    Array.from({ length: WEEK_COUNT }, (_, i) => getWeekDays(i - (WEEK_COUNT - 1))),
  []);

  const streakSub =
    streak === 0
      ? t('stats.startThisWeek')
      : streak === 1
      ? t('stats.activeThisWeek')
      : `${streak} ${t('stats.weeksInRow')}`;

  const flameTier = Math.min(streak, 7);

  return (
    <View style={s.streakCard}>
      <View style={s.streakTop}>
        <View style={s.streakLeft}>
          <Text style={s.streakNum}>{streak}</Text>
          <View>
            <Text style={s.streakLabel}>{t('stats.weekStreak')}</Text>
            <Text style={s.streakSub}>{streakSub}</Text>
          </View>
        </View>
        <AnimatedFlame tier={flameTier} isDark={isDark} />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => {
          if (!hasScrolled.current) {
            hasScrolled.current = true;
            scrollRef.current?.scrollToEnd({ animated: false });
          }
        }}
      >
        {allWeeks.map((weekDays, wi) => {
          const isCurrentWeek = wi === WEEK_COUNT - 1;
          return (
            <View key={wi} style={{ width: PAGE_W }}>
              <Text style={[s.weekRangeLabel, isCurrentWeek && { color: colors.primary }]}>
                {isCurrentWeek ? t('stats.thisWeek') : fmtWeekRange(weekDays)}
              </Text>
              <View style={s.weekRow}>
                {weekDays.map((d, i) => {
                  const hasMatch = matchDates.has(d.toDateString());
                  const isToday = d.toDateString() === today.toDateString();
                  const isPast = d <= today;
                  return (
                    <View key={i} style={s.dayWrap}>
                      <Text style={[s.dayLabel, isToday && { color: colors.text, fontWeight: '700' }]}>
                        {dayLabels[i]}
                      </Text>
                      <View
                        style={[
                          s.dayDot,
                          hasMatch && { backgroundColor: colors.primary },
                          isToday && !hasMatch && { borderColor: colors.primary, borderWidth: 1.5 },
                          !isPast && !hasMatch && { opacity: 0.25 },
                        ]}
                      >
                        {hasMatch && <Ionicons name="checkmark" size={11} color="#fff" />}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function heatColor(v: number): string {
  if (v < 0.12) return 'transparent';
  // Orange → red only
  const stops: [number, [number, number, number]][] = [
    [0.00, [255, 140,   0]],
    [0.50, [255,  60,   0]],
    [1.00, [200,  10,   0]],
  ];
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const f = (v - t0) / (t1 - t0);
  const r = Math.round(c0[0] + f * (c1[0] - c0[0]));
  const g = Math.round(c0[1] + f * (c1[1] - c0[1]));
  const b = Math.round(c0[2] + f * (c1[2] - c0[2]));
  const a = Math.min(0.88, 0.30 + v * 0.58);
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

function seededRng(seed: number, n: number): number {
  const x = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

type ZoneData = { net: number; mid: number; back: number; left: number; right: number };

// Normalized (row 0-1, col 0-1) — player is on BOTTOM half (0.5-1.0), net at 0.5
const POSITION_CENTER: Record<string, [number, number]> = {
  'left-net':   [0.58, 0.25],
  'right-net':  [0.58, 0.75],
  'left-back':  [0.85, 0.25],
  'right-back': [0.85, 0.75],
};

function buildHeatmapFromMatch(
  coverage: number, errorRate: number, winners: number, shots: number,
  zones?: ZoneData,
  playerPosition?: string,
): number[][] {
  const ROWS = 32, COLS = 20;
  const center: [number, number] = playerPosition
    ? POSITION_CENTER[playerPosition] ?? [0.85, 0.75]
    : [0.85, 0.75];

  const seed = coverage * 3 + errorRate * 7 + winners;
  const spread = Math.max(0.25, Math.min(0.8, coverage / 100));

  let rawWeights: number[][];

  if (zones) {
    // Zone data: weight rows in player's half (bottom) by zone proportions
    const half = ROWS / 2;
    const rowWeight = (r: number) => {
      if (r < half) return 0.015;           // opponent's half — near zero
      const br = r - half;                  // 0 = net side, ROWS/2-1 = back wall
      if (br <= 4)  return zones.net;
      if (br <= 9)  return zones.mid;
      return zones.back;
    };
    const colWeight = (c: number) => c < COLS / 2 ? zones.left : zones.right;

    rawWeights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        let w = rowWeight(r) * colWeight(c);
        const dist = Math.sqrt(((r / (ROWS - 1)) - center[0]) ** 2 + ((c / (COLS - 1)) - center[1]) ** 2);
        w *= Math.exp(-dist * dist / 0.05);
        return w;
      })
    );
  } else {
    // Fallback: gaussian hotspot at player's selected position
    const h2r = Math.max(0.52, Math.min(0.97, center[0] + (seededRng(seed, 1) - 0.5) * 0.18 * spread));
    const h2c = Math.max(0.05, Math.min(0.95, center[1] + (seededRng(seed, 2) - 0.5) * 0.25 * spread));
    const netCol = Math.max(0.05, Math.min(0.95, center[1] + (seededRng(seed, 3) - 0.5) * 0.10));

    rawWeights = Array.from({ length: ROWS }, (_, r) =>
      Array.from({ length: COLS }, (_, c) => {
        const rn = r / (ROWS - 1), cn = c / (COLS - 1);

        const d1 = Math.sqrt((rn - center[0]) ** 2 + ((cn - center[1]) * 1.3) ** 2);
        let val = Math.exp(-d1 * d1 / (0.008 + spread * 0.010));

        const d2 = Math.sqrt((rn - h2r) ** 2 + ((cn - h2c) * 1.3) ** 2);
        val += 0.60 * Math.exp(-d2 * d2 / (0.007 + spread * 0.009));

        // Occasional net approach trace
        const dNet = Math.sqrt((rn - 0.54) ** 2 + ((cn - netCol) * 1.5) ** 2);
        val += (0.10 + spread * 0.12) * Math.exp(-dNet * dNet / 0.006);

        // Suppress opponent's half strongly
        if (rn < 0.5) val *= 0.04;

        val += (seededRng(seed, r * 20 + c) - 0.5) * 0.05;
        return Math.max(0, val);
      })
    );
  }

  // Gaussian blur
  const blurred = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => {
      let sum = 0, wt = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
        const w = Math.exp(-(dr * dr + dc * dc) / 1.2);
        sum += rawWeights[nr][nc] * w;
        wt += w;
      }
      return sum / wt;
    })
  );

  const max = Math.max(...blurred.flat(), 0.001);
  return blurred.map(row => row.map(v => Math.max(0, Math.min(1, v / max))));
}

function HeatmapCourt({ s, width: w, colors, matchHeatmap, playerPosition }: {
  s: any; width: number; colors: any; matchHeatmap: number[][]; playerPosition?: string;
}) {
  const cw = w - 32;
  const courtH = cw * 1.55;

  const ROWS = matchHeatmap.length;
  const COLS = matchHeatmap[0].length;
  const cellW = cw / COLS;
  const cellH = courtH / ROWS;

  const LINE     = 'rgba(255,255,255,0.45)';
  const LINE_DIM = 'rgba(255,255,255,0.18)';

  const dotCenter = playerPosition ? POSITION_CENTER[playerPosition] : null;

  return (
    <View style={[s.heatCourt, { width: cw, height: courtH }]}>
      {/* Heatmap cells */}
      {matchHeatmap.map((row, r) =>
        row.map((val, c) => (
          <View
            key={`${r}-${c}`}
            style={{
              position: 'absolute',
              left: c * cellW,
              top: r * cellH,
              width: cellW + 1,
              height: cellH + 1,
              backgroundColor: heatColor(val),
            }}
          />
        ))
      )}

      {/* Outer border */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: LINE }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: LINE }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 2, backgroundColor: LINE }} />
      <View style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 2, backgroundColor: LINE }} />

      {/* Physical net — bold line at 50% */}
      <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, backgroundColor: 'rgba(255,255,255,0.75)', marginTop: -2 }} />


      {/* Zone labels */}
      <Text style={{ position: 'absolute', top: '4%', alignSelf: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: '700', letterSpacing: 3 }}>
        GEGNER
      </Text>
      <Text style={{ position: 'absolute', top: '47%', alignSelf: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 8, fontWeight: '800', letterSpacing: 4, marginTop: -14 }}>
        NET
      </Text>
      <Text style={{ position: 'absolute', top: '78%', alignSelf: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: '700', letterSpacing: 4 }}>
        DU
      </Text>

      {/* Player position dot */}
      {dotCenter && (
        <View
          style={{
            position: 'absolute',
            left: dotCenter[1] * cw - 9,
            top: dotCenter[0] * courtH - 9,
            width: 18, height: 18, borderRadius: 9,
            backgroundColor: 'rgba(0,232,125,0.95)',
            borderWidth: 2.5, borderColor: '#fff',
            zIndex: 10,
          }}
        />
      )}
    </View>
  );
}

function MatchSelector({ matches, selectedId, onSelect, colors }: { matches: StoredMatch[]; selectedId: string | null; onSelect: (id: string) => void; colors: any }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 10, paddingTop: 4 }}
    >
      {matches.map((m, i) => {
        const isSelected = selectedId === m.id;
        const date = new Date(m.date);
        const label = `${date.getDate()}.${date.getMonth() + 1}.`;
        const score = m.result.score ?? `Match ${i + 1}`;
        return (
          <TouchableOpacity
            key={m.id}
            onPress={() => onSelect(m.id)}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 14, paddingVertical: 10,
              borderRadius: 14, borderWidth: 1.5,
              backgroundColor: isSelected ? colors.primary + '18' : colors.card,
              borderColor: isSelected ? colors.primary : colors.border,
              minWidth: 80, alignItems: 'center',
            }}
          >
            <Text style={{ color: isSelected ? colors.primary : colors.textSec, fontSize: 13, fontWeight: '800' }}>
              {label}
            </Text>
            <Text style={{ color: isSelected ? colors.text : colors.textSec, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
              {score}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function CourtDiagram({ s, colors, width: w, zonePercents }: { s: any; colors: any; width: number; zonePercents: [number, number, number, number] }) {
  const cw = w - 32;
  const [netL, netR, backL, backR] = zonePercents;
  const zones = [
    { top: '5%', left: '5%', width: '40%', height: '42%', label: `${netL}%`, zone: 'Net L' },
    { top: '5%', right: '5%', width: '40%', height: '42%', label: `${netR}%`, zone: 'Net R' },
    { bottom: '5%', left: '5%', width: '40%', height: '42%', label: `${backL}%`, zone: 'Back L' },
    { bottom: '5%', right: '5%', width: '40%', height: '42%', label: `${backR}%`, zone: 'Back R' },
  ];
  return (
    <View style={[s.courtDiag, { width: cw, height: cw * 0.55 }]}>
      <View style={s.courtDiagNet} />
      <View style={s.courtDiagCenter} />
      {zones.map((z, i) => (
        <View
          key={i}
          style={[
            s.courtZone,
            {
              top: z.top as any,
              left: z.left as any,
              right: z.right as any,
              bottom: z.bottom as any,
              width: z.width,
              height: z.height,
              backgroundColor: colors.primary + '28',
              borderColor: colors.primary + '55',
            },
          ]}
        >
          <Text style={[s.zoneVal, { color: colors.primary }]}>{z.label}</Text>
          <Text style={s.zoneLabel}>{z.zone}</Text>
        </View>
      ))}
    </View>
  );
}

function OvCard({ value, label, color, s }: any) {
  return (
    <View style={s.ovCard}>
      <Text style={[s.ovVal, { color }]}>{value}</Text>
      <Text style={s.ovLabel}>{label}</Text>
    </View>
  );
}

function HeatStat({ icon, label, value, colors, s, color }: any) {
  const c = color ?? colors.primary;
  return (
    <View style={[s.heatStat, { borderColor: colors.border }]}>
      <Ionicons name={icon as any} size={18} color={c} />
      <Text style={[s.heatStatVal, { color: c }]}>{value}</Text>
      <Text style={s.heatStatLabel}>{label}</Text>
    </View>
  );
}

function DetailStat({ label, value, color, labelColor }: any) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>{value}</Text>
      <Text style={{ color: labelColor ?? '#888', fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    headerSub: { fontSize: 11, color: colors.primary, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' as const, marginBottom: 3 },
    title: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },
    sub: { fontSize: 13, color: colors.textSec, marginTop: 2 },
    scroll: { paddingBottom: 16 },

    streakCard: {
      marginHorizontal: 16, marginBottom: 12,
      backgroundColor: colors.card, borderRadius: 18,
      padding: 18, borderWidth: 1, borderColor: colors.border,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    streakTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    streakLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    streakNum: { fontSize: 52, fontWeight: '900', color: colors.text, letterSpacing: -2, lineHeight: 56 },
    streakLabel: { color: colors.text, fontWeight: '700', fontSize: 15 },
    streakSub: { color: colors.textSec, fontSize: 13, marginTop: 2 },
    weekRangeLabel: { fontSize: 11, fontWeight: '600', color: colors.textSec, marginBottom: 8, textAlign: 'center' as const },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    dayWrap: { alignItems: 'center', gap: 6, flex: 1 },
    dayLabel: { fontSize: 11, fontWeight: '600', color: colors.textSec },
    dayDot: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: colors.cardAlt,
      justifyContent: 'center', alignItems: 'center',
    },

    tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.cardAlt, borderRadius: 13, padding: 4, borderWidth: 1, borderColor: colors.border },
    tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
    tabActive: { backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 },
    tabText: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
    tabTextActive: { color: '#04120B' },

    overviewRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 8 },
    ovCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
    ovVal: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    ovLabel: { color: colors.textSec, fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'center' },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: colors.textSec,
      marginLeft: 20, marginBottom: 10, marginTop: 8,
      textTransform: 'uppercase', letterSpacing: 1,
    },

    shotCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    shotCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    shotCardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    shotCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    shotCardName: { color: colors.text, fontWeight: '600', fontSize: 14 },
    shotCardPct: { fontWeight: '700', fontSize: 14 },
    shotTrack: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
    shotFill: { height: 6, borderRadius: 3 },
    shotDetail: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
    shotDetailRow: { flexDirection: 'row' },

    // Heatmap
    heatCourt: { marginHorizontal: 16, backgroundColor: '#050F08', borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: '#1A3A22', marginBottom: 12 },
    heatNet: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
    heatCenter: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
    playerDot: { position: 'absolute', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },

    // Heatmap legend
    heatLegend: {
      flexDirection: 'row', alignItems: 'center', marginHorizontal: 16,
      gap: 8, marginBottom: 10,
    },
    heatLegendBar: { flex: 1, flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
    heatLegendCell: { flex: 1 },
    heatLegendLabel: { color: colors.textSec, fontSize: 11, fontWeight: '600' },

    // Heatmap explanation card
    heatExplainCard: {
      flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
      borderRadius: 12, padding: 14, gap: 10, alignItems: 'flex-start',
      borderWidth: 1,
    },
    heatExplainText: { flex: 1, fontSize: 13, lineHeight: 19 },

    heatStats: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 8 },
    heatStat: { width: (width - 48) / 2, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, gap: 4 },
    heatStatVal: { fontSize: 18, fontWeight: '800' },
    heatStatLabel: { color: colors.textSec, fontSize: 11 },

    posCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border },
    posRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    posLabel: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '500' },
    posPct: { fontWeight: '700', fontSize: 15 },
    posTrack: { height: 6, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden' },
    posFill: { height: 6, borderRadius: 3 },
    courtDiag: { marginHorizontal: 16, backgroundColor: '#0D2B18', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1A4A2A', marginBottom: 8 },
    courtDiagNet: { position: 'absolute', top: '50%', left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
    courtDiagCenter: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    courtZone: { position: 'absolute', borderRadius: 6, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    zoneVal: { fontSize: 16, fontWeight: '800' },
    zoneLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
    insight: { flexDirection: 'row', marginHorizontal: 16, marginTop: 8, backgroundColor: colors.primaryDim, borderRadius: 12, padding: 14, gap: 10, alignItems: 'flex-start' },
    insightText: { flex: 1, fontSize: 13, lineHeight: 20 },

    emptyWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
    emptyIconRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryDim, justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: colors.primary + '44' },
    emptyTitle: { fontSize: 19, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 10 },
    emptySub: { fontSize: 14, color: colors.textSec, textAlign: 'center', lineHeight: 21, marginBottom: 24 },
    emptyFeatures: { width: '100%', gap: 10 },
    emptyFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
    emptyFeatureText: { color: colors.textSec, fontSize: 14 },
  });
}
