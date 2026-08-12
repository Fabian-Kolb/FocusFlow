import React, { useState, useEffect, useRef } from 'react';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

const SectionDetailDrawer = ({
  phase,
  allNotes = [],
  isOpen,
  onClose,
  onUpdatePhase,
  onDeletePhase,
  onAddMaterial,
  onDeleteMaterial,
  onOpenNote
}) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localDesc, setLocalDesc] = useState('');
  const [localDate, setLocalDate] = useState('');
  const titleTextareaRef = useRef(null);

  const [displayedPhaseId, setDisplayedPhaseId] = useState(null);
  const [isSwitching, setIsSwitching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setDisplayedPhaseId(null);
      setIsSwitching(false);
      return;
    }

    if (phase) {
      if (displayedPhaseId && phase.id !== displayedPhaseId) {
        setIsSwitching(true);
        const timer = setTimeout(() => {
          setDisplayedPhaseId(phase.id);
          setIsSwitching(false);
        }, 150);
        return () => clearTimeout(timer);
      } else {
        setDisplayedPhaseId(phase.id);
      }
    }
  }, [phase?.id, isOpen]);

  useEffect(() => {
    if (phase) {
      setLocalTitle(phase.title || '');
      setLocalDesc(phase.description || '');
      setLocalDate(phase.dateInfo || '');
    }
  }, [phase]);

  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [localTitle, isOpen]);

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const drawerPanelRef = useRef(null);
  const scrollContainerRef = useRef(null);

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

  const { drawerStyle } = useSwipeToClose({
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

  const lastPhaseRef = useRef(phase);

  if (phase) lastPhaseRef.current = phase;

  const currentPhase = phase || lastPhaseRef.current;

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

  return (
    <>
      {/* Drawer Panel - Non-blocking Side Slide-In */}
      <div 
        ref={drawerPanelRef}
        style={drawerStyle}
        className={`fixed z-50 flex flex-col bg-white border border-outline-variant shadow-2xl overflow-hidden
          bottom-0 inset-x-0 h-[85vh] rounded-t-3xl w-full
          sm:bottom-auto sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-[calc(100vh-24px)] sm:w-[420px] sm:max-w-[420px] sm:my-3 sm:mr-3 sm:rounded-2xl
          ${isClosing || isSwitching ? 'drawer-slide-out' : 'drawer-slide-in'}
        `}
      >
        {/* Notch / Drag Handle for Mobile */}
        <div className="w-full flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant/60 rounded-full" />
        </div>
        
        {/* Header (Sticky) */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 px-5 py-4 border-b border-outline-variant flex flex-col gap-3 lg:pt-5">
          {/* Top Bar: Meta Info + Actions */}
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[11px] font-mono text-on-surface-variant font-semibold uppercase tracking-wider flex items-center gap-1.5 bg-surface-low px-2.5 py-1 rounded-lg border border-outline-variant/60">
              <span className="material-symbols-outlined text-[14px]">view_timeline</span>
              <span>Abschnitt</span>
            </span>

            <button 
              onClick={handleCloseAnimated}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-low text-on-surface-variant transition-colors cursor-pointer shrink-0"
              title="Schließen"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          {/* Bottom Row: Full-width Editable Title Box */}
          <div className="relative group w-full bg-surface-low border border-outline-variant hover:border-primary/50 focus-within:border-primary focus-within:bg-white rounded-xl p-2 transition-all">
            <textarea
              ref={titleTextareaRef}
              value={localTitle}
              onChange={(e) => setLocalTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Abschnitts-Titel..."
              rows={1}
              className="text-base font-bold bg-transparent border-none outline-none focus:ring-0 w-full transition-all pr-8 resize-none min-h-[32px] overflow-hidden text-primary"
            />
            <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-[16px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">edit</span>
          </div>
        </div>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          
          {/* Fälligkeitsdatum */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              Fälligkeitsdatum
            </h3>
            <div className="relative">
              <input 
                type="date"
                value={localDate}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setLocalDate(newDate);
                  onUpdatePhase(currentPhase.id, { dateInfo: newDate });
                }}
                className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl bg-surface-low focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans text-sm transition-all"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
              <span className="material-symbols-outlined text-base">description</span>
              Beschreibung
            </h3>
            <div className="relative group">
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Ziel, Kontext oder Notizen zu diesem Abschnitt..."
                className="w-full px-3.5 py-2.5 border border-outline-variant rounded-xl bg-surface-low focus:bg-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans text-sm resize-y min-h-[110px] transition-all"
                rows={4}
              />
            </div>
          </div>

          {/* Linked Notes Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
                <span className="material-symbols-outlined text-base">sticky_note_2</span>
                Verknüpfte Notizen
              </h3>
              {linkedNotes.length > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-md text-on-surface-variant font-bold border border-outline-variant">
                  {linkedNotes.length}
                </span>
              )}
            </div>

            {linkedNotes.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 italic p-3 bg-surface-low/60 rounded-xl border border-outline-variant/40">
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
                      className="group p-3.5 rounded-xl border border-outline-variant bg-surface-low hover:bg-white hover:border-primary hover:shadow-sm transition-all cursor-pointer flex flex-col gap-1.5 relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-primary text-[18px]">notes</span>
                          <span className="font-bold text-sm text-primary truncate group-hover:underline">
                            {fullNote.title || mat.name}
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetId = mat.id || mat.noteId || mat.url;
                            onDeleteMaterial && onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: targetId });
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

          {/* Materials */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2 tracking-wider">
                <span className="material-symbols-outlined text-base">attach_file</span>
                Materialien
              </h3>
              {webMaterials.length > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-md text-on-surface-variant font-bold border border-outline-variant">
                  {webMaterials.length}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2 mt-1">
              {webMaterials.map((mat, idx) => (
                <div 
                  key={`mat-${idx}`}
                  className="group flex items-center justify-between p-3 rounded-xl border border-outline-variant bg-surface-low hover:bg-white hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[18px]">description</span>
                    <a href={mat.url} target="_blank" rel="noopener noreferrer" className="flex flex-col hover:underline">
                      <span className="text-sm truncate text-primary font-medium">{mat.name || mat.title}</span>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase">Abschnitt-Material</span>
                    </a>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'phase', phaseId: currentPhase.id, materialId: mat.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-surface-low text-on-surface-variant transition-all"
                    title="Material löschen"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              <button
                onClick={() => onAddMaterial({ type: 'phase', id: currentPhase.id })}
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
              onClick={() => onDeletePhase(currentPhase.id)}
              className="w-full py-2.5 flex items-center justify-center gap-2 rounded-xl bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-all font-mono text-xs uppercase font-bold cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Abschnitt löschen
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default SectionDetailDrawer;
