/**
 * BlogPro Table Cell Component
 */

import React from 'react';

export interface TableCellProps {
  children: React.ReactNode;
  as?: 'td' | 'th';
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const TableCell: React.FC<TableCellProps> = ({
  children,
  as: Tag = 'td',
  align = 'left',
  className = ''
}) => {
  const cellClasses = [
    'table__cell',
    `table__cell--${align}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <Tag className={cellClasses}>
      {children}
    </Tag>
  );
};

export default TableCell;
