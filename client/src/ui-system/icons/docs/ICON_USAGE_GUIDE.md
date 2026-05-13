# BlogPro Icon Usage Guide

## 🎨 **Available Icons (29 total)**

### Actions (11)
`save` `edit` `delete` `add` `login` `logout` `x` `alert-circle` `heart` `reply` `thumbs-up` `flag`

### Navigation (5) 
`search` `hamburger` `house` `arrow-up` `arrow-down` `arrow-left` `arrow-right`

### Users (4)
`user` `users` `admin`

### Content (2)
`book` `image`

### Themes (2)
`sun` `moon`

### Tools (4)
`gear` `wrench` `phone` `mobile`

## 🚀 **Usage**

### React Component
```tsx
import { Icon } from '@blogpro/ui-system/icons/components';

<Icon name="save" size={20} />
<Icon name="edit" size={24} className="text-blue-500" />
```

### HTML Sprite
```html
<svg class="bp-icon" width="20" height="20">
  <use href="#bp-icon-save"></use>
</svg>
```

## 📏 **Sizes**
- **16px** - Inline text, compact buttons
- **20px** - Default UI elements  
- **24px** - Large actions, headers
- **32px** - Hero sections

## ♿ **Accessibility**
```tsx
// Decorative
<Icon name="save" size={16} aria-hidden="true" />

// Meaningful
<Icon name="alert-circle" size={20} aria-label="Warning" />

// Interactive
<button aria-label="Close">
  <Icon name="x" size={20} />
</button>
```

## 🔧 **Build Tools**
```bash
npm run build-icons  # Rebuild sprite
```