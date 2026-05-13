import { Link } from 'wouter';
import { Icon } from '@/ui-system/icons/components';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb__list">
        {items.map((item, index) => (
          <li key={index} className="breadcrumb__item">
            {item.href ? (
              <Link href={item.href} className="breadcrumb__link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumb__current">{item.label}</span>
            )}
            {index < items.length - 1 && (
              <Icon name="arrow-right" size={14} className="breadcrumb__separator" />
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}