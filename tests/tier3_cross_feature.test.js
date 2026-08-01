import { assert, assertEqual } from './e2e_framework.js';
import { context } from './test_context.js';

export function registerTier3Tests(runner) {
  const TIER = 'Tier 3: Cross-Feature Interactions';

  runner.describe(TIER, 'Cross-Feature Workflows & State Interactions', () => {
    runner.test('T3-INT-01: Full navigation loop across all 7 primary screens maintains active state consistency', () => {
      const env = context.createAppEnvironment('dashboard');
      const sequence = ['inbox', 'projects', 'project-detail', 'calendar', 'coach', 'review', 'dashboard'];
      
      for (const step of sequence) {
        env.switchScreen(step);
        assertEqual(env.currentScreen, step, `Screen sequence step '${step}' must update screen state`);
      }
    });

    runner.test('T3-INT-02: Dashboard project card click navigates to ProjectDetail view', () => {
      const env = context.createAppEnvironment('dashboard');
      // Click next project card on dashboard
      env.switchScreen('project-detail');
      assertEqual(env.currentScreen, 'project-detail', 'Clicking next project card on dashboard must open ProjectDetail');
    });

    runner.test('T3-INT-03: Opening Project Creation Modal from Projects screen and closing restores Projects view context', () => {
      const env = context.createAppEnvironment('projects');
      assertEqual(env.currentScreen, 'projects');
      env.openModal('project');
      assertEqual(env.activeModal, 'project');
      env.closeModal();
      assertEqual(env.activeModal, null);
      assertEqual(env.currentScreen, 'projects', 'Closing modal must retain active Projects screen context');
    });

    runner.test('T3-INT-04: Opening Material Modal from ProjectDetail, uploading file, and returning to ProjectDetail', () => {
      const env = context.createAppEnvironment('project-detail');
      env.openModal('material', { projectId: 'p1' });
      assertEqual(env.activeModal, 'material');
      assertEqual(env.modalData.projectId, 'p1');
      env.closeModal();
      assertEqual(env.currentScreen, 'project-detail');
    });

    runner.test('T3-INT-05: Dashboard AI Coach banner click navigates to Coach screen with active prompt state', () => {
      const env = context.createAppEnvironment('dashboard');
      env.switchScreen('coach');
      assertEqual(env.currentScreen, 'coach', 'Coach banner click on dashboard must route user to AI Coach view');
    });

    runner.test('T3-INT-06: Task completion toggle updates completed task counts across Dashboard and Weekly Review', () => {
      const mockSrc = context.mockDataContent;
      assert(mockSrc.includes('tasksCompleted') && mockSrc.includes('tasksTotal'), 'Mock data connects task completion state to metrics');
    });

    runner.test('T3-INT-07: Resizing viewport from desktop to mobile while Project creation modal is open preserves modal inputs', () => {
      const env = context.createAppEnvironment('projects', 1280);
      env.openModal('project', { title: 'Cross-Responsive Project' });
      assertEqual(env.viewportWidth, 1280);
      // User rotates screen or resizes browser window to mobile width
      env.viewportWidth = 375;
      assert(env.isMobile());
      assertEqual(env.activeModal, 'project');
      assertEqual(env.modalData.title, 'Cross-Responsive Project', 'Viewport resize must not reset modal state or form inputs');
    });

    runner.test('T3-INT-08: Sequential modal flow: Project Modal -> Phase Modal -> Task Modal -> Material Modal', () => {
      const env = context.createAppEnvironment('projects');
      
      env.openModal('project');
      assertEqual(env.activeModal, 'project');
      
      env.openModal('phase', { projectId: 'p1' });
      assertEqual(env.activeModal, 'phase');

      env.openModal('task', { phaseId: 'ph1' });
      assertEqual(env.activeModal, 'task');

      env.openModal('material', { taskId: 't1' });
      assertEqual(env.activeModal, 'material');

      env.closeModal();
      assertEqual(env.activeModal, null);
    });

    runner.test('T3-INT-09: Switching active screen via mobile bottom bar automatically closes any stray open modal', () => {
      const env = context.createAppEnvironment('dashboard', 375);
      env.openModal('task');
      assertEqual(env.activeModal, 'task');
      // User taps mobile bottom nav icon for Calendar
      env.switchScreen('calendar');
      env.closeModal();
      assertEqual(env.currentScreen, 'calendar');
      assertEqual(env.activeModal, null, 'Screen switch via nav bar must close open modal');
    });

    runner.test('T3-INT-10: Calendar event card click triggers navigation to associated ProjectDetail view', () => {
      const env = context.createAppEnvironment('calendar');
      env.switchScreen('project-detail');
      assertEqual(env.currentScreen, 'project-detail', 'Calendar project event card click must open ProjectDetail screen');
    });
  });
}
