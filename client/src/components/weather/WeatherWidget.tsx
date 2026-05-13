import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { Icon } from '@/ui-system/icons/components';
import WeatherIcon, { getWeatherDescription } from './WeatherIcon';
import CitySearchInput from './CitySearchInput';

interface Location {
  id: number;
  name: string;
  country: string;
  latitude: string;
  longitude: string;
  timezone: string;
}

interface Forecast {
  forecastDate: string;
  tempMin: string | null;
  tempMax: string | null;
  weatherCode: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'weather:widget-city';

// Синхронизируем с ключом страницы погоды
const PAGE_STORAGE_KEY = 'weather:selected-city';

const WeatherWidget: React.FC<Props> = ({ open, onClose }) => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelectedIdLocal] = useState<number | null>(() => {
    const s = localStorage.getItem(PAGE_STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    return s ? parseInt(s) : null;
  });

  const setSelectedId = (id: number | null) => {
    setSelectedIdLocal(id);
    if (id) localStorage.setItem(PAGE_STORAGE_KEY, String(id));
  };

  // Слушаем изменения со страницы /weather
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PAGE_STORAGE_KEY && e.newValue) {
        setSelectedIdLocal(parseInt(e.newValue));
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(false);

  // Загружаем список городов один раз
  useEffect(() => {
    fetch('/api/weather/locations')
      .then(r => r.json())
      .then(d => {
        setLocations(d.locations ?? []);
        // Москва по умолчанию
        if (!selectedId && d.locations?.length) {
          const moscow = d.locations.find((l: Location) => l.name === 'Москва');
          setSelectedId(moscow?.id ?? d.locations[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Загружаем прогноз при открытии или смене города
  useEffect(() => {
    if (!open || !selectedId) return;
    setLoading(true);
    fetch(`/api/weather?locationId=${selectedId}`)
      .then(r => r.json())
      .then(d => { setForecasts(d.forecasts ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [open, selectedId]);

  // Сохраняем выбор (уже сохраняется в setSelectedId)
  useEffect(() => {
    if (selectedId && !localStorage.getItem(PAGE_STORAGE_KEY)) {
      localStorage.setItem(PAGE_STORAGE_KEY, String(selectedId));
    }
  }, [selectedId]);

  const today = forecasts[0];
  const next3 = forecasts.slice(1, 4);
  const selectedCity = locations.find(l => l.id === selectedId);

  const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

  return (
    <aside
      className={`weather-widget${open ? ' weather-widget--open' : ''}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="weather-widget__header">
        <h3 className="weather-widget__title">
          <Icon name="sun" size={16} /> Погода
        </h3>
      </div>

      <div className="weather-widget__body">
        {/* Умный поиск города */}
        <CitySearchInput
          locations={locations}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {loading ? (
          <div className="weather-widget__loading">
            {[1, 2, 3, 4].map(i => <div key={i} className="weather-widget__skeleton-row" />)}
          </div>
        ) : (
          <>
            {/* Сегодня */}
            {today && (
              <div className="weather-widget__today">
                <div className="weather-widget__today-icon">
                  <WeatherIcon code={today.weatherCode ?? 0} size={40} />
                </div>
                <div className="weather-widget__today-info">
                  <div className="weather-widget__today-temp">
                    +{Math.round(Number(today.tempMax))}° / {Math.round(Number(today.tempMin))}°
                  </div>
                  <div className="weather-widget__today-desc">
                    {getWeatherDescription(today.weatherCode ?? 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Следующие 3 дня */}
            <div className="weather-widget__days">
              {next3.map(f => {
                const d = new Date(`${f.forecastDate}T12:00:00`);
                return (
                  <div key={f.forecastDate} className="weather-widget__day">
                    <span className="weather-widget__day-name">{DAY_NAMES[d.getDay()]}</span>
                    <span className="weather-widget__day-icon"><WeatherIcon code={f.weatherCode ?? 0} size={20} /></span>
                    <span className="weather-widget__day-temp">
                      +{Math.round(Number(f.tempMax))}° / {Math.round(Number(f.tempMin))}°
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Ссылка на полный прогноз */}
            {selectedCity && (
              <Link
                href={`/weather`}
                className="weather-widget__link"
                onClick={onClose}
              >
                Прогноз на 7 дней →
              </Link>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default WeatherWidget;
