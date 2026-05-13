import React from 'react';
import { useLocation } from 'wouter';
import { Icon } from '@/ui-system/icons/components';

export const SubscriptionGate: React.FC = () => {
  const [, navigate] = useLocation();

  return (
    <li className="subscription-gate">
      <span className="subscription-gate__lock">
        <Icon name="lock" size={16} />
      </span>
      <span className="subscription-gate__text">
        Любые каналы по подписке в личном кабинете
      </span>
      <button className="subscription-gate__btn" onClick={() => navigate('/my')}>
        Перейти
      </button>
    </li>
  );
};
