import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import Sidebar from './components/layout/Sidebar';
import BottomNav from './components/layout/BottomNav';
import { ModalProvider, useModal } from './context/ModalContext';
import { DataProvider, useData } from './context/DataContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import FirestoreErrorBanner from './components/ui/FirestoreErrorBanner';
import ErrorBoundary from './components/ErrorBoundary';

// Modals
import ProjectModal from './components/modals/ProjectModal';
import PhaseModal from './components/modals/PhaseModal';
import TaskModal from './components/modals/TaskModal';
import MaterialModal from './components/modals/MaterialModal';
import ProjectHistoryModal from './components/modals/ProjectHistoryModal';
import SettingsModal from './components/modals/SettingsModal';
import ReminderModal from './components/modals/ReminderModal';
import MoveCategoryModal from './components/modals/MoveCategoryModal';
import MoveStatusModal from './components/modals/MoveStatusModal';
import GuestWelcomeModal from './components/modals/GuestWelcomeModal';
import CommandPalette from './components/ui/CommandPalette';
import QuickCaptureDialog from './components/ui/QuickCaptureDialog';
import ShortcutsHelp from './components/ui/ShortcutsHelp';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

// Screens
import Dashboard from './components/screens/Dashboard';
import Inbox from './components/screens/Inbox';
import Projects from './components/screens/Projects';
import Login from './components/screens/Login';
import BrandFlight from './components/brand/BrandFlight';
import Reminders from './components/screens/Reminders';
import EmailVerificationScreen from './components/screens/EmailVerificationScreen';
import {
  BREAKPOINTS,
  isDesktopViewport,
  readStoredDesktopCollapsed,
  writeStoredDesktopCollapsed
} from './lib/breakpoints';
import { getLegalPageFromPath } from './lib/legal';
import { consumeLaunchAction } from './lib/launchAction';
import { SkeletonList } from './components/ds';

// Große bzw. seltener genutzte Screens erst bei Bedarf laden (Code-Splitting)
const ProjectDetail = lazy(() => import('./components/screens/ProjectDetail'));
const Calendar = lazy(() => import('./components/screens/Calendar'));
const Coach = lazy(() => import('./components/screens/Coach'));
const Review = lazy(() => import('./components/screens/Review'));
const ProjectsBoard = lazy(() => import('./components/screens/ProjectsBoard'));
const ReminderDetail = lazy(() => import('./components/screens/ReminderDetail'));
const Trash = lazy(() => import('./components/screens/Trash'));
const LegalPage = lazy(() => import('./components/screens/LegalPage'));

function ScreenFallback() {
  return (
    <div className="flex-1 min-h-[40vh] w-full" aria-busy="true">
      <SkeletonList count={3} />
    </div>
  );
}

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [viewportWidth, setViewportWidth] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth : 1200
  ));
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => (
    readStoredDesktopCollapsed()
  ));
  const [tabletDrawerOpen, setTabletDrawerOpen] = useState(false);

  const isDesktop = isDesktopViewport(viewportWidth);
  const effectiveSidebarCollapsed = isDesktop ? desktopCollapsed : !tabletDrawerOpen;

  const handleSetSidebarCollapsed = (valueOrFn) => {
    if (isDesktop) {
      setDesktopCollapsed((prev) => {
        const next = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn;
        writeStoredDesktopCollapsed(next);
        return next;
      });
    } else {
      setTabletDrawerOpen((prev) => {
        const currentCollapsed = !prev;
        const nextCollapsed = typeof valueOrFn === 'function' ? valueOrFn(currentCollapsed) : valueOrFn;
        return !nextCollapsed;
      });
    }
  };

  const { user } = useAuth();
  const { firestoreError, clearFirestoreError, setSelectedProjectId, setSelectedReminderId } = useData();
  const { openModal, activeModal } = useModal();

  // Befehlsleiste, Schnellerfassung & Kürzel-Übersicht (PC)
  const [overlay, setOverlay] = useState(null); // 'palette' | 'capture' | 'shortcuts' | null
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const navigateTo = useCallback((screen) => setCurrentScreen(screen), []);
  const openProject = useCallback((id) => {
    setSelectedProjectId(id);
    setCurrentScreen('project-detail');
  }, [setSelectedProjectId]);
  const openReminder = useCallback((id) => {
    setSelectedReminderId(id);
    setCurrentScreen('reminder-detail');
  }, [setSelectedReminderId]);
  const runAction = useCallback((action) => {
    if (action === 'new-thought') setOverlay('capture');
    else if (action === 'new-reminder') openModal('reminder');
    else if (action === 'new-project') openModal('project');
    else if (action === 'settings') openModal('settings');
    else if (action === 'shortcuts') setOverlay('shortcuts');
    // openModal ist nicht memoisiert; Aktionen lesen immer den aktuellen Stand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // App-Kurzbefehle (Manifest „shortcuts“): Aktion aus der Start-URL lesen und nach dem Login ausführen
  const [launchAction, setLaunchAction] = useState(() => consumeLaunchAction());
  const [autoStartVoice, setAutoStartVoice] = useState(false);
  const isReady = Boolean(user) && (user.isGuest || user.emailVerified);

  useEffect(() => {
    if (!launchAction || !isReady) return;
    if (launchAction === 'voice-thought') {
      setCurrentScreen('inbox');
      setAutoStartVoice(true);
    } else if (launchAction === 'new-reminder') {
      setCurrentScreen('reminders');
      openModal('reminder');
    }
    setLaunchAction(null);
  }, [launchAction, isReady]);

  useGlobalShortcuts({
    enabled: isReady,
    isBlocked: () => Boolean(overlay || activeModal || document.querySelector('[aria-modal="true"]')),
    onOpenPalette: () => setOverlay('palette'),
    onNavigate: navigateTo,
    onAction: runAction,
  });

  // Responsive resize handler with rAF throttling and state preservation
  useEffect(() => {
    let prevWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    let rAFId = null;

    const handleResize = () => {
      if (rAFId) cancelAnimationFrame(rAFId);
      rAFId = requestAnimationFrame(() => {
        const currentWidth = window.innerWidth;
        setViewportWidth(currentWidth);

        if (currentWidth < BREAKPOINTS.DESKTOP && prevWidth >= BREAKPOINTS.DESKTOP) {
          // Entering tablet mode: ensure overlay starts closed without touching desktop preference
          setTabletDrawerOpen(false);
        } else if (currentWidth >= BREAKPOINTS.DESKTOP && prevWidth < BREAKPOINTS.DESKTOP) {
          // Returning to desktop mode: cleanly restore saved user preference
          setDesktopCollapsed(readStoredDesktopCollapsed());
        }
        prevWidth = currentWidth;
      });
    };

    // Multi-tab storage sync
    const handleStorageChange = (e) => {
      if (e.key === 'focusflow_sidebar_desktop_collapsed' && typeof window !== 'undefined' && isDesktopViewport(window.innerWidth)) {
        setDesktopCollapsed(e.newValue === 'true');
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      if (rAFId) cancelAnimationFrame(rAFId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const screenTitles = {
    dashboard: 'Home',
    inbox: 'Gedanken',
    reminders: 'Erinnerungen',
    projects: 'Projekte',
    board: 'Kanban Board',
    'project-detail': 'Projektdetails',
    'reminder-detail': 'Erinnerungsdetails',
    calendar: 'Kalender',
    coach: 'Fio',
    review: 'Wochenrückblick',
    trash: 'Papierkorb'
  };

  const title = screenTitles[currentScreen] || 'FocusFlow';

  // If the user is not logged in, render only the Login screen
  if (!user) {
    return <Login />;
  }

  // If the user is logged in via email/password but not yet verified, require email verification
  if (!user.isGuest && !user.emailVerified) {
    return <EmailVerificationScreen />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen h-[100dvh] overflow-hidden bg-canvas text-primary font-sans">
      <Sidebar
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
        collapsed={effectiveSidebarCollapsed}
        setCollapsed={handleSetSidebarCollapsed}
      />

      {/* Main Content Area + Flow-based Mobile BottomNav */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        <main className={`flex-1 min-w-0 relative flex flex-col min-h-0 ${
          currentScreen === 'coach' || currentScreen === 'calendar' || currentScreen === 'board'
            ? 'overflow-hidden' 
            : 'overflow-y-auto no-scrollbar'
        }`}>
          <div key={currentScreen} className={`screen-transition mx-auto w-full flex-grow flex flex-col ${
            currentScreen === 'coach' 
              ? 'p-0 max-w-none h-full overflow-hidden' 
              : currentScreen === 'calendar'
              ? 'max-w-none p-0 md:px-6 md:py-6 h-full min-h-0 overflow-hidden md:overflow-visible'
              : currentScreen === 'board'
              ? 'max-w-none px-4 md:px-6 py-4 md:py-6 h-full min-h-0 overflow-hidden'
              : 'max-w-content px-4 md:px-6 py-6 md:py-8'
          }`}>
            {firestoreError && currentScreen !== 'coach' && (
              <FirestoreErrorBanner error={firestoreError} onDismiss={clearFirestoreError} />
            )}
            <ErrorBoundary variant="screen" resetKey={currentScreen}>
              <Suspense fallback={<ScreenFallback />}>
                {currentScreen === 'dashboard' && <Dashboard setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'inbox' && (
                  <Inbox
                    setCurrentScreen={setCurrentScreen}
                    autoStartVoice={autoStartVoice}
                    onAutoStartConsumed={() => setAutoStartVoice(false)}
                  />
                )}
                {currentScreen === 'reminders' && <Reminders setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'reminder-detail' && <ReminderDetail setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'projects' && <Projects setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'board' && <ProjectsBoard setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'project-detail' && <ProjectDetail setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'calendar' && <Calendar />}
                {currentScreen === 'coach' && <Coach setCurrentScreen={setCurrentScreen} />}
                {currentScreen === 'review' && <Review />}
                {currentScreen === 'trash' && <Trash setCurrentScreen={setCurrentScreen} />}
              </Suspense>
            </ErrorBoundary>
          </div>
        </main>

        <BottomNav currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />
      </div>

      {/* Render All Interactive Modals */}
      <ProjectModal setCurrentScreen={setCurrentScreen} />
      <PhaseModal />
      <TaskModal />
      <MaterialModal />
      <ProjectHistoryModal />
      <SettingsModal />
      <ReminderModal setCurrentScreen={setCurrentScreen} />
      <MoveCategoryModal />
      <MoveStatusModal />
      <GuestWelcomeModal />
      <CommandPalette
        open={overlay === 'palette'}
        onClose={closeOverlay}
        onNavigate={navigateTo}
        onAction={runAction}
        onOpenProject={openProject}
        onOpenReminder={openReminder}
      />
      <QuickCaptureDialog
        open={overlay === 'capture'}
        onClose={closeOverlay}
        onOpenThoughts={() => setCurrentScreen('inbox')}
      />
      <ShortcutsHelp open={overlay === 'shortcuts'} onClose={closeOverlay} />
      <BrandFlight />
    </div>
  );
}

function App() {
  // Impressum & Datenschutz müssen ohne Login erreichbar sein
  const legalPage = typeof window !== 'undefined' ? getLegalPageFromPath(window.location.pathname) : null;
  if (legalPage) {
    return (
      <Suspense fallback={<ScreenFallback />}>
        <LegalPage page={legalPage} />
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>
          <DataProvider>
            <ModalProvider>
              <ChatProvider>
                <AppContent />
              </ChatProvider>
            </ModalProvider>
          </DataProvider>
        </ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
