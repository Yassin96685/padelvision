import { supabase } from './supabase';

type AnalysisResult = {
  shots: number; winners: number; errors: number; errorRate: number;
  score: number; coverage: number; avgRally: string;
  strengths: string[]; improvements: string[];
  strengthKeys?: string[]; improvementKeys?: string[];
};

type StoredMatch = {
  id: string; date: string; recordSeconds: number;
  videoUri: string | null; thumbnailUri?: string | null;
  opponent?: string; result: AnalysisResult;
};

async function uploadFileToStorage(
  localUri: string,
  bucket: string,
  path: string,
  contentType: string,
): Promise<string | null> {
  try {
    // React Native: { uri, name, type } in FormData triggers native file streaming
    const formData = new FormData();
    formData.append('file', {
      uri: localUri,
      name: path.split('/').pop() ?? 'file',
      type: contentType,
    } as any);

    const { error } = await (supabase.storage as any)
      .from(bucket)
      .upload(path, formData, { upsert: true });

    if (error) {
      console.warn(`[Supabase] upload ${bucket}/${path}:`, error.message);
      return null;
    }

    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch (e: any) {
    console.warn(`[Supabase] upload exception ${bucket}/${path}:`, e?.message ?? e);
    return null;
  }
}

export async function uploadVideo(localUri: string, matchId: string): Promise<string | null> {
  return uploadFileToStorage(localUri, 'videos', `${matchId}.mp4`, 'video/mp4');
}

export async function uploadThumbnail(localUri: string, matchId: string): Promise<string | null> {
  return uploadFileToStorage(localUri, 'thumbnails', `${matchId}.jpg`, 'image/jpeg');
}

export async function saveMatch(match: StoredMatch, userId?: string): Promise<void> {
  const { error } = await supabase.from('matches').insert({
    id: match.id,
    user_id: userId ?? null,
    date: match.date,
    record_seconds: match.recordSeconds,
    video_url: match.videoUri ?? null,
    thumbnail_url: match.thumbnailUri ?? null,
    opponent: match.opponent ?? null,
    shots: match.result.shots,
    winners: match.result.winners,
    errors: match.result.errors,
    error_rate: match.result.errorRate,
    score: match.result.score,
    coverage: match.result.coverage,
    avg_rally: match.result.avgRally,
    strengths: match.result.strengths,
    improvements: match.result.improvements,
    strength_keys: match.result.strengthKeys ?? [],
    improvement_keys: match.result.improvementKeys ?? [],
    result_json: match.result,
  });
  if (error) throw error;
}

export async function updateMatchUrls(matchId: string, videoUrl: string | null, thumbnailUrl: string | null): Promise<void> {
  const updates: Record<string, string | null> = {};
  if (videoUrl) updates.video_url = videoUrl;
  if (thumbnailUrl) updates.thumbnail_url = thumbnailUrl;
  if (!Object.keys(updates).length) return;
  await supabase.from('matches').update(updates).eq('id', matchId);
}

export async function deleteMatch(matchId: string): Promise<void> {
  await supabase.from('matches').delete().eq('id', matchId);
}

export async function loadMatches(): Promise<StoredMatch[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return [];

  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if (error) {
    console.warn('[Supabase] loadMatches error:', error.message);
    return [];
  }
  if (!data) return [];

  return data.map((row: any) => {
    const rj = row.result_json;
    return {
      id: row.id,
      date: row.date,
      recordSeconds: row.record_seconds,
      videoUri: row.video_url ?? null,
      thumbnailUri: row.thumbnail_url ?? null,
      opponent: row.opponent ?? undefined,
      result: {
        shots: row.shots,
        winners: row.winners,
        errors: row.errors,
        errorRate: row.error_rate,
        score: row.score,
        coverage: row.coverage,
        avgRally: row.avg_rally,
        strengths: row.strengths ?? [],
        improvements: row.improvements ?? [],
        strengthKeys: row.strength_keys ?? [],
        improvementKeys: row.improvement_keys ?? [],
        coachingTips: rj?.coachingTips ?? undefined,
        skillLevel: rj?.skillLevel ?? undefined,
        zones: rj?.zones ?? undefined,
        shots_timeline: rj?.shots_timeline ?? undefined,
      },
    };
  });
}
