import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

const TaskDetailDrawer = ({
  task,
  phase,
  allNotes = [],
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onAddMaterial,
  onDeleteMaterial,
  onOpenNote
}) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [localDate, setLocalDate] = useState('');
  const titleTextareaRef = useRef(null);

  const [displayedTaskId, setDisplayedTaskId] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDisplayedTaskId(null);
      setIsSwitching(false);
      return;
    }

    if (task) {
      if (displayedTaskId && task.id !== displayedTaskId) {
        setIsSwitching(true);
        const timer = setTimeout(() => {
          setDisplayedTaskId(task.id);
          setIsSwitching(false);
        }, 150);
        return () => clearTimeout(timer);
      } else {
        setDisplayedTaskId(task.id);
      }
    }
  }, [task?.id, isOpen]);

  useEffect(() => {
    if (task) {
      setLocalTitle(task.title || '');
      setLocalNote(task.note || '');
      setLocalDate(task.date || '');
    }
  }, [task]);

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const drawerPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = '0px';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [localTitle, isOpen, shouldRender]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender && !isClosing) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
    if (!isOpen) return;

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
  }, [isOpen]);

  const lastTaskRef = useRef(task);
  const lastPhaseRef = useRef(phase);

  if (task) lastTaskRef.current = task;
  if (phase) lastPhaseRef.current = phase;

  const currentTask = task || lastTaskRef.current;
  const currentPhase = phase || lastPhaseRef.current;

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

  return (
    <>
      {/* Drawer Panel - Non-blocking Side Slide-In */}
      <div 
        ref={drawerPanelRef}
        style={drawerStyle}
        className={`fixed z-50 flex flex-col bg-white border border-outline-variant shadow-2xl overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-3xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:mr-3 sm:rounded-2xl
          ${(isClosing || isSwitching) ? (wasSwipedClosed ? '' : 'drawer-slide-out') : (entryAnimActive ? 'drawer-slide-in' : '')}
        `}
      >
        {/* Notch / Drag Handle for Mobile */}
        <div className="w-full flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full" />
        </div>
        
        {/* Header (Sticky) */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-4 py-2.5 sm:px-5 sm:py-3.5 border-b border-outline-variant flex flex-col gap-2 sm:gap-2.5 lg:pt-4">
          {/* Top Bar: Meta Info + Actions */}
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant font-semibold uppercase tracking-wider truncate flex items-center gap-1.5 bg-surface-low px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-outline-variant/60 max-w-[65%]">
              <span className="material-symbols-outlined text-[13px] sm:text-[14px]">layers</span>
              <span className="truncate">{currentPhase.title}</span>
            </span>

            <div className="flex items-center gap-1 shrink-0">
              <button 
                onClick={() => onToggleTask(currentPhase.id, currentTask.id)}
                className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  currentTask.completed 
                    ? 'bg-primary text-white' 
                    : 'text-on-surface-variant/60 hover:text-primary hover:bg-surface-low'
                }`}
                title={currentTask.completed ? 'Als unerledigt markieren' : 'Als erledigt markieren'}
              >
                <span className="material-symbols-outlined text-lg sm:text-xl">check</span>
              </button>

              <button 
                onClick={handleCloseAnimated}
                className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg hover:bg-surface-low text-on-surface-variant transition-colors cursor-pointer"
                title="Schließen"
              >
                <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
              </button>
            </div>
          </div>

          {/* Bottom Row: Full-width Editable Title Box */}
          <div className="relative group w-full bg-surface-low border border-outline-variant hover:border-primary/50 focus-within:border-primary focus-within:bg-white rounded-lg sm:rounded-xl px-3 py-1 sm:py-1.5 transition-all flex items-center">
            <textarea
              ref={titleTextareaRef}
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Aufgaben-Titel..."
              rows={1}
              className={`text-sm sm:text-base font-bold bg-transparent border-none outline-none focus:ring-0 w-full p-0 m-0 leading-tight block resize-none overflow-hidden ${currentTask.completed ? 'line-through text-on-surface-variant' : 'text-primary'}`}
            />
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 sm:gap-5">
          
          {/* Due Date */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              Fälligkeitsdatum
            </h3>
            <div className="relative">
              <input 
                type="date"
                value={typeof localDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(localDate) ? localDate : ''}
                onChange={handleDateChange}
                className="w-full px-3 py-1.5 sm:py-2 border border-outline-variant rounded-lg sm:rounded-xl bg-surface-low focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans text-sm transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
              <span className="material-symbols-outlined text-base">description</span>
              Beschreibung
            </h3>
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Gedanken, Details oder Anmerkungen zu dieser Aufgabe..."
              className="w-full px-3 py-1.5 sm:py-2 border border-outline-variant rounded-lg sm:rounded-xl bg-surface-low focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans text-sm resize-y min-h-[80px] sm:min-h-[100px] transition-all"
              rows={3}
            />
          </div>

          {/* Linked Notes Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
                <span className="material-symbols-outlined text-base">sticky_note_2</span>
                Verknüpfte Notizen
              </h3>
              {(linkedNotes.length + phaseLinkedNotes.length) > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-md text-on-surface-variant font-bold border border-outline-variant">
                  {linkedNotes.length + phaseLinkedNotes.length}
                </span>
              )}
            </div>

            {(linkedNotes.length + phaseLinkedNotes.length) === 0 ? (
              <p className="text-xs text-on-surface-variant/60 italic p-3 bg-surface-low/60 rounded-xl border border-outline-variant/40">
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
                      className="group p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl border border-outline-variant bg-surface-low hover:bg-white hover:border-primary hover:shadow-sm transition-all cursor-pointer flex flex-col gap-1 sm:gap-1.5 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-primary text-[18px]">notes</span>
                          <span className="font-bold text-sm text-primary truncate group-hover:underline">
                            {fullNote.title || link.name}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetId = link.id || link.noteId || link.url;
                            if (phaseLinkedNotes.includes(link)) {
                              onDeleteMaterial && onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: targetId });
                            } else {
                              onDeleteMaterial && onDeleteMaterial({ type: 'task', taskId: currentTask.id, phaseId: currentPhase.id, linkId: targetId });
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 text-red-500 transition-all shrink-0"
                          title="Verknüpfung entfernen"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>

                      {previewText && (
                        <p className="text-xs text-on-surface-variant line-clamp-2 pl-6 opacity-85 font-sans leading-relaxed">
                          {previewText}
                        </p>
                      )}

                      <div className="text-[10px] font-mono text-primary/70 pl-6 flex items-center gap-1 mt-0.5 group-hover:text-primary">
                        <span className="material-symbols-outlined text-[12px]">open_in_new</span>
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
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
                <span className="material-symbols-outlined text-base">attach_file</span>
                Materialien & Links
              </h3>
              {(webLinks.length + phaseMaterials.length) > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-md text-on-surface-variant font-bold border border-outline-variant">
                  {webLinks.length + phaseMaterials.length}
                </span>
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
                  className="group flex items-center justify-between p-3 rounded-xl border border-outline-variant bg-surface-low hover:bg-white hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[18px]">link</span>
                    <span className="text-sm truncate text-primary font-medium">{link.name || link.url}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'task', taskId: currentTask.id, phaseId: currentPhase.id, linkId: link.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-low text-on-surface-variant transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </a>
              ))}

              {/* Phase Materials */}
              {phaseMaterials.map((mat, idx) => (
                <div 
                  key={`mat-${idx}`}
                  className="group flex items-center justify-between p-3 rounded-xl border border-outline-variant bg-surface-low hover:bg-white hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[18px]">description</span>
                    <div className="flex flex-col">
                      <span className="text-sm truncate text-primary font-medium">{mat.name || mat.title}</span>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase">Abschnitt-Material</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: mat.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-low text-on-surface-variant transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              <button
                onClick={() => onAddMaterial({ type: 'task', taskId: currentTask.id, phaseId: currentPhase.id })}
                className="mt-1 w-full py-2.5 flex items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-primary/5 transition-all font-mono text-xs uppercase font-bold cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Material hinzufügen
              </button>
            </div>
          </div>

          <div className="flex-1" /> {/* Spacer */}

          {/* Danger Zone */}
          <div className="pt-3 mt-1 border-t border-outline-variant/60">
            <button
              onClick={() => onDeleteTask(currentPhase.id, currentTask.id)}
              className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all font-mono text-xs uppercase font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Aufgabe löschen
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default TaskDetailDrawer;
