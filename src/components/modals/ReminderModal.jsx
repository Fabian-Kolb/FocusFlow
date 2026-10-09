import React, { useState, useEffect, useRef } from 'react';
import { RECURRENCE_OPTIONS, getRecurrenceOptionId, toIsoDate } from '../../lib/recurrence';
import { useModalContext } from '../../context/ModalContext';
import { generateReminderStructure } from '../../lib/gemini';
import CategoryChips from '../ui/CategoryChips';
import { readLastCategory, writeLastCategory } from '../../lib/lastCategory';
import { Button, Checkbox, Field, FioMark, Input, Select, Sheet, Textarea } from '../ds';

const ReminderModal = ({ setCurrentScreen }) => {
  const { activeModal, modalPayload, closeModal, addReminder, user, isCalendarConnected, reminderCategories, addReminderCategory } = useModalContext();
  const isOpen = activeModal === 'reminder';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [recurrenceId, setRecurrenceId] = useState('none');
  const [status, setStatus] = useState('GEPLANT');
  const [syncWithCalendar, setSyncWithCalendar] = useState(false);
  const [categoryId, setCategoryId] = useState('allgemein');
  const [keepThought, setKeepThought] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const titleInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(modalPayload.prefillTitle || modalPayload.prefilledTitle || '');
      setDescription(modalPayload.prefillDescription || '');
      setDate(modalPayload.date || '');
      setTime(modalPayload.time || '');
      setRecurrenceId(getRecurrenceOptionId(modalPayload.recurrence) || 'none');
      setStatus(modalPayload.status || 'GEPLANT');
      setSyncWithCalendar(false);
      setKeepThought(false);
      // Vorauswahl: Kategorie aus dem Aufruf (z. B. "+" in einer Kategorie), sonst die zuletzt benutzte
      setCategoryId(
        modalPayload.categoryId && reminderCategories.some((c) => c.id === modalPayload.categoryId)
          ? modalPayload.categoryId
          : readLastCategory('reminder', reminderCategories)
      );

      // Nach dem Öffnen ins Titelfeld springen
      const timer = setTimeout(() => {
        if (titleInputRef.current) {
          titleInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    // Kategorien nur beim Öffnen lesen, sonst überschreibt ein Sync die Auswahl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, modalPayload]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    addReminder({
      title: title.trim(),
      description: description.trim(),
      // Wiederholung ohne Datum beginnt heute
      date: date || (recurrenceId !== 'none' ? toIsoDate(new Date()) : ''),
      time,
      recurrence: RECURRENCE_OPTIONS.find((o) => o.id === recurrenceId)?.value || null,
      status,
      categoryId,
      inboxItemId: modalPayload.inboxItemId,
      keepInboxItem: keepThought,
      syncWithCalendar: Boolean(syncWithCalendar && isCalendarConnected && !user?.isGuest)
    });

    writeLastCategory('reminder', categoryId);
    closeModal();
    if (setCurrentScreen) {
      setCurrentScreen('reminders');
    }
  };

  const isConversion = Boolean(modalPayload.inboxItemId);
  const calendarUnavailable = !isCalendarConnected || user?.isGuest;

  const structureWithFio = async () => {
    const textToStructure = description || title;
    if (!textToStructure.trim()) return;
    setIsGenerating(true);
    const result = await generateReminderStructure(textToStructure);
    if (result) {
      if (result.title) setTitle(result.title);
      if (result.description) setDescription(result.description);
    }
    setIsGenerating(false);
  };

  return (
    <Sheet
      open={isOpen}
      onClose={closeModal}
      width="lg"
      title={isConversion ? 'Gedanke umwandeln' : 'Neue Erinnerung'}
      description={isConversion ? 'Aus deinem Gedanken wird eine Erinnerung.' : 'Halte fest, woran du denken willst.'}
      footer={(
        <>
          <Button variant="secondary" onClick={closeModal}>Abbrechen</Button>
          <Button type="submit" form="reminder-form">Erinnerung hinzufügen</Button>
        </>
      )}
    >
      <form id="reminder-form" onSubmit={handleSubmit} className="space-y-5">
        <Field label="Titel">
          <Input
            ref={titleInputRef}
            data-autofocus
            required
            placeholder="z. B. Zahnarzt anrufen"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Field>

        {/* Kategorie direkt beim Anlegen */}
        <CategoryChips
          categories={reminderCategories}
          value={categoryId}
          onChange={setCategoryId}
          onCreate={addReminderCategory}
        />

        {isConversion && (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-subtle bg-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body text-secondary">
              Fio macht aus deiner Notiz einen klaren Titel und eine Beschreibung.
            </p>
            <Button variant="secondary" size="sm" className="shrink-0" onClick={structureWithFio} loading={isGenerating}>
              {!isGenerating && <FioMark size={16} />}
              {isGenerating ? 'Fio arbeitet …' : 'Mit Fio strukturieren'}
            </Button>
          </div>
        )}

        <Field label="Beschreibung" optional>
          <Textarea
            placeholder="Details, Kontext oder Fließtext"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fällig am" optional>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Uhrzeit" optional>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field
            label="Wiederholen"
            className="sm:col-span-2"
            hint={recurrenceId !== 'none' && !date ? 'Ohne Datum beginnt die Wiederholung heute.' : undefined}
          >
            <Select value={recurrenceId} onChange={(e) => setRecurrenceId(e.target.value)}>
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* Gedanken behalten: z. B. wenn daraus noch etwas Zweites entstehen soll */}
        {isConversion && (
          <Checkbox
            checked={keepThought}
            onChange={(e) => setKeepThought(e.target.checked)}
            label="Gedanken behalten"
            description="Sonst wandert er nach dem Anlegen in den Papierkorb."
          />
        )}

        <Checkbox
          disabled={calendarUnavailable}
          checked={syncWithCalendar}
          onChange={(e) => setSyncWithCalendar(e.target.checked)}
          label="Mit Google Kalender synchronisieren"
          description={
            user?.isGuest
              ? 'Nur für registrierte Accounts verfügbar.'
              : !isCalendarConnected
              ? 'Google Kalender ist noch nicht verknüpft.'
              : undefined
          }
        />
      </form>
    </Sheet>
  );
};

export default ReminderModal;
