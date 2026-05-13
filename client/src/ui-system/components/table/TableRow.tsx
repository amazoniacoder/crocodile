/**
 * BlogPro Table Row Component
 */

import React from 'react';

export interface TableRowProps {
  children: React.ReactNode;
  variant?: 'default' | 'selected' | 'hover';
  className?: string;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  variant = 'default',
  className = ''
}) => {
  const rowClasses = [
    'table__row',
    `table__row--${variant}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <tr className={rowClasses}>
      {children}
    </tr>
  );
};

export default TableRow;
