import React, { useState, useEffect } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import DOMPurify from 'dompurify';
import { useConfirm } from '../../context/ConfirmContext';
import { Badge, Button, Card, Chip, Dialog, EmptyState, FOCUS, Icon, IconButton, IconTile, Input, SectionHeader, Sheet, cx } from '../ds';

// Notizen eines Projekts oder einer Erinnerung (Regel 03): Kartenraster, Ansicht/Editor im Sheet,
// Zuordnen (Abschnitt/Aufgabe) als Schritt-für-Schritt-Dialog.
const COLLAPSED_COUNT = 6;

/** Auswahlzeile in den Schritten des Zuordnen-Dialogs */
function PickRow({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cx(
        'flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-label transition-colors duration-fast',
        FOCUS,
        selected ? 'border-accent bg-accent-subtle text-accent' : 'border-default bg-surface text-primary hover:border-strong',
      )}
    >
      <span className="truncate">{children}</span>
      {selected && <Icon name="check" size="md" className="shrink-0" />}
    </button>
  );
}

/** Große Auswahlkachel (erste Schritte des Dialogs) */
function ChoiceTile({ icon, title, text, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex w-full items-start gap-3 rounded-lg border border-default bg-surface p-4 text-left transition-colors duration-fast hover:border-strong hover:bg-hover', FOCUS)}
    >
      <IconTile area="neutral" icon={icon} />
      <span className="min-w-0">
        <span className="block text-body-strong text-primary">{title}</span>
        <span className="mt-0.5 block text-caption text-secondary">{text}</span>
      </span>
    </button>
  );
}

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
  const confirm = useConfirm();
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
  const visibleNotes = showAllNotes ? filteredNotes : filteredNotes.slice(0, COLLAPSED_COUNT);

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

    handleCloseModal();
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Notiz löschen?',
      message: 'Die Notiz wird gelöscht.',
      confirmLabel: 'Löschen',
      destructive: true,
    });
    if (ok) {
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

  const matchingPhases = phases.filter(p => p.title.toLowerCase().includes(searchTerm.toLowerCase()));
  const wizardTitle = !wizardCategory ? 'Notiz zuweisen' : wizardCategory === 'section' ? 'Abschnitt-Optionen' : 'Aufgaben-Optionen';

  const phaseSearch = (
    <Input
      type="search"
      leadingIcon="search"
      placeholder="Abschnitt suchen"
      aria-label="Abschnitt suchen"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  );

  return (
    <div className="relative my-8">
      <SectionHeader
        title="Notizen"
        count={notes.length}
        className="mb-4"
        action={<IconButton icon="add" label="Neue Notiz" variant="secondary" size="sm" onClick={handleAddClick} />}
      />

      {/* Filter */}
      {notes.length > 0 && (
        <div className="no-wrap-scroll -my-1.5 mb-3 flex items-center gap-2 py-1.5">
          <Chip selected={activeFilter === 'all'} count={notes.length} onClick={() => setActiveFilter('all')}>Alle</Chip>
          <Chip selected={activeFilter === 'manual'} count={notes.filter(n => n.source !== 'inbox').length} onClick={() => setActiveFilter('manual')}>
            Eigene Notizen
          </Chip>
          <Chip selected={activeFilter === 'inbox'} leadingIcon="lightbulb" count={notes.filter(n => n.source === 'inbox').length} onClick={() => setActiveFilter('inbox')}>
            Aus Gedanken
          </Chip>
        </div>
      )}

      {filteredNotes.length === 0 ? (
        <EmptyState
          icon="note_add"
          title="Keine Notizen vorhanden"
          description="Halte Wissen, Protokolle oder Links an einer Stelle fest."
          action={<Button leadingIcon="add" onClick={handleAddClick}>Notiz hinzufügen</Button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleNotes.map(note => (
              <Card
                as="button"
                key={note.id}
                variant="filled"
                interactive
                padding="sm"
                className="h-40 gap-2"
                onClick={() => handleOpenNote(note)}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-body-strong text-primary">{note.title}</span>
                  {note.source === 'inbox' && <Badge tone="neutral" size="sm" icon="lightbulb" className="shrink-0">Gedanke</Badge>}
                </span>
                <span className="line-clamp-4 w-full flex-grow whitespace-pre-wrap break-words text-caption text-secondary">
                  {formatPreview(note.content) || <span className="italic text-tertiary">Kein Inhalt</span>}
                </span>
                <span className="text-caption text-tertiary">
                  {new Date(note.updatedAt || note.createdAt).toLocaleDateString('de-DE')}
                </span>
              </Card>
            ))}
          </div>

          {filteredNotes.length > COLLAPSED_COUNT && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" leadingIcon={showAllNotes ? 'expand_less' : 'expand_more'} onClick={() => setShowAllNotes(!showAllNotes)}>
                {showAllNotes ? 'Weniger anzeigen' : `Alle ${filteredNotes.length} Notizen anzeigen`}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Notiz ansehen oder bearbeiten */}
      <Sheet
        open={Boolean(selectedNote)}
        onClose={handleCloseModal}
        width="lg"
        title={isEditing ? (selectedNote?.isNew ? 'Neue Notiz' : 'Notiz bearbeiten') : 'Notiz'}
        headerAction={selectedNote && (
          <>
            {!isEditing && !selectedNote.isNew && (
              <Button variant="secondary" size="sm" leadingIcon={openedFromDrawer ? 'swap_horiz' : 'add'} onClick={() => { setShowAddWizard(true); setWizardCategory(null); setWizardAction(null); }}>
                {openedFromDrawer ? 'Woanders hinzufügen' : 'Zuordnen'}
              </Button>
            )}
            {!isEditing && <IconButton icon="edit" label="Bearbeiten" onClick={() => setIsEditing(true)} />}
            {isEditing && <IconButton icon="delete" label="Löschen" onClick={handleDelete} className="hover:!bg-danger-subtle hover:!text-danger" />}
          </>
        )}
        bodyClassName="custom-quill-container"
        footer={isEditing ? (
          <>
            <Button variant="secondary" onClick={handleCloseModal}>Abbrechen</Button>
            <Button leadingIcon="save" onClick={handleSave}>Speichern</Button>
          </>
        ) : undefined}
      >
        {selectedNote && (isEditing ? (
          <div className="flex h-full flex-col gap-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titel der Notiz"
              aria-label="Titel der Notiz"
              className="w-full border-0 bg-transparent p-0 text-heading text-primary placeholder:text-disabled focus:outline-none focus:ring-0 sm:text-title"
              autoFocus
            />
            <div className="min-h-[300px] flex-grow">
              <ReactQuill
                theme="snow"
                value={editContent}
                onChange={setEditContent}
                modules={modules}
                className="flex h-full flex-col"
                placeholder="Schreibe deine Notiz …"
              />
            </div>
          </div>
        ) : (
          <div>
            <h1 className="mb-6 border-b border-subtle pb-4 text-title text-primary sm:text-title-lg">
              {selectedNote.title}
            </h1>
            <div
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedNote.content || '') }}
              className="quill-content-renderer text-body-lg"
            />
          </div>
        ))}
      </Sheet>

      {/* Zuordnen: Schritt für Schritt */}
      <Dialog
        open={Boolean(selectedNote) && showAddWizard}
        onClose={resetWizard}
        size="md"
        title={wizardTitle}
        footer={wizardAction === 'linkSectionMaterial' ? (
          <Button disabled={!wizardPhaseId} onClick={handleExecuteLinkSectionMaterial}>Material verknüpfen</Button>
        ) : wizardAction === 'createTask' ? (
          <Button disabled={!wizardPhaseId} onClick={handleExecuteCreateTask}>Aufgabe erstellen</Button>
        ) : wizardAction === 'linkTaskMaterial' ? (
          <Button disabled={!wizardTaskId} onClick={handleExecuteLinkTaskMaterial}>Material mit Aufgabe verknüpfen</Button>
        ) : undefined}
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 text-primary">
          {wizardCategory && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon="arrow_back"
              onClick={() => {
                if (wizardAction) setWizardAction(null);
                else setWizardCategory(null);
              }}
            >
              Zurück
            </Button>
          )}

          {!wizardCategory && (
            <div className="space-y-3">
              <p className="text-body text-secondary">Wozu möchtest du diese Notiz hinzufügen?</p>
              <ChoiceTile icon="layers" title="Abschnitt" text="Neuen Abschnitt erstellen oder als Material anheften" onClick={() => setWizardCategory('section')} />
              <ChoiceTile icon="task" title="Aufgabe" text="In neue Aufgabe umwandeln oder an Aufgabe anheften" onClick={() => setWizardCategory('task')} />
            </div>
          )}

          {wizardCategory === 'section' && !wizardAction && (
            <div className="space-y-3">
              <p className="text-body text-secondary">Was möchtest du mit dem Abschnitt tun?</p>
              <ChoiceTile icon="add_circle" title="Neuen Abschnitt mit dieser Notiz erstellen" text="Die Notiz wird als neuer Abschnitt angelegt und umgewandelt" onClick={handleExecuteCreateSection} />
              <ChoiceTile icon="attach_file" title="Material zu bestehendem Abschnitt hinzufügen" text="Verknüpft die Notiz als Material (die Notiz bleibt erhalten)" onClick={() => setWizardAction('linkSectionMaterial')} />
            </div>
          )}

          {wizardCategory === 'task' && !wizardAction && (
            <div className="space-y-3">
              <p className="text-body text-secondary">Was möchtest du mit der Aufgabe tun?</p>
              <ChoiceTile icon="add_task" title="Neue Aufgabe aus Notiz erstellen" text="Erstellt eine Aufgabe in einem Abschnitt (die Notiz wird umgewandelt)" onClick={() => setWizardAction('createTask')} />
              <ChoiceTile icon="attach_file" title="Material zu bestehender Aufgabe hinzufügen" text="Verknüpft die Notiz mit einer Aufgabe (die Notiz bleibt erhalten)" onClick={() => setWizardAction('linkTaskMaterial')} />
            </div>
          )}

          {(wizardAction === 'linkSectionMaterial' || wizardAction === 'createTask') && (
            <div className="space-y-3">
              <p className="text-label">{wizardAction === 'createTask' ? 'Ziel-Abschnitt auswählen' : 'Abschnitt auswählen'}</p>
              {phaseSearch}
              <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                {matchingPhases.map(p => (
                  <PickRow key={p.id} selected={wizardPhaseId === p.id} onClick={() => setWizardPhaseId(p.id)}>{p.title}</PickRow>
                ))}
                {matchingPhases.length === 0 && <p className="p-2 text-center text-caption text-secondary">Kein Abschnitt gefunden.</p>}
              </div>
            </div>
          )}

          {wizardAction === 'linkTaskMaterial' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-label">1. Abschnitt auswählen</p>
                {phaseSearch}
                <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                  {matchingPhases.map(p => (
                    <PickRow key={p.id} selected={wizardPhaseId === p.id} onClick={() => { setWizardPhaseId(p.id); setWizardTaskId(''); }}>{p.title}</PickRow>
                  ))}
                </div>
              </div>

              {wizardPhaseId && (
                <div className="space-y-3">
                  <p className="text-label">2. Aufgabe auswählen</p>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                    {phases.find(p => p.id === wizardPhaseId)?.tasks?.map(t => (
                      <PickRow key={t.id} selected={wizardTaskId === t.id} onClick={() => setWizardTaskId(t.id)}>{t.title}</PickRow>
                    ))}
                    {(phases.find(p => p.id === wizardPhaseId)?.tasks?.length || 0) === 0 && (
                      <p className="p-2 text-center text-caption text-secondary">Keine Aufgaben in diesem Abschnitt.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

export default NotesSection;
