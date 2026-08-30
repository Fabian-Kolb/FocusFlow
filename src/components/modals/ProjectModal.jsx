import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { generateProjectStructure, ensureBulletPoints } from '../../lib/gemini';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import FioIcon from '../ui/FioIcon';

const ProjectModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, addProject } = useModalContext();
  const isOpen = activeModal === 'project';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('GEPLANT');
  const [phases, setPhases] = useState([]);
  // State for AI phase generation options and preview
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [aiGranularity, setAiGranularity] = useState('balanced');
  const [aiEstimateDates, setAiEstimateDates] = useState(true);
  const [generatedPreview, setGeneratedPreview] = useState(null);

  // Checkbox states for the 3 separate notes when converting from Inbox
  const [includeSummaryNote, setIncludeSummaryNote] = useState(true);
  const [includeCleanNote, setIncludeCleanNote] = useState(true);
  const [includeRawNote, setIncludeRawNote] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName(modalPayload.prefillTitle || modalPayload.prefilledTitle || '');
      setDescription(modalPayload.prefillDescription || '');
      setStartDate(modalPayload.startDate || '');
      setEndDate(modalPayload.endDate || '');
      setStatus(modalPayload.status || 'GEPLANT');

      setIncludeSummaryNote(Boolean(modalPayload.summaryText));
      setIncludeCleanNote(Boolean(modalPayload.cleanText));
      setIncludeRawNote(Boolean(modalPayload.originalText && !modalPayload.cleanText));
      
      // Initialize with one empty phase if not a conversion, else start empty so AI can fill
      const initialPhase = modalPayload.firstPhase ? [{ title: modalPayload.firstPhase, tasks: [] }] : [];
      setPhases(initialPhase);

      // Auto-focus input after modal opens
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, modalPayload]);

  if (!isOpen) {
    return null;
  }

  const isConversion = Boolean(modalPayload.inboxItemId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    const notes = [];
    const now = Date.now();

    if (isConversion) {
      // 1. KI-Zusammenfassung Note
      if (includeSummaryNote && modalPayload.summaryText) {
        const htmlContent = DOMPurify.sanitize(marked.parse(ensureBulletPoints(modalPayload.summaryText)));
        notes.push({
          id: `note_sum_${now}`,
          title: 'KI-Zusammenfassung',
          content: htmlContent,
          source: 'inbox',
          createdAt: now,
          updatedAt: now
        });
      }

      // 2. Zusammenfassung des Textes (Bereinigter Fließtext) Note
      if (includeCleanNote && (modalPayload.cleanText || modalPayload.summaryText)) {
        const rawClean = modalPayload.cleanText || modalPayload.summaryText;
        const textContent = DOMPurify.sanitize(rawClean.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        notes.push({
          id: `note_clean_${now + 1}`,
          title: 'Zusammenfassung des Textes',
          content: `<p>${textContent.replace(/\n/g, '<br/>')}</p>`,
          source: 'inbox',
          createdAt: now + 1,
          updatedAt: now + 1
        });
      }

      // 3. Roh-Transkription Note
      if (includeRawNote && modalPayload.originalText) {
        const rawOrig = modalPayload.originalText;
        const origContent = DOMPurify.sanitize(rawOrig.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        notes.push({
          id: `note_raw_${now + 2}`,
          title: 'Roh-Transkription',
          content: `<p>${origContent.replace(/\n/g, '<br/>')}</p>`,
          source: 'inbox',
          createdAt: now + 2,
          updatedAt: now + 2
        });
      }
    }

    addProject({
      title: name.trim(),
      description: description.trim(),
      startDate,
      endDate,
      status,
      phases,
      notes,
      inboxItemId: modalPayload.inboxItemId
    });

    closeModal();
    if (setCurrentScreen) {
      setCurrentScreen('projects');
    }
  };

  const handleAddPhase = () => setPhases([...phases, { title: '', date: '', note: '', tasks: [] }]);
  const handleUpdatePhaseTitle = (idx, newTitle) => {
    const updated = [...phases];
    updated[idx].title = newTitle;
    setPhases(updated);
  };
  const handleUpdatePhaseDate = (idx, newDate) => {
    const updated = [...phases];
    updated[idx].date = newDate;
    setPhases(updated);
  };
  const handleUpdatePhaseNote = (idx, newNote) => {
    const updated = [...phases];
    updated[idx].note = newNote;
    setPhases(updated);
  };
  const handleRemovePhase = (idx) => {
    const updated = [...phases];
    updated.splice(idx, 1);
    setPhases(updated);
  };

  const handleAddTask = (phaseIdx) => {
    const updated = [...phases];
    if (!updated[phaseIdx].tasks) updated[phaseIdx].tasks = [];
    updated[phaseIdx].tasks.push({ title: '', date: '', note: '' });
    setPhases(updated);
  };
  const handleUpdateTaskTitle = (phaseIdx, taskIdx, newTitle) => {
    const updated = [...phases];
    updated[phaseIdx].tasks[taskIdx].title = newTitle;
    setPhases(updated);
  };
  const handleUpdateTaskDate = (phaseIdx, taskIdx, newDate) => {
    const updated = [...phases];
    updated[phaseIdx].tasks[taskIdx].date = newDate;
    setPhases(updated);
  };
  const handleUpdateTaskNote = (phaseIdx, taskIdx, newNote) => {
    const updated = [...phases];
    updated[phaseIdx].tasks[taskIdx].note = newNote;
    setPhases(updated);
  };
  const handleRemoveTask = (phaseIdx, taskIdx) => {
    const updated = [...phases];
    updated[phaseIdx].tasks.splice(taskIdx, 1);
    setPhases(updated);
  };

  return (
    <div
      id="project-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl relative my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant p-5 sm:px-6 sm:py-5 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              <span className="material-symbols-outlined text-[22px]">create_new_folder</span>
            </div>
            <h2 className="text-sm sm:text-base font-bold font-mono uppercase truncate text-on-surface" id="project-modal-title">
              {isConversion ? 'Inbox-Gedanke umwandeln' : 'Neues Projekt erstellen'}
            </h2>
          </div>
          <button
            type="button"
            className="p-2 hover:bg-surface-low rounded-full text-on-surface-variant transition-colors"
            onClick={closeModal}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto p-5 sm:p-6 flex-grow">
          <form id="project-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Title & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                  Projekttitel *
                </label>
                <input
                  type="text"
                  ref={nameInputRef}
                  required
                  className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-colors"
                  placeholder="z.B. Re-Branding 2024"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                  Initialer Status
                </label>
                <select
                  className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm font-medium focus:border-primary outline-none transition-colors bg-white cursor-pointer"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="GEPLANT">🔵 Geplant</option>
                  <option value="AKTIV">🟢 Aktiv</option>
                  <option value="ABGESCHLOSSEN">⚫ Erledigt</option>
                </select>
              </div>
            </div>

            {/* AI Generation Button */}
            {/* AI Phase Generation Button & Notes Selection when converting from Inbox */}
            {isConversion && (
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-on-surface-variant max-w-sm leading-relaxed">
                    Lass die KI aus deiner Notiz automatisch <strong>Phasen und Aufgaben</strong> mit eigener Granularität und Zeitschätzung erstellen.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGeneratedPreview(null);
                      setIsAiConfigOpen(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-colors shadow-sm cursor-pointer"
                  >
                    <FioIcon className="w-4 h-4 text-white" color="currentColor" />
                    Phasen & Aufgaben generieren...
                  </button>
                </div>

                {/* 3 Notes Selection */}
                <div className="bg-surface-low border border-outline-variant rounded-xl p-4 space-y-3">
                  <label className="block text-xs font-mono font-bold text-primary uppercase tracking-wide">
                    Inbox-Notizen übernehmen
                  </label>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Wähle aus, welche Notizen in das neue Projekt abgelegt werden sollen (sie werden nicht nochmals zusammengefasst):
                  </p>
                  <div className="space-y-2.5 pt-1">
                    {modalPayload.summaryText && (
                      <label className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="checkbox"
                          checked={includeSummaryNote}
                          onChange={(e) => setIncludeSummaryNote(e.target.checked)}
                          className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <div className="flex-grow">
                          <span className="text-xs font-bold text-primary block">Notiz 1: KI-Zusammenfassung</span>
                          <span className="text-[11px] text-on-surface-variant block">Strukturierte Stichpunkte & Übersichten</span>
                        </div>
                      </label>
                    )}

                    {(modalPayload.cleanText || modalPayload.summaryText) && (
                      <label className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="checkbox"
                          checked={includeCleanNote}
                          onChange={(e) => setIncludeCleanNote(e.target.checked)}
                          className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <div className="flex-grow">
                          <span className="text-xs font-bold text-primary block">Notiz 2: Zusammenfassung des Textes</span>
                          <span className="text-[11px] text-on-surface-variant block">Bereinigter Fließtext ohne Füllwörter</span>
                        </div>
                      </label>
                    )}

                    {modalPayload.originalText && (
                      <label className="flex items-center gap-3 p-3 bg-white border border-outline-variant rounded-xl cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="checkbox"
                          checked={includeRawNote}
                          onChange={(e) => setIncludeRawNote(e.target.checked)}
                          className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                        />
                        <div className="flex-grow">
                          <span className="text-xs font-bold text-primary block">Notiz 3: Roh-Transkription</span>
                          <span className="text-[11px] text-on-surface-variant block">Wortgetreues Original-Diktat</span>
                        </div>
                      </label>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                Beschreibung / Notiz (Optional)
              </label>
              <textarea
                className="w-full border-2 border-outline-variant rounded-xl px-4 py-3 text-sm focus:border-primary outline-none min-h-[120px] resize-y transition-colors leading-relaxed"
                placeholder="Zusätzliche Details, Kontext oder Fließtext..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                  Startdatum
                </label>
                <input
                  type="date"
                  className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-colors bg-white cursor-pointer"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-mono font-bold text-primary mb-1.5 uppercase tracking-wide">
                  Deadline
                </label>
                <input
                  type="date"
                  className="w-full border-2 border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:border-primary outline-none transition-colors bg-white cursor-pointer"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Dynamic Phases & Tasks */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold text-primary uppercase tracking-wide">
                  Projekt-Phasen & Aufgaben
                </label>
                <button
                  type="button"
                  onClick={handleAddPhase}
                  className="text-xs font-bold text-primary hover:text-neutral-800 flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Phase hinzufügen
                </button>
              </div>

              {phases.length === 0 ? (
                <div className="text-sm text-on-surface-variant text-center py-6 bg-surface-low border border-dashed border-outline-variant rounded-xl">
                  Noch keine Phasen angelegt.
                </div>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase, pIdx) => (
                    <div key={pIdx} className="bg-surface-low border border-outline-variant rounded-xl p-4 space-y-3 relative group">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-on-surface-variant">P{pIdx + 1}</span>
                          <input
                            type="text"
                            placeholder="Name der Phase (z.B. Vorbereitung)"
                            value={phase.title || ''}
                            onChange={(e) => handleUpdatePhaseTitle(pIdx, e.target.value)}
                            className="flex-grow bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-sm font-medium focus:border-primary outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhase(pIdx)}
                            className="p-1.5 text-on-surface-variant hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Phase löschen"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 pl-6">
                          <input
                            type="date"
                            value={phase.date || ''}
                            onChange={(e) => handleUpdatePhaseDate(pIdx, e.target.value)}
                            className="w-full sm:w-auto bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:border-primary outline-none transition-colors cursor-pointer"
                            title="Phasen-Datum"
                          />
                          <textarea
                            placeholder="Phasen-Notiz / Dateien-Link..."
                            value={phase.note || ''}
                            onChange={(e) => handleUpdatePhaseNote(pIdx, e.target.value)}
                            className="w-full flex-grow bg-white border border-outline-variant rounded-lg px-3 py-1.5 text-xs focus:border-primary outline-none transition-colors min-h-[36px] resize-y"
                          />
                        </div>
                      </div>

                      <div className="pl-6 space-y-3 mt-2 border-t border-outline-variant/50 pt-3">
                        {phase.tasks && phase.tasks.map((task, tIdx) => (
                          <div key={tIdx} className="flex flex-col gap-1.5 bg-white p-2 rounded-lg border border-outline-variant/50">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">check_box_outline_blank</span>
                              <input
                                type="text"
                                placeholder="Unteraufgabe"
                                value={task.title || ''}
                                onChange={(e) => handleUpdateTaskTitle(pIdx, tIdx, e.target.value)}
                                className="flex-grow bg-transparent border-none text-sm focus:ring-0 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveTask(pIdx, tIdx)}
                                className="p-1 text-on-surface-variant hover:text-red-500 rounded transition-colors"
                              >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                              </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 pl-6">
                              <input
                                type="date"
                                value={task.date || ''}
                                onChange={(e) => handleUpdateTaskDate(pIdx, tIdx, e.target.value)}
                                className="w-full sm:w-auto bg-surface-low border border-outline-variant rounded-md px-2 py-1 text-xs focus:border-primary outline-none transition-colors cursor-pointer"
                                title="Task-Datum"
                              />
                              <input
                                type="text"
                                placeholder="Task-Notiz / Link..."
                                value={task.note || ''}
                                onChange={(e) => handleUpdateTaskNote(pIdx, tIdx, e.target.value)}
                                className="w-full flex-grow bg-surface-low border border-outline-variant rounded-md px-2 py-1 text-xs focus:border-primary outline-none transition-colors"
                              />
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddTask(pIdx)}
                          className="text-[11px] font-bold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors mt-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">add</span>
                          Aufgabe hinzufügen
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t border-outline-variant p-5 sm:px-6 flex items-center justify-end gap-3 flex-shrink-0 bg-surface-low rounded-b-2xl">
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-on-surface-variant hover:bg-surface-variant/50 transition-colors"
            onClick={closeModal}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form="project-form"
            className="px-6 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-neutral-800 transition-colors shadow-sm"
          >
            Projekt anlegen
          </button>
        </div>
      </div>

      {/* AI Phase Generator Dialog (Feedback & Preferences) */}
      {isAiConfigOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-5 sm:p-6 space-y-5 border-2 border-primary relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3">
              <div className="flex items-center gap-2">
                <FioIcon className="w-5 h-5 text-primary" color="currentColor" />
                <h3 className="text-sm font-bold font-mono uppercase text-primary">
                  Fio KI-Phasengenerierung anpassen
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAiConfigOpen(false);
                  setGeneratedPreview(null);
                }}
                className="p-1 hover:bg-surface-low rounded-full text-on-surface-variant transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {!generatedPreview ? (
              <div className="space-y-5">
                {/* 1. Granularitätsauswahl */}
                <div>
                  <label className="block text-xs font-mono font-bold text-primary mb-2 uppercase">
                    Phasen-Granularität
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAiGranularity('few')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        aiGranularity === 'few'
                          ? 'border-primary bg-primary/10 font-bold'
                          : 'border-outline-variant hover:bg-surface-low text-on-surface-variant'
                      }`}
                    >
                      <div className="text-xs text-primary font-bold">Kompakt</div>
                      <div className="text-[10px] text-on-surface-variant">2-3 Phasen</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiGranularity('balanced')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        aiGranularity === 'balanced'
                          ? 'border-primary bg-primary/10 font-bold'
                          : 'border-outline-variant hover:bg-surface-low text-on-surface-variant'
                      }`}
                    >
                      <div className="text-xs text-primary font-bold">Ausgewogen</div>
                      <div className="text-[10px] text-on-surface-variant">3-5 Phasen</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiGranularity('detailed')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        aiGranularity === 'detailed'
                          ? 'border-primary bg-primary/10 font-bold'
                          : 'border-outline-variant hover:bg-surface-low text-on-surface-variant'
                      }`}
                    >
                      <div className="text-xs text-primary font-bold">Detailliert</div>
                      <div className="text-[10px] text-on-surface-variant">5-8 Phasen</div>
                    </button>
                  </div>
                </div>

                {/* 2. Zeitliche Schätzung / Datumsverteilung */}
                <div className="bg-surface-low border border-outline-variant rounded-xl p-3.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aiEstimateDates}
                      onChange={(e) => setAiEstimateDates(e.target.checked)}
                      className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary"
                    />
                    <span className="text-xs font-bold text-primary">
                      Termine & Fristen automatisch schätzen
                    </span>
                  </label>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed pl-6">
                    Die KI verteilt die Fälligkeiten der Aufgaben gleichmäßig über den angegebenen Projektzeitraum ({startDate || 'Heute'} bis {endDate || 'Offen'}).
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setIsAiConfigOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-low rounded-lg transition-colors cursor-pointer"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const textToStructure = description || name;
                      if (!textToStructure.trim()) return;
                      setIsGenerating(true);
                      const result = await generateProjectStructure(textToStructure, {
                        granularity: aiGranularity,
                        startDate,
                        endDate,
                        estimateDates: aiEstimateDates
                      });
                      if (result && result.phases) {
                        setGeneratedPreview(result.phases);
                      }
                      setIsGenerating(false);
                    }}
                    disabled={isGenerating}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {isGenerating ? (
                      <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    ) : (
                      <FioIcon className="w-4 h-4 text-white" color="currentColor" />
                    )}
                    {isGenerating ? 'Phasen werden generiert...' : 'Phasen jetzt generieren'}
                  </button>
                </div>
              </div>
            ) : (
              /* Vorschau & Feedback Ansicht */
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                  <span className="font-bold">Generierte Phasenstruktur im Überblick:</span>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {generatedPreview.map((ph, idx) => (
                    <div key={idx} className="bg-surface-low border border-outline-variant rounded-xl p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary uppercase">
                          P{idx + 1}: {ph.title}
                        </span>
                        {ph.date && (
                          <span className="text-[10px] font-mono bg-white px-2 py-0.5 border rounded text-on-surface-variant font-bold">
                            📅 {ph.date}
                          </span>
                        )}
                      </div>
                      <div className="pl-3 space-y-1">
                        {ph.tasks && ph.tasks.map((t, tIdx) => (
                          <div key={tIdx} className="text-xs text-on-surface flex items-center justify-between gap-2">
                            <span>• {t.title}</span>
                            {t.date && <span className="text-[10px] text-on-surface-variant font-mono">{t.date}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-outline-variant">
                  <button
                    type="button"
                    onClick={() => setGeneratedPreview(null)}
                    className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-low border border-outline-variant rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    Einstellungen anpassen
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPhases(generatedPreview);
                      setIsAiConfigOpen(false);
                      setGeneratedPreview(null);
                    }}
                    className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">check</span>
                    Phasen übernehmen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectModal;
