import React, { useMemo, useState } from 'react';
import { useGym } from '../../context/GymContext';
import { useToast } from '../../context/ToastContext';
import { bodyChange, bodySeries, makeBodyEntry } from '../../lib/gym';
import { parseIsoDay } from '../../lib/projectProgress';
import { Button, Card, EmptyState, Field, IconButton, Input, PageHeader, SectionHeader, Stat } from '../ds';
import LineChart from '../gym/LineChart';

const fmt = (kg) => `${kg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`;
const shortDate = (iso) => parseIsoDay(iso)?.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }) || iso;
const CHART_POINTS = 30;

/** Körperwerte: Gewicht eintragen, Verlauf als Linie, Liste mit Löschen (Rückgängig). */
const GymBody = () => {
  const { body, addBodyEntry, deleteBodyEntry } = useGym();
  const { showToast } = useToast();
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const series = useMemo(() => bodySeries(body), [body]);
  const change = bodyChange(series);
  const shown = series.slice(-CHART_POINTS);

  const save = (e) => {
    e.preventDefault();
    const entry = makeBodyEntry({ weight, note });
    if (!entry) {
      setError('Gib dein Gewicht in Kilogramm ein, zum Beispiel 81,5.');
      return;
    }
    addBodyEntry(entry);
    setWeight('');
    setNote('');
    setError('');
    showToast({ message: `Körpergewicht eingetragen: ${fmt(entry.weight)}`, icon: 'check_circle' });
  };

  const remove = (entry) => {
    deleteBodyEntry(entry.id);
    showToast({ message: 'Eintrag gelöscht', icon: 'delete', actionLabel: 'Rückgängig', onAction: () => addBodyEntry(entry) });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Körper" description="Dein Körpergewicht im Verlauf." />

      <Card padding="md">
        <form onSubmit={save} className="space-y-3" aria-label="Körpergewicht eintragen">
          <Field label="Gewicht in kg" error={error || undefined}>
            <Input inputMode="decimal" placeholder="z. B. 81,5" value={weight} onChange={(e) => { setWeight(e.target.value); setError(''); }} autoComplete="off" />
          </Field>
          <Field label="Notiz" optional>
            <Input placeholder="z. B. nüchtern am Morgen" value={note} onChange={(e) => setNote(e.target.value)} autoComplete="off" />
          </Field>
          <Button type="submit" leadingIcon="add" fullWidth>Eintragen</Button>
        </form>
      </Card>

      {series.length === 0 ? (
        <EmptyState icon="monitor_weight" title="Noch kein Eintrag" description="Trage dein Gewicht ein, zum Beispiel einmal pro Woche. Dann siehst du hier den Verlauf." />
      ) : (
        <>
          <Card padding="md" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Aktuell" value={fmt(series[series.length - 1].weight)} />
              <Stat
                label="Änderung"
                value={change === null ? '–' : `${change > 0 ? '+' : ''}${change.toLocaleString('de-DE')} kg`}
              />
              <Stat label="Einträge" value={series.length} />
            </div>
            {shown.length < 2 && <p className="text-body text-secondary">Ab dem zweiten Eintrag zeigt sich der Verlauf als Linie.</p>}
            <LineChart
              points={shown.map((p) => ({ key: p.id, label: shortDate(p.date), value: p.weight, valueText: fmt(p.weight) }))}
              formatY={(n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 })}
              ariaLabel={`Körpergewicht: aktuell ${fmt(series[series.length - 1].weight)}${change === null ? '' : `, Änderung ${change} kg`}.`}
            />
          </Card>

          <section className="flex flex-col gap-2" aria-label="Einträge">
            <SectionHeader title="Einträge" count={body.length} />
            <Card padding="none">
              <ul className="divide-y divide-subtle">
                {body.slice(0, 30).map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-2 pl-4 pr-2 sm:pl-5">
                    <span className="w-20 shrink-0 text-caption text-secondary">{shortDate(entry.date)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body-strong tabular-nums text-primary">{fmt(entry.weight)}</span>
                      {entry.note && <span className="block truncate text-caption text-secondary">{entry.note}</span>}
                    </span>
                    <IconButton icon="delete" size="sm" variant="danger-ghost" label={`Eintrag vom ${shortDate(entry.date)} löschen`} onClick={() => remove(entry)} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      )}
    </div>
  );
};

export default GymBody;
