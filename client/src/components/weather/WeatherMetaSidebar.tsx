import React from 'react';
import { Icon } from '@/ui-system/icons/components';
import { WeatherMetaContent } from './WeatherDaySummary';
import type { WeatherForecast, HourlyRow } from '@/types/weather';
import { DAY_NAMES, MONTH_NAMES, toDateStr } from '@/utils/weather';

interface Props {
  open:            boolean;
  onClose:         () => void;
  activeForecast:  WeatherForecast;
  activeDate:      string;
  todayStr:        string;
  currentHourSlot: HourlyRow | null | undefined;
}

const WeatherMetaSidebar: React.FC<Props> = ({
  open, onClose, activeForecast, activeDate, todayStr, currentHourSlot,
}) => {
  const d     = new Date(`${toDateStr(activeDate)}T12:00:00`);
  const title = `${activeDate === todayStr ? 'Сегодня' : DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

  return (
    <>
      <div className={`weather-page__meta-tab${open ? ' weather-page__meta-tab--open' : ''}`}>
        <button
          className="weather-page__meta-btn"
          onClick={onClose}
          aria-label="Подробнее о дне"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      <div className={`weather-page__meta-sidebar${open ? ' weather-page__meta-sidebar--open' : ''}`}>
        <div className="weather-page__meta-sidebar-header">
          <span className="weather-page__meta-sidebar-title">{title}</span>
          <button
            className="weather-page__meta-sidebar-close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
        <WeatherMetaContent activeForecast={activeForecast} currentHourSlot={currentHourSlot} />
      </div>
    </>
  );
};

export default WeatherMetaSidebar;
