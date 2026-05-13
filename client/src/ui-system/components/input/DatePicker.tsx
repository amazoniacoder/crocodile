/**
 * BlogPro Date Picker Component
 * Universal date picker with calendar interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../../icons/components';

export interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  minDate,
  maxDate,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(value || new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const handleDateSelect = (date: Date) => {
    onChange?.(date);
    setIsOpen(false);
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(currentMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  const isDateDisabled = (date: Date) => {
    if (minDate && date < minDate) return true;
    if (maxDate && date > maxDate) return true;
    return false;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return value && date.toDateString() === value.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <div className={`bp-date-picker ${className}`} ref={pickerRef}>
      <button
        type="button"
        className="date-picker__trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className="date-picker__value">
          {value ? formatDate(value) : placeholder}
        </span>
        <Icon name="book" size={16} />
      </button>

      {isOpen && (
        <div className="date-picker__dropdown">
          <div className="date-picker__header">
            <button
              type="button"
              className="date-picker__nav"
              onClick={() => handleMonthChange('prev')}
            >
              <Icon name="arrow-left" size={16} />
            </button>
            
            <span className="date-picker__month">
              {currentMonth.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric' 
              })}
            </span>
            
            <button
              type="button"
              className="date-picker__nav"
              onClick={() => handleMonthChange('next')}
            >
              <Icon name="arrow-right" size={16} />
            </button>
          </div>

          <div className="date-picker__calendar">
            <div className="date-picker__weekdays">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                <div key={day} className="date-picker__weekday">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="date-picker__days">
              {getDaysInMonth(currentMonth).map((date, index) => (
                <button
                  key={index}
                  type="button"
                  className={`date-picker__day ${
                    !isCurrentMonth(date) ? 'date-picker__day--other-month' : ''
                  } ${
                    isToday(date) ? 'date-picker__day--today' : ''
                  } ${
                    isSelected(date) ? 'date-picker__day--selected' : ''
                  }`}
                  onClick={() => handleDateSelect(date)}
                  disabled={isDateDisabled(date)}
                >
                  {date.getDate()}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
