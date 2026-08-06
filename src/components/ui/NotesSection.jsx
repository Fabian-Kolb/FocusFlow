import React, { useState, useRef, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

const NotesSection = ({ notes = [], onAddNote, onUpdateNote, onDeleteNote }) => {
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'manual', 'inbox'
  
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const gridRef = useRef(null);

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
    setIsEditing(false); // Can view first or jump straight to edit
  };

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
    
    setSelectedNote(null);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Möchtest du diese Notiz wirklich löschen?')) {
      if (!selectedNote.isNew) {
        onDeleteNote(selectedNote.id);
      }
      setSelectedNote(null);
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white border-2 border-primary rounded-[2rem] w-full max-w-3xl flex flex-col shadow-2xl relative h-[90vh] sm:h-[80vh] overflow-hidden">
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
                  onClick={() => setSelectedNote(null)}
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
                  onClick={() => setSelectedNote(null)}
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
