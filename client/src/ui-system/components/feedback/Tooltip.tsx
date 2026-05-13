/**
 * BlogPro Tooltip Component
 * Universal tooltip with positioning
 */

import React, { useState, useRef, useEffect } from 'react';

export interface TooltipProps {
  children: React.ReactNode;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  trigger?: 'hover' | 'click';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  trigger = 'hover',
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trigger === 'click') {
      const handleClickOutside = (event: MouseEvent) => {
        if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
          setIsVisible(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [trigger]);

  const handleMouseEnter = () => {
    if (trigger === 'hover') setIsVisible(true);
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover') setIsVisible(false);
  };

  const handleClick = () => {
    if (trigger === 'click') setIsVisible(!isVisible);
  };

  const tooltipClasses = [
    'tooltip',
    'text-base',
    'ml-2',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={tooltipClasses}
      ref={tooltipRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      {children}
      {isVisible && (
        <div className={`tooltip__text tooltip__text--${position} bg-primary p-2 ${
          position === 'top' ? 'mb-2' : 
          position === 'right' ? 'ml-2' : 
          position === 'bottom' ? 'mt-2' : 
          position === 'left' ? 'mr-2' : ''
        }`}>
          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
