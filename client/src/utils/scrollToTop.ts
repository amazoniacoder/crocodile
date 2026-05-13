/**
 * Utility to smoothly scroll to the top of the page
 */
export const scrollToTop = (smooth = true) => {
  window.scrollTo({
    top: 0,
    behavior: smooth ? 'smooth' : 'auto'
  });
};

/**
 * Hook to automatically scroll to top when a component mounts
 */
export const useScrollToTop = () => {
  // Execute on component mount
  scrollToTop();
};
