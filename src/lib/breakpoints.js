/**
 * Centralized responsive layout breakpoints & viewport helpers for FocusFlow.
 * Standardized across Tailwind configuration and runtime JavaScript.
 */

export const BREAKPOINTS = {
  MOBILE_MAX: 767,
  TABLET: 768,    // Tailwind md:
  DESKTOP: 1024,  // Tailwind lg:
  BOTTOM_DRAWER_MAX: 639, // Tailwind sm: threshold (640px)
  DRAWER_WIDTH: 420,
  DRAWER_MARGIN: 12,
  DRAWER_PAIR_TOTAL_WIDTH: 864, // 420 + 12 + 420 + 12
  MIN_PROJECT_CONTENT_WIDTH: 480,
  SIDE_BY_SIDE_MIN: 1344, // 864 + 480
};

export const SIDEBAR_STORAGE_KEY = 'focusflow_sidebar_desktop_collapsed';

/**
 * Checks whether the available content width is sufficient to render two 420px drawers side-by-side
 * while preserving the minimum project content width (480px).
 * @param {number} availableWidth - Available width of the main content area (everything without sidebar) in pixels
 * @returns {boolean}
 */
export function canFitDrawersSideBySide(availableWidth) {
  return typeof availableWidth === 'number' && availableWidth >= BREAKPOINTS.SIDE_BY_SIDE_MIN;
}

/**
 * Checks whether the given viewport width is considered desktop.
 * @param {number} width - Viewport width in pixels
 * @returns {boolean}
 */
export function isDesktopViewport(width) {
  return typeof width === 'number' && width >= BREAKPOINTS.DESKTOP;
}

/**
 * Checks whether the given viewport width is considered tablet.
 * @param {number} width - Viewport width in pixels
 * @returns {boolean}
 */
export function isTabletViewport(width) {
  return typeof width === 'number' && width >= BREAKPOINTS.TABLET && width < BREAKPOINTS.DESKTOP;
}

/**
 * Checks whether the given viewport width is considered mobile.
 * @param {number} width - Viewport width in pixels
 * @returns {boolean}
 */
export function isMobileViewport(width) {
  return typeof width === 'number' && width < BREAKPOINTS.TABLET;
}

/**
 * Safely reads the persisted desktop sidebar collapsed state from localStorage.
 * Only accepts strict string values 'true' or 'false'.
 * 
 * @param {string} [key=SIDEBAR_STORAGE_KEY]
 * @param {boolean} [fallback=false]
 * @returns {boolean}
 */
export function readStoredDesktopCollapsed(key = SIDEBAR_STORAGE_KEY, fallback = false) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return fallback;
  } catch (error) {
    console.warn('[FocusFlow] Unable to read sidebar state from localStorage:', error);
    return fallback;
  }
}

/**
 * Safely writes the persisted desktop sidebar collapsed state to localStorage.
 * 
 * @param {boolean} value
 * @param {string} [key=SIDEBAR_STORAGE_KEY]
 */
export function writeStoredDesktopCollapsed(value, key = SIDEBAR_STORAGE_KEY) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch (error) {
    console.warn('[FocusFlow] Unable to save sidebar state to localStorage:', error);
  }
}
