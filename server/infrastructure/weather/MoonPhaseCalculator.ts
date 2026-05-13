// Алгоритм Конвея: вычисляет фазу луны по дате без внешних запросов.
// Точность ±1 день — достаточно для прогноза погоды.

const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z');
const SYNODIC_MONTH = 29.53059; // дней

export interface MoonPhaseResult {
  phase: number; // 0.0–1.0 (0 = новолуние, 0.5 = полнолуние)
  name: string;
  emoji: string;
}

export function getMoonPhase(date: Date): MoonPhaseResult {
  const diffDays = (date.getTime() - KNOWN_NEW_MOON.getTime()) / 86_400_000;
  const phase = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH / SYNODIC_MONTH;

  let name: string;
  let emoji: string;

  if (phase < 0.03 || phase > 0.97) { name = 'Новолуние';        emoji = '🌑'; }
  else if (phase < 0.22)             { name = 'Молодая луна';     emoji = '🌒'; }
  else if (phase < 0.28)             { name = 'Первая четверть';  emoji = '🌓'; }
  else if (phase < 0.47)             { name = 'Растущая луна';    emoji = '🌔'; }
  else if (phase < 0.53)             { name = 'Полнолуние';       emoji = '🌕'; }
  else if (phase < 0.72)             { name = 'Убывающая луна';   emoji = '🌖'; }
  else if (phase < 0.78)             { name = 'Последняя четверть'; emoji = '🌗'; }
  else                               { name = 'Старая луна';      emoji = '🌘'; }

  return { phase: Math.round(phase * 1000) / 1000, name, emoji };
}
