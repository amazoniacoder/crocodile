/**
 * BlogPro Table Component
 * Flexible table component with BEM methodology
 */

import React from 'react';
import './table.css';

export interface TableProps {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
  striped?: boolean;
  hover?: boolean;
  compact?: boolean;
}

export const Table: React.FC<TableProps> = ({
  children,
  className = '',
  bordered = false,
  striped = false,
  hover = true,
  compact = false,
}) => {
  const tableClasses = [
    'table',
    bordered ? 'table--bordered' : '',
    striped ? 'table--striped' : '',
    hover ? 'table--hover' : '',
    compact ? 'table--compact' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className="table__container">
      <table className={tableClasses}>{children}</table>
    </div>
  );
};

export const TableHead: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <thead className={`table__head ${className}`}>{children}</thead>;
};

export const TableBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return <tbody className={`table__body ${className}`}>{children}</tbody>;
};

export const TableRow: React.FC<{
  children: React.ReactNode;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
}> = ({ children, className = '', selected = false, onClick }) => {
  const rowClasses = [
    'table__row',
    selected ? 'table__row--selected' : '',
    onClick ? 'table__row--clickable' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowClasses} onClick={onClick}>
      {children}
    </tr>
  );
};

export const TableCell: React.FC<{
  children: React.ReactNode;
  className?: string;
  header?: boolean;
}> = ({ children, className = '', header = false }) => {
  const Tag = header ? 'th' : 'td';
  const cellClasses = [
    header ? 'table__header' : 'table__cell',
    className,
  ].filter(Boolean).join(' ');

  return <Tag className={cellClasses}>{children}</Tag>;
};

export default Table;
