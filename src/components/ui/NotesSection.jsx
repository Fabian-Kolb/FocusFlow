import React, { useState, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const NotesSection = ({ 
  notes = [], 
  activeNote = null,
  onCloseActiveNote,
  onAddNote, 
  onUpdateNote, 
  onDeleteNote,
  phases = [],
  onConvertNoteToPhase,
  onConvertNoteToTask,
  onLinkNote
}) => {
  const [selectedNote, setSelectedNote] = useState(null);
  const [openedFromDrawer, setOpenedFromDrawer] = useState(false);

  useEffect(() => {
    if (activeNote) {
      setSelectedNote(activeNote);
      setEditTitle(activeNote.title || '');
      setEditContent(activeNote.content || '');
      setIsEditing(false);
      setOpenedFromDrawer(true);
      resetWizard();
    }
  }, [activeNote]);

  const handleCloseModal = () => {
    setSelectedNote(null);
    setIsEditing(false);
    setOpenedFromDrawer(false);
    resetWizard();
    if (onCloseActiveNote) {
      onCloseActiveNote();
    }
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'manual', 'inbox'
  
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const gridRef = useRef(null);

  // Wizard state for "+ Hinzufügen"
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [wizardCategory, setWizardCategory] = useState(null); // 'section' | 'task'
  const [wizardAction, setWizardAction] = useState(null); 
  // 'createSection' | 'linkSectionMaterial' | 'createTask' | 'linkTaskMaterial'
  const [wizardPhaseId, setWizardPhaseId] = useState('');
  const [wizardTaskId, setWizardTaskId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const resetWizard = () => {
    setShowAddWizard(false);
    setWizardCategory(null);
    setWizardAction(null);
    setWizardPhaseId('');
    setWizardTaskId('');
    setSearchTerm('');
  };

  const filteredNotes = notes.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'manual') return n.source !== 'inbox';
    if (activeFilter === 'inbox') return n.source === 'inbox';
    return true;
  });

  useEffect(() => {
    const checkOverflow = () => {
      if (gridRef.current) {
        setNeedsCollapse(gridRef.current.scrollHeight > 350);
      }
    };
    checkOverflow();
    setTimeout(checkOverflow, 100);

    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [notes, activeFilter, showAllNotes]);

  // The custom toolbar configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }]
    ]
  };

  const handleOpenNote = (note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setIsEditing(false);
    setOpenedFromDrawer(false);
    resetWizard();
  };;

  const handleAddClick = () => {
    setSelectedNote({ id: `note_${Date.now()}`, isNew: true });
    setEditTitle('');
    setEditContent('');
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmedTitle = editTitle.trim() || 'Unbenannte Notiz';
    
    if (selectedNote.isNew) {
      onAddNote({
        id: selectedNote.id,
        title: trimmedTitle,
        content: editContent,
        source: 'manual',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      onUpdateNote(selectedNote.id, {
        title: trimmedTitle,
        content: editContent,
        updatedAt: Date.now()
      });
    }
    
    handleCloseModal();
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Möchtest du diese Notiz wirklich löschen?')) {
      if (!selectedNote.isNew) {
        onDeleteNote(selectedNote.id);
      }
      handleCloseModal();
      setIsEditing(false);
    }
  };

  // Strip HTML tags for preview but preserve line breaks
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

  // Execute wizard actions
  const handleExecuteCreateSection = () => {
    if (onConvertNoteToPhase) {
      onConvertNoteToPhase({
        ...selectedNote,
        content: formatPreview(selectedNote.content)
      });
    }
    handleCloseModal();
    resetWizard();
  };

  const handleExecuteLinkSectionMaterial = () => {
    if (!wizardPhaseId) return;
    if (onLinkNote) {
      onLinkNote(selectedNote, 'phase', wizardPhaseId);
    }
    handleCloseModal();
    resetWizard();
  };

  const handleExecuteCreateTask = () => {
    if (!wizardPhaseId) return;
    if (onConvertNoteToTask) {
      onConvertNoteToTask({
        ...selectedNote,
        content: formatPreview(selectedNote.content)
      }, wizardPhaseId);
    }
    handleCloseModal();
    resetWizard();
  };

  const handleExecuteLinkTaskMaterial = () => {
    if (!wizardTaskId || !wizardPhaseId) return;
    if (onLinkNote) {
      onLinkNote(selectedNote, 'task', wizardTaskId, wizardPhaseId);
    }
    handleCloseModal();
    resetWizard();
  };

  return (
    <div className="mt-8 mb-8 relative">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-mono font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">notes</span>
          Notizen
        </h3>
        <button
          onClick={handleAddClick}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white transition-colors"
          title="Neue Notiz"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
        </button>
      </div>

      {/* Tabs / Filter */}
      {notes.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto no-wrap-scroll pb-1">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeFilter === 'all' ? 'bg-primary text-white' : 'bg-surface-low text-on-surface-variant border border-outline-variant hover:border-primary'}`}
          >
            Alle ({notes.length})
          </button>
          <button
            onClick={() => setActiveFilter('manual')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeFilter === 'manual' ? 'bg-primary text-white' : 'bg-surface-low text-on-surface-variant border border-outline-variant hover:border-primary'}`}
          >
            Eigene Notizen ({notes.filter(n => n.source !== 'inbox').length})
          </button>
          <button
            onClick={() => setActiveFilter('inbox')}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1 ${activeFilter === 'inbox' ? 'bg-primary text-white' : 'bg-surface-low text-on-surface-variant border border-outline-variant hover:border-primary'}`}
          >
            <span className="material-symbols-outlined text-[14px]">inbox</span>
            Aus der Inbox ({notes.filter(n => n.source === 'inbox').length})
          </button>
        </div>
      )}

      {filteredNotes.length === 0 ? (
        <div 
          onClick={handleAddClick}
          className="w-full p-8 border-2 border-dashed border-outline-variant rounded-2xl flex flex-col items-center justify-center text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer group"
        >
          <span className="material-symbols-outlined text-[32px] mb-2 group-hover:scale-110 transition-transform">note_add</span>
          <p className="text-sm font-medium">Keine Notizen vorhanden</p>
          <p className="text-xs opacity-70 mt-1">Klicke hier, um eine Notiz anzulegen</p>
        </div>
      ) : (
        <div className="relative">
          <div 
            ref={gridRef}
            className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${!showAllNotes ? 'max-h-[340px] overflow-hidden' : ''}`}
          >
            {filteredNotes.map(note => (
              <div
                key={note.id}
                onClick={() => handleOpenNote(note)}
                className="bg-surface-low border border-outline-variant rounded-2xl p-4 cursor-pointer hover:border-primary hover:shadow-md transition-all group flex flex-col h-40"
              >
                <h4 className="font-bold text-on-surface text-sm mb-2 line-clamp-1 group-hover:text-primary transition-colors flex items-center justify-between gap-2">
                  <span className="truncate">{note.title}</span>
                  {note.source === 'inbox' && (
                    <span className="shrink-0 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">inbox</span> Inbox
                    </span>
                  )}
                </h4>
                <p className="text-xs text-on-surface-variant line-clamp-4 flex-grow break-words whitespace-pre-wrap">
                  {formatPreview(note.content) || <span className="italic opacity-50">Kein Inhalt</span>}
                </p>
                <div className="text-[10px] text-on-surface-variant/50 mt-2 font-mono uppercase">
                  {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          {needsCollapse && !showAllNotes && (
            <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#FBF9F9] via-[#FBF9F9]/80 to-transparent flex items-end justify-center pb-2 pointer-events-none">
              <button 
                onClick={() => setShowAllNotes(true)}
                className="bg-white border border-outline-variant px-5 py-2.5 rounded-full text-xs font-bold text-primary shadow-sm hover:border-primary transition-colors z-10 cursor-pointer pointer-events-auto"
              >
                Alle {filteredNotes.length} Notizen in diesem Bereich anzeigen
              </button>
            </div>
          )}
          
          {needsCollapse && showAllNotes && (
             <div className="flex justify-center mt-6">
              <button 
                onClick={() => setShowAllNotes(false)}
                className="bg-surface-low border border-outline-variant px-5 py-2.5 rounded-full text-xs font-bold text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer"
              >
                Weniger anzeigen
              </button>
             </div>
          )}
        </div>
      )}

      {selectedNote && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white border-2 border-primary rounded-[2rem] w-full max-w-3xl flex flex-col shadow-2xl relative h-[90vh] sm:h-[80vh] overflow-hidden">
            
            {/* STEP-BY-STEP ADD WIZARD OVERLAY */}
            {showAddWizard && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                <div className="bg-white border border-outline-variant rounded-2xl shadow-2xl p-6 max-w-md w-full relative max-h-[85vh] flex flex-col">
                  
                  {/* Wizard Header */}
                  <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      {wizardCategory && (
                        <button
                          onClick={() => {
                            if (wizardAction) {
                              setWizardAction(null);
                            } else {
                              setWizardCategory(null);
                            }
                          }}
                          className="p-1 rounded-lg hover:bg-surface-low text-on-surface-variant transition-colors"
                          title="Zurück"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        </button>
                      )}
                      <h3 className="text-base font-bold text-primary font-mono uppercase">
                        {!wizardCategory ? 'Notiz zuweisen' : wizardCategory === 'section' ? 'Abschnitt-Optionen' : 'Aufgaben-Optionen'}
                      </h3>
                    </div>
                    <button
                      onClick={resetWizard}
                      className="p-1 rounded-lg hover:bg-surface-low text-on-surface-variant transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>

                  <div className="overflow-y-auto flex-1 pr-1 space-y-4">
                    {/* STEP 1: Choose Category (Abschnitt vs Aufgabe) */}
                    {!wizardCategory && (
                      <div className="space-y-3">
                        <p className="text-xs text-on-surface-variant mb-4">
                          Wozu möchtest du diese Notiz hinzufügen?
                        </p>
                        
                        <button
                          onClick={() => setWizardCategory('section')}
                          className="w-full p-4 border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-start gap-3 group cursor-pointer"
                        >
                          <div className="p-2.5 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[24px]">layers</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-primary">Abschnitt</h4>
                            <p className="text-xs text-on-surface-variant mt-0.5">Neuen Abschnitt erstellen oder als Material anheften</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setWizardCategory('task')}
                          className="w-full p-4 border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-start gap-3 group cursor-pointer"
                        >
                          <div className="p-2.5 bg-primary/10 text-primary rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined text-[24px]">task</span>
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-primary">Aufgabe</h4>
                            <p className="text-xs text-on-surface-variant mt-0.5">In neue Aufgabe umwandeln oder an Aufgabe anheften</p>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* STEP 2a: Section Options */}
                    {wizardCategory === 'section' && !wizardAction && (
                      <div className="space-y-3">
                        <p className="text-xs text-on-surface-variant mb-4">
                          Was möchtest du mit dem Abschnitt tun?
                        </p>

                        <button
                          onClick={handleExecuteCreateSection}
                          className="w-full p-3.5 border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center gap-3 cursor-pointer group"
                        >
                          <span className="material-symbols-outlined text-primary text-[20px] group-hover:scale-110 transition-transform">add_circle</span>
                          <div>
                            <h4 className="font-bold text-sm text-primary">Neuen Abschnitt mit dieser Notiz erstellen</h4>
                            <p className="text-[11px] text-on-surface-variant">Notiz wird als neuer Abschnitt angelegt und umgewandelt</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setWizardAction('linkSectionMaterial')}
                          className="w-full p-3.5 border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center gap-3 cursor-pointer group"
                        >
                          <span className="material-symbols-outlined text-primary text-[20px] group-hover:scale-110 transition-transform">attach_file</span>
                          <div>
                            <h4 className="font-bold text-sm text-primary">Material zu bestehendem Abschnitt hinzufügen</h4>
                            <p className="text-[11px] text-on-surface-variant">Verknüpft die Notiz als Material (Notiz bleibt erhalten)</p>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* STEP 2b: Task Options */}
                    {wizardCategory === 'task' && !wizardAction && (
                      <div className="space-y-3">
                        <p className="text-xs text-on-surface-variant mb-4">
                          Was möchtest du mit der Aufgabe tun?
                        </p>

                        <button
                          onClick={() => setWizardAction('createTask')}
                          className="w-full p-3.5 border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center gap-3 cursor-pointer group"
                        >
                          <span className="material-symbols-outlined text-primary text-[20px] group-hover:scale-110 transition-transform">add_task</span>
                          <div>
                            <h4 className="font-bold text-sm text-primary">Neue Aufgabe aus Notiz erstellen</h4>
                            <p className="text-[11px] text-on-surface-variant">Erstellt eine Aufgabe in einem Abschnitt (Notiz wird umgewandelt)</p>
                          </div>
                        </button>

                        <button
                          onClick={() => setWizardAction('linkTaskMaterial')}
                          className="w-full p-3.5 border border-outline-variant rounded-xl hover:border-primary hover:bg-primary/5 transition-all text-left flex items-center gap-3 cursor-pointer group"
                        >
                          <span className="material-symbols-outlined text-primary text-[20px] group-hover:scale-110 transition-transform">attach_file</span>
                          <div>
                            <h4 className="font-bold text-sm text-primary">Material zu bestehender Aufgabe hinzufügen</h4>
                            <p className="text-[11px] text-on-surface-variant">Verknüpft die Notiz mit einer Aufgabe (Notiz bleibt erhalten)</p>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* STEP 3a: Select Section for Section Material */}
                    {wizardAction === 'linkSectionMaterial' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-primary uppercase mb-2">Abschnitt auswählen</label>
                          
                          <div className="relative mb-3">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                            <input
                              type="text"
                              placeholder="Abschnitt suchen..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {phases
                              .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => setWizardPhaseId(p.id)}
                                  className={`p-3 rounded-xl border text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${wizardPhaseId === p.id ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' : 'border-outline-variant hover:border-primary/50 text-on-surface bg-surface-low/50'}`}
                                >
                                  <span className="truncate">{p.title}</span>
                                  {wizardPhaseId === p.id && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                                </div>
                              ))}
                            {phases.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                              <p className="text-xs text-on-surface-variant italic p-2 text-center">Kein Abschnitt gefunden</p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            disabled={!wizardPhaseId}
                            onClick={handleExecuteLinkSectionMaterial}
                            className="w-full py-2.5 bg-primary text-white text-xs font-mono font-bold uppercase rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Material verknüpfen
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3b: Select Section for New Task */}
                    {wizardAction === 'createTask' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-primary uppercase mb-2">Ziel-Abschnitt auswählen</label>
                          
                          <div className="relative mb-3">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                            <input
                              type="text"
                              placeholder="Abschnitt suchen..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                            {phases
                              .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => setWizardPhaseId(p.id)}
                                  className={`p-3 rounded-xl border text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${wizardPhaseId === p.id ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' : 'border-outline-variant hover:border-primary/50 text-on-surface bg-surface-low/50'}`}
                                >
                                  <span className="truncate">{p.title}</span>
                                  {wizardPhaseId === p.id && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                                </div>
                              ))}
                            {phases.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                              <p className="text-xs text-on-surface-variant italic p-2 text-center">Kein Abschnitt gefunden</p>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            disabled={!wizardPhaseId}
                            onClick={handleExecuteCreateTask}
                            className="w-full py-2.5 bg-primary text-white text-xs font-mono font-bold uppercase rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Aufgabe erstellen
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3c: Select Section & Task for Task Material */}
                    {wizardAction === 'linkTaskMaterial' && (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-primary uppercase mb-2">1. Abschnitt auswählen</label>
                          
                          <div className="relative mb-3">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
                            <input
                              type="text"
                              placeholder="Abschnitt suchen..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 border border-outline-variant rounded-xl text-sm focus:border-primary outline-none"
                            />
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {phases
                              .filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
                              .map(p => (
                                <div
                                  key={p.id}
                                  onClick={() => { setWizardPhaseId(p.id); setWizardTaskId(''); }}
                                  className={`p-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${wizardPhaseId === p.id ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' : 'border-outline-variant hover:border-primary/50 text-on-surface bg-surface-low/50'}`}
                                >
                                  <span className="truncate">{p.title}</span>
                                  {wizardPhaseId === p.id && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                                </div>
                              ))}
                          </div>
                        </div>

                        {wizardPhaseId && (
                          <div>
                            <label className="block text-xs font-bold text-primary uppercase mb-2">2. Aufgabe auswählen</label>
                            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                              {phases.find(p => p.id === wizardPhaseId)?.tasks?.map(t => (
                                <div
                                  key={t.id}
                                  onClick={() => setWizardTaskId(t.id)}
                                  className={`p-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${wizardTaskId === t.id ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm' : 'border-outline-variant hover:border-primary/50 text-on-surface bg-surface-low/50'}`}
                                >
                                  <span className="truncate">{t.title}</span>
                                  {wizardTaskId === t.id && <span className="material-symbols-outlined text-[18px]">check_circle</span>}
                                </div>
                              ))}
                              {(phases.find(p => p.id === wizardPhaseId)?.tasks?.length || 0) === 0 && (
                                <p className="text-xs text-on-surface-variant italic p-2 text-center">Keine Aufgaben in diesem Abschnitt</p>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            disabled={!wizardTaskId}
                            onClick={handleExecuteLinkTaskMaterial}
                            className="w-full py-2.5 bg-primary text-white text-xs font-mono font-bold uppercase rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            Material zu Aufgabe verknüpfen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between border-b border-outline-variant p-4 sm:p-5 flex-shrink-0 bg-surface-low rounded-t-[2rem]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">
                  {isEditing ? 'edit_document' : 'description'}
                </span>
                <h3 className="text-sm sm:text-base font-bold font-mono uppercase text-primary">
                  {isEditing ? (selectedNote.isNew ? 'Neue Notiz' : 'Notiz bearbeiten') : 'Notiz'}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {!isEditing && !selectedNote.isNew && (
                  <button
                    onClick={() => { setShowAddWizard(true); setWizardCategory(null); setWizardAction(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-xl hover:bg-neutral-800 transition-colors text-xs font-mono font-bold uppercase shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {openedFromDrawer ? 'swap_horiz' : 'add'}
                    </span>
                    {openedFromDrawer ? 'Woanders hinzufügen' : '+ Hinzufügen'}
                  </button>
                )}
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-white transition-colors"
                    title="Bearbeiten"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                )}
                {isEditing && (
                  <button
                    onClick={handleDelete}
                    className="p-2 bg-error/10 text-error rounded-xl hover:bg-error hover:text-white transition-colors"
                    title="Löschen"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
                <button
                  onClick={() => handleCloseModal()}
                  className="p-2 hover:bg-surface border border-transparent hover:border-outline-variant rounded-xl transition-colors cursor-pointer"
                  title="Schließen"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-grow overflow-y-auto p-4 sm:p-6 bg-white custom-quill-container">
              {isEditing ? (
                <div className="h-full flex flex-col gap-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Notiz-Titel..."
                    className="w-full text-xl sm:text-2xl font-bold border-none outline-none focus:ring-0 p-0 text-on-surface placeholder:text-on-surface-variant/30"
                    autoFocus
                  />
                  <div className="flex-grow min-h-[300px]">
                    <ReactQuill 
                      theme="snow" 
                      value={editContent} 
                      onChange={setEditContent} 
                      modules={modules}
                      className="h-full flex flex-col"
                      placeholder="Schreibe deine Notiz..."
                    />
                  </div>
                </div>
              ) : (
                <div className="prose prose-sm sm:prose-base max-w-none prose-p:leading-relaxed prose-headings:font-bold prose-a:text-primary">
                  <h1 className="text-2xl sm:text-3xl font-bold text-on-surface mb-6 border-b border-outline-variant pb-4">
                    {selectedNote.title}
                  </h1>
                  <div 
                    dangerouslySetInnerHTML={{ __html: selectedNote.content }}
                    className="quill-content-renderer"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            {isEditing && (
              <div className="p-4 sm:p-5 border-t border-outline-variant bg-surface-low rounded-b-[2rem] flex justify-end gap-3 flex-shrink-0">
                <button
                  onClick={() => handleCloseModal()}
                  className="px-5 py-2.5 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleSave}
                  className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Speichern
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesSection;
