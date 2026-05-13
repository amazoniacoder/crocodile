export interface SourceConfig {
  key: string;
  value: string;
  updatedAt: Date;
}

export type SourceConfigKey =
  | 'fast_interval_cron'
  | 'slow_interval_cron'
  | 'donate_methods_json'
  | 'telegram_page_enabled'
  | 'youtube_page_enabled';

export const SOURCE_CONFIG_DEFAULTS: Record<SourceConfigKey, string> = {
  fast_interval_cron: '* * * * *',
  slow_interval_cron: '*/5 * * * *',
  donate_methods_json: JSON.stringify([
    {
      title: 'СБП (Россия)',
      value: 'Оплата по QR или номеру телефона',
      note: 'Самый быстрый и удобный способ для РФ.',
      href: '',
    },
    {
      title: 'ЮMoney / банковская карта',
      value: 'Поддержка разовым платежом',
      note: 'Подходит тем, кому удобнее классическая оплата.',
      href: '',
    },
    {
      title: 'USDT (TRC20)',
      value: 'Сеть TRON',
      note: 'Для международной поддержки и крипто-переводов.',
      href: '',
    },
    {
      title: 'BTC / ETH',
      value: 'Криптокошелек проекта',
      note: 'Для тех, кто поддерживает в долгую.',
      href: '',
    },
  ]),
  telegram_page_enabled: 'true',
  youtube_page_enabled: 'true',
};
