import { useEffect, useCallback } from 'react';

interface KeyboardNavigationOptions {
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onAdd?: () => void;
  onRefresh?: () => void;
  onSave?: () => void;
  onDiscard?: () => void;
  enabled?: boolean;
}

export const useKeyboardNavigation = ({
  onSelectAll,
  onDeselectAll,
  onDelete,
  onEdit,
  onAdd,
  onRefresh,
  onSave,
  onDiscard,
  enabled = true
}: KeyboardNavigationOptions) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement || 
        e.target instanceof HTMLSelectElement) {
      return;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case 'a':
      case 'A':
        if (isCtrlOrCmd && onSelectAll) {
          e.preventDefault();
          onSelectAll();
        }
        break;
      
      case 'Escape':
        if (onDeselectAll) {
          e.preventDefault();
          onDeselectAll();
        }
        break;
      
      case 'Delete':
      case 'Backspace':
        if (onDelete && !isCtrlOrCmd) {
          e.preventDefault();
          onDelete();
        }
        break;
      
      case 'Enter':
        if (onEdit && !isCtrlOrCmd) {
          e.preventDefault();
          onEdit();
        }
        break;
      
      case 'n':
      case 'N':
        if (isCtrlOrCmd && onAdd) {
          e.preventDefault();
          onAdd();
        }
        break;
      
      case 'r':
      case 'R':
        if (isCtrlOrCmd && onRefresh) {
          e.preventDefault();
          onRefresh();
        }
        break;
      
      case 's':
      case 'S':
        if (isCtrlOrCmd && onSave) {
          e.preventDefault();
          onSave();
        }
        break;
      
      case 'z':
      case 'Z':
        if (isCtrlOrCmd && onDiscard) {
          e.preventDefault();
          onDiscard();
        }
        break;
    }
  }, [enabled, onSelectAll, onDeselectAll, onDelete, onEdit, onAdd, onRefresh, onSave, onDiscard]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
};
