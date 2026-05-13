import React from 'react';
import { Switch } from '@/ui-system/components/form/Switch';

interface Props {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

/** Обёртка над общим Switch — разметка и стили совпадают с формой и лентой новостей */
export const ToggleSwitch: React.FC<Props> = ({ checked, onChange, disabled }) => (
  <Switch checked={checked} disabled={disabled} onChange={() => onChange()} />
);
