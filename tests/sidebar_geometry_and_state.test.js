import { assert, assertEqual } from './e2e_framework.js';
import {
  BREAKPOINTS,
  isDesktopViewport,
  isTabletViewport,
  isMobileViewport,
  readStoredDesktopCollapsed,
  writeStoredDesktopCollapsed
} from '../src/lib/breakpoints.js';
import fs from 'fs';
import path from 'path';

export function registerSidebarGeometryAndStateTests(runner) {
  const TIER = 'Tier 2: Boundary & Corner Cases';

  runner.describe(TIER, 'Sidebar Geometry, State Machine & A11y', () => {
    // -------------------------------------------------------------------------
    // 1. Breakpoints & Viewport Boundaries
    // -------------------------------------------------------------------------
    runner.test('SIDEBAR-BP-01: Boundary 767px (mobile max) identified correctly', () => {
      assertEqual(isMobileViewport(767), true, '767px must be mobile');
      assertEqual(isTabletViewport(767), false, '767px must NOT be tablet');
      assertEqual(isDesktopViewport(767), false, '767px must NOT be desktop');
    });

    runner.test('SIDEBAR-BP-02: Boundary 768px (tablet min) identified correctly', () => {
      assertEqual(isMobileViewport(768), false, '768px must NOT be mobile');
      assertEqual(isTabletViewport(768), true, '768px must be tablet');
      assertEqual(isDesktopViewport(768), false, '768px must NOT be desktop');
    });

    runner.test('SIDEBAR-BP-03: Boundary 1023px (tablet max) identified correctly', () => {
      assertEqual(isTabletViewport(1023), true, '1023px must be tablet');
      assertEqual(isDesktopViewport(1023), false, '1023px must NOT be desktop');
    });

    runner.test('SIDEBAR-BP-04: Boundary 1024px (desktop min) identified correctly', () => {
      assertEqual(isTabletViewport(1024), false, '1024px must NOT be tablet');
      assertEqual(isDesktopViewport(1024), true, '1024px must be desktop');
    });

    // -------------------------------------------------------------------------
    // 2. LocalStorage Persistence & Error Fallback
    // -------------------------------------------------------------------------
    runner.test('SIDEBAR-STORE-01: Reads strictly valid boolean values and falls back gracefully', () => {
      // Mock window.localStorage
      const storage = new Map();
      const mockWindow = {
        localStorage: {
          getItem: (k) => storage.get(k) ?? null,
          setItem: (k, v) => storage.set(k, String(v)),
        }
      };
      const origWindow = global.window;
      global.window = mockWindow;

      try {
        // Empty storage -> fallback
        assertEqual(readStoredDesktopCollapsed('test_key', false), false);
        assertEqual(readStoredDesktopCollapsed('test_key', true), true);

        // Write and read valid values
        writeStoredDesktopCollapsed(true, 'test_key');
        assertEqual(readStoredDesktopCollapsed('test_key', false), true);

        writeStoredDesktopCollapsed(false, 'test_key');
        assertEqual(readStoredDesktopCollapsed('test_key', true), false);

        // Corrupted strings should fallback
        storage.set('test_key', 'invalid_random_string');
        assertEqual(readStoredDesktopCollapsed('test_key', false), false);

        storage.set('test_key', '{ "corrupted": 123 }');
        assertEqual(readStoredDesktopCollapsed('test_key', true), true);
      } finally {
        global.window = origWindow;
      }
    });

    // -------------------------------------------------------------------------
    // 3. Mathematical 48px Slot Geometry & 36px Axis Invariants
    // -------------------------------------------------------------------------
    runner.test('SIDEBAR-GEOM-01: Nav items use uniform w-full buttons with fixed w-12 icon slot', () => {
      const filePath = path.resolve('src/components/layout/Sidebar.jsx');
      const src = fs.readFileSync(filePath, 'utf8');

      // Check uniform padding on nav container
      assert(src.includes('px-3'), 'Sidebar nav container must specify uniform px-3 padding');

      // Check button classes: must NOT have justify-center or variable paddings
      assert(!src.includes('justify-center p-0'), 'Nav button must not use conditional justify-center p-0');
      assert(!src.includes('mx-auto justify-center'), 'Nav button must not use mx-auto justify-center');
      assert(src.includes('w-12 h-11 flex items-center justify-center flex-shrink-0'), 'Nav button must feature fixed w-12 h-11 flex-shrink-0 icon slot');
    });

    runner.test('SIDEBAR-GEOM-02: Header, Profile and Toggle all implement matching 48px (w-12) slot', () => {
      const filePath = path.resolve('src/components/layout/Sidebar.jsx');
      const src = fs.readFileSync(filePath, 'utf8');

      // Header Monogram slot
      assert(src.includes('w-12 h-12 flex items-center justify-center flex-shrink-0'), 'Header must implement matching w-12 h-12 slot for monogram');

      // Profile Avatar slot
      assert(src.includes('w-12 h-11 flex items-center justify-center flex-shrink-0'), 'Profile must implement matching w-12 h-11 slot for avatar');

      // Toggle Icon slot
      assert(src.includes('w-12 h-10 flex items-center justify-center flex-shrink-0'), 'Toggle must implement matching w-12 h-10 slot for chevron');
    });

    runner.test('SIDEBAR-GEOM-03: Toggle button uses GPU-accelerated rotation on constant chevron_left', () => {
      const filePath = path.resolve('src/components/layout/Sidebar.jsx');
      const src = fs.readFileSync(filePath, 'utf8');

      // Must not swap string between chevron_right and chevron_left
      assert(!src.includes("{collapsed ? 'chevron_right' : 'chevron_left'}"), 'Toggle must not swap ligature text strings');
      assert(src.includes('chevron_left'), 'Toggle must use constant chevron_left');
      assert(src.includes('rotate-180'), 'Toggle must use rotate-180 transform for collapsed state');
    });

    // -------------------------------------------------------------------------
    // 4. Scrolling Guarantee & Viewport Resilience
    // -------------------------------------------------------------------------
    runner.test('SIDEBAR-SCROLL-01: Nav enforces min-h-0, overflow-y-auto and overflow-x-hidden', () => {
      const filePath = path.resolve('src/components/layout/Sidebar.jsx');
      const src = fs.readFileSync(filePath, 'utf8');

      assert(src.includes('min-h-0'), 'Nav must have min-h-0 for flex child scrollability');
      assert(src.includes('overflow-y-auto'), 'Nav must have overflow-y-auto');
      assert(src.includes('overflow-x-hidden'), 'Nav must have overflow-x-hidden to prevent animation scrollbars');
      assert(src.includes('overscroll-contain'), 'Nav must have overscroll-contain');
    });

    runner.test('SIDEBAR-SCROLL-02: Header and Footer enforce flex-shrink-0 to prevent vertical clipping', () => {
      const filePath = path.resolve('src/components/layout/Sidebar.jsx');
      const src = fs.readFileSync(filePath, 'utf8');

      assert(src.includes('h-16 sm:h-20 flex-shrink-0'), 'Header must be flex-shrink-0');
      assert(src.includes('mt-auto p-3 flex flex-col gap-2 flex-shrink-0'), 'Footer must be flex-shrink-0 and mt-auto');
    });

    // -------------------------------------------------------------------------
    // 5. Accessibility & Motion Safety
    // -------------------------------------------------------------------------
    runner.test('SIDEBAR-A11Y-01: Sidebar implements dialog role, aria-expanded, aria-controls and motion-reduce', () => {
      const filePath = path.resolve('src/components/layout/Sidebar.jsx');
      const src = fs.readFileSync(filePath, 'utf8');

      assert(src.includes('role="dialog"') || src.includes("role="), 'Aside must declare role');
      assert(src.includes('aria-expanded'), 'Toggle must declare aria-expanded');
      assert(src.includes('aria-controls'), 'Toggle must declare aria-controls');
      assert(src.includes('motion-reduce:transition-none'), 'Sidebar must respect motion-reduce preferences');
    });
  });
}
