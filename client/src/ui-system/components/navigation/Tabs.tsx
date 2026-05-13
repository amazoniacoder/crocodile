/**
 * BlogPro Tabs Component
 * Universal tab navigation component
 */

import React, { useState } from 'react';
import { Text } from '../index';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  defaultTab,
  activeTab,
  onTabChange,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState(
    activeTab || defaultTab || items[0]?.id
  );

  const currentTab = activeTab || internalActiveTab;

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTab(tabId);
    }
  };

  const tabsClasses = [
    'tabs',
    `tabs--${variant}`,
    `tabs--${size}`,
    className
  ].filter(Boolean).join(' ');

  const activeItem = items.find(item => item.id === currentTab);

  return (
    <div className={tabsClasses}>
      <div className="tabs__list" role="tablist">
        {items.map((item) => {
          const tabClasses = [
            'tabs__tab',
            item.id === currentTab && 'tabs__tab--active',
            item.disabled && 'tabs__tab--disabled'
          ].filter(Boolean).join(' ');

          return (
            <button
              key={item.id}
              className={tabClasses}
              onClick={() => !item.disabled && handleTabClick(item.id)}
              disabled={item.disabled}
              role="tab"
              aria-selected={item.id === currentTab}
            >
              <Text size={size === 'lg' ? 'base' : 'sm'} weight="medium">
                {item.label}
              </Text>
            </button>
          );
        })}
      </div>
      
      {activeItem?.content}
    </div>
  );
};

export default Tabs;
