import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { draftId, clearNewFlags, countNew } from '../../lib/projectDraft';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

import { Button, Icon, IconButton } from '../ds';
// Entwurfskarte für "Projektanlegung": Handänderungen und Fio-Prompts arbeiten am selben Entwurf.
// Desktop: Editor direkt in der Karte. Handy: Bottom-Drawer (Regel 07, per Portal wegen Regel 04).
// Reihenfolge ändern: Ziehen am Griff (Pointer-Events, funktioniert mit Maus und Touch; keine Pfeile, spart Platz am Handy).

const inputCls = 'w-full rounded-md border border-subtle bg-surface px-2 py-1 text-body focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent min-h-8';
const iconBtn = 'w-6 h-6 flex items-center justify-center rounded-md text-secondary hover:text-primary hover:bg-hover disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0';
const dangerBtn = `${iconBtn} hover:!text-red-600 hover:!bg-red-50`;
const icon = 'material-symbols-outlined text-body-lg';

/** Verschiebt einen Abschnitt oder eine Aufgabe. target.index = Position in der Liste OHNE das verschobene Element. */
const moveInDraft = (draft, kind, id, target) => {
  if (kind === 'phase') {
    const from = draft.phases.findIndex((p) => p.id === id);
    if (from === -1) return draft;
    const list = [...draft.phases];
    const [item] = list.splice(from, 1);
    list.splice(Math.min(target.index, list.length), 0, item);
    return { ...draft, phases: list };
  }
  const src = draft.phases.find((p) => p.tasks.some((t) => t.id === id));
  if (!src) return draft;
  const task = src.tasks.find((t) => t.id === id);
  const phases = draft.phases.map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.id !== id) }));
  const dest = phases.find((p) => p.id === target.phaseId);
  if (!dest) return draft;
  dest.tasks.splice(Math.min(target.index, dest.tasks.length), 0, task);
  return { ...draft, phases };
};

const useIsDesktop = () => {
  const query = '(min-width: 640px)';
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
};

function DragHandle({ onStart, label, disabled }) {
  const ref = useRef(null);
  // Im Drawer lauscht useSwipeToClose nativ auf touchstart: Ziehen am Griff darf den Drawer nicht schließen
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const stop = (e) => e.stopPropagation();
    el.addEventListener('touchstart', stop, { passive: true });
    return () => el.removeEventListener('touchstart', stop);
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title="Ziehen zum Verschieben"
      disabled={disabled}
      onPointerDown={onStart}
      style={{ touchAction: 'none' }}
      className="w-5 h-7 flex items-center justify-center text-tertiary hover:text-primary cursor-grab active:cursor-grabbing disabled:opacity-30 disabled:cursor-not-allowed shrink-0 select-none"
    >
      <Icon name="drag_indicator" size="md" />
    </button>
  );
}

const getScroller = (el) => {
  let node = el?.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
};

function DraftEditor({ draft, categories, source, disabled, onChange, onConfirm, versions, onRestore, stickyActions }) {
  const [showVersions, setShowVersions] = useState(false);
  const [openDates, setOpenDates] = useState({});
  const [drag, setDrag] = useState(null); // { kind: 'phase' | 'task', id, target }
  const rootRef = useRef(null);
  const newCount = countNew(draft);

  // Hervorhebung nur kurz zeigen
  useEffect(() => {
    if (newCount === 0) return undefined;
    const t = setTimeout(() => onChange(clearNewFlags(draft)), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const set = (patch) => onChange({ ...draft, ...patch });
  const setPhase = (pid, patch) => set({ phases: draft.phases.map((p) => (p.id === pid ? { ...p, ...patch } : p)) });
  const setTask = (pid, tid, patch) =>
    set({
      phases: draft.phases.map((p) =>
        p.id === pid ? { ...p, tasks: p.tasks.map((t) => (t.id === tid ? { ...t, ...patch } : t)) } : p
      ),
    });

  // --- Ziehen & Ablegen ---
  // Das gezogene Element folgt dem Finger (Transform, direkt am DOM für flüssige 60 fps), die übrigen rutschen per
  // FLIP-Animation zur Seite. Die Vorschau-Reihenfolge lebt nur im lokalen State; erst beim Loslassen wird der Entwurf geändert.
  const dragMeta = useRef(null); // { kind, id, offY, height, lastY, visualDy, raf }
  const lastTarget = useRef(null);
  const prevTops = useRef(new Map());
  const view = drag?.target ? moveInDraft(draft, drag.kind, drag.id, drag.target) : draft;

  const selectorFor = (kind, id) => (kind === 'phase' ? `[data-phase-id="${id}"]` : `[data-task-id="${id}"]`);
  const topRel = (el) => el.getBoundingClientRect().top - (rootRef.current?.getBoundingClientRect().top || 0);
  const currentTranslateY = (el) => {
    const t = getComputedStyle(el).transform;
    if (!t || t === 'none') return 0;
    return new DOMMatrixReadOnly(t).m42;
  };

  const positionDragged = () => {
    const m = dragMeta.current;
    const el = m && rootRef.current?.querySelector(selectorFor(m.kind, m.id));
    if (!el) return;
    el.style.transform = 'none';
    const natural = el.getBoundingClientRect().top;
    m.visualDy = m.lastY - m.offY - natural;
    el.style.transform = `translate3d(0, ${m.visualDy}px, 0) scale(1.02)`;
  };

  const computeTarget = () => {
    const m = dragMeta.current;
    const root = rootRef.current;
    if (!m || !root) return null;
    const center = m.lastY - m.offY + m.height / 2;
    const mid = (el) => {
      const r = el.getBoundingClientRect();
      return r.top + r.height / 2;
    };
    const phaseEls = [...root.querySelectorAll('[data-phase-id]')];
    if (m.kind === 'phase') {
      const others = phaseEls.filter((el) => el.dataset.phaseId !== m.id);
      return { index: others.filter((el) => mid(el) < center).length };
    }
    if (phaseEls.length === 0) return null;
    const distance = (el) => {
      const r = el.getBoundingClientRect();
      return center < r.top ? r.top - center : center > r.bottom ? center - r.bottom : 0;
    };
    const phaseEl = phaseEls.reduce((best, el) => (distance(el) < distance(best) ? el : best), phaseEls[0]);
    const rows = [...phaseEl.querySelectorAll('[data-task-id]')].filter((el) => el.dataset.taskId !== m.id);
    return { phaseId: phaseEl.dataset.phaseId, index: rows.filter((el) => mid(el) < center).length };
  };

  // Nach jedem Render während des Ziehens: Nachbarn sanft an den neuen Platz gleiten lassen, Gezogenes neu positionieren
  useLayoutEffect(() => {
    const root = rootRef.current;
    const m = dragMeta.current;
    if (!root) return;
    const next = new Map();
    if (m) {
      root.querySelectorAll(`[data-flip-kind="${m.kind}"]`).forEach((el) => {
        const id = el.dataset.flip;
        if (id === m.id) return;
        const cur = currentTranslateY(el);
        const layoutTop = topRel(el) - cur;
        next.set(id, layoutTop);
        const prev = prevTops.current.get(id);
        if (prev !== undefined && Math.abs(prev - layoutTop) > 1) {
          el.getAnimations().forEach((a) => a.cancel());
          el.animate(
            [{ transform: `translateY(${cur + prev - layoutTop}px)` }, { transform: 'translateY(0)' }],
            { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
          );
        }
      });
      positionDragged();
    }
    prevTops.current = next;
  });

  const startDrag = (e, kind, id) => {
    if (disabled || dragMeta.current || (e.button !== undefined && e.button !== 0)) return;
    const root = rootRef.current;
    const el = root?.querySelector(selectorFor(kind, id));
    if (!el) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    dragMeta.current = { kind, id, offY: e.clientY - rect.top, height: rect.height, lastY: e.clientY, visualDy: 0 };
    lastTarget.current = null;
    // Erst-Positionen merken, damit der erste Wechsel animiert wird
    prevTops.current = new Map();
    root.querySelectorAll(`[data-flip-kind="${kind}"]`).forEach((n) => {
      if (n.dataset.flip !== id) prevTops.current.set(n.dataset.flip, topRel(n));
    });
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';
    if (navigator.vibrate) navigator.vibrate(8);
    setDrag({ kind, id, target: null });
    positionDragged();

    const scroller = getScroller(root);
    const tick = () => {
      const m = dragMeta.current;
      if (!m) return;
      positionDragged();
      const target = computeTarget();
      if (JSON.stringify(target) !== JSON.stringify(lastTarget.current)) {
        lastTarget.current = target;
        setDrag({ kind, id, target });
      }
    };
    const schedule = tick;
    const onMovePtr = (ev) => {
      if (!dragMeta.current) return;
      dragMeta.current.lastY = ev.clientY;
      schedule();
    };
    // Am Rand der Liste automatisch scrollen
    const timer = setInterval(() => {
      if (!scroller || !dragMeta.current) return;
      const r = scroller.getBoundingClientRect();
      const y = dragMeta.current.lastY;
      if (y < r.top + 48) scroller.scrollTop -= 10;
      else if (y > r.bottom - 48) scroller.scrollTop += 10;
      else return;
      schedule();
    }, 16);

    const finish = (commit) => {
      const m = dragMeta.current;
      if (!m) return;
      clearInterval(timer);
      window.removeEventListener('pointermove', onMovePtr);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      const dy = m.visualDy || 0;
      const node = root.querySelector(selectorFor(kind, id));
      if (node) node.style.transform = '';
      const final = commit && lastTarget.current ? moveInDraft(draft, kind, id, lastTarget.current) : null;
      dragMeta.current = null;
      lastTarget.current = null;
      prevTops.current = new Map();
      setDrag(null);
      if (final) onChange(final);
      // Sanft einrasten: vom Loslass-Punkt zum endgültigen Platz (Knoten kann beim Wechsel des Abschnitts neu entstehen)
      requestAnimationFrame(() => {
        const settled = root.querySelector(selectorFor(kind, id));
        settled?.animate(
          [{ transform: `translateY(${dy}px) scale(1.02)` }, { transform: 'translateY(0) scale(1)' }],
          { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }
        );
      });
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (ev) => ev.key === 'Escape' && finish(false);
    window.addEventListener('pointermove', onMovePtr);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  };

  const hl = (isNew) => (isNew ? 'bg-success-subtle ring-1 ring-focus' : '');
  const lift = (kind, id) =>
    drag?.kind === kind && drag.id === id ? 'relative z-10 !bg-white shadow-lg ring-1 ring-focus cursor-grabbing' : '';

  const canConfirm = !disabled && draft.title.trim().length > 0;
  const notes = draft.includeNotes || {};
  const noteOptions = [
    { key: 'summary', label: 'KI-Zusammenfassung', available: !!source?.summary },
    { key: 'clean', label: 'Bereinigter Text', available: !!source?.cleanText },
    { key: 'raw', label: 'Roh-Transkription', available: !!source?.originalText },
  ].filter((o) => o.available);

  const actions = (
    <div className={stickyActions ? 'sticky bottom-0 -mx-3 px-3 pt-2 pb-1 bg-surface border-t border-subtle' : 'pt-1'}>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={!canConfirm} onClick={onConfirm}>
          <Icon name="check" size="md" />
          Projekt anlegen
        </Button>
        {versions.length > 1 && (
          <Button variant="secondary" onClick={() => setShowVersions((v) => !v)} aria-expanded={showVersions}>
            <Icon name="history" size="md" />
            Versionen ({versions.length})
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="space-y-1.5">
        <input
          aria-label="Projektname"
          className={`${inputCls} font-semibold`}
          value={draft.title}
          disabled={disabled}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Projektname"
        />
        <textarea
          aria-label="Beschreibung"
          className={`${inputCls} resize-none`}
          rows={2}
          value={draft.description}
          disabled={disabled}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Kurzbeschreibung (optional)"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          <label className="font-label text-eyebrow uppercase text-secondary space-y-0.5">
            Start
            <input type="date" className={inputCls} value={draft.startDate} disabled={disabled} onChange={(e) => set({ startDate: e.target.value })} />
          </label>
          <label className="font-label text-eyebrow uppercase text-secondary space-y-0.5">
            Ende
            <input type="date" className={inputCls} value={draft.endDate} disabled={disabled} onChange={(e) => set({ endDate: e.target.value })} />
          </label>
          <label className="font-label text-eyebrow uppercase text-secondary space-y-0.5 col-span-2 sm:col-span-1">
            Kategorie
            <select className={inputCls} value={draft.categoryId} disabled={disabled} onChange={(e) => set({ categoryId: e.target.value })}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-label text-eyebrow font-semibold uppercase text-secondary">
            Abschnitte ({view.phases.length})
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => set({ phases: [...draft.phases, { id: draftId('dph'), title: '', date: '', tasks: [] }] })}
            className="text-caption-strong text-primary hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
          >
            <Icon name="add" size="sm" />
            Abschnitt
          </button>
        </div>

        {view.phases.length === 0 && (
          <p className="text-caption text-secondary italic">Noch keine Abschnitte. Bitte Fio darum oder füge einen von Hand hinzu.</p>
        )}

        {view.phases.map((phase, pi) => (
          <React.Fragment key={phase.id}>
            <div
              data-phase-id={phase.id}
              data-flip={phase.id}
              data-flip-kind="phase"
              className={`rounded-lg border border-subtle bg-subtle p-1.5 space-y-1 transition-colors will-change-transform ${hl(phase.isNew)} ${lift('phase', phase.id)}`}
            >
              <div className="flex items-center gap-0.5">
                <DragHandle label={`Abschnitt ${pi + 1} verschieben`} disabled={disabled} onStart={(e) => startDrag(e, 'phase', phase.id)} />
                <input
                  aria-label={`Abschnitt ${pi + 1}`}
                  className={`${inputCls} font-semibold`}
                  value={phase.title}
                  disabled={disabled}
                  onChange={(e) => setPhase(phase.id, { title: e.target.value })}
                  placeholder="Abschnittsname"
                />
                <input type="date" aria-label="Abschnitt-Datum" className={`${inputCls} w-[8.5rem] shrink-0 hidden sm:block`} value={phase.date} disabled={disabled} onChange={(e) => setPhase(phase.id, { date: e.target.value })} />
                <button type="button" className={`${iconBtn} sm:hidden`} aria-label="Abschnitt-Datum" title="Datum" disabled={disabled} onClick={() => setOpenDates((o) => ({ ...o, [phase.id]: !o[phase.id] }))}>
                  <span className={icon}>calendar_today</span>
                </button>
                <button type="button" className={dangerBtn} disabled={disabled} aria-label="Abschnitt löschen" onClick={() => set({ phases: draft.phases.filter((p) => p.id !== phase.id) })}>
                  <span className={icon}>delete</span>
                </button>
              </div>
              {(openDates[phase.id] || phase.date) && (
                <input type="date" aria-label="Abschnitt-Datum" className={`${inputCls} ml-5 w-[calc(100%-1.25rem)] sm:hidden`} value={phase.date} disabled={disabled} onChange={(e) => setPhase(phase.id, { date: e.target.value })} />
              )}

              <ul className="space-y-0.5 pl-1">
                {phase.tasks.map((task) => (
                  <React.Fragment key={task.id}>
                    <li data-task-id={task.id} data-flip={task.id} data-flip-kind="task" className={`rounded-md p-0.5 transition-colors will-change-transform ${hl(task.isNew)} ${lift('task', task.id)}`}>
                      <div className="flex items-center gap-0.5">
                        <DragHandle label="Aufgabe verschieben" disabled={disabled} onStart={(e) => startDrag(e, 'task', task.id)} />
                        <input
                          aria-label="Aufgabe"
                          className={inputCls}
                          value={task.title}
                          disabled={disabled}
                          onChange={(e) => setTask(phase.id, task.id, { title: e.target.value })}
                          placeholder="Aufgabe"
                        />
                        <input type="date" aria-label="Aufgaben-Datum" className={`${inputCls} w-[8.5rem] shrink-0 hidden sm:block`} value={task.date} disabled={disabled} onChange={(e) => setTask(phase.id, task.id, { date: e.target.value })} />
                        <button type="button" className={`${iconBtn} sm:hidden`} aria-label="Aufgaben-Datum" title="Datum" disabled={disabled} onClick={() => setOpenDates((o) => ({ ...o, [task.id]: !o[task.id] }))}>
                          <span className={icon}>calendar_today</span>
                        </button>
                        <button type="button" className={dangerBtn} disabled={disabled} aria-label="Aufgabe löschen" onClick={() => setPhase(phase.id, { tasks: phase.tasks.filter((t) => t.id !== task.id) })}>
                          <span className={icon}>close</span>
                        </button>
                      </div>
                      {(openDates[task.id] || task.date) && (
                        <input type="date" aria-label="Aufgaben-Datum" className={`${inputCls} ml-5 mt-0.5 w-[calc(100%-1.25rem)] sm:hidden`} value={task.date} disabled={disabled} onChange={(e) => setTask(phase.id, task.id, { date: e.target.value })} />
                      )}
                    </li>
                  </React.Fragment>
                ))}
              </ul>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPhase(phase.id, { tasks: [...phase.tasks, { id: draftId('dt'), title: '', date: '' }] })}
                className="ml-6 text-caption-strong text-primary hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
              >
                <span className={icon}>add</span>
                Aufgabe
              </button>
            </div>
          </React.Fragment>
        ))}
      </div>

      {noteOptions.length > 0 && (
        <fieldset className="space-y-1" disabled={disabled}>
          <legend className="font-label text-eyebrow font-semibold uppercase text-secondary mb-1">Als Notizen übernehmen</legend>
          {noteOptions.map((o) => (
            <label key={o.key} className="flex items-center gap-2 text-body cursor-pointer">
              <input
                type="checkbox"
                className="rounded-xs border-subtle text-primary focus:ring-focus h-4 w-4"
                checked={!!notes[o.key]}
                onChange={(e) => set({ includeNotes: { ...notes, [o.key]: e.target.checked } })}
              />
              {o.label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-body cursor-pointer pt-0.5">
            <input
              type="checkbox"
              className="rounded-xs border-subtle text-primary focus:ring-focus h-4 w-4"
              checked={!!draft.keepThought}
              onChange={(e) => set({ keepThought: e.target.checked })}
            />
            Gedanken behalten
          </label>
        </fieldset>
      )}

      {showVersions && (
        <ul className="rounded-lg border border-subtle divide-y divide-subtle bg-surface">
          {[...versions].reverse().map((v, i) => (
            <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-caption">
              <span className="min-w-0 truncate">
                <span className="font-semibold">{i === 0 ? 'Aktuell' : v.label}</span>
                <span className="text-secondary font-label ml-2">
                  {new Date(v.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              {i !== 0 && (
                <button type="button" className="font-semibold text-primary hover:underline cursor-pointer shrink-0" onClick={() => { onRestore(v); setShowVersions(false); }}>
                  Wiederherstellen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {actions}
    </div>
  );
}

// Handy: Bottom-Drawer nach Regel 07 (Griff, max-h-[85vh], scrollbarer Body, Swipe zum Schließen)
function DraftDrawer({ onClose, disabled, children }) {
  const drawerPanelRef = useRef(null);
  const scrollBodyRef = useRef(null);
  const { drawerStyle, entryAnimActive } = useSwipeToClose({
    isOpen: true,
    onClose,
    drawerRef: drawerPanelRef,
    scrollContainerRef: scrollBodyRef,
    threshold: 120,
  });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-palette bg-scrim flex items-end" onClick={onClose}>
      <div
        ref={drawerPanelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Projekt-Entwurf"
        style={drawerStyle}
        onClick={(e) => e.stopPropagation()}
        className={`bg-canvas rounded-t-xl w-full max-h-[85vh] shadow-lg flex flex-col overflow-hidden ${entryAnimActive ? 'drawer-slide-in' : ''}`}
      >
        <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
          <div className="h-1 w-9 rounded-full bg-control" />
        </div>
        <div className="flex items-center justify-between px-3 pb-2 flex-shrink-0">
          <span className="text-body-strong flex items-center gap-2">
            <Icon name="edit_note" size="md" className="text-primary" />
            Projekt-Entwurf
            {disabled && <span className="text-micro font-label text-secondary animate-pulse">Fio arbeitet …</span>}
          </span>
          <IconButton icon="close" label="Schließen" size="sm" onClick={onClose} />
        </div>
        <div ref={scrollBodyRef} className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

const ProjectDraftCard = (props) => {
  const { draft, status, disabled } = props;
  const isDesktop = useIsDesktop();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const confirmed = status === 'confirmed';
  const taskCount = draft.phases.reduce((n, p) => n + p.tasks.length, 0);

  if (confirmed) {
    return (
      <div className="rounded-lg border border-success bg-success-subtle p-3 flex items-center gap-2 text-body text-success">
        <Icon name="check_circle" size="md" />
        <span className="min-w-0 truncate"><strong>{draft.title}</strong> wurde als Projekt angelegt.</span>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <>
        <div className="rounded-lg border border-control bg-surface p-3 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="edit_note" size="md" className="text-primary" />
            <span className="text-body-strong truncate">{draft.title || 'Entwurf'}</span>
            {disabled && <span className="text-micro font-label text-secondary animate-pulse">Fio arbeitet …</span>}
          </div>
          <p className="text-caption text-secondary">{draft.phases.length} Abschnitte · {taskCount} Aufgaben</p>
          <Button fullWidth onClick={() => setDrawerOpen(true)}>
            Entwurf öffnen
          </Button>
        </div>
        {drawerOpen && (
          <DraftDrawer onClose={() => setDrawerOpen(false)} disabled={disabled}>
            <DraftEditor
              {...props}
              stickyActions
              onConfirm={() => {
                setDrawerOpen(false);
                props.onConfirm();
              }}
            />
          </DraftDrawer>
        )}
      </>
    );
  }

  return (
    <div className="rounded-lg border border-control bg-surface p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="edit_note" size="md" className="text-primary" />
        <span className="text-body-strong">Projekt-Entwurf</span>
        {disabled && <span className="text-micro font-label text-secondary animate-pulse">Fio arbeitet …</span>}
      </div>
      <DraftEditor {...props} />
    </div>
  );
};

export default ProjectDraftCard;
