/**
 * BlogPro Captcha Modal Component
 * Modal container for the puzzle interface
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CaptchaModalProps, PuzzleData } from '../types';
import { PuzzleCanvas } from './PuzzleCanvas';
import { useCaptcha } from '../hooks/useCaptcha';

export const CaptchaModal: React.FC<CaptchaModalProps> = ({
  isOpen,
  onClose,
  onSolved,
  onError
}) => {
  const [puzzleData, setPuzzleData] = useState<PuzzleData | null>(null);
  const [loading, setLoading] = useState(false);
  const { generatePuzzle, validateSolution } = useCaptcha();

  // Load puzzle when modal opens
  useEffect(() => {
    if (isOpen && !puzzleData) {
      loadPuzzle();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const loadPuzzle = async () => {
    setLoading(true);
    try {
      const data = await generatePuzzle();
      setPuzzleData(data);
    } catch (error) {
      onError('Failed to load puzzle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePieceDrop = async (pieceId: string, coordinates: { x: number; y: number }): Promise<boolean> => {
    if (!puzzleData) return false;

    try {
      const result = await validateSolution({
        puzzleId: puzzleData.id,
        pieceId,
        dropCoordinates: coordinates,
        sessionToken: puzzleData.sessionToken
      });

      if (result.success && result.token) {
        // Success - close modal after delay
        setTimeout(() => {
          onSolved(result.token!);
        }, 1500);
        return true;
      } else {
        // Generate new puzzle on failure after delay
        setTimeout(async () => {
          await loadPuzzle();
        }, 2000);
        return false;
      }
    } catch (error) {
      onError('Validation failed. Please try again.');
      return false;
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="captcha-modal-overlay" onClick={handleOverlayClick}>
      <div className="captcha-modal">
        <div className="captcha-modal__header">
          <h3 className="captcha-modal__title">Complete the puzzle</h3>
          <button
            className="captcha-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <div className="captcha-modal__content">
          {loading ? (
            <div className="captcha-modal__loading">
              <div className="spinner"></div>
              <p>Loading puzzle...</p>
            </div>
          ) : puzzleData ? (
            <PuzzleCanvas
              puzzleData={puzzleData}
              onPieceDrop={handlePieceDrop}
            />
          ) : (
            <div className="captcha-modal__error">
              <p>Failed to load puzzle</p>
              <button onClick={loadPuzzle}>Try Again</button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CaptchaModal;
