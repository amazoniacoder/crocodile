import React from 'react';
import WeatherIcon, { getWeatherDescription, getWindDirection, MoonIcon, isNightHour } from './WeatherIcon';
import { Icon } from '@/ui-system/icons/components';
import type { WeatherForecast, HourlyRow } from '@/types/weather';
import { kpClass, uvClass, uvLabel, uvTooltip, pressureBadgeClass, pressureTooltip, windBadgeClass, windTooltip, kpBadgeClass, kpTooltip } from '@/utils/weather';

interface Props {
  activeForecast:  WeatherForecast;
  currentHourSlot: HourlyRow | null | undefined;
  currentHour?:    number;
}

const WeatherDaySummary: React.FC<Props> = ({ activeForecast, currentHourSlot, currentHour }) => {
  const precipText = (() => {
    const prob = activeForecast.precipitationProbabilityPct;
    const mm   = activeForecast.precipitationMm != null ? Number(activeForecast.precipitationMm) : 0;
    if ((prob != null && prob > 30) || mm > 0.1) return 'Возможны осадки';
    return 'Осадков не ожидается';
  })();

  const tempMinTooltip = activeForecast.tempMin != null
    ? `Ночная температура: ${Math.round(Number(activeForecast.tempMin))}°C`
    : '';

  return (
  <div className="weather-page__day-summary">
    <div className="weather-page__day-main-card">
      <div className="weather-page__day-main">
        <WeatherIcon code={(currentHourSlot?.weatherCode ?? activeForecast.weatherCode) ?? 0} size={48} hour={currentHour} />
        <div>
          <div className="weather-page__day-temp">
            {currentHourSlot && currentHourSlot.temp != null ? (
              <>
                <span className="weather-table__temp-max">
                  {`${currentHourSlot.temp > 0 ? '+' : ''}${Math.round(currentHourSlot.temp)}°`}
                </span>
                {activeForecast.tempMin != null && (
                  <>
                    <span className="weather-table__temp-sep"> / </span>
                    <span className="weather-table__temp-min" title={tempMinTooltip}>
                      {Math.round(Number(activeForecast.tempMin))}°
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="weather-table__temp-max">
                  {activeForecast.tempMax != null
                    ? `${Math.round(Number(activeForecast.tempMax)) > 0 ? '+' : ''}${Math.round(Number(activeForecast.tempMax))}°`
                    : '—'}
                </span>
                <span className="weather-table__temp-sep"> / </span>
                <span className="weather-table__temp-min" title={tempMinTooltip}>
                  {activeForecast.tempMin != null ? `${Math.round(Number(activeForecast.tempMin))}°` : '—'}
                </span>
              </>
            )}
          </div>
          <div className="weather-page__day-desc">
            {getWeatherDescription((currentHourSlot?.weatherCode ?? activeForecast.weatherCode) ?? 0, isNightHour(currentHour))}
          </div>
          <div className="weather-page__day-precip">
            {precipText}
          </div>
        </div>
      </div>
    </div>

    <div className="weather-page__day-meta-card">
      <WeatherMetaContent activeForecast={activeForecast} currentHourSlot={currentHourSlot} />
    </div>
  </div>
  );
};

export const WeatherMetaContent: React.FC<Props> = ({ activeForecast, currentHourSlot }) => {
  const windMs = currentHourSlot?.windSpeed != null
    ? currentHourSlot.windSpeed / 3.6
    : activeForecast.windSpeedKmh != null ? Number(activeForecast.windSpeedKmh) / 3.6 : null;
  const pressureMmHg = activeForecast.pressureHpa != null
    ? Math.round(Number(activeForecast.pressureHpa) * 0.750064)
    : null;
  const kpVal = activeForecast.kpIndex != null ? Number(activeForecast.kpIndex) : null;

  return (
  <div className="weather-page__day-meta">
    <span className={windBadgeClass(windMs)} title={windTooltip(windMs)}>
      <Icon name="wind" size={14} />
      {windMs != null ? `${windMs.toFixed(1)} м/с` : '—'}
      {(currentHourSlot?.windDirection ?? activeForecast.windDirectionDeg) != null &&
        ` ${getWindDirection((currentHourSlot?.windDirection ?? activeForecast.windDirectionDeg)!)}`}
    </span>
    <span>
      <Icon name="cloud-rain" size={14} />
      {activeForecast.precipitationMm ?? '0'} мм
    </span>
    {activeForecast.precipitationProbabilityPct != null && (
      <span>{activeForecast.precipitationProbabilityPct}% вер. осадков</span>
    )}
    {activeForecast.humidityPct != null && (
      <span>💧 {activeForecast.humidityPct}% влажность</span>
    )}
    {pressureMmHg != null && (
      <span
        className={pressureBadgeClass(pressureMmHg)}
        title={pressureTooltip(pressureMmHg)}
      >
        🌡️ {pressureMmHg} ммрт.ст.
      </span>
    )}
    {activeForecast.uvIndexMax != null && (() => {
      const uv = Math.round(Number(activeForecast.uvIndexMax));
      return (
        <span className={`weather-uv ${uvClass(uv)}`} title={uvTooltip(uv)}>
          UV {uv} — {uvLabel(uv)}
        </span>
      );
    })()}
    {activeForecast.moonPhaseName && (
      <span>
        <MoonIcon
          phase={activeForecast.moonPhase != null ? parseFloat(activeForecast.moonPhase) : 0}
          name={activeForecast.moonPhaseName}
          size={20}
        />
        {activeForecast.moonPhaseName}
      </span>
    )}
    {activeForecast.kpLevel && (
      <span
        className={kpBadgeClass(activeForecast.kpLevel)}
        title={kpTooltip(kpVal, activeForecast.kpLevel)}
      >
        Kp {kpVal != null ? kpVal.toFixed(1) : '—'} {activeForecast.kpLevel}
      </span>
    )}
  </div>
  );
};

export default WeatherDaySummary;
