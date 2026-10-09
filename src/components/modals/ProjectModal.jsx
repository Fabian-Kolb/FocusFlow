import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { generateProjectStructure, ensureBulletPoints } from '../../lib/gemini';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import CategoryChips from '../ui/CategoryChips';
import { readLastCategory, writeLastCategory } from '../../lib/lastCategory';
import {
  Alert, Badge, Button, Checkbox, Dialog, Field, FioMark, Icon, IconButton, Input, SectionHeader, Select, Sheet, Textarea, cx,
} from '../ds';

const GRANULARITY = [
  { id: 'few', label: 'Kompakt', hint: '2–3 Phasen' },
  { id: 'balanced', label: 'Ausgewogen', hint: '3–5 Phasen' },
  { id: 'detailed', label: 'Detailliert', hint: '5–8 Phasen' },
];

const ProjectModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, addProject, projectCategories, addProjectCategory } = useModalContext();
  const isOpen = activeModal === 'project';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('GEPLANT');
  const [phases, setPhases] = useState([]);
  const [categoryId, setCategoryId] = useState('allgemein');
  const [keepThought, setKeepThought] = useState(false);
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
      setKeepThought(false);
      // Vorauswahl: Kategorie aus dem Aufruf (z. B. "+" in einer Kategorie), sonst die zuletzt benutzte
      setCategoryId(
        modalPayload.categoryId && projectCategories.some((c) => c.id === modalPayload.categoryId)
          ? modalPayload.categoryId
          : readLastCategory('project', projectCategories)
      );

      setIncludeSummaryNote(Boolean(modalPayload.summaryText));
      setIncludeCleanNote(Boolean(modalPayload.cleanText));
      setIncludeRawNote(Boolean(modalPayload.originalText && !modalPayload.cleanText));

      // Initialize with one empty phase if not a conversion, else start empty so AI can fill
      const initialPhase = modalPayload.firstPhase ? [{ title: modalPayload.firstPhase, tasks: [] }] : [];
      setPhases(initialPhase);

      // Nach dem Öffnen ins Titelfeld springen
      const timer = setTimeout(() => {
        if (nameInputRef.current) {
          nameInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    // Kategorien nur beim Öffnen lesen, sonst überschreibt ein Sync die Auswahl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, modalPayload]);

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
      categoryId,
      inboxItemId: modalPayload.inboxItemId,
      keepInboxItem: keepThought
    });

    writeLastCategory('project', categoryId);
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

  const closeAiConfig = () => {
    setIsAiConfigOpen(false);
    setGeneratedPreview(null);
  };

  const generatePhases = async () => {
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
  };

  return (
    <>
      <Sheet
        open={isOpen}
        onClose={closeModal}
        width="lg"
        title={isConversion ? 'Gedanke umwandeln' : 'Neues Projekt'}
        description={isConversion ? 'Aus deinem Gedanken wird ein Projekt.' : 'Gib dem Projekt einen Namen. Phasen und Aufgaben kannst du später ergänzen.'}
        footer={(
          <>
            <Button variant="secondary" onClick={closeModal}>Abbrechen</Button>
            <Button type="submit" form="project-form">Projekt hinzufügen</Button>
          </>
        )}
      >
        <form id="project-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
            <Field label="Titel">
              <Input
                ref={nameInputRef}
                data-autofocus
                required
                placeholder="z. B. Umzug nach Köln"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="GEPLANT">Geplant</option>
                <option value="AKTIV">Aktiv</option>
                <option value="ABGESCHLOSSEN">Erledigt</option>
              </Select>
            </Field>
          </div>

          {/* Kategorie direkt beim Anlegen */}
          <CategoryChips
            categories={projectCategories}
            value={categoryId}
            onChange={setCategoryId}
            onCreate={addProjectCategory}
          />

          {/* Fio-Phasen und Notizen-Auswahl beim Umwandeln eines Gedankens */}
          {isConversion && (
            <>
              <div className="flex flex-col items-start gap-3 rounded-lg border border-subtle bg-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-body text-secondary">
                  Fio erstellt aus deiner Notiz <strong className="text-primary">Phasen und Aufgaben</strong>, auf Wunsch mit Zeitschätzung.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    setGeneratedPreview(null);
                    setIsAiConfigOpen(true);
                  }}
                >
                  <FioMark size={16} />
                  Phasen generieren
                </Button>
              </div>

              <fieldset className="space-y-3 rounded-lg border border-subtle bg-surface p-4">
                <legend className="px-1 text-label text-primary">Notizen aus dem Gedanken übernehmen</legend>
                <p className="text-caption text-secondary">
                  Wähle, welche Notizen im neuen Projekt landen. Sie werden nicht noch einmal zusammengefasst.
                </p>
                <div className="space-y-3">
                  {modalPayload.summaryText && (
                    <Checkbox
                      checked={includeSummaryNote}
                      onChange={(e) => setIncludeSummaryNote(e.target.checked)}
                      label="KI-Zusammenfassung"
                      description="Strukturierte Stichpunkte und Übersichten"
                    />
                  )}
                  {(modalPayload.cleanText || modalPayload.summaryText) && (
                    <Checkbox
                      checked={includeCleanNote}
                      onChange={(e) => setIncludeCleanNote(e.target.checked)}
                      label="Zusammenfassung des Textes"
                      description="Bereinigter Fließtext ohne Füllwörter"
                    />
                  )}
                  {modalPayload.originalText && (
                    <Checkbox
                      checked={includeRawNote}
                      onChange={(e) => setIncludeRawNote(e.target.checked)}
                      label="Roh-Transkription"
                      description="Wortgetreues Original-Diktat"
                    />
                  )}
                </div>
              </fieldset>

              {/* Gedanken behalten: z. B. wenn daraus noch etwas Zweites entstehen soll */}
              <Checkbox
                checked={keepThought}
                onChange={(e) => setKeepThought(e.target.checked)}
                label="Gedanken behalten"
                description="Sonst wandert er nach dem Anlegen in den Papierkorb."
              />
            </>
          )}

          <Field label="Beschreibung" optional>
            <Textarea
              placeholder="Details, Kontext oder Fließtext"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Startdatum" optional>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Deadline" optional>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>

          {/* Phasen und Aufgaben */}
          <div className="space-y-3">
            <SectionHeader
              title="Phasen und Aufgaben"
              action={<Button variant="ghost" size="sm" leadingIcon="add" onClick={handleAddPhase}>Phase hinzufügen</Button>}
            />

            {phases.length === 0 ? (
              <p className="rounded-lg border border-dashed border-default bg-subtle py-6 text-center text-body text-secondary">
                Noch keine Phasen angelegt.
              </p>
            ) : (
              <div className="space-y-3">
                {phases.map((phase, pIdx) => (
                  <div key={pIdx} className="space-y-3 rounded-lg border border-subtle bg-subtle p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral" size="sm">P{pIdx + 1}</Badge>
                        <Input
                          size="sm"
                          placeholder="Name der Phase, z. B. Vorbereitung"
                          aria-label={`Name der Phase ${pIdx + 1}`}
                          value={phase.title || ''}
                          onChange={(e) => handleUpdatePhaseTitle(pIdx, e.target.value)}
                          className="flex-1"
                        />
                        <IconButton
                          icon="delete"
                          label="Phase löschen"
                          size="sm"
                          onClick={() => handleRemovePhase(pIdx)}
                          className="hover:!bg-danger-subtle hover:!text-danger"
                        />
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:pl-10">
                        <Input
                          type="date"
                          size="sm"
                          aria-label="Datum der Phase"
                          value={phase.date || ''}
                          onChange={(e) => handleUpdatePhaseDate(pIdx, e.target.value)}
                          className="sm:w-auto"
                        />
                        <Input
                          size="sm"
                          placeholder="Notiz oder Link zur Phase"
                          aria-label="Notiz zur Phase"
                          value={phase.note || ''}
                          onChange={(e) => handleUpdatePhaseNote(pIdx, e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 border-t border-subtle pt-3 sm:pl-10">
                      {phase.tasks && phase.tasks.map((task, tIdx) => (
                        <div key={tIdx} className="space-y-2 rounded-md border border-subtle bg-surface p-2">
                          <div className="flex items-center gap-2">
                            <Icon name="check_box_outline_blank" size="sm" className="shrink-0 text-tertiary" />
                            <input
                              type="text"
                              placeholder="Aufgabe"
                              aria-label={`Aufgabe ${tIdx + 1}`}
                              value={task.title || ''}
                              onChange={(e) => handleUpdateTaskTitle(pIdx, tIdx, e.target.value)}
                              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-body placeholder:text-tertiary focus:outline-none focus:ring-0"
                            />
                            <IconButton icon="close" label="Aufgabe entfernen" size="sm" onClick={() => handleRemoveTask(pIdx, tIdx)} />
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row sm:pl-6">
                            <Input
                              type="date"
                              size="sm"
                              aria-label="Datum der Aufgabe"
                              value={task.date || ''}
                              onChange={(e) => handleUpdateTaskDate(pIdx, tIdx, e.target.value)}
                              className="sm:w-auto"
                            />
                            <Input
                              size="sm"
                              placeholder="Notiz oder Link"
                              aria-label="Notiz zur Aufgabe"
                              value={task.note || ''}
                              onChange={(e) => handleUpdateTaskNote(pIdx, tIdx, e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      ))}
                      <Button variant="ghost" size="sm" leadingIcon="add" onClick={() => handleAddTask(pIdx)}>
                        Aufgabe hinzufügen
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Sheet>

      {/* Fio-Phasengenerierung: Einstellungen und Vorschau */}
      <Dialog
        open={isOpen && isAiConfigOpen}
        onClose={closeAiConfig}
        size="md"
        title="Fio erstellt Phasen"
        description={generatedPreview ? 'So sieht die vorgeschlagene Struktur aus.' : 'Wähle, wie fein Fio dein Projekt gliedern soll.'}
        footer={!generatedPreview ? (
          <>
            <Button variant="secondary" onClick={closeAiConfig}>Abbrechen</Button>
            <Button onClick={generatePhases} loading={isGenerating}>
              {!isGenerating && <FioMark size={16} />}
              {isGenerating ? 'Fio arbeitet …' : 'Phasen generieren'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" leadingIcon="tune" onClick={() => setGeneratedPreview(null)}>Einstellungen ändern</Button>
            <Button
              leadingIcon="check"
              onClick={() => {
                setPhases(generatedPreview);
                closeAiConfig();
              }}
            >
              Phasen übernehmen
            </Button>
          </>
        )}
      >
        {!generatedPreview ? (
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-label text-primary">Granularität</legend>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Phasen-Granularität">
                {GRANULARITY.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    role="radio"
                    aria-checked={aiGranularity === g.id}
                    onClick={() => setAiGranularity(g.id)}
                    className={cx(
                      'rounded-md border p-2.5 text-left transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                      aiGranularity === g.id ? 'border-accent bg-accent-subtle' : 'border-default bg-surface hover:border-strong',
                    )}
                  >
                    <span className={cx('block text-label-sm', aiGranularity === g.id ? 'text-accent' : 'text-primary')}>{g.label}</span>
                    <span className="block text-caption text-secondary">{g.hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <Checkbox
              checked={aiEstimateDates}
              onChange={(e) => setAiEstimateDates(e.target.checked)}
              label="Termine und Fristen schätzen"
              description={`Fio verteilt die Fälligkeiten gleichmäßig über den Projektzeitraum (${startDate || 'heute'} bis ${endDate || 'offen'}).`}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <Alert tone="success" title="Phasenstruktur erstellt" />
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {generatedPreview.map((ph, idx) => (
                <div key={idx} className="space-y-1.5 rounded-lg border border-subtle bg-subtle p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-strong text-primary">P{idx + 1}: {ph.title}</span>
                    {ph.date && <Badge tone="neutral" size="sm" icon="event">{ph.date}</Badge>}
                  </div>
                  <ul className="space-y-1 pl-1">
                    {ph.tasks && ph.tasks.map((t, tIdx) => (
                      <li key={tIdx} className="flex items-center justify-between gap-2 text-caption text-secondary">
                        <span>{t.title}</span>
                        {t.date && <span className="shrink-0 text-micro text-tertiary">{t.date}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
};

export default ProjectModal;
