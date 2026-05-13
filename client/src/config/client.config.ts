export const clientConfig = {
  site: {
    name: 'Crocodile',
    description: 'Новости без лишней чешуи. Без алгоритмов, трекеров и рекламы.',
  },

  header: {
    logo: 'Crocodile',
    menu: [
      { label: 'Погода', href: '/weather' },
      { 
        label: 'О проекте', 
        href: '/about',
        subItems: [
          { label: 'Источники', href: '/sources' },
        ]
      },
    ],
  },

  footer: {
    copyright: `© ${new Date().getFullYear()} Crocodile.press`,
    description: 'MIT License · Анонимная аналитика · Без рекламы',
    links: [
      { label: 'О проекте', href: '/about' },
      { label: 'Источники', href: '/sources' },
      { label: 'Погода', href: '/weather' },
    ],
  },
};
