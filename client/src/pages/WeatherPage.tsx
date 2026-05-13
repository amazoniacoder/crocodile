import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import WeatherDaySummary from '../components/weather/WeatherDaySummary';
import WeatherTabs from '../components/weather/WeatherTabs';
import WeatherHourlyTable from '../components/weather/WeatherHourlyTable';
import WeatherMetaSidebar from '../components/weather/WeatherMetaSidebar';
import { ContactButton, ContactPanel } from '../components/contact';
import { Icon } from '@/ui-system/icons/components';
import { useWeatherData } from '@/hooks/useWeatherData';
import { useHourlyData } from '@/hooks/useHourlyData';
import { toDateStr, hourFromSlot } from '@/utils/weather';

const WeatherPage: React.FC = () => {
  const {
    locations, locLoading,
    forecasts, weekHourly,
    loading, isRefreshing, weekBundlePending,
    selectedId, setSelectedId,
  } = useWeatherData();

  const [activeDate, setActiveDate]           = useState<string | null>(null);
  const [scrollTrigger, setScrollTrigger]     = useState(0);
  const [metaSidebarOpen, setMetaSidebarOpen] = useState(false);
  const [contactOpen, setContactOpen]         = useState(false);

  const tabsRef     = useRef<HTMLDivElement>(null);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);

  useEffect(() => {
    if (!forecasts.length || activeDate) return;
    const realToday = new Date().toLocaleDateString('sv-SE');
    const hasTodayForecast = forecasts.some(f => toDateStr(f.forecastDate) === realToday);
    setActiveDate(hasTodayForecast ? realToday : toDateStr(forecasts[0].forecastDate));
  }, [forecasts]);

  useEffect(() => { setActiveDate(null); }, [selectedId]);

  const { hourly, hourlyLoading } = useHourlyData({
    selectedId, activeDate, weekHourly, weekBundlePending,
  });

  const selectedCity   = locations.find(l => l.id === selectedId);
  const activeForecast = forecasts.find(f => toDateStr(f.forecastDate) === activeDate);

  const { currentHour, todayStr } = useMemo(() => {
    if (!selectedCity?.timezone) {
      return { currentHour: new Date().getHours(), todayStr: new Date().toLocaleDateString('sv-SE') };
    }
    try {
      const now      = new Date();
      const cityTime = new Intl.DateTimeFormat('en-US', {
        timeZone: selectedCity.timezone, hour: 'numeric', hour12: false,
      }).format(now);
      const today = new Intl.DateTimeFormat('sv-SE', { timeZone: selectedCity.timezone }).format(now);
      return { currentHour: parseInt(cityTime, 10), todayStr: today };
    } catch {
      return { currentHour: new Date().getHours(), todayStr: new Date().toLocaleDateString('sv-SE') };
    }
  }, [selectedCity?.timezone]);

  const tomorrowStr = useMemo(() => {
    if (!selectedCity?.timezone) {
      const td = new Date(); td.setDate(td.getDate() + 1);
      return td.toLocaleDateString('sv-SE');
    }
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      return new Intl.DateTimeFormat('sv-SE', { timeZone: selectedCity.timezone }).format(tomorrow);
    } catch {
      const td = new Date(); td.setDate(td.getDate() + 1);
      return td.toLocaleDateString('sv-SE');
    }
  }, [selectedCity?.timezone]);

  const tomorrowSplitColIndex = useMemo(() => {
    for (let i = 1; i < hourly.length; i++) {
      if (hourly[i].date === tomorrowStr && hourly[i - 1].date !== tomorrowStr) return i;
    }
    return null;
  }, [hourly, tomorrowStr]);

  const currentHourSlot = activeDate === todayStr
    ? hourly.find(h => h.date === todayStr && hourFromSlot(h.time) === currentHour)
      ?? hourly.filter(h => h.date === todayStr).findLast(h => hourFromSlot(h.time) <= currentHour)
    : null;

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      swipeStartX.current = e.touches[0].clientX;
      swipeStartY.current = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - swipeStartX.current;
      const dy = e.changedTouches[0].clientY - swipeStartY.current;
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
      const idx = forecasts.findIndex(f => toDateStr(f.forecastDate) === activeDate);
      if (idx === -1) return;
      if (dx < -50 && idx < forecasts.length - 1) setActiveDate(toDateStr(forecasts[idx + 1].forecastDate));
      else if (dx > 50 && idx > 0)                setActiveDate(toDateStr(forecasts[idx - 1].forecastDate));
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend',   onEnd,   { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [forecasts, activeDate]);

  return (
    <>
      <Helmet>
        <title>{selectedCity ? `Погода — ${selectedCity.name} | Crocodile` : 'Погода | Crocodile'}</title>
        <meta name="description" content="Прогноз погоды на 7 дней: температура, осадки, ветер, влажность, фазы луны и геомагнитная активность." />
      </Helmet>

      <div className="weather-page">
        <div className="weather-page__header">
          <h1 className="weather-page__title"><Icon name="sun" size={24} /> Погода</h1>
          <div className="weather-page__controls">
            {locLoading ? <div className="weather-page__select-skeleton" /> : (
              <select
                className="weather-page__select"
                value={selectedId ?? ''}
                onChange={e => setSelectedId(parseInt(e.target.value))}
              >
                {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {loading ? (
          <div className="weather-page__loading"><div className="weather-page__skeleton" /></div>
        ) : forecasts.length > 0 && (
          <>
            {activeForecast && (
              <WeatherDaySummary
                activeForecast={activeForecast}
                currentHourSlot={currentHourSlot}
                currentHour={currentHour}
              />
            )}

            <WeatherTabs
              forecasts={forecasts}
              activeDate={activeDate}
              todayStr={todayStr}
              currentHourSlot={currentHourSlot}
              currentHour={currentHour}
              tabsRef={tabsRef}
              onSelect={(ds) => {
                if (ds === activeDate) {
                  setScrollTrigger(t => t + 1);
                } else {
                  setActiveDate(ds);
                }
              }}
            />

            <WeatherHourlyTable
              hourly={hourly}
              hourlyLoading={hourlyLoading}
              forecasts={forecasts}
              activeDate={activeDate}
              todayStr={todayStr}
              tomorrowStr={tomorrowStr}
              currentHour={currentHour}
              tomorrowSplitColIndex={tomorrowSplitColIndex}
              isRefreshing={isRefreshing}
              loading={loading}
              scrollTrigger={scrollTrigger}
            />

            {activeForecast && activeDate && (
              <WeatherMetaSidebar
                open={metaSidebarOpen}
                onClose={() => setMetaSidebarOpen(o => !o)}
                activeForecast={activeForecast}
                activeDate={activeDate}
                todayStr={todayStr}
                currentHourSlot={currentHourSlot}
              />
            )}
          </>
        )}

        <p className="weather-page__source">
          Данные: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          {' · '}Геомагнитная активность: <a href="https://www.swpc.noaa.gov" target="_blank" rel="noopener noreferrer">NOAA</a>
        </p>

        {/* Кнопка обратной связи */}
        <ContactButton
          onClick={(e) => { e.stopPropagation(); setContactOpen(v => !v); }}
          isOpen={contactOpen}
        />

        {/* Панель обратной связи */}
        <ContactPanel
          isOpen={contactOpen}
          onClose={() => setContactOpen(false)}
        />
      </div>
    </>
  );
};

export default WeatherPage;
