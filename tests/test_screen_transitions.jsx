import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { E2ETestRunner, assert, assertEqual, assertContains } from './e2e_framework.js';
import App from '../src/App.jsx';
import Sidebar from '../src/components/layout/Sidebar.jsx';
import BottomNav from '../src/components/layout/BottomNav.jsx';

// Set up JSDOM environment globally for React rendering
const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:3000',
});

global.window = dom.window;
global.document = dom.window.document;
if (!global.navigator) {
  Object.defineProperty(global, 'navigator', {
    value: dom.window.navigator,
    configurable: true,
    writable: true
  });
}
global.HTMLElement = dom.window.HTMLElement;
global.HTMLInputElement = dom.window.HTMLInputElement;

// Polyfill scrollIntoView for JSDOM if missing
if (!dom.window.HTMLElement.prototype.scrollIntoView) {
  dom.window.HTMLElement.prototype.scrollIntoView = function () {};
}

const runner = new E2ETestRunner();

let container = null;
let currentRoot = null;

function renderApp() {
  if (currentRoot) {
    act(() => {
      currentRoot.unmount();
    });
    currentRoot = null;
  }
  container = document.getElementById('root');
  container.innerHTML = '';
  currentRoot = createRoot(container);
  act(() => {
    currentRoot.render(<App />);
  });
}

function cleanup() {
  if (currentRoot) {
    act(() => {
      currentRoot.unmount();
    });
    currentRoot = null;
  }
  if (container) {
    container.innerHTML = '';
  }
}

runner.describe('Tier 1: Feature Coverage', 'Milestone 1 Screen Active State & Transition Matrix', () => {
  runner.test('1. Initial Load: Dashboard is active with title "Dashboard"', () => {
    renderApp();
    const titleElement = container.querySelector('header span');
    assertEqual(titleElement.textContent.trim(), 'Dashboard', 'Topbar should display Dashboard on initial load');

    const activeSidebarBtn = container.querySelector('aside nav button.border-r-2');
    assert(activeSidebarBtn !== null, 'Sidebar should have an active button');
    assertContains(activeSidebarBtn.textContent, 'Home', 'Sidebar active item should be Home (dashboard)');

    const activeBottomNavBtn = container.querySelector('nav.fixed button.text-primary.font-bold');
    assert(activeBottomNavBtn !== null, 'BottomNav should have an active button');
    assertContains(activeBottomNavBtn.textContent, 'Home', 'BottomNav active item should be Home (dashboard)');

    cleanup();
  });

  const screensToTest = [
    { id: 'dashboard', label: 'Home', expectedTitle: 'Dashboard', expectedText: 'Guten Morgen, Fabian' },
    { id: 'inbox', label: 'Inbox', expectedTitle: 'Inbox', expectedText: 'WAS GEHT DIR DURCH DEN KOPF?' },
    { id: 'projects', label: 'Projekte', expectedTitle: 'Projekte', checkFn: (cont) => cont.querySelector('input[placeholder="Projekte durchsuchen..."]') !== null },
    { id: 'calendar', label: 'Kalender', expectedTitle: 'Kalender', expectedText: 'Kalender-Integration' },
    { id: 'coach', label: 'AI Coach', expectedTitle: 'AI Coach', expectedText: 'AI Coach' },
    { id: 'review', label: 'Wochenrückblick', expectedTitle: 'Wochenrückblick', expectedText: 'Wochenrückblick' },
  ];

  screensToTest.forEach(({ id, label, expectedTitle, expectedText, checkFn }) => {
    runner.test(`2. Sidebar transition to screen: ${id}`, () => {
      renderApp();

      const sidebarButtons = Array.from(container.querySelectorAll('aside nav button'));
      const targetBtn = sidebarButtons.find(btn => btn.textContent.includes(label));
      assert(targetBtn !== undefined, `Sidebar button for ${id} (${label}) should exist`);

      act(() => {
        targetBtn.click();
      });

      const titleElement = container.querySelector('header span');
      assertEqual(titleElement.textContent.trim(), expectedTitle, `Topbar title should be ${expectedTitle}`);

      const mainContent = container.querySelector('main');
      if (checkFn) {
        assert(checkFn(mainContent), `Custom check failed for ${id}`);
      } else {
        assertContains(mainContent.textContent, expectedText, `Main screen content should include '${expectedText}'`);
      }

      const activeSidebarBtn = container.querySelector('aside nav button.border-r-2');
      assert(activeSidebarBtn !== null, `Sidebar active highlight missing for ${id}`);
      assertContains(activeSidebarBtn.textContent, label, `Sidebar active item should be ${label}`);

      const activeBottomNavBtn = container.querySelector('nav.fixed button.text-primary.font-bold');
      assert(activeBottomNavBtn !== null, `BottomNav active highlight missing for ${id}`);
      assertContains(activeBottomNavBtn.textContent, label === 'AI Coach' ? 'Coach' : (label === 'Wochenrückblick' ? 'Review' : label), `BottomNav active item label match`);

      cleanup();
    });
  });

  screensToTest.forEach(({ id, label, expectedTitle, expectedText, checkFn }) => {
    const bottomNavLabel = id === 'coach' ? 'Coach' : (id === 'review' ? 'Review' : label);
    runner.test(`3. BottomNav transition to screen: ${id}`, () => {
      renderApp();

      const bottomNavButtons = Array.from(container.querySelectorAll('nav.fixed button'));
      const targetBtn = bottomNavButtons.find(btn => btn.textContent.includes(bottomNavLabel));
      assert(targetBtn !== undefined, `BottomNav button for ${id} (${bottomNavLabel}) should exist`);

      act(() => {
        targetBtn.click();
      });

      const titleElement = container.querySelector('header span');
      assertEqual(titleElement.textContent.trim(), expectedTitle, `Topbar title should be ${expectedTitle}`);

      const mainContent = container.querySelector('main');
      if (checkFn) {
        assert(checkFn(mainContent), `Custom check failed for ${id}`);
      } else {
        assertContains(mainContent.textContent, expectedText, `Main screen content should include '${expectedText}'`);
      }

      cleanup();
    });
  });
});

runner.describe('Tier 2: Boundary & Corner Cases', 'Sub-screen Navigation and Fallbacks', () => {
  runner.test('1. Sub-screen project-detail highlights parent "Projekte" tab in Sidebar & BottomNav', () => {
    renderApp();

    const sidebarButtons = Array.from(container.querySelectorAll('aside nav button'));
    const projectsBtn = sidebarButtons.find(btn => btn.textContent.includes('Projekte'));
    act(() => {
      projectsBtn.click();
    });

    const projectCard = container.querySelector('main .cursor-pointer');
    assert(projectCard !== null, 'Project card should exist on Projects screen');

    act(() => {
      projectCard.click();
    });

    const titleElement = container.querySelector('header span');
    assertEqual(titleElement.textContent.trim(), 'Projekt Details', 'Topbar title should be "Projekt Details"');

    const mainContent = container.querySelector('main');
    assertContains(mainContent.textContent, 'Projekt Phasen', 'Project detail content loaded');

    const activeSidebarBtn = container.querySelector('aside nav button.border-r-2');
    assert(activeSidebarBtn !== null, 'Sidebar should highlight active item during sub-screen');
    assertContains(activeSidebarBtn.textContent, 'Projekte', 'Sidebar should highlight parent "Projekte" during project-detail');

    const activeBottomNavBtn = container.querySelector('nav.fixed button.text-primary.font-bold');
    assert(activeBottomNavBtn !== null, 'BottomNav should highlight active item during sub-screen');
    assertContains(activeBottomNavBtn.textContent, 'Projekte', 'BottomNav should highlight parent "Projekte" during project-detail');

    const backBtn = container.querySelector('main button');
    act(() => {
      backBtn.click();
    });

    const updatedTitle = container.querySelector('header span');
    assertEqual(updatedTitle.textContent.trim(), 'Projekte', 'Navigated back to Projects screen');

    cleanup();
  });

  runner.test('2. In-screen navigation: Dashboard KI-Coach card -> Coach screen', () => {
    renderApp();

    const coachTrigger = container.querySelector('main div[class*="cursor-pointer"]');
    assert(coachTrigger !== null, 'Coach trigger card should exist on Dashboard');
    assertContains(coachTrigger.textContent, 'ANFANGSHILFE', 'Should be the AI Coach trigger card');

    act(() => {
      coachTrigger.click();
    });

    const titleElement = container.querySelector('header span');
    assertEqual(titleElement.textContent.trim(), 'AI Coach', 'Topbar title should switch to "AI Coach"');

    const mainContent = container.querySelector('main');
    assertContains(mainContent.textContent, 'AI Coach', 'Coach screen rendered');

    cleanup();
  });

  runner.test('3. In-screen navigation: Dashboard "NÄCHSTES PROJEKT" widget -> project-detail', () => {
    renderApp();

    const nextProjectWidgets = Array.from(container.querySelectorAll('main div[class*="cursor-pointer"]'));
    const nextProjectWidget = nextProjectWidgets.find(w => w.textContent.includes('NÄCHSTES PROJEKT'));
    assert(nextProjectWidget !== undefined, 'Next Project widget card should exist on Dashboard');

    act(() => {
      nextProjectWidget.click();
    });

    const titleElement = container.querySelector('header span');
    assertEqual(titleElement.textContent.trim(), 'Projekt Details', 'Topbar title should switch to "Projekt Details"');

    const mainContent = container.querySelector('main');
    assertContains(mainContent.textContent, 'Projekt Phasen', 'ProjectDetail screen rendered from Dashboard shortcut');

    cleanup();
  });

  runner.test('4. Standalone Sidebar active state test for custom props', () => {
    let dummyScreen = 'review';
    const setScreen = (val) => { dummyScreen = val; };

    const sidebarContainer = document.createElement('div');
    const sRoot = createRoot(sidebarContainer);

    act(() => {
      sRoot.render(<Sidebar currentScreen={dummyScreen} setCurrentScreen={setScreen} />);
    });

    const activeBtn = sidebarContainer.querySelector('button.border-r-2');
    assert(activeBtn !== null, 'Sidebar renders active button for "review"');
    assertContains(activeBtn.textContent, 'Wochenrückblick');

    act(() => {
      sRoot.unmount();
    });
  });

  runner.test('5. Standalone BottomNav active state test for project-detail sub-screen', () => {
    let dummyScreen = 'project-detail';
    const setScreen = (val) => { dummyScreen = val; };

    const navContainer = document.createElement('div');
    const nRoot = createRoot(navContainer);

    act(() => {
      nRoot.render(<BottomNav currentScreen={dummyScreen} setCurrentScreen={setScreen} />);
    });

    const activeBtn = navContainer.querySelector('button.text-primary.font-bold');
    assert(activeBtn !== null, 'BottomNav renders active button for sub-screen "project-detail"');
    assertContains(activeBtn.textContent, 'Projekte');

    act(() => {
      nRoot.unmount();
    });
  });
});

runner.describe('Tier 3: Cross-Feature Interactions', 'Full Navigation Loop & Rapid Switching', () => {
  runner.test('1. Rapid sequential screen navigation across all 6 screens and back', () => {
    renderApp();

    const sequence = [
      { nav: 'inbox', title: 'Inbox' },
      { nav: 'projects', title: 'Projekte' },
      { nav: 'calendar', title: 'Kalender' },
      { nav: 'coach', title: 'AI Coach' },
      { nav: 'review', title: 'Wochenrückblick' },
      { nav: 'dashboard', title: 'Dashboard' },
    ];

    for (const step of sequence) {
      const sidebarButtons = Array.from(container.querySelectorAll('aside nav button'));
      const targetLabel = step.nav === 'dashboard' ? 'Home' : (step.nav === 'projects' ? 'Projekte' : (step.nav === 'calendar' ? 'Kalender' : (step.nav === 'coach' ? 'AI Coach' : (step.nav === 'review' ? 'Wochenrückblick' : 'Inbox'))));
      const targetBtn = sidebarButtons.find(btn => btn.textContent.includes(targetLabel));
      assert(targetBtn !== undefined, `Button for ${step.nav} exists`);
      
      act(() => {
        targetBtn.click();
      });

      const titleElement = container.querySelector('header span');
      assertEqual(titleElement.textContent.trim(), step.title, `Sequence step ${step.nav} title matches`);
    }

    cleanup();
  });
});

async function main() {
  const success = await runner.run();
  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
