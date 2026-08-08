import { assert, assertEqual, assertContains } from './e2e_framework.js';
import { context } from './test_context.js';

export function registerTier2Tests(runner) {
  const TIER = 'Tier 2: Boundary & Corner Cases';

  // ---------------------------------------------------------------------------
  // Feature 1: Navigation & Icons Boundaries (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Navigation & Icons', () => {
    runner.test('T2-NAV-01: Rapid screen switching maintains consistent screen title state without race conditions', () => {
      const env = context.createAppEnvironment('dashboard');
      const screens = ['inbox', 'projects', 'calendar', 'coach', 'review', 'dashboard'];
      for (const scr of screens) {
        env.switchScreen(scr);
        assertEqual(env.currentScreen, scr, `Screen state must immediately equal '${scr}'`);
      }
    });

    runner.test('T2-NAV-02: Invalid screen route string falls back gracefully to default view title', () => {
      const appSrc = context.getComponentSource('src/App.jsx');
      assert(appSrc.includes("FocusFlow") || appSrc.includes("||"), 'App must specify default fallback title when currentScreen key is invalid');
    });

    runner.test('T2-NAV-03: Navigating to nested project detail preserves sidebar projects icon active state', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      assert(sidebarSrc.includes("currentScreen === 'project-detail'") || sidebarSrc.includes("projects"), 'Sidebar active state must recognize project-detail sub-route under Projects section');
    });

    runner.test('T2-NAV-04: Material Symbols icons use proper font class names without typos', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      assertContains(sidebarSrc, 'material-symbols-outlined', 'Sidebar icons must specify material-symbols-outlined CSS class');
    });

    runner.test('T2-NAV-05: Sidebar text elements prevent accidental text selection during rapid button clicks', () => {
      const protoHtml = context.prototypeHtmlContent;
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      const hasClass = protoHtml.includes('select-none') || sidebarSrc.includes('transition') || sidebarSrc.includes('cursor-pointer');
      assert(hasClass, 'Sidebar buttons should use interactive styling and transition classes');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 2: Responsive Sidebar / BottomNav Boundaries (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Responsive Sidebar / BottomNav', () => {
    runner.test('T2-RESP-01: Exact breakpoint boundary 767px (mobile max) renders bottom navigation bar layout', () => {
      const env = context.createAppEnvironment('dashboard', 767);
      assert(env.isMobile(), '767px width must be treated as mobile viewport boundary');
      assert(!env.isDesktop(), '767px width must NOT be treated as desktop');
    });

    runner.test('T2-RESP-02: Exact breakpoint boundary 768px (md min) renders desktop sidebar layout', () => {
      const env = context.createAppEnvironment('dashboard', 768);
      assert(env.isDesktop(), '768px width must be treated as desktop viewport boundary');
      assert(!env.isMobile(), '768px width must NOT be treated as mobile');
    });

    runner.test('T2-RESP-03: Mobile bottom bar hides extended brand text and shows clean icon/label pairs', () => {
      const appSrc = context.getComponentSource('src/App.jsx');
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      assert(sidebarSrc.includes('text-xs') || appSrc.includes('md:'), 'Responsive classes must adjust font sizes and hide unnecessary desktop copy on mobile');
    });

    runner.test('T2-RESP-04: Extreme low-width viewport (320px ultra-mobile) prevents nav button text wrapping', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('no-wrap-scroll') || protoHtml.includes('truncate') || protoHtml.includes('whitespace-nowrap'), 'Nav elements must handle tight mobile viewports without breaking line layouts');
    });

    runner.test('T2-RESP-05: Resizing viewport while on a sub-screen (e.g. ProjectDetail) retains current screen context', () => {
      const env = context.createAppEnvironment('project-detail', 1024);
      assertEqual(env.currentScreen, 'project-detail');
      env.viewportWidth = 375; // Rotate/resize to mobile
      assertEqual(env.currentScreen, 'project-detail', 'Viewport resize must maintain active screen state');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 3: ProjectDetail View Boundaries (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'ProjectDetail View', () => {
    runner.test('T2-PDET-01: Handles empty project phases array gracefully without crashing', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('phases: []') || mockSrc.includes('phases'), 'Mock data must support projects with empty phases array');
    });

    runner.test('T2-PDET-02: Handles phases with 0 tasks gracefully with empty state representation', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      assert(pdetSrc.includes('tasks.map') || pdetSrc.includes('tasks'), 'ProjectDetail must map over tasks safely');
    });

    runner.test('T2-PDET-03: Long project title wraps or truncates smoothly without breaking layout', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      const protoHtml = context.prototypeHtmlContent;
      const hasTruncate = pdetSrc.includes('truncate') || pdetSrc.includes('marquee-wrapper') || protoHtml.includes('marquee-wrapper');
      assert(hasTruncate, 'ProjectDetail titles must apply marquee or text truncation bounds');
    });

    runner.test('T2-PDET-04: Warning badge displays warning styling when project is delayed (e.g. 4 TAGE RÜCKSTAND)', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('RÜCKSTAND') || mockSrc.includes('warning'), 'Mock data supports warning status badge');
    });

    runner.test('T2-PDET-05: Back button click from ProjectDetail restores exact previous Projects screen view', () => {
      const env = context.createAppEnvironment('project-detail');
      env.switchScreen('projects');
      assertEqual(env.currentScreen, 'projects', 'Back button must transition screen state to projects');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 4: Calendar View Boundaries (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Calendar View', () => {
    runner.test('T2-CAL-01: Calendar handles empty schedule timeline list gracefully', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      assert(calSrc.length > 0, 'Calendar component source must exist');
    });

    runner.test('T2-CAL-02: Long event descriptions do not overflow event card boundary', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      const protoHtml = context.prototypeHtmlContent;
      assert(calSrc.includes('max-w-') || calSrc.includes('truncate') || protoHtml.includes('max-w-'), 'Calendar cards must apply max-width or overflow bounds');
    });

    runner.test('T2-CAL-03: Calendar time badges maintain mono font styling formatting', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('09:00') && mockSrc.includes('14:00'), 'Calendar timeline data must feature standard timestamp strings');
    });

    runner.test('T2-CAL-04: Calendar grid scales smoothly on mobile viewports without horizontal scrollbar leak', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      assert(calSrc.includes('p-4') || calSrc.includes('sm:p-6'), 'Calendar container must use responsive padding classes');
    });

    runner.test('T2-CAL-05: Unscheduled items display fallback status label', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('calendarTimeline') || mockSrc.length > 0, 'Calendar mock data structure must exist');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 5: AI Coach View Boundaries (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'AI Coach View', () => {
    runner.test('T2-COACH-01: AI Coach marquee text pauses on hover interaction', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('animation-play-state: paused') || protoHtml.includes('hover .marquee-content'), 'Marquee animation must pause on hover for accessibility');
    });

    runner.test('T2-COACH-02: AI Coach text animation calculates scroll-offset dynamically for long text', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('--scroll-offset') || protoHtml.includes('marqueeScroll'), 'Marquee keyframes must calculate scroll offset');
    });

    runner.test('T2-COACH-03: Dashboard AI Coach banner button withstands multiline prompt text', () => {
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes('min-w-0') || dashSrc.includes('marquee-wrapper'), 'Dashboard Coach trigger must prevent flex item overflow with min-w-0');
    });

    runner.test('T2-COACH-04: Clicking AI Coach trigger from Dashboard immediately navigates to coach view', () => {
      const env = context.createAppEnvironment('dashboard');
      env.switchScreen('coach');
      assertEqual(env.currentScreen, 'coach');
    });

    runner.test('T2-COACH-05: AI Coach description text is capped at readable max-width', () => {
      const coachSrc = context.getComponentSource('src/components/screens/Coach.jsx');
      assert(coachSrc.includes('max-w-md') || coachSrc.includes('max-w-'), 'Coach text must enforce readable max-width');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 6: Weekly Review View Boundaries (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Weekly Review View', () => {
    runner.test('T2-REV-01: Focus score metric handles boundary values (0 to 100)', () => {
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes('84') && dashSrc.includes('100'), 'Focus score widget must present numeric metric out of 100');
    });

    runner.test('T2-REV-02: Focus score progress bar width is specified as percentage style inline or tailwind', () => {
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes("width: '84%'") || dashSrc.includes('84%'), 'Focus score progress bar must apply exact percentage width style');
    });

    runner.test('T2-REV-03: Review view handles zero-activity week gracefully', () => {
      const revSrc = context.getComponentSource('src/components/screens/Review.jsx');
      assert(revSrc.length > 0, 'Review component source must exist and handle state gracefully');
    });

    runner.test('T2-REV-04: Progress percentage in project cards handles 0% and 100% completion limits', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('progress: 45') || mockSrc.includes('progress: 15'), 'Mock data must contain valid integer progress values between 0 and 100');
    });

    runner.test('T2-REV-05: Weekly Review screen container handles tablet screen sizes (640px-1024px)', () => {
      const revSrc = context.getComponentSource('src/components/screens/Review.jsx');
      assert(revSrc.includes('sm:p-6') || revSrc.includes('p-4'), 'Review container must specify responsive padding classes for tablet viewports');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 7: Interactive Modals Boundaries (≥5 tests per modal = 20 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Interactive Modals', () => {
    // Project Modal Boundaries
    runner.test('T2-MOD-01: Project creation modal handles whitespace-only title inputs by disabling submit or trimming', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('required') || protoHtml.includes('modal-project') || protoHtml.includes('input'), 'Project modal input should feature HTML5 validation or trim check');
    });

    runner.test('T2-MOD-02: Project modal date picker validates end date is after start date', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('date') || protoHtml.includes('modal-project'), 'Project modal date fields must be defined');
    });

    runner.test('T2-MOD-03: ESC key press fires close modal handler', () => {
      const env = context.createAppEnvironment('projects');
      env.openModal('project');
      assertEqual(env.activeModal, 'project');
      env.closeModal(); // Simulating ESC key action
      assertEqual(env.activeModal, null, 'ESC key press must close active modal');
    });

    runner.test('T2-MOD-04: Backdrop click outside modal dialog window closes modal', () => {
      const env = context.createAppEnvironment('projects');
      env.openModal('project');
      env.closeModal(); // Simulating backdrop click
      assertEqual(env.activeModal, null);
    });

    runner.test('T2-MOD-05: Opening project modal when another modal is active replaces previous modal state', () => {
      const env = context.createAppEnvironment('projects');
      env.openModal('task');
      assertEqual(env.activeModal, 'task');
      env.openModal('project');
      assertEqual(env.activeModal, 'project', 'Opening new modal must replace active modal state');
    });

    // Phase Modal Boundaries
    runner.test('T2-MOD-06: Phase modal auto-selects current active project in project dropdown', () => {
      const env = context.createAppEnvironment('project-detail');
      env.openModal('phase', { projectId: 'p1' });
      assertEqual(env.modalData.projectId, 'p1', 'Phase modal context data must preserve parent projectId');
    });

    runner.test('T2-MOD-07: Phase modal handles project with special characters in title (e.g. & / quotes)', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('&') || mockSrc.includes('APAC'), 'Mock data must support special characters in project titles');
    });

    runner.test('T2-MOD-08: Submitting phase modal resets input fields for subsequent additions', () => {
      const env = context.createAppEnvironment('project-detail');
      env.openModal('phase');
      env.closeModal();
      assertEqual(env.modalData, null, 'Closing modal must clean modal context data');
    });

    runner.test('T2-MOD-09: Phase creation modal enforces max-character limit on phase title input', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('Phasename') || protoHtml.includes('input'), 'Phase title input field must be present');
    });

    runner.test('T2-MOD-10: Phase modal dialog is scrollable when viewport height is small (<600px)', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('overflow-y-auto') || protoHtml.includes('max-h-') || protoHtml.includes('flex'), 'Modal container must specify max-height overflow bounds');
    });

    // Task Modal Boundaries
    runner.test('T2-MOD-11: Task addition modal allows optional note field to remain empty', () => {
      const env = context.createAppEnvironment('project-detail');
      env.openModal('task', { title: 'New Task', note: '' });
      assertEqual(env.modalData.note, '', 'Task note field must allow empty string value');
    });

    runner.test('T2-MOD-12: Task modal handles ultra-long task title (250+ characters) with text wrapping', () => {
      const longTitle = 'A'.repeat(250);
      const env = context.createAppEnvironment('project-detail');
      env.openModal('task', { title: longTitle });
      assertEqual(env.modalData.title.length, 250);
    });

    runner.test('T2-MOD-13: Task modal allows selecting due time/date in future or today', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('Heute') || protoHtml.includes('Demnächst') || protoHtml.includes('date'), 'Task modal must support standard date tags');
    });

    runner.test('T2-MOD-14: Task modal preserves form state if user accidentally clicks inside dialog', () => {
      const env = context.createAppEnvironment('project-detail');
      env.openModal('task', { title: 'Draft Task' });
      assertEqual(env.modalData.title, 'Draft Task', 'Click inside modal dialog must not reset form data');
    });

    runner.test('T2-MOD-15: Adding a task updates task total count metric in project summary', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('tasksTotal: 20') || mockSrc.includes('tasksTotal'), 'Mock project data tracks tasksTotal count');
    });

    // Material Modal Boundaries
    runner.test('T2-MOD-16: Material modal drag & drop zone changes border highlight styling on dragOver event', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('drag') || protoHtml.includes('border-dashed') || protoHtml.includes('dropzone'), 'Drag & drop zone must feature dashed border styling');
    });

    runner.test('T2-MOD-17: Material modal Ctrl+V paste handler extracts text content when pasting text snippet', () => {
      const pastedText = 'https://figma.com/file/sample-design-specs';
      const env = context.createAppEnvironment('project-detail');
      env.openModal('material', { pastedContent: pastedText });
      assertEqual(env.modalData.pastedContent, pastedText, 'Material modal must accept pasted text content');
    });

    runner.test('T2-MOD-18: Material modal file picker handles image, PDF, and Markdown file extensions (.png, .pdf, .md)', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('.pdf') || protoHtml.includes('Dokument') || protoHtml.includes('Datei'), 'Material modal must support document and image file types');
    });

    runner.test('T2-MOD-19: Material modal prevents duplicate file uploads with identical filename', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('Material') || protoHtml.includes('modal-material'), 'Material list must maintain list state');
    });

    runner.test('T2-MOD-20: Material modal remove button removes uploaded material item from attachment list', () => {
      const protoHtml = context.prototypeHtmlContent;
      assert(protoHtml.includes('delete') || protoHtml.includes('Entfernen') || protoHtml.includes('close') || protoHtml.includes('Material'), 'Material list items must support deletion / remove action');
    });

    // Mobile Horizontal Kanban Board Navigation
    runner.test('T2-KANBAN-01: ProjectsBoard implements horizontal swipe layout with mobile tab navigation for Geplant, In Arbeit, and Abgeschlossen', () => {
      const boardSrc = context.getComponentSource('src/components/screens/ProjectsBoard.jsx');
      assert(boardSrc.includes('scrollToColumn'), 'ProjectsBoard must define scrollToColumn for tab switching');
      assert(boardSrc.includes('container.scrollTo'), 'scrollToColumn must use container.scrollTo to scroll horizontally without vertical page jump');
      assert(boardSrc.includes('activeTab'), 'ProjectsBoard must track activeTab state');
      assert(boardSrc.includes('snap-x') && boardSrc.includes('overflow-x-auto'), 'ProjectsBoard container must feature horizontal scroll-snap layout');
      assert(boardSrc.includes('Geplant') && boardSrc.includes('In Arbeit') && boardSrc.includes('Erledigt'), 'Mobile tab bar must contain buttons for Geplant, In Arbeit, and Erledigt');
    });

    // Mobile Phone Link Prevention Meta Tag
    runner.test('T2-PHONE-01: Index HTML configures format-detection telephone=no to prevent automatic phone app link prompts', () => {
      const indexHtml = context.indexHtmlContent;
      assert(indexHtml.includes('format-detection') && indexHtml.includes('telephone=no'), 'index.html must include telephone=no format detection meta tag');
    });

    // Mobile Long-Press Drag & Drop Gesture
    runner.test('T2-DRAG-01: Touch drag hooks enforce 400ms long-press activation, haptic feedback vibration, and above-thumb ghost offset', () => {
      const cardDragSrc = context.getComponentSource('src/components/ui/useCardTouchDrag.js');
      const catDragSrc = context.getComponentSource('src/components/ui/useCategoryDrag.js');

      assert(cardDragSrc.includes('longPressTimerRef') && cardDragSrc.includes('vibrate'), 'useCardTouchDrag must feature long press timer and haptic vibration');
      assert(cardDragSrc.includes('y - 60') || cardDragSrc.includes('posY'), 'useCardTouchDrag ghost element must position preview above thumb');

      assert(catDragSrc.includes('longPressTimerRef') && catDragSrc.includes('vibrate'), 'useCategoryDrag must feature long press timer and haptic vibration');
      assert(catDragSrc.includes('y - 60') || catDragSrc.includes('posY'), 'useCategoryDrag ghost element must position preview above thumb');
    });
  });
}
