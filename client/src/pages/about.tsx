import React, { useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '@/ui-system/icons/components';
import { Button } from '@/ui-system/components';
import { ContactButton, ContactPanel } from '../components/contact';

const SUPPORT_CHANNELS = [
  {
    title: 'ЮМoney',
    value: '4100XXXXXXXXXXXXXXX',
    note: 'Оплата картой или через ЮМoney.',
  },
  {
    title: 'Озон Банк (СБП)',
    value: '+7XXXXXXXXXX',
    note: 'Перевод по номеру телефона через СБП.',
  },
];

type DonateMethod = {
  title: string;
  value: string;
  note?: string;
  href?: string;
};

const isRequisite = (m: DonateMethod): boolean => !m.href;
const YOOMONEY_RE = /юmoney|yoomoney/i;
const SBP_RE = /сбп|sbp/i;
const USDT_RE = /usdt/i;
const BTC_RE = /btc|eth/i;
const OZON_RE = /озон|ozon/i;

const PRESET_AMOUNTS = [100, 300, 500, 1000];

// ── Логотипы ─────────────────────────────────────────────────────────────────

const LogoSBP = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="СБП">
    <rect width="32" height="32" rx="8" fill="#1D1346"/>
    <path d="M7 10.5L13.5 16 7 21.5V10.5Z" fill="#6CDB6C"/>
    <path d="M7 10.5H17.5L25 16H13.5L7 10.5Z" fill="#FFFFFF"/>
    <path d="M7 21.5H17.5L25 16H13.5L7 21.5Z" fill="#FF4E50"/>
  </svg>
);

const LogoYooMoney = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="ЮMoney">
    <rect width="32" height="32" rx="8" fill="#8B3FFD"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">ЮМ</text>
  </svg>
);

const LogoUSDT = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="USDT">
    <rect width="32" height="32" rx="8" fill="#26A17B"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">USDT</text>
  </svg>
);

const LogoBTC = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="BTC">
    <rect width="32" height="32" rx="8" fill="#F7931A"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">₿</text>
  </svg>
);

const LogoOzon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Озон">
    <rect width="32" height="32" rx="8" fill="#005BFF"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">OZON</text>
  </svg>
);

const LogoGeneric = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="Оплата">
    <rect width="32" height="32" rx="8" fill="var(--bg-alt)"/>
    <path d="M8 12h16M8 16h10M8 20h6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const MethodLogo: React.FC<{ title: string }> = ({ title }) => {
  if (SBP_RE.test(title)) return <LogoSBP />;
  if (YOOMONEY_RE.test(title)) return <LogoYooMoney />;
  if (USDT_RE.test(title)) return <LogoUSDT />;
  if (BTC_RE.test(title)) return <LogoBTC />;
  if (OZON_RE.test(title)) return <LogoOzon />;
  return <LogoGeneric />;
};

// ── Иконки ────────────────────────────────────────────────────────────────────

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconQr = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
  </svg>
);

const getQrValue = (item: DonateMethod): string => {
  const v = item.value;
  if (BTC_RE.test(item.title) && !v.startsWith('bitcoin:')) return `bitcoin:${v}`;
  if (USDT_RE.test(item.title) && !v.startsWith('tron:')) return `tron:${v}`;
  return v;
};

// ── ЮMoney виджет ─────────────────────────────────────────────────────────────

const YooMoneyWidget: React.FC<{ wallet: string; note?: string }> = ({ wallet, note }) => {
  const [amount, setAmount] = useState<number | ''>(100);
  const [custom, setCustom] = useState('');

  const finalAmount = custom ? Number(custom) : (amount || 0);
  const valid = Number.isFinite(finalAmount) && (finalAmount as number) > 0;

  const handlePreset = (v: number) => { setAmount(v); setCustom(''); };
  const handleCustom = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustom(e.target.value.replace(/\D/g, ''));
    setAmount('');
  };
  const handlePay = () => {
    if (!valid) return;
    const url = `https://yoomoney.ru/quickpay/confirm.xml?receiver=${encodeURIComponent(wallet)}&quickpay-form=donate&targets=${encodeURIComponent('Поддержка Crocodile.press')}&sum=${finalAmount}&label=donate`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="about__donate-item">
      <div className="about__donate-item-header">
        <LogoYooMoney />
        <div className="about__donate-item-meta">
          <p className="about__donate-item-title">ЮMoney</p>
          {note && <p className="about__donate-item-note">{note}</p>}
        </div>
      </div>
      <div className="about__donate-ym-form">
        <p className="about__donate-ym-label">Сумма, ₽</p>
        <div className="about__donate-ym-presets">
          {PRESET_AMOUNTS.map(v => (
            <button
              key={v}
              type="button"
              className={`about__donate-ym-preset${amount === v && !custom ? ' about__donate-ym-preset--active' : ''}`}
              onClick={() => handlePreset(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <input
          className="about__donate-ym-input"
          type="text"
          inputMode="numeric"
          placeholder="Своя сумма"
          value={custom}
          onChange={handleCustom}
        />
        <button
          className="about__donate-ym-pay"
          type="button"
          onClick={handlePay}
          disabled={!valid}
        >
          Перейти к оплате →
        </button>
      </div>
    </div>
  );
};

// ── Карточка метода ───────────────────────────────────────────────────────────

const DonateCard: React.FC<{ item: DonateMethod }> = ({ item }) => {
  if (YOOMONEY_RE.test(item.title)) {
    return <YooMoneyWidget wallet={item.value} note={item.note} />;
  }

  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const showCopy = isRequisite(item);
  const showQr = isRequisite(item);

  const handleCopy = () => {
    navigator.clipboard.writeText(item.value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="about__donate-item">
      <div className="about__donate-item-header">
        <MethodLogo title={item.title} />
        <div className="about__donate-item-meta">
          <p className="about__donate-item-title">{item.title}</p>
          {item.note && <p className="about__donate-item-note">{item.note}</p>}
        </div>
      </div>
      <div className="about__donate-item-requisite">
        <code className="about__donate-item-value">{item.value}</code>
        {showCopy && (
          <button
            className={`about__donate-copy${copied ? ' about__donate-copy--done' : ''}`}
            onClick={handleCopy}
            title="Скопировать"
            type="button"
          >
            {copied ? <IconCheck /> : <IconCopy />}
          </button>
        )}
        {showQr && (
          <button
            className="about__donate-qr-btn"
            onClick={() => setQrOpen(v => !v)}
            title="QR-код"
            type="button"
          >
            <IconQr />
          </button>
        )}
      </div>
      {showQr && qrOpen && (
        <div className="about__donate-qr">
          <QRCodeSVG value={getQrValue(item)} size={160} />
        </div>
      )}
      {item.href && (
        <a
          className="about__donate-item-link"
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Перейти к оплате
        </a>
      )}
    </div>
  );
};

// ── Возможности ───────────────────────────────────────────────────────────────

const FEATURES: { icon: Parameters<typeof Icon>[0]['name']; label: string; desc: string }[] = [
  { icon: 'list',        label: 'RSS-агрегация',       desc: 'Белый список источников, два расписания сбора (fast/slow), дедупликация по URL' },
  { icon: 'search',      label: 'Полнотекстовый поиск', desc: 'PostgreSQL GIN-индекс, русский и английский, триггер tsvector_update' },
  { icon: 'circle',      label: 'Кластеризация',        desc: 'Группировка похожих новостей из разных СМИ, морфологическая нормализация (pymorphy2)' },
  { icon: 'bell',        label: 'WebSocket + Push',     desc: 'Уведомления о новых статьях в реальном времени, Web Push через VAPID' },
  { icon: 'mobile',      label: 'PWA / офлайн',         desc: 'Установка на устройство, офлайн-чтение 14 дней (IndexedDB), очередь реакций' },
  { icon: 'cloud',       label: 'Погода',               desc: '51 город России, прогноз 7 дней + почасовка, геомагнитная активность, фазы луны' },
  { icon: 'key',         label: 'Публичный API',         desc: 'API-ключи, rate limiting 120 req/мин, RSS-экспорт отфильтрованной ленты' },
  { icon: 'shield',      label: 'Приватность',          desc: 'Анонимная аналитика без cookie и IP, нет трекеров, нет рекламных сетей' },
  { icon: 'trending-up', label: 'Мониторинг',           desc: '11 зон кабинета, AlertManager, SLA-метрики, аудит действий, ротация токенов' },
  { icon: 'server',      label: 'Масштабирование',      desc: 'Redis-кластер, распределённые блокировки, автоматический failover' },
];

// ── Страница ──────────────────────────────────────────────────────────────────

const About: React.FC = () => {
  const donateSectionRef = useRef<HTMLElement>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [methods, setMethods] = useState<DonateMethod[]>(SUPPORT_CHANNELS);
  const [usingFallbackMethods, setUsingFallbackMethods] = useState(false);

  React.useEffect(() => {
    fetch('/api/news/donate-config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { methods?: DonateMethod[] }) => {
        if (Array.isArray(data.methods) && data.methods.length > 0) {
          setMethods(data.methods);
        } else {
          setUsingFallbackMethods(true);
        }
      })
      .catch(() => setUsingFallbackMethods(true));
  }, []);

  const scrollToDonate = () => {
    donateSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <main className="about">
      <div className="about__container">

        <header className="about__header">
          <div className="about__header-top">
            <h1 className="about__title">О проекте</h1>
            <Button variant="primary" size="sm" className="about__donate-btn" onClick={scrollToDonate}>
              Поддержать проект
            </Button>
          </div>
          <p className="about__lead">
            Crocodile — независимый новостной агрегатор на белом списке RSS-источников без алгоритмической подборки и рекламы.
            Мы не собираем персональные данные, не используем трекеры и не требуем регистрацию — только анонимная статистика посещений.
          </p>
        </header>

        <section className="about__section">
          <h2 className="about__section-title">Возможности</h2>
          <div className="about__features">
            {FEATURES.map(f => (
              <div key={f.label} className="about__feature">
                <span className="about__feature-icon">
                  <Icon name={f.icon} size={18} />
                </span>
                <div>
                  <p className="about__feature-label">{f.label}</p>
                  <p className="about__feature-desc">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">Источники</h2>
          <div className="about__sources">
            {[
              { name: 'Lenta.ru',      note: '8 тематических лент' },
              { name: 'RBC',           note: 'Экономика и политика' },
              { name: 'Habr',          note: 'Технологии' },
              { name: 'The Guardian',  note: '8 лент, мировые новости' },
              { name: 'Al Jazeera',    note: 'Международные новости' },
              { name: 'ТАСС',          note: 'Через RSSHub' },
              { name: 'Reuters',       note: 'Через RSSHub' },
            ].map(s => (
              <div key={s.name} className="about__source">
                <span className="about__source-name">{s.name}</span>
                <span className="about__source-note">{s.note}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="about__section">
          <h2 className="about__section-title">Стек</h2>
          <div className="about__tech">
            {[
              { label: 'Frontend',  tags: ['React 18', 'TypeScript', 'Vite', 'Zustand', 'Wouter', 'Workbox', 'Dexie.js'] },
              { label: 'Backend',   tags: ['Node.js 20', 'Express', 'PostgreSQL 17', 'Redis 7', 'Drizzle ORM', 'WebSocket'] },
              { label: 'Сервисы',   tags: ['FastAPI NER', 'Open-Meteo', 'NOAA', 'RSSHub', 'web-push (VAPID)'] },
              { label: 'DevOps',    tags: ['Docker', 'Nginx', 'PM2', 'Vitest', 'ESLint'] },
            ].map(g => (
              <div key={g.label} className="about__tech-group">
                <h3 className="about__tech-label">{g.label}</h3>
                <div className="about__tech-tags">
                  {g.tags.map(t => <span key={t} className="about__tag">{t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="about__section about__section--donate" ref={donateSectionRef}>
          <h2 className="about__section-title">Поддержать проект</h2>
          <p className="about__donate-text">
            Проект существует без рекламы. Любой донат помогает покрывать серверы и ускоряет разработку.
          </p>
          <div className="about__donate-list">
            {methods.map((item) => (
              <DonateCard key={item.title} item={item} />
            ))}
          </div>
          {usingFallbackMethods && (
            <p className="about__donate-warning" role="status">
              Загружен базовый список способов поддержки. Актуальные реквизиты могут быть обновлены позже.
            </p>
          )}
        </section>

        <button
          className="about__scroll-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Наверх"
          type="button"
        >
          <Icon name="arrow-up" size={18} />
        </button>

        <footer className="about__footer">
          <p className="about__footer-text">
            Crocodile.press · MIT License · Анонимная аналитика без cookie и IP
          </p>
        </footer>

      </div>

      <ContactButton
        onClick={(e) => { e.stopPropagation(); setContactOpen(v => !v); }}
        isOpen={contactOpen}
      />
      <ContactPanel isOpen={contactOpen} onClose={() => setContactOpen(false)} />
    </main>
  );
};

export default About;
