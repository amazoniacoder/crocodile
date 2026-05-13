import React, { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { adminApi, SourceConfig } from '@/services/adminApi';

interface Props {
  token: string;
}

const DONATE_KEY = 'donate_methods_json';
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:', 'tg:', 'mailto:']);

const YOOMONEY_RE = /юmoney|yoomoney/i;
const SBP_RE = /сбп|sbp/i;
const USDT_RE = /usdt/i;
const BTC_RE = /btc|eth/i;

type DonateMethod = {
  id: string;
  title: string;
  value: string;
  note: string;
  href: string;
};

const DEFAULT_METHODS: DonateMethod[] = [
  {
    id: 'sbp',
    title: 'СБП (Россия)',
    value: '+7XXXXXXXXXX',
    note: 'Самый быстрый и удобный способ для РФ.',
    href: '',
  },
  {
    id: 'yoomoney',
    title: 'ЮMoney',
    value: '4100XXXXXXXXXXXXXXX',
    note: 'Подходит тем, кому удобнее классическая оплата.',
    href: '',
  },
  {
    id: 'usdt',
    title: 'USDT (TRC20)',
    value: 'TXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    note: 'Для международной поддержки и крипто-переводов.',
    href: '',
  },
];

// ── Логотипы (те же что на публичной странице) ────────────────────────────

const LogoSBP = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#1D1346"/>
    <path d="M7 10.5L13.5 16 7 21.5V10.5Z" fill="#6CDB6C"/>
    <path d="M7 10.5H17.5L25 16H13.5L7 10.5Z" fill="#FFFFFF"/>
    <path d="M7 21.5H17.5L25 16H13.5L7 21.5Z" fill="#FF4E50"/>
  </svg>
);

const LogoYooMoney = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#8B3FFD"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">ЮМ</text>
  </svg>
);

const LogoUSDT = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#26A17B"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="Arial, sans-serif">USDT</text>
  </svg>
);

const LogoBTC = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="#F7931A"/>
    <text x="16" y="21" textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="Arial, sans-serif">₿</text>
  </svg>
);

const LogoGeneric = () => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
    <rect width="32" height="32" rx="8" fill="var(--bg-alt)" stroke="var(--border-color)"/>
    <path d="M8 12h16M8 16h10M8 20h6" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const MethodLogo: React.FC<{ title: string }> = ({ title }) => {
  if (SBP_RE.test(title)) return <LogoSBP />;
  if (YOOMONEY_RE.test(title)) return <LogoYooMoney />;
  if (USDT_RE.test(title)) return <LogoUSDT />;
  if (BTC_RE.test(title)) return <LogoBTC />;
  return <LogoGeneric />;
};

const getQrValue = (m: DonateMethod): string => {
  if (BTC_RE.test(m.title) && !m.value.startsWith('bitcoin:')) return `bitcoin:${m.value}`;
  if (USDT_RE.test(m.title) && !m.value.startsWith('tron:')) return `tron:${m.value}`;
  return m.value;
};

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const fromConfig = (raw: string): DonateMethod[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_METHODS;
    const normalized = parsed
      .filter((v) => typeof v === 'object' && v !== null)
      .map((v) => {
        const row = v as Record<string, unknown>;
        return {
          id: uid(),
          title: String(row.title ?? '').trim(),
          value: String(row.value ?? '').trim(),
          note: String(row.note ?? '').trim(),
          href: String(row.href ?? '').trim(),
        };
      })
      .filter((v) => v.title.length > 0 && v.value.length > 0);
    return normalized.length > 0 ? normalized : DEFAULT_METHODS;
  } catch {
    return DEFAULT_METHODS;
  }
};

const toConfig = (methods: DonateMethod[]) => JSON.stringify(
  methods.map(({ title, value, note, href }) => ({ title, value, note, href })),
);

const validateHref = (href: string): boolean => {
  if (!href) return true;
  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    return false;
  }
  return ALLOWED_PROTOCOLS.has(parsed.protocol);
};

export const DonateConfig: React.FC<Props> = ({ token }) => {
  const [methods, setMethods] = useState<DonateMethod[]>(DEFAULT_METHODS);
  const [savedValue, setSavedValue] = useState(toConfig(DEFAULT_METHODS));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.getConfig(token).then((res) => {
      const row = res.configs.find((c: SourceConfig) => c.key === DONATE_KEY);
      const value = row?.value?.trim();
      if (!value) {
        const defaults = toConfig(DEFAULT_METHODS);
        setMethods(DEFAULT_METHODS);
        setSavedValue(defaults);
        return;
      }
      const parsed = fromConfig(value);
      setMethods(parsed);
      setSavedValue(toConfig(parsed));
    }).catch(() => {});
  }, [token]);

  const serialized = useMemo(() => toConfig(methods), [methods]);
  const isDirty = serialized !== savedValue;

  const updateMethod = (id: string, key: keyof Omit<DonateMethod, 'id'>, value: string) => {
    setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, [key]: value } : m)));
  };

  const addMethod = () => {
    setMethods((prev) => [...prev, { id: uid(), title: '', value: '', note: '', href: '' }]);
  };

  const removeMethod = (id: string) => {
    setMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const moveMethod = (id: string, dir: -1 | 1) => {
    setMethods((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.splice(nextIdx, 0, item);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const cleaned = methods
        .map((m) => ({ ...m, title: m.title.trim(), value: m.value.trim(), note: m.note.trim(), href: m.href.trim() }))
        .filter((m) => m.title && m.value);
      if (cleaned.length === 0) {
        throw new Error('Нужен хотя бы один метод с заполненными названием и значением');
      }
      const invalid = cleaned.find((m) => !validateHref(m.href));
      if (invalid) {
        throw new Error(`Некорректная ссылка у метода "${invalid.title}". Допустимы: https/http/tg/mailto`);
      }
      const payload = toConfig(cleaned);
      await adminApi.setConfig(token, DONATE_KEY, payload);
      setMethods(cleaned);
      setSavedValue(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="monitor-card monitor-donate-card">
      <div className="monitor-card__header">
        <h3 className="monitor-card__title">Донат: способы оплаты</h3>
        <button className="monitor-btn monitor-btn--secondary monitor-btn--sm" onClick={addMethod}>
          + Добавить метод
        </button>
      </div>
      <div className="monitor-donate-list">
        {methods.map((m, idx) => (
          <div key={m.id} className="monitor-donate-item">
            <div className="monitor-donate-item__toolbar">
              <span className="monitor-donate-item__index">#{idx + 1}</span>
              <div className="monitor-donate-item__actions">
                <button
                  className="monitor-btn monitor-btn--ghost monitor-btn--sm"
                  onClick={() => moveMethod(m.id, -1)}
                  disabled={idx === 0}
                  title="Переместить выше"
                >
                  ↑
                </button>
                <button
                  className="monitor-btn monitor-btn--ghost monitor-btn--sm"
                  onClick={() => moveMethod(m.id, 1)}
                  disabled={idx === methods.length - 1}
                  title="Переместить ниже"
                >
                  ↓
                </button>
                <button
                  className="monitor-btn monitor-btn--danger monitor-btn--sm"
                  onClick={() => removeMethod(m.id)}
                  title="Удалить метод"
                >
                  Удалить
                </button>
              </div>
            </div>
            <div className="monitor-donate-grid">
              <div className="monitor-donate-field">
                <label className="monitor-donate-field__label">Название</label>
                <input
                  className="monitor-modal__input"
                  value={m.title}
                  placeholder="СБП, USDT, ЮMoney…"
                  onChange={(e) => updateMethod(m.id, 'title', e.target.value)}
                />
              </div>
              <div className="monitor-donate-field">
                <label className="monitor-donate-field__label">Реквизит / адрес кошелька</label>
                <input
                  className="monitor-modal__input"
                  value={m.value}
                  placeholder="Номер телефона, адрес кошелька"
                  onChange={(e) => updateMethod(m.id, 'value', e.target.value)}
                />
              </div>
              <div className="monitor-donate-field">
                <label className="monitor-donate-field__label">Ссылка для оплаты (опционально)</label>
                <input
                  className="monitor-modal__input"
                  value={m.href}
                  placeholder="https://… (для кнопки «Перейти к оплате»)"
                  onChange={(e) => updateMethod(m.id, 'href', e.target.value)}
                />
              </div>
              <div className="monitor-donate-field">
                <label className="monitor-donate-field__label">Подсказка для пользователя</label>
                <textarea
                  className="monitor-modal__input monitor-donate-note"
                  value={m.note}
                  placeholder="Краткое описание способа оплаты"
                  onChange={(e) => updateMethod(m.id, 'note', e.target.value)}
                />
              </div>
            </div>
            <div className="monitor-donate-preview-row">
              <div className="monitor-donate-preview-logo">
                <MethodLogo title={m.title} />
              </div>
              <div className="monitor-donate-preview-qr">
                {m.value && <QRCodeSVG value={getQrValue(m)} size={56} />}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="monitor-donate-actions">
        <button
          className="monitor-btn monitor-btn--primary"
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? 'Сохранение...' : saved ? 'Сохранено ✓' : 'Сохранить'}
        </button>
      </div>
      {error && <p className="monitor-modal__error" style={{ marginTop: 8 }}>{error}</p>}
    </div>
  );
};

