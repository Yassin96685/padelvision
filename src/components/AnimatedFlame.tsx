import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const TIER_OUTER  = ['', '#FF6B00', '#FF8C00', '#8B5CF6', '#DC2626', '#FFFFFF', '#FFD700', '#06B6D4'];
export const TIER_INNER  = ['', '#FFD700', '#FFE066', '#DDD6FE', '#FF6B00', '#F1F5F9', '#FFF176', '#A5F3FC'];
export const TIER_CORE   = ['', '',        '#FFF9C4', '#EDE9FE', '#FFD700', '#E2E8F0', '#FFFDE7', '#CFFAFE'];
export const PART_DARK   = ['', '', '#FF8C00', '#8B5CF6', '#FFFFFF', '#374151', '#FFD700', '#22D3EE'];
export const PART_LIGHT  = ['', '', '#FF8C00', '#7C3AED', '#94A3B8', '#1F2937', '#B45309', '#0E7490'];
export const TIER_PCOUNT = [0, 0, 4, 6, 7, 8, 9, 9];
export const TIER_BG     = [
  'rgba(75,85,99,0.08)',
  'rgba(255,107,0,0.07)',
  'rgba(255,140,0,0.10)',
  'rgba(139,92,246,0.12)',
  'rgba(220,38,38,0.13)',
  'rgba(80,80,90,0.14)',
  'rgba(255,215,0,0.10)',
  'rgba(6,182,212,0.10)',
];
export const TIER_BORDER = [
  'rgba(75,85,99,0.20)',
  'rgba(255,107,0,0.28)',
  'rgba(255,140,0,0.35)',
  'rgba(139,92,246,0.42)',
  'rgba(220,38,38,0.45)',
  'rgba(180,180,190,0.40)',
  'rgba(255,215,0,0.45)',
  'rgba(6,182,212,0.40)',
];
export const TIER_CLRD   = ['#6B7280', '#FF6B00', '#FF8C00', '#A78BFA', '#DC2626', '#F1F5F9', '#FDE68A', '#67E8F9'];
export const TIER_CLRL   = ['#6B7280', '#FF6B00', '#FF8C00', '#7C3AED', '#DC2626', '#374151', '#B45309', '#0E7490'];

export function getLevel(count: number): number {
  if (count < 2)  return count;
  if (count < 5)  return 2;
  if (count < 10) return 3;
  if (count < 15) return 4;
  if (count < 25) return 5;
  if (count < 40) return 6;
  return 7 + Math.floor((count - 40) / 20);
}

export function getVisualTier(level: number): number {
  if (level <= 7) return level;
  return 2 + ((level - 2) % 6);
}

export function getLevelNext(level: number): number {
  if (level === 0) return 1;
  if (level === 1) return 2;
  if (level === 2) return 5;
  if (level === 3) return 10;
  if (level === 4) return 15;
  if (level === 5) return 25;
  if (level === 6) return 40;
  return 40 + (level - 6) * 20;
}

export function getLevelPrev(level: number): number {
  if (level === 0) return 0;
  if (level === 1) return 1;
  if (level === 2) return 2;
  if (level === 3) return 5;
  if (level === 4) return 10;
  if (level === 5) return 15;
  if (level === 6) return 25;
  if (level === 7) return 40;
  return 40 + (level - 7) * 20;
}

function SingleParticle({ color, delay, left, size }: { color: string; delay: number; left: number; size: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      translateY.setValue(0);
      opacity.setValue(0);
      const dist = 38 + Math.random() * 32;
      const dur  = 580 + Math.random() * 520;
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, { toValue: -dist, duration: dur, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.90, duration: 130, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,    duration: dur - 130, useNativeDriver: true }),
          ]),
        ]),
      ]).start(loop);
    };
    loop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute', bottom: 0, left,
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: color, opacity,
        transform: [{ translateY }],
      }}
    />
  );
}

function ParticleEmitter({ color, count, parentW, size }: { color: string; count: number; parentW: number; size: number }) {
  const center = (parentW - size) / 2;
  const xOffs  = [-14, -7, 0, 7, 14, -10, 10, -4, 4];
  const delays = [0, 380, 760, 190, 950, 550, 130, 700, 320];
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SingleParticle key={i} color={color} delay={delays[i]} left={center + xOffs[i]} size={size} />
      ))}
    </>
  );
}

export function AnimatedFlame({ tier, isDark }: { tier: number; isDark: boolean }) {
  const sway      = useRef(new Animated.Value(0)).current;
  const innerSway = useRef(new Animated.Value(0)).current;
  const flicker   = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (tier === 0) return;
    const t  = Math.min(tier, 7);
    const sp = [0, 900, 740, 580, 460, 380, 330, 290][t];
    const sw = [0,  10,  14,  18,  22,  26,  28,  30][t];
    const iw = Math.round(sw * 0.45);

    Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue:  sw,         duration: sp,         useNativeDriver: true }),
      Animated.timing(sway, { toValue: -sw * 0.70,  duration: sp * 0.78,  useNativeDriver: true }),
      Animated.timing(sway, { toValue:  sw * 0.42,  duration: sp * 0.58,  useNativeDriver: true }),
      Animated.timing(sway, { toValue: -sw * 0.20,  duration: sp * 0.40,  useNativeDriver: true }),
      Animated.timing(sway, { toValue:  0,           duration: sp * 0.26,  useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(innerSway, { toValue: -iw,        duration: sp * 0.88, useNativeDriver: true }),
      Animated.timing(innerSway, { toValue:  iw * 0.55, duration: sp * 0.70, useNativeDriver: true }),
      Animated.timing(innerSway, { toValue: -iw * 0.28, duration: sp * 0.50, useNativeDriver: true }),
      Animated.timing(innerSway, { toValue:  0,          duration: sp * 0.32, useNativeDriver: true }),
    ])).start();

    if (tier >= 2) {
      Animated.loop(Animated.sequence([
        Animated.timing(flicker, { toValue: 0.48, duration: 155, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1,    duration: 210, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.68, duration: 130, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1,    duration: 280, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0.82, duration: 100, useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 1,    duration: 190, useNativeDriver: true }),
      ])).start();
    }
  }, [tier]);

  if (tier === 0) {
    return (
      <View style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="flame-outline" size={34} color="#374151" />
      </View>
    );
  }

  const t       = Math.min(tier, 7);
  const outerSz = [0, 36, 44, 54, 64, 72, 76, 80][t];
  const innerSz = Math.round(outerSz * 0.62);
  const coreSz  = tier >= 2 ? Math.round(outerSz * 0.36) : 0;
  const parentW = outerSz + 32;
  const pSize   = t >= 6 ? 6 : t >= 4 ? 5 : 4;
  const pColor  = isDark ? PART_DARK[t] : PART_LIGHT[t];
  const pCount  = TIER_PCOUNT[t];

  const outerRot   = sway.interpolate({ inputRange: [-30, 30], outputRange: ['-30deg', '30deg'] });
  const outerDrift = sway.interpolate({ inputRange: [-30, 30], outputRange: [-4, 4] });
  const innerRot   = innerSway.interpolate({ inputRange: [-15, 15], outputRange: ['-15deg', '15deg'] });

  return (
    <Animated.View style={{
      alignItems: 'center', justifyContent: 'center',
      width: parentW, height: outerSz + 16,
      transform: [{ rotate: outerRot }, { translateX: outerDrift }],
    }}>
      {t === 5 && !isDark && (
        <View style={{ position: 'absolute' }}>
          <Ionicons name="flame" size={outerSz + 8} color="rgba(55,65,81,0.22)" />
        </View>
      )}
      <Ionicons name="flame" size={outerSz} color={TIER_OUTER[t]} />
      <Animated.View style={{
        position: 'absolute',
        opacity: tier >= 2 ? flicker : 0.88,
        transform: [{ rotate: innerRot }],
      }}>
        <Ionicons name="flame" size={innerSz} color={TIER_INNER[t]} />
      </Animated.View>
      {coreSz > 0 && (
        <View style={{ position: 'absolute' }}>
          <Ionicons name="flame" size={coreSz} color={TIER_CORE[t]} />
        </View>
      )}
      {pCount > 0 && (
        <ParticleEmitter color={pColor} count={pCount} parentW={parentW} size={pSize} />
      )}
    </Animated.View>
  );
}
