import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useModalContext } from '../../context/ModalContext';
import CalendarDesyncModal from '../modals/CalendarDesyncModal';
import { Alert, Badge, Button, FioMark, Icon, IconButton } from '../ds';

const TaskDetailDrawer = ({
  projectData,
  task,
  phase,
  allNotes = [],
  isOpen,
  isGlobalChatOpen,
  isChatReplacing = false,
  onClose,
  onOpenGlobalChat,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onAddMaterial,
  onDeleteMaterial,
  onOpenNote
}) => {
  const {
    user,
    isCalendarConnected,
    isEntitySyncing,
    syncErrors,
    clearEntitySyncError,
    syncTaskToCalendar,
    desyncTaskFromCalendar
  } = useModalContext();

  const [activeTask, setActiveTask] = useState(task);
  const [activePhase, setActivePhase] = useState(phase);
  const [isSwitching, setIsSwitching] = useState(false);
  const [slideInTrigger, setSlideInTrigger] = useState(true);
  const [isDesyncModalOpen, setIsDesyncModalOpen] = useState(false);

  const [localTitle, setLocalTitle] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [localDate, setLocalDate] = useState('');
  const titleTextareaRef = useRef(null);

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const drawerPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Sync inputs with activeTask
  useEffect(() => {
    if (activeTask) {
      setLocalTitle(activeTask.title || '');
      setLocalNote(activeTask.note || '');
      setLocalDate(activeTask.date || '');
    }
  }, [activeTask?.id, activeTask?.title, activeTask?.note, activeTask?.date]);

  // Handle task change or open/close
  useEffect(() => {
    if (!isOpen) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setActiveTask(null);
        setActivePhase(null);
        setIsSwitching(false);
      }, 220);
      return () => clearTimeout(timer);
    }

    // When isOpen is true
    setShouldRender(true);
    setIsClosing(false);

    if (task) {
      if (activeTask && activeTask.id !== task.id) {
        // User clicked another task: slide out old task, then slide in new task with slight delay!
        setIsSwitching(true);
        const timer = setTimeout(() => {
          setActiveTask(task);
          setActivePhase(phase);
          setIsSwitching(false);
          setSlideInTrigger(true);
        }, 190);
        return () => clearTimeout(timer);
      } else {
        // Initial open
        setActiveTask(task);
        setActivePhase(phase);
        setSlideInTrigger(true);
      }
    }
  }, [task?.id, isOpen]);

  // Reset slide-in class after animation finishes
  useEffect(() => {
    if (slideInTrigger) {
      const timer = setTimeout(() => {
        setSlideInTrigger(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [slideInTrigger]);

  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = '0px';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [localTitle, isOpen, shouldRender]);

  const handleCloseAnimated = () => {
    onClose();
  };

  const { drawerStyle, entryAnimActive, wasSwipedClosed } = useSwipeToClose({
    isOpen: isOpen && shouldRender,
    onClose: handleCloseAnimated,
    drawerRef: drawerPanelRef,
    scrollContainerRef: scrollContainerRef,
    threshold: 120
  });

  useEffect(() => {
    if (!isOpen || isChatReplacing) return;

    const handlePointerDownOutside = (e) => {
      if (drawerPanelRef.current && !drawerPanelRef.current.contains(e.target)) {
        // Ignore clicks inside note modals, rich-text toolbars, or any drawer triggers (tasks/sections)
        if (
          e.target.closest && (
            e.target.closest('.fixed') ||
            e.target.closest('.ql-container') ||
            e.target.closest('.ql-toolbar') ||
            e.target.closest('[data-drawer-trigger]') ||
            e.target.closest('.task-item') ||
            e.target.closest('.section-header') ||
            e.target.closest('[id^="task-"]')
          )
        ) {
          return;
        }
        handleCloseAnimated();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDownOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isOpen, isChatReplacing]);

  const lastTaskRef = useRef(task);
  const lastPhaseRef = useRef(phase);

  if (task) lastTaskRef.current = task;
  if (phase) lastPhaseRef.current = phase;

  const currentTask = activeTask || task || lastTaskRef.current;
  const currentPhase = activePhase || phase || lastPhaseRef.current;

  if (!shouldRender || !currentTask || !currentPhase) return null;

  const formatPreview = (html) => {
    if (!html) return '';
    let text = html
      .replace(/<\/p>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n')
      .replace(/<\/li>/gi, '\n');
    const tmp = document.createElement('DIV');
    tmp.innerHTML = text;
    return (tmp.textContent || tmp.innerText || '').trim();
  };

  const isNoteItem = (item) => item.type === 'note' || item.noteId || (item.url && item.url.startsWith('#note-'));

  const linkedNotes = (currentTask.links || []).filter(isNoteItem);
  const webLinks = (currentTask.links || []).filter(link => !isNoteItem(link));
  const phaseMaterials = (currentPhase.materials || []).filter(mat => !isNoteItem(mat));
  const phaseLinkedNotes = (currentPhase.materials || []).filter(isNoteItem);

  const handleTitleBlur = () => {
    if (localTitle !== currentTask.title) {
      onUpdateTask(currentPhase.id, currentTask.id, { title: localTitle });
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleNoteBlur = () => {
    if (localNote !== currentTask.note) {
      onUpdateTask(currentPhase.id, currentTask.id, { note: localNote });
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setLocalDate(newDate);
    onUpdateTask(currentPhase.id, currentTask.id, { date: newDate });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(date);
    } catch {
      return dateStr;
    }
  };

  const isSyncing = isEntitySyncing ? isEntitySyncing(currentTask?.id) : false;
  const syncError = syncErrors ? syncErrors[currentTask?.id] : null;

  const handleSyncTask = async () => {
    if (!projectData?.id || !currentPhase?.id || !currentTask?.id) return;
    if (isSyncing || user?.isGuest || !isCalendarConnected) return;
    try {
      await syncTaskToCalendar(projectData.id, currentPhase.id, currentTask.id);
    } catch (err) {
      console.error('Fehler beim Kalender-Sync der Aufgabe:', err);
    }
  };

  const handleDesyncConfirm = async ({ deleteInGoogle }) => {
    if (!projectData?.id || !currentPhase?.id || !currentTask?.id) return;
    try {
      await desyncTaskFromCalendar(projectData.id, currentPhase.id, currentTask.id, { deleteInGoogle });
      setIsDesyncModalOpen(false);
    } catch (err) {
      console.error('Fehler beim De-Synchronisieren der Aufgabe:', err);
    }
  };

  if (!shouldRender && !isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop to cover BottomNav and dim background */}
      <div
        className="sm:hidden fixed inset-0 bg-scrim z-sheet transition-opacity duration-200"
        onClick={handleCloseAnimated}
        aria-hidden="true"
      />

      {/* Drawer Panel - Non-blocking Side Slide-In on desktop, high-priority bottom sheet on mobile */}
      <div
        ref={drawerPanelRef}
        style={drawerStyle}
        aria-hidden={isChatReplacing ? 'true' : undefined}
        className={`fixed z-sheet sm:z-dropdown flex flex-col bg-surface border border-subtle shadow-lg overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:mr-3 sm:rounded-xl
          ${isChatReplacing ? 'pointer-events-none opacity-0 transition-opacity duration-150' : 'transition-opacity duration-150'}
          ${(isClosing || isSwitching) ? (wasSwipedClosed ? '' : 'drawer-slide-out') : ((entryAnimActive || slideInTrigger) ? 'drawer-slide-in' : '')}
        `}
      >
        {/* Notch / Drag Handle for Mobile */}
        <div className="w-full flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-9 rounded-full bg-control" />
        </div>

        {/* Header (Sticky) */}
        <div className="sticky top-0 bg-surface z-10 px-4 py-2.5 sm:px-5 sm:py-3.5 border-b border-subtle flex flex-col gap-2 sm:gap-2.5 lg:pt-4">
          {/* Top Bar: Meta Info + Actions */}
          <div className="flex items-center justify-end gap-2 w-full">
            <div className="flex shrink-0 items-center gap-1">
            {onOpenGlobalChat && (
              <Button variant="ghost" size="sm" onClick={onOpenGlobalChat} title="Fio öffnen" aria-label="Fio öffnen">
                <FioMark size={16} />
              </Button>
            )}
            <IconButton
              icon="check"
              size="sm"
              variant={currentTask.completed ? 'primary' : 'ghost'}
              label={currentTask.completed ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
              onClick={() => onToggleTask(currentPhase.id, currentTask.id)}
            />
            <IconButton icon="close" size="sm" label="Schließen" onClick={onClose} />
            </div>
          </div>

          {/* Bottom Row: Full-width Editable Title Box */}
          <div className="group relative flex w-full items-center rounded-md border border-subtle bg-subtle px-3 py-1.5 transition-colors duration-fast focus-within:border-strong focus-within:bg-surface hover:border-control">
            <textarea
              ref={titleTextareaRef}
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Titel der Aufgabe"
              rows={1}
              className={`text-body-strong sm:text-body-lg bg-transparent border-none outline-none focus:ring-0 w-full p-0 m-0 leading-tight block resize-none overflow-hidden ${currentTask.completed ? 'line-through text-secondary' : 'text-primary'}`}
            />
          </div>

        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 sm:gap-5"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >

          {/* Due Date */}
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-label text-primary">
              <Icon name="calendar_today" size="sm" />
              Fälligkeitsdatum
            </h3>
            <div className="relative">
              <input
                type="date"
                value={typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : ''}
                onChange={handleDateChange}
                className="w-full px-3 py-1.5 sm:py-2 border border-subtle rounded-md sm:rounded-lg bg-subtle focus:bg-surface focus:outline-none focus:border-strong focus:ring-1 focus:ring-focus font-sans text-body transition-all"
              />
            </div>

            {/* Calendar Sync Section */}
            <div className="mt-1 p-2.5 bg-subtle border border-subtle rounded-lg flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Icon name="calendar_month" size="sm" className="text-primary" />
                  <span className="text-caption-strong font-label truncate">
                    Google Kalender
                  </span>
                  {currentTask.isCalendarSynced ? (
                    <Badge tone="success" size="sm" icon="check_circle">Synchronisiert</Badge>
                  ) : (
                    <Badge size="sm">Nicht synchronisiert</Badge>
                  )}
                </div>

                {currentTask.isCalendarSynced ? (
                  <Button variant="secondary" size="sm" leadingIcon="sync_disabled" disabled={isSyncing} onClick={() => setIsDesyncModalOpen(true)} title="Synchronisation trennen">
                  Trennen
                  </Button>
                ) : (
                  <Button size="sm" leadingIcon="sync" loading={isSyncing} disabled={user?.isGuest || !isCalendarConnected || !localDate} onClick={handleSyncTask} title={
                      user?.isGuest
                        ? 'Im Gastmodus nicht verfügbar'
                        : !isCalendarConnected
                        ? 'Google Kalender ist nicht verbunden'
                        : !localDate
                        ? 'Bitte zuerst ein Datum festlegen'
                        : 'Mit Google Kalender synchronisieren'
                    }>
                    {isSyncing ? 'Synchronisiere …' : 'Synchronisieren'}
                    </Button>
                )}
              </div>

              {/* Sync Error Banner */}
              {syncError && (
                <Alert tone="danger" onDismiss={() => clearEntitySyncError && clearEntitySyncError(currentTask.id)}>
                {syncError}
                </Alert>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-label text-primary">
              <Icon name="description" size="sm" />
              Beschreibung
            </h3>
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Gedanken, Details oder Anmerkungen zu dieser Aufgabe..."
              className="w-full px-3 py-1.5 sm:py-2 border border-subtle rounded-md sm:rounded-lg bg-subtle focus:bg-surface focus:outline-none focus:border-strong focus:ring-1 focus:ring-focus font-sans text-body resize-y min-h-[80px] sm:min-h-[100px] transition-all"
              rows={3}
            />
          </div>

          {/* Linked Notes Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-label text-primary">
                <Icon name="sticky_note_2" size="sm" />
                Verknüpfte Notizen
              </h3>
              {(linkedNotes.length + phaseLinkedNotes.length) > 0 && (
                <Badge size="sm">{linkedNotes.length + phaseLinkedNotes.length}</Badge>
              )}
            </div>

            {(linkedNotes.length + phaseLinkedNotes.length) === 0 ? (
              <p className="text-caption text-tertiary italic p-3 bg-subtle rounded-lg border border-subtle">
                Keine Notizen mit dieser Aufgabe verknüpft.
              </p>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {[...linkedNotes, ...phaseLinkedNotes].map((link, idx) => {
                  const fullNote = allNotes.find(n => n.id === link.noteId || link.url === `#note-${n.id}`) || { title: link.name, content: '' };
                  const previewText = formatPreview(fullNote.content);

                  return (
                    <div
                      key={`note-${idx}`}
                      onClick={() => onOpenNote && onOpenNote(fullNote)}
                      className="group p-2.5 sm:p-3.5 rounded-md sm:rounded-lg border border-subtle bg-subtle hover:bg-surface hover:border-strong hover:shadow-sm transition-all cursor-pointer flex flex-col gap-1 sm:gap-1.5 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon name="notes" size="md" className="text-primary" />
                          <span className="text-body-strong text-primary truncate group-hover:underline">
                            {fullNote.title || link.name}
                          </span>
                        </div>
                        <IconButton icon="close" label="Verknüpfung entfernen" variant="danger-ghost" size="sm" className="opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => {
                            e.stopPropagation();
                            const targetId = link.id || link.noteId || link.url;
                            if (phaseLinkedNotes.includes(link)) {
                              onDeleteMaterial && onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: targetId });
                            } else {
                              onDeleteMaterial && onDeleteMaterial({ type: 'task', taskId: currentTask.id, phaseId: currentPhase.id, linkId: targetId });
                            }
                          }} />
                      </div>

                      {previewText && (
                        <p className="text-caption text-secondary line-clamp-2 pl-6 opacity-85 font-sans leading-relaxed">
                          {previewText}
                        </p>
                      )}

                      <div className="text-micro font-label text-secondary pl-6 flex items-center gap-1 mt-0.5 group-hover:text-primary">
                        <Icon name="open_in_new" size="sm" />
                        Klicken zum Anzeigen & Bearbeiten
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Materials & Links */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-label text-primary">
                <Icon name="attach_file" size="sm" />
                Materialien & Links
              </h3>
              {(webLinks.length + phaseMaterials.length) > 0 && (
                <Badge size="sm">{webLinks.length + phaseMaterials.length}</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {/* Task Links */}
              {webLinks.map((link, idx) => (
                <a
                  key={`link-${idx}`}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between p-3 rounded-lg border border-subtle bg-subtle hover:bg-surface hover:border-strong hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Icon name="link" size="md" className="text-secondary group-hover:text-primary transition-colors" />
                    <span className="text-label truncate text-primary">{link.name || link.url}</span>
                  </div>
                  <IconButton
                  icon="delete"
                  label="Link entfernen"
                  size="sm"
                  className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    onDeleteMaterial({ type: 'task', taskId: currentTask.id, phaseId: currentPhase.id, linkId: link.id });
                  }}
                  />
                </a>
              ))}

              {/* Phase Materials */}
              {phaseMaterials.map((mat, idx) => (
                <div
                  key={`mat-${idx}`}
                  className="group flex items-center justify-between p-3 rounded-lg border border-subtle bg-subtle hover:bg-surface hover:border-strong hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Icon name="description" size="md" className="text-secondary group-hover:text-primary transition-colors" />
                    <div className="flex flex-col">
                      <span className="text-label truncate text-primary">{mat.name || mat.title}</span>
                      <span className="text-caption text-secondary">Abschnitt-Material</span>
                    </div>
                  </div>
                  <IconButton
                  icon="delete"
                  label="Material entfernen"
                  size="sm"
                  className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={(e) => {
                    e.preventDefault();
                    onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: mat.id });
                  }}
                  />
                </div>
              ))}

              <Button variant="ghost" fullWidth onClick={() => onAddMaterial({ type: 'task', taskId: currentTask.id, phaseId: currentPhase.id })} className="mt-1">
                <Icon name="add" size="sm" />
                Material hinzufügen
              </Button>
            </div>
          </div>

          <div className="flex-1" /> {/* Spacer */}

          {/* Danger Zone */}
          <div className="pt-3 mt-1 border-t border-subtle">
            <Button variant="danger-ghost" fullWidth leadingIcon="delete" onClick={() => onDeleteTask(currentPhase.id, currentTask.id)}>
            Aufgabe löschen
            </Button>
          </div>

        </div>
      </div>

      {/* Calendar Desync Confirmation Modal */}
      <CalendarDesyncModal
        isOpen={isDesyncModalOpen}
        title={currentTask?.title}
        type="Aufgabe"
        onClose={() => setIsDesyncModalOpen(false)}
        onConfirm={handleDesyncConfirm}
        isLoading={isSyncing}
      />
    </>
  );
};

export default TaskDetailDrawer;
