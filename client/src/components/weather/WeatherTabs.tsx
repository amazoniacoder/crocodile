import React from 'react';
import WeatherIcon from './WeatherIcon';
import type { WeatherForecast, HourlyRow } from '@/types/weather';
import { toDateStr, formatTab } from '@/utils/weather';

interface Props {
  forecasts:       WeatherForecast[];
  activeDate:      string | null;
  todayStr:        string;
  currentHourSlot: HourlyRow | null | undefined;
  currentHour?:    number;
  tabsRef:         React.RefObject<HTMLDivElement>;
  onSelect:        (date: string) => void;
}

const WeatherTabs: React.FC<Props> = ({ forecasts, activeDate, todayStr, currentHourSlot, currentHour, tabsRef, onSelect }) => (
  <div className="weather-page__tabs" ref={tabsRef}>
    {forecasts.map((f) => {
      const ds = toDateStr(f.forecastDate);
      const { day, dayShort } = formatTab(ds);
      const isToday = ds === todayStr;
      const iconCode = (isToday && currentHourSlot ? currentHourSlot.weatherCode : f.weatherCode) ?? 0;
      const iconHour = isToday ? currentHour : 12;
      return (
        <button
          key={ds}
          className={`weather-page__tab${ds === activeDate ? ' weather-page__tab--active' : ''}`}
          onClick={() => onSelect(ds)}
        >
          <span className="weather-page__tab-day weather-page__tab-day--full">{isToday ? 'Сегодня' : day}</span>
          <span className="weather-page__tab-day weather-page__tab-day--short">{isToday ? 'Сег' : dayShort}</span>
          <span className="weather-page__tab-bottom">
            <span className="weather-page__tab-temp">
              {isToday && currentHourSlot && currentHourSlot.temp != null
                ? `${currentHourSlot.temp > 0 ? '+' : ''}${Math.round(currentHourSlot.temp)}°`
                : (f.tempMax != null && f.tempMin != null
                  ? `${Math.round(Number(f.tempMax))}° / ${Math.round(Number(f.tempMin))}°`
                  : '—')
              }
            </span>
            <span className="weather-page__tab-icon">
              <WeatherIcon code={iconCode} size={16} hour={iconHour} />
            </span>
          </span>
        </button>
      );
    })}
  </div>
);

export default WeatherTabs;
