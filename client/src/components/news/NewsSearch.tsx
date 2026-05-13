import React, { useState, useEffect, useRef } from 'react';

interface NewsSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const NewsSearch: React.FC<NewsSearchProps> = ({ value, onChange, placeholder }) => {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), 300);
  };

  return (
    <input
      type="search"
      className="news-filters__search"
      placeholder={placeholder || "Поиск новостей..."}
      value={local}
      onChange={handleChange}
      aria-label="Поиск новостей"
    />
  );
};
