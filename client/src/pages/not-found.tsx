import React from 'react';
import { Link } from 'wouter';

const NotFound: React.FC = () => (
  <div className="container" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
    <h1 style={{ fontSize: '6rem', margin: 0, color: 'var(--color-primary)' }}>404</h1>
    <h2>Страница не найдена</h2>
    <p style={{ color: 'var(--text-secondary)' }}>Запрошенная страница не существует.</p>
    <Link href="/" className="button button--primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
      На главную
    </Link>
  </div>
);

export default NotFound;
