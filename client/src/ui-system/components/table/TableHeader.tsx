/**
 * BlogPro Table Header Component
 */

import React from 'react';

export interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({
  children,
  className = ''
}) => {
  return (
    <thead className={`table__header ${className}`}>
      {children}
    </thead>
  );
};

export default TableHeader;
