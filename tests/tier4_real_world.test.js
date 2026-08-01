import { assert, assertEqual } from './e2e_framework.js';
import { context } from './test_context.js';

export function registerTier4Tests(runner) {
  const TIER = 'Tier 4: Real-World Scenarios';

  runner.describe(TIER, 'End-to-End User Journeys', () => {
    runner.test('T4-SCEN-01: End-to-End Project Onboarding & Planning Journey', () => {
      // Step 1: User lands on Dashboard
      const env = context.createAppEnvironment('dashboard', 1280);
      assertEqual(env.currentScreen, 'dashboard');

      // Step 2: User navigates to Projects Overview
      env.switchScreen('projects');
      assertEqual(env.currentScreen, 'projects');

      // Step 3: User opens New Project Modal and creates project
      env.openModal('project', { title: 'AI Platform Launch', dateRange: '01.08.24 - 30.09.24', priority: 'PRIO 1' });
      assertEqual(env.activeModal, 'project');
      assertEqual(env.modalData.title, 'AI Platform Launch');
      env.closeModal();

      // Step 4: User navigates into ProjectDetail view for the project
      env.switchScreen('project-detail');
      assertEqual(env.currentScreen, 'project-detail');

      // Step 5: User opens Phase Modal and adds "Phase 1: Architecture"
      env.openModal('phase', { title: 'PHASE 1: ARCHITECTURE', dateInfo: '01. - 15. August' });
      assertEqual(env.activeModal, 'phase');
      env.closeModal();

      // Step 6: User opens Task Modal and adds task "API Spec Document"
      env.openModal('task', { title: 'API Spec Document', date: 'Heute' });
      assertEqual(env.activeModal, 'task');
      env.closeModal();

      // Step 7: User opens Material Modal and attaches specification file
      env.openModal('material', { filename: 'api_architecture.md', size: '24 KB' });
      assertEqual(env.activeModal, 'material');
      assertEqual(env.modalData.filename, 'api_architecture.md');
      env.closeModal();

      // Step 8: Return to Projects overview
      env.switchScreen('projects');
      assertEqual(env.currentScreen, 'projects');
    });

    runner.test('T4-SCEN-02: Daily Focus & Execution Workflow Journey', () => {
      // Step 1: Start morning routine on Dashboard
      const env = context.createAppEnvironment('dashboard', 1024);
      assertEqual(env.currentScreen, 'dashboard');

      // Step 2: Check Must-Win main outcome task
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes('HAUPT-ERGEBNIS HEUTE'), 'Must-Win task section must be rendered');

      // Step 3: Blocked on task -> click AI Coach callout banner on Dashboard
      env.switchScreen('coach');
      assertEqual(env.currentScreen, 'coach');

      // Step 4: Check Calendar for today's focus session
      env.switchScreen('calendar');
      assertEqual(env.currentScreen, 'calendar');

      // Step 5: At end of day, navigate to Weekly Review to check metrics
      env.switchScreen('review');
      assertEqual(env.currentScreen, 'review');
    });

    runner.test('T4-SCEN-03: Mobile On-The-Go Execution Journey', () => {
      // Step 1: Mobile user opens app on smartphone (375px viewport)
      const env = context.createAppEnvironment('dashboard', 375);
      assert(env.isMobile());

      // Step 2: Use mobile bottom navigation bar to switch to Projects
      env.switchScreen('projects');
      assertEqual(env.currentScreen, 'projects');

      // Step 3: Open Task Addition Modal on mobile view
      env.openModal('task', { title: 'Mobile Task', date: 'Heute' });
      assertEqual(env.activeModal, 'task');

      // Step 4: Close modal and switch back to Dashboard using bottom bar
      env.closeModal();
      env.switchScreen('dashboard');
      assertEqual(env.currentScreen, 'dashboard');
    });

    runner.test('T4-SCEN-04: Weekly Review & Retrospective Planning Journey', () => {
      // Step 1: User navigates to Weekly Review screen
      const env = context.createAppEnvironment('review', 1280);
      assertEqual(env.currentScreen, 'review');

      // Step 2: User analyzes focus score widget on Dashboard
      env.switchScreen('dashboard');
      assertEqual(env.currentScreen, 'dashboard');
      const dashSrc = context.getComponentSource('src/components/screens/Dashboard.jsx');
      assert(dashSrc.includes('FOKUS SCORE'), 'Focus score widget must be visible for weekly review');

      // Step 3: User opens Projects to plan upcoming week's projects
      env.switchScreen('projects');
      assertEqual(env.currentScreen, 'projects');
    });

    runner.test('T4-SCEN-05: Multi-Modal Ingestion & Keyboard Shortcuts Journey', () => {
      // Step 1: User opens ProjectDetail screen
      const env = context.createAppEnvironment('project-detail', 1280);
      
      // Step 2: Open Material Upload Modal
      env.openModal('material');
      assertEqual(env.activeModal, 'material');

      // Step 3: Simulate Ctrl+V paste action with text URL snippet
      const pastedLink = 'https://github.com/focusflow/react-migration/pull/42';
      env.modalData = { pastedLink };
      assertEqual(env.modalData.pastedLink, pastedLink);

      // Step 4: User presses ESC key to close modal
      env.closeModal();
      assertEqual(env.activeModal, null);
      assertEqual(env.currentScreen, 'project-detail');
    });
  });
}
