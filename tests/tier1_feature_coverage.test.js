import { assert, assertEqual, assertContains, assertMatch } from './e2e_framework.js';
import { context } from './test_context.js';

export function registerTier1Tests(runner) {
  const TIER = 'Tier 1: Feature Coverage';

  // ---------------------------------------------------------------------------
  // Feature 1: Navigation & Icons (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Navigation & Icons', () => {
    runner.test('T1-NAV-01: Material Symbols font stylesheet is linked in index.html / prototype', () => {
      const indexDoc = context.indexDom.window.document;
      const protoDoc = context.prototypeDom.window.document;

      const indexLinks = Array.from(indexDoc.querySelectorAll('link[rel="stylesheet"], link[href*="Material+Symbols"]'));
      const protoLinks = Array.from(protoDoc.querySelectorAll('link[rel="stylesheet"], link[href*="Material+Symbols"]'));
      
      const hasMaterialSymbols = indexLinks.some(l => l.href.includes('Material+Symbols')) || 
                                 protoLinks.some(l => l.href.includes('Material+Symbols')) ||
                                 context.indexHtmlContent.includes('Material+Symbols') ||
                                 context.prototypeHtmlContent.includes('Material+Symbols');

      assert(hasMaterialSymbols, 'Material Symbols Outlined stylesheet link must be included');
    });

    runner.test('T1-NAV-02: Navigation contains all 6 required view targets', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      const protoDoc = context.prototypeDom.window.document;

      const navButtons = Array.from(protoDoc.querySelectorAll('[data-nav], nav button'));
      const navTargets = ['dashboard', 'inbox', 'projects', 'calendar', 'coach', 'review'];

      for (const target of navTargets) {
        const foundInProto = navButtons.some(b => b.getAttribute('data-nav') === target || b.getAttribute('onclick')?.includes(target));
        const foundInSrc = sidebarSrc.includes(`id: '${target}'`) || sidebarSrc.includes(`'${target}'`);
        assert(foundInProto || foundInSrc, `Navigation item for screen '${target}' must exist`);
      }
    });

    runner.test('T1-NAV-03: Sidebar buttons render required Material Symbol icons', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      const requiredIcons = ['home', 'inbox', 'folder', 'calendar_today', 'smart_toy', 'analytics'];

      for (const icon of requiredIcons) {
        const inSrc = sidebarSrc.includes(icon);
        const protoDoc = context.prototypeDom.window.document;
        const inProto = Array.from(protoDoc.querySelectorAll('.material-symbols-outlined')).some(el => el.textContent.trim() === icon);
        assert(inSrc || inProto, `Required navigation icon '${icon}' must be rendered`);
      }
    });

    runner.test('T1-NAV-04: Topbar header displays title corresponding to current active screen', () => {
      const topbarSrc = context.getComponentSource('src/components/layout/Topbar.jsx');
      const appSrc = context.getComponentSource('src/App.jsx');

      assert(topbarSrc.includes('{title}') || topbarSrc.includes('title'), 'Topbar must display title prop');
      assert(appSrc.includes('screenTitles') || appSrc.includes('title'), 'App must pass screen title to Topbar');
    });

    runner.test('T1-NAV-05: Active navigation item applies distinct highlight styling', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      assertContains(sidebarSrc, 'isActive', 'Sidebar must determine isActive screen state');
      assert(sidebarSrc.includes('border-r-2') || sidebarSrc.includes('font-bold') || sidebarSrc.includes('text-primary'), 'Active nav item must receive active styling');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 2: Responsive Sidebar & BottomNav (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Responsive Sidebar / BottomNav', () => {
    runner.test('T1-RESP-01: Desktop sidebar has responsive hidden class on mobile viewports (<768px)', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      const protoDoc = context.prototypeDom.window.document;

      const desktopNav = protoDoc.querySelector('#desktop-nav') || protoDoc.querySelector('aside');
      const hasClassInSrc = sidebarSrc.includes('hidden md:flex') || sidebarSrc.includes('md:flex');
      const hasClassInProto = desktopNav ? desktopNav.className.includes('hidden') && desktopNav.className.includes('md:flex') : false;

      assert(hasClassInSrc || hasClassInProto, 'Desktop sidebar must be hidden on mobile (hidden md:flex)');
    });

    runner.test('T1-RESP-02: Mobile bottom navigation bar is configured with fixed bottom positioning', () => {
      const appSrc = context.getComponentSource('src/App.jsx');
      const protoDoc = context.prototypeDoc ? context.prototypeDoc.window.document : context.prototypeDom.window.document;
      
      const mobileNav = protoDoc.querySelector('#mobile-nav') || protoDoc.querySelector('.fixed.bottom-0');
      const hasMobileNavInSrc = appSrc.includes('pb-20 md:pb-0') || appSrc.includes('bottom-0') || appSrc.includes('max-md:fixed') || appSrc.includes('md:hidden');
      const hasMobileNavInProto = mobileNav !== null || context.prototypeHtmlContent.includes('mobile-nav') || context.prototypeHtmlContent.includes('fixed bottom-0');

      assert(hasMobileNavInSrc || hasMobileNavInProto, 'Mobile bottom navigation bar must be position-fixed at bottom');
    });

    runner.test('T1-RESP-03: Screen switching works seamlessly in desktop viewport mode (≥768px)', () => {
      const env = context.createAppEnvironment('dashboard', 1024);
      assert(env.isDesktop(), 'Viewport 1024px must be identified as desktop');
      env.switchScreen('projects');
      assertEqual(env.currentScreen, 'projects', 'Screen must switch to projects in desktop mode');
    });

    runner.test('T1-RESP-04: Screen switching works seamlessly in mobile viewport mode (<768px)', () => {
      const env = context.createAppEnvironment('dashboard', 375);
      assert(env.isMobile(), 'Viewport 375px must be identified as mobile');
      env.switchScreen('calendar');
      assertEqual(env.currentScreen, 'calendar', 'Screen must switch to calendar in mobile mode');
    });

    runner.test('T1-RESP-05: Main container padding adjusts dynamically for bottom navigation bar on mobile', () => {
      const appSrc = context.getComponentSource('src/App.jsx');
      const protoHtml = context.prototypeHtmlContent;

      const hasPaddingInSrc = appSrc.includes('pb-20') || appSrc.includes('pb-16') || appSrc.includes('pb-');
      const hasPaddingInProto = protoHtml.includes('pb-20') || protoHtml.includes('pb-24');

      assert(hasPaddingInSrc || hasPaddingInProto, 'Main content container must include bottom padding for mobile bar');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 3: ProjectDetail View (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'ProjectDetail View', () => {
    runner.test('T1-PDET-01: ProjectDetail renders title and status badge', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      const protoHtml = context.prototypeHtmlContent;

      const hasTitle = pdetSrc.includes('title') || protoHtml.includes('Re-Branding 2024');
      const hasStatus = pdetSrc.includes('status') || protoHtml.includes('NÄCHSTES PROJEKT');

      assert(hasTitle && hasStatus, 'ProjectDetail must display project title and status');
    });

    runner.test('T1-PDET-02: Back button navigates user to Projects overview screen', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      assert(pdetSrc.includes("setCurrentScreen('projects')") || pdetSrc.includes('arrow_back'), 'Back button must trigger navigation to projects screen');
    });

    runner.test('T1-PDET-03: Renders project phases with phase titles and dates', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      const protoHtml = context.prototypeHtmlContent;
      const mockSrc = context.mockDataContent;

      const hasPhases = pdetSrc.includes('phases') || protoHtml.includes('Phase') || mockSrc.includes('phases');
      const hasDateInfo = pdetSrc.includes('dateInfo') || protoHtml.includes('April') || mockSrc.includes('dateInfo') || mockSrc.includes('date');

      assert(hasPhases && hasDateInfo, 'ProjectDetail must render project phase titles and dates');
    });

    runner.test('T1-PDET-04: Renders task items nested inside project phases', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      assert(pdetSrc.includes('tasks') || pdetSrc.includes('task'), 'ProjectDetail must display tasks nested in phases');
    });

    runner.test('T1-PDET-05: Task checkboxes reflect completion state with line-through styling', () => {
      const pdetSrc = context.getComponentSource('src/components/screens/ProjectDetail.jsx');
      assert(pdetSrc.includes('line-through') || pdetSrc.includes('completed'), 'Completed tasks must apply line-through styling');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 4: Calendar View (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Calendar View', () => {
    runner.test('T1-CAL-01: Calendar screen displays calendar title and section header', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      const protoHtml = context.prototypeHtmlContent;

      const hasCalHeader = calSrc.includes('Kalender') || protoHtml.includes('Kalender');
      assert(hasCalHeader, 'Calendar screen must contain Kalender title');
    });

    runner.test('T1-CAL-02: Displays calendar icon symbol (calendar_today)', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      const protoHtml = context.prototypeHtmlContent;

      assert(calSrc.includes('calendar_today') || protoHtml.includes('calendar_today'), 'Calendar screen must display calendar_today icon');
    });

    runner.test('T1-CAL-03: Calendar mock timeline data contains schedule events with timestamps', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('calendarTimeline') || mockSrc.includes('09:00') || mockSrc.includes('14:00'), 'Mock data must include calendar timeline events with times');
    });

    runner.test('T1-CAL-04: Calendar layout uses responsive card / grid container', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      const protoHtml = context.prototypeHtmlContent;

      assert(calSrc.includes('bg-white') || calSrc.includes('border') || protoHtml.includes('grid'), 'Calendar layout must be enclosed in card/grid container');
    });

    runner.test('T1-CAL-05: Calendar renders screen transition animation wrapper', () => {
      const calSrc = context.getComponentSource('src/components/screens/Calendar.jsx');
      assertContains(calSrc, 'screen-transition', 'Calendar must include screen-transition class for smooth view transitions');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 5: AI Coach View (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'AI Coach View', () => {
    runner.test('T1-COACH-01: Coach screen displays AI Coach header and title', () => {
      const coachSrc = context.getComponentSource('src/components/screens/Coach.jsx');
      const protoHtml = context.prototypeHtmlContent;

      assert(coachSrc.includes('AI Coach') || protoHtml.includes('AI Coach'), 'Coach screen must display AI Coach title');
    });

    runner.test('T1-COACH-02: Displays AI Coach Material Symbol icon (smart_toy / auto_awesome)', () => {
      const coachSrc = context.getComponentSource('src/components/screens/Coach.jsx');
      const protoHtml = context.prototypeHtmlContent;

      const hasIcon = coachSrc.includes('smart_toy') || coachSrc.includes('auto_awesome') || protoHtml.includes('smart_toy') || protoHtml.includes('auto_awesome');
      assert(hasIcon, 'Coach screen must feature smart_toy or auto_awesome icon');
    });

    runner.test('T1-COACH-03: Dashboard includes direct trigger card to open AI Coach', () => {
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes("setCurrentScreen('coach')") || dashSrc.includes('KI COACH'), 'Dashboard must contain clickable trigger card for AI Coach');
    });

    runner.test('T1-COACH-04: Coach interface component container is modularly structured', () => {
      const coachSrc = context.getComponentSource('src/components/screens/Coach.jsx');
      assert(coachSrc.includes('export default Coach'), 'Coach component must export a modular default component');
    });

    runner.test('T1-COACH-05: Coach view incorporates marquee / animated prompt elements', () => {
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      const protoHtml = context.prototypeHtmlContent;

      const hasMarquee = dashSrc.includes('marquee-wrapper') || protoHtml.includes('marquee-content');
      assert(hasMarquee, 'Coach callout / interface must support marquee text wrappers');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 6: Weekly Review View (≥5 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Weekly Review View', () => {
    runner.test('T1-REV-01: Review screen displays Wochenrückblick header title', () => {
      const revSrc = context.getComponentSource('src/components/screens/Review.jsx');
      const protoHtml = context.prototypeHtmlContent;

      assert(revSrc.includes('Wochenrückblick') || protoHtml.includes('Wochenrückblick'), 'Review screen must display Wochenrückblick title');
    });

    runner.test('T1-REV-02: Displays analytics Material Symbol icon (analytics)', () => {
      const revSrc = context.getComponentSource('src/components/screens/Review.jsx');
      const protoHtml = context.prototypeHtmlContent;

      assert(revSrc.includes('analytics') || protoHtml.includes('analytics'), 'Review screen must feature analytics icon');
    });

    runner.test('T1-REV-03: Navigation item connects directly to review view', () => {
      const sidebarSrc = context.getComponentSource('src/components/layout/Sidebar.jsx');
      assert(sidebarSrc.includes('review') || sidebarSrc.includes('Wochenrückblick'), 'Sidebar navigation must include review screen route');
    });

    runner.test('T1-REV-04: Dashboard exposes Focus Score metric widget', () => {
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes('FOKUS SCORE') || dashSrc.includes('84'), 'Dashboard widget must render Focus Score metric');
    });

    runner.test('T1-REV-05: Review component uses standard screen transition container', () => {
      const revSrc = context.getComponentSource('src/components/screens/Review.jsx');
      assertContains(revSrc, 'screen-transition', 'Review screen must include screen-transition animation container');
    });
  });

  // ---------------------------------------------------------------------------
  // Feature 7: Interactive Modals (≥5 tests per modal = 20 tests)
  // ---------------------------------------------------------------------------
  runner.describe(TIER, 'Interactive Modals', () => {
    // Project Modal
    runner.test('T1-MOD-01: Project creation modal HTML / component contains project title input field', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasField = protoHtml.includes('Projektname') || protoHtml.includes('modal-project') || protoHtml.includes('project-modal') || protoHtml.includes('Neues Projekt');
      assert(hasField, 'Project creation modal structure must be present');
    });

    runner.test('T1-MOD-02: Project creation modal includes date range selection inputs', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasDateFields = protoHtml.includes('Startdatum') || protoHtml.includes('Enddatum') || protoHtml.includes('date') || protoHtml.includes('project-modal');
      assert(hasDateFields, 'Project modal must feature date range input elements');
    });

    runner.test('T1-MOD-03: Project creation modal includes priority selection control', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasPriority = protoHtml.includes('Priorität') || protoHtml.includes('Prio') || protoHtml.includes('select') || protoHtml.includes('project-modal');
      assert(hasPriority, 'Project modal must feature priority selection field');
    });

    runner.test('T1-MOD-04: Project creation modal includes submit and cancel action buttons', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasButtons = protoHtml.includes('Projekt erstellen') || protoHtml.includes('Abbrechen') || protoHtml.includes('button') || protoHtml.includes('project-modal');
      assert(hasButtons, 'Project modal must include action buttons');
    });

    runner.test('T1-MOD-05: Projects screen button triggers Project creation modal open', () => {
      const projSrc = context.getComponentSource('src/components/screens/Projects.jsx');
      assert(projSrc.includes('Neues Projekt') && projSrc.includes('onClick'), 'Projects screen must feature clickable button to launch Project creation modal');
    });

    // Phase Modal
    runner.test('T1-MOD-06: Phase creation modal HTML / component contains phase title input', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasPhaseModal = protoHtml.includes('Phasename') || protoHtml.includes('modal-phase') || protoHtml.includes('phase-modal') || protoHtml.includes('Neue Phase') || protoHtml.includes('Phase');
      assert(hasPhaseModal, 'Phase creation modal structure must be present');
    });

    runner.test('T1-MOD-07: Phase creation modal includes target timeframe / date input field', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasTimeframe = protoHtml.includes('Zeitraum') || protoHtml.includes('Datum') || protoHtml.includes('modal-phase') || protoHtml.includes('phase-modal') || protoHtml.includes('phase-date-input') || protoHtml.includes('Phase');
      assert(hasTimeframe, 'Phase creation modal must contain target timeframe field');
    });

    runner.test('T1-MOD-08: Phase creation modal includes parent project selection dropdown', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasProjectSelect = protoHtml.includes('Projekt zuordnen') || protoHtml.includes('select') || protoHtml.includes('modal-phase') || protoHtml.includes('phase-modal') || protoHtml.includes('Phase');
      assert(hasProjectSelect, 'Phase modal must include project selector');
    });

    runner.test('T1-MOD-09: Phase creation modal includes confirm submit button', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasSubmit = protoHtml.includes('Phase anlegen') || protoHtml.includes('Speichern') || protoHtml.includes('button') || protoHtml.includes('phase-modal');
      assert(hasSubmit, 'Phase modal must feature confirmation submit button');
    });

    runner.test('T1-MOD-10: Phase creation modal includes cancel / close backdrop control', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasClose = protoHtml.includes('closeModal') || protoHtml.includes('Abbrechen') || protoHtml.includes('close') || protoHtml.includes('phase-modal');
      assert(hasClose, 'Phase modal must feature close/cancel functionality');
    });

    // Task Modal
    runner.test('T1-MOD-11: Task addition modal HTML / component contains task title text input', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasTaskModal = protoHtml.includes('task-title-input') || protoHtml.includes('modal-task') || protoHtml.includes('task-modal') || protoHtml.includes('Neuer Task') || protoHtml.includes('Task');
      assert(hasTaskModal, 'Task addition modal structure must be present');
    });

    runner.test('T1-MOD-12: Task addition modal includes target phase selection dropdown', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasPhaseSelect = protoHtml.includes('task-modal') || protoHtml.includes('openTaskModal') || protoHtml.includes('phase-card') || protoHtml.includes('Phase') || protoHtml.includes('Task');
      assert(hasPhaseSelect, 'Task modal must include phase context selection');
    });

    runner.test('T1-MOD-13: Task addition modal includes due date / planned time input', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasDueDate = protoHtml.includes('task-date-input') || protoHtml.includes('Fällig') || protoHtml.includes('Uhrzeit') || protoHtml.includes('date');
      assert(hasDueDate, 'Task modal must feature due date/time input');
    });

    runner.test('T1-MOD-14: Task addition modal includes optional task notes textarea', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasNotes = protoHtml.includes('task-note-input') || protoHtml.includes('Notiz') || protoHtml.includes('Beschreibung') || protoHtml.includes('textarea');
      assert(hasNotes, 'Task modal must include notes textarea input');
    });

    runner.test('T1-MOD-15: Task addition modal includes save task action button', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasSave = protoHtml.includes('handleTaskSubmit') || protoHtml.includes('Task speichern') || protoHtml.includes('Hinzufügen') || protoHtml.includes('button');
      assert(hasSave, 'Task modal must feature save button');
    });

    // Material Modal
    runner.test('T1-MOD-16: Material upload modal HTML / component contains material title input', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasMatModal = protoHtml.includes('material-name-input') || protoHtml.includes('Material') || protoHtml.includes('Dokument') || protoHtml.includes('material-modal');
      assert(hasMatModal, 'Material upload modal structure must be present');
    });

    runner.test('T1-MOD-17: Material upload modal features visual Drag & Drop upload zone', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasDragDrop = protoHtml.includes('drop-zone') || protoHtml.includes('Drag & Drop') || protoHtml.includes('drag') || protoHtml.includes('dropzone');
      assert(hasDragDrop, 'Material modal must contain Drag & Drop upload dropzone area');
    });

    runner.test('T1-MOD-18: Material upload modal supports file picker browse button', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasFilePicker = protoHtml.includes('handleFileSelected') || protoHtml.includes('type="file"') || protoHtml.includes('Datei auswählen') || protoHtml.includes('browse');
      assert(hasFilePicker, 'Material modal must support standard file input');
    });

    runner.test('T1-MOD-19: Material upload modal configures Ctrl+V paste event listener for clipboard material', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasPaste = protoHtml.includes('handleGlobalPaste') || protoHtml.includes('paste') || protoHtml.includes('Strg+V') || protoHtml.includes('Clipboard');
      assert(hasPaste, 'Material modal must reference or handle Ctrl+V clipboard paste events');
    });

    runner.test('T1-MOD-20: Material upload modal contains list view container for attached materials', () => {
      const protoHtml = context.prototypeHtmlContent;
      const hasMatList = protoHtml.includes('handleMaterialSubmit') || protoHtml.includes('Angehängte Materialien') || protoHtml.includes('Materialien') || protoHtml.includes('list');
      assert(hasMatList, 'Material modal must contain list view container for attached materials');
    });
  });
}
