/**
 * BlogPro Captcha Hook
 * Main hook for captcha functionality
 */

import { useState, useCallback } from 'react';
import { PuzzleData, ValidationRequest, CaptchaResponse } from '../types';

export const useCaptcha = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPuzzle, setCurrentPuzzle] = useState<PuzzleData | null>(null);

  const generatePuzzle = useCallback(async (): Promise<PuzzleData> => {
    setLoading(true);
    setError(null);

    try {
      // For now, return mock data until backend is implemented
      const puzzleVariant = Math.floor(Math.random() * 3);
      const pieces = generateMockPieces(puzzleVariant);
      const correctPiece = pieces.find(p => p.isCorrect);
      
      const mockPuzzleData: PuzzleData = {
        id: `puzzle_${Date.now()}`,
        puzzleImage: generateMockPuzzleImage(puzzleVariant),
        pieces,
        correctPieceId: correctPiece?.id || 'piece_1',
        missingArea: generateMissingArea(puzzleVariant),
        sessionToken: `session_${Date.now()}`
      };

      setCurrentPuzzle(mockPuzzleData);
      return mockPuzzleData;
    } catch (err) {
      const errorMessage = 'Failed to generate puzzle';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const validateSolution = useCallback(async (request: ValidationRequest): Promise<CaptchaResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Mock validation - find the correct piece and check drop area
      const correctPiece = currentPuzzle?.pieces.find(p => p.isCorrect);
      const isCorrectPiece = request.pieceId === correctPiece?.id;
      
      // Check if dropped in the missing area
      const missingArea = currentPuzzle?.missingArea || { x: 75, y: 50, width: 50, height: 40 };
      const isInCorrectArea = 
        request.dropCoordinates.x >= missingArea.x && 
        request.dropCoordinates.x <= missingArea.x + missingArea.width &&
        request.dropCoordinates.y >= missingArea.y && 
        request.dropCoordinates.y <= missingArea.y + missingArea.height;

      // Debug logging
      console.log('🔍 Validation Debug:', {
        pieceId: request.pieceId,
        correctPieceId: correctPiece?.id,
        isCorrectPiece,
        dropCoords: request.dropCoordinates,
        missingArea,
        isInCorrectArea,
        pieces: currentPuzzle?.pieces.map(p => ({ id: p.id, isCorrect: p.isCorrect, type: p.shape.type }))
      });

      const success = isCorrectPiece && isInCorrectArea;

      return {
        success,
        token: success ? `captcha_token_${Date.now()}` : undefined,
        error: success ? undefined : 'Incorrect piece placement'
      };
    } catch (err) {
      const errorMessage = 'Validation failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currentPuzzle]);

  return {
    loading,
    error,
    generatePuzzle,
    validateSolution
  };
};

// Mock data generators (temporary until backend is ready)
const generateMockPuzzleImage = (puzzleVariant: number): string => {
  
  let svg = '';
  
  switch (puzzleVariant) {
    case 0: // Circle pattern
      svg = `
        <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
          <polygon points="40,30 70,30 55,60" fill="none" stroke="#333" stroke-width="2"/>
          <rect x="125" y="25" width="50" height="50" fill="none" stroke="#333" stroke-width="2"/>
          <polygon points="25,100 75,100 50,125" fill="none" stroke="#333" stroke-width="2"/>
          <circle cx="100" cy="75" r="20" fill="none" stroke="#dc3545" stroke-width="2" stroke-dasharray="5,5"/>
        </svg>
      `;
      break;
    case 1: // Triangle pattern
      svg = `
        <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
          <circle cx="50" cy="45" r="20" fill="none" stroke="#333" stroke-width="2"/>
          <circle cx="150" cy="45" r="20" fill="none" stroke="#333" stroke-width="2"/>
          <rect x="30" y="90" width="40" height="30" fill="none" stroke="#333" stroke-width="2"/>
          <polygon points="120,80 150,80 135,110" fill="none" stroke="#dc3545" stroke-width="2" stroke-dasharray="5,5"/>
        </svg>
      `;
      break;
    case 2: // Rectangle pattern
      svg = `
        <svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="150" fill="#f8f9fa" stroke="#dee2e6" stroke-width="2"/>
          <circle cx="45" cy="45" r="20" fill="none" stroke="#333" stroke-width="2"/>
          <polygon points="130,20 160,20 145,50" fill="none" stroke="#333" stroke-width="2"/>
          <polygon points="25,100 75,100 50,125" fill="none" stroke="#333" stroke-width="2"/>
          <rect x="120" y="85" width="35" height="25" fill="none" stroke="#dc3545" stroke-width="2" stroke-dasharray="5,5"/>
        </svg>
      `;
      break;
  }
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const generateMockPieces = (puzzleVariant: number) => {
  const shapeTypes = ['circle', 'triangle', 'rectangle'] as const;
  const correctShapeType = shapeTypes[puzzleVariant]; // Match puzzle variant
  
  const pieces = [
    {
      id: 'piece_1',
      image: generateMockPieceImage(correctShapeType),
      isCorrect: true,
      shape: { type: correctShapeType },
      originalPosition: { x: 0, y: 0 }
    },
    {
      id: 'piece_2', 
      image: generateMockPieceImage(shapeTypes[(puzzleVariant + 1) % 3]),
      isCorrect: false,
      shape: { type: shapeTypes[(puzzleVariant + 1) % 3] },
      originalPosition: { x: 60, y: 0 }
    },
    {
      id: 'piece_3',
      image: generateMockPieceImage(shapeTypes[(puzzleVariant + 2) % 3]),
      isCorrect: false,
      shape: { type: shapeTypes[(puzzleVariant + 2) % 3] },
      originalPosition: { x: 120, y: 0 }
    }
  ];

  // Shuffle pieces array to randomize positions
  return pieces.sort(() => Math.random() - 0.5);
};

const generateMockPieceImage = (shapeType: string): string => {
  const size = 40;
  let svg = '';
  
  switch (shapeType) {
    case 'circle':
      svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="none" stroke="#333" stroke-width="2"/>
        </svg>
      `;
      break;
    case 'triangle':
      svg = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <polygon points="4,4 ${size-4},4 ${size/2},${size-4}" fill="none" stroke="#333" stroke-width="2"/>
        </svg>
      `;
      break;
    case 'rectangle':
      svg = `
        <svg width="${size}" height="${size * 0.7}" xmlns="http://www.w3.org/2000/svg">
          <rect x="2" y="2" width="${size-4}" height="${size * 0.7 - 4}" fill="none" stroke="#333" stroke-width="2"/>
        </svg>
      `;
      break;
  }
  
  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

const generateMissingArea = (puzzleVariant: number) => {
  const variants = [
    { x: 80, y: 55, width: 40, height: 40 },   // Circle at cx="100" cy="75" r="20"
    { x: 120, y: 80, width: 30, height: 30 },  // Triangle at points="120,80 150,80 135,110"
    { x: 120, y: 85, width: 35, height: 25 }   // Rectangle at x="120" y="85" width="35" height="25"
  ];
  
  return variants[puzzleVariant];
};
