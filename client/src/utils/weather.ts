export const DAY_NAMES       = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
export const DAY_NAMES_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
export const MONTH_NAMES     = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const toDateStr = (d: string) => String(d).slice(0, 10);

export function hourFromSlot(time: string): number {
  const n = parseInt(String(time).trim(), 10);
  return Number.isFinite(n) ? n : NaN;
}

export function formatTab(iso: string) {
  const d = new Date(`${toDateStr(iso)}T12:00:00`);
  return {
    day:      DAY_NAMES[d.getDay()],
    dayShort: DAY_NAMES_SHORT[d.getDay()],
    date:     `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
  };
}

export function pressureClass(mmHg: number | null): string {
  if (mmHg === null) return '';
  if (mmHg < 748) return 'weather-table__cell--pressure-low';
  if (mmHg > 765) return 'weather-table__cell--pressure-high';
  return '';
}

export function tempBarClass(temp: number | null): string {
  if (temp === null) return '';
  if (temp <= 0)  return 'weather-table__temp-bar--cold';
  if (temp <= 10) return 'weather-table__temp-bar--cool';
  if (temp <= 20) return 'weather-table__temp-bar--warm';
  if (temp <= 28) return 'weather-table__temp-bar--hot';
  return 'weather-table__temp-bar--very-hot';
}

export function windClass(ms: number | null): string {
  if (ms === null) return '';
  if (ms >= 28) return 'weather-table__cell--wind-hurricane';
  if (ms >= 17) return 'weather-table__cell--wind-strong';
  if (ms >= 11) return 'weather-table__cell--wind-moderate';
  return '';
}

export function gustsClass(ms: number | null): string {
  if (ms === null) return '';
  if (ms >= 20) return 'weather-table__cell--gusts-danger';
  if (ms >= 10) return 'weather-table__cell--gusts-warning';
  return '';
}

// Классы для бейджей сводки дня
export function pressureBadgeClass(mmHg: number | null): string {
  if (mmHg === null) return '';
  if (mmHg < 748) return 'weather-badge--pressure-low';
  if (mmHg > 765) return 'weather-badge--pressure-high';
  return '';
}

export function pressureTooltip(mmHg: number | null): string {
  if (mmHg === null) return '';
  if (mmHg < 748) return `${mmHg} ммрт.ст. — низкое. Возможны головные боли, усталость. Норма: 748–765 ммрт.ст.`;
  if (mmHg > 765) return `${mmHg} ммрт.ст. — высокое. Возможны головные боли, повышенное АД. Норма: 748–765 ммрт.ст.`;
  return `${mmHg} ммрт.ст. — норма.`;
}

export function windBadgeClass(ms: number | null): string {
  if (ms === null) return '';
  if (ms >= 28) return 'weather-badge--wind-hurricane';
  if (ms >= 17) return 'weather-badge--wind-strong';
  if (ms >= 11) return 'weather-badge--wind-moderate';
  return '';
}

export function windTooltip(ms: number | null): string {
  if (ms === null) return '';
  if (ms >= 28) return `${ms.toFixed(1)} м/с — ураганный ветер. Опасно находиться на улице.`;
  if (ms >= 17) return `${ms.toFixed(1)} м/с — сильный ветер. Трудно идти против ветра.`;
  if (ms >= 11) return `${ms.toFixed(1)} м/с — умеренный ветер.`;
  return `${ms.toFixed(1)} м/с — слабый ветер.`;
}

export function kpBadgeClass(level: string | null): string {
  if (!level) return '';
  if (level === 'Спокойно')  return '';
  if (level === 'Слабое')    return 'weather-badge--kp-weak';
  if (level === 'Умеренное') return 'weather-badge--kp-moderate';
  return 'weather-badge--kp-strong';
}

export function kpTooltip(index: number | null, level: string | null): string {
  if (index === null || !level) return '';
  if (level === 'Спокойно')  return `Kp ${index.toFixed(1)} — спокойная геомагнитная обстановка.`;
  if (level === 'Слабое')    return `Kp ${index.toFixed(1)} — слабая буря. Возможны помехи радиосвязи на высоких широтах.`;
  if (level === 'Умеренное') return `Kp ${index.toFixed(1)} — умеренная буря. Возможны помехи GPS и северное сияние.`;
  return `Kp ${index.toFixed(1)} — сильная буря. Возможны сбои энергосети, помехи связи.`;
}

export function kpClass(level: string | null): string {
  if (!level) return '';
  if (level === 'Спокойно')  return 'weather-table__kp--calm';
  if (level === 'Слабое')    return 'weather-table__kp--weak';
  if (level === 'Умеренное') return 'weather-table__kp--moderate';
  return 'weather-table__kp--strong';
}

export function uvClass(uv: number): string {
  if (uv <= 2)  return 'weather-uv--low';
  if (uv <= 5)  return 'weather-uv--moderate';
  if (uv <= 7)  return 'weather-uv--high';
  if (uv <= 10) return 'weather-uv--very-high';
  return 'weather-uv--extreme';
}

export function uvLabel(uv: number): string {
  if (uv <= 2)  return 'низкий';
  if (uv <= 5)  return 'умеренный';
  if (uv <= 7)  return 'высокий';
  if (uv <= 10) return 'очень высокий';
  return 'экстремальный';
}

export function uvTooltip(uv: number): string {
  if (uv <= 2)  return `UV ${uv} — низкий. Защита не требуется.`;
  if (uv <= 5)  return `UV ${uv} — умеренный. Рекомендуется крем SPF 30+ при длительном пребывании на улице.`;
  if (uv <= 7)  return `UV ${uv} — высокий. Крем SPF 30+, головной убор, очки. Избегайте солнца с 11 до 15 ч.`;
  if (uv <= 10) return `UV ${uv} — очень высокий. Крем SPF 50+, одежда с длинным рукавом. Минимизируйте время на солнце.`;
  return `UV ${uv} — экстремальный. Оставайтесь в тени. Незащищённая кожа сгорает за несколько минут.`;
}
