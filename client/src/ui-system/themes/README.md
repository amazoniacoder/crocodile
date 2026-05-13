# BlogPro Theme System

## Overview

The BlogPro Theme System provides a comprehensive, universal theming solution that supports light, dark, and auto themes with seamless transitions and accessibility features.

## Features

- **Universal Theme Support**: Light, dark, and auto (system preference) themes
- **Smooth Transitions**: Animated theme switching with reduced motion support
- **Accessibility**: High contrast mode and color scheme support
- **Professional Color Palette**: Carefully crafted colors for optimal readability
- **CSS Custom Properties**: Modern CSS variables for dynamic theming
- **BEM Methodology**: Consistent naming conventions for theme components

## Usage

### Basic Setup

```tsx
import { ThemeProvider } from '@/ui-system/components/theme';

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="bp-theme">
      <YourApp />
    </ThemeProvider>
  );
}
```

### Theme Toggle Component

```tsx
import { ThemeToggle } from '@/ui-system/components/theme';

// Button variant (default)
<ThemeToggle />

// Switch variant
<ThemeToggle variant="switch" />

// Dropdown variant
<ThemeToggle variant="dropdown" showLabel />
```

### Using Theme Hook

```tsx
import { useTheme } from '@/ui-system/components/theme';

function MyComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {theme}</p>
      <p>Resolved theme: {resolvedTheme}</p>
      <button onClick={() => setTheme('dark')}>
        Switch to Dark
      </button>
    </div>
  );
}
```

## Theme Tokens

### Light Theme Colors

- **Text**: `--bp-text-primary`, `--bp-text-secondary`, `--bp-text-muted`
- **Backgrounds**: `--bp-bg-primary`, `--bp-bg-secondary`, `--bp-bg-alt`
- **Borders**: `--bp-border-color`, `--bp-border-hover`, `--bp-border-focus`
- **Components**: `--bp-card-bg`, `--bp-header-bg`, `--bp-input-bg`

### Dark Theme Colors

All light theme tokens are automatically overridden in dark mode with appropriate dark variants.

### Status Colors

- **Success**: `--bp-success-bg`, `--bp-success-text`, `--bp-success-border`
- **Error**: `--bp-error-bg`, `--bp-error-text`, `--bp-error-border`
- **Warning**: `--bp-warning-bg`, `--bp-warning-text`, `--bp-warning-border`
- **Info**: `--bp-info-bg`, `--bp-info-text`, `--bp-info-border`

## Auto Theme Support

The system automatically detects system color scheme preference:

```css
@media (prefers-color-scheme: dark) {
  :root:not(.light):not(.dark) {
    /* Auto dark theme variables */
  }
}
```

## Accessibility Features

### High Contrast Support

```css
@media (prefers-contrast: high) {
  :root {
    --bp-border-color: #000000;
    --bp-text-muted: var(--bp-text-secondary);
  }
}
```

### Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

## Theme Switching

The theme system prevents flashing during theme changes:

```css
.theme-switching * {
  transition: none !important;
}
```

## Integration with Legacy Styles

The theme system is designed to work alongside existing BlogPro styles while providing a migration path to the new design tokens.

## File Structure

```
themes/
├── index.css          # Main theme system entry
├── light.css          # Light theme tokens
├── dark.css           # Dark theme tokens
└── README.md          # This documentation

components/theme/
├── ThemeProvider.tsx  # Theme context provider
├── ThemeToggle.tsx    # Theme toggle component
├── theme.css          # Theme component styles
└── index.ts           # Theme exports
```

## Migration Notes

- Legacy theme toggle styles from `styles/blocks/theme-toggle/` have been migrated
- New BEM class names use `bp-theme-toggle` prefix
- All theme tokens use `--bp-` prefix for consistency
- Smooth integration with existing color variables