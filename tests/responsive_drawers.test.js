import { assert, assertEqual } from './e2e_framework.js';
import {
  BREAKPOINTS,
  canFitDrawersSideBySide
} from '../src/lib/breakpoints.js';
import fs from 'fs';
import path from 'path';

export function registerResponsiveDrawerTests(runner) {
  const TIER = 'Tier 2: Boundary & Corner Cases';

  runner.describe(TIER, 'Responsive Drawers & Fio Chat In-Place Replacement', () => {
    // -------------------------------------------------------------------------
    // 1. Breakpoints & Side-by-Side Thresholds
    // -------------------------------------------------------------------------
    runner.test('DRAWER-BP-01: Breakpoint constants defined correctly for drawers', () => {
      assertEqual(BREAKPOINTS.BOTTOM_DRAWER_MAX, 639, 'Bottom drawer max must be 639px');
      assertEqual(BREAKPOINTS.DRAWER_WIDTH, 420, 'Drawer width must be 420px');
      assertEqual(BREAKPOINTS.DRAWER_MARGIN, 12, 'Drawer margin must be 12px');
      assertEqual(BREAKPOINTS.DRAWER_PAIR_TOTAL_WIDTH, 864, 'Drawer pair total width must be 864px (420+12 + 420+12)');
      assertEqual(BREAKPOINTS.MIN_PROJECT_CONTENT_WIDTH, 480, 'Minimum project width must be 480px');
      assertEqual(BREAKPOINTS.SIDE_BY_SIDE_MIN, 1344, 'Side-by-side threshold must be 1344px (864 + 480)');
    });

    runner.test('DRAWER-BP-02: canFitDrawersSideBySide enforces strict 1344px boundary', () => {
      assertEqual(canFitDrawersSideBySide(768), false, 'Tablet 768px must NOT fit side-by-side');
      assertEqual(canFitDrawersSideBySide(1024), false, 'iPad 1024px must NOT fit side-by-side');
      assertEqual(canFitDrawersSideBySide(1280), false, 'Laptop 1280px must NOT fit side-by-side');
      assertEqual(canFitDrawersSideBySide(1343), false, '1343px must NOT fit side-by-side');
      assertEqual(canFitDrawersSideBySide(1344), true, '1344px boundary MUST fit side-by-side');
      assertEqual(canFitDrawersSideBySide(1440), true, '1440px wide screen MUST fit side-by-side');
      assertEqual(canFitDrawersSideBySide(1920), true, '1920px Full HD MUST fit side-by-side');
      assertEqual(canFitDrawersSideBySide(null), false, 'null width must return false');
      assertEqual(canFitDrawersSideBySide(undefined), false, 'undefined width must return false');
    });

    // -------------------------------------------------------------------------
    // 2. GlobalChatDrawer Replacement & Animation
    // -------------------------------------------------------------------------
    runner.test('DRAWER-CHAT-01: GlobalChatDrawer implements isReplacingDetail and in-place animations', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/ui/GlobalChatDrawer.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert(content.includes('isReplacingDetail = false'), 'GlobalChatDrawer must declare isReplacingDetail prop');
      assert(content.includes("'--chat-offset': isSecondaryPanel ? '444px' : '12px'"), 'Offset must be 12px when replacing detail drawer');
      assert(content.includes('drawer-replace-in'), 'Must use drawer-replace-in for in-place display instead of sliding across screen');
      assert(content.includes('drawer-replace-out'), 'Must use drawer-replace-out when closing from replacement mode');
      assert(content.includes("${isSecondaryPanel ? 'sm:z-40' : 'sm:z-50'}"), 'Must render z-50 in replace mode over detail drawer');
    });

    // -------------------------------------------------------------------------
    // 3. TaskDetailDrawer & SectionDetailDrawer In-Place States & Header Triggers
    // -------------------------------------------------------------------------
    runner.test('DRAWER-TASK-01: TaskDetailDrawer supports isChatReplacing and Fio header button', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/ui/TaskDetailDrawer.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert(content.includes('isChatReplacing = false'), 'TaskDetailDrawer must declare isChatReplacing prop');
      assert(content.includes('aria-hidden={isChatReplacing ? \'true\' : undefined}'), 'Must mark aria-hidden when chat replaces it');
      assert(content.includes('isChatReplacing ? \'pointer-events-none opacity-0'), 'Must disable interaction when chat replaces it');
      assert(content.includes('if (!isOpen || isChatReplacing) return'), 'Click outside must ignore when chat is replacing');
      assert(content.includes('onOpenGlobalChat'), 'Header must support onOpenGlobalChat trigger');
      assert(content.includes('FioIcon'), 'Header must render FioIcon button');
    });

    runner.test('DRAWER-SEC-01: SectionDetailDrawer supports isChatReplacing and Fio header button', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/ui/SectionDetailDrawer.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert(content.includes('isChatReplacing = false'), 'SectionDetailDrawer must declare isChatReplacing prop');
      assert(content.includes('aria-hidden={isChatReplacing ? \'true\' : undefined}'), 'Must mark aria-hidden when chat replaces it');
      assert(content.includes('isChatReplacing ? \'pointer-events-none opacity-0'), 'Must disable interaction when chat replaces it');
      assert(content.includes('if (!isOpen || isChatReplacing) return'), 'Click outside must ignore when chat is replacing');
      assert(content.includes('onOpenGlobalChat'), 'Header must support onOpenGlobalChat trigger');
      assert(content.includes('FioIcon'), 'Header must render FioIcon button');
    });

    // -------------------------------------------------------------------------
    // 4. ProjectDetail Layout Margins & Reactive Measurement
    // -------------------------------------------------------------------------
    runner.test('DRAWER-PROJ-01: ProjectDetail dynamically regulates side-by-side vs replace', () => {
      const filePath = path.resolve(process.cwd(), 'src/components/screens/ProjectDetail.jsx');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert(content.includes('canFitDrawersSideBySide'), 'ProjectDetail must import canFitDrawersSideBySide');
      assert(content.includes('ref={rootRef}'), 'ProjectDetail root element must attach rootRef for observer');
      assert(content.includes('ResizeObserver'), 'ProjectDetail must observe container width changes');
      assert(content.includes('isBothSideBySide = detailDrawerOpen && isGlobalChatOpen && canFitSideBySide'), 'Side-by-side requires sufficient width');
      assert(content.includes("'lg:mr-[864px]'"), 'Double margin applies only when side-by-side fits');
      assert(content.includes("'lg:mr-[420px]'"), 'Single margin applies when replacing detail drawer on laptop');
      assert(content.includes('isSecondaryPanel={detailDrawerOpen && canFitSideBySide}'), 'Secondary panel prop only passed when fitting side-by-side');
      assert(content.includes('isReplacingDetail={detailDrawerOpen && !canFitSideBySide}'), 'Replacement prop passed when not fitting side-by-side');
      assert(content.includes('isChatReplacing={detailDrawerOpen && !canFitSideBySide && isGlobalChatOpen}'), 'Detail drawers informed of chat replacement');
    });

    // -------------------------------------------------------------------------
    // 5. CSS Animations & Reduced Motion
    // -------------------------------------------------------------------------
    runner.test('DRAWER-CSS-01: CSS contains replace animations and reduced motion safeguards', () => {
      const filePath = path.resolve(process.cwd(), 'src/index.css');
      const content = fs.readFileSync(filePath, 'utf-8');

      assert(content.includes('@keyframes fadeOut'), 'Must define fadeOut keyframe');
      assert(content.includes('.drawer-replace-in'), 'Must define .drawer-replace-in class');
      assert(content.includes('.drawer-replace-out'), 'Must define .drawer-replace-out class');
      assert(content.includes('.drawer-replace-in,\n  .drawer-replace-out') || content.includes('.drawer-replace-in,'), 'Must include replace classes in reduced motion media query');
    });
  });
}
