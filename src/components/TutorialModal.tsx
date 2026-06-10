import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, Animated, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const SEEN_KEY = '@padelvision/tutorial_seen';
const ALWAYS_KEY = '@padelvision/tutorial_always_show';

export async function shouldShowTutorial(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(SEEN_KEY);
    if (seen !== 'true') return true;
    const always = await AsyncStorage.getItem(ALWAYS_KEY);
    return always === 'true';
  } catch {
    return true;
  }
}

export async function saveTutorialPreference(alwaysShow: boolean) {
  try {
    await AsyncStorage.setItem(SEEN_KEY, 'true');
    await AsyncStorage.setItem(ALWAYS_KEY, alwaysShow ? 'true' : 'false');
  } catch {}
}

// ─── Slide illustrations ───────────────────────────────────────────────────

function IllustrationPosition() {
  return (
    <View style={[il.wrap, { flexDirection: 'row', paddingHorizontal: 16 }]}>
      {/* Phone on the side */}
      <View style={il.phoneSide}>
        <View style={il.phoneBubble}>
          <Ionicons name="phone-portrait" size={24} color="#fff" />
        </View>
        <Text style={il.hint}>Netzhöhe</Text>
      </View>

      {/* Arrow */}
      <View style={il.posArrow}>
        <Ionicons name="arrow-forward" size={18} color={GREEN} />
      </View>

      {/* 3D padel court */}
      <View style={il.courtSide}>
        <View style={il.court3dPerspective}>
          <View style={il.court3dFloor}>
            {/* Back half slightly darker for depth */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(0,0,0,0.15)' }} />
            <View style={il.court3dBorder} />
            {/* Net */}
            <View style={il.net3d} />
            {/* Service lines – volle Breite, 1/3 von jedem Ende */}
            <View style={{ position: 'absolute', top: '33%', left: 5, right: 5, height: 1.5, backgroundColor: 'rgba(255,255,255,0.45)' }} />
            <View style={{ position: 'absolute', bottom: '33%', left: 5, right: 5, height: 1.5, backgroundColor: 'rgba(255,255,255,0.45)' }} />
            {/* Mittellinie nur im Service-Bereich (zwischen Service-Linien) */}
            <View style={{ position: 'absolute', top: '33%', bottom: '33%', left: '50%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.35)' }} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,232,125,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginTop: 10 }}>
          <Ionicons name="checkmark-circle" size={13} color={GREEN} />
          <Text style={il.badgeText}>Optimal</Text>
        </View>
      </View>
    </View>
  );
}

function IllustrationLandscape() {
  return (
    <View style={il.wrap}>
      {/* Phone in landscape */}
      <View style={il.phoneLandOuter}>
        <View style={il.phoneLandScreen}>
          {/* Mini court inside screen */}
          <View style={il.miniCourt}>
            <View style={il.miniCourtSurface} />
            <View style={il.miniNet} />
            <View style={il.miniCenterV} />
          </View>
          {/* Corner brackets = "it fits" */}
          <View style={[il.bracket, il.bTL]} />
          <View style={[il.bracket, il.bTR]} />
          <View style={[il.bracket, il.bBL]} />
          <View style={[il.bracket, il.bBR]} />
        </View>
        <View style={il.phoneLandBtn} />
      </View>

      {/* Rotation arrow */}
      <View style={il.rotArrow}>
        <Ionicons name="refresh" size={28} color="#00E87D" />
        <Text style={il.rotLabel}>90° drehen</Text>
      </View>
    </View>
  );
}

function IllustrationStable() {
  return (
    <View style={[il.wrap, { flexDirection: 'row' }]}>

      {/* LEFT: Stativ */}
      <View style={il.stableHalf}>
        <Text style={il.stableTitle}>Stativ</Text>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          {/* Phone horizontal */}
          <View style={il.stativPhone}>
            <Ionicons name="phone-landscape" size={20} color="#fff" />
          </View>
          {/* Mount ball */}
          <View style={il.stativBall} />
          {/* Neck tube */}
          <View style={il.stativNeck} />
          {/* Three legs */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
            <View style={[il.stativLeg, { transform: [{ rotate: '-32deg' }] }]} />
            <View style={il.stativLeg} />
            <View style={[il.stativLeg, { transform: [{ rotate: '32deg' }] }]} />
          </View>
          {/* Ground bar */}
          <View style={il.stativGround} />
        </View>
        <View style={il.stableBadge}>
          <Ionicons name="checkmark-circle" size={13} color={GREEN} />
          <Text style={il.stableBadgeText}>Empfohlen</Text>
        </View>
      </View>

      {/* DIVIDER */}
      <View style={il.stableDivider}>
        <View style={il.stableDivLine} />
        <Text style={il.orText}>oder</Text>
        <View style={il.stableDivLine} />
      </View>

      {/* RIGHT: Zaun / Glaswand */}
      <View style={il.stableHalf}>
        <Text style={il.stableTitle}>Zaun / Glas</Text>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <View style={il.fencePanel}>
            {/* Horizontal rails */}
            <View style={[il.fenceRailH, { top: 0 }]} />
            <View style={[il.fenceRailH, { top: '42%' }]} />
            <View style={[il.fenceRailH, { bottom: 0 }]} />
            {/* Vertical posts */}
            {[0, 1, 2, 3, 4].map(i => (
              <View key={i} style={[il.fencePostH, { left: `${i * 25}%` as any }]} />
            ))}
          </View>
          {/* Phone leaning against fence */}
          <View style={il.fencePhoneNew}>
            <Ionicons name="phone-landscape" size={18} color="#fff" />
          </View>
        </View>
        <View style={il.stableBadge}>
          <Ionicons name="checkmark-circle" size={13} color={GREEN} />
          <Text style={il.stableBadgeText}>Stabil</Text>
        </View>
      </View>

    </View>
  );
}

function IllustrationLight() {
  return (
    <View style={[il.wrap, { flexDirection: 'row', paddingHorizontal: 10, gap: 10 }]}>

      {/* GUT */}
      <View style={[il.lightBox, il.lightBoxGood]}>
        <View style={il.lightBoxHeader}>
          <Ionicons name="checkmark-circle" size={22} color={GREEN} />
          <Text style={[il.lightBoxTitle, { color: GREEN }]}>Gut</Text>
        </View>
        {/* ☀ → 📷 → COURT */}
        <View style={il.lightDiagram}>
          <Ionicons name="sunny" size={24} color="#FFB800" />
          <Ionicons name="arrow-forward" size={12} color={GREEN} />
          <View style={il.lightCam}>
            <Ionicons name="videocam" size={16} color="#fff" />
          </View>
          <Ionicons name="arrow-forward" size={12} color={GREEN} />
          <View style={il.lightCourtBox} />
        </View>
        <Text style={il.lightHint}>Sonne im{'\n'}Rücken</Text>
      </View>

      {/* SCHLECHT */}
      <View style={[il.lightBox, il.lightBoxBad]}>
        <View style={il.lightBoxHeader}>
          <Ionicons name="close-circle" size={22} color="#EF4444" />
          <Text style={[il.lightBoxTitle, { color: '#EF4444' }]}>Schlecht</Text>
        </View>
        {/* COURT → 📷 → ☀  (kamera filmt in die Sonne) */}
        <View style={il.lightDiagram}>
          <View style={il.lightCourtBox} />
          <Ionicons name="arrow-forward" size={12} color="#EF4444" />
          <View style={il.lightCam}>
            <Ionicons name="videocam" size={16} color="#fff" />
          </View>
          <Ionicons name="arrow-forward" size={12} color="#EF4444" />
          <Ionicons name="sunny" size={24} color="#EF4444" />
        </View>
        <Text style={[il.lightHint, { color: '#EF4444' }]}>Gegen{'\n'}die Sonne</Text>
      </View>

    </View>
  );
}

const ILLUSTRATIONS = [
  IllustrationPosition,
  IllustrationLandscape,
  IllustrationStable,
  IllustrationLight,
];

// ─── Slide data ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    title: 'Seitliche Platzierung',
    desc: 'Stelle dein Handy außerhalb des Courts, seitlich auf Netzhöhe. So erfasst die Kamera den gesamten Court von einer guten Perspektive.',
  },
  {
    title: 'Querformat benutzen',
    desc: 'Drehe dein Handy ins Querformat (Landscape). Damit passt der gesamte Padel-Court ins Bild und die KI-Analyse liefert bessere Ergebnisse.',
  },
  {
    title: 'Stabil befestigen',
    desc: 'Nutze ein Stativ oder lehne das Handy sicher am Zaun an. Verwackelte Aufnahmen reduzieren die Analyse-Qualität stark.',
  },
  {
    title: 'Auf Licht achten',
    desc: 'Filme nicht gegen die Sonne. Ideal ist eine gleichmäßige Beleuchtung. Die Kamera sollte zur Sonne zeigen, nicht weg davon.',
  },
];

// ─── Main component ────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function TutorialModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [slide, setSlide] = useState(0);
  const [alwaysShow, setAlwaysShow] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isLast = slide === SLIDES.length - 1;

  useEffect(() => {
    if (visible) {
      setSlide(0);
      setAlwaysShow(false);
      loadAlwaysPref();
    }
  }, [visible]);

  const loadAlwaysPref = async () => {
    try {
      const v = await AsyncStorage.getItem(ALWAYS_KEY);
      setAlwaysShow(v === 'true');
    } catch {}
  };

  const animateSlide = (target: number, dir: 'fwd' | 'back') => {
    slideAnim.setValue(dir === 'fwd' ? 60 : -60);
    setSlide(target);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };

  const next = () => {
    if (isLast) {
      saveTutorialPreference(alwaysShow);
      onClose();
    } else {
      animateSlide(slide + 1, 'fwd');
    }
  };

  const back = () => animateSlide(slide - 1, 'back');

  const skip = () => {
    saveTutorialPreference(alwaysShow);
    onClose();
  };

  const Illus = ILLUSTRATIONS[slide];
  const data = SLIDES[slide];

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <View style={[s.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.container}>

          {/* Header */}
          <View style={s.topRow}>
            <Text style={s.stepLabel}>{slide + 1} / {SLIDES.length}</Text>
            <TouchableOpacity onPress={skip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={s.skipText}>Überspringen</Text>
            </TouchableOpacity>
          </View>

          {/* Dots */}
          <View style={s.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[s.dot, i === slide && s.dotActive]} />
            ))}
          </View>

          {/* Illustration */}
          <Animated.View style={[s.illustrationWrap, { transform: [{ translateX: slideAnim }] }]}>
            <Illus />
          </Animated.View>

          {/* Text */}
          <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
            <Text style={s.title}>{data.title}</Text>
            <Text style={s.desc}>{data.desc}</Text>
          </Animated.View>

          {/* Always show toggle (only on last slide) */}
          {isLast && (
            <View style={s.toggleRow}>
              <View style={s.toggleLeft}>
                <Text style={s.toggleLabel}>Tutorial immer anzeigen</Text>
                <Text style={s.toggleSub}>Vor jeder Aufnahme anzeigen</Text>
              </View>
              <Switch
                value={alwaysShow}
                onValueChange={setAlwaysShow}
                trackColor={{ false: '#1D2535', true: '#00E87D55' }}
                thumbColor={alwaysShow ? '#00E87D' : '#4B5563'}
              />
            </View>
          )}

          {/* Navigation buttons */}
          <View style={s.btnRow}>
            {slide > 0 && (
              <TouchableOpacity style={s.btnBack} onPress={back} activeOpacity={0.85}>
                <Ionicons name="arrow-back" size={16} color="#8B95A6" />
                <Text style={s.btnBackText}>Zurück</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.btn, { flex: 1 }]} onPress={next} activeOpacity={0.85}>
              <Text style={s.btnText}>{isLast ? 'Aufnahme starten' : 'Weiter'}</Text>
              <Ionicons name={isLast ? 'play' : 'arrow-forward'} size={16} color="#fff" />
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const GREEN = '#00E87D';
const COURT_BLUE = '#1460B0';
const DARK = '#090C14';
const CARD = '#0F1320';
const BORDER = '#1D2535';

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: CARD,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  stepLabel: { color: GREEN, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  skipText: { color: '#4B5563', fontSize: 14, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#1D2535' },
  dotActive: { width: 22, backgroundColor: GREEN },
  illustrationWrap: {
    height: 220, backgroundColor: '#08101C', borderRadius: 20,
    marginBottom: 22, borderWidth: 1, borderColor: BORDER,
    overflow: 'visible',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: -0.5, marginBottom: 10 },
  desc: { fontSize: 14, color: '#8B95A6', lineHeight: 22, marginBottom: 20 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141B2B', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: BORDER,
  },
  toggleLeft: { flex: 1, marginRight: 12 },
  toggleLabel: { color: '#fff', fontWeight: '700', fontSize: 14 },
  toggleSub: { color: '#4B5563', fontSize: 12, marginTop: 2 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#EF4444', borderRadius: 16,
    paddingVertical: 17,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  btnBack: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1D2535', borderRadius: 16,
    paddingVertical: 17, paddingHorizontal: 20,
    borderWidth: 1, borderColor: BORDER,
  },
  btnBackText: { color: '#8B95A6', fontWeight: '700', fontSize: 15 },
});

// ─── Illustration styles ───────────────────────────────────────────────────

const COURT_W = width - 48 - 80;
const COURT_H = COURT_W * 0.58;

const il = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Court (top-down)
  court: {
    width: COURT_W, height: COURT_H,
    backgroundColor: COURT_BLUE,
    borderRadius: 8, position: 'relative', overflow: 'hidden',
  },
  courtSurface: { ...StyleSheet.absoluteFillObject, backgroundColor: COURT_BLUE },
  courtBorder: { position: 'absolute', top: 4, left: 6, right: 6, bottom: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 4 },
  net: { position: 'absolute', top: '50%', left: 6, right: 6, height: 2, backgroundColor: 'rgba(255,255,255,0.55)' },
  centerV: { position: 'absolute', top: 4, bottom: 4, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  serviceL: { position: 'absolute', top: '25%', left: 6, right: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  serviceR: { position: 'absolute', bottom: '25%', left: '50%', right: 6, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  glass: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2 },

  // Phone on side (position slide)
  phoneWrap: { position: 'absolute', left: -44, top: '35%', alignItems: 'center' },
  phone: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  arrowLine: { position: 'absolute', left: 36, top: 17, width: 24, height: 2, backgroundColor: GREEN },
  arrowHead: { position: 'absolute', left: 56, top: 12, width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 8, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: GREEN },
  hint: { color: GREEN, fontSize: 9, fontWeight: '700', marginTop: 5, letterSpacing: 0.5 },
  badge: { position: 'absolute', bottom: 8, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,232,125,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { color: GREEN, fontSize: 11, fontWeight: '700' },

  // Landscape slide
  phoneLandOuter: { width: 200, height: 110, borderRadius: 12, borderWidth: 2.5, borderColor: '#fff', backgroundColor: '#071428', position: 'relative', justifyContent: 'center', alignItems: 'center' },
  phoneLandScreen: { width: 180, height: 94, borderRadius: 8, backgroundColor: '#0B3870', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  phoneLandBtn: { position: 'absolute', right: -7, top: '50%', width: 5, height: 20, backgroundColor: '#fff', borderRadius: 3 },
  miniCourt: { width: 160, height: 80, backgroundColor: COURT_BLUE, borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  miniCourtSurface: { ...StyleSheet.absoluteFillObject, backgroundColor: COURT_BLUE },
  miniNet: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  miniCenterV: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.18)' },
  bracket: { position: 'absolute', width: 12, height: 12, borderColor: GREEN },
  bTL: { top: 4, left: 4, borderTopWidth: 2, borderLeftWidth: 2 },
  bTR: { top: 4, right: 4, borderTopWidth: 2, borderRightWidth: 2 },
  bBL: { bottom: 4, left: 4, borderBottomWidth: 2, borderLeftWidth: 2 },
  bBR: { bottom: 4, right: 4, borderBottomWidth: 2, borderRightWidth: 2 },
  rotArrow: { position: 'absolute', top: 8, right: 16, alignItems: 'center', gap: 4 },
  rotLabel: { color: GREEN, fontSize: 10, fontWeight: '700' },

  // Stable slide – new horizontal layout
  stableHalf: { flex: 1, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 },
  stableTitle: { color: '#8B95A6', fontSize: 10, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 6 },
  stableDivider: { width: 28, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14 },
  stableDivLine: { flex: 1, width: 1, backgroundColor: BORDER },
  stableBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,232,125,0.1)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  stableBadgeText: { color: GREEN, fontSize: 10, fontWeight: '700' },
  // Tripod
  stativPhone: { width: 72, height: 38, backgroundColor: '#EF4444', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  stativBall: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#6B7280', marginVertical: 2 },
  stativNeck: { width: 3, height: 22, backgroundColor: '#6B7280', borderRadius: 2 },
  stativLeg: { width: 3, height: 28, backgroundColor: '#6B7280', borderRadius: 2 },
  stativGround: { width: 44, height: 2, backgroundColor: '#374151', borderRadius: 1, marginTop: 2 },
  // Fence
  fencePanel: { width: 78, height: 54, position: 'relative', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#2D3748' },
  fenceRailH: { position: 'absolute', left: 0, right: 0, height: 2.5, backgroundColor: '#374151' },
  fencePostH: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#2D3748' },
  fencePhoneNew: { width: 62, height: 32, backgroundColor: '#EF4444', borderRadius: 7, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', marginTop: 6, transform: [{ rotate: '-4deg' }] },
  orText: { color: '#4B5563', fontSize: 11, fontWeight: '600' },

  // Light slide – two box panels
  lightBox: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 1.5, alignItems: 'center', gap: 10, justifyContent: 'center' },
  lightBoxGood: { backgroundColor: 'rgba(0,232,125,0.06)', borderColor: 'rgba(0,232,125,0.3)' },
  lightBoxBad: { backgroundColor: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.3)' },
  lightBoxHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lightBoxTitle: { fontSize: 15, fontWeight: '800' },
  lightDiagram: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lightCam: { width: 30, height: 24, backgroundColor: '#1D2535', borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  lightCourtBox: { width: 22, height: 16, backgroundColor: COURT_BLUE, borderRadius: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  lightHint: { fontSize: 11, color: '#8B95A6', textAlign: 'center', lineHeight: 16 },

  // Position slide – 3D court layout
  phoneSide: { alignItems: 'center', gap: 8, width: 62 },
  phoneBubble: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  posArrow: { width: 30, justifyContent: 'center', alignItems: 'center', marginTop: -14 },
  courtSide: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  court3dPerspective: { transform: [{ perspective: 350 }, { rotateX: '52deg' }] },
  court3dFloor: { width: 152, height: 100, backgroundColor: COURT_BLUE, borderRadius: 6, position: 'relative', overflow: 'hidden' },
  court3dBorder: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 3 },
  net3d: { position: 'absolute', top: '50%', left: 4, right: 4, height: 2.5, backgroundColor: 'rgba(255,255,255,0.72)' },
  centerV3d: { position: 'absolute', top: 4, bottom: 4, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  service3dT: { position: 'absolute', top: '28%', left: 4, right: '50%', height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  service3dB: { position: 'absolute', bottom: '28%', left: '50%', right: 4, height: 1, backgroundColor: 'rgba(255,255,255,0.22)' },

});
