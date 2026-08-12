import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    if (phase) {
      setLocalTitle(phase.title || '');
      setLocalDesc(phase.description || '');
      setLocalDate(phase.dateInfo || '');
    }
  }, [phase]);

  if (!isOpen || !phase) return null;

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

  const linkedNotes = (phase.materials || []).filter(isNoteItem);
  const webMaterials = (phase.materials || []).filter(mat => !isNoteItem(mat));

  const handleTitleBlur = () => {
    if (localTitle !== phase.title) {
      onUpdatePhase(phase.id, { title: localTitle });
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleDescBlur = () => {
    if (localDesc !== phase.description) {
      onUpdatePhase(phase.id, { description: localDesc });
    }
  };

  const handleDateBlur = () => {
    if (localDate !== phase.dateInfo) {
      onUpdatePhase(phase.id, { dateInfo: localDate });
    }
  };

  const handleDateKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden drawer-backdrop-fade"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-x-0 bottom-0 lg:inset-y-0 lg:left-auto lg:right-0 z-50 flex flex-col bg-white rounded-t-2xl lg:rounded-none lg:w-[420px] lg:border-l lg:border-outline-variant shadow-xl drawer-slide-in-bottom lg:drawer-slide-in-right h-[90vh] lg:h-full">
        
        {/* Mobile Drag Handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-outline-variant" />
        </div>

        {/* Header (Sticky) */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-6 py-4 border-b border-outline-variant flex items-center justify-between lg:pt-6">
          <div className="flex flex-col gap-1 w-full mr-4">
            <span className="text-[11px] font-mono text-on-surface-variant uppercase tracking-wider">
              ABSCHNITT
            </span>
            <div className="flex items-center gap-3 w-full">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  className={`text-lg font-bold bg-transparent border border-transparent hover:border-outline-variant focus:border-primary focus:bg-white rounded px-2 py-1 outline-none focus:ring-0 w-full transition-all pr-8 text-primary`}
                />
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">edit</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-low text-on-surface-variant transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8">
          
          {/* Fälligkeitsdatum */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2">
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
                  onUpdatePhase(phase.id, { dateInfo: newDate });
                }}
                className="w-full px-3 py-2 border border-outline-variant rounded-lg bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans text-sm"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-base">description</span>
              Beschreibung
            </h3>
            <div className="relative group">
              <textarea
                value={localDesc}
                onChange={(e) => setLocalDesc(e.target.value)}
                onBlur={handleDescBlur}
                placeholder="Ziel, Kontext oder Notizen zu diesem Abschnitt..."
                className="w-full px-3 py-3 border border-outline-variant hover:border-primary focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary rounded-lg bg-surface font-sans text-sm resize-y min-h-[120px] transition-all"
                rows={6}
              />
            </div>
          </div>

          {/* Linked Notes Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-base">sticky_note_2</span>
                Verknüpfte Notizen
              </h3>
              {linkedNotes.length > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-full text-on-surface-variant font-bold border border-outline-variant">
                  {linkedNotes.length}
                </span>
              )}
            </div>

            {linkedNotes.length === 0 ? (
              <p className="text-xs text-on-surface-variant/60 italic p-2 bg-surface-low/50 rounded-lg border border-outline-variant/40">
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
                      className="group p-3 rounded-xl border border-outline-variant bg-white hover:border-primary hover:shadow-md transition-all cursor-pointer flex flex-col gap-1.5 relative"
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
                            onDeleteMaterial && onDeleteMaterial({ type: 'phase', phaseId: phase.id, materialId: targetId });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-red-500 transition-all shrink-0"
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
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-base">attach_file</span>
                Materialien
              </h3>
              {webMaterials.length > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-full text-on-surface-variant font-bold border border-outline-variant">
                  {webMaterials.length}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              {webMaterials.map((mat, idx) => (
                <div 
                  key={`mat-${idx}`}
                  className="group flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-white hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[20px]">description</span>
                    <a href={mat.url} target="_blank" rel="noopener noreferrer" className="flex flex-col hover:underline">
                      <span className="text-sm truncate text-primary font-medium">{mat.name || mat.title}</span>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase">Abschnitt-Material</span>
                    </a>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'phase', phaseId: phase.id, materialId: mat.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-low text-on-surface-variant transition-all"
                    title="Material löschen"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              <button
                onClick={() => onAddMaterial({ type: 'phase', id: phase.id })}
                className="mt-2 w-full py-3 flex items-center justify-center gap-2 rounded-lg border border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary hover:bg-surface-low transition-all font-mono text-xs uppercase font-bold"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Material hinzufügen
              </button>
            </div>
          </div>

          <div className="flex-1" /> {/* Spacer */}

          {/* Danger Zone */}
          <div className="pt-6 mt-4 border-t border-outline-variant">
            <button
              onClick={() => onDeletePhase(phase.id)}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-mono text-xs uppercase font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Abschnitt löschen
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default SectionDetailDrawer;
