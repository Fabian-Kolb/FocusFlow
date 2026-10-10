import React, { useState, useEffect } from 'react';
import { Button, Card, Checkbox, Icon, IconButton, Input, Select, Textarea, cx, FOCUS } from '../ds';

// Feste Farbpalette von Google Kalender (Daten, keine App-Farben). dark: Häkchen weiß statt schwarz.
const GOOGLE_COLORS = [
{ id: "1", bg: "#a4bdfc", name: "Lavendel" },
{ id: "2", bg: "#7ae7bf", name: "Salbei" },
{ id: "3", bg: "#dbadff", name: "Traube" },
{ id: "4", bg: "#ff887c", name: "Flamingo" },
{ id: "5", bg: "#fbd75b", name: "Banane" },
{ id: "6", bg: "#ffb878", name: "Mandarine" },
{ id: "7", bg: "#46d6db", name: "Pfau" },
{ id: "8", bg: "#e1e1e1", name: "Graphit" },
{ id: "9", bg: "#5484ed", name: "Blaubeere", dark: true },
{ id: "10", bg: "#51b749", name: "Basilikum", dark: true },
{ id: "11", bg: "#dc2127", name: "Tomate", dark: true },
];

const SWATCH = 'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-[border-color] duration-fast';
const ROW_ICON = 'mt-2.5 shrink-0 text-secondary';

const EventEditForm = ({ initialEvent, selectedDateObj, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [colorId, setColorId] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState("");

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.summary || '');
      setDescription(initialEvent.description || '');
      setColorId(initialEvent.colorId || '');

      if (initialEvent.reminders && !initialEvent.reminders.useDefault && initialEvent.reminders.overrides?.length > 0) {
        setReminderMinutes(initialEvent.reminders.overrides[0].minutes.toString());
      } else {
        setReminderMinutes("");
      }

      if (initialEvent.start.date) {
        setIsAllDay(true);
        setStartDate(initialEvent.start.date);

        if (initialEvent.end && initialEvent.end.date) {
          // Google speichert das Enddatum von ganztägigen Events exklusiv (+1 Tag)
          // Für das UI müssen wir es -1 Tag rechnen
          const [y, m, d] = initialEvent.end.date.split('-');
          const ed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
          ed.setDate(ed.getDate() - 1);
          setEndDate(`${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`);
        }
      } else {
        setIsAllDay(false);
        const s = new Date(initialEvent.start.dateTime);
        setStartDate(`${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, '0')}-${String(s.getDate()).padStart(2, '0')}`);
        setStartTime(`${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`);

        if (initialEvent.end && initialEvent.end.dateTime) {
          const e = new Date(initialEvent.end.dateTime);
          setEndDate(`${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`);
          setEndTime(`${String(e.getHours()).padStart(2, '0')}:${String(e.getMinutes()).padStart(2, '0')}`);
        }
      }
    } else {
      // Neuer Termin basierend auf ausgewähltem Datum
      const d = selectedDateObj || new Date();
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setStartDate(dateStr);
      setEndDate(dateStr);

      const now = new Date();
      now.setMinutes(0);
      now.setHours(now.getHours() + 1);
      setStartTime(`${String(now.getHours()).padStart(2, '0')}:00`);
      now.setHours(now.getHours() + 1);
      setEndTime(`${String(now.getHours()).padStart(2, '0')}:00`);
    }
  }, [initialEvent, selectedDateObj]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError('Gib dem Termin einen Titel.');
      return;
    }

    const eventData = {
      title,
      description,
      colorId,
      reminderMinutes,
      allDay: isAllDay
    };

    if (isAllDay) {
      eventData.startDate = startDate;
      // Google API requires end date to be exclusive (+1 day)
      const [y, m, d] = endDate.split('-');
      const ed = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
      ed.setDate(ed.getDate() + 1);
      eventData.endDate = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, '0')}-${String(ed.getDate()).padStart(2, '0')}`;
    } else {
      // Combine date and time into ISO strings
      const startDateTime = new Date(`${startDate}T${startTime}:00`);
      const endDateTime = new Date(`${endDate}T${endTime}:00`);
      eventData.startTime = startDateTime.toISOString();
      eventData.endTime = endDateTime.toISOString();
    }

    onSave(eventData, initialEvent ? initialEvent.id : null);
  };

  return (
    <div className="pb-20">
      <div className="mb-6 flex items-center gap-3">
      <IconButton icon="close" label="Abbrechen" variant="ghost" onClick={onCancel} />
      <h2 className="min-w-0 flex-1 truncate text-title text-primary">{initialEvent?.id ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
      <Button onClick={handleSubmit}>Speichern</Button>
      </div>

      <div className="mx-auto max-w-content space-y-4">
        <Card padding="lg" className="space-y-6">
          {/* Titel */}
          <div>
            <input
            type="text"
            placeholder="Titel hinzufügen"
            aria-label="Titel"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
            aria-invalid={Boolean(titleError)}
            aria-describedby={titleError ? 'event-title-error' : undefined}
            className="w-full rounded-md border-b-2 border-transparent bg-transparent py-2 text-title-lg text-primary outline-none transition-colors duration-fast placeholder:text-tertiary hover:border-subtle focus:border-accent"
            autoFocus
            />
            {titleError && (
            <p id="event-title-error" role="alert" className="mt-1 flex items-center gap-1 text-caption text-danger">
              <Icon name="error" size="sm" />{titleError}
            </p>
            )}
          </div>

          {/* Zeitraum */}
          <div className="flex items-start gap-4">
          <Icon name="schedule" size="lg" className={ROW_ICON} />
          <div className="min-w-0 flex-1 space-y-4">

              <div className="flex flex-wrap items-center gap-2">
              <Input type="date" aria-label="Startdatum" className="!w-44" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              {!isAllDay && (
                <Input type="time" aria-label="Startzeit" className="!w-32" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              )}
              <span className="text-body text-secondary">bis</span>
              {!isAllDay && (
                <Input type="time" aria-label="Endzeit" className="!w-32" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              )}
              <Input type="date" aria-label="Enddatum" className="!w-44" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>

              <Checkbox label="Ganztägig" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} />

            </div>
          </div>
        </Card>

        <Card padding="lg" className="space-y-6">
          {/* Farbe */}
          <div className="flex items-start gap-4">
          <Icon name="palette" size="lg" className="mt-0.5 shrink-0 text-secondary" />
          <div className="min-w-0 flex-1">
          <p className="mb-3 text-label text-primary">Farbe</p>
          <div role="radiogroup" aria-label="Farbe" className="flex flex-wrap gap-2.5">
            <button
              type="button"
              role="radio"
              aria-checked={colorId === ''}
              aria-label="Standard"
              title="Standard"
              onClick={() => setColorId('')}
              className={cx(SWATCH, 'bg-accent', colorId === '' ? 'border-strong' : 'border-transparent', FOCUS)}
            >
              {colorId === '' && <Icon name="check" size="sm" className="text-on-accent" />}
            </button>
            {GOOGLE_COLORS.map(color => (
              <button
                key={color.id}
                type="button"
                role="radio"
                aria-checked={colorId === color.id}
                aria-label={color.name}
                title={color.name}
                onClick={() => setColorId(color.id)}
                className={cx(SWATCH, colorId === color.id ? 'border-strong' : 'border-transparent', FOCUS)}
                style={{ backgroundColor: color.bg }}
              >
                {colorId === color.id && <Icon name="check" size="sm" style={{ color: color.dark ? '#fff' : '#000' }} />}
              </button>
            ))}
          </div>
          </div>
          </div>

          {/* Benachrichtigung / Erinnerung */}
          <div className="flex items-start gap-4">
          <Icon name="notifications" size="lg" className="mt-0.5 shrink-0 text-secondary" />
          <div className="min-w-0 flex-1">
          <label htmlFor="event-reminder" className="mb-3 block text-label text-primary">Erinnerung</label>
          <Select id="event-reminder" className="md:max-w-sm" value={reminderMinutes} onChange={(e) => setReminderMinutes(e.target.value)}>
            <option value="">Standard (Kalender-Einstellung)</option>
            <option value="5">5 Minuten vorher</option>
            <option value="10">10 Minuten vorher</option>
            <option value="15">15 Minuten vorher</option>
            <option value="30">30 Minuten vorher</option>
            <option value="60">1 Stunde vorher</option>
            <option value="1440">1 Tag vorher</option>
          </Select>
          </div>
          </div>

          {/* Beschreibung */}
          <div className="flex items-start gap-4">
            <Icon name="notes" size="lg" className={ROW_ICON} />
            <div className="min-w-0 flex-1">
            <Textarea
              aria-label="Beschreibung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung hinzufügen"
              rows={6}
            />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EventEditForm;
