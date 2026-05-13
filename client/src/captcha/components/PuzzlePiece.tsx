/**
 * BlogPro Puzzle Piece Component
 * Individual draggable puzzle piece
 */

import React from 'react';
import { PuzzlePieceProps } from '../types';

export const PuzzlePiece: React.FC<PuzzlePieceProps> = ({
  piece,
  onDragStart,
  onDragEnd,
  isDragging = false,
  className = ''
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', piece.id);
    onDragStart(piece.id);
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  return (
    <div
      className={`puzzle-piece ${isDragging ? 'puzzle-piece--dragging' : ''} ${className}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      role="button"
      tabIndex={0}
      aria-label={`Puzzle piece ${piece.id}`}
    >
      <img
        src={piece.image}
        alt={`Puzzle piece ${piece.id}`}
        className="puzzle-piece__image"
        draggable={false}
      />
    </div>
  );
};

export default PuzzlePiece;
