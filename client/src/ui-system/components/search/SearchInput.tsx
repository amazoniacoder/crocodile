import React, { useState, useRef } from 'react';
import { Icon } from '../../icons/components';
import './search.css';

export interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSearch?: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  variant?: 'default' | 'compact' | 'admin';
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Поиск...', value = '', onChange, onSearch,
  onFocus, onBlur, variant = 'default', className = '',
  disabled = false, autoFocus = false
}) => {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => { setInputValue(value); }, [value]);

  return (
    <form
      className={['search-input', `search-input--${variant}`, disabled && 'search-input--disabled', className].filter(Boolean).join(' ')}
      onSubmit={(e) => { e.preventDefault(); onSearch?.(inputValue); }}
    >
      <div className="search-input__wrapper">
        <input ref={inputRef} type="text" className="search-input__field"
          placeholder={placeholder} value={inputValue} disabled={disabled}
          autoFocus={autoFocus} onFocus={onFocus} onBlur={onBlur}
          onChange={(e) => { setInputValue(e.target.value); onChange?.(e.target.value); }}
        />
        {inputValue && (
          <button type="button" className="search-input__clear"
            onClick={() => { setInputValue(''); onChange?.(''); inputRef.current?.focus(); }}
            aria-label="Очистить">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
    </form>
  );
};

export default SearchInput;
