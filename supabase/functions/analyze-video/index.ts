const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LANG_LABEL: Record<string, string> = {
  de: 'German', en: 'English', es: 'Spanish', fr: 'French',
};

const ZONES: Record<string, Record<string, string>> = {
  de: { net: 'Netzbereich',   mid: 'Mittelfeld',      back: 'Hinterwand',      side: 'Seitenwand',      base: 'Grundlinie'       },
  en: { net: 'Net Zone',      mid: 'Mid Court',       back: 'Back Glass',      side: 'Side Glass',      base: 'Baseline'         },
  es: { net: 'Zona de Red',   mid: 'Zona Central',    back: 'Cristal Trasero', side: 'Cristal Lateral', base: 'Línea de Fondo'   },
  fr: { net: 'Zone Filet',    mid: 'Milieu de Court', back: 'Vitre Arrière',   side: 'Vitre Latérale',  base: 'Ligne de Fond'    },
};

const POSITION_LABEL: Record<string, string> = {
  'left-back':  'BACK-LEFT quadrant (their side, left half, near back wall — defending position)',
  'right-back': 'BACK-RIGHT quadrant (their side, right half, near back wall — defending position)',
  'left-net':   'NET-LEFT quadrant (their side, left half, near the net — attacking position)',
  'right-net':  'NET-RIGHT quadrant (their side, right half, near the net — attacking position)',
};

function buildPrompt(frameCount: number, durationSecs: number, locale: string, playerPosition?: string): string {
  const durationMin = (durationSecs / 60).toFixed(1);
  const lang = LANG_LABEL[locale] ?? 'English';
  const z    = ZONES[locale] ?? ZONES['en'];
  const focusLine = playerPosition && POSITION_LABEL[playerPosition]
    ? `\n\n⚠️ CRITICAL — ONE PLAYER ONLY ⚠️\nThe player being analyzed is in the **${POSITION_LABEL[playerPosition]}** of the court.\nYou MUST track and assess ONLY THIS ONE PLAYER across all frames.\nCOMPLETELY IGNORE all other players on the court (opponents and partner).\nAll statistics (shots, winners, errors, zones) refer exclusively to this one player.\n`
    : '';

  return `You are an elite padel coach and performance analyst with 20+ years of professional coaching experience. You have sharp eyes for technique flaws and tactical positioning.

You are given ${frameCount} frames extracted evenly from a ${Math.round(durationSecs)}-second (${durationMin} min) padel match video. Analyze them carefully in sequence.${focusLine}

═══ ANALYSIS STEPS ═══

STEP 1 — VERIFY SPORT
Confirm padel: enclosed glass/mesh walls, solid perforated racket, low net, small court.
Set isPadel = false for tennis, squash, badminton.

STEP 2 — ANALYZE EACH FRAME SEQUENTIALLY
For every frame, locate the ONE player in the specified quadrant and note ONLY their actions.
Ignore all other players completely.
• Their court zone: net zone / mid-court / back wall — attacking or defending?
• Shot THEY are playing: serve | bandeja | vibora | lob/globo | overhead smash | volley | forehand drive | backhand slice | drop shot | return
• Their technique quality markers:
  – Racket preparation: early or late?
  – Contact point: in front of body (correct) or late/behind (error)?
  – Footwork: split step before shot? Weight transfer forward?
  – Balance: stable or off-balance at impact?
  – Wrist: firm (correct) or loose/floppy?
• Their tactical awareness: net domination, court coverage gaps

STEP 3 — SKILL LEVEL
Based on THIS player's observed technique only, classify: beginner / intermediate / advanced

STEP 4 — COURT ZONES
Count which zone THIS ONE tracked player occupied in each frame:
- net: front third of their side (attacking position at net)
- mid: middle third (transition zone)
- back: back third (defensive position near back wall)
- left: left half of their side (when facing the net)
- right: right half of their side (when facing the net)
Return as INTEGER PERCENTAGES (0–100): net + mid + back must equal 100, left + right must equal 100.

STEP 5 — STATISTICS (THIS ONE PLAYER ONLY)
CRITICAL COUNTING RULE: A shot only counts if it is DIRECTLY VISIBLE in at least one frame — meaning you can see the player making racket contact, the ball is visible near the racket, or the follow-through is clearly in progress. Do NOT extrapolate or assume shots happened between frames.

- shots: count ONLY the shots where racket contact is directly visible or strongly implied in a frame. Be conservative — if uncertain, do NOT count it.
- winners: count only clear winners made by THIS player (ball visibly out of reach for opponents)
- errors: count only clear errors (ball visibly hits net or lands out)
- errorRate: errors/shots × 100, round to integer
- coverage: 0–100 estimate of how much of their half THIS player covered
- avgRally: estimate average rally length based on what you saw
- score: 0–100 overall performance score based on THIS player's technique quality only

Reference rates (use ONLY to sanity-check, never to override your direct observation):
• Beginner: ~3–8 shots/min for THIS player alone   • Intermediate: ~8–15 shots/min   • Advanced: ~15–25 shots/min
If your count seems too high compared to these rates, recount and be more conservative.

STEP 6 — 3 COACHING TIPS FOR THIS PLAYER
Based on SPECIFIC technique issues you observed in THIS player (NOT generic advice, NOT about other players):
• Each tip targets one concrete, observable technical problem
• severity: "high" = critical flaw affecting every rally | "medium" = inconsistent problem | "low" = refinement
• ALL text in tips MUST be in ${lang}
• Use ONLY these exact zone names: "${z['net']}", "${z['mid']}", "${z['back']}", "${z['side']}", "${z['base']}"

STEP 7 — SHOT TIMELINE (max 15 entries)
For each notable shot you identified, estimate its timestamp in the video.
Frames are evenly distributed: frame i of ${frameCount} corresponds to ≈ second (i-0.5)/${frameCount} × ${durationSecs}.
Round timestamps to integers. outcome must be exactly "winner", "fehler", or "neutral".
Keep aiComment to max 1 sentence in ${lang}.

═══ RESPOND ONLY WITH THIS JSON (no markdown, no code fence) ═══
{
  "isPadel": boolean,
  "skillLevel": "beginner"|"intermediate"|"advanced",
  "shots": integer,
  "winners": integer,
  "errors": integer,
  "errorRate": integer,
  "coverage": integer,
  "avgRally": "X.X",
  "score": integer,
  "zones": { "net": 0, "mid": 0, "back": 0, "left": 0, "right": 0 },
  "coachingTips": [
    {
      "shot": "shot name in ${lang}",
      "zone": "exact zone name from the list above",
      "cause": "root cause category in ${lang} (e.g. Technik / Timing / Positionierung / Entscheidung / Fußarbeit)",
      "severity": "high",
      "explanation": "2 sentences: what went wrong and the biomechanical reason why (in ${lang})",
      "tip": "1 concrete, measurable fix the player can do next session (in ${lang})"
    },
    { "shot": "...", "zone": "...", "cause": "...", "severity": "medium", "explanation": "...", "tip": "..." },
    { "shot": "...", "zone": "...", "cause": "...", "severity": "low",    "explanation": "...", "tip": "..." }
  ],
  "shots_timeline": [
    { "id": "1", "timestamp": 12, "type": "shot name in ${lang}", "outcome": "winner|fehler|neutral", "courtZone": "exact zone name", "aiComment": "1 sentence in ${lang}" }
  ]
}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { frames, durationSecs, locale = 'en', playerPosition } = await req.json();

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(frames) || frames.length === 0) {
      return new Response(JSON.stringify({ error: 'no frames provided' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const content = [
      ...frames.map((data: string) => ({
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data },
      })),
      { type: 'text', text: buildPrompt(frames.length, durationSecs, locale, playerPosition) },
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'unknown error' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
