import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AuthContext
const mockAuth = {
  user: {
    uid: 'test-user-123',
    displayName: 'Max Mustermann',
    email: 'max@example.com',
    photoURL: '',
    emailVerified: true,
    isGuest: false,
    providerData: [{ providerId: 'password' }]
  },
  loading: false,
  isEmailVerified: true,
  isGoogleUser: false,
  isCalendarConnected: false,
  sendVerificationEmail: vi.fn(),
  reloadUser: vi.fn(),
  updateUserProfile: vi.fn(),
  changePassword: vi.fn(),
  linkGoogleCalendar: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
  logout: vi.fn()
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => mockAuth,
  AuthProvider: ({ children }) => children
}));

import SettingsModal, { resolveSettingsTab, VALID_TABS, DEFAULT_TAB } from '../src/components/modals/SettingsModal';
import { ModalProvider, useModal } from '../src/context/ModalContext';

// Helper component that can trigger openModal
function TestHarness({ initialModal = null, initialPayload = {} }) {
  const { openModal, closeModal } = useModal();

  React.useEffect(() => {
    if (initialModal) {
      openModal(initialModal, initialPayload);
    }
  }, [initialModal]);

  return (
    <div>
      <button 
        data-testid="trigger-account"
        onClick={() => openModal('settings', { initialTab: 'account' })}
      >
        Open Account
      </button>
      <button 
        data-testid="trigger-fio"
        onClick={() => openModal('settings', { initialTab: 'fio' })}
      >
        Open Fio
      </button>
      <button 
        data-testid="trigger-profile-legacy"
        onClick={() => openModal('profile')}
      >
        Open Profile Legacy
      </button>
      <button 
        data-testid="trigger-close"
        onClick={() => closeModal()}
      >
        Close
      </button>
      <SettingsModal />
    </div>
  );
}

describe('resolveSettingsTab contract', () => {
  it('resolves legacy "profile" modal to "account"', () => {
    expect(resolveSettingsTab('profile', {})).toBe('account');
    expect(resolveSettingsTab('profile', { initialTab: 'fio' })).toBe('account');
  });

  it('resolves valid tabs correctly for "settings"', () => {
    expect(resolveSettingsTab('settings', { initialTab: 'fio' })).toBe('fio');
    expect(resolveSettingsTab('settings', { initialTab: 'tutorials' })).toBe('tutorials');
    expect(resolveSettingsTab('settings', { initialTab: 'about' })).toBe('about');
    expect(resolveSettingsTab('settings', { initialTab: 'account' })).toBe('account');
  });

  it('falls back to "account" for unknown or missing initialTab', () => {
    expect(resolveSettingsTab('settings', { initialTab: 'unknown_tab' })).toBe('account');
    expect(resolveSettingsTab('settings', {})).toBe('account');
    expect(resolveSettingsTab('settings', null)).toBe('account');
  });
});

describe('SettingsModal Rendering & Tab Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.user = {
      uid: 'test-user-123',
      displayName: 'Max Mustermann',
      email: 'max@example.com',
      photoURL: '',
      emailVerified: true,
      isGuest: false,
      providerData: [{ providerId: 'password' }]
    };
    mockAuth.isGoogleUser = false;
    mockAuth.isCalendarConnected = false;
  });

  it('does not render when activeModal is null', () => {
    render(
      <ModalProvider>
        <TestHarness initialModal={null} />
      </ModalProvider>
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders correctly when opened via "settings" with default tab "account"', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeDefined();
    expect(screen.getByText('Einstellungen & Hilfe')).toBeDefined();

    // Active tab is 'account'
    const accountTab = screen.getByRole('tab', { name: /Mein Account/i });
    expect(accountTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Profil-Informationen')).toBeDefined();
  });

  it('renders correctly when opened via legacy "profile" trigger', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="profile" />
      </ModalProvider>
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeDefined();
    const accountTab = screen.getByRole('tab', { name: /Mein Account/i });
    expect(accountTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders Fio-Guide directly when opened with { initialTab: "fio" }', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'fio' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    const fioTab = screen.getByRole('tab', { name: /Fio KI-Guide/i });
    expect(fioTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Fio ist mehr als nur ein Chatbot/i)).toBeDefined();
    expect(screen.getByText(/Inspirierende Prompt-Vorlagen/i)).toBeDefined();
  });

  it('allows clicking between tabs and shows appropriate panels', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');

    // Click on Tutorials
    const tutorialsTab = screen.getByRole('tab', { name: /Hilfe & Guides/i });
    fireEvent.click(tutorialsTab);
    expect(tutorialsTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('FocusFlow Kern-Workflows')).toBeDefined();

    // Click on About
    const aboutTab = screen.getByRole('tab', { name: /Über FocusFlow/i });
    fireEvent.click(aboutTab);
    expect(aboutTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('System- & Versionsinformationen')).toBeDefined();

    // Click back to Account
    const accountTab = screen.getByRole('tab', { name: /Mein Account/i });
    fireEvent.click(accountTab);
    expect(accountTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('Profil-Informationen')).toBeDefined();
  });

  it('supports keyboard arrow navigation within tablist', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    const tablist = screen.getByRole('tablist');

    // Press ArrowDown to switch to Fio
    fireEvent.keyDown(tablist, { key: 'ArrowDown' });
    const fioTab = screen.getByRole('tab', { name: /Fio KI-Guide/i });
    expect(fioTab.getAttribute('aria-selected')).toBe('true');

    // Press ArrowDown to switch to Tutorials
    fireEvent.keyDown(tablist, { key: 'ArrowDown' });
    const tutTab = screen.getByRole('tab', { name: /Hilfe & Guides/i });
    expect(tutTab.getAttribute('aria-selected')).toBe('true');

    // Press ArrowUp to go back to Fio
    fireEvent.keyDown(tablist, { key: 'ArrowUp' });
    expect(fioTab.getAttribute('aria-selected')).toBe('true');

    // Press End to go to About
    fireEvent.keyDown(tablist, { key: 'End' });
    const aboutTab = screen.getByRole('tab', { name: /Über FocusFlow/i });
    expect(aboutTab.getAttribute('aria-selected')).toBe('true');

    // Press Home to go back to Account
    fireEvent.keyDown(tablist, { key: 'Home' });
    const accountTab = screen.getByRole('tab', { name: /Mein Account/i });
    expect(accountTab.getAttribute('aria-selected')).toBe('true');
  });

  it('closes when Escape key is pressed', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  it('preserves form edits in AccountSection during tab-switching within the open modal', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');

    // Edit displayName
    const nameInput = screen.getByLabelText('Anzeigename');
    fireEvent.change(nameInput, { target: { value: 'Fabian Neuer Name' } });
    expect(nameInput.value).toBe('Fabian Neuer Name');
    expect(screen.getByText('Ungespeichert')).toBeDefined();

    // Switch to Fio tab
    const fioTab = screen.getByRole('tab', { name: /Fio KI-Guide/i });
    fireEvent.click(fioTab);
    expect(screen.getByText(/Fio ist mehr als nur ein Chatbot/i)).toBeDefined();

    // Switch back to Account tab
    const accountTab = screen.getByRole('tab', { name: /Mein Account/i });
    fireEvent.click(accountTab);

    // Verify value is preserved!
    const updatedNameInput = screen.getByLabelText('Anzeigename');
    expect(updatedNameInput.value).toBe('Fabian Neuer Name');
  });

  it('toggles FAQ accordions in TutorialsSection with proper accessibility attributes', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'tutorials' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');

    const faqButton = screen.getByRole('button', { name: /Bleiben meine Daten im Gast-Modus gespeichert\?/i });
    expect(faqButton.getAttribute('aria-expanded')).toBe('false');

    // Click to open
    fireEvent.click(faqButton);
    expect(faqButton.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('region')).toBeDefined();
    expect(screen.getByText(/Ja! Im Gast-Modus werden alle erstellten Projekte/i)).toBeDefined();

    // Click to close
    fireEvent.click(faqButton);
    expect(faqButton.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('region')).toBeNull();
  });
});

describe('Prompt Clipboard copy behavior', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(true)
      }
    });
  });

  it('copies prompt to clipboard and shows visual feedback', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'fio' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');

    const copyButtons = screen.getAllByRole('button', { name: /Kopieren/i });
    expect(copyButtons.length).toBeGreaterThan(0);

    await act(async () => {
      fireEvent.click(copyButtons[0]);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(screen.getByText('Kopiert!')).toBeDefined();
  });
});

describe('Trigger Integration & Auth States', () => {
  it('switches tabs when another trigger fires while modal is open', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    const accountTab = screen.getByRole('tab', { name: /Mein Account/i });
    expect(accountTab.getAttribute('aria-selected')).toBe('true');

    // Click trigger-fio button outside modal
    fireEvent.click(screen.getByTestId('trigger-fio'));

    await waitFor(() => {
      const fioTab = screen.getByRole('tab', { name: /Fio KI-Guide/i });
      expect(fioTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('resets tab to "account" when closed and reopened via legacy profile trigger', async () => {
    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'fio' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    expect(screen.getByRole('tab', { name: /Fio KI-Guide/i }).getAttribute('aria-selected')).toBe('true');

    // Close modal
    fireEvent.click(screen.getByTestId('trigger-close'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    // Reopen via legacy profile trigger
    fireEvent.click(screen.getByTestId('trigger-profile-legacy'));
    await screen.findByRole('dialog');

    // Must be 'account' tab!
    expect(screen.getByRole('tab', { name: /Mein Account/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('hides password form for Google authenticated users', async () => {
    mockAuth.isGoogleUser = true;
    mockAuth.user = {
      ...mockAuth.user,
      providerData: [{ providerId: 'google.com' }]
    };

    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    expect(screen.queryByText('Passwort ändern')).toBeNull();
  });

  it('renders guest mode information and guest logout button', async () => {
    mockAuth.user = {
      uid: 'guest-1',
      displayName: 'Gast-Benutzer',
      email: 'gast@focusflow.app',
      isGuest: true
    };

    render(
      <ModalProvider>
        <TestHarness initialModal="settings" initialPayload={{ initialTab: 'account' }} />
      </ModalProvider>
    );

    await screen.findByRole('dialog');
    expect(screen.getByText('Gast-Sitzung aktiv')).toBeDefined();
    expect(screen.getAllByText('Gast-Modus beenden').length).toBeGreaterThan(0);
  });
});
