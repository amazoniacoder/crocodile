import React from 'react';

interface Props {
  code: number;
  size?: number;
  hour?: number; // час в timezone города (0-23), если не передан — берётся локальный
}

export function isNightHour(hour?: number): boolean {
  const h = hour ?? new Date().getHours();
  return h >= 21 || h < 5;
}

export function getWeatherDescription(code: number, isNight = false): string {
  if (code === 0) return isNight ? 'Ясная ночь' : 'Ясно';
  if (code === 1) return isNight ? 'Преимущественно ясная ночь' : 'Преимущественно ясно';
  if (code === 2) return isNight ? 'Переменная облачность ночью' : 'Переменная облачность';
  if (code === 3)                  return 'Пасмурно';
  if (code === 45 || code === 48)  return 'Туман';
  if (code === 51)                 return 'Лёгкая морось';
  if (code === 53)                 return 'Морось';
  if (code === 55)                 return 'Сильная морось';
  if (code === 61)                 return 'Небольшой дождь';
  if (code === 63)                 return 'Дождь';
  if (code === 65)                 return 'Сильный дождь';
  if (code === 71)                 return 'Небольшой снег';
  if (code === 73)                 return 'Снег';
  if (code === 75)                 return 'Сильный снег';
  if (code === 77)                 return 'Снежные зёрна';
  if (code === 80)                 return 'Небольшой ливень';
  if (code === 81)                 return 'Ливень';
  if (code === 82)                 return 'Сильный ливень';
  if (code === 85)                 return 'Небольшой снегопад';
  if (code === 86)                 return 'Сильный снегопад';
  if (code === 95)                 return 'Гроза';
  if (code === 96 || code === 99)  return 'Гроза с градом';
  return 'Облачно';
}

export function getWeatherIcon(code: number): string {
  return String(code);
}

export function getWindDirection(deg: number): string {
  const dirs = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return dirs[Math.round(deg / 45) % 8];
}

/** phase: 0.0–1.0 (0=новолуние, 0.5=полнолуние) */
export function MoonIcon({ phase, name, size = 28 }: { phase: number; name: string; size?: number }) {
  // Правильный расчёт: 0% при новолунии, 100% при полнолунии
  const pct = Math.round((1 - Math.cos(phase * 2 * Math.PI)) / 2 * 100);
  const tooltip = `${name}, в полночь будет освещено ${pct}%`;

  const r = 9;
  const cx = 12;
  const cy = 12;

  // Цвета
  const darkFill  = '#4b5563'; // тёмная часть
  const lightFill = '#d1d5db'; // светлая часть
  const stroke    = '#6b7280';

  // Фаза определяет форму терминатора
  // phase 0   = новолуние (весь тёмный)
  // phase 0.25 = первая четверть (правая половина светлая)
  // phase 0.5  = полнолуние (весь светлый)
  // phase 0.75 = последняя четверть (левая половина светлая)

  const isWaxing = phase <= 0.5; // растущая (0→0.5)

  // Сжатие эллипса терминатора: от r (новолуние) до 0 (полуквартие) до -r (полнолуние)
  // и обратно при убывании
  let termRx: number;
  let termSweep: number; // направление дуги терминатора

  if (isWaxing) {
    // 0→0.5: терминатор сжимается справа налево
    termRx    = r * Math.abs(1 - phase * 4); // r→0→r
    termSweep = phase < 0.25 ? 1 : 0;        // до четверти выпуклая, после впуклая
  } else {
    // 0.5→1.0: терминатор сжимается слева направо
    termRx    = r * Math.abs((phase - 0.5) * 4 - 1); // r→0→r
    termSweep = phase < 0.75 ? 0 : 1;
  }

  const top    = `${cx} ${cy - r}`;
  const bottom = `${cx} ${cy + r}`;

  // Светлая половина: правая дуга при растущей, левая при убывающей
  const outerSweep = isWaxing ? 1 : 0;

  const litPath = [
    `M ${top}`,
    `A ${r} ${r} 0 0 ${outerSweep} ${bottom}`,
    `A ${termRx.toFixed(2)} ${r} 0 0 ${termSweep} ${top}`,
    'Z',
  ].join(' ');

  const darkPath = [
    `M ${top}`,
    `A ${r} ${r} 0 0 ${outerSweep === 1 ? 0 : 1} ${bottom}`,
    `A ${termRx.toFixed(2)} ${r} 0 0 ${termSweep === 1 ? 0 : 1} ${top}`,
    'Z',
  ].join(' ');

  return (
    <span className="moon-icon" title={tooltip}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d={darkPath} fill={darkFill} />
        <path d={litPath}  fill={lightFill} />
        <circle cx={cx} cy={cy} r={r} stroke={stroke} strokeWidth="1" fill="none" />
      </svg>
    </span>
  );
}

export function WindBadge({ deg }: { deg: number }) {
  const label = getWindDirection(deg);
  // deg — откуда дует ветер; стрелка показывает куда, поэтому +180°
  const arrowDeg = (deg + 180) % 360;
  return (
    <span className="wind-badge">
      <span className="wind-badge__label">{label}</span>
      <svg
        className="wind-badge__arrow"
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        style={{ transform: `rotate(${arrowDeg}deg)` }}
      >
        <line x1="12" y1="20" x2="12" y2="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <path d="M7 9 L12 4 L17 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </span>
  );
}

function WeatherSvg({ code, size, isNight }: { code: number; size: number; isNight: boolean }) {
  const s = size;

  // code 0 — ясно
  if (code === 0) {
    if (isNight) return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
        <circle cx="18" cy="5" r="0.8" fill="#E2E8F0" opacity="0.8"/>
        <circle cx="21" cy="9" r="0.5" fill="#E2E8F0" opacity="0.6"/>
        <circle cx="15" cy="2" r="0.6" fill="#E2E8F0" opacity="0.7"/>
      </svg>
    );
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="5" fill="#FBBF24"/>
        <g stroke="#FBBF24" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="2" x2="12" y2="4"/>
          <line x1="12" y1="20" x2="12" y2="22"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="2" y1="12" x2="4" y2="12"/>
          <line x1="20" y1="12" x2="22" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </g>
      </svg>
    );
  }

  // code 1 — преимущественно ясно
  if (code === 1) {
    if (isNight) return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M17 12.5A6 6 0 1 1 10.5 6a4.5 4.5 0 0 0 6.5 6.5z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
        <path d="M9 17.5a3.5 3.5 0 0 1 0-7h.5a4 4 0 0 1 7.5 1.5A2.5 2.5 0 0 1 19 17.5H9z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5"/>
      </svg>
    );
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="10" cy="9" r="4" fill="#FBBF24"/>
        <g stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round">
          <line x1="10" y1="3" x2="10" y2="4.5"/>
          <line x1="10" y1="13.5" x2="10" y2="15"/>
          <line x1="4" y1="9" x2="5.5" y2="9"/>
          <line x1="14.5" y1="9" x2="16" y2="9"/>
          <line x1="5.76" y1="5.76" x2="6.82" y2="6.82"/>
          <line x1="13.18" y1="11.18" x2="14.24" y2="12.24"/>
        </g>
        <path d="M9 17.5a3.5 3.5 0 0 1 0-7h.5a4 4 0 0 1 7.5 1.5A2.5 2.5 0 0 1 19 17.5H9z" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="0.5"/>
      </svg>
    );
  }

  // code 2 — переменная облачность
  if (code === 2) {
    if (isNight) return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M15 10A4 4 0 1 1 9.5 5.5a3 3 0 0 0 5.5 4.5z" fill="#64748B" opacity="0.9"/>
        <path d="M8 15.5a3.5 3.5 0 0 1 0-7h.5a4 4 0 0 1 7.5 1.5A2.5 2.5 0 0 1 18 15.5H8z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
      </svg>
    );
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3.5" fill="#FBBF24" opacity="0.9"/>
        <path d="M8 15.5a3.5 3.5 0 0 1 0-7h.5a4 4 0 0 1 7.5 1.5A2.5 2.5 0 0 1 18 15.5H8z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
      </svg>
    );
  }

  if (code === 3) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 16a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 16H6z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
      <path d="M4 18a2.5 2.5 0 0 1 0-5h.3a3 3 0 0 1 5.7 1A2 2 0 0 1 11 18H4z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5"/>
    </svg>
  );

  if (code === 45 || code === 48) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 8a4 4 0 0 1 4-4 4 4 0 0 1 3.87 3H14a3 3 0 0 1 0 6H5a4 4 0 0 1 0-8z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5"/>
      <g stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round">
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="5" y1="18" x2="19" y2="18"/>
        <line x1="7" y1="21" x2="17" y2="21"/>
      </g>
    </svg>
  );

  if (code >= 51 && code <= 55) {
    const intensity = code === 51 ? 0.6 : code === 53 ? 0.8 : 1;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
        <g opacity={intensity}>
          <circle cx="7" cy="17" r="0.8" fill="#60A5FA"/>
          <circle cx="10" cy="16.5" r="0.8" fill="#60A5FA"/>
          <circle cx="13" cy="17" r="0.8" fill="#60A5FA"/>
          <circle cx="16" cy="16.5" r="0.8" fill="#60A5FA"/>
          <circle cx="8.5" cy="19" r="0.8" fill="#60A5FA"/>
          <circle cx="11.5" cy="19.5" r="0.8" fill="#60A5FA"/>
          <circle cx="14.5" cy="19" r="0.8" fill="#60A5FA"/>
        </g>
      </svg>
    );
  }

  if (code >= 61 && code <= 65) {
    const strokeWidth = code === 61 ? 1.5 : code === 63 ? 2 : 2.5;
    const opacity = code === 61 ? 0.7 : code === 63 ? 0.85 : 1;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#64748B" stroke="#475569" strokeWidth="0.5"/>
        <g stroke="#3B82F6" strokeWidth={strokeWidth} strokeLinecap="round" opacity={opacity}>
          <line x1="7" y1="16" x2="6" y2="19"/>
          <line x1="10" y1="16" x2="9" y2="19"/>
          <line x1="13" y1="16" x2="12" y2="19"/>
          <line x1="16" y1="16" x2="15" y2="19"/>
          <line x1="8.5" y1="19.5" x2="7.5" y2="22"/>
          <line x1="11.5" y1="19.5" x2="10.5" y2="22"/>
          <line x1="14.5" y1="19.5" x2="13.5" y2="22"/>
        </g>
      </svg>
    );
  }

  if (code >= 71 && code <= 75) {
    const size = code === 71 ? 1 : code === 73 ? 1.3 : 1.6;
    const opacity = code === 71 ? 0.7 : code === 73 ? 0.85 : 1;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5"/>
        <g opacity={opacity}>
          <circle cx="7" cy="17" r={size} fill="#93C5FD"/>
          <circle cx="11" cy="17" r={size} fill="#93C5FD"/>
          <circle cx="15" cy="17" r={size} fill="#93C5FD"/>
          <circle cx="9" cy="20" r={size} fill="#93C5FD"/>
          <circle cx="13" cy="20" r={size} fill="#93C5FD"/>
        </g>
      </svg>
    );
  }

  if (code === 77) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="0.5"/>
      <g fill="#E0F2FE">
        <rect x="6.5" y="16.5" width="1.5" height="1.5" rx="0.3"/>
        <rect x="10" y="16.5" width="1.5" height="1.5" rx="0.3"/>
        <rect x="13.5" y="16.5" width="1.5" height="1.5" rx="0.3"/>
        <rect x="8" y="19" width="1.5" height="1.5" rx="0.3"/>
        <rect x="12" y="19" width="1.5" height="1.5" rx="0.3"/>
      </g>
    </svg>
  );

  if (code >= 80 && code <= 82) {
    const strokeWidth = code === 80 ? 2.5 : code === 81 ? 3 : 3.5;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#475569" stroke="#334155" strokeWidth="0.5"/>
        <g stroke="#2563EB" strokeWidth={strokeWidth} strokeLinecap="round">
          <line x1="7" y1="16" x2="5.5" y2="20"/>
          <line x1="10" y1="16" x2="8.5" y2="20"/>
          <line x1="13" y1="16" x2="11.5" y2="20"/>
          <line x1="16" y1="16" x2="14.5" y2="20"/>
          <line x1="8.5" y1="19" x2="7" y2="23"/>
          <line x1="11.5" y1="19" x2="10" y2="23"/>
          <line x1="14.5" y1="19" x2="13" y2="23"/>
        </g>
      </svg>
    );
  }

  if (code >= 85 && code <= 86) {
    const size = code === 85 ? 1.8 : 2.2;
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
        <g>
          <circle cx="7" cy="17" r={size} fill="#DBEAFE"/>
          <circle cx="11" cy="17" r={size} fill="#DBEAFE"/>
          <circle cx="15" cy="17" r={size} fill="#DBEAFE"/>
          <circle cx="9" cy="20" r={size} fill="#DBEAFE"/>
          <circle cx="13" cy="20" r={size} fill="#DBEAFE"/>
        </g>
      </svg>
    );
  }

  if (code === 95) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#475569" stroke="#334155" strokeWidth="0.5"/>
      <polyline points="13,13 10,18 13,18 10,23" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );

  if (code === 96 || code === 99) return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 13a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 13H6z" fill="#334155" stroke="#1E293B" strokeWidth="0.5"/>
      <polyline points="13,13 10,17 12,17 9,21" stroke="#FCD34D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <g fill="#E0F2FE">
        <circle cx="15" cy="17" r="1.2"/>
        <circle cx="16" cy="20" r="1.2"/>
      </g>
    </svg>
  );

  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 16a4 4 0 0 1 0-8h.5a5 5 0 0 1 9.5 1.5A3 3 0 0 1 18 16H6z" fill="#94A3B8" stroke="#64748B" strokeWidth="0.5"/>
    </svg>
  );
}

const WeatherIcon: React.FC<Props> = ({ code, size = 24, hour }) => (
  <span className="weather-icon" title={getWeatherDescription(code)}>
    <WeatherSvg code={code} size={size} isNight={isNightHour(hour)} />
  </span>
);

export default WeatherIcon;
