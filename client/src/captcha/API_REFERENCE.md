# BlogPro Puzzle Captcha - API Reference

## 🔌 Plugin Exports

### Main Exports
```typescript
// Main component export
export { CaptchaButton } from './components/CaptchaButton';

// Hook export
export { useCaptcha } from './hooks/useCaptcha';

// Type exports
export type {
  CaptchaConfig,
  CaptchaButtonProps,
  PuzzleData,
  CaptchaResponse
} from './types';
```

## 🧩 Components

### CaptchaButton
**Primary component for integrating puzzle captcha into forms.**

```typescript
interface CaptchaButtonProps {
  onSolved: (token: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
```

#### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onSolved` | `(token: string) => void` | ✅ | Callback when puzzle is successfully solved |
| `onError` | `(error: string) => void` | ✅ | Callback when validation fails |
| `disabled` | `boolean` | ❌ | Disables the button interaction |
| `size` | `'sm' \| 'md' \| 'lg'` | ❌ | Button size variant (default: 'md') |
| `className` | `string` | ❌ | Additional CSS classes |

#### Usage Examples
```typescript
// Basic usage
<CaptchaButton
  onSolved={(token) => setCaptchaToken(token)}
  onError={(error) => console.error(error)}
/>

// With size and styling
<CaptchaButton
  onSolved={handleSolved}
  onError={handleError}
  size="lg"
  className="my-custom-class"
  disabled={loading}
/>
```

## 🪝 Hooks

### useCaptcha
**Core hook providing captcha functionality.**

```typescript
const {
  loading,
  error,
  generatePuzzle,
  validateSolution
} = useCaptcha();
```

#### Return Values
| Property | Type | Description |
|----------|------|-------------|
| `loading` | `boolean` | Current loading state |
| `error` | `string \| null` | Current error message |
| `generatePuzzle` | `() => Promise<PuzzleData>` | Generates new puzzle |
| `validateSolution` | `(request: ValidationRequest) => Promise<CaptchaResponse>` | Validates puzzle solution |

#### Usage Example
```typescript
const MyCustomCaptcha = () => {
  const { loading, error, generatePuzzle, validateSolution } = useCaptcha();
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);

  useEffect(() => {
    generatePuzzle().then(setPuzzle);
  }, []);

  const handleDrop = async (pieceId: string, coords: Point) => {
    const result = await validateSolution({
      puzzleId: puzzle!.id,
      pieceId,
      dropCoordinates: coords,
      sessionToken: puzzle!.sessionToken
    });
    
    return result.success;
  };

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      {puzzle && <PuzzleCanvas puzzleData={puzzle} onPieceDrop={handleDrop} />}
    </div>
  );
};
```

## 📝 Type Definitions

### Core Types

#### PuzzleData
```typescript
interface PuzzleData {
  id: string;                    // Unique puzzle identifier
  puzzleImage: string;           // Base64 encoded puzzle SVG
  pieces: PuzzlePiece[];         // Array of draggable pieces
  correctPieceId: string;        // ID of the correct piece
  missingArea: Rectangle;        // Coordinates of missing area
  sessionToken: string;          // Session validation token
}
```

#### PuzzlePiece
```typescript
interface PuzzlePiece {
  id: string;                    // Unique piece identifier
  image: string;                 // Base64 encoded piece SVG
  isCorrect: boolean;            // Whether this is the correct piece
  shape: ShapeData;              // Shape information
  originalPosition: Point;       // Original position coordinates
}
```

#### ValidationRequest
```typescript
interface ValidationRequest {
  puzzleId: string;              // Puzzle identifier
  pieceId: string;               // Piece being validated
  dropCoordinates: Point;        // Where piece was dropped
  sessionToken: string;          // Session token for security
}
```

#### CaptchaResponse
```typescript
interface CaptchaResponse {
  success: boolean;              // Whether validation succeeded
  token?: string;                // JWT token for form submission
  error?: string;                // Error message if failed
}
```

### Utility Types

#### Point
```typescript
interface Point {
  x: number;                     // X coordinate
  y: number;                     // Y coordinate
}
```

#### Rectangle
```typescript
interface Rectangle {
  x: number;                     // X position
  y: number;                     // Y position
  width: number;                 // Width dimension
  height: number;                // Height dimension
}
```

#### ShapeData
```typescript
interface ShapeData {
  type: 'polygon' | 'circle' | 'rectangle' | 'triangle';
  points?: Point[];              // For polygon shapes
  radius?: number;               // For circle shapes
  width?: number;                // For rectangle shapes
  height?: number;               // For rectangle shapes
}
```

## 🎛️ Configuration

### CaptchaConfig
```typescript
interface CaptchaConfig {
  apiEndpoint?: string;          // Custom API endpoint
  timeout?: number;              // Request timeout in ms
  maxAttempts?: number;          // Maximum validation attempts
  difficulty?: 'easy' | 'medium' | 'hard';  // Puzzle difficulty
}
```

#### Default Configuration
```typescript
const defaultConfig: CaptchaConfig = {
  apiEndpoint: '/api/captcha',
  timeout: 5000,
  maxAttempts: 3,
  difficulty: 'medium'
};
```

## 🔄 State Management

### Validation States
```typescript
type ValidationState = 'idle' | 'validating' | 'success' | 'error';
```

#### State Transitions
```
idle → validating → success → idle (auto-close)
idle → validating → error → idle (new puzzle)
```

### Button States
```typescript
type ButtonState = 'unsolved' | 'solved' | 'disabled';
```

## 🎨 CSS Classes

### Component Classes
```css
/* Button */
.captcha-button                    /* Base button */
.captcha-button--sm               /* Small size */
.captcha-button--md               /* Medium size */
.captcha-button--lg               /* Large size */
.captcha-button--unsolved         /* Unsolved state */
.captcha-button--solved           /* Solved state */
.captcha-button--disabled         /* Disabled state */

/* Modal */
.captcha-modal-overlay            /* Modal backdrop */
.captcha-modal                    /* Modal container */
.captcha-modal__header            /* Modal header */
.captcha-modal__content           /* Modal content */
.captcha-modal__close             /* Close button */

/* Puzzle Canvas */
.puzzle-canvas                    /* Main container */
.puzzle-canvas__status            /* Status indicator */
.puzzle-canvas__status--validating /* Loading state */
.puzzle-canvas__status--success   /* Success state */
.puzzle-canvas__status--error     /* Error state */
.puzzle-canvas__main              /* Puzzle area */
.puzzle-canvas__main--drag-over   /* Drag over state */
.puzzle-canvas__pieces            /* Pieces container */

/* Puzzle Pieces */
.puzzle-piece                     /* Individual piece */
.puzzle-piece--dragging           /* Dragging state */
.puzzle-piece__image              /* Piece image */
```

### CSS Custom Properties
```css
:root {
  --captcha-primary: #3b82f6;
  --captcha-success: #10b981;
  --captcha-error: #ef4444;
  --captcha-border: #e5e7eb;
  --captcha-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
```

## 🔧 Advanced Usage

### Custom Validation
```typescript
const customValidation = async (request: ValidationRequest): Promise<boolean> => {
  // Custom server call
  const response = await fetch('/my-api/validate-captcha', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  
  const result = await response.json();
  return result.success;
};

// Use with PuzzleCanvas
<PuzzleCanvas
  puzzleData={puzzle}
  onPieceDrop={async (pieceId, coords) => {
    return await customValidation({
      puzzleId: puzzle.id,
      pieceId,
      dropCoordinates: coords,
      sessionToken: puzzle.sessionToken
    });
  }}
/>
```

### Form Integration Pattern
```typescript
const ContactForm = () => {
  const [formData, setFormData] = useState({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaSolved, setCaptchaSolved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaSolved) {
      alert('Please complete the captcha');
      return;
    }

    // Submit form with captcha token
    await submitForm({ ...formData, captchaToken });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      
      <div className="form-field">
        <label>Verification *</label>
        <CaptchaButton
          onSolved={(token) => {
            setCaptchaToken(token);
            setCaptchaSolved(true);
          }}
          onError={(error) => {
            console.error('Captcha error:', error);
            setCaptchaSolved(false);
          }}
        />
      </div>
      
      <button type="submit" disabled={!captchaSolved}>
        Submit Form
      </button>
    </form>
  );
};
```

## 🚨 Error Handling

### Error Types
```typescript
type CaptchaError = 
  | 'PUZZLE_GENERATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'INVALID_TOKEN';
```

### Error Handling Pattern
```typescript
<CaptchaButton
  onError={(error) => {
    switch (error) {
      case 'NETWORK_ERROR':
        showNotification('Network error. Please try again.');
        break;
      case 'TIMEOUT_ERROR':
        showNotification('Request timed out. Please try again.');
        break;
      default:
        showNotification('Captcha validation failed.');
    }
  }}
  onSolved={(token) => {
    // Handle success
  }}
/>
```

---

**This API reference provides complete documentation for integrating and customizing the BlogPro Puzzle Captcha system.** 📚✨