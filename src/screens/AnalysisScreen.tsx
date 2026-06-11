import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Dimensions, TextInput, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback, Animated, Alert, Image } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useMatches, AnalysisResult, StoredMatch, ShotEntry } from '../store/MatchContext';
import { useLocale, COACH_TIPS_BY_LOCALE, AI_PHASES_BY_LOCALE, AI_STRENGTHS_BY_LOCALE, AI_IMPROVEMENTS_BY_LOCALE, DATE_LOCALE, LocaleCode } from '../i18n/LocaleContext';
import { lastMatch, phonePositions } from '../data/mockData';
import TutorialModal, { shouldShowTutorial } from '../components/TutorialModal';
import { analyzeVideo, ClaudeAnalysisResult } from '../services/claudeAnalysis';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { uploadThumbnail as supaUploadThumbnail, updateMatchUrls } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../store/AuthContext';
import { isProActive } from '../services/purchases';

const { width } = Dimensions.get('window');
const DURATION = 72 * 60;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function buildFeedback(
  shots: number, winners: number, errorRate: number, coverage: number, avgRally: string,
  strengths: Record<string, string>,
  improvements: Record<string, string>,
): { strengths: string[]; improvements: string[]; strengthKeys: string[]; improvementKeys: string[] } {
  const winRate = winners / Math.max(1, shots);
  const rally = parseFloat(avgRally);

  const condS: string[] = [];
  if (errorRate < 15) condS.push('low_errors');
  if (coverage >= 70) condS.push('high_coverage');
  if (winRate >= 0.17) condS.push('high_winners');
  if (rally >= 5.0) condS.push('good_rally');

  const generalS = ['net_control', 'serve_placement', 'consistent_defense', 'court_width', 'base_position', 'smash_execution'];
  const allS = [...condS, ...generalS.filter(k => !condS.includes(k))];
  const selS = allS.slice(0, 3).filter(k => Boolean(strengths[k]));
  const pickedS = selS.map(k => strengths[k]);

  const condI: string[] = [];
  if (errorRate > 22) condI.push('reduce_errors');
  if (coverage < 63) condI.push('improve_coverage');
  if (winRate < 0.12) condI.push('more_winners');
  if (rally < 3.5) condI.push('rally_length');

  const generalI = ['net_approach', 'second_serve', 'opponent_smash', 'diagonal_shots', 'low_ball_reaction', 'serve_pressure'];
  const allI = [...condI, ...generalI.filter(k => !condI.includes(k))];
  const selI = allI.slice(0, 3).filter(k => Boolean(improvements[k]));
  const pickedI = selI.map(k => improvements[k].replace('{errorRate}', String(errorRate)));

  return { strengths: pickedS, improvements: pickedI, strengthKeys: selS, improvementKeys: selI };
}


type ScrubberHandle = { skip: (secs: number) => void };
type Orientation = 'portrait' | 'landscape';
type PlayerPosition = 'left-back' | 'right-back' | 'left-net' | 'right-net';

type ErrorEntry = {
  id: string; time: string; shot: string; zone: string; cause: string;
  severity: 'high' | 'medium' | 'low'; explanation: string; tip: string;
};

const ERROR_POOL_BY_LOCALE: Record<LocaleCode, Omit<ErrorEntry, 'id'>[]> = {
  en: [
    { time: '08:15', shot: 'Backhand Slice', zone: 'Net Zone', cause: 'Technique', severity: 'high', explanation: 'Wrist too stiff during follow-through. Ball clipped the net due to insufficient lift angle.', tip: 'Open racket face 10° more on backhand slices near the net.' },
    { time: '14:22', shot: 'Defensive Lob', zone: 'Back Glass', cause: 'Positioning', severity: 'medium', explanation: 'Positioned too close to the back glass. Limited swing path forced the ball into the net.', tip: 'Step 1–2 m forward before lobbing from the back glass.' },
    { time: '21:47', shot: 'Vibora', zone: 'Net Zone', cause: 'Timing', severity: 'high', explanation: 'Late contact behind the body. Loss of spin and direction, ball sailed wide.', tip: 'Contact point should be in front of the right shoulder.' },
    { time: '28:33', shot: 'Forehand Drive', zone: 'Mid Court', cause: 'Technique', severity: 'low', explanation: 'Arm fully extended at contact, reducing power transfer. Shot went wide.', tip: 'Keep a slight elbow bend at contact for better control.' },
    { time: '35:10', shot: 'Overhead Smash', zone: 'Net Zone', cause: 'Decision Making', severity: 'medium', explanation: 'Misjudged trajectory after glass rebound. Rushed prep led to off-center contact.', tip: 'Let the ball drop lower after a glass rebound before attacking.' },
    { time: '41:55', shot: 'Serve', zone: 'Baseline', cause: 'Technique', severity: 'low', explanation: 'Toss behind the baseline caused excessive spin without pace.', tip: 'Toss 20–30 cm in front of the baseline for more penetrating serves.' },
    { time: '49:08', shot: 'Bandeja', zone: 'Mid Court', cause: 'Timing', severity: 'medium', explanation: 'Late approach forced a defensive bandeja instead of an attacking shot.', tip: 'Start moving to the net 0.5 s earlier after your partner returns.' },
    { time: '55:30', shot: 'Cross-court Backhand', zone: 'Side Glass', cause: 'Positioning', severity: 'high', explanation: 'Standing too far right left the cross-court angle unguarded.', tip: 'Hold a more central position when your partner is at the net.' },
    { time: '1:03:14', shot: 'Volley', zone: 'Net Zone', cause: 'Footwork', severity: 'medium', explanation: 'Feet stationary at contact. Lack of weight transfer reduced power and precision.', tip: 'Step into volleys — transfer weight forward at impact.' },
    { time: '1:09:40', shot: 'Drop Shot', zone: 'Mid Court', cause: 'Decision Making', severity: 'low', explanation: 'Drop shot attempted from mid-court while out of position. Opponents anticipated.', tip: 'Reserve drop shots for when you are at the net with strong position.' },
    { time: '1:15:22', shot: 'Forehand Lob', zone: 'Back Glass', cause: 'Technique', severity: 'medium', explanation: 'Under-rotated shoulders produced a flat lob that was easily smashed.', tip: 'Full shoulder rotation gives height and arc to defensive lobs.' },
    { time: '1:21:05', shot: 'Return', zone: 'Baseline', cause: 'Timing', severity: 'high', explanation: 'Early swing on a kick serve sent the ball out. Wait for the bounce to slow.', tip: 'Read the serve spin early and let the ball peak before striking.' },
  ],
  de: [
    { time: '08:15', shot: 'Backhand Slice', zone: 'Netzbereich', cause: 'Technik', severity: 'high', explanation: 'Handgelenk zu steif beim Durchschwingen. Ball streifte das Netz wegen zu flachem Schlägerkopfwinkel.', tip: 'Schlägerfläche beim Backhand Slice am Netz 10° mehr öffnen.' },
    { time: '14:22', shot: 'Defensiver Lob', zone: 'Hinterwand', cause: 'Positionierung', severity: 'medium', explanation: 'Zu nah an der Hinterwand gestanden. Eingeschränkte Schwungbahn zwang den Ball ins Netz.', tip: '1–2 m nach vorne treten, bevor du von der Hinterwand lobst.' },
    { time: '21:47', shot: 'Vibora', zone: 'Netzbereich', cause: 'Timing', severity: 'high', explanation: 'Zu später Treffpunkt hinter dem Körper. Verlust von Drall und Richtung, Ball flog ins Aus.', tip: 'Treffpunkt sollte vor der rechten Schulter liegen.' },
    { time: '28:33', shot: 'Vorhand Drive', zone: 'Mittelfeldbereich', cause: 'Technik', severity: 'low', explanation: 'Arm beim Aufprall vollständig gestreckt, reduzierter Krafttransfer. Ball ins Aus.', tip: 'Leichte Ellbogenbeugung beim Treffen für bessere Kontrolle beibehalten.' },
    { time: '35:10', shot: 'Overhead Smash', zone: 'Netzbereich', cause: 'Entscheidungsfindung', severity: 'medium', explanation: 'Flugkurve nach Glasrebound falsch eingeschätzt. Gehetzter Schlag führte zu dezentralem Treffen.', tip: 'Ball nach Glasrebound tiefer fallen lassen, bevor du angreifst.' },
    { time: '41:55', shot: 'Aufschlag', zone: 'Grundlinie', cause: 'Technik', severity: 'low', explanation: 'Ballwurf hinter der Grundlinie verursachte zu viel Drall ohne Tempo.', tip: 'Ballwurf 20–30 cm vor der Grundlinie für durchdringendere Aufschläge.' },
    { time: '49:08', shot: 'Bandeja', zone: 'Mittelfeldbereich', cause: 'Timing', severity: 'medium', explanation: 'Zu spätes Anlaufen erzwang eine defensive statt angreifende Bandeja.', tip: '0,5 s früher ans Netz bewegen, nachdem dein Partner returniert.' },
    { time: '55:30', shot: 'Diagonale Rückhand', zone: 'Seitenwand', cause: 'Positionierung', severity: 'high', explanation: 'Zu weit rechts gestanden – diagonaler Winkel war ungedeckt.', tip: 'Zentralere Position halten, wenn dein Partner am Netz steht.' },
    { time: '1:03:14', shot: 'Volley', zone: 'Netzbereich', cause: 'Fußarbeit', severity: 'medium', explanation: 'Füße beim Treffen still – fehlender Gewichtstransfer reduzierte Kraft und Präzision.', tip: 'In Volleys hineinstepppen – Gewicht beim Treffen nach vorne verlagern.' },
    { time: '1:09:40', shot: 'Drop Shot', zone: 'Mittelfeldbereich', cause: 'Entscheidungsfindung', severity: 'low', explanation: 'Drop Shot aus dem Mittelfeld in ungünstiger Position gespielt. Gegner hatten es erwartet.', tip: 'Drop Shots nur einsetzen, wenn du am Netz mit starker Position stehst.' },
    { time: '1:15:22', shot: 'Vorhand Lob', zone: 'Hinterwand', cause: 'Technik', severity: 'medium', explanation: 'Unvollständige Schulterrotation erzeugte einen flachen Lob, der leicht geschmettert wurde.', tip: 'Vollständige Schulterrotation gibt dem defensiven Lob Höhe und Bogen.' },
    { time: '1:21:05', shot: 'Return', zone: 'Grundlinie', cause: 'Timing', severity: 'high', explanation: 'Zu früher Schwung bei Kick-Aufschlag schickte den Ball ins Aus. Auf den Absprung warten.', tip: 'Aufschlag-Drall früh erkennen und Ball den Höhepunkt erreichen lassen.' },
  ],
  es: [
    { time: '08:15', shot: 'Slice de Revés', zone: 'Zona de Red', cause: 'Técnica', severity: 'high', explanation: 'Muñeca demasiado rígida en el golpe de seguimiento. La bola rozó la red por ángulo insuficiente.', tip: 'Abre la cara de la raqueta 10° más en los slices de revés cerca de la red.' },
    { time: '14:22', shot: 'Globo Defensivo', zone: 'Cristal Trasero', cause: 'Posicionamiento', severity: 'medium', explanation: 'Demasiado cerca del cristal trasero. El recorrido limitado del swing forzó la bola a la red.', tip: 'Avanza 1–2 m antes de ejecutar el globo desde el cristal trasero.' },
    { time: '21:47', shot: 'Víbora', zone: 'Zona de Red', cause: 'Timing', severity: 'high', explanation: 'Contacto tardío detrás del cuerpo. Pérdida de efecto y dirección, la bola salió fuera.', tip: 'El punto de contacto debe estar frente al hombro derecho.' },
    { time: '28:33', shot: 'Drive de Derecha', zone: 'Zona Central', cause: 'Técnica', severity: 'low', explanation: 'Brazo completamente extendido al contacto, reduciendo la transferencia de potencia. Bola fuera.', tip: 'Mantén una ligera flexión del codo al golpear para mejor control.' },
    { time: '35:10', shot: 'Remate por Alto', zone: 'Zona de Red', cause: 'Toma de Decisiones', severity: 'medium', explanation: 'Trayectoria mal calculada tras el rebote en cristal. La preparación apresurada causó contacto descentrado.', tip: 'Deja que la bola baje más tras el rebote en cristal antes de atacar.' },
    { time: '41:55', shot: 'Saque', zone: 'Línea de Fondo', cause: 'Técnica', severity: 'low', explanation: 'El lanzamiento detrás de la línea causó demasiado efecto sin velocidad.', tip: 'Lanza la bola 20–30 cm por delante de la línea para saques más penetrantes.' },
    { time: '49:08', shot: 'Bandeja', zone: 'Zona Central', cause: 'Timing', severity: 'medium', explanation: 'Llegada tardía a la bola forzó una bandeja defensiva en vez de un golpe de ataque.', tip: 'Empieza a moverte hacia la red 0,5 s antes tras el resto de tu compañero.' },
    { time: '55:30', shot: 'Revés Cruzado', zone: 'Cristal Lateral', cause: 'Posicionamiento', severity: 'high', explanation: 'Demasiado desplazado a la derecha, dejando el ángulo cruzado sin cubrir.', tip: 'Mantén una posición más central cuando tu compañero esté en la red.' },
    { time: '1:03:14', shot: 'Volea', zone: 'Zona de Red', cause: 'Juego de Pies', severity: 'medium', explanation: 'Pies estáticos al contacto. La falta de transferencia de peso redujo potencia y precisión.', tip: 'Entra en las voleas — transfiere el peso hacia adelante al impactar.' },
    { time: '1:09:40', shot: 'Dejada', zone: 'Zona Central', cause: 'Toma de Decisiones', severity: 'low', explanation: 'Dejada intentada desde el centro sin buena posición. Los rivales la anticiparon.', tip: 'Reserva las dejadas para cuando estés en la red con buena posición.' },
    { time: '1:15:22', shot: 'Globo de Derecha', zone: 'Cristal Trasero', cause: 'Técnica', severity: 'medium', explanation: 'Rotación de hombros incompleta produjo un globo plano fácilmente rematado.', tip: 'La rotación completa de hombros da altura y arco a los globos defensivos.' },
    { time: '1:21:05', shot: 'Resto', zone: 'Línea de Fondo', cause: 'Timing', severity: 'high', explanation: 'Swing anticipado en un saque con efecto envió la bola fuera. Espera a que la bola aminore.', tip: 'Lee el efecto del saque pronto y deja que la bola alcance su punto máximo.' },
  ],
  fr: [
    { time: '08:15', shot: 'Slice Revers', zone: 'Zone Filet', cause: 'Technique', severity: 'high', explanation: 'Poignet trop rigide lors du suivi. La balle a touché le filet par manque d\'angle de lift.', tip: 'Ouvrir la face de raquette de 10° de plus sur les slices revers près du filet.' },
    { time: '14:22', shot: 'Lob Défensif', zone: 'Vitre Arrière', cause: 'Placement', severity: 'medium', explanation: 'Trop proche de la vitre arrière. Le chemin de swing limité a forcé la balle dans le filet.', tip: 'Avancer de 1–2 m avant de lober depuis la vitre arrière.' },
    { time: '21:47', shot: 'Vibora', zone: 'Zone Filet', cause: 'Timing', severity: 'high', explanation: 'Contact tardif derrière le corps. Perte d\'effet et de direction, balle largement out.', tip: 'Le point de contact doit être devant l\'épaule droite.' },
    { time: '28:33', shot: 'Drive Coup Droit', zone: 'Milieu de Court', cause: 'Technique', severity: 'low', explanation: 'Bras entièrement étendu au contact, réduisant le transfert de puissance. Balle out.', tip: 'Conserver une légère flexion du coude au contact pour un meilleur contrôle.' },
    { time: '35:10', shot: 'Smash par Dessus', zone: 'Zone Filet', cause: 'Prise de Décision', severity: 'medium', explanation: 'Trajectoire mal jugée après le rebond sur vitre. Préparation précipitée entraînant un contact décentré.', tip: 'Laisser la balle descendre plus bas après un rebond sur vitre avant d\'attaquer.' },
    { time: '41:55', shot: 'Service', zone: 'Ligne de Fond', cause: 'Technique', severity: 'low', explanation: 'Le lancer derrière la ligne a causé trop d\'effet sans vitesse.', tip: 'Lancer la balle 20–30 cm devant la ligne de fond pour des services plus pénétrants.' },
    { time: '49:08', shot: 'Bandeja', zone: 'Milieu de Court', cause: 'Timing', severity: 'medium', explanation: 'Arrivée tardive sur la balle forçant une bandeja défensive plutôt qu\'offensive.', tip: 'Commencer à monter au filet 0,5 s plus tôt après le retour de votre partenaire.' },
    { time: '55:30', shot: 'Revers Croisé', zone: 'Vitre Latérale', cause: 'Placement', severity: 'high', explanation: 'Trop décalé à droite, laissant l\'angle croisé non couvert.', tip: 'Maintenir une position plus centrale quand votre partenaire est au filet.' },
    { time: '1:03:14', shot: 'Volée', zone: 'Zone Filet', cause: 'Jeu de Jambes', severity: 'medium', explanation: 'Pieds immobiles au contact. Manque de transfert de poids réduisant puissance et précision.', tip: 'Entrer dans les volées — transférer le poids vers l\'avant à l\'impact.' },
    { time: '1:09:40', shot: 'Amorti', zone: 'Milieu de Court', cause: 'Prise de Décision', severity: 'low', explanation: 'Amorti tenté depuis le milieu du court en mauvaise position. Les adversaires l\'ont anticipé.', tip: 'Réserver les amortis pour quand vous êtes au filet avec une bonne position.' },
    { time: '1:15:22', shot: 'Lob Coup Droit', zone: 'Vitre Arrière', cause: 'Technique', severity: 'medium', explanation: 'Rotation des épaules incomplète produisant un lob plat facilement smasché.', tip: 'La rotation complète des épaules donne hauteur et arc aux lobs défensifs.' },
    { time: '1:21:05', shot: 'Retour', zone: 'Ligne de Fond', cause: 'Timing', severity: 'high', explanation: 'Swing trop précoce sur un service lifté envoyant la balle out. Attendre que le rebond ralentisse.', tip: 'Lire l\'effet du service tôt et laisser la balle atteindre son pic avant de frapper.' },
  ],
};

type PhonePosI18n = { name: string; short: string; description: string; pros: string[]; cons: string[] };
const PHONE_POS_I18N: Record<LocaleCode, Record<string, PhonePosI18n>> = {
  en: {
    '1': {
      name: 'Center Baseline (Best)',
      short: 'Center',
      description: 'Place at center of back fence, 2.5m height. Full court view capturing both players and glass rebounds.',
      pros: ['Full court coverage', 'Both players always visible', 'Glass rebounds captured'],
      cons: ['Needs tripod or fence clip mount'],
    },
    '2': {
      name: 'Corner Diagonal',
      short: 'Corner',
      description: 'Diagonal from corner at 2m height. Great 3D perspective showing court depth and player positioning.',
      pros: ['Depth perception', 'Unique angle for positioning analysis'],
      cons: ['Opposite corner has small blind spot'],
    },
    '3': {
      name: 'Side Fence Mid',
      short: 'Side',
      description: 'Halfway along the side fence at 2m height. Best for analyzing lateral movement and cross-court exchanges.',
      pros: ['Clear lateral movement tracking', 'Ideal for glass play analysis'],
      cons: ['Net post can block near player', 'Misses far side details'],
    },
  },
  de: {
    '1': {
      name: 'Mitte Hinterzaun (Beste)',
      short: 'Mitte',
      description: 'Mittig am hinteren Zaun in 2,5 m Höhe anbringen. Volle Sicht aufs Feld — beide Spieler und Glas-Rebounds im Bild.',
      pros: ['Komplette Feldabdeckung', 'Beide Spieler immer sichtbar', 'Glas-Rebounds im Bild'],
      cons: ['Stativ oder Zaunhalterung nötig'],
    },
    '2': {
      name: 'Ecke Diagonal',
      short: 'Ecke',
      description: 'Diagonal aus der Ecke in 2 m Höhe. Starke 3D-Perspektive für Feldtiefe und Spielerpositionen.',
      pros: ['Gute Tiefenwirkung', 'Einzigartiger Winkel für Positionsanalyse'],
      cons: ['Kleiner toter Winkel in der Gegenecke'],
    },
    '3': {
      name: 'Seitenzaun Mitte',
      short: 'Seite',
      description: 'Auf halber Länge des Seitenzauns in 2 m Höhe. Ideal für Seitwärtsbewegung und Cross-Schläge.',
      pros: ['Seitliche Bewegungen klar erkennbar', 'Ideal für Glas-Analyse'],
      cons: ['Netzpfosten kann nahen Spieler verdecken', 'Details der Gegenseite fehlen'],
    },
  },
  es: {
    '1': {
      name: 'Centro Fondo (Mejor)',
      short: 'Centro',
      description: 'Coloca en el centro de la valla trasera, a 2,5 m de altura. Vista completa de la pista con ambos jugadores y rebotes en el cristal.',
      pros: ['Cobertura total de la pista', 'Ambos jugadores siempre visibles', 'Rebotes en cristal capturados'],
      cons: ['Requiere trípode o soporte de valla'],
    },
    '2': {
      name: 'Esquina Diagonal',
      short: 'Esquina',
      description: 'En diagonal desde la esquina a 2 m de altura. Gran perspectiva 3D de profundidad y posicionamiento.',
      pros: ['Percepción de profundidad', 'Ángulo único para análisis de posición'],
      cons: ['Pequeño punto ciego en la esquina opuesta'],
    },
    '3': {
      name: 'Valla Lateral Media',
      short: 'Lateral',
      description: 'A mitad de la valla lateral, a 2 m de altura. Ideal para movimiento lateral e intercambios cruzados.',
      pros: ['Seguimiento claro del movimiento lateral', 'Ideal para análisis del juego con cristal'],
      cons: ['El poste de la red puede tapar al jugador cercano', 'Pierde detalles del lado lejano'],
    },
  },
  fr: {
    '1': {
      name: 'Centre Fond (Meilleur)',
      short: 'Centre',
      description: 'Placez au centre du grillage arrière, à 2,5 m de hauteur. Vue complète du terrain avec les deux joueurs et les rebonds sur la vitre.',
      pros: ['Couverture totale du terrain', 'Les deux joueurs toujours visibles', 'Rebonds sur vitre capturés'],
      cons: ['Trépied ou fixation grillage nécessaire'],
    },
    '2': {
      name: 'Coin Diagonal',
      short: 'Coin',
      description: 'En diagonale depuis le coin à 2 m de hauteur. Belle perspective 3D pour la profondeur et le placement.',
      pros: ['Perception de la profondeur', "Angle unique pour l'analyse du placement"],
      cons: ['Petit angle mort dans le coin opposé'],
    },
    '3': {
      name: 'Grillage Latéral Milieu',
      short: 'Côté',
      description: 'À mi-longueur du grillage latéral, à 2 m de hauteur. Idéal pour les déplacements latéraux et les échanges croisés.',
      pros: ['Suivi clair des déplacements latéraux', "Idéal pour l'analyse du jeu de vitre"],
      cons: ['Le poteau du filet peut masquer le joueur proche', 'Détails du côté opposé manquants'],
    },
  },
};

function generateMatchErrors(match: StoredMatch, locale: LocaleCode): ErrorEntry[] {
  // Use real AI-generated tips if available (new matches)
  if (match.result.coachingTips && match.result.coachingTips.length > 0) {
    return match.result.coachingTips.map((tip, i) => ({
      id: String(i + 1),
      time: '',
      shot: tip.shot,
      zone: tip.zone,
      cause: tip.cause,
      severity: tip.severity,
      explanation: tip.explanation,
      tip: tip.tip,
    }));
  }
  // Fallback: pool for legacy matches without real tips
  const pool = ERROR_POOL_BY_LOCALE[locale] ?? ERROR_POOL_BY_LOCALE.en;
  const n = Math.min(Math.max(0, match.result.errors), pool.length);
  let seed = [...match.id].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const indices = Array.from({ length: pool.length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    seed = ((seed * 1664525 + 1013904223) | 0) >>> 0;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map((poolIdx, i) => ({ ...pool[poolIdx], id: String(i + 1) }));
}

export default function AnalysisScreen({ navigation, route }: { navigation: any; route: any }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const { userId, markFreeAnalysisDone } = useAuth();
  const { addMatch, updateMatchMedia, deleteMatch, matches } = useMatches();
  const [tab, setTab] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [recordModal, setRecordModal] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const [modalState, setModalState] = useState<'checklist' | 'countdown' | 'saved'>('checklist');
  const [countdownLeft, setCountdownLeft] = useState<number | null>(null);
  const [customCountdown, setCustomCountdown] = useState('');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [selectedPos, setSelectedPos] = useState('1');
  const [playerPosition, setPlayerPosition] = useState<PlayerPosition | null>(null);
  const [showPositionPicker, setShowPositionPicker] = useState(false);
  const [pendingVideoAction, setPendingVideoAction] = useState<'record' | 'upload' | null>(null);
  const playerPositionRef = useRef<PlayerPosition | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [recBlink, setRecBlink] = useState(true);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoSaved, setVideoSaved] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [analysisModal, setAnalysisModal] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);
  const [analysisPhase, setAnalysisPhase] = useState(0);
  const [analysisPct, setAnalysisPct] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [selectedAnalysisIdx, setSelectedAnalysisIdx] = useState(0);
  const aiPulse = useRef(new Animated.Value(1)).current;
  const aiScan = useRef(new Animated.Value(0)).current;
  const aiRing = useRef(new Animated.Value(0)).current;
  const cameraRef = useRef<CameraView>(null);
  const pendingRecordRef = useRef(false);
  const scrubberRef = useRef<ScrubberHandle>(null);
  const apiResultRef = useRef<ClaudeAnalysisResult | null>(null);
  const videoThumbnailRef = useRef<string | null>(null);
  const permanentVideoUriRef = useRef<string | null>(null);
  const matchIdRef = useRef<string>(Date.now().toString());
  const supabaseThumbnailUrlRef = useRef<string | null>(null);
  const updateMatchMediaRef = useRef(updateMatchMedia);
  const completionTriggeredRef = useRef(false);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  updateMatchMediaRef.current = updateMatchMedia;
  const [apiSettled, setApiSettled] = useState(false);
  const [fileOpsDone, setFileOpsDone] = useState(false);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const [selectedThumbnail, setSelectedThumbnail] = useState<string | null>(null);
  const [opponent, setOpponent] = useState('');
  const [videoSearch, setVideoSearch] = useState('');
  const [errorMatchIdx, setErrorMatchIdx] = useState(0);

  const TABS = useMemo(() => [t('analysis.tab0'), t('analysis.tab1'), t('analysis.tab2'), t('analysis.tab3')], [locale]);
  const CHECKLIST = useMemo(() => [
    t('analysis.check1'), t('analysis.check2'), t('analysis.check3'),
    t('analysis.check4'), t('analysis.check5'),
  ], [locale]);
  const RECORDING_TIPS = useMemo(() => [
    { icon: 'phone-landscape', tip: t('analysis.tip1') },
    { icon: 'battery-charging', tip: t('analysis.tip2') },
    { icon: 'sunny', tip: t('analysis.tip3') },
    { icon: 'save', tip: t('analysis.tip4') },
    { icon: 'options', tip: t('analysis.tip5') },
  ], [locale]);

  useFocusEffect(useCallback(() => {
    if (route?.params?.startRecord) {
      navigation.setParams({ startRecord: false });
      openRecord();
    }
    return () => {};
  }, [route?.params?.startRecord]));

  const totalFrames = Math.max(1800, recordSeconds * 30);
  const pos = phonePositions.find(p => p.id === selectedPos)!;
  const posI18n = (PHONE_POS_I18N[locale] ?? PHONE_POS_I18N.en)[pos.id]
    ?? { name: pos.name, short: `Pos ${pos.id}`, description: pos.description, pros: pos.pros, cons: pos.cons };
  const safeAnalysisIdx = Math.min(selectedAnalysisIdx, Math.max(0, matches.length - 1));
  const selectedAnalysisMatch = matches.length > 0 ? matches[safeAnalysisIdx] : null;
  const selectedScoreColor =
    !selectedAnalysisMatch ? colors.primary :
    selectedAnalysisMatch.result.score >= 65 ? colors.primary :
    selectedAnalysisMatch.result.score >= 50 ? colors.blue :
    colors.danger;
  const displayedVideoUri = selectedAnalysisMatch?.videoUri ?? videoUri;
  const safeErrorMatchIdx = Math.min(errorMatchIdx, Math.max(0, matches.length - 1));
  const errorMatch = matches.length > 0 ? matches[safeErrorMatchIdx] : null;
  const errorMatchErrors: ErrorEntry[] = errorMatch ? generateMatchErrors(errorMatch, locale) : [];
  const totalErrors = errorMatchErrors.length;
  const highErrors = errorMatchErrors.filter(e => e.severity === 'high').length;
  const allChecked = checkedItems.size === CHECKLIST.length;
  const countdownSecs = parseInt(customCountdown) || 0;
  const displayedThumbnail = selectedAnalysisMatch ? selectedThumbnail : videoThumbnail;
  const filteredMatches = useMemo(() => {
    if (!videoSearch.trim()) return matches;
    const q = videoSearch.toLowerCase();
    return matches.filter(m => m.opponent?.toLowerCase().includes(q));
  }, [matches, videoSearch]);

  useEffect(() => { playerPositionRef.current = playerPosition; }, [playerPosition]);

  // Mediathek-Berechtigung proaktiv anfragen sobald Status bekannt ist
  useEffect(() => {
    if (mediaPermission !== null && !mediaPermission.granted && mediaPermission.canAskAgain) {
      requestMediaPermission();
    }
  }, [mediaPermission?.status]);

  useEffect(() => {
    if (!selectedAnalysisMatch) { setSelectedThumbnail(null); return; }
    // Gespeichertes Thumbnail bevorzugen (permanent)
    if (selectedAnalysisMatch.thumbnailUri) {
      setSelectedThumbnail(selectedAnalysisMatch.thumbnailUri);
      return;
    }
    // Fallback: Thumbnail aus lokalem Video generieren (nicht für HTTPS-URLs)
    if (!selectedAnalysisMatch.videoUri) { setSelectedThumbnail(null); return; }
    if (selectedAnalysisMatch.videoUri.startsWith('https://')) { setSelectedThumbnail(null); return; }
    VideoThumbnails.getThumbnailAsync(selectedAnalysisMatch.videoUri, {
      time: 100,
      quality: 0.8,
    })
      .then(({ uri }) => setSelectedThumbnail(uri))
      .catch(() => setSelectedThumbnail(null));
  }, [selectedAnalysisMatch?.id, selectedAnalysisMatch?.thumbnailUri]);

  useEffect(() => {
    if (!analysisDone || analysisResult) return;

    const api = apiResultRef.current;

    const resetAnalysis = () => {
      setAnalysisModal(false);
      setAnalysisDone(false);
      setAnalysisPct(0);
      setAnalysisResult(null);
      completionTriggeredRef.current = false;
      if (completionTimerRef.current) { clearTimeout(completionTimerRef.current); completionTimerRef.current = null; }
    };

    if (!api) {
      resetAnalysis();
      Alert.alert(t('analysis.aiErrorTitle'), t('analysis.aiErrorMsg'), [{ text: 'OK' }]);
      return;
    }

    if (!api.isPadel) {
      resetAnalysis();
      Alert.alert(t('analysis.noPadelTitle'), t('analysis.noPadelMsg'), [{ text: 'OK' }]);
      return;
    }

    const { shots, winners, errors, errorRate, coverage, avgRally, score, skillLevel, coachingTips, zones, shots_timeline } = api;

    const fb = buildFeedback(
      shots, winners, errorRate, coverage, avgRally,
      AI_STRENGTHS_BY_LOCALE[locale],
      AI_IMPROVEMENTS_BY_LOCALE[locale],
    );
    const result: AnalysisResult = {
      shots, winners, errors, errorRate, score, coverage, avgRally,
      strengths: fb.strengths,
      improvements: fb.improvements,
      strengthKeys: fb.strengthKeys,
      improvementKeys: fb.improvementKeys,
      coachingTips: coachingTips ?? undefined,
      skillLevel: skillLevel ?? undefined,
      zones: zones ?? undefined,
      shots_timeline: shots_timeline ?? undefined,
    };
    setAnalysisResult(result);
    addMatch({
      id: matchIdRef.current,
      date: new Date().toISOString(),
      recordSeconds,
      videoUri: permanentVideoUriRef.current ?? videoUri,
      thumbnailUri: supabaseThumbnailUrlRef.current ?? videoThumbnailRef.current,
      opponent: opponent.trim() || undefined,
      playerPosition: playerPositionRef.current ?? undefined,
      result,
    });
    setSelectedAnalysisIdx(0);

    // Free analysis used — trigger paywall via App.tsx state after short delay
    isProActive().then(pro => {
      if (!pro && userId) {
        setTimeout(() => markFreeAnalysisDone(), 4000);
      }
    }).catch(() => {});
  }, [analysisDone, recordSeconds, videoUri, addMatch, locale, userId]);

  useEffect(() => {
    if (!videoUri) return; // null case handled in stopRec / beginRecording error path

    const saveAll = async () => {
      const matchId = matchIdRef.current;
      const videoDir = (FileSystem.documentDirectory ?? '') + 'padelvision_videos/';
      const thumbDir = (FileSystem.documentDirectory ?? '') + 'padelvision_thumbs/';

      // 1. Lokale Kopie erst abwarten, dann fileOpsDone setzen
      if (videoUri !== permanentVideoUriRef.current) {
        const permanentUri = videoDir + matchId + '.mp4';
        try {
          await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
          await FileSystem.copyAsync({ from: videoUri, to: permanentUri });
          permanentVideoUriRef.current = permanentUri;
        } catch {
          permanentVideoUriRef.current = videoUri;
        }
      }
      setFileOpsDone(true);

      // 2. Thumbnail generieren und dauerhaft sichern + Supabase-Upload
      let thumbP: Promise<string | null> = Promise.resolve(null);
      try {
        const { uri: tmpUri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 100, quality: 0.8 });
        setVideoThumbnail(tmpUri);
        let localThumbUri = tmpUri;
        try {
          await FileSystem.makeDirectoryAsync(thumbDir, { intermediates: true });
          const thumbUri = thumbDir + matchId + '.jpg';
          await FileSystem.copyAsync({ from: tmpUri, to: thumbUri });
          videoThumbnailRef.current = thumbUri;
          localThumbUri = thumbUri;
        } catch {
          videoThumbnailRef.current = tmpUri;
        }
        thumbP = supaUploadThumbnail(localThumbUri, matchId)
          .then(url => { if (url) supabaseThumbnailUrlRef.current = url; return url ?? null; })
          .catch(() => null);
      } catch {
        // Thumbnail optional — proceed anyway
      }

      // Thumbnail in Memory + DB aktualisieren; Video bleibt lokal
      thumbP.then(tUrl => {
        if (tUrl) {
          updateMatchMediaRef.current(matchId, null, tUrl);
          setTimeout(() => updateMatchUrls(matchId, null, tUrl).catch(() => {}), 3000);
        }
      }).catch(() => {});

      // 3. In Galerie speichern (non-blocking)
      if (mediaPermission?.granted) {
        MediaLibrary.saveToLibraryAsync(videoUri)
          .then(() => setVideoSaved(true))
          .catch(() => {});
      } else {
        requestMediaPermission().then(res => {
          if (res.granted) {
            MediaLibrary.saveToLibraryAsync(videoUri)
              .then(() => setVideoSaved(true))
              .catch(() => {});
          }
        }).catch(() => {});
      }
    };
    saveAll();

    // API-Analyse parallel starten
    apiResultRef.current = null;
    const hardTimeout = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 90_000),
    );
    Promise.race([
      analyzeVideo(videoUri, recordSeconds, locale, playerPositionRef.current ?? undefined),
      hardTimeout,
    ])
      .then(result => { apiResultRef.current = result; setApiSettled(true); })
      .catch(() => { setApiSettled(true); });
  }, [videoUri]);

  // Wenn API fertig UND Dateioperationen abgeschlossen → auf 100% springen und analysisDone auslösen
  useEffect(() => {
    if (!apiSettled || !fileOpsDone || !analysisModal || analysisDone) return;
    if (analysisPct < 95) return;
    if (completionTriggeredRef.current) return;
    completionTriggeredRef.current = true;
    setAnalysisPct(100);
    completionTimerRef.current = setTimeout(() => setAnalysisDone(true), 300);
  }, [apiSettled, fileOpsDone, analysisModal, analysisDone, analysisPct]);

  useEffect(() => {
    if (recording) {
      const id = setInterval(() => setRecordSeconds(n => n + 1), 1000);
      return () => clearInterval(id);
    }
  }, [recording]);

  useEffect(() => {
    if (recording) {
      const id = setInterval(() => setRecBlink(b => !b), 600);
      return () => clearInterval(id);
    } else {
      setRecBlink(true);
    }
  }, [recording]);

  useEffect(() => {
    if (modalState !== 'countdown' || countdownLeft === null) return;
    if (countdownLeft === 0) {
      beginRecording();
      return;
    }
    const id = setTimeout(() => setCountdownLeft(n => (n ?? 1) - 1), 1000);
    return () => clearTimeout(id);
  }, [modalState, countdownLeft]);

  useEffect(() => {
    if (!analysisModal || analysisDone) return;

    Animated.loop(Animated.sequence([
      Animated.timing(aiPulse, { toValue: 1.12, duration: 1800, useNativeDriver: true }),
      Animated.timing(aiPulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(aiScan, { toValue: 1, duration: 2200, useNativeDriver: true }),
      Animated.timing(aiScan, { toValue: 0, duration: 2200, useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.timing(aiRing, { toValue: 1, duration: 4000, useNativeDriver: true })).start();

    const pctId = setInterval(() => {
      setAnalysisPct(p => Math.min(96, p + 96 / 400));
    }, 200);

    const phaseId = setInterval(() => {
      setAnalysisPhase(p => (p + 1) % AI_PHASES_BY_LOCALE[locale].length);
    }, 1700);

    const fpsRate = Math.ceil(totalFrames / 100);
    const frameId = setInterval(() => {
      setFrameCount(f => Math.min(totalFrames, f + fpsRate + Math.floor(Math.random() * fpsRate * 0.4)));
    }, 200);

    const safetyId = setTimeout(() => setApiSettled(true), 90_000);
    const fileOpsSafetyId = setTimeout(() => setFileOpsDone(true), 20_000);

    return () => { clearInterval(pctId); clearInterval(phaseId); clearInterval(frameId); clearTimeout(safetyId); clearTimeout(fileOpsSafetyId); };
  }, [analysisModal, analysisDone]);

  const prepareRecord = () => {
    if (!cameraPermission?.granted) requestCameraPermission();
    if (!mediaPermission?.granted) requestMediaPermission();
    setModalState('checklist');
    setCheckedItems(new Set());
    setRecordSeconds(0);
    setCountdownLeft(null);
    setCustomCountdown('');
    setRecording(false);
    setVideoUri(null);
    setVideoSaved(false);
    apiResultRef.current = null;
    videoThumbnailRef.current = null;
    permanentVideoUriRef.current = null;
    matchIdRef.current = Date.now().toString();

    supabaseThumbnailUrlRef.current = null;
    pendingRecordRef.current = false;
    setApiSettled(false);
    setFileOpsDone(false);
    setVideoThumbnail(null);
    setOpponent('');
    setRecordModal(true);
  };

  const checkAnalysisAccess = async (): Promise<boolean> => {
    const pro = await isProActive().catch(() => false);
    if (pro) return true;
    if (!userId) return true;
    const done = await AsyncStorage.getItem(`@padelvision/free_analysis_done_${userId}`).catch(() => null);
    if (done === 'true') {
      try { navigation.navigate('Paywall'); } catch {}
      return false;
    }
    // Also check Supabase — handles reinstalls where AsyncStorage is empty
    try {
      const { count } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      if ((count ?? 0) >= 1) {
        await AsyncStorage.setItem(`@padelvision/free_analysis_done_${userId}`, 'true').catch(() => {});
        try { navigation.navigate('Paywall'); } catch {}
        return false;
      }
    } catch {}
    return true;
  };

  const openRecord = async () => {
    if (!(await checkAnalysisAccess())) return;
    setPlayerPosition(null);
    setPendingVideoAction('record');
    setShowPositionPicker(true);
  };

  const doRecord = async () => {
    const show = await shouldShowTutorial();
    if (show) {
      setTutorialVisible(true);
    } else {
      prepareRecord();
    }
  };

  const openUpload = async () => {
    if (!(await checkAnalysisAccess())) return;
    setPlayerPosition(null);
    setPendingVideoAction('upload');
    setShowPositionPicker(true);
  };

  const doUpload = async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert(t('analysis.permissionMediaTitle'), t('analysis.permissionMediaMsg'));
      return;
    }

    let result: ImagePicker.ImagePickerResult | null = null;
    try {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        quality: 1,
        allowsEditing: false,
      });
    } catch (e: any) {
      console.error('[Upload] launchImageLibraryAsync error:', e?.message ?? e);
      return;
    }

    if (!result || result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const secs = Math.max(1, Math.round((asset.duration ?? 0) / 1000));
    const newMatchId = Date.now().toString();

    // content://-URIs sind temporär — sofort in file:// kopieren damit Thumbnail + KI + Playback funktionieren
    const videoDir = (FileSystem.documentDirectory ?? '') + 'padelvision_videos/';
    const permanentUri = videoDir + newMatchId + '.mp4';
    let finalUri = asset.uri;
    try {
      await FileSystem.makeDirectoryAsync(videoDir, { intermediates: true });
      await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });
      finalUri = permanentUri;
    } catch (e: any) {
      console.warn('[Upload] copy to permanent failed:', e?.message ?? e);
    }

    apiResultRef.current = null;
    videoThumbnailRef.current = null;
    permanentVideoUriRef.current = finalUri;
    matchIdRef.current = newMatchId;

    supabaseThumbnailUrlRef.current = null;
    setRecordSeconds(secs);
    setAnalysisDone(false);
    setAnalysisPhase(0);
    setAnalysisPct(0);
    setFrameCount(0);
    setAnalysisResult(null);
    setApiSettled(false);
    setFileOpsDone(false);
    setVideoThumbnail(null);
    setOpponent('');
    completionTriggeredRef.current = false;
    if (completionTimerRef.current) { clearTimeout(completionTimerRef.current); completionTimerRef.current = null; }
    aiPulse.setValue(1);
    aiScan.setValue(0);
    aiRing.setValue(0);
    setAnalysisModal(true);
    setVideoUri(finalUri);
  };

  const handlePositionConfirm = () => {
    setShowPositionPicker(false);
    const action = pendingVideoAction;
    setPendingVideoAction(null);
    if (action === 'record') doRecord();
    else if (action === 'upload') doUpload();
  };

  const startRec = () => {
    setModalState('countdown');
    setCountdownLeft(null);
  };

  const beginRecording = async () => {
    setRecordModal(false);

    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) {
      Alert.alert(t('analysis.permissionCameraTitle'), t('analysis.permissionCameraMsg'));
      return;
    }

    let result: ImagePicker.ImagePickerResult | null = null;
    try {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        quality: 1,
        videoMaxDuration: 600,
        allowsEditing: false,
      });
    } catch (e: any) {
      console.error('[Camera] launchCameraAsync error:', e?.message ?? e);
      return;
    }

    if (!result || result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    const secs = Math.max(1, Math.round((asset.duration ?? 0) / 1000));

    setRecordSeconds(secs);
    setAnalysisDone(false);
    setAnalysisPhase(0);
    setAnalysisPct(0);
    setFrameCount(0);
    setAnalysisResult(null);
    completionTriggeredRef.current = false;
    if (completionTimerRef.current) { clearTimeout(completionTimerRef.current); completionTimerRef.current = null; }
    aiPulse.setValue(1);
    aiScan.setValue(0);
    aiRing.setValue(0);
    setAnalysisModal(true);
    setVideoUri(asset.uri);
  };

  const stopRec = () => {
    pendingRecordRef.current = false;
    if (cameraPermission?.granted) {
      cameraRef.current?.stopRecording();
    } else {
      setFileOpsDone(true); // No camera recording expected, nothing to wait for
    }
    setRecording(false);
    setFullscreenMode(false);
    setAnalysisDone(false);
    setAnalysisPhase(0);
    setAnalysisPct(0);
    setFrameCount(0);
    setAnalysisResult(null);
    completionTriggeredRef.current = false;
    if (completionTimerRef.current) { clearTimeout(completionTimerRef.current); completionTimerRef.current = null; }
    aiPulse.setValue(1);
    aiScan.setValue(0);
    aiRing.setValue(0);
    setAnalysisModal(true);
  };

  const toggleCheck = (i: number) => {
    const next = new Set(checkedItems);
    if (next.has(i)) next.delete(i); else next.add(i);
    setCheckedItems(next);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>{t('analysis.title')}</Text>
          <Text style={s.sub}>
            {matches.length > 0
              ? (matches[0].opponent ? `vs ${matches[0].opponent}` : new Date(matches[0].date).toLocaleDateString(DATE_LOCALE[locale], { day: '2-digit', month: 'short', year: 'numeric' }))
              : t('analysis.sessions')}
          </Text>
        </View>
        <View style={{ flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
          <TouchableOpacity style={s.recordBtn} onPress={openRecord}>
            <Ionicons name="radio-button-on" size={14} color="#fff" />
            <Text style={s.recordBtnText}>{t('analysis.record')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.uploadBtn} onPress={openUpload}>
            <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
            <Text style={s.uploadBtnText}>{t('analysis.upload')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.tabs}>
        {TABS.map((label, i) => (
          <TouchableOpacity key={i} style={[s.tab, tab === i && s.tabActive]} onPress={() => setTab(i)}>
            <Text style={[s.tabText, tab === i && s.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {tab === 0 && (
          <View>
            {/* Quick stats row */}
            {matches.length > 0 && (
              <View style={s.quickStatsRow}>
                <QuickStat icon="layers-outline" label={t('analysis.sessions')}
                  value={matches.length.toString()} color={colors.primary} s={s} />
                <QuickStat icon="stats-chart-outline" label={t('home.avgScore')}
                  value={Math.round(matches.reduce((a, m) => a + m.result.score, 0) / matches.length).toString()} color={colors.blue} s={s} />
                <QuickStat icon="tennisball-outline" label={t('home.shots')}
                  value={matches.reduce((a, m) => a + m.result.shots, 0).toString()} color={colors.purple} s={s} />
              </View>
            )}

            {/* Match History Picker */}
            {matches.length > 0 && (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.pickerRow}
                >
                  {matches.map((m, idx) => {
                    const sc =
                      m.result.score >= 65 ? colors.primary :
                      m.result.score >= 50 ? colors.blue :
                      colors.danger;
                    const isSel = idx === safeAnalysisIdx;
                    const dateStr = new Date(m.date).toLocaleDateString(
                      DATE_LOCALE[locale], { day: '2-digit', month: 'short' },
                    );
                    return (
                      <TouchableOpacity
                        key={m.id}
                        style={[s.pickerCard, isSel && { borderColor: sc, backgroundColor: sc + '14' }]}
                        onPress={() => setSelectedAnalysisIdx(idx)}
                        activeOpacity={0.72}
                      >
                        {m.thumbnailUri ? (
                          <View style={s.pickerThumb}>
                            <Image source={{ uri: m.thumbnailUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                          </View>
                        ) : (
                          <View style={[s.pickerThumb, { backgroundColor: '#0A1A0F' }]} />
                        )}
                        <Text style={[s.pickerDate, isSel && { color: colors.text }]}>{dateStr}</Text>
                        <Text style={[s.pickerScore, { color: sc }]}>{m.result.score}</Text>
                        <Text style={s.pickerDuration}>{fmtTime(m.recordSeconds)}</Text>
                        {isSel && <View style={[s.pickerActiveDot, { backgroundColor: sc }]} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Selected Match Score Card */}
                {selectedAnalysisMatch && (
                  <View style={[s.matchScoreCard, { borderLeftColor: selectedScoreColor }]}>
                    <View style={s.matchScoreLeft}>
                      <View style={s.matchScoreNumRow}>
                        <Text style={[s.matchScoreNum, { color: selectedScoreColor }]}>
                          {selectedAnalysisMatch.result.score}
                        </Text>
                        <Text style={s.matchScoreDenom}>/100</Text>
                      </View>
                      <View style={[s.matchBadge, { backgroundColor: selectedScoreColor + '22' }]}>
                        <Text style={[s.matchBadgeText, { color: selectedScoreColor }]}>
                          {selectedAnalysisMatch.result.score >= 80
                            ? t('analysis.excellent')
                            : selectedAnalysisMatch.result.score >= 65
                            ? t('analysis.good')
                            : t('analysis.developing')}
                        </Text>
                      </View>
                    </View>
                    <View style={s.matchScoreStats}>
                      <View style={s.matchStatCol}>
                        <Text style={[s.matchStatVal, { color: colors.blue }]}>
                          {selectedAnalysisMatch.result.coverage}%
                        </Text>
                        <Text style={s.matchStatLabel}>{t('analysis.courtCoverage')}</Text>
                      </View>
                      <View style={[s.matchStatDivider, { backgroundColor: colors.border }]} />
                      <View style={s.matchStatCol}>
                        <Text style={[s.matchStatVal, { color: colors.danger }]}>
                          {selectedAnalysisMatch.result.errorRate}%
                        </Text>
                        <Text style={s.matchStatLabel}>{t('analysis.errorRate')}</Text>
                      </View>
                      <View style={[s.matchStatDivider, { backgroundColor: colors.border }]} />
                      <View style={s.matchStatCol}>
                        <Text style={[s.matchStatVal, { color: colors.primary }]}>
                          {selectedAnalysisMatch.result.shots}
                        </Text>
                        <Text style={s.matchStatLabel}>{t('analysis.totalShots')}</Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}

            {displayedVideoUri ? (
              <TouchableOpacity style={s.videoCard} activeOpacity={0.85} onPress={() => navigation.navigate('VideoPlayer', { uri: displayedVideoUri })}>
                <View style={s.videoArea}>
                  {displayedThumbnail ? (
                    <Image source={{ uri: displayedThumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                      <View style={s.courtNet} />
                      <View style={s.courtLeft} />
                      <View style={s.courtRight} />
                    </View>
                  )}
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' }}>
                      <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                  <View style={s.videoLabels}>
                    <View style={s.aiBadge}><Text style={s.aiBadgeText}>{t('analysis.myRecording')}</Text></View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.7)" />
                      <Text style={s.videoTime}>{fmtTime(selectedAnalysisMatch?.recordSeconds ?? recordSeconds)}</Text>
                    </View>
                  </View>
                  {videoSaved && (
                    <View style={s.recSavedBadge}>
                      <Ionicons name="checkmark-circle" size={12} color="#4ADE80" />
                      <Text style={s.recSavedText}>{t('analysis.savedToPhotos')}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              <View style={s.videoCard}>
                <View style={s.videoArea}>
                  <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={s.courtNet} />
                    <View style={s.courtLeft} />
                    <View style={s.courtRight} />
                  </View>
                  <View style={s.videoControls}>
                    <TouchableOpacity style={s.skipBtn} onPress={() => scrubberRef.current?.skip(-15)}>
                      <Ionicons name="play-back" size={26} color="rgba(255,255,255,0.9)" />
                      <Text style={s.skipLabel}>15s</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setPlaying(!playing)}>
                      <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={64} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.skipBtn} onPress={() => scrubberRef.current?.skip(15)}>
                      <Ionicons name="play-forward" size={26} color="rgba(255,255,255,0.9)" />
                      <Text style={s.skipLabel}>15s</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={s.videoLabels}>
                    <View style={s.aiBadge}><Text style={s.aiBadgeText}>{t('analysis.aiTracking')}</Text></View>
                    <Text style={s.videoTime}>{lastMatch.score}</Text>
                  </View>
                </View>
                <VideoScrubber ref={scrubberRef} s={s} />
              </View>
            )}

            <ShotTimeline
              match={selectedAnalysisMatch}
              displayedVideoUri={displayedVideoUri}
              onShotPress={ts => { if (displayedVideoUri) navigation.navigate('VideoPlayer', { uri: displayedVideoUri, startTime: ts }); else {} }}
              colors={colors}
              s={s}
              t={t}
            />

            <Text style={s.sectionTitle}>{t('analysis.matchStats')}</Text>
            {selectedAnalysisMatch ? (
              <RealStatsGrid result={selectedAnalysisMatch.result} colors={colors} s={s} t={t} />
            ) : (
              <View style={s.noMatchHint}>
                <Ionicons name="videocam-outline" size={18} color={colors.textSec} />
                <Text style={s.noMatchHintText}>{t('home.noSessionsTitle')}</Text>
              </View>
            )}

            <CoachInsightCard matchCount={matches.length} colors={colors} s={s} coachTips={COACH_TIPS_BY_LOCALE[locale]} coachInsightLabel={t('analysis.coachInsight')} onPress={() => navigation.navigate('Insights')} />
          </View>
        )}

        {tab === 1 && (
          <View>
            {matches.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14, marginHorizontal: -4 }} contentContainerStyle={{ paddingHorizontal: 4, gap: 8, flexDirection: 'row' }}>
                {matches.map((m, i) => {
                  const active = i === safeErrorMatchIdx;
                  const d = new Date(m.date);
                  const label = `${d.getDate()}.${d.getMonth() + 1}. ${fmtTime(m.recordSeconds)}`;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.errorMatchChip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => { setErrorMatchIdx(i); setExpandedId(null); }}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="videocam" size={12} color={active ? '#fff' : colors.textSec} />
                      <Text style={[s.errorMatchChipText, active && { color: '#fff' }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            {matches.length === 0 ? (
              <View style={s.noVideosWrap}>
                <Ionicons name="videocam-outline" size={44} color={colors.textSec} />
                <Text style={s.noVideosText}>{t('analysis.noVideos')}</Text>
              </View>
            ) : (
              <>
                <View style={s.errorSummary}>
                  <SumCard value={`${totalErrors}`} label={t('analysis.totalErrors')} color={colors.primary} s={s} borderColor={colors.border} />
                  <SumCard value={`${highErrors}`} label={t('analysis.critical')} color={colors.blue} s={s} borderColor={colors.border} />
                  <SumCard value={`${Math.round(Math.max(0, (errorMatch ? errorMatch.result.shots - errorMatch.result.errors : 230 - totalErrors) / Math.max(1, errorMatch?.result.shots ?? 230) * 100))}%`} label={t('analysis.cleanPlay')} color={colors.primary} s={s} borderColor={colors.border} />
                </View>
                <Text style={s.sectionTitle}>{t('analysis.unforcedErrors')}</Text>
                <Text style={s.sectionSub}>{t('analysis.tapError')}</Text>
                {errorMatchErrors.length === 0 ? (
                  <View style={s.noVideosWrap}>
                    <Ionicons name="checkmark-circle-outline" size={44} color={colors.primary} />
                    <Text style={s.noVideosText}>{t('analysis.noErrors')}</Text>
                  </View>
                ) : (
                  errorMatchErrors.map(err => {
                    const expanded = expandedId === err.id;
                    const sevColor = err.severity === 'high' ? colors.danger : err.severity === 'medium' ? '#FFA502' : colors.primary;
                    return (
                      <TouchableOpacity key={err.id} style={[s.errorCard, { borderLeftColor: sevColor }]} onPress={() => setExpandedId(expanded ? null : err.id)} activeOpacity={0.8}>
                        <View style={s.errorRow}>
                          <View style={s.errorLeft}>
                            <View>
                              <Text style={s.errorShot}>{err.shot}</Text>
                              <Text style={s.errorZone}>{err.zone}</Text>
                            </View>
                          </View>
                          <View style={s.errorRight}>
                            <View style={[s.causePill, { backgroundColor: sevColor + '22' }]}>
                              <Text style={[s.causeText, { color: sevColor }]}>{err.cause}</Text>
                            </View>
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSec} />
                          </View>
                        </View>
                        {expanded && (
                          <View style={s.errorExpanded}>
                            <View style={s.divider} />
                            <Text style={s.errorExpl}>{err.explanation}</Text>
                            <View style={[s.tipBox, { backgroundColor: colors.primaryDim }]}>
                              <Ionicons name="bulb" size={14} color={colors.primary} />
                              <Text style={[s.tipText, { color: colors.primary }]}>{err.tip}</Text>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}

        {tab === 2 && (
          <View>
            {/* Match picker */}
            {matches.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.pickerRow}
              >
                {matches.map((m, idx) => {
                  const sc = m.result.score >= 65 ? colors.primary : m.result.score >= 50 ? colors.blue : colors.danger;
                  const isSel = idx === safeAnalysisIdx;
                  const dateStr = new Date(m.date).toLocaleDateString(DATE_LOCALE[locale], { day: '2-digit', month: 'short' });
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.pickerCard, isSel && { borderColor: sc, backgroundColor: sc + '14' }]}
                      onPress={() => setSelectedAnalysisIdx(idx)}
                      activeOpacity={0.72}
                    >
                      {m.thumbnailUri ? (
                        <View style={s.pickerThumb}>
                          <Image source={{ uri: m.thumbnailUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                        </View>
                      ) : (
                        <View style={[s.pickerThumb, { backgroundColor: '#0A1A0F' }]} />
                      )}
                      <Text style={[s.pickerDate, isSel && { color: colors.text }]}>{dateStr}</Text>
                      <Text style={[s.pickerScore, { color: sc }]}>{m.result.score}</Text>
                      {isSel && <View style={[s.pickerActiveDot, { backgroundColor: sc }]} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Player positioning zones from AI analysis */}
            {selectedAnalysisMatch?.result?.zones != null && (() => {
              const z = selectedAnalysisMatch!.result.zones!;
              const dominant: 'net' | 'mid' | 'back' =
                z.net >= z.mid && z.net >= z.back ? 'net' : z.mid >= z.back ? 'mid' : 'back';
              const zoneLabels: Record<string, Record<'net' | 'mid' | 'back', string>> = {
                de: { net: 'Netz', mid: 'Mitte', back: 'Hinten' },
                en: { net: 'Net', mid: 'Mid', back: 'Back' },
                es: { net: 'Red', mid: 'Medio', back: 'Fondo' },
                fr: { net: 'Filet', mid: 'Milieu', back: 'Fond' },
              };
              const zoneTips: Record<string, Record<'net' | 'mid' | 'back', string>> = {
                de: {
                  net: 'Du spielst viel am Netz – sehr gut! Achte darauf bei Lobs schnell zurückzukommen.',
                  mid: 'Du stehst oft im Mittelfeld. Komm nach druckvollen Schlägen aktiver ans Netz.',
                  back: 'Du spielst viel hinten. Nutze gute Bälle öfter um nach vorne ans Netz zu kommen.',
                },
                en: {
                  net: 'You play a lot at the net — great! Make sure to recover quickly after lobs.',
                  mid: 'You often play mid-court. Move up to the net more after strong shots.',
                  back: 'You spend a lot of time in the back. Use strong shots to come forward more.',
                },
                es: {
                  net: '¡Juegas mucho en la red! Asegúrate de recuperarte rápido después de los globos.',
                  mid: 'Sueles jugar en la zona central. Sube más a la red después de buenos golpes.',
                  back: 'Juegas mucho en el fondo. Usa buenos golpes para venir hacia la red más seguido.',
                },
                fr: {
                  net: 'Tu joues beaucoup au filet — excellent ! Récupère vite après les lobs.',
                  mid: 'Tu joues souvent au milieu. Monte davantage au filet après de bons coups.',
                  back: 'Tu joues souvent dans le fond. Utilise de bons coups pour monter plus souvent.',
                },
              };
              const loc = (locale in zoneTips ? locale : 'en') as keyof typeof zoneTips;
              const labels = zoneLabels[loc] ?? zoneLabels.en;
              const tipText = zoneTips[loc][dominant];
              const heading: Record<string, string> = { de: 'Deine Positionierung', en: 'Your Positioning', es: 'Tu Posicionamiento', fr: 'Ton Placement' };
              return (
                <View>
                  <Text style={s.sectionTitle}>{heading[locale] ?? heading.en}</Text>
                  <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
                    {(['net', 'mid', 'back'] as const).map(key => {
                      const val = z[key];
                      const isDom = key === dominant;
                      const barColor = isDom ? colors.primary : colors.blue;
                      return (
                        <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                          <Text style={{ color: isDom ? colors.text : colors.textSec, fontSize: 12, fontWeight: '700', width: 46 }}>{labels[key]}</Text>
                          <View style={{ flexDirection: 'row', flex: 1, height: 18, backgroundColor: colors.cardAlt, borderRadius: 6, overflow: 'hidden' }}>
                            <View style={{ flex: val, backgroundColor: barColor, opacity: isDom ? 1 : 0.5 }} />
                            <View style={{ flex: 100 - val }} />
                          </View>
                          <Text style={{ color: barColor, fontSize: 13, fontWeight: '700', width: 36, textAlign: 'right' }}>{val}%</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={[s.tipCard, { marginBottom: 14 }]}>
                    <View style={[s.tipIcon, { backgroundColor: colors.primaryDim }]}>
                      <Ionicons name="bulb" size={18} color={colors.primary} />
                    </View>
                    <Text style={s.tipCardText}>{tipText}</Text>
                  </View>
                </View>
              );
            })()}

            {/* Camera placement guide */}
            <View style={s.filmHeader}>
              <Ionicons name="videocam" size={20} color={colors.primary} />
              <Text style={s.filmHeaderText}>{t('analysis.optimalPlacement')}</Text>
            </View>
            <View style={s.courtMap}>
              <View style={s.courtSurface} />
              <View style={s.courtBorder} />
              <View style={s.courtNetLine} />
              <View style={s.courtCenterLine} />
              {phonePositions.map(p => {
                const isActive = p.id === selectedPos;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.posDot, {
                      left: p.x * (width - 32) - 14,
                      top: p.y * ((width - 32) * 0.65) - 14,
                      backgroundColor: p.color,
                      borderColor: isActive ? '#fff' : 'transparent',
                      transform: [{ scale: isActive ? 1.2 : 1 }],
                    }]}
                    onPress={() => setSelectedPos(p.id)}
                  >
                    <Ionicons name="camera" size={13} color="#fff" />
                  </TouchableOpacity>
                );
              })}
              <Text style={[s.courtLabel, { top: 6, left: 0, right: 0, textAlign: 'center' }]}>{t('analysis.opponents')}</Text>
              <Text style={[s.courtLabel, { bottom: 6, left: 0, right: 0, textAlign: 'center' }]}>{t('analysis.you')}</Text>
            </View>
            <View style={s.posRow}>
              {phonePositions.map(p => (
                <TouchableOpacity key={p.id} style={[s.posPill, selectedPos === p.id && { borderColor: p.color, backgroundColor: p.color + '18' }]} onPress={() => setSelectedPos(p.id)}>
                  <View style={[s.pillDot, { backgroundColor: p.color }]} />
                  <Text style={[s.pillText, selectedPos === p.id && { color: p.color }]} numberOfLines={1}>
                    {(PHONE_POS_I18N[locale] ?? PHONE_POS_I18N.en)[p.id]?.short ?? `Pos ${p.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={[s.posDetail, { borderLeftColor: pos.color }]}>
              <Text style={s.posName}>{posI18n.name}</Text>
              <View style={s.scoreRow}>
                <View style={[s.scoreBar, { flex: pos.score }]} /><View style={{ flex: 100 - pos.score }} />
              </View>
              <Text style={[s.posScore, { color: pos.color }]}>{pos.score}{t('analysis.quality')}</Text>
              <Text style={s.posDesc}>{posI18n.description}</Text>
              <View style={s.proscons}>
                <View style={{ flex: 1 }}>
                  {posI18n.pros.map((p2, i) => (
                    <View key={i} style={s.proItem}>
                      <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                      <Text style={s.proText}>{p2}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  {posI18n.cons.map((c, i) => (
                    <View key={i} style={s.proItem}>
                      <Ionicons name="close-circle" size={13} color={colors.danger} />
                      <Text style={s.proText}>{c}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <Text style={s.sectionTitle}>{t('analysis.recordingTips')}</Text>
            {RECORDING_TIPS.map((item, i) => (
              <View key={i} style={s.tipCard}>
                <View style={[s.tipIcon, { backgroundColor: colors.primaryDim }]}>
                  <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                </View>
                <Text style={s.tipCardText}>{item.tip}</Text>
              </View>
            ))}
          </View>
        )}

        {tab === 3 && (
          <View>
            <Text style={s.sectionTitle}>{t('analysis.videosTitle')}</Text>
            <View style={s.searchRow}>
              <Ionicons name="search-outline" size={16} color={colors.textSec} />
              <TextInput
                style={[s.searchInput, { color: colors.text }]}
                value={videoSearch}
                onChangeText={setVideoSearch}
                placeholder={t('analysis.searchVideos')}
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
              />
              {videoSearch.length > 0 && (
                <TouchableOpacity onPress={() => setVideoSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textSec} />
                </TouchableOpacity>
              )}
            </View>
            {filteredMatches.length === 0 ? (
              <View style={s.noVideosWrap}>
                <Ionicons name="videocam-outline" size={44} color={colors.textSec} />
                <Text style={s.noVideosText}>{t('analysis.noVideos')}</Text>
              </View>
            ) : (
              filteredMatches.map(m => (
                <VideoCard
                  key={m.id}
                  match={m}
                  onDelete={() => deleteMatch(m.id)}
                />
              ))
            )}
          </View>
        )}

        <View style={{ height: 16 }} />
      </ScrollView>

      <TutorialModal
        visible={tutorialVisible}
        onClose={() => {
          setTutorialVisible(false);
          prepareRecord();
        }}
      />

      {/* Position picker modal */}
      <Modal visible={showPositionPicker} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={[s.modalCard, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>{t('position.title')}</Text>
            <Text style={[s.modalBody, { marginBottom: 20 }]}>{t('position.subtitle')}</Text>

            <View style={s.posPickerCourt}>
              <View style={s.posPickerRow}>
                {(['left-net', 'right-net'] as PlayerPosition[]).map(id => (
                  <TouchableOpacity
                    key={id}
                    style={[s.posPickerZone, playerPosition === id && { borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.18)' }]}
                    onPress={() => setPlayerPosition(id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={playerPosition === id ? 'radio-button-on' : 'radio-button-off'} size={18} color={playerPosition === id ? '#fff' : 'rgba(255,255,255,0.4)'} />
                    <Text style={[s.posPickerZoneLabel, playerPosition === id && { color: '#fff', fontWeight: '800' }]}>
                      {t(id === 'left-net' ? 'position.leftNet' : 'position.rightNet')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.posPickerNet} />
              <View style={s.posPickerRow}>
                {(['left-back', 'right-back'] as PlayerPosition[]).map(id => (
                  <TouchableOpacity
                    key={id}
                    style={[s.posPickerZone, playerPosition === id && { borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(255,255,255,0.18)' }]}
                    onPress={() => setPlayerPosition(id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={playerPosition === id ? 'radio-button-on' : 'radio-button-off'} size={18} color={playerPosition === id ? '#fff' : 'rgba(255,255,255,0.4)'} />
                    <Text style={[s.posPickerZoneLabel, playerPosition === id && { color: '#fff', fontWeight: '800' }]}>
                      {t(id === 'left-back' ? 'position.leftBack' : 'position.rightBack')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[s.posPickerCourtLabel, { color: 'rgba(255,255,255,0.75)', fontWeight: '700' }]}>{t('analysis.you')}</Text>
            </View>

            <TouchableOpacity
              style={[s.modalBtn, { backgroundColor: playerPosition ? colors.primary : colors.border, opacity: playerPosition ? 1 : 0.55 }]}
              onPress={handlePositionConfirm}
              disabled={!playerPosition}
            >
              <Text style={s.modalBtnText}>{t('position.confirm')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bottom-sheet modal */}
      <Modal visible={recordModal} transparent animationType="slide" onRequestClose={() => setRecordModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setRecordModal(false); }}>
            <View style={s.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={s.modalCard}>
            <View style={s.modalHandle} />

            {modalState === 'checklist' && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>{t('analysis.startRecording')}</Text>
                  <TouchableOpacity onPress={() => setRecordModal(false)}>
                    <Ionicons name="close" size={22} color={colors.textSec} />
                  </TouchableOpacity>
                </View>
                <View style={s.opponentRow}>
                  <Ionicons name="people-outline" size={18} color={colors.textSec} />
                  <TextInput
                    style={[s.opponentInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.cardAlt }]}
                    value={opponent}
                    onChangeText={setOpponent}
                    placeholder={t('analysis.opponentPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>
                <Text style={s.modalBody}>{t('analysis.tapToConfirm')}</Text>
                {CHECKLIST.map((item, i) => {
                  const checked = checkedItems.has(i);
                  return (
                    <TouchableOpacity key={i} style={s.modalItem} activeOpacity={0.7} onPress={() => toggleCheck(i)}>
                      <Ionicons name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={checked ? colors.primary : colors.textMuted} />
                      <Text style={[s.modalItemText, checked && { color: colors.textSec, textDecorationLine: 'line-through' }]}>{item}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: allChecked ? colors.danger : colors.cardAlt }]}
                  onPress={allChecked ? startRec : undefined}
                  activeOpacity={allChecked ? 0.8 : 1}
                >
                  <Ionicons name="radio-button-on" size={16} color={allChecked ? '#fff' : colors.textMuted} />
                  <Text style={[s.modalBtnText, { color: allChecked ? '#fff' : colors.textMuted }]}>
                    {allChecked
                      ? t('analysis.imReady')
                      : t('analysis.checkAllItems', { done: checkedItems.size, total: CHECKLIST.length })}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {modalState === 'countdown' && (
              <View style={s.countdownView}>
                <Text style={s.countdownTitle}>{t('analysis.setupRecording')}</Text>
                <View style={s.orientRow}>
                  {(['portrait', 'landscape'] as const).map(o => (
                    <TouchableOpacity
                      key={o}
                      style={[s.orientBtn, orientation === o && { backgroundColor: colors.blueDim, borderColor: colors.blue }]}
                      onPress={() => setOrientation(o)}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={o === 'portrait' ? 'phone-portrait-outline' : 'phone-landscape-outline'}
                        size={20}
                        color={orientation === o ? colors.blue : colors.textSec}
                      />
                      <Text style={[s.orientBtnText, orientation === o && { color: colors.blue }]}>
                        {o === 'portrait' ? t('analysis.portrait') : t('analysis.landscape')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {countdownLeft === null ? (
                  <>
                    <Text style={s.countdownSub}>{t('analysis.countdownSub')}</Text>
                    <View style={s.customInputRow}>
                      <TextInput
                        style={[s.customInput, { borderColor: colors.primary + '88', color: colors.text, backgroundColor: colors.cardAlt }]}
                        value={customCountdown}
                        onChangeText={v => setCustomCountdown(v.replace(/[^0-9]/g, ''))}
                        placeholder="–"
                        placeholderTextColor={colors.textSec}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={Keyboard.dismiss}
                        underlineColorAndroid="transparent"
                        maxLength={3}
                        textAlign="center"
                      />
                      <Text style={[s.customInputUnit, { color: colors.textSec }]}>{t('analysis.seconds')}</Text>
                    </View>
                    <View style={s.countdownOptions}>
                      {[3, 5, 10].map(n => {
                        const active = customCountdown === String(n);
                        return (
                          <TouchableOpacity
                            key={n}
                            style={[s.countdownOption, active && { borderColor: colors.primary, backgroundColor: colors.primaryDim }]}
                            onPress={() => setCustomCountdown(String(n))}
                            activeOpacity={0.75}
                          >
                            <Text style={[s.countdownOptNum, { color: active ? colors.primary : colors.textSec }]}>{n}s</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      style={[s.modalBtn, { backgroundColor: colors.danger, width: '100%', marginTop: 8 }]}
                      onPress={() => {
                        if (countdownSecs > 0) {
                          setCountdownLeft(countdownSecs);
                        } else {
                          beginRecording();
                        }
                      }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="videocam" size={16} color="#fff" />
                      <Text style={s.modalBtnText}>
                        {countdownSecs > 0
                          ? t('analysis.startIn', { n: countdownSecs })
                          : t('analysis.startImmediately')}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <View style={s.countdownBigView}>
                    <Text style={[s.countdownBig, { color: colors.primary }]}>{countdownLeft}</Text>
                    <Text style={s.countdownSub}>{t('analysis.getReady')}</Text>
                    {orientation === 'landscape' && (
                      <Text style={[s.orientHint, { color: colors.textSec }]}>{t('analysis.rotatePhone')}</Text>
                    )}
                  </View>
                )}
              </View>
            )}

            {modalState === 'saved' && (
              <View style={s.savedView}>
                <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
                <Text style={s.savedTitle}>{t('analysis.recordingSaved')}</Text>
                <Text style={s.savedSub}>{t('analysis.readyForAnalysis', { time: fmtTime(recordSeconds) })}</Text>
                <TouchableOpacity
                  style={[s.modalBtn, { backgroundColor: colors.primary, width: '100%', marginTop: 4 }]}
                  onPress={() => setRecordModal(false)}
                >
                  <Text style={s.modalBtnText}>{t('analysis.done')}</Text>
                </TouchableOpacity>
              </View>
            )}

          </View>
          </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen camera when recording */}
      <Modal visible={fullscreenMode} transparent={false} animationType="fade" statusBarTranslucent>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {cameraPermission?.granted ? (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" mode="video" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1A0F' }]} />
          )}
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <View style={[s.recHud, { paddingTop: insets.top + 12 }]}>
              <View style={s.recTimerBadge}>
                <View style={[s.recDot, { opacity: recBlink ? 1 : 0 }]} />
                <Text style={s.recTimerText}>{fmtTime(recordSeconds)}</Text>
              </View>
              <View style={s.recBadge}>
                <Text style={s.recBadgeText}>REC</Text>
              </View>
            </View>
            <View style={[s.recCornerTL, { top: insets.top + 16, left: 20 }]} />
            <View style={[s.recCornerTR, { top: insets.top + 16, right: 20 }]} />
            <View style={[s.recCornerBL, { bottom: insets.bottom + 200, left: 20 }]} />
            <View style={[s.recCornerBR, { bottom: insets.bottom + 200, right: 20 }]} />
            <View style={[s.recStopArea, { paddingBottom: insets.bottom + 40 }]} pointerEvents="box-none">
              <TouchableOpacity style={s.recStopBtn} onPress={stopRec} activeOpacity={0.85}>
                <View style={s.recStopInner} />
              </TouchableOpacity>
              <Text style={s.recStopLabel}>{t('analysis.tapToStop')}</Text>
            </View>
          </View>
        </View>
      </Modal>


      {/* AI Analysis modal */}
      <Modal visible={analysisModal} transparent={false} animationType="fade" statusBarTranslucent>
        <View style={ai.root}>
          {!analysisDone ? (
            <View style={[ai.loadingWrap, { paddingTop: insets.top }]}>
              <View style={ai.ringContainer}>
                <Animated.View style={[ai.ringOuter, {
                  transform: [{ scale: aiPulse }],
                  opacity: aiPulse.interpolate({ inputRange: [1, 1.12], outputRange: [0.18, 0.05] }),
                }]} />
                <Animated.View style={[ai.arcCW, {
                  transform: [{ rotate: aiRing.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                }]} />
                <Animated.View style={[ai.arcCCW, {
                  transform: [{ rotate: aiRing.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }],
                }]} />
                <Animated.View style={[ai.orb, { transform: [{ scale: aiPulse }] }]}>
                  <Text style={ai.aiLabel}>AI</Text>
                </Animated.View>
              </View>
              <Text style={ai.phaseText}>{AI_PHASES_BY_LOCALE[locale][analysisPhase]}</Text>
              <Text style={ai.pctText}>{Math.round(analysisPct)}%</Text>
              <View style={ai.progressTrack}>
                <View style={[ai.progressFill, { width: `${analysisPct}%` as any }]} />
                <View style={[ai.progressGlow, { left: `${analysisPct}%` as any }]} />
              </View>
              <Text style={ai.hint}>{t('analysis.insightsOnWay')}</Text>
            </View>
          ) : (() => {
            const r = analysisResult;
            if (!r) return null;
            const scoreColor = r.score >= 80 ? '#4ADE80' : r.score >= 65 ? AI_BLUE_LIGHT : '#FFA502';
            return (
              <ScrollView style={{ width: '100%' }} contentContainerStyle={[ai.doneScroll, { paddingTop: insets.top + 16 }]} showsVerticalScrollIndicator={false}>
                {(videoUri || permanentVideoUriRef.current) && (
                  <View style={ai.videoWrap}>
                    <View style={ai.videoThumb}>
                      {videoThumbnail ? (
                        <Image source={{ uri: videoThumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                      ) : (
                        <>
                          <View style={ai.videoCourtLine} />
                          <View style={ai.videoCourtNet} />
                        </>
                      )}
                      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)' }]} />
                    </View>
                    <View style={ai.videoBar}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="videocam" size={13} color={AI_BLUE_LIGHT} />
                        <Text style={ai.videoBarTitle}>{t('analysis.matchRecording')}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.4)" />
                          <Text style={ai.videoBarMeta}>{fmtTime(recordSeconds)}</Text>
                        </View>
                        {videoSaved && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="checkmark-circle" size={11} color="#4ADE80" />
                            <Text style={[ai.videoBarMeta, { color: '#4ADE80' }]}>{t('analysis.saved')}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}

                <View style={ai.scoreRow}>
                  <View style={[ai.scoreCircle, { borderColor: scoreColor }]}>
                    <Text style={[ai.scoreNum, { color: scoreColor }]}>{r.score}</Text>
                    <Text style={ai.scoreMax}>/100</Text>
                  </View>
                  <View style={ai.scoreMeta}>
                    <Text style={ai.scoreLbl}>{t('analysis.performanceScore')}</Text>
                    <Text style={ai.scoreSub}>{fmtTime(recordSeconds)} {t('analysis.recorded')}</Text>
                    <View style={[ai.scoreBadge, { backgroundColor: scoreColor + '22', borderColor: scoreColor + '55' }]}>
                      <Text style={[ai.scoreBadgeText, { color: scoreColor }]}>
                        {r.score >= 80 ? t('analysis.excellent') : r.score >= 65 ? t('analysis.good') : t('analysis.developing')}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={ai.summaryText}>
                  {t(
                    r.score >= 75 ? 'analysis.summaryExcellent' : r.score >= 55 ? 'analysis.summaryGood' : 'analysis.summaryDeveloping',
                    { shots: String(r.shots), winners: String(r.winners), errorRate: String(r.errorRate), coverage: String(r.coverage) },
                  )}
                </Text>

                <View style={ai.statsGrid}>
                  {[
                    { label: t('analysis.totalShots'), value: `${r.shots}`, color: AI_BLUE_LIGHT },
                    { label: t('analysis.winners'), value: `${r.winners}`, color: '#4ADE80' },
                    { label: t('analysis.errors'), value: `${r.errors}`, color: '#F87171' },
                    { label: t('analysis.courtCoverage'), value: `${r.coverage}%`, color: AI_BLUE_LIGHT },
                    { label: t('analysis.errorRate'), value: `${r.errorRate}%`, color: r.errorRate > 20 ? '#FFA502' : '#4ADE80' },
                    { label: t('analysis.avgRally'), value: `${r.avgRally}`, color: AI_BLUE_LIGHT },
                  ].map(stat => (
                    <View key={stat.label} style={ai.statCard}>
                      <Text style={[ai.statVal, { color: stat.color }]}>{stat.value}</Text>
                      <Text style={ai.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>

                <View style={ai.section}>
                  <Text style={ai.sectionHead}>{t('analysis.strengths')}</Text>
                  {r.strengths.map((item, i) => (
                    <View key={i} style={ai.bulletRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#4ADE80" />
                      <Text style={ai.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>

                <View style={ai.section}>
                  <Text style={ai.sectionHead}>{t('analysis.workOn')}</Text>
                  {r.improvements.map((item, i) => (
                    <View key={i} style={ai.bulletRow}>
                      <Ionicons name="arrow-forward-circle" size={15} color={AI_BLUE_LIGHT} />
                      <Text style={ai.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={ai.doneBtn} onPress={() => setAnalysisModal(false)} activeOpacity={0.85}>
                  <Text style={ai.doneBtnText}>{t('analysis.done')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAnalysisModal(false)} style={{ marginTop: 14, marginBottom: 4 }}>
                  <Text style={ai.closeText}>{t('analysis.close')}</Text>
                </TouchableOpacity>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const VideoScrubber = React.forwardRef<ScrubberHandle, { s: any }>(({ s }, ref) => {
  const { colors } = useTheme();
  const [pct, setPct] = useState(0.28);
  const [trackWidth, setTrackWidth] = useState(1);
  const elapsed = fmtTime(Math.round(pct * DURATION));

  React.useImperativeHandle(ref, () => ({
    skip: (secs: number) => setPct(p => clamp(p + secs / DURATION)),
  }));

  return (
    <View style={s.scrubber}>
      <Text style={s.scrubTime}>{elapsed}</Text>
      <View
        style={s.scrubTrack}
        onLayout={e => setTrackWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onResponderGrant={e => setPct(clamp(e.nativeEvent.locationX / trackWidth))}
        onResponderMove={e => setPct(clamp(e.nativeEvent.locationX / trackWidth))}
      >
        <View style={s.scrubRail} />
        <View style={[s.scrubFill, { width: pct * trackWidth }]} />
        <View style={[s.scrubThumb, { left: pct * trackWidth - 7 }]} />
      </View>
      <Text style={s.scrubTime}>{lastMatch.duration}</Text>
    </View>
  );
});

function QuickStat({ icon, label, value, color, s }: any) {
  return (
    <View style={s.quickStatCard}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[s.quickStatVal, { color }]}>{value}</Text>
      <Text style={s.quickStatLabel}>{label}</Text>
    </View>
  );
}

function RealStatsGrid({ result, colors, s, t }: { result: AnalysisResult; colors: any; s: any; t: (k: string) => string }) {
  const stats = [
    { value: String(result.shots),       label: t('home.shots'),          color: colors.text },
    { value: String(result.winners),     label: t('analysis.winners'),    color: '#00D97E' },
    { value: String(result.errors),      label: t('analysis.errors'),     color: '#FF5252' },
    { value: `${result.errorRate}%`,     label: t('analysis.errorRate'),  color: result.errorRate > 25 ? '#FF5252' : '#FFA502' },
    { value: result.avgRally,            label: t('analysis.avgRally'),   color: colors.blue },
    { value: `${result.score}/100`,      label: 'Score',                  color: colors.primary },
  ];
  return (
    <View style={s.realStatsGrid}>
      {stats.map((stat, i) => (
        <View key={i} style={[s.realStatCard, { borderColor: colors.border }]}>
          <Text style={[s.realStatValue, { color: stat.color }]}>{stat.value}</Text>
          <Text style={s.realStatLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function ShotTimeline({ match, displayedVideoUri, onShotPress, colors, s, t }: {
  match: StoredMatch | null;
  displayedVideoUri: string | null;
  onShotPress: (timestamp: number) => void;
  colors: any;
  s: ReturnType<typeof createStyles>;
  t: (k: string) => string;
}) {
  const shots = match?.result?.shots_timeline;
  if (!shots?.length || !displayedVideoUri) return null;

  const winners = shots.filter(sh => sh.outcome === 'winner').length;
  const errors  = shots.filter(sh => sh.outcome === 'fehler').length;

  const outcomeColor = (o: string) => o === 'winner' ? colors.primary : o === 'fehler' ? '#FF5252' : '#666680';
  const outcomeIcon  = (o: string): any => o === 'winner' ? 'checkmark-circle' : o === 'fehler' ? 'close-circle' : 'remove-circle-outline';
  const fmtTime = (ts: number) => `${Math.floor(ts / 60)}:${String(Math.floor(ts % 60)).padStart(2, '0')}`;

  return (
    <View style={s.shotTimelineCard}>
      <View style={s.shotTimelineHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="analytics-outline" size={16} color={colors.primary} />
          <Text style={s.shotTimelineTitle}>{t('analysis.shotTimeline')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            <Text style={{ color: colors.textSec, fontSize: 12, fontWeight: '600' }}>{winners} W</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5252' }} />
            <Text style={{ color: colors.textSec, fontSize: 12, fontWeight: '600' }}>{errors} F</Text>
          </View>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
      >
        {shots.map((shot, i) => {
          const col = outcomeColor(shot.outcome);
          return (
            <TouchableOpacity
              key={shot.id ?? String(i)}
              onPress={() => onShotPress(shot.timestamp)}
              activeOpacity={0.75}
              style={{
                alignItems: 'center',
                backgroundColor: col + '18',
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: col + '55',
                paddingHorizontal: 12,
                paddingVertical: 10,
                minWidth: 70,
                gap: 4,
              }}
            >
              <Ionicons name={outcomeIcon(shot.outcome)} size={18} color={col} />
              <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                {shot.type}
              </Text>
              <Text style={{ color: colors.textSec, fontSize: 10 }}>
                {fmtTime(shot.timestamp)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function CoachInsightCard({ matchCount, colors, s, coachTips, coachInsightLabel, onPress }: any) {
  const tip = coachTips[matchCount % coachTips.length];
  return (
    <TouchableOpacity style={s.coachCard} onPress={onPress} activeOpacity={0.75}>
      <View style={s.coachHeader}>
        <View style={[s.coachIconWrap, { backgroundColor: colors.primaryDim }]}>
          <Ionicons name="bulb" size={18} color={colors.primary} />
        </View>
        <Text style={s.coachTitle}>{coachInsightLabel}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.coachBadge, { backgroundColor: colors.primaryDim }]}>
            <Text style={[s.coachBadgeText, { color: colors.primary }]}>AI</Text>
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.textSec} />
        </View>
      </View>
      <Text style={s.coachTip}>{tip}</Text>
    </TouchableOpacity>
  );
}

function SumCard({ value, label, color, s, borderColor }: any) {
  return (
    <View style={[s.errorSumItem, { borderColor }]}>
      <Text style={[s.errorSumVal, { color }]}>{value}</Text>
      <Text style={s.errorSumLabel}>{label}</Text>
    </View>
  );
}

function VideoCard({ match, onPlay, onDelete }: { match: StoredMatch; onPlay?: () => void; onDelete: () => void }) {
  const { colors } = useTheme();
  const { locale, t } = useLocale();
  const [generatedThumb, setGeneratedThumb] = useState<string | null>(null);
  const [videoExists, setVideoExists] = useState<boolean | null>(null);
  const thumb = match.thumbnailUri ?? generatedThumb;
  const scoreColor = match.result.score >= 65 ? colors.primary : match.result.score >= 50 ? colors.blue : colors.danger;
  const dateStr = new Date(match.date).toLocaleDateString(DATE_LOCALE[locale], { day: '2-digit', month: 'short', year: 'numeric' });
  const isLocal = !!match.videoUri && match.videoUri.startsWith('file://');
  const canPlay = !!onPlay && !!match.videoUri && (match.videoUri.startsWith('https://') || videoExists === true);

  useEffect(() => {
    if (!match.videoUri) { setVideoExists(false); return; }
    if (!isLocal) { setVideoExists(true); return; }
    // Lokale Datei: prüfen ob sie existiert
    FileSystem.getInfoAsync(match.videoUri).then(info => {
      setVideoExists(info.exists);
      if (!info.exists) console.warn('[VideoCard] local file missing:', match.videoUri);
    }).catch(() => setVideoExists(false));
  }, [match.id, match.videoUri]);

  useEffect(() => {
    if (match.thumbnailUri || !match.videoUri) return;
    if (match.videoUri.startsWith('https://')) return;
    if (videoExists === false) return;
    VideoThumbnails.getThumbnailAsync(match.videoUri, { time: 100, quality: 0.7 })
      .then(({ uri }) => setGeneratedThumb(uri))
      .catch(() => {});
  }, [match.id, match.thumbnailUri, videoExists]);

  const handleDelete = () => {
    Alert.alert(t('analysis.deleteTitle'), t('analysis.deleteMsg'), [
      { text: t('analysis.deleteCancel'), style: 'cancel' },
      { text: t('analysis.deleteConfirm'), style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[vc.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={canPlay ? onPlay : undefined}
      onLongPress={handleDelete}
      activeOpacity={canPlay ? 0.82 : 1}
    >
      <View style={vc.thumb}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A1A0F', justifyContent: 'center', alignItems: 'center' }]}>
            <Ionicons name={canPlay ? 'videocam-outline' : 'videocam-off-outline'} size={20} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.28)' }]} />
        {canPlay && (
          <View style={vc.playBtn}>
            <Ionicons name="play" size={16} color="#fff" style={{ paddingLeft: 2 }} />
          </View>
        )}
        <View style={[vc.scoreBadge, { backgroundColor: scoreColor }]}>
          <Text style={vc.scoreText}>{match.result.score}</Text>
        </View>
      </View>
      <View style={vc.info}>
        <Text style={[vc.date, { color: colors.text }]}>{dateStr}</Text>
        {match.opponent ? (
          <Text style={[vc.opponent, { color: colors.textSec }]} numberOfLines={1}>vs {match.opponent}</Text>
        ) : null}
        <Text style={[vc.duration, { color: colors.textSec }]}>{fmtTime(match.recordSeconds)}</Text>
        {!canPlay && videoExists === false && (
          <Text style={[vc.duration, { color: colors.danger, fontSize: 10 }]}>{t('analysis.noVideoFile')}</Text>
        )}
      </View>
      <TouchableOpacity onPress={handleDelete} style={{ padding: 16 }}>
        <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const vc = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, overflow: 'hidden', borderWidth: 1,
  },
  thumb: {
    width: 106, height: 80,
    justifyContent: 'center', alignItems: 'center',
    position: 'relative',
  },
  playBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)',
  },
  scoreBadge: { position: 'absolute', top: 6, right: 6, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  scoreText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  info: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  date: { fontSize: 13, fontWeight: '700' },
  opponent: { fontSize: 12 },
  duration: { fontSize: 12 },
});

function createStyles(colors: any) {
  const COURT_W = width - 32;
  const COURT_H = COURT_W * 0.65;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 16 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
    title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    sub: { fontSize: 13, color: colors.textSec, marginTop: 2 },
    uploadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.blue, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, shadowColor: colors.blue, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    recordBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.danger, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, shadowColor: colors.danger, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 },
    recordBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: colors.cardAlt, borderRadius: 13, padding: 4, borderWidth: 1, borderColor: colors.border },
    tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
    tabActive: { backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 3 },
    tabText: { color: colors.textSec, fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
    tabTextActive: { color: '#04120B' },
    videoCard: { marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    videoArea: { height: 200, backgroundColor: '#0A1A0F', justifyContent: 'center', alignItems: 'center', position: 'relative', borderTopLeftRadius: 17, borderTopRightRadius: 17, overflow: 'hidden' },
    recPlayBtn: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' },
    recSavedBadge: { position: 'absolute', top: 10, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    recSavedText: { color: '#4ADE80', fontSize: 11, fontWeight: '600' },
    recVideoFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
    recVideoFooterText: { flex: 1, color: colors.textSec, fontSize: 13, fontWeight: '500' },
    courtNet: { position: 'absolute', left: '10%', right: '10%', top: '48%', height: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
    courtLeft: { position: 'absolute', left: '10%', top: '10%', bottom: '10%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' },
    courtRight: { position: 'absolute', right: '10%', top: '10%', bottom: '10%', width: 1.5, backgroundColor: 'rgba(255,255,255,0.15)' },
    videoControls: { flexDirection: 'row', alignItems: 'center', gap: 24, zIndex: 1 },
    skipBtn: { alignItems: 'center', gap: 3 },
    skipLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700' },
    videoLabels: { position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    aiBadge: { backgroundColor: colors.primary + 'CC', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    aiBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    videoTime: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' },
    scrubber: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    scrubTime: { color: colors.textSec, fontSize: 11, width: 36 },
    scrubTrack: { flex: 1, height: 20, position: 'relative' },
    scrubRail: { position: 'absolute', left: 0, right: 0, top: 8, height: 4, backgroundColor: colors.cardAlt, borderRadius: 2 },
    scrubFill: { position: 'absolute', left: 0, top: 8, height: 4, backgroundColor: colors.primary, borderRadius: 2 },
    scrubThumb: { position: 'absolute', top: 3, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: colors.textSec,
      marginLeft: 20, marginTop: 18, marginBottom: 8,
      textTransform: 'uppercase', letterSpacing: 1,
    },
    sectionSub: { fontSize: 12, color: colors.textSec, marginLeft: 20, marginBottom: 10 },
    realStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: 16, gap: 8, marginBottom: 8 },
    realStatCard: {
      width: (width - 48) / 3,
      backgroundColor: colors.card, borderRadius: 14,
      padding: 14, borderWidth: 1, alignItems: 'center',
    },
    realStatValue: { fontSize: 22, fontWeight: '800', marginBottom: 3 },
    realStatLabel: { color: colors.textSec, fontSize: 11, textAlign: 'center' },
    noMatchHint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginVertical: 12 },
    noMatchHintText: { color: colors.textSec, fontSize: 13 },
    errorMatchChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    errorMatchChipText: { color: colors.textSec, fontSize: 12, fontWeight: '600' },
    errorSummary: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 8 },
    errorSumItem: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1 },
    errorSumVal: { fontSize: 24, fontWeight: '800' },
    errorSumLabel: { color: colors.textSec, fontSize: 11, marginTop: 2, textAlign: 'center' },
    errorCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4 },
    errorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    errorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    errorTime: { fontSize: 12, fontWeight: '700', width: 40 },
    errorShot: { color: colors.text, fontWeight: '600', fontSize: 14 },
    errorZone: { color: colors.textSec, fontSize: 12, marginTop: 1 },
    errorRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    causePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    causeText: { fontSize: 11, fontWeight: '700' },
    errorExpanded: { marginTop: 4 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
    errorExpl: { color: colors.textSec, fontSize: 13, lineHeight: 20, marginBottom: 10 },
    tipBox: { flexDirection: 'row', borderRadius: 8, padding: 10, gap: 8, alignItems: 'flex-start' },
    tipText: { fontSize: 12, fontWeight: '600', flex: 1, lineHeight: 18 },
    filmHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12 },
    filmHeaderText: { fontSize: 16, fontWeight: '700', color: colors.text },
    courtMap: { marginHorizontal: 16, width: COURT_W, height: COURT_H, position: 'relative', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
    courtSurface: { ...StyleSheet.absoluteFill, backgroundColor: '#0F5FAD' },
    courtBorder: { position: 'absolute', top: 6, left: 10, right: 10, bottom: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 2 },
    courtNetLine: { position: 'absolute', top: '50%', left: 10, right: 10, height: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
    courtCenterLine: { position: 'absolute', top: 6, bottom: 6, left: '50%', width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
    posDot: { position: 'absolute', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, zIndex: 10 },
    courtLabel: { position: 'absolute', color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '600' },
    posRow: { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 12 },
    posPill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.card, borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: colors.border },
    pillDot: { width: 8, height: 8, borderRadius: 4 },
    pillText: { color: colors.textSec, fontSize: 12, fontWeight: '600' },
    posDetail: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, marginBottom: 4 },
    posName: { color: colors.text, fontWeight: '700', fontSize: 15, marginBottom: 8 },
    scoreRow: { flexDirection: 'row', height: 5, backgroundColor: colors.cardAlt, borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
    scoreBar: { backgroundColor: colors.primary },
    posScore: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
    posDesc: { color: colors.textSec, fontSize: 13, lineHeight: 19, marginBottom: 12 },
    proscons: { flexDirection: 'row', gap: 12 },
    proItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
    proText: { color: colors.textSec, fontSize: 12, lineHeight: 18, flex: 1 },
    tipCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: colors.border, gap: 10 },
    tipIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    tipCardText: { flex: 1, color: colors.textSec, fontSize: 13, lineHeight: 18 },

    // Match history picker
    pickerRow: { paddingHorizontal: 16, paddingBottom: 14, gap: 8, flexDirection: 'row' },
    pickerCard: {
      width: 76, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6,
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1.5, borderColor: colors.border,
    },
    pickerDate: { color: colors.textSec, fontSize: 10, fontWeight: '600', marginBottom: 3 },
    pickerScore: { fontSize: 22, fontWeight: '900' },
    pickerDuration: { color: colors.textSec, fontSize: 10, marginTop: 2 },
    pickerActiveDot: { width: 5, height: 5, borderRadius: 3, marginTop: 4 },
    pickerThumb: {
      width: 64, height: 40, borderRadius: 8, overflow: 'hidden', marginBottom: 6,
      position: 'relative',
    },
    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      marginHorizontal: 16, marginBottom: 14,
      backgroundColor: colors.cardAlt, borderRadius: 12,
      paddingHorizontal: 12, paddingVertical: 10,
      borderWidth: 1, borderColor: colors.border,
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
    noVideosWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    noVideosText: { color: colors.textSec, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },

    // Selected match score card — fixed spacing
    matchScoreCard: {
      marginHorizontal: 16, marginBottom: 14,
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4,
      flexDirection: 'row', alignItems: 'center', padding: 18, gap: 20,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    },
    matchScoreLeft: { alignItems: 'flex-start', gap: 8 },
    matchScoreNumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    matchScoreNum: { fontSize: 40, fontWeight: '900', letterSpacing: -1, lineHeight: 44 },
    matchScoreDenom: { color: colors.textSec, fontSize: 15, fontWeight: '600', marginBottom: 3 },
    matchBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    matchBadgeText: { fontSize: 11, fontWeight: '700' },
    matchScoreStats: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    matchStatCol: { alignItems: 'center', gap: 6 },
    matchStatVal: { fontSize: 16, fontWeight: '800' },
    matchStatLabel: { color: colors.textSec, fontSize: 9, fontWeight: '600', textAlign: 'center', lineHeight: 12 },
    matchStatDivider: { width: 1, height: 30, opacity: 0.5 },

    // Quick stats + coach
    quickStatsRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
    quickStatCard: { flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border },
    quickStatVal: { fontSize: 18, fontWeight: '800' },
    quickStatLabel: { color: colors.textSec, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    coachCard: { marginHorizontal: 16, marginTop: 10, marginBottom: 4, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    coachHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    coachIconWrap: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    coachTitle: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
    coachBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    coachBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
    coachTip: { color: colors.textSec, fontSize: 14, lineHeight: 21 },

    // Opponent input
    opponentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    opponentInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontWeight: '500' },

    // Bottom-sheet modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingTop: 12, paddingBottom: 40 },
    modalHandle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    modalBody: { color: colors.textSec, fontSize: 14, marginBottom: 14 },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingVertical: 4 },
    modalItemText: { color: colors.text, fontSize: 14, flex: 1 },
    modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, padding: 16, marginTop: 16 },
    modalBtnText: { fontWeight: '700', fontSize: 15, color: '#fff' },

    // Countdown / setup screen
    countdownView: { paddingVertical: 8 },
    countdownTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 16 },
    countdownSub: { fontSize: 13, color: colors.textSec, marginBottom: 16 },
    orientRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    orientBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.cardAlt },
    orientBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSec },
    customInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
    customInput: { width: 80, height: 52, borderRadius: 12, borderWidth: 1.5, fontSize: 24, fontWeight: '700', textAlign: 'center' },
    customInputUnit: { fontSize: 15, fontWeight: '500' },
    countdownOptions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    countdownOption: { flex: 1, borderRadius: 10, borderWidth: 1.5, paddingVertical: 10, alignItems: 'center', borderColor: colors.border, backgroundColor: colors.cardAlt },
    countdownOptNum: { fontSize: 16, fontWeight: '700' },
    countdownBigView: { alignItems: 'center', paddingVertical: 24 },
    countdownBig: { fontSize: 88, fontWeight: '900', lineHeight: 96 },
    orientHint: { fontSize: 13, fontWeight: '500', marginTop: 12 },

    // Saved / playback
    savedView: { alignItems: 'center', paddingVertical: 8, gap: 10 },
    savedTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
    savedSub: { fontSize: 13, color: colors.textSec, textAlign: 'center' },

    // Full-screen recording HUD
    recHud: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
    recTimerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
    recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
    recTimerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    recBadge: { backgroundColor: 'rgba(200,30,30,0.88)', borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
    recBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
    recCornerTL: { position: 'absolute', width: 13, height: 13, borderTopWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
    recCornerTR: { position: 'absolute', width: 13, height: 13, borderTopWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
    recCornerBL: { position: 'absolute', width: 13, height: 13, borderBottomWidth: 2, borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
    recCornerBR: { position: 'absolute', width: 13, height: 13, borderBottomWidth: 2, borderRightWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
    recStopArea: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
    recStopBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', alignItems: 'center' },
    recStopInner: { width: 26, height: 26, borderRadius: 5, backgroundColor: colors.danger },
    recStopLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500', marginTop: 10 },

    // Position picker court
    posPickerCourt: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 14, overflow: 'hidden', marginBottom: 20, backgroundColor: '#0F5FAD' },
    posPickerRow: { flexDirection: 'row' },
    posPickerZone: { flex: 1, height: 80, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', gap: 6 },
    posPickerNet: { height: 3, backgroundColor: 'rgba(255,255,255,0.88)', marginHorizontal: 0 },
    posPickerCourtLabel: { textAlign: 'center', fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.55)', paddingVertical: 6 },
    posPickerZoneLabel: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

    // Shot Timeline
    shotTimelineCard: { marginHorizontal: 16, marginBottom: 14, backgroundColor: colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
    shotTimelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    shotTimelineTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
    shotTimelineBadges: { flexDirection: 'row', gap: 6 },
    shotBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    shotBadgeText: { fontSize: 11, fontWeight: '700' },
  });
}

const AI_BG = '#05091A';
const AI_BLUE = '#3B82F6';
const AI_BLUE_LIGHT = '#60A5FA';

const ai = StyleSheet.create({
  root: { flex: 1, backgroundColor: AI_BG },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  ringContainer: { width: 210, height: 210, justifyContent: 'center', alignItems: 'center', marginBottom: 36 },
  ringOuter: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: AI_BLUE },
  arcCW: { position: 'absolute', width: 175, height: 175, borderRadius: 88, borderWidth: 2.5, borderColor: 'transparent', borderTopColor: AI_BLUE_LIGHT, borderRightColor: AI_BLUE + '55' },
  arcCCW: { position: 'absolute', width: 145, height: 145, borderRadius: 73, borderWidth: 1.5, borderColor: 'transparent', borderBottomColor: AI_BLUE_LIGHT + '99', borderLeftColor: AI_BLUE + '44' },
  orb: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(37,99,235,0.14)', borderWidth: 2, borderColor: AI_BLUE, justifyContent: 'center', alignItems: 'center', shadowColor: AI_BLUE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 18 },
  aiLabel: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: 3 },
  phaseText: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '500', marginTop: 44, textAlign: 'center', letterSpacing: 0.2 },
  pctText: { color: AI_BLUE_LIGHT, fontSize: 13, fontWeight: '700', marginTop: 6 },
  progressTrack: { width: '80%', height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: AI_BLUE, borderRadius: 2 },
  progressGlow: { position: 'absolute', top: -3, width: 12, height: 9, backgroundColor: AI_BLUE_LIGHT, borderRadius: 6, opacity: 0.7 },
  hint: { color: 'rgba(255,255,255,0.22)', fontSize: 12, marginTop: 28, letterSpacing: 0.4 },
  doneScroll: { alignItems: 'center', paddingTop: 0, paddingBottom: 40, paddingHorizontal: 0, width: '100%' },
  videoWrap: { width: '100%', backgroundColor: 'rgba(37,99,235,0.07)', borderBottomWidth: 1, borderBottomColor: 'rgba(59,130,246,0.15)', marginBottom: 20, overflow: 'hidden' },
  videoThumb: { height: 180, backgroundColor: '#071428', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  videoCourtLine: { position: 'absolute', left: '10%', right: '10%', top: '50%', height: 1.5, backgroundColor: 'rgba(255,255,255,0.12)' },
  videoCourtNet: { position: 'absolute', left: '10%', right: '10%', top: '48%', height: 3, backgroundColor: 'rgba(255,255,255,0.07)' },
  videoPlayCircle: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(59,130,246,0.25)', borderWidth: 2, borderColor: AI_BLUE, justifyContent: 'center', alignItems: 'center', paddingLeft: 4 },
  videoBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  videoBarTitle: { color: '#fff', fontSize: 13, fontWeight: '600' },
  videoBarMeta: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 18, width: '100%', paddingHorizontal: 24, marginBottom: 20 },
  scoreCircle: { width: 96, height: 96, borderRadius: 48, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(37,99,235,0.08)', flexShrink: 0 },
  scoreNum: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  scoreMax: { color: 'rgba(255,255,255,0.3)', fontSize: 12, fontWeight: '600', marginTop: -4 },
  scoreMeta: { flex: 1 },
  scoreLbl: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 2 },
  scoreSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 8 },
  scoreBadge: { alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  scoreBadgeText: { fontSize: 12, fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, width: '100%', marginBottom: 20, paddingHorizontal: 24 },
  statCard: { width: '31%', backgroundColor: 'rgba(37,99,235,0.09)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', flexGrow: 1 },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.35)', fontSize: 9, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  summaryText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 28, marginBottom: 18, marginTop: -8 },
  section: { alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', marginHorizontal: 24 },
  sectionHead: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bulletText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, lineHeight: 19, flex: 1 },
  doneBtn: { alignSelf: 'stretch', backgroundColor: AI_BLUE, borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 12, marginHorizontal: 24 },
  doneBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  closeText: { color: 'rgba(255,255,255,0.28)', fontSize: 13, fontWeight: '500' },
  frameBox: { width: 180, height: 120, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(37,99,235,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  fCorner: { position: 'absolute', width: 12, height: 12, borderColor: AI_BLUE_LIGHT },
  fTL: { top: 4, left: 4, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  fTR: { top: 4, right: 4, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  fBL: { bottom: 4, left: 4, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  fBR: { bottom: 4, right: 4, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  frameScanLine: { position: 'absolute', left: 0, right: 0, height: 1.5, backgroundColor: AI_BLUE_LIGHT, opacity: 0.85 },
  frameCountText: { color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: '600', marginBottom: 18, letterSpacing: 0.5 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, marginTop: -20 },
  savedText: { color: AI_BLUE_LIGHT, fontSize: 12, fontWeight: '600' },
  watchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: 'rgba(59,130,246,0.12)', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  watchBtnText: { color: AI_BLUE_LIGHT, fontSize: 14, fontWeight: '600' },
});
