// Footer Visual Editor Types

// Block type union
export type FooterBlockType = 'brand' | 'links' | 'contact' | 'social' | 'newsletter' | 'custom';

/**
 * @zod-generate
 */
export interface FooterConfig {
  id?: number;
  version: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  
  layout: FooterLayout;
  blocks: FooterBlock[];
  styles: FooterStyles;
  responsive: ResponsiveConfig;
  visibility: VisibilityConfig;
}

export interface FooterLayout {
  type: 'grid' | 'flex' | 'columns';
  columns: number;
  gap: string;
  maxWidth: string;
}

export interface FooterBlock {
  id: string;
  type: FooterBlockType;
  order?: number;
  gridColumn?: string;
  gridRow?: string;
  position?: { x: number; y: number };
  size?: { width: string; height: string };
  content: BlockContent;
  styles: BlockStyles;
}

export interface BlockContent {
  // Common fields
  title?: string;
  
  // Brand block
  logo?: string;
  description?: string;
  
  // Links block
  links?: Array<{
    label: string;
    url: string;
    target?: '_blank' | '_self';
    icon?: string;
  }>;
  
  // Contact block
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  contactIcons?: {
    address?: string;
    phone?: string;
    email?: string;
    workingHours?: string;
  };
  
  // Social block
  socialLinks?: Array<{
    platform: string;
    url: string;
    icon: string;
  }>;
  
  // Newsletter block
  placeholder?: string;
  buttonText?: string;
  
  // Custom block
  html?: string;
  css?: string;
  text?: string;
}

// Utility to determine icon type
export const getIconType = (icon: string): 'system' | 'media' => {
  return icon.startsWith('/') ? 'media' : 'system';
};

export interface BlockStyles {
  // Block styles
  textAlign?: 'left' | 'center' | 'right';
  headingTextAlign?: 'left' | 'center' | 'right';
  color?: string;
  backgroundColor?: string; // Supports: hex, rgba, gradient, transparent
  background?: string; // CSS background property for gradients
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
  
  // Heading styles
  headingColor?: string;
  headingFontSize?: string;
  headingFontWeight?: string;
  headingFontFamily?: string;
  headingMargin?: string;
  
  // Content styles
  contentColor?: string;
  contentFontSize?: string;
  contentFontFamily?: string;
  linkColor?: string;
  contentGap?: string;
}

export interface FooterStyles {
  theme: 'light' | 'dark' | 'custom';
  backgroundColor: string;
  textColor: string;
  linkColor: string;
  borderColor: string;
  padding: string;
  margin: string;
  
  // Theme-specific backgrounds (gradients/colors per theme)
  themeBackgrounds?: {
    light?: string;
    dark?: string;
    custom?: string;
  };
}

export interface ResponsiveConfig {
  mobile?: Partial<FooterConfig>;
  tablet?: Partial<FooterConfig>;
}

export interface VisibilityConfig {
  showOnScroll: boolean;
  hideOnPages: string[];
  showOnlyOnPages: string[];
}

export interface FooterHistory {
  id: number;
  footerConfigId: number;
  config: FooterConfig;
  changeDescription: string;
  createdAt: string;
  createdBy: string;
}

// API Response types
export interface FooterConfigResponse {
  success: boolean;
  data: FooterConfig;
  message?: string;
}

export interface FooterConfigsResponse {
  success: boolean;
  data: FooterConfig[];
  message?: string;
}

export interface FooterHistoryResponse {
  success: boolean;
  data: FooterHistory[];
  message?: string;
}