/**
 * BlogPro Captcha Plugin - Main Export
 * Professional puzzle captcha system
 */

// Import styles
import './styles/captcha.css';

// Export components
export { CaptchaButton } from './components/CaptchaButton';
export { CaptchaModal } from './components/CaptchaModal';
export { PuzzleCanvas } from './components/PuzzleCanvas';
export { PuzzlePiece } from './components/PuzzlePiece';

// Export hooks
export { useCaptcha } from './hooks/useCaptcha';

// Export types
export type {
  CaptchaConfig,
  CaptchaButtonProps,
  CaptchaModalProps,
  PuzzleCanvasProps,
  PuzzlePieceProps,
  PuzzleData,
  PuzzlePiece as PuzzlePieceType,
  CaptchaResponse,
  ValidationRequest
} from './types';
