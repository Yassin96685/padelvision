import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import type { CoachingTip, ShotEntry } from '../store/MatchContext';

export interface ClaudeAnalysisResult {
  isPadel: boolean;
  shots: number;
  winners: number;
  errors: number;
  errorRate: number;
  coverage: number;
  avgRally: string;
  score: number;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  coachingTips?: CoachingTip[];
  zones?: { net: number; mid: number; back: number; left: number; right: number };
  shots_timeline?: ShotEntry[];
}

const SUPABASE_URL      = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
const EDGE_FN_URL       = `${SUPABASE_URL}/functions/v1/analyze-video`;

async function fileToBase64(uri: string): Promise<string | null> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    return null;
  }
}

async function extractFrames(videoUri: string, durationSecs: number): Promise<string[]> {
  const durationMs = Math.max(durationSecs, 1) * 1000;
  // 1 frame every 1.5 seconds — min 5, max 40 (genauere Schlag-Schaetzung)
  const count = Math.min(40, Math.max(5, Math.floor(durationSecs / 1.5)));
  const frames: string[] = [];

  for (let i = 0; i < count; i++) {
    const timeMs = Math.round(((i + 0.5) / count) * durationMs);
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: Math.max(100, timeMs),
        quality: 0.75,
      });
      const base64 = await fileToBase64(uri);
      if (base64) frames.push(base64);
    } catch {
      // frame not available, skip
    }
  }
  return frames;
}

export async function analyzeVideo(
  videoUri: string,
  durationSecs: number,
  locale: string = 'de',
  playerPosition?: string,
): Promise<ClaudeAnalysisResult | null> {
  const frames = await extractFrames(videoUri, durationSecs);

  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 120_000);

  try {
    const response = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ frames, durationSecs, locale, playerPosition }),
      signal: ctrl.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Edge Function ${response.status}: ${body}`);
    }

    const data = await response.json();
    const text: string = data.content?.[0]?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]) as ClaudeAnalysisResult;
    if (frames.length === 0) result.isPadel = true;
    return result;
  } catch (e: any) {
    clearTimeout(timeoutId);
    throw e;
  }
}
