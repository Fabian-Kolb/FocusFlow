import React, { useState, useEffect } from 'react';
import { Button, Card, Icon } from '../ds';

const GOOGLE_COLORS = [
  { id: "1", bg: "#a4bdfc", name: "Lavender" },
  { id: "2", bg: "#7ae7bf", name: "Sage" },
  { id: "3", bg: "#dbadff", name: "Grape" },
  { id: "4", bg: "#ff887c", name: "Flamingo" },
  { id: "5", bg: "#fbd75b", name: "Banana" },
  { id: "6", bg: "#ffb878", name: "Tangerine" },
  { id: "7", bg: "#46d6db", name: "Peacock" },
  { id: "8", bg: "#e1e1e1", name: "Graphite" },
  { id: "9", bg: "#5484ed", name: "Blueberry" },
  { id: "10", bg: "#51b749", name: "Basil" },
  { id: "11", bg: "#dc2127", name: "Tomato" },
];

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
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onCancel} className="p-2 hover:bg-hover rounded-full transition-colors">
          <Icon name="close" size="lg" className="text-secondary" />
        </button>
        <h2 className="text-title">{initialEvent ? 'Termin bearbeiten' : 'Neuer Termin'}</h2>
        <div className="flex-grow"></div>
        <Button onClick={handleSubmit}>
          Speichern
        </Button>
      </div>

      <div className="max-w-3xl mx-auto space-y-6">
        <Card padding="large" className="space-y-6">
          {/* Titel */}
          <div>
            <input 
              type="text" 
              placeholder="Titel hinzufügen"
              value={title}
              onChange={(e) => { setTitle(e.target.value); if (titleError) setTitleError(''); }}
              aria-invalid={Boolean(titleError)}
              aria-describedby={titleError ? 'event-title-error' : undefined}
              className="w-full text-title-lg bg-transparent border-b-2 border-transparent hover:border-subtle focus:border-strong outline-none py-2 transition-colors placeholder:text-tertiary"
              autoFocus
            />
            {titleError && <p id="event-title-error" role="alert" className="mt-1 text-body text-danger">{titleError}</p>}
          </div>

          {/* Zeitraum */}
          <div className="flex items-start gap-4">
            <Icon name="schedule" size="lg" className="text-secondary mt-2" />
            <div className="flex-grow space-y-4">
              
              <div className="flex flex-wrap items-center gap-3">
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-subtle border border-subtle rounded-md px-3 py-2 outline-none focus:border-strong text-label"
                />
                {!isAllDay && (
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-subtle border border-subtle rounded-md px-3 py-2 outline-none focus:border-strong text-label"
                  />
                )}
                <span className="text-secondary font-medium">bis</span>
                {!isAllDay && (
                  <input 
                    type="time" 
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-subtle border border-subtle rounded-md px-3 py-2 outline-none focus:border-strong text-label"
                  />
                )}
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-subtle border border-subtle rounded-md px-3 py-2 outline-none focus:border-strong text-label"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer w-max">
                <input 
                  type="checkbox" 
                  checked={isAllDay}
                  onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded-xs border-subtle text-primary focus:ring-focus"
                />
                <span className="text-label">Ganztägig</span>
              </label>

            </div>
          </div>
        </Card>

        <Card padding="large" className="space-y-8">
          {/* Farbe */}
          <div className="flex items-start gap-4">
            <Icon name="palette" size="lg" className="text-secondary mt-1.5" />
            <div className="flex-grow">
              <p className="text-body-strong mb-3">Farbe auswählen</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setColorId('')}
                  className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${colorId === '' ? 'border-strong' : 'border-transparent'}`}
                  style={{ backgroundColor: 'var(--primary)' }}
                  title="Standard"
                >
                  {colorId === '' && <Icon name="check" size="sm" className="text-on-accent" />}
                </button>
                {GOOGLE_COLORS.map(color => (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => setColorId(color.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${colorId === color.id ? 'border-strong' : 'border-transparent'}`}
                    style={{ backgroundColor: color.bg }}
                    title={color.name}
                  >
                    {colorId === color.id && <Icon name="check" size="sm" style={{ color: '#000' }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Benachrichtigung / Erinnerung */}
          <div className="flex items-start gap-4">
            <Icon name="notifications" size="lg" className="text-secondary mt-1.5" />
            <div className="flex-grow">
               <p className="text-body-strong mb-3">Erinnerung</p>
               <select 
                 value={reminderMinutes} 
                 onChange={(e) => setReminderMinutes(e.target.value)}
                 className="bg-subtle border border-subtle rounded-md px-4 py-2 outline-none focus:border-strong text-label w-full md:w-auto"
               >
                 <option value="">Standard (Kalender-Einstellung)</option>
                 <option value="5">5 Minuten vorher</option>
                 <option value="10">10 Minuten vorher</option>
                 <option value="15">15 Minuten vorher</option>
                 <option value="30">30 Minuten vorher</option>
                 <option value="60">1 Stunde vorher</option>
                 <option value="1440">1 Tag vorher</option>
               </select>
            </div>
          </div>

          {/* Beschreibung */}
          <div className="flex items-start gap-4">
            <Icon name="notes" size="lg" className="text-secondary mt-2" />
            <div className="flex-grow">
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschreibung hinzufügen"
                rows="6"
                className="w-full bg-subtle border border-subtle rounded-lg p-4 outline-none focus:border-strong text-body resize-y"
              ></textarea>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EventEditForm;
