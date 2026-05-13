// Enhanced Footer Content Types - Strict TypeScript definitions

export interface LinkItem {
  title: string;
  url: string;
  target?: '_self' | '_blank';
  rel?: string;
  ariaLabel?: string;
}

export interface ImageItem {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

export interface SocialItem {
  platform: 'facebook' | 'twitter' | 'instagram' | 'linkedin' | 'youtube' | 'github' | 'telegram';
  url: string;
  icon: string;
  ariaLabel?: string;
}

export interface ContactItem {
  type: 'phone' | 'email' | 'address' | 'website';
  value: string;
  label?: string;
  icon?: string;
}

export interface NewsletterConfig {
  title?: string;
  description?: string;
  placeholder?: string;
  buttonText?: string;
  successMessage?: string;
  errorMessage?: string;
  privacyText?: string;
  privacyLink?: string;
}

// Block-specific content interfaces
export interface BrandBlockContent {
  text?: string;
  description?: string;
  image?: ImageItem;
  links?: LinkItem[];
}

export interface LinksBlockContent {
  title?: string;
  links: LinkItem[];
  showTitle?: boolean;
}

export interface ContactBlockContent {
  title?: string;
  contacts: ContactItem[];
  showTitle?: boolean;
}

export interface SocialBlockContent {
  title?: string;
  social: SocialItem[];
  showTitle?: boolean;
  layout?: 'horizontal' | 'vertical' | 'grid';
}

export interface NewsletterBlockContent {
  config: NewsletterConfig;
  gdprCompliant?: boolean;
}

export interface CustomBlockContent {
  html?: string;
  css?: string;
  javascript?: string; // Sanitized and restricted
}

// Union type for all block content types
export type BlockContent = 
  | BrandBlockContent
  | LinksBlockContent  
  | ContactBlockContent
  | SocialBlockContent
  | NewsletterBlockContent
  | CustomBlockContent;

// Responsive settings with strict typing
export interface ResponsiveSettings {
  columns?: number;
  fontSize?: string;
  padding?: string;
  margin?: string;
  gap?: string;
  display?: 'block' | 'flex' | 'grid' | 'none';
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
}

export interface ResponsiveConfig {
  mobile?: ResponsiveSettings;
  tablet?: ResponsiveSettings;
  desktop?: ResponsiveSettings;
}

// Layout configuration with strict typing
export interface LayoutConfig {
  type: 'grid' | 'flex' | 'columns';
  columns: number;
  gap: string;
  maxWidth: string;
  minHeight?: string;
  padding?: string;
  margin?: string;
}

// Style configuration with strict typing
export interface StyleConfig {
  theme: 'light' | 'dark' | 'custom';
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  borderColor: string;
  padding: string;
  margin: string;
  borderRadius?: string;
  boxShadow?: string;
  fontFamily?: string;
  fontSize?: string;
  lineHeight?: string;
}

// Visibility configuration
export interface VisibilityConfig {
  showOnScroll: boolean;
  hideOnPages: string[];
  showOnlyOnPages: string[];
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
  hideOnDesktop?: boolean;
}

// Animation configuration
export interface AnimationConfig {
  enabled: boolean;
  type?: 'fade' | 'slide' | 'bounce' | 'none';
  duration?: number;
  delay?: number;
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear';
}

// SEO configuration
export interface SEOConfig {
  structured?: boolean;
  microdata?: Record<string, any>;
  jsonLd?: Record<string, any>;
}

// Performance configuration
export interface PerformanceConfig {
  lazyLoad?: boolean;
  preload?: string[];
  critical?: boolean;
}

// Enhanced Footer Block with strict typing
export interface StrictFooterBlock {
  id: string;
  type: 'brand' | 'links' | 'contact' | 'social' | 'newsletter' | 'custom';
  position: { x: number; y: number };
  size: { width: string; height: string };
  content: BlockContent;
  styles: Record<string, string>;
  responsive?: ResponsiveConfig;
  animation?: AnimationConfig;
  visibility?: Partial<VisibilityConfig>;
  order?: number;
  locked?: boolean;
  version?: number;
}

// Enhanced Footer Configuration with strict typing
export interface StrictFooterConfig {
  id?: number;
  version: number;
  isActive: boolean;
  layout: LayoutConfig;
  blocks: StrictFooterBlock[];
  styles: StyleConfig;
  responsive: ResponsiveConfig;
  visibility: VisibilityConfig;
  animation?: AnimationConfig;
  seo?: SEOConfig;
  performance?: PerformanceConfig;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

// Type guards for runtime type checking
export const isLinkItem = (item: any): item is LinkItem => {
  return typeof item === 'object' && 
         typeof item.title === 'string' && 
         typeof item.url === 'string';
};

export const isImageItem = (item: any): item is ImageItem => {
  return typeof item === 'object' && 
         typeof item.src === 'string' && 
         typeof item.alt === 'string';
};

export const isSocialItem = (item: any): item is SocialItem => {
  const validPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'github', 'telegram'];
  return typeof item === 'object' && 
         typeof item.platform === 'string' && 
         validPlatforms.includes(item.platform) &&
         typeof item.url === 'string';
};

export const isContactItem = (item: any): item is ContactItem => {
  const validTypes = ['phone', 'email', 'address', 'website'];
  return typeof item === 'object' && 
         typeof item.type === 'string' && 
         validTypes.includes(item.type) &&
         typeof item.value === 'string';
};

// Block content type guards
export const isBrandBlockContent = (content: any): content is BrandBlockContent => {
  return typeof content === 'object' && 
         (content.text === undefined || typeof content.text === 'string') &&
         (content.image === undefined || isImageItem(content.image));
};

export const isLinksBlockContent = (content: any): content is LinksBlockContent => {
  return typeof content === 'object' && 
         Array.isArray(content.links) &&
         content.links.every(isLinkItem);
};

export const isContactBlockContent = (content: any): content is ContactBlockContent => {
  return typeof content === 'object' && 
         Array.isArray(content.contacts) &&
         content.contacts.every(isContactItem);
};

export const isSocialBlockContent = (content: any): content is SocialBlockContent => {
  return typeof content === 'object' && 
         Array.isArray(content.social) &&
         content.social.every(isSocialItem);
};

// Utility types for form handling
export type BlockContentByType<T extends StrictFooterBlock['type']> = 
  T extends 'brand' ? BrandBlockContent :
  T extends 'links' ? LinksBlockContent :
  T extends 'contact' ? ContactBlockContent :
  T extends 'social' ? SocialBlockContent :
  T extends 'newsletter' ? NewsletterBlockContent :
  T extends 'custom' ? CustomBlockContent :
  never;

