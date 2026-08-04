import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import BottomNav from './components/layout/BottomNav';
import { ModalProvider } from './context/ModalContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// Modals
import ProjectModal from './components/modals/ProjectModal';
import PhaseModal from './components/modals/PhaseModal';
import TaskModal from './components/modals/TaskModal';
import MaterialModal from './components/modals/MaterialModal';
import ProjectHistoryModal from './components/modals/ProjectHistoryModal';
import ProfileModal from './components/modals/ProfileModal';

// Screens
import Dashboard from './components/screens/Dashboard';
import Inbox from './components/screens/Inbox';
import Projects from './components/screens/Projects';
import ProjectDetail from './components/screens/ProjectDetail';
import Calendar from './components/screens/Calendar';
import Coach from './components/screens/Coach';
import Review from './components/screens/Review';
import Login from './components/screens/Login';
import ProjectsBoard from './components/screens/ProjectsBoard';
import Reminders from './components/screens/Reminders';
import ReminderDetail from './components/screens/ReminderDetail';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  // If the user is not logged in, render only the Login screen
  if (!user) {
    return <Login />;
  }

  // Breadcrumb title rendering
  const renderTopbarTitle = () => {
    if (currentScreen === 'project-detail') {
      return (
        <div className="flex items-center gap-1.5 text-base sm:text-lg font-semibold">
          <button
            className="hover:underline text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => setCurrentScreen('projects')}
          >
            Projekte
          </button>
          <span className="text-on-surface-variant text-sm">›</span>
          <span className="text-primary">Projektdetails</span>
        </div>
      );
    }

    const titles = {
      dashboard: 'Dashboard',
      inbox: 'Inbox',
      reminders: 'Erinnerungen',
      projects: 'Projekte',
      board: 'Kanban Board',
      calendar: 'Kalender',
      coach: 'AI Coach',
      review: 'Wochenrückblick',
    };
    return titles[currentScreen] || 'FocusFlow';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary antialiased font-sans">
      <Sidebar
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <main className="flex-grow min-w-0 overflow-y-auto relative pb-20 md:pb-0 h-full flex flex-col">
        <Topbar title={renderTopbarTitle()} />

        <div className={`mx-auto w-full flex-grow flex flex-col ${currentScreen === 'board' ? 'px-2 sm:px-4 md:px-8 py-4 sm:py-8' : 'max-w-[1400px] px-2 sm:px-4 md:px-8 py-4 sm:py-8'}`}>
          {currentScreen === 'dashboard' && <Dashboard setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'inbox' && <Inbox setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'reminders' && <Reminders setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'reminder-detail' && <ReminderDetail setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'projects' && <Projects setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'board' && <ProjectsBoard setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'project-detail' && <ProjectDetail setCurrentScreen={setCurrentScreen} />}
          {currentScreen === 'calendar' && <Calendar />}
          {currentScreen === 'coach' && <Coach />}
          {currentScreen === 'review' && <Review />}
        </div>
      </main>

      <BottomNav currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />

      {/* Render All Interactive Modals */}
      <ProjectModal setCurrentScreen={setCurrentScreen} />
      <PhaseModal />
      <TaskModal />
      <MaterialModal />
      <ProjectHistoryModal />
      <ProfileModal />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ModalProvider>
        <AppContent />
      </ModalProvider>
    </AuthProvider>
  );
}

export default App;
