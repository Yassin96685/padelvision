import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Linking, Platform } from 'react-native';
import { saveMatch, loadMatches, deleteMatch as supaDeleteMatch } from '../services/supabaseService';
import { translate } from '../i18n/LocaleContext';

const DEFAULT_KEY = '@padelvision/matches';
const matchKey = (userId: string) => userId ? `@padelvision/matches_${userId}` : DEFAULT_KEY;

export type CoachingTip = {
  shot: string;
  zone: string;
  cause: string;
  severity: 'high' | 'medium' | 'low';
  explanation: string;
  tip: string;
};

export type ShotEntry = {
  id: string;
  timestamp: number;
  type: string;
  outcome: 'winner' | 'fehler' | 'neutral';
  courtZone: string;
  aiComment: string;
};

export type AnalysisResult = {
  shots: number;
  winners: number;
  errors: number;
  errorRate: number;
  score: number;
  coverage: number;
  avgRally: string;
  strengths: string[];
  improvements: string[];
  strengthKeys?: string[];
  improvementKeys?: string[];
  coachingTips?: CoachingTip[];
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  zones?: { net: number; mid: number; back: number; left: number; right: number };
  shots_timeline?: ShotEntry[];
};

export type StoredMatch = {
  id: string;
  date: string;
  recordSeconds: number;
  videoUri: string | null;
  thumbnailUri?: string | null;
  opponent?: string;
  playerPosition?: string;
  result: AnalysisResult;
};

type MatchContextType = {
  matches: StoredMatch[];
  addMatch: (match: StoredMatch) => void;
  updateMatchMedia: (id: string, videoUri: string | null, thumbnailUri: string | null) => void;
  deleteMatch: (id: string) => void;
  loading: boolean;
};

const MatchContext = createContext<MatchContextType>({
  matches: [],
  addMatch: () => {},
  updateMatchMedia: () => {},
  deleteMatch: () => {},
  loading: false,
});

export function MatchProvider({ children, userId = '' }: { children: React.ReactNode; userId?: string }) {
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoaded(false);
    setMatches([]);
    setLoading(true);

    loadMatches()
      .then(supabaseMatches => {
        if (supabaseMatches.length > 0) {
          setMatches(supabaseMatches);
          // Keep local cache in sync
          AsyncStorage.setItem(matchKey(userId), JSON.stringify(supabaseMatches)).catch(() => {});
        } else {
          // Supabase empty — try local cache (first run or offline)
          return AsyncStorage.getItem(matchKey(userId)).then(json => {
            if (json) setMatches(JSON.parse(json));
          });
        }
      })
      .catch(() => {
        // Network unavailable — fall back to local cache
        AsyncStorage.getItem(matchKey(userId))
          .then(json => { if (json) setMatches(JSON.parse(json)); })
          .catch(() => {});
      })
      .finally(() => {
        setLoaded(true);
        setLoading(false);
      });
  }, [userId]);

  // Keep local cache in sync whenever matches change
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(matchKey(userId), JSON.stringify(matches)).catch(() => {});
  }, [matches, loaded, userId]);

  const addMatch = (match: StoredMatch) => {
    setMatches(prev => [match, ...prev]);
    saveMatch(match, userId || undefined).catch((err) => {
      const msg = err?.message ?? String(err);
      console.error('[Supabase] saveMatch failed:', msg);
      Alert.alert(translate('error.saveTitle'), translate('error.saveMsg', { msg }));
    });

    // Rating prompt after the 3rd match
    AsyncStorage.getItem('@padelvision/rating_asked').then(async asked => {
      if (asked) return;
      const countStr = await AsyncStorage.getItem('@padelvision/total_match_count');
      const count = parseInt(countStr ?? '0', 10) + 1;
      await AsyncStorage.setItem('@padelvision/total_match_count', String(count));
      if (count >= 3) {
        await AsyncStorage.setItem('@padelvision/rating_asked', '1');
        setTimeout(() => {
          Alert.alert(
            translate('rating.title'),
            translate('rating.msg'),
            [
              { text: translate('rating.later'), style: 'cancel' },
              {
                text: translate('rating.now'),
                onPress: () => {
                  const url = Platform.OS === 'ios'
                    ? 'https://apps.apple.com/app/padelvision'
                    : 'https://play.google.com/store/apps/details?id=com.padelvision.app';
                  Linking.openURL(url).catch(() => {});
                },
              },
            ],
          );
        }, 2000);
      }
    }).catch(() => {});
  };

  const updateMatchMedia = (id: string, videoUri: string | null, thumbnailUri: string | null) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== id) return m;
      return {
        ...m,
        ...(videoUri !== null ? { videoUri } : {}),
        ...(thumbnailUri !== null ? { thumbnailUri } : {}),
      };
    }));
  };

  const deleteMatch = (id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
    supaDeleteMatch(id).catch(() => {});
  };

  return (
    <MatchContext.Provider value={{ matches, addMatch, updateMatchMedia, deleteMatch, loading }}>
      {children}
    </MatchContext.Provider>
  );
}

export const useMatches = () => useContext(MatchContext);
