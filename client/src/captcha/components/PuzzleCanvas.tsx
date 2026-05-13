/**
 * BlogPro Puzzle Canvas Component
 * Main puzzle display with drag & drop functionality
 */

import React, { useState } from 'react';
import { PuzzleCanvasProps, Point } from '../types';
import { PuzzlePiece } from './PuzzlePiece';

export const PuzzleCanvas: React.FC<PuzzleCanvasProps> = ({
  puzzleData,
  onPieceDrop,
  className = ''
}) => {
  const [draggedPiece, setDraggedPiece] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState(false);
  const [validationState, setValidationState] = useState<'idle' | 'validating' | 'success' | 'error'>('idle');

  const handleDragStart = (pieceId: string) => {
    setDraggedPiece(pieceId);
  };

  const handleDragEnd = () => {
    setDraggedPiece(null);
    setDragOverTarget(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverTarget(false);

    if (!draggedPiece) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const coordinates: Point = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    setValidationState('validating');
    
    try {
      const result = await onPieceDrop(draggedPiece, coordinates);
      setValidationState(result ? 'success' : 'error');
      
      // Hide status after delay
      setTimeout(() => {
        setValidationState('idle');
      }, result ? 1500 : 2000);
    } catch (error) {
      setValidationState('error');
      setTimeout(() => {
        setValidationState('idle');
      }, 2000);
    }
  };

  return (
    <div className={`puzzle-canvas ${className}`}>
      {/* Validation status indicator */}
      {validationState !== 'idle' && (
        <div className={`puzzle-canvas__status puzzle-canvas__status--${validationState}`}>
          {validationState === 'validating' && (
            <>
              <div className="puzzle-canvas__spinner"></div>
              <span>Validating...</span>
            </>
          )}
          {validationState === 'success' && (
            <>
              <div className="puzzle-canvas__icon puzzle-canvas__icon--success">✓</div>
              <span>Correct!</span>
            </>
          )}
          {validationState === 'error' && (
            <>
              <div className="puzzle-canvas__icon puzzle-canvas__icon--error">✕</div>
              <span>Try again</span>
            </>
          )}
        </div>
      )}
      
      {/* Main puzzle area - hide during success/error states */}
      {(validationState === 'idle' || validationState === 'validating') && (
        <>
          <div
            className={`puzzle-canvas__main ${dragOverTarget ? 'puzzle-canvas__main--drag-over' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <img
              src={puzzleData.puzzleImage}
              alt="Puzzle to complete"
              className="puzzle-canvas__image"
              draggable={false}
            />
          </div>

          {/* Instructions */}
          <p className="puzzle-canvas__instructions">
            Drag the correct piece to complete the puzzle
          </p>

          {/* Puzzle pieces */}
          <div className="puzzle-canvas__pieces">
            {puzzleData.pieces.map((piece) => (
              <PuzzlePiece
                key={piece.id}
                piece={piece}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                isDragging={draggedPiece === piece.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PuzzleCanvas;
