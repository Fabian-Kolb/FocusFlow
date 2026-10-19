import React from 'react';
import { useModalContext } from '../../context/ModalContext';
import { getExam } from '../../lib/hochschule';
import { Badge, Card, Field, Input, SectionHeader } from '../ds';

/** Prüfungstermin eines Fachs mit Countdown. Leeres Datum entfernt den Termin (das Feld verschwindet im Dokument). */
export default function FachExamCard({ project }) {
  const { mutateProject } = useModalContext();
  const exam = getExam(project);

  const setExamDate = (value) => {
    mutateProject(project.id, (p) => {
      const { exam: _old, ...rest } = p;
      return value ? { ...rest, exam: { date: value } } : rest;
    });
  };

  return (
    <Card padding="md" className="space-y-3">
      <SectionHeader
        title="Prüfung"
        action={exam && exam.dayDiff >= 0 ? <Badge tone={exam.tone}>{exam.countdown}</Badge> : exam ? <Badge tone="neutral">Vorbei</Badge> : null}
      />
      <Field label="Prüfungstermin" optional hint={exam ? exam.date.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Mit Termin siehst du auf Home den Countdown.'}>
        <Input type="date" size="sm" value={project.exam?.date || ''} onChange={(e) => setExamDate(e.target.value)} className="max-w-48" />
      </Field>
    </Card>
  );
}
