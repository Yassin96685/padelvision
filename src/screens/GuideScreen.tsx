import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { phonePositions } from '../data/mockData';

const { width } = Dimensions.get('window');
const COURT_W = width - 32;
const COURT_H = COURT_W * 0.65;

export default function GuideScreen() {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState('1');
  const pos = phonePositions.find(p => p.id === selected)!;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ── */}
        <View style={s.header}>
          <Text style={s.title}>Recording Guide</Text>
          <Text style={s.sub}>Optimal phone placement for match analysis</Text>
        </View>

        {/* ── Court Map ── */}
        <View style={[s.courtContainer, { width: COURT_W, height: COURT_H }]}>
          <View style={s.courtSurface} />
          <View style={s.courtBorder} />
          <View style={s.courtNet} />
          <View style={s.courtCenter} />
          <View style={s.serviceLineL} />
          <View style={s.serviceLineR} />
          <View style={s.serviceLineH} />
          <View style={[s.glass, { top: 0, left: 0 }]} />
          <View style={[s.glass, { top: 0, right: 0 }]} />
          <View style={[s.glass, { bottom: 0, left: 0 }]} />
          <View style={[s.glass, { bottom: 0, right: 0 }]} />
          {phonePositions.map(p => {
            const isActive = p.id === selected;
            const left = p.x * COURT_W - 14;
            const top = p.y * COURT_H - 14;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  s.posDot,
                  { left, top, backgroundColor: p.color, borderColor: isActive ? '#fff' : 'transparent', transform: [{ scale: isActive ? 1.2 : 1 }] },
                ]}
                onPress={() => setSelected(p.id)}
              >
                <Ionicons name="camera" size={14} color="#fff" />
              </TouchableOpacity>
            );
          })}
          <Text style={[s.courtLabel, { top: 6, left: COURT_W / 2 - 20 }]}>Opponent</Text>
          <Text style={[s.courtLabel, { bottom: 6, left: COURT_W / 2 - 14 }]}>You</Text>
        </View>

        {/* ── Position Selector ── */}
        <View style={s.posRow}>
          {phonePositions.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.posPill, selected === p.id && { borderColor: p.color, backgroundColor: p.color + '22' }]}
              onPress={() => setSelected(p.id)}
            >
              <View style={[s.pillDot, { backgroundColor: p.color }]} />
              <Text style={[s.pillText, selected === p.id && { color: p.color }]} numberOfLines={1}>
                Pos {p.id}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Selected Position Detail ── */}
        <View style={[s.detailCard, { borderLeftColor: pos.color }]}>
          <View style={s.detailTop}>
            <View style={[s.detailIcon, { backgroundColor: pos.color + '22' }]}>
              <Ionicons name="camera" size={20} color={pos.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.detailName}>{pos.name}</Text>
              <View style={s.scoreRow}>
                <Text style={s.scoreLabel}>Quality Score</Text>
                <Text style={[s.scoreVal, { color: pos.color }]}>{pos.score}/100</Text>
              </View>
            </View>
          </View>
          <View style={s.scoreBarTrack}>
            <View style={[s.scoreBarFill, { width: `${pos.score}%` as any, backgroundColor: pos.color }]} />
          </View>
          <Text style={s.detailDesc}>{pos.description}</Text>
          <View style={s.proscons}>
            <View style={s.prosBox}>
              <Text style={[s.prosTitle, { color: colors.primary }]}>Pros</Text>
              {pos.pros.map((pro, i) => (
                <View key={i} style={s.proItem}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
                  <Text style={s.proText}>{pro}</Text>
                </View>
              ))}
            </View>
            <View style={s.consBox}>
              <Text style={[s.consTitle, { color: colors.danger }]}>Cons</Text>
              {pos.cons.map((con, i) => (
                <View key={i} style={s.conItem}>
                  <Ionicons name="close-circle" size={14} color={colors.danger} />
                  <Text style={s.conText}>{con}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Tips ── */}
        <Text style={s.sectionTitle}>Recording Tips</Text>
        {[
          { icon: 'phone-portrait', tip: 'Film in landscape (horizontal) orientation for best court coverage.', color: colors.primary },
          { icon: 'sunny', tip: 'Avoid filming with sun directly behind the court — creates glare on the glass walls.', color: colors.warning },
          { icon: 'battery-charging', tip: 'Bring a power bank. A full match can drain 40-60% battery when recording 4K.', color: colors.blue },
          { icon: 'shield-checkmark', tip: 'Use a phone case with a tripod mount or a suction-cup fence mount for stability.', color: colors.purple },
          { icon: 'options', tip: 'Set your phone to Airplane mode to avoid interruptions and reduce overheating.', color: colors.danger },
          { icon: 'save', tip: 'Ensure you have at least 3 GB free before a match. 1h of 1080p ≈ 1.5 GB.', color: colors.warning },
        ].map((item, i) => (
          <View key={i} style={s.tipCard}>
            <View style={[s.tipIcon, { backgroundColor: item.color + '22' }]}>
              <Ionicons name={item.icon as any} size={18} color={item.color} />
            </View>
            <Text style={s.tipText}>{item.tip}</Text>
          </View>
        ))}

        {/* ── Checklist ── */}
        <Text style={s.sectionTitle}>Pre-Recording Checklist</Text>
        <View style={s.checklist}>
          {[
            'Phone charged above 80%',
            'Enough storage space (3 GB+)',
            'Airplane mode enabled',
            'Camera app set to 1080p 60fps',
            'Tripod or mount secured',
            'Test recording before match starts',
          ].map((item, i) => (
            <View key={i} style={[s.checkItem, i < 5 && s.checkBorder]}>
              <Ionicons name="square-outline" size={20} color={colors.textMuted} />
              <Text style={s.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 16 },

    header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    sub: { fontSize: 13, color: colors.textSec, marginTop: 2 },

    courtContainer: { marginHorizontal: 16, marginBottom: 14, position: 'relative', borderRadius: 14, overflow: 'hidden' },
    courtSurface: { ...StyleSheet.absoluteFill, backgroundColor: '#0D2B18' },
    courtBorder: { position: 'absolute', top: 6, left: 10, right: 10, bottom: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 2 },
    courtNet: { position: 'absolute', top: '50%', left: 10, right: 10, height: 2, backgroundColor: 'rgba(255,255,255,0.5)' },
    courtCenter: { position: 'absolute', top: 6, bottom: 6, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    serviceLineL: { position: 'absolute', top: '20%', bottom: '52%', left: '12%', right: '52%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    serviceLineR: { position: 'absolute', top: '20%', bottom: '52%', left: '52%', right: '12%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    serviceLineH: { position: 'absolute', top: '20%', left: '12%', right: '12%', height: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    glass: { position: 'absolute', width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(150,210,255,0.6)', backgroundColor: 'rgba(150,210,255,0.08)' },
    posDot: { position: 'absolute', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, zIndex: 10 },
    courtLabel: { position: 'absolute', color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600' },

    posRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 12 },
    posPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
    pillDot: { width: 8, height: 8, borderRadius: 4 },
    pillText: { color: colors.textSec, fontSize: 12, fontWeight: '600' },

    detailCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4 },
    detailTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 10 },
    detailIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    detailName: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 4 },
    scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scoreLabel: { color: colors.textSec, fontSize: 12 },
    scoreVal: { fontWeight: '800', fontSize: 14 },
    scoreBarTrack: { height: 5, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    scoreBarFill: { height: 5, borderRadius: 3 },
    detailDesc: { color: colors.textSec, fontSize: 13, lineHeight: 20, marginBottom: 14 },
    proscons: { flexDirection: 'row', gap: 12 },
    prosBox: { flex: 1 },
    consBox: { flex: 1 },
    prosTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    consTitle: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
    proItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
    conItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
    proText: { color: colors.textSec, fontSize: 12, lineHeight: 18, flex: 1 },
    conText: { color: colors.textSec, fontSize: 12, lineHeight: 18, flex: 1 },

    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginLeft: 16, marginTop: 20, marginBottom: 10 },

    tipCard: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 12 },
    tipIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    tipText: { flex: 1, color: colors.textSec, fontSize: 13, lineHeight: 20 },

    checklist: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
    checkItem: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
    checkBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    checkText: { color: colors.text, fontSize: 13 },
  });
}
