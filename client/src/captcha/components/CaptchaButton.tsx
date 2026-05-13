/**
 * BlogPro Captcha Button Component
 * Compact button that opens the puzzle modal
 */

import React, { useState } from 'react';
import { CaptchaButtonProps } from '../types';
import { CaptchaModal } from './CaptchaModal';
import { Icon } from '@/ui-system/icons/components';

export const CaptchaButton: React.FC<CaptchaButtonProps> = ({
  onSolved,
  onError,
  disabled = false,
  size = 'md',
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSolved, setIsSolved] = useState(false);

  const handleOpenModal = () => {
    if (!disabled && !isSolved) {
      setIsModalOpen(true);
    }
  };

  const handleSolved = (token: string) => {
    setIsSolved(true);
    setIsModalOpen(false);
    onSolved(token);
  };

  const handleError = (error: string) => {
    setIsModalOpen(false);
    onError(error);
  };

  const sizeClass = `captcha-button--${size}`;
  const stateClass = isSolved ? 'captcha-button--solved' : 'captcha-button--unsolved';
  const disabledClass = disabled ? 'captcha-button--disabled' : '';

  return (
    <>
      <button
        type="button"
        className={`captcha-button ${sizeClass} ${stateClass} ${disabledClass} ${className}`}
        onClick={handleOpenModal}
        disabled={disabled}
        title={isSolved ? 'Verification complete' : 'Verify you\'re human'}
        aria-label={isSolved ? 'Verification complete' : 'Open captcha verification'}
      >
        <span className="captcha-button__icon">
          {isSolved ? (
            <Icon name="check" size={18} />
          ) : (
            <Icon name="puzzle" size={18} />
          )}
        </span>
      </button>

      <CaptchaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSolved={handleSolved}
        onError={handleError}
      />
    </>
  );
};

export default CaptchaButton;
