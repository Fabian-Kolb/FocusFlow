import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';
import { useModalContext } from '../../context/ModalContext';

import { Alert, Button, FioMark, Icon, IconButton } from '../ds';
const SectionDetailDrawer = ({
  projectData,
  phase,
  allNotes = [],
  isOpen,
  isGlobalChatOpen,
  isChatReplacing = false,
  onClose,
  onOpenGlobalChat,
  onUpdatePhase,
  onDeletePhase,
  onAddMaterial,
  onDeleteMaterial,
  onOpenNote
}) => {
  const {
    user,
    isCalendarConnected,
    batchSyncPhaseTasks
  } = useModalContext();

  const [activePhase, setActivePhase] = useState(phase);
  const [isSwitching, setIsSwitching] = useState(false);
  const [slideInTrigger, setSlideInTrigger] = useState(true);

  const [localTitle, setLocalTitle] = useState('');
  const [localDesc, setLocalDesc] = useState('');
  const [localDate, setLocalDate] = useState('');
  const [isBatchSyncing, setIsBatchSyncing] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState(null);
  const [batchSyncError, setBatchSyncError] = useState(null);
  const titleTextareaRef = useRef(null);

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const drawerPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  // Sync inputs with activePhase
  useEffect(() => {
    if (activePhase) {
      setLocalTitle(activePhase.title || '');
      setLocalDesc(activePhase.description || '');
      setLocalDate(activePhase.dateInfo || '');
    }
  }, [activePhase?.id, activePhase?.title, activePhase?.description, activePhase?.dateInfo]);

  // Handle phase change or open/close
  useEffect(() => {
    if (!isOpen) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        setActivePhase(null);
        setIsSwitching(false);
      }, 220);
      return () => clearTimeout(timer);
    }

    // When isOpen is true
    setShouldRender(true);
    setIsClosing(false);

    if (phase) {
      if (activePhase && activePhase.id !== phase.id) {
        // User clicked another phase: slide out old phase, then slide in new phase with slight delay!
        setIsSwitching(true);
        const timer = setTimeout(() => {
          setActivePhase(phase);
          setIsSwitching(false);
          setSlideInTrigger(true);
        }, 190);
        return () => clearTimeout(timer);
      } else {
        // Initial open
        setActivePhase(phase);
        setSlideInTrigger(true);
      }
    }
  }, [phase?.id, isOpen]);

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

  const lastPhaseRef = useRef(phase);

  if (phase) lastPhaseRef.current = phase;

  const currentPhase = activePhase || phase || lastPhaseRef.current;

  if (!shouldRender || !currentPhase) return null;

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

  const linkedNotes = (currentPhase.materials || []).filter(isNoteItem);
  const webMaterials = (currentPhase.materials || []).filter(mat => !isNoteItem(mat));

  const handleTitleBlur = () => {
    if (localTitle !== currentPhase.title) {
      onUpdatePhase(currentPhase.id, { title: localTitle });
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleDescBlur = () => {
    if (localDesc !== currentPhase.description) {
      onUpdatePhase(currentPhase.id, { description: localDesc });
    }
  };

  const handleDateBlur = () => {
    if (localDate !== currentPhase.dateInfo) {
      onUpdatePhase(currentPhase.id, { dateInfo: localDate });
    }
  };

  const handleDateKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const phaseTasks = currentPhase?.tasks || [];
  const datedTasks = phaseTasks.filter(t => t.date && t.date !== 'Geplant: Demnächst');
  const syncedTasks = datedTasks.filter(t => t.isCalendarSynced);

  const handleBatchSync = async () => {
    if (!projectData?.id || !currentPhase?.id) return;
    if (isBatchSyncing || user?.isGuest || !isCalendarConnected || datedTasks.length === 0) return;
    setIsBatchSyncing(true);
    setBatchSyncError(null);
    setBatchSyncResult(null);
    try {
      const res = await batchSyncPhaseTasks(projectData.id, currentPhase.id);
      setBatchSyncResult(res);
    } catch (err) {
      setBatchSyncError(err.message || 'Fehler beim Synchronisieren des Abschnitts.');
    } finally {
      setIsBatchSyncing(false);
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
            <IconButton icon="close" size="sm" label="Schließen" onClick={handleCloseAnimated} />
            </div>
          </div>

          {/* Bottom Row: Full-width Editable Title Box */}
          <div className="group relative flex w-full items-center rounded-md border border-subtle bg-subtle px-3 py-1.5 transition-colors duration-fast focus-within:border-strong focus-within:bg-surface hover:border-control">
            <textarea
              ref={titleTextareaRef}
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Titel des Abschnitts"
              rows={1}
              className="text-body-strong sm:text-body-lg bg-transparent border-none outline-none focus:ring-0 w-full p-0 m-0 leading-tight block resize-none overflow-hidden text-primary"
            />
          </div>

        </div>

        {/* Scrollable Content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 sm:gap-5"
          style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >

          {/* Fälligkeitsdatum */}
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-label text-primary">
              <Icon name="calendar_today" size="sm" />
              Fälligkeitsdatum
            </h3>
            <div className="relative">
              <input
                type="date"
                value={typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : ''}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setLocalDate(newDate);
                  onUpdatePhase(currentPhase.id, { dateInfo: newDate });
                }}
                className="w-full px-3 py-1.5 sm:py-2 border border-subtle rounded-md sm:rounded-lg bg-subtle focus:bg-surface focus:outline-none focus:border-strong focus:ring-1 focus:ring-focus font-sans text-body transition-all"
              />
            </div>
          </div>

          {/* Calendar Batch Sync Section */}
          <div className="p-3 bg-subtle border border-subtle rounded-lg flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <Icon name="calendar_month" size="md" className="text-primary" />
                <span className="text-caption-strong font-label truncate">
                  Kalender-Synchronisation
                </span>
              </div>
              <span className="text-micro font-label bg-surface px-2 py-0.5 rounded-md text-secondary font-semibold border border-subtle">
                {syncedTasks.length} / {datedTasks.length} synchronisiert
              </span>
            </div>

            <p className="text-caption text-secondary leading-relaxed">
              Synchronisiert alle Aufgaben dieses Abschnitts mit Fälligkeitsdatum mit deinem Google Kalender.
            </p>

            <Button fullWidth leadingIcon="sync" loading={isBatchSyncing} disabled={user?.isGuest || !isCalendarConnected || datedTasks.length === 0} onClick={handleBatchSync} title={
                user?.isGuest
                  ? 'Im Gastmodus nicht verfügbar'
                  : !isCalendarConnected
                  ? 'Google Kalender ist nicht verbunden'
                  : datedTasks.length === 0
                  ? 'Keine Aufgaben mit Fälligkeitsdatum vorhanden'
                  : 'Alle datierten Aufgaben dieses Abschnitts synchronisieren'
              }>
              {isBatchSyncing ? 'Synchronisiere Aufgaben …' : 'Abschnitt-Aufgaben synchronisieren'}
              </Button>

            {batchSyncResult && (
              <Alert tone={batchSyncResult.failed?.length > 0 ? 'warning' : 'success'} onDismiss={() => setBatchSyncResult(null)}>
              {batchSyncResult.synced?.length || 0} synchronisiert
              {batchSyncResult.skipped?.length > 0 && ` · ${batchSyncResult.skipped.length} unverändert`}
              {batchSyncResult.failed?.length > 0 && ` · ${batchSyncResult.failed.length} fehlgeschlagen`}
              </Alert>
            )}

            {batchSyncError && (
              <Alert tone="danger" onDismiss={() => setBatchSyncError(null)}>{batchSyncError}</Alert>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-label text-primary">
              <Icon name="description" size="sm" />
              Beschreibung
            </h3>
            <div className="relative group">
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Ziel, Kontext oder Notizen zu diesem Abschnitt"
                className="w-full px-3 py-1.5 sm:py-2 border border-subtle rounded-md sm:rounded-lg bg-subtle focus:bg-surface focus:outline-none focus:border-strong focus:ring-1 focus:ring-focus font-sans text-body resize-y min-h-[80px] sm:min-h-[100px] transition-all"
                rows={3}
              />
            </div>
          </div>

          {/* Linked Notes Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-label text-primary">
                <Icon name="sticky_note_2" size="sm" />
                Verknüpfte Notizen
              </h3>
              {linkedNotes.length > 0 && (
                <span className="text-micro font-label bg-subtle px-2 py-0.5 rounded-md text-secondary font-semibold border border-subtle">
                  {linkedNotes.length}
                </span>
              )}
            </div>

            {linkedNotes.length === 0 ? (
              <p className="text-caption text-tertiary italic p-3 bg-subtle rounded-lg border border-subtle">
                Keine Notizen mit diesem Abschnitt verknüpft.
              </p>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {linkedNotes.map((mat, idx) => {
                  const fullNote = allNotes.find(n => n.id === mat.noteId || mat.url === `#note-${n.id}`) || { title: mat.name, content: '' };
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
                            {fullNote.title || mat.name}
                          </span>
                        </div>
                        <IconButton icon="close" label="Verknüpfung entfernen" variant="danger-ghost" size="sm" className="opacity-0 group-hover:opacity-100 shrink-0" onClick={(e) => {
                            e.stopPropagation();
                            const targetId = mat.id || mat.noteId || mat.url;
                            onDeleteMaterial && onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: targetId });
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

          {/* Materials */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-label text-primary">
                <Icon name="attach_file" size="sm" />
                Materialien
              </h3>
              {webMaterials.length > 0 && (
                <span className="text-micro font-label bg-subtle px-2 py-0.5 rounded-md text-secondary font-semibold border border-subtle">
                  {webMaterials.length}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {webMaterials.map((mat, idx) => (
                <div
                  key={`mat-${idx}`}
                  className="group flex items-center justify-between p-3 rounded-lg border border-subtle bg-subtle hover:bg-surface hover:border-strong hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Icon name="description" size="md" className="text-secondary group-hover:text-primary transition-colors" />
                    <a href={mat.url} target="_blank" rel="noopener noreferrer" className="flex flex-col hover:underline">
                      <span className="text-label truncate text-primary">{mat.name || mat.title}</span>
                      <span className="text-caption text-secondary">Abschnitt-Material</span>
                    </a>
                  </div>
                  <IconButton icon="delete" label="Material löschen" size="sm" className="opacity-0 group-hover:opacity-100" onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: mat.id });
                    }} />
                </div>
              ))}

              <Button variant="ghost" fullWidth onClick={() => onAddMaterial({ type: 'phase', id: currentPhase.id })} className="mt-1">
                <Icon name="add" size="sm" />
                Material hinzufügen
              </Button>
            </div>
          </div>

          <div className="flex-1" /> {/* Spacer */}

          {/* Danger Zone */}
          <div className="pt-3 mt-1 border-t border-subtle">
            <Button variant="danger-ghost" fullWidth leadingIcon="delete" onClick={() => onDeletePhase(currentPhase.id)}>
            Abschnitt löschen
            </Button>
          </div>

        </div>
      </div>
    </>
  );
};

export default SectionDetailDrawer;
