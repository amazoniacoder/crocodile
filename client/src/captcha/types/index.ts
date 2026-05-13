/**
 * BlogPro Captcha Plugin - Type Definitions
 * Core interfaces and types for the puzzle captcha system
 */

export interface CaptchaConfig {
  apiEndpoint?: string;
  timeout?: number;
  maxAttempts?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface ShapeData {
  type: 'polygon' | 'circle' | 'rectangle' | 'triangle';
  points?: Point[];
  radius?: number;
  width?: number;
  height?: number;
}

export interface PuzzlePiece {
  id: string;
  image: string;              // Base64 piece image
  isCorrect: boolean;
  shape: ShapeData;
  originalPosition: Point;
}

export interface PuzzleData {
  id: string;
  puzzleImage: string;        // Base64 puzzle image
  pieces: PuzzlePiece[];      // Array of 3 pieces
  correctPieceId: string;     // ID of correct piece
  missingArea: Rectangle;     // Coordinates of missing area
  sessionToken: string;
}

export interface CaptchaResponse {
  success: boolean;
  puzzleData?: PuzzleData;
  token?: string;             // JWT token for form submission
  error?: string;
}

export interface ValidationRequest {
  puzzleId: string;
  pieceId: string;
  dropCoordinates: Point;
  sessionToken: string;
}

export interface CaptchaButtonProps {
  onSolved: (token: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface CaptchaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSolved: (token: string) => void;
  onError: (error: string) => void;
}

export interface PuzzleCanvasProps {
  puzzleData: PuzzleData;
  onPieceDrop: (pieceId: string, coordinates: Point) => Promise<boolean>;
  className?: string;
}

export interface PuzzlePieceProps {
  piece: PuzzlePiece;
  onDragStart: (pieceId: string) => void;
  onDragEnd: () => void;
  isDragging?: boolean;
  className?: string;
}
