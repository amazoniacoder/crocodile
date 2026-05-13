// server/config/app.config.ts
// Конфигурационный файл приложения — заменяет админку
// Все настройки меняются здесь и перезапуском сервера

export const appConfig = {
  site: {
    name: 'NewsAggregator',
    description: 'Независимый новостной агрегатор без алгоритмов подтасовки',
    url: process.env.SITE_URL || 'http://localhost:3000',
  },

  news: {
    collectIntervalMinutes: 15,
    articlesPerPage: 5,
    archiveAfterDays: 30,
    deleteAfterMonths: 3,
    clusterWindowHours: 2,
    clusterMinCommonWords: 2,
  },

  cache: {
    newsFeedTtlSeconds: 60,
    newsSourcesTtlSeconds: 3600,
    newsCitiesTtlSeconds: 3600,
  },

  header: {
    logo: 'NewsAggregator',
    menu: [
      { label: 'О проекте', href: '/about' },
    ],
  },

  footer: {
    copyright: `© ${new Date().getFullYear()} NewsAggregator`,
    description: 'Независимый агрегатор новостей. Без алгоритмов. Без манипуляций.',
    links: [
      { label: 'О проекте', href: '/about' },
    ],
  },
};
