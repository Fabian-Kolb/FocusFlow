import React, { useState, useEffect } from 'react';
import { useModalContext } from '../../context/ModalContext';
import NotesSection from '../ui/NotesSection';
import GlobalChatDrawer from '../ui/GlobalChatDrawer';
import CalendarDesyncModal from '../modals/CalendarDesyncModal';
import { RECURRENCE_OPTIONS, getRecurrenceOptionId, formatRecurrence, toIsoDate } from '../../lib/recurrence';
import { Alert, Badge, Button, Card, Chip, FOCUS, Field, FioMark, Icon, IconButton, Input, ProgressBar, SectionHeader, Select, cx } from '../ds';

const ReminderDetail = ({ setCurrentScreen }) => {
  const {
    reminders,
    trashItems,
    selectedReminderId,
    openModal,
    toggleReminderStatus,
    setReminderStatus,
    setActiveCoachScope,
    toggleReminderPause,
    toggleReminderKanban,
    mutateReminder,
    reminderCategories,
    // Calendar Sync
    user,
    isCalendarConnected,
    isEntitySyncing,
    syncErrors,
    clearEntitySyncError,
    syncReminderToCalendar,
    desyncReminderFromCalendar
  } = useModalContext();
  const [isStructuring, setIsStructuring] = useState(false);
  const [isGlobalChatOpen, setIsGlobalChatOpen] = useState(false);
  const [isDesyncModalOpen, setIsDesyncModalOpen] = useState(false);

  const reminder = reminders.find(r => r.id === selectedReminderId) || (trashItems && trashItems.find(r => r.id === selectedReminderId));
  const isTrashed = !!reminder?.deletedAt;
  const categoryObj = (reminderCategories || []).find(c => c.id === (reminder?.categoryId || 'allgemein')) || { id: 'allgemein', name: 'Allgemein' };

  // States for Editing Dates
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editDate, setEditDate] = useState(reminder?.date || '');
  const [editTime, setEditTime] = useState(reminder?.time || '');

  // States for Editing Title
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(reminder?.title || '');

  // Reset local state if another reminder is selected
  useEffect(() => {
    if (reminder) {
      setEditDate(reminder.date || '');
      setEditTime(reminder.time || '');
      setEditTitle(reminder.title || '');
    }
  }, [reminder]);

  const handleSaveTitle = () => {
    if (editTitle.trim() && editTitle.trim() !== reminder.title && mutateReminder && reminder) {
      mutateReminder(reminder.id, (rem) => ({
        ...rem,
        title: editTitle.trim()
      }));
    }
    setIsEditingTitle(false);
  };

  const handleSaveDates = () => {
    if (mutateReminder && reminder) {
      mutateReminder(reminder.id, (rem) => ({
        ...rem,
        date: editDate,
        time: editTime
      }));
    }
    setIsEditingDates(false);
  };

  const handleRecurrenceChange = (optionId) => {
    if (!mutateReminder || !reminder || optionId === 'custom') return;
    const value = RECURRENCE_OPTIONS.find((o) => o.id === optionId)?.value || null;
    mutateReminder(reminder.id, (rem) => {
      // Feld ganz entfernen statt null speichern (setDoc ersetzt das Dokument)
      const { recurrence: _old, ...rest } = rem;
      if (!value) return rest;
      const hasFixedDate = /^\d{4}-\d{2}-\d{2}$/.test(rem.date || '');
      return { ...rest, recurrence: value, date: hasFixedDate ? rem.date : toIsoDate(new Date()) };
    });
  };

  const isSyncing = Boolean(reminder && isEntitySyncing && isEntitySyncing(reminder.id));

  const handleSyncToCalendar = async () => {
    if (!reminder || isSyncing || user?.isGuest || !isCalendarConnected) return;
    try {
      await syncReminderToCalendar(reminder.id);
    } catch (err) {
      console.error('Fehler beim Kalender-Sync:', err);
    }
  };

  const handleDesyncConfirm = async ({ deleteInGoogle }) => {
    if (!reminder) return;
    try {
      await desyncReminderFromCalendar(reminder.id, { deleteInGoogle });
      setIsDesyncModalOpen(false);
    } catch (err) {
      console.error('Fehler beim De-Synchronisieren:', err);
    }
  };

  if (!reminder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
      <Icon name="notifications_off" size="xl" className="text-tertiary" />
      <h2 className="text-heading text-primary">Erinnerung nicht gefunden</h2>
      <Button onClick={() => setCurrentScreen('reminders')}>Zurück zur Übersicht</Button>
      </div>
    );
  }

  const handleStructureNotes = async () => {
    if (isStructuring) return;
    setIsStructuring(true);
    // Simulate AI processing
    setTimeout(() => {
      setIsStructuring(false);
    }, 2000);
  };

  const handleAddNote = (note) => {
    mutateReminder(reminder.id, (r) => ({
      ...r,
      notes: [...(r.notes || []), note]
    }));
  };

  const handleUpdateNote = (noteId, updatedData) => {
    mutateReminder(reminder.id, (r) => ({
      ...r,
      notes: (r.notes || []).map(n => n.id === noteId ? { ...n, ...updatedData } : n)
    }));
  };

  const handleDeleteNote = (noteId) => {
    mutateReminder(reminder.id, (r) => ({
      ...r,
      notes: (r.notes || []).filter(n => n.id !== noteId)
    }));
  };

  // Date parsing and calculation
  let dateText = reminder.date || 'Demnächst';
  let daysRemainingText = '';
  let isOverdue = false;
  let isToday = false;
  let isCompleted = reminder.status === 'ABGESCHLOSSEN';
  let timeElapsed = 50;

  if (reminder.date && reminder.date !== 'Demnächst' && reminder.date !== 'Heute' && reminder.date !== 'Morgen') {
    // Attempt to parse YYYY-MM-DD
    const targetDate = new Date(`${reminder.date}T${reminder.time || '00:00'}`);
    if (!isNaN(targetDate)) {
      const now = new Date();
      // Set hours to 0 to only compare days if time isn't strict, but here time matters
      const diffMs = targetDate - now;
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (reminder.createdAt) {
          const start = reminder.createdAt;
          const end = targetDate.getTime();
          const nowTime = Date.now();
          if (nowTime >= end) timeElapsed = 100;
          else if (nowTime <= start) timeElapsed = 0;
          else timeElapsed = Math.round(((nowTime - start) / (end - start)) * 100);
      }
      if (!isCompleted) {
        if (diffDays < 0) {
          daysRemainingText = `${Math.abs(diffDays)} Tage überfällig`;
          isOverdue = true;
        } else if (diffDays === 0) {
          daysRemainingText = 'Heute fällig';
          isToday = true;
        } else if (diffDays === 1) {
          daysRemainingText = 'Morgen fällig';
        } else {
          daysRemainingText = `In ${diffDays} Tagen`;
        }
      }

      dateText = targetDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      if (reminder.time) {
        dateText += ` • ${reminder.time} Uhr`;
      }
    }
  } else if (reminder.date === 'Heute') {
      dateText = `Heute${reminder.time ? ` • ${reminder.time} Uhr` : ''}`;
      daysRemainingText = 'Heute fällig';
      if (!isCompleted) isToday = true;
  } else if (reminder.date === 'Morgen') {
      dateText = `Morgen${reminder.time ? ` • ${reminder.time} Uhr` : ''}`;
      daysRemainingText = 'Morgen fällig';
  }

  const statusOptions = [
    { id: 'GEPLANT', label: 'Geplant', icon: 'schedule' },
    { id: 'AKTIV', label: 'Aktiv', icon: 'play_circle' },
    { id: 'ABGESCHLOSSEN', label: 'Erledigt', icon: 'check_circle' },
  ];
  const recurrenceOptionId = getRecurrenceOptionId(reminder.recurrence);

  return (
    <div>
      <div className="relative mx-auto w-full space-y-4 sm:space-y-6">
        {/* Brotkrumen */}
        <nav aria-label="Pfad" className="flex flex-wrap items-center gap-1 text-caption text-secondary">
          <Button variant="ghost" size="sm" leadingIcon="arrow_back" onClick={() => setCurrentScreen && setCurrentScreen('reminders')}>
            Erinnerungen
          </Button>
          <span className="text-disabled" aria-hidden="true">/</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (setCurrentScreen) {
                setCurrentScreen('reminders');
                setTimeout(() => {
                  const el = document.getElementById(`rcat-sec-${categoryObj.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }, 100);
              }
            }}
          >
            {categoryObj.name}
          </Button>
          <IconButton
            icon="folder_open"
            label="Kategorie ändern"
            size="sm"
            onClick={() => openModal('moveCategory', { type: 'reminder', itemId: reminder.id, currentCategoryId: reminder.categoryId })}
          />
        </nav>

        {isTrashed && (
          <Alert tone="danger" icon="delete" title="Erinnerung im Papierkorb">
            Diese Erinnerung wurde gelöscht. Stelle sie im Papierkorb wieder her, um sie zu bearbeiten.
          </Alert>
        )}

        {/* Schreibgeschützt, solange die Erinnerung im Papierkorb liegt */}
        <div className={cx('space-y-4 sm:space-y-6', isTrashed && 'pointer-events-none opacity-60')}>
          <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              {isEditingTitle ? (
                <div className="flex max-w-xl items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleSaveTitle}
                    autoFocus
                    aria-label="Titel der Erinnerung"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle();
                      if (e.key === 'Escape') {
                        setEditTitle(reminder.title || '');
                        setIsEditingTitle(false);
                      }
                    }}
                    className="w-full rounded-md border border-strong bg-surface px-2 py-1 text-title focus:outline-none sm:text-title-lg"
                  />
                  <IconButton
                    icon="check"
                    label="Speichern"
                    variant="primary"
                    size="sm"
                    className="shrink-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSaveTitle();
                    }}
                  />
                  <IconButton
                    icon="close"
                    label="Abbrechen"
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setEditTitle(reminder.title || '');
                      setIsEditingTitle(false);
                    }}
                  />
                </div>
              ) : (
                <div className="group flex flex-wrap items-center gap-2">
                  <h1
                    onClick={() => !isTrashed && setIsEditingTitle(true)}
                    className={cx('text-title text-primary sm:text-title-lg', isTrashed ? 'cursor-default' : 'cursor-pointer hover:underline hover:underline-offset-4')}
                    title={isTrashed ? '' : 'Klicken zum Umbenennen'}
                  >
                    {reminder.title}
                  </h1>
                  {!isTrashed && (
                    <IconButton icon="edit" label="Erinnerung umbenennen" size="sm" className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100" onClick={() => setIsEditingTitle(true)} />
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <IconButton
                icon={reminder.isPaused ? 'play_arrow' : 'pause'}
                label={reminder.isPaused ? 'Fortsetzen' : 'Pausieren'}
                variant="secondary"
                className={reminder.isPaused ? '!border-accent !bg-accent-subtle !text-accent' : ''}
                onClick={() => toggleReminderPause(reminder.id)}
              />
              <IconButton
                icon={reminder.inKanban !== false ? 'view_kanban' : 'visibility_off'}
                label={reminder.inKanban !== false ? 'Vom Kanban-Board ausblenden' : 'Auf Kanban-Board einblenden'}
                variant="secondary"
                filled={reminder.inKanban !== false}
                onClick={() => toggleReminderKanban(reminder.id)}
              />
            </div>
          </header>

          {/* Zeitspanne, Wiederholung und Kalender */}
          <Card padding="md" className="space-y-4">
            <SectionHeader
              title="Zeitspanne"
              action={isEditingDates ? (
                <div className="flex items-center gap-2">
                  <Input type="date" size="sm" aria-label="Datum" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="w-36" />
                  <Input type="time" size="sm" aria-label="Uhrzeit" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-28" />
                  <IconButton icon="check" label="Datum speichern" variant="primary" size="sm" onClick={handleSaveDates} />
                  <IconButton icon="close" label="Abbrechen" variant="secondary" size="sm" onClick={() => setIsEditingDates(false)} />
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-caption-strong text-primary">
                    {dateText}
                    {daysRemainingText && <span className={isOverdue ? 'text-danger' : 'text-secondary'}> ({daysRemainingText})</span>}
                  </span>
                  <IconButton icon="edit" label="Datum bearbeiten" size="sm" onClick={() => setIsEditingDates(true)} />
                </div>
              )}
            />

            {!isTrashed && (
              <Field label="Wiederholen">
                <Select
                  aria-label="Wiederholung"
                  size="sm"
                  value={recurrenceOptionId ?? 'custom'}
                  onChange={(e) => handleRecurrenceChange(e.target.value)}
                >
                  {recurrenceOptionId === null && <option value="custom">{formatRecurrence(reminder.recurrence)}</option>}
                  {RECURRENCE_OPTIONS.map((o) => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            )}

            <ProgressBar
              value={timeElapsed}
              tone={isOverdue ? 'danger' : 'accent'}
              label={`Verstrichene Zeit · ${daysRemainingText || 'Demnächst'}`}
              showValue
            />

            {/* Kalender-Synchronisation */}
            <div className="flex flex-col justify-between gap-3 border-t border-subtle pt-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name="calendar_month" size="md" className="text-secondary" />
                <span className="text-label text-primary">Google Kalender</span>
                {reminder.isCalendarSynced ? (
                  <Badge tone="success" icon="check_circle">Synchronisiert</Badge>
                ) : (
                  <span className="text-caption text-secondary">Nicht synchronisiert</span>
                )}
              </div>

              {reminder.isCalendarSynced ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leadingIcon="sync_disabled"
                  disabled={isSyncing}
                  onClick={() => setIsDesyncModalOpen(true)}
                  title="Synchronisation trennen"
                >
                  Trennen
                </Button>
              ) : (
                <Button
                  size="sm"
                  leadingIcon="sync"
                  loading={isSyncing}
                  disabled={user?.isGuest || !isCalendarConnected}
                  onClick={handleSyncToCalendar}
                  title={
                    user?.isGuest
                      ? 'Im Gastmodus nicht verfügbar'
                      : !isCalendarConnected
                      ? 'Google Kalender ist nicht verbunden'
                      : 'Mit Google Kalender synchronisieren'
                  }
                >
                  {isSyncing ? 'Synchronisiere …' : 'Mit Kalender synchronisieren'}
                </Button>
              )}
            </div>

            {syncErrors && syncErrors[reminder.id] && (
              <Alert
                tone="danger"
                onDismiss={() => clearEntitySyncError && clearEntitySyncError(reminder.id)}
                action={<Button variant="secondary" size="sm" onClick={handleSyncToCalendar}>Wiederholen</Button>}
              >
                {syncErrors[reminder.id].message}
              </Alert>
            )}
          </Card>

          {/* Status */}
          <Card padding="md" className="space-y-4">
            <SectionHeader title="Status" />
            <div className="flex flex-wrap items-center gap-2">
              {statusOptions.map((s) => (
                <Chip
                  key={s.id}
                  selected={reminder.status === s.id}
                  leadingIcon={s.icon}
                  onClick={() => { if (setReminderStatus) setReminderStatus(reminder.id, s.id); }}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </Card>

          {/* Notizen */}
          <NotesSection
            notes={reminder.notes || []}
            onAddNote={handleAddNote}
            onUpdateNote={handleUpdateNote}
            onDeleteNote={handleDeleteNote}
          />
        </div>
      </div>

      {/* Fio für diese Erinnerung */}
      <GlobalChatDrawer
        isOpen={isGlobalChatOpen}
        onClose={() => setIsGlobalChatOpen(false)}
        projectData={null}
        contextScope="reminder"
        contextData={reminder}
      />

      {!isGlobalChatOpen && (
        <button
          type="button"
          onClick={() => setIsGlobalChatOpen(true)}
          title="Fio für diese Erinnerung öffnen"
          aria-label="Fio für diese Erinnerung öffnen"
          className={cx(
            'group fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] right-4 z-dropdown flex h-12 w-12 items-center justify-center rounded-lg bg-inverse text-inverse shadow-lg transition-transform duration-fast hover:scale-105 active:scale-95 motion-reduce:transform-none sm:bottom-6 sm:right-6',
            FOCUS,
          )}
        >
          <FioMark size={20} />
        </button>
      )}

      {/* Kalender-Synchronisierung trennen */}
      <CalendarDesyncModal
        isOpen={isDesyncModalOpen}
        title={reminder.title}
        type="Erinnerung"
        isLoading={isSyncing}
        onClose={() => setIsDesyncModalOpen(false)}
        onConfirm={handleDesyncConfirm}
      />
    </div>
  );
};

export default ReminderDetail;
