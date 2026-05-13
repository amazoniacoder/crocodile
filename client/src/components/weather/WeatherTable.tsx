import React from 'react';
import WeatherIcon, { getWeatherDescription, getWindDirection } from './WeatherIcon';
import { Icon } from '@/ui-system/icons/components';

interface Forecast {
  id: number;
  forecastDate: string;
  tempMin: string | null;
  tempMax: string | null;
  precipitationMm: string | null;
  windSpeedKmh: string | null;
  windDirectionDeg: number | null;
  humidityPct: number | null;
  pressureHpa: string | null;
  weatherCode: number | null;
  moonPhase: string | null;
  moonPhaseName: string | null;
  kpIndex: string | null;
  kpLevel: string | null;
}

interface Props {
  forecasts: Forecast[];
}

const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_NAMES = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatDate(iso: string): { day: string; date: string } {
  const d = new Date(`${iso}T12:00:00`);
  return {
    day: DAY_NAMES[d.getDay()],
    date: `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`,
  };
}

function kpColor(level: string | null): string {
  if (!level) return '';
  if (level === 'Спокойно')   return 'weather-table__kp--calm';
  if (level === 'Слабое')     return 'weather-table__kp--weak';
  if (level === 'Умеренное')  return 'weather-table__kp--moderate';
  return 'weather-table__kp--strong';
}

const WeatherTable: React.FC<Props> = ({ forecasts }) => {
  if (!forecasts.length) return (
    <p className="weather-table__empty">Данные загружаются...</p>
  );

  return (
    <div className="weather-table__wrap">
      <table className="weather-table">
        <thead>
          <tr className="weather-table__head-row">
            <th className="weather-table__label-col" />
            {forecasts.map(f => {
              const { day, date } = formatDate(f.forecastDate);
              return (
                <th key={f.forecastDate} className="weather-table__day-col">
                  <span className="weather-table__day-name">{day}</span>
                  <span className="weather-table__day-date">{date}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Иконка */}
          <tr className="weather-table__row">
            <td className="weather-table__label">Погода</td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className="weather-table__cell weather-table__cell--icon">
                <WeatherIcon code={f.weatherCode ?? 0} size={28} />
                <span className="weather-table__desc">{getWeatherDescription(f.weatherCode ?? 0)}</span>
              </td>
            ))}
          </tr>

          {/* Температура */}
          <tr className="weather-table__row">
            <td className="weather-table__label">Температура, °C</td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className="weather-table__cell">
                <span className="weather-table__temp-max">+{Math.round(Number(f.tempMax))}</span>
                <span className="weather-table__temp-sep"> / </span>
                <span className="weather-table__temp-min">{Math.round(Number(f.tempMin))}</span>
              </td>
            ))}
          </tr>

          {/* Осадки */}
          <tr className="weather-table__row">
            <td className="weather-table__label">Осадки, мм</td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className="weather-table__cell">
                {Number(f.precipitationMm).toFixed(1)}
              </td>
            ))}
          </tr>

          {/* Ветер */}
          <tr className="weather-table__row">
            <td className="weather-table__label">Ветер, км/ч</td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className="weather-table__cell">
                {Math.round(Number(f.windSpeedKmh))}
                {f.windDirectionDeg != null && (
                  <span className="weather-table__wind-dir"> {getWindDirection(f.windDirectionDeg)}</span>
                )}
              </td>
            ))}
          </tr>

          {/* Вероятность осадков */}
          <tr className="weather-table__row">
            <td className="weather-table__label">Вероятность осадков, %</td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className="weather-table__cell">{f.humidityPct ?? '—'}</td>
            ))}
          </tr>

          {/* Фаза луны */}
          <tr className="weather-table__row">
            <td className="weather-table__label"><Icon name="moon" size={14} /> Луна</td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className="weather-table__cell weather-table__cell--moon">
                {f.moonPhaseName ?? '—'}
              </td>
            ))}
          </tr>

          {/* Геомагнитная активность */}
          <tr className="weather-table__row">
            <td className="weather-table__label weather-table__label--wrap">
              Геомагнитная<br />активность
            </td>
            {forecasts.map(f => (
              <td key={f.forecastDate} className={`weather-table__cell weather-table__cell--kp-colored ${kpColor(f.kpLevel)}`}>
                <span className="weather-table__kp-val-num">
                  {f.kpIndex != null ? `Kp ${Number(f.kpIndex).toFixed(1)}` : '—'}
                </span>
                <span className="weather-table__kp-label">{f.kpLevel ?? ''}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default WeatherTable;
