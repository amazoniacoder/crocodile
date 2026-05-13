/**
 * Utility to handle header shrinking on scroll and expanding on hover
 */
export const setupHeaderScroll = () => {
  const header = document.querySelector('.header') as HTMLElement;
  
  if (!header) return () => {};
  
  let isScrolled = false;
  let isHovering = false;
  
  const handleScroll = () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 50) {
      isScrolled = true;
      if (!isHovering) {
        header.classList.add('header--scrolled');
      }
    } else {
      isScrolled = false;
      header.classList.remove('header--scrolled');
    }
  };
  
  const handleMouseEnter = () => {
    isHovering = true;
    if (isScrolled) {
      header.classList.remove('header--scrolled');
    }
  };
  
  const handleMouseLeave = () => {
    isHovering = false;
    if (isScrolled) {
      header.classList.add('header--scrolled');
    }
  };
  
  // Close mobile menu when clicking outside
  const handleClickOutside = (event: MouseEvent) => {
    const nav = document.querySelector('.header__nav') as HTMLElement;
    const hamburger = document.querySelector('.header__hamburger') as HTMLElement;
    
    if (nav && nav.classList.contains('header__nav--open')) {
      if (!nav.contains(event.target as Node) && 
          !hamburger.contains(event.target as Node)) {
        // Find the button that has the click handler
        const mobileMenuButton = document.querySelector('.header__hamburger');
        if (mobileMenuButton) {
          (mobileMenuButton as HTMLElement).click();
        }
      }
    }
  };
  
  // Initial check in case page is loaded scrolled down
  handleScroll();
  
  // Add event listeners
  window.addEventListener('scroll', handleScroll, { passive: true });
  header.addEventListener('mouseenter', handleMouseEnter);
  header.addEventListener('mouseleave', handleMouseLeave);
  document.addEventListener('mousedown', handleClickOutside);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('scroll', handleScroll);
    header.removeEventListener('mouseenter', handleMouseEnter);
    header.removeEventListener('mouseleave', handleMouseLeave);
    document.removeEventListener('mousedown', handleClickOutside);
  };
};
