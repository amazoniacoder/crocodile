import { useRef, useEffect, type DependencyList } from 'react';

/**
 * Горизонтальный drag-scroll зажатой ЛКМ (и одним пальцем на touch).
 * Дельта от точки нажатия — без «улучшателей» offsetLeft.
 *
 * Передайте `deps`, когда узел появляется позже первого рендера (условный mount),
 * иначе эффект один раз увидит ref=null и слушатели не повесятся.
 */
export function useDragScroll<T extends HTMLElement>(deps: DependencyList = []) {
  const ref = useRef<T>(null);
  const isDragging = useRef(false);
  const startPageX = useRef(0);
  const startScrollLeft = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      startPageX.current = e.pageX;
      startScrollLeft.current = el.scrollLeft;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      if ((e.buttons & 1) === 0) {
        isDragging.current = false;
        el.style.cursor = 'grab';
        el.style.userSelect = '';
        return;
      }
      e.preventDefault();
      el.scrollLeft = startScrollLeft.current - (e.pageX - startPageX.current);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      el.style.cursor = 'grab';
      el.style.userSelect = '';
    };

    const preventSelect = (e: Event) => {
      if (isDragging.current) e.preventDefault();
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      isDragging.current = true;
      startPageX.current = e.touches[0].pageX;
      startScrollLeft.current = el.scrollLeft;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current || e.touches.length !== 1) return;
      el.scrollLeft = startScrollLeft.current - (e.touches[0].pageX - startPageX.current);
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
    };

    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectstart', preventSelect);

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: true });
    el.addEventListener('touchend', handleTouchEnd);

    return () => {
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectstart', preventSelect);

      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
    };
  }, deps);

  return ref;
}
