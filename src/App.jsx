import React, { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
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
import ReminderModal from './components/modals/ReminderModal';
import MoveCategoryModal from './components/modals/MoveCategoryModal';
import MoveStatusModal from './components/modals/MoveStatusModal';

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
import Trash from './components/screens/Trash';

function AppContent() {
  const [currentScreen, setCurrentScreen] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user } = useAuth();

  const screenTitles = {
    dashboard: 'Dashboard',
    inbox: 'Inbox',
    reminders: 'Erinnerungen',
    projects: 'Projekte',
    board: 'Kanban Board',
    'project-detail': 'Projekt Details',
    calendar: 'Kalender',
    coach: 'AI Coach',
    review: 'Wöchentlicher Rückblick',
    trash: 'Papierkorb'
  };

  const title = screenTitles[currentScreen] || 'FocusFlow';

  // If the user is not logged in, render only the Login screen
  if (!user) {
    return <Login />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-primary antialiased font-sans">
      <Sidebar
        currentScreen={currentScreen}
        setCurrentScreen={setCurrentScreen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      <main className="flex-grow min-w-0 overflow-y-auto relative pb-20 md:pb-0 h-full flex flex-col">
        <div className={`mx-auto w-full flex-grow flex flex-col ${currentScreen === 'coach' ? 'p-0 max-w-none' : 'max-w-none px-2 sm:px-4 md:px-8 py-4 sm:py-8'}`}>
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
          {currentScreen === 'trash' && <Trash setCurrentScreen={setCurrentScreen} />}
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
      <ReminderModal setCurrentScreen={setCurrentScreen} />
      <MoveCategoryModal />
      <MoveStatusModal />
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
