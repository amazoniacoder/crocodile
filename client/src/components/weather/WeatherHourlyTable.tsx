import React, { useEffect, useMemo, useState } from 'react';
import WeatherIcon, { WindBadge } from './WeatherIcon';
import { Icon } from '@/ui-system/icons/components';
import { useDragScroll } from '@/hooks/useDragScroll';
import type { HourlyRow, WeatherForecast } from '@/types/weather';
import {
  hourFromSlot, pressureClass, tempBarClass, windClass, gustsClass, kpClass,
  DAY_NAMES, MONTH_NAMES, toDateStr,
} from '@/utils/weather';

interface Props {
  hourly:                HourlyRow[];
  hourlyLoading:         boolean;
  forecasts:             WeatherForecast[];
  activeDate:            string | null;
  todayStr:              string;
  tomorrowStr:           string;
  currentHour:           number;
  tomorrowSplitColIndex: number | null;
  isRefreshing:          boolean;
  loading:               boolean;
  scrollTrigger:         number;
}

const WeatherHourlyTable: React.FC<Props> = ({
  hourly, hourlyLoading, forecasts, activeDate, todayStr, tomorrowStr,
  currentHour, tomorrowSplitColIndex, isRefreshing, loading, scrollTrigger,
}) => {
  const scrollRef = useDragScroll<HTMLDivElement>([loading, forecasts.length]);

  const kpByDate = useMemo(() => {
    const m = new Map<string, { kpIndex: string | null; kpLevel: string | null }>();
    for (const f of forecasts) m.set(toDateStr(f.forecastDate), { kpIndex: f.kpIndex, kpLevel: f.kpLevel });
    return m;
  }, [forecasts]);

  // Автоскролл к текущему часу
  useEffect(() => {
    if (hourlyLoading || !activeDate || !hourly.length) return;
    const el = scrollRef.current;
    if (!el) return;

    const day      = toDateStr(activeDate);
    const firstIdx = hourly.findIndex(h => h.date === day);
    if (firstIdx < 0) return;

    const indicesForDay = hourly.map((h, i) => ({ h, i })).filter(x => x.h.date === day);
    let scrollIdx = firstIdx;

    if (day === todayStr) {
      const exact = hourly.findIndex(h => h.date === day && hourFromSlot(h.time) === currentHour);
      if (exact >= 0) {
        scrollIdx = exact;
      } else {
        const next = indicesForDay.find(x => hourFromSlot(x.h.time) >= currentHour);
        scrollIdx = next ? next.i : (indicesForDay.at(-1)?.i ?? firstIdx);
      }
    } else {
      const midnight = hourly.findIndex(h => h.date === day && hourFromSlot(h.time) === 0);
      scrollIdx = midnight >= 0 ? midnight : firstIdx;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const col = el.querySelector('th.weather-table__day-col') as HTMLElement | null;
        el.scrollTo({ left: scrollIdx * (col?.offsetWidth ?? 80), behavior: 'smooth' });
      });
    });
  }, [hourlyLoading, activeDate, hourly, currentHour, todayStr, scrollTrigger]);

  // Позиция метки «Завтра»
  const [tomorrowLabelLeft, setTomorrowLabelLeft] = useState<number | null>(null);
  const [todayLabelVisible, setTodayLabelVisible] = useState(true);

  useEffect(() => {
    if (tomorrowSplitColIndex == null || hourlyLoading) { setTomorrowLabelLeft(null); return; }
    const el = scrollRef.current;
    if (!el) return;

    const compute = () => {
      const col  = el.querySelector('th.weather-table__day-col') as HTMLElement | null;
      const cw   = col?.offsetWidth ?? 80;
      const left = tomorrowSplitColIndex * cw - el.scrollLeft + 1;
      setTomorrowLabelLeft(left);
      setTodayLabelVisible(left > 80);
    };

    requestAnimationFrame(compute);
    el.addEventListener('scroll', compute, { passive: true });
    return () => el.removeEventListener('scroll', compute);
  }, [tomorrowSplitColIndex, hourlyLoading, hourly.length]);

  const dateBarContent = useMemo(() => {
    if (!hourly.length || !activeDate) return null;
    const activeDateStr = toDateStr(activeDate);
    const todayD = new Date(`${activeDateStr}T12:00:00`);
    const tomD   = new Date(`${tomorrowStr}T12:00:00`);
    return {
      todayLabel:    `${activeDateStr === todayStr ? 'Сегодня' : DAY_NAMES[todayD.getDay()]}, ${todayD.getDate()} ${MONTH_NAMES[todayD.getMonth()]}`,
      tomorrowLabel: `Завтра, ${tomD.getDate()} ${MONTH_NAMES[tomD.getMonth()]}`,
    };
  }, [hourly.length, activeDate, todayStr, tomorrowStr]);

  return (
    <div className="weather-page__hourly-wrap">
      {isRefreshing && !hourlyLoading && (
        <div className="weather-page__refresh-indicator">
          <Icon name="refresh" size={16} className="weather-page__refresh-icon" />
        </div>
      )}

      <div className="weather-page__hourly-layout">
        <div className="weather-page__hourly-label-strip">
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--head">Час</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--icon">Погода</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--data">Темп, °C</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--data">Ощущается</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--data">Осадки, мм</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--data">Ветер, м/с</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--data">Порывы, м/с</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--data">Давление, мм</div>
          <div className="weather-page__hourly-label-strip__cell weather-page__hourly-label-strip__cell--kp">
            <span>Геомагнитная</span><span>активность</span>
          </div>
        </div>

        <div className="weather-page__hourly-data">
          {!hourlyLoading && dateBarContent && (
            <div className="weather-page__hourly-date-bar">
              {todayLabelVisible && (
                <div className="weather-page__hourly-date-bar__today">{dateBarContent.todayLabel}</div>
              )}
              {tomorrowSplitColIndex != null && tomorrowLabelLeft != null && (
                <div
                  className="weather-page__hourly-date-bar__tomorrow"
                  style={{ transform: `translateX(${tomorrowLabelLeft}px)` }}
                >{dateBarContent.tomorrowLabel}</div>
              )}
            </div>
          )}

          {hourlyLoading && (
            <div className="weather-page__hourly-data__loading" aria-busy="true" aria-live="polite" aria-label="Загрузка почасового прогноза">
              <div className="weather-page__hourly-spinner" />
            </div>
          )}

          <div ref={scrollRef} className={`weather-page__hourly-scroll${hourlyLoading ? ' weather-page__hourly-scroll--blocked' : ''}`}>
            <table className="weather-table weather-table--hourly weather-table--hourly-data-only">
              <thead>
                <tr className="weather-table__head-row">
                  {hourly.map((h, i) => {
                    const hour       = hourFromSlot(h.time);
                    const isCur      = h.date === todayStr && hour === currentHour;
                    const isPast     = h.date === todayStr && hour < currentHour;
                    const isTomorrow = h.date === tomorrowStr;
                    const splitCol   = tomorrowSplitColIndex === i;
                    return (
                      <th key={`${h.date}-${h.time}`}
                        className={`weather-table__day-col${isCur ? ' weather-table__day-col--current' : ''}${isPast ? ' weather-table__day-col--past' : ''}${isTomorrow ? ' weather-table__day-col--tomorrow' : ''}${splitCol ? ' weather-table__col-split-day' : ''}`}
                      >
                        <span className="weather-table__day-name">{h.time}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="weather-table__row">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    return (
                      <td key={`${h.date}-${h.time}-icon`}
                        className={`weather-table__cell weather-table__cell--icon${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        <WeatherIcon code={h.weatherCode ?? 0} size={40} hour={hourFromSlot(h.time)} />
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    return (
                      <td key={`${h.date}-${h.time}-t`}
                        className={`weather-table__cell weather-table__cell--temp${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        <span className="weather-table__temp-val">
                          {h.temp != null ? `${h.temp > 0 ? '+' : ''}${Math.round(h.temp)}°` : '—'}
                        </span>
                        <span className={`weather-table__temp-bar ${tempBarClass(h.temp)}`} />
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row weather-table__row--apparent">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    return (
                      <td key={`${h.date}-${h.time}-at`}
                        className={`weather-table__cell weather-table__cell--apparent${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        <span className="weather-table__apparent-val">
                          {h.apparentTemp != null
                            ? `${h.apparentTemp > 0 ? '+' : ''}${Math.round(h.apparentTemp)}°`
                            : '—'}
                        </span>
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    return (
                      <td key={`${h.date}-${h.time}-p`}
                        className={`weather-table__cell${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        {h.precipitation != null ? h.precipitation.toFixed(1) : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    const ms     = h.windSpeed != null ? h.windSpeed / 3.6 : null;
                    const wClass = windClass(ms);
                    return (
                      <td key={`${h.date}-${h.time}-w`}
                        className={`weather-table__cell${wClass ? ` ${wClass}` : ''}${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        <span className="weather-table__wind-val">{ms != null ? ms.toFixed(1) : '—'}</span>
                        {h.windDirection != null && <WindBadge deg={h.windDirection} />}
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    const gustsMs = h.windGusts != null ? h.windGusts / 3.6 : null;
                    const gClass = gustsClass(gustsMs);
                    return (
                      <td key={`${h.date}-${h.time}-g`}
                        className={`weather-table__cell${gClass ? ` ${gClass}` : ''}${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        {gustsMs != null ? gustsMs.toFixed(1) : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    const mmHg   = h.pressureHpa != null ? Math.round(h.pressureHpa * 0.750064) : null;
                    const pClass = pressureClass(mmHg);
                    return (
                      <td key={`${h.date}-${h.time}-pr`}
                        className={`weather-table__cell${pClass ? ` ${pClass}` : ''}${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        {mmHg ?? '—'}
                        {mmHg != null && (
                          <span className="weather-table__wind-dir">
                            {mmHg < 748 ? ' низкое' : mmHg > 765 ? ' высокое' : ' норма'}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr className="weather-table__row weather-table__row--kp">
                  {hourly.map((h, i) => {
                    const isPast = h.date === todayStr && hourFromSlot(h.time) < currentHour;
                    const kp     = kpByDate.get(h.date);
                    const level  = kp?.kpLevel ?? null;
                    const kpi    = kp?.kpIndex;
                    return (
                      <td key={`${h.date}-${h.time}-kp`}
                        className={`weather-table__cell weather-table__cell--kp weather-table__cell--kp-colored ${kpClass(level)}${isPast ? ' weather-table__cell--past' : ''}${tomorrowSplitColIndex === i ? ' weather-table__col-split-day' : ''}`}
                      >
                        <span className="weather-table__kp-val-num">{kpi != null ? Number(kpi).toFixed(1) : '—'}</span>
                        <span className="weather-table__kp-label">{level ?? ''}</span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherHourlyTable;
