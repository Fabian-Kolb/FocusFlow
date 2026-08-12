import React, { useState, useEffect } from 'react';

const TaskDetailDrawer = ({
  task,
  phase,
  isOpen,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onToggleTask,
  onAddMaterial,
  onDeleteMaterial
}) => {
  const [localTitle, setLocalTitle] = useState('');
  const [localNote, setLocalNote] = useState('');
  const [localDate, setLocalDate] = useState('');

  useEffect(() => {
    if (task) {
      setLocalTitle(task.title || '');
      setLocalNote(task.note || '');
      setLocalDate(task.date || '');
    }
  }, [task]);

  if (!isOpen || !task || !phase) return null;

  const handleTitleBlur = () => {
    if (localTitle !== task.title) {
      onUpdateTask(phase.id, task.id, { title: localTitle });
    }
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  const handleNoteBlur = () => {
    if (localNote !== task.note) {
      onUpdateTask(phase.id, task.id, { note: localNote });
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setLocalDate(newDate);
    onUpdateTask(phase.id, task.id, { date: newDate });
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
              {phase.title}
            </span>
            <div className="flex items-center gap-3 w-full">
              <button 
                onClick={() => onToggleTask(phase.id, task.id)}
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${task.completed ? 'bg-primary border-primary text-white' : 'border-outline-variant text-transparent hover:border-primary'}`}
              >
                <span className="material-symbols-outlined text-[16px] leading-none">check</span>
              </button>
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={handleTitleKeyDown}
                  className={`text-lg font-bold bg-transparent border border-transparent hover:border-outline-variant focus:border-primary focus:bg-white rounded px-2 py-1 outline-none focus:ring-0 w-full transition-all pr-8 ${task.completed ? 'line-through text-on-surface-variant' : 'text-primary'}`}
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
          
          {/* Due Date */}
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-base">calendar_today</span>
              Fälligkeitsdatum
            </h3>
            <div className="relative">
              <input 
                type="date"
                value={localDate}
                onChange={handleDateChange}
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
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              onBlur={handleNoteBlur}
              placeholder="Gedanken, Details oder Anmerkungen zu dieser Aufgabe..."
              className="w-full px-3 py-3 border border-outline-variant rounded-lg bg-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-sans text-sm resize-y min-h-[120px]"
              rows={6}
            />
          </div>

          {/* Materials & Links */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold text-primary uppercase flex items-center gap-2">
                <span className="material-symbols-outlined text-base">attach_file</span>
                Materialien & Links
              </h3>
              {((task.links?.length || 0) + (phase.materials?.length || 0)) > 0 && (
                <span className="text-[10px] font-mono bg-surface-low px-2 py-0.5 rounded-full text-on-surface-variant font-bold border border-outline-variant">
                  {(task.links?.length || 0) + (phase.materials?.length || 0)}
                </span>
              )}
            </div>
            
            <div className="flex flex-col gap-2 mt-2">
              {/* Task Links */}
              {task.links?.map((link, idx) => (
                <a 
                  key={`link-${idx}`} 
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-white hover:border-primary hover:shadow-sm transition-all"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[20px]">link</span>
                    <span className="text-sm truncate text-primary font-medium">{link.name || link.url}</span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'task', taskId: task.id, phaseId: phase.id, linkId: link.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-low text-on-surface-variant transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </a>
              ))}

              {/* Phase Materials */}
              {phase.materials?.map((mat, idx) => (
                <div 
                  key={`mat-${idx}`}
                  className="group flex items-center justify-between p-3 rounded-lg border border-outline-variant bg-surface hover:border-primary hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors text-[20px]">description</span>
                    <div className="flex flex-col">
                      <span className="text-sm truncate text-primary font-medium">{mat.name || mat.title}</span>
                      <span className="text-[10px] font-mono text-on-surface-variant uppercase">Abschnitt-Material</span>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      onDeleteMaterial({ type: 'phase', phaseId: phase.id, materialId: mat.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-surface-low text-on-surface-variant transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}

              <button
                onClick={() => onAddMaterial({ type: 'task', taskId: task.id, phaseId: phase.id })}
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
              onClick={() => onDeleteTask(phase.id, task.id)}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors font-mono text-xs uppercase font-bold"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              Aufgabe löschen
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default TaskDetailDrawer;
