// shared/types/menu.ts
export interface MenuItem {
  id: number;
  title: string;
  url?: string;
  parent_id?: number;
  order_index: number;
  is_active: boolean;
  target: '_self' | '_blank';
  icon?: string;
  type: 'manual' | 'documentation' | 'category';
  created_at: string;
  updated_at: string;
  children?: MenuItem[];
  level?: number;
}

export interface CreateMenuItemRequest {
  title: string;
  url?: string;
  parent_id?: number;
  order_index?: number;
  is_active?: boolean;
  target?: '_self' | '_blank';
  icon?: string;
  type?: 'manual' | 'documentation' | 'category';
}

export interface UpdateMenuItemRequest {
  title?: string;
  url?: string;
  parent_id?: number;
  order_index?: number;
  is_active?: boolean;
  target?: '_self' | '_blank';
  icon?: string;
  type?: 'manual' | 'documentation' | 'category';
}

export interface ReorderMenuRequest {
  items: {
    id: number;
    order_index: number;
    parent_id?: number;
  }[];
}