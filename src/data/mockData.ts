export const lastMatch = {
  id: '1',
  date: 'May 20, 2025',
  opponent: 'Carlos & Miguel',
  result: 'W',
  score: '6-4, 7-5',
  duration: '1h 12min',
  totalPoints: 84,
  pointsWon: 46,
  pointsLost: 38,
  category: 'P4',
};

export const seasonStats = {
  matchesPlayed: 24,
  wins: 16,
  losses: 8,
  winRate: 66.7,
  totalHoursPlayed: 38,
  avgDuration: '1h 35min',
};

export const shotStats = [
  { name: 'Smash', success: 88, attempts: 16, color: '#FFA502' },
  { name: 'Serve', success: 84, attempts: 32, color: '#00D97E' },
  { name: 'Bandeja', success: 82, attempts: 28, color: '#8B5CF6' },
  { name: 'Forehand', success: 78, attempts: 64, color: '#3D8EF5' },
  { name: 'Vibora', success: 70, attempts: 20, color: '#EC4899' },
  { name: 'Backhand', success: 65, attempts: 48, color: '#06B6D4' },
  { name: 'Lob', success: 55, attempts: 22, color: '#F97316' },
];

export const unforcedErrors = [
  {
    id: '1',
    time: '12:34',
    shot: 'Backhand Slice',
    zone: 'Net Zone',
    cause: 'Technique',
    severity: 'high' as const,
    explanation: 'Wrist was too stiff during follow-through. The ball clipped the top of the net due to insufficient lift angle on the racket face.',
    tip: 'Open racket face 10° more on backhand slices near the net.',
  },
  {
    id: '2',
    time: '23:10',
    shot: 'Defensive Lob',
    zone: 'Back Glass',
    cause: 'Positioning',
    severity: 'medium' as const,
    explanation: 'Positioned too close to the back glass when executing the lob. Limited swing path forced the ball into the net.',
    tip: 'Step 1-2m forward before lobbing from the back glass.',
  },
  {
    id: '3',
    time: '34:55',
    shot: 'Vibora',
    zone: 'Net Zone',
    cause: 'Timing',
    severity: 'high' as const,
    explanation: 'Late contact point behind the body resulted in loss of spin and directional control. The ball sailed wide.',
    tip: 'Move to the ball earlier — contact point should be in front of the right shoulder.',
  },
  {
    id: '4',
    time: '45:22',
    shot: 'Forehand Drive',
    zone: 'Mid Court',
    cause: 'Technique',
    severity: 'low' as const,
    explanation: 'Arm was fully extended at contact reducing power transfer. Shot went wide to the right side.',
    tip: 'Maintain a slight elbow bend at contact for better control.',
  },
  {
    id: '5',
    time: '1:02:44',
    shot: 'Overhead Smash',
    zone: 'Net Zone',
    cause: 'Decision Making',
    severity: 'medium' as const,
    explanation: 'Misjudged trajectory after side glass rebound. Rushed the preparation resulting in off-center contact.',
    tip: 'Let the ball drop lower after a glass rebound before attacking.',
  },
];

export const aiInsights = [
  {
    id: '1',
    category: 'Technique',
    icon: 'tennisball',
    title: 'Backhand Consistency',
    description: 'Your backhand slice shows a 13% lower success rate than your forehand. Analysis detects excessive wrist tension during the follow-through phase in 7 of your 9 backhand errors.',
    priority: 'high' as const,
    improvement: '+13% potential',
    color: '#FF4757',
  },
  {
    id: '2',
    category: 'Positioning',
    icon: 'location',
    title: 'Net Approach Timing',
    description: 'You approach the net 0.8s later than optimal after a successful bandeja. This recovery window gives opponents an extra shot. Faster net approach could win ~6 more points per match.',
    priority: 'high' as const,
    improvement: '+6 pts/match',
    color: '#3D8EF5',
  },
  {
    id: '3',
    category: 'Strategy',
    icon: 'git-network',
    title: 'Glass Play Reads',
    description: 'You excel at back glass play (82% success) but struggle with side glass rebounds (58%). Opponents have started targeting your side glass. Focus training on reading those angles.',
    priority: 'medium' as const,
    improvement: '+24% side glass',
    color: '#8B5CF6',
  },
  {
    id: '4',
    category: 'Movement',
    icon: 'footsteps',
    title: 'Court Coverage Balance',
    description: 'Heatmap shows 34% of movement concentrated in the left-back quadrant. The right side is underutilized. Balancing coverage will reduce easy winners against you.',
    priority: 'medium' as const,
    improvement: 'Better balance',
    color: '#FFA502',
  },
  {
    id: '5',
    category: 'Mental',
    icon: 'pulse',
    title: 'Break Point Composure',
    description: 'Error rate increases by 28% on break points. Pattern suggests tension buildup from game 4 onward. A consistent pre-point breathing routine could reduce this significantly.',
    priority: 'low' as const,
    improvement: '-28% bp errors',
    color: '#06B6D4',
  },
];

export const matchSummary = `In this 1h 12min clash against Carlos & Miguel, you dominated the first set with consistent net play and effective bandejas. Your serve held at 84% first-serve points won throughout.

The second set grew more competitive as opponents adjusted, targeting your backhand. This caused 5 of your 12 unforced errors. Despite the pressure, your overhead smash (88% conversion) proved decisive in key moments.

Turning point: Game 5, second set — you won 4 consecutive points from 0-30 down using aggressive net approaches and a perfectly placed vibora down the line.`;

export const highlights = [
  { id: '1', time: '8:22', title: 'Winning Vibora Sequence', duration: '18s', type: 'winner' },
  { id: '2', time: '31:44', title: 'Glass Play Rally', duration: '24s', type: 'rally' },
  { id: '3', time: '47:15', title: 'Break Point Defense', duration: '31s', type: 'defense' },
  { id: '4', time: '1:05:33', title: 'Net Domination', duration: '22s', type: 'winner' },
];

// 16 rows × 10 cols heatmap (intensity 0–1) — player's half of court
export const heatmapData = [
  [0.10, 0.10, 0.15, 0.10, 0.10, 0.10, 0.15, 0.10, 0.10, 0.10],
  [0.12, 0.18, 0.20, 0.18, 0.12, 0.12, 0.20, 0.22, 0.18, 0.12],
  [0.20, 0.28, 0.38, 0.30, 0.20, 0.22, 0.32, 0.40, 0.28, 0.18],
  [0.30, 0.40, 0.52, 0.50, 0.32, 0.30, 0.50, 0.60, 0.40, 0.22],
  [0.40, 0.52, 0.72, 0.80, 0.52, 0.44, 0.70, 0.88, 0.52, 0.30],
  [0.50, 0.70, 0.90, 1.00, 0.80, 0.72, 0.88, 1.00, 0.62, 0.38],
  [0.42, 0.62, 0.82, 0.92, 0.72, 0.62, 0.80, 0.90, 0.52, 0.30],
  [0.32, 0.42, 0.62, 0.72, 0.52, 0.50, 0.62, 0.72, 0.42, 0.22],
  [0.22, 0.32, 0.44, 0.52, 0.34, 0.32, 0.44, 0.52, 0.32, 0.20],
  [0.30, 0.40, 0.52, 0.62, 0.44, 0.42, 0.52, 0.60, 0.40, 0.22],
  [0.40, 0.52, 0.62, 0.70, 0.52, 0.50, 0.62, 0.70, 0.50, 0.30],
  [0.50, 0.62, 0.72, 0.80, 0.62, 0.60, 0.78, 0.80, 0.60, 0.40],
  [0.42, 0.52, 0.62, 0.72, 0.52, 0.50, 0.70, 0.72, 0.52, 0.32],
  [0.32, 0.42, 0.52, 0.62, 0.50, 0.50, 0.60, 0.62, 0.42, 0.30],
  [0.20, 0.30, 0.40, 0.50, 0.40, 0.40, 0.50, 0.52, 0.30, 0.20],
  [0.10, 0.18, 0.28, 0.30, 0.22, 0.20, 0.28, 0.30, 0.18, 0.10],
];

export const phonePositions = [
  {
    id: '1',
    name: 'Center Baseline (Best)',
    score: 95,
    x: 0.5,
    y: 0.92,
    color: '#00D97E',
    description: 'Place at center of back fence, 2.5m height. Full court view capturing both players and glass rebounds.',
    pros: ['Full court coverage', 'Both players always visible', 'Glass rebounds captured'],
    cons: ['Needs tripod or fence clip mount'],
  },
  {
    id: '2',
    name: 'Corner Diagonal',
    score: 82,
    x: 0.08,
    y: 0.08,
    color: '#3D8EF5',
    description: 'Diagonal from corner at 2m height. Great 3D perspective showing court depth and player positioning.',
    pros: ['Depth perception', 'Unique angle for positioning analysis'],
    cons: ['Opposite corner has small blind spot'],
  },
  {
    id: '3',
    name: 'Side Fence Mid',
    score: 74,
    x: 0.08,
    y: 0.5,
    color: '#FFA502',
    description: 'Halfway along the side fence at 2m height. Best for analyzing lateral movement and cross-court exchanges.',
    pros: ['Clear lateral movement tracking', 'Ideal for glass play analysis'],
    cons: ['Net post can block near player', 'Misses far side details'],
  },
];
