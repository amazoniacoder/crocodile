# BlogPro Puzzle Captcha - Integration Guide

## 🚀 Quick Start

### 1. Basic Integration
```typescript
import { CaptchaButton } from '@/plugins/captcha';

const MyForm = () => {
  const [captchaToken, setCaptchaToken] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  return (
    <form>
      {/* Your form fields */}
      
      <div className="form-field">
        <label>Verification *</label>
        <CaptchaButton
          onSolved={(token) => {
            setCaptchaToken(token);
            setIsVerified(true);
          }}
          onError={(error) => console.error(error)}
        />
      </div>
      
      <button type="submit" disabled={!isVerified}>
        Submit
      </button>
    </form>
  );
};
```

### 2. Import Styles
The captcha automatically imports its styles, but ensure your main CSS includes:
```css
/* In your main.css or app.css */
@import '@/plugins/captcha/styles/captcha.css';
```

## 🎯 Integration Patterns

### Pattern 1: Contact Forms
```typescript
// ContactForm.tsx
import React, { useState } from 'react';
import { CaptchaButton } from '@/plugins/captcha';

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaSolved, setCaptchaSolved] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaSolved) {
      alert('Please complete the captcha verification');
      return;
    }

    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          captchaToken
        })
      });
      
      alert('Message sent successfully!');
    } catch (error) {
      alert('Failed to send message');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <div className="form-row">
        <input
          type="text"
          placeholder="Name"
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>
      
      <textarea
        placeholder="Message"
        value={formData.message}
        onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
        required
      />
      
      <div className="form-bottom">
        <div className="captcha-field">
          <label>Verification *</label>
          <CaptchaButton
            onSolved={(token) => {
              setCaptchaToken(token);
              setCaptchaSolved(true);
            }}
            onError={(error) => {
              console.error('Captcha error:', error);
              setCaptchaSolved(false);
              setCaptchaToken('');
            }}
            size="md"
          />
        </div>
        
        <button type="submit" disabled={!captchaSolved}>
          Send Message
        </button>
      </div>
    </form>
  );
};
```

### Pattern 2: Registration Forms
```typescript
// RegistrationForm.tsx
const RegistrationForm = () => {
  const [userData, setUserData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaVerified) {
      toast.error('Please complete the captcha verification');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userData,
          captchaToken
        })
      });

      if (response.ok) {
        toast.success('Registration successful!');
        router.push('/login');
      } else {
        toast.error('Registration failed');
      }
    } catch (error) {
      toast.error('Network error');
    }
  };

  return (
    <div className="registration-form">
      <h2>Create Account</h2>
      
      <form onSubmit={handleRegister}>
        <input
          type="text"
          placeholder="Username"
          value={userData.username}
          onChange={(e) => setUserData(prev => ({ ...prev, username: e.target.value }))}
          required
        />
        
        <input
          type="email"
          placeholder="Email"
          value={userData.email}
          onChange={(e) => setUserData(prev => ({ ...prev, email: e.target.value }))}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={userData.password}
          onChange={(e) => setUserData(prev => ({ ...prev, password: e.target.value }))}
          required
        />
        
        <div className="verification-section">
          <h3>Verify you're human</h3>
          <CaptchaButton
            onSolved={(token) => {
              setCaptchaToken(token);
              setCaptchaVerified(true);
            }}
            onError={(error) => {
              toast.error('Captcha verification failed');
              setCaptchaVerified(false);
            }}
            size="lg"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={!captchaVerified}
          className={`submit-btn ${captchaVerified ? 'enabled' : 'disabled'}`}
        >
          Create Account
        </button>
      </form>
    </div>
  );
};
```

### Pattern 3: Comment Systems
```typescript
// CommentForm.tsx
const CommentForm = ({ postId, onCommentAdded }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!captchaToken) {
      alert('Please complete the captcha');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: comment,
          captchaToken
        })
      });

      if (response.ok) {
        const newComment = await response.json();
        onCommentAdded(newComment);
        setComment('');
        setCaptchaToken('');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="comment-form">
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="Write your comment..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          required
        />
        
        <div className="comment-actions">
          <CaptchaButton
            onSolved={setCaptchaToken}
            onError={(error) => console.error(error)}
            size="sm"
          />
          
          <button 
            type="submit" 
            disabled={!captchaToken || isSubmitting}
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </form>
    </div>
  );
};
```

## 🎨 Styling Integration

### CSS Custom Properties
```css
/* Override default captcha colors */
:root {
  --captcha-primary: #your-brand-color;
  --captcha-success: #your-success-color;
  --captcha-error: #your-error-color;
}
```

### Custom Button Styling
```css
/* Custom captcha button styles */
.my-custom-captcha {
  --button-size: 50px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.my-custom-captcha:hover {
  transform: translateY(-2px);
}
```

### Form Layout Integration
```css
/* Integrate with your form styling */
.form-bottom {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.captcha-field {
  flex: 1;
}

.captcha-field label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.submit-btn {
  min-width: 140px;
  padding: 0.875rem 1.5rem;
}

.submit-btn.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .form-bottom {
    flex-direction: column;
    align-items: stretch;
  }
  
  .submit-btn {
    width: 100%;
    margin-top: 1rem;
  }
}
```

## 🔧 Advanced Configuration

### Custom Hook Usage
```typescript
// CustomCaptchaComponent.tsx
import { useCaptcha } from '@/plugins/captcha';

const CustomCaptchaComponent = () => {
  const { loading, error, generatePuzzle, validateSolution } = useCaptcha();
  const [puzzle, setPuzzle] = useState(null);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    generatePuzzle().then(setPuzzle);
  }, []);

  const handleValidation = async (pieceId, coordinates) => {
    if (!puzzle) return false;

    try {
      const result = await validateSolution({
        puzzleId: puzzle.id,
        pieceId,
        dropCoordinates: coordinates,
        sessionToken: puzzle.sessionToken
      });

      if (result.success) {
        setSolved(true);
        return true;
      }
      
      // Generate new puzzle on failure
      const newPuzzle = await generatePuzzle();
      setPuzzle(newPuzzle);
      return false;
    } catch (error) {
      console.error('Validation failed:', error);
      return false;
    }
  };

  if (loading) return <div>Loading puzzle...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!puzzle) return null;

  return (
    <div className="custom-captcha">
      {solved ? (
        <div className="success-state">
          ✅ Verification Complete
        </div>
      ) : (
        <PuzzleCanvas
          puzzleData={puzzle}
          onPieceDrop={handleValidation}
          className="my-puzzle"
        />
      )}
    </div>
  );
};
```

### Server-Side Integration
```typescript
// Backend validation (Node.js/Express example)
app.post('/api/contact', async (req, res) => {
  const { name, email, message, captchaToken } = req.body;

  // Validate captcha token
  try {
    const captchaValid = await validateCaptchaToken(captchaToken);
    
    if (!captchaValid) {
      return res.status(400).json({ 
        error: 'Invalid captcha verification' 
      });
    }

    // Process the form submission
    await processContactForm({ name, email, message });
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

async function validateCaptchaToken(token) {
  // Implement your server-side token validation
  // This could involve JWT verification, database lookup, etc.
  try {
    const decoded = jwt.verify(token, process.env.CAPTCHA_SECRET);
    return decoded && decoded.verified === true;
  } catch (error) {
    return false;
  }
}
```

## 🔄 State Management Integration

### Redux Integration
```typescript
// captchaSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface CaptchaState {
  tokens: Record<string, string>; // formId -> token
  verified: Record<string, boolean>; // formId -> verified
}

const captchaSlice = createSlice({
  name: 'captcha',
  initialState: {
    tokens: {},
    verified: {}
  } as CaptchaState,
  reducers: {
    setCaptchaToken: (state, action: PayloadAction<{formId: string, token: string}>) => {
      state.tokens[action.payload.formId] = action.payload.token;
      state.verified[action.payload.formId] = true;
    },
    clearCaptcha: (state, action: PayloadAction<string>) => {
      delete state.tokens[action.payload];
      delete state.verified[action.payload];
    }
  }
});

// Component usage
const FormWithRedux = () => {
  const dispatch = useDispatch();
  const isVerified = useSelector(state => state.captcha.verified['contact-form']);

  return (
    <form>
      {/* form fields */}
      
      <CaptchaButton
        onSolved={(token) => {
          dispatch(setCaptchaToken({ formId: 'contact-form', token }));
        }}
        onError={(error) => {
          dispatch(clearCaptcha('contact-form'));
        }}
      />
      
      <button type="submit" disabled={!isVerified}>
        Submit
      </button>
    </form>
  );
};
```

### Context Integration
```typescript
// CaptchaContext.tsx
const CaptchaContext = createContext({});

export const CaptchaProvider = ({ children }) => {
  const [verifications, setVerifications] = useState({});

  const setVerified = (formId, token) => {
    setVerifications(prev => ({
      ...prev,
      [formId]: { verified: true, token, timestamp: Date.now() }
    }));
  };

  const clearVerification = (formId) => {
    setVerifications(prev => {
      const { [formId]: removed, ...rest } = prev;
      return rest;
    });
  };

  return (
    <CaptchaContext.Provider value={{
      verifications,
      setVerified,
      clearVerification
    }}>
      {children}
    </CaptchaContext.Provider>
  );
};

// Usage in component
const FormWithContext = () => {
  const { verifications, setVerified } = useContext(CaptchaContext);
  const isVerified = verifications['my-form']?.verified || false;

  return (
    <form>
      <CaptchaButton
        onSolved={(token) => setVerified('my-form', token)}
        onError={() => console.error('Captcha failed')}
      />
      
      <button type="submit" disabled={!isVerified}>
        Submit
      </button>
    </form>
  );
};
```

## 🧪 Testing Integration

### Jest Testing
```typescript
// CaptchaButton.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CaptchaButton } from '@/plugins/captcha';

describe('CaptchaButton', () => {
  it('renders puzzle icon initially', () => {
    render(
      <CaptchaButton
        onSolved={jest.fn()}
        onError={jest.fn()}
      />
    );
    
    expect(screen.getByRole('button')).toHaveTextContent('🧩');
  });

  it('opens modal on click', async () => {
    render(
      <CaptchaButton
        onSolved={jest.fn()}
        onError={jest.fn()}
      />
    );
    
    fireEvent.click(screen.getByRole('button'));
    
    await waitFor(() => {
      expect(screen.getByText('Complete the puzzle')).toBeInTheDocument();
    });
  });

  it('calls onSolved when puzzle is completed', async () => {
    const onSolved = jest.fn();
    
    render(
      <CaptchaButton
        onSolved={onSolved}
        onError={jest.fn()}
      />
    );
    
    // Simulate puzzle completion
    // ... test implementation
    
    await waitFor(() => {
      expect(onSolved).toHaveBeenCalledWith(expect.any(String));
    });
  });
});
```

### Cypress E2E Testing
```typescript
// captcha.cy.ts
describe('Captcha Integration', () => {
  it('completes contact form with captcha', () => {
    cy.visit('/contact');
    
    // Fill form
    cy.get('[data-testid="name-input"]').type('John Doe');
    cy.get('[data-testid="email-input"]').type('john@example.com');
    cy.get('[data-testid="message-input"]').type('Test message');
    
    // Open captcha
    cy.get('[data-testid="captcha-button"]').click();
    
    // Complete puzzle (mock or actual interaction)
    cy.get('[data-testid="puzzle-piece-correct"]').drag('[data-testid="puzzle-drop-area"]');
    
    // Verify success
    cy.get('[data-testid="captcha-button"]').should('contain', '✅');
    
    // Submit form
    cy.get('[data-testid="submit-button"]').should('not.be.disabled');
    cy.get('[data-testid="submit-button"]').click();
    
    // Verify submission
    cy.get('[data-testid="success-message"]').should('be.visible');
  });
});
```

## 🚨 Error Handling Patterns

### Comprehensive Error Handling
```typescript
const RobustForm = () => {
  const [captchaState, setCaptchaState] = useState({
    verified: false,
    token: '',
    error: null,
    attempts: 0
  });

  const handleCaptchaSolved = (token) => {
    setCaptchaState({
      verified: true,
      token,
      error: null,
      attempts: 0
    });
  };

  const handleCaptchaError = (error) => {
    setCaptchaState(prev => ({
      ...prev,
      verified: false,
      token: '',
      error,
      attempts: prev.attempts + 1
    }));

    // Show user-friendly error messages
    if (captchaState.attempts >= 2) {
      toast.error('Having trouble with the captcha? Please refresh the page and try again.');
    } else {
      toast.error('Captcha verification failed. Please try again.');
    }
  };

  return (
    <form>
      {/* form fields */}
      
      <div className="captcha-section">
        <CaptchaButton
          onSolved={handleCaptchaSolved}
          onError={handleCaptchaError}
          disabled={captchaState.attempts >= 3}
        />
        
        {captchaState.error && (
          <div className="error-message">
            {captchaState.error}
          </div>
        )}
        
        {captchaState.attempts >= 3 && (
          <div className="max-attempts-message">
            Too many failed attempts. Please refresh the page.
          </div>
        )}
      </div>
      
      <button 
        type="submit" 
        disabled={!captchaState.verified || captchaState.attempts >= 3}
      >
        Submit
      </button>
    </form>
  );
};
```

---

**This integration guide provides comprehensive examples for implementing the BlogPro Puzzle Captcha in various scenarios and frameworks.** 🔧✨