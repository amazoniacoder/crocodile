import React from 'react';
import { Link } from 'wouter';
import { clientConfig } from '../../../config/client.config';
import './footer.css';

const NAV_LINKS = [
  { label: 'Новости',    href: '/' },
  { label: 'Россия',     href: '/russia' },
  { label: 'Мир',        href: '/world' },
  { label: 'Соц.сети',  href: '/social' },
  { label: 'Погода',     href: '/weather' },
  { label: 'О проекте', href: '/about' },
  { label: 'Источники', href: '/sources' },
];

export const Footer: React.FC<{ className?: string }> = ({ className = '' }) => (
  <footer className={`footer footer--visible ${className}`}>
    <div className="container">
      <div className="footer__bottom">
        <nav className="footer__nav">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} className="footer__nav-link text-secondary">{l.label}</Link>
          ))}
        </nav>
        <p className="footer__copyright text-secondary">{clientConfig.footer.copyright}</p>
      </div>
    </div>
  </footer>
);

export default Footer;
export { Footer as StaticFooter };
