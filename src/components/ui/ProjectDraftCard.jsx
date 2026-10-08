import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { draftId, clearNewFlags, countNew } from '../../lib/projectDraft';
import { useSwipeToClose } from '../../hooks/useSwipeToClose';

// Entwurfskarte für "Projektanlegung": Handänderungen und Fio-Prompts arbeiten am selben Entwurf.
// Desktop: Editor direkt in der Karte. Handy: Bottom-Drawer (Regel 07, per Portal wegen Regel 04).
// Reihenfolge ändern: Pfeile oder Ziehen am Griff (Pointer-Events, funktioniert mit Maus und Touch).

const inputCls = 'w-full rounded-lg border border-outline-variant bg-white px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[32px]';
const iconBtn = 'w-6 h-6 flex items-center justify-center rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-low disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors shrink-0';
const dangerBtn = `${iconBtn} hover:!text-red-600 hover:!bg-red-50`;
const icon = 'material-symbols-outlined text-[16px]';

const move = (list, idx, dir) => {
  const to = idx + dir;
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  [next[idx], next[to]] = [next[to], next[idx]];
  return next;
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
      className="w-5 h-7 flex items-center justify-center text-on-surface-variant/60 hover:text-primary cursor-grab active:cursor-grabbing disabled:opacity-30 disabled:cursor-not-allowed shrink-0 select-none"
    >
      <span className="material-symbols-outlined text-[18px]">drag_indicator</span>
    </button>
  );
}

const DropLine = () => <div className="h-0.5 my-0.5 rounded-full bg-primary" aria-hidden="true" />;

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
  const applyMove = (kind, id, target) => {
    if (kind === 'phase') {
      const from = draft.phases.findIndex((p) => p.id === id);
      if (from === -1) return;
      const list = [...draft.phases];
      const [item] = list.splice(from, 1);
      list.splice(target.index > from ? target.index - 1 : target.index, 0, item);
      set({ phases: list });
      return;
    }
    const srcPhase = draft.phases.find((p) => p.tasks.some((t) => t.id === id));
    if (!srcPhase) return;
    const from = srcPhase.tasks.findIndex((t) => t.id === id);
    const task = srcPhase.tasks[from];
    const phases = draft.phases.map((p) => ({ ...p, tasks: [...p.tasks] }));
    phases.find((p) => p.id === srcPhase.id).tasks.splice(from, 1);
    const dest = phases.find((p) => p.id === target.phaseId);
    if (!dest) return;
    const insertAt = target.phaseId === srcPhase.id && target.index > from ? target.index - 1 : target.index;
    dest.tasks.splice(insertAt, 0, task);
    set({ phases });
  };
  const applyMoveRef = useRef(applyMove);
  applyMoveRef.current = applyMove;

  const computeTarget = (kind, y) => {
    const root = rootRef.current;
    if (!root) return null;
    const phaseEls = [...root.querySelectorAll('[data-phase-id]')];
    if (phaseEls.length === 0) return null;
    if (kind === 'phase') {
      const index = phaseEls.filter((el) => {
        const r = el.getBoundingClientRect();
        return y > r.top + r.height / 2;
      }).length;
      return { index };
    }
    const distance = (el) => {
      const r = el.getBoundingClientRect();
      return y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    };
    const phaseEl = phaseEls.reduce((best, el) => (distance(el) < distance(best) ? el : best), phaseEls[0]);
    const rows = [...phaseEl.querySelectorAll('[data-task-id]')];
    const index = rows.filter((el) => {
      const r = el.getBoundingClientRect();
      return y > r.top + r.height / 2;
    }).length;
    return { phaseId: phaseEl.dataset.phaseId, index };
  };

  const startDrag = (e, kind, id) => {
    if (disabled || (e.button !== undefined && e.button !== 0)) return;
    e.preventDefault();
    let target = null;
    let lastY = e.clientY;
    setDrag({ kind, id, target });

    const scroller = getScroller(rootRef.current);
    const update = () => {
      const next = computeTarget(kind, lastY);
      const same = JSON.stringify(next) === JSON.stringify(target);
      if (!same) {
        target = next;
        setDrag({ kind, id, target });
      }
    };
    const onMovePtr = (ev) => {
      lastY = ev.clientY;
      update();
    };
    // Am Rand der Liste automatisch scrollen
    const timer = setInterval(() => {
      if (!scroller) return;
      const r = scroller.getBoundingClientRect();
      if (lastY < r.top + 40) scroller.scrollTop -= 12;
      else if (lastY > r.bottom - 40) scroller.scrollTop += 12;
      else return;
      update();
    }, 16);
    const finish = (commit) => {
      clearInterval(timer);
      window.removeEventListener('pointermove', onMovePtr);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setDrag(null);
      if (commit && target) applyMoveRef.current(kind, id, target);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    window.addEventListener('pointermove', onMovePtr);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  const hl = (isNew) => (isNew ? 'bg-emerald-50 ring-1 ring-emerald-300' : '');
  const dim = (kind, id) => (drag?.kind === kind && drag.id === id ? 'opacity-40' : '');
  const phaseLine = (i) => drag?.kind === 'phase' && drag.target?.index === i;
  const taskLine = (phaseId, i) => drag?.kind === 'task' && drag.target?.phaseId === phaseId && drag.target.index === i;

  const canConfirm = !disabled && draft.title.trim().length > 0;
  const notes = draft.includeNotes || {};
  const noteOptions = [
    { key: 'summary', label: 'KI-Zusammenfassung', available: !!source?.summary },
    { key: 'clean', label: 'Bereinigter Text', available: !!source?.cleanText },
    { key: 'raw', label: 'Roh-Transkription', available: !!source?.originalText },
  ].filter((o) => o.available);

  const actions = (
    <div className={stickyActions ? 'sticky bottom-0 -mx-3 px-3 pt-2 pb-1 bg-white border-t border-outline-variant/60' : 'pt-1'}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="h-10 px-4 rounded-xl bg-neutral-900 text-white text-sm font-bold flex items-center gap-1.5 hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">check</span>
          Projekt anlegen
        </button>
        {versions.length > 1 && (
          <button
            type="button"
            onClick={() => setShowVersions((v) => !v)}
            aria-expanded={showVersions}
            className="h-10 px-3 rounded-xl border border-outline-variant bg-white text-xs font-bold text-primary hover:border-primary flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Versionen ({versions.length})
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="space-y-3">
      <div className="space-y-1.5">
        <input
          aria-label="Projektname"
          className={`${inputCls} font-bold`}
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
          <label className="text-[10px] font-mono uppercase text-on-surface-variant space-y-0.5">
            Start
            <input type="date" className={inputCls} value={draft.startDate} disabled={disabled} onChange={(e) => set({ startDate: e.target.value })} />
          </label>
          <label className="text-[10px] font-mono uppercase text-on-surface-variant space-y-0.5">
            Ende
            <input type="date" className={inputCls} value={draft.endDate} disabled={disabled} onChange={(e) => set({ endDate: e.target.value })} />
          </label>
          <label className="text-[10px] font-mono uppercase text-on-surface-variant space-y-0.5 col-span-2 sm:col-span-1">
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
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-on-surface-variant">
            Abschnitte ({draft.phases.length})
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => set({ phases: [...draft.phases, { id: draftId('dph'), title: '', date: '', tasks: [] }] })}
            className="text-xs font-bold text-primary hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Abschnitt
          </button>
        </div>

        {draft.phases.length === 0 && (
          <p className="text-xs text-on-surface-variant italic">Noch keine Abschnitte. Bitte Fio darum oder füge einen von Hand hinzu.</p>
        )}

        {draft.phases.map((phase, pi) => (
          <React.Fragment key={phase.id}>
            {phaseLine(pi) && <DropLine />}
            <div
              data-phase-id={phase.id}
              className={`rounded-xl border border-outline-variant bg-surface-low/60 p-1.5 space-y-1 transition-colors ${hl(phase.isNew)} ${dim('phase', phase.id)}`}
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
                <button type="button" className={iconBtn} disabled={disabled || pi === 0} aria-label="Abschnitt nach oben" onClick={() => set({ phases: move(draft.phases, pi, -1) })}>
                  <span className={icon}>arrow_upward</span>
                </button>
                <button type="button" className={iconBtn} disabled={disabled || pi === draft.phases.length - 1} aria-label="Abschnitt nach unten" onClick={() => set({ phases: move(draft.phases, pi, 1) })}>
                  <span className={icon}>arrow_downward</span>
                </button>
                <button type="button" className={dangerBtn} disabled={disabled} aria-label="Abschnitt löschen" onClick={() => set({ phases: draft.phases.filter((p) => p.id !== phase.id) })}>
                  <span className={icon}>delete</span>
                </button>
              </div>
              {(openDates[phase.id] || phase.date) && (
                <input type="date" aria-label="Abschnitt-Datum" className={`${inputCls} ml-5 w-[calc(100%-1.25rem)] sm:hidden`} value={phase.date} disabled={disabled} onChange={(e) => setPhase(phase.id, { date: e.target.value })} />
              )}

              <ul className="space-y-0.5 pl-1">
                {phase.tasks.map((task, ti) => (
                  <React.Fragment key={task.id}>
                    {taskLine(phase.id, ti) && <li><DropLine /></li>}
                    <li data-task-id={task.id} className={`rounded-lg p-0.5 transition-colors ${hl(task.isNew)} ${dim('task', task.id)}`}>
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
                        <button type="button" className={iconBtn} disabled={disabled || ti === 0} aria-label="Aufgabe nach oben" onClick={() => setPhase(phase.id, { tasks: move(phase.tasks, ti, -1) })}>
                          <span className={icon}>arrow_upward</span>
                        </button>
                        <button type="button" className={iconBtn} disabled={disabled || ti === phase.tasks.length - 1} aria-label="Aufgabe nach unten" onClick={() => setPhase(phase.id, { tasks: move(phase.tasks, ti, 1) })}>
                          <span className={icon}>arrow_downward</span>
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
                {taskLine(phase.id, phase.tasks.length) && <li><DropLine /></li>}
              </ul>
              <button
                type="button"
                disabled={disabled}
                onClick={() => setPhase(phase.id, { tasks: [...phase.tasks, { id: draftId('dt'), title: '', date: '' }] })}
                className="ml-6 text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer disabled:opacity-40"
              >
                <span className={icon}>add</span>
                Aufgabe
              </button>
            </div>
          </React.Fragment>
        ))}
        {phaseLine(draft.phases.length) && <DropLine />}
      </div>

      {noteOptions.length > 0 && (
        <fieldset className="space-y-1" disabled={disabled}>
          <legend className="text-[11px] font-mono font-bold uppercase tracking-wider text-on-surface-variant mb-1">Als Notizen übernehmen</legend>
          {noteOptions.map((o) => (
            <label key={o.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                checked={!!notes[o.key]}
                onChange={(e) => set({ includeNotes: { ...notes, [o.key]: e.target.checked } })}
              />
              {o.label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-0.5">
            <input
              type="checkbox"
              className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
              checked={!!draft.keepThought}
              onChange={(e) => set({ keepThought: e.target.checked })}
            />
            Gedanken behalten
          </label>
        </fieldset>
      )}

      {showVersions && (
        <ul className="rounded-xl border border-outline-variant divide-y divide-outline-variant/60 bg-white">
          {[...versions].reverse().map((v, i) => (
            <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="min-w-0 truncate">
                <span className="font-bold">{i === 0 ? 'Aktuell' : v.label}</span>
                <span className="text-on-surface-variant font-mono ml-2">
                  {new Date(v.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
              {i !== 0 && (
                <button type="button" className="font-bold text-primary hover:underline cursor-pointer shrink-0" onClick={() => { onRestore(v); setShowVersions(false); }}>
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
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-xs flex items-end" onClick={onClose}>
      <div
        ref={drawerPanelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Projekt-Entwurf"
        style={drawerStyle}
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface rounded-t-3xl w-full max-h-[85vh] shadow-2xl flex flex-col overflow-hidden ${entryAnimActive ? 'drawer-slide-in' : ''}`}
      >
        <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
          <div className="w-12 h-1.5 bg-outline-variant rounded-full" />
        </div>
        <div className="flex items-center justify-between px-3 pb-2 flex-shrink-0">
          <span className="font-bold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">edit_note</span>
            Projekt-Entwurf
            {disabled && <span className="text-[11px] font-mono text-on-surface-variant animate-pulse">Fio arbeitet …</span>}
          </span>
          <button type="button" aria-label="Schließen" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-low cursor-pointer">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
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
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-sm text-emerald-800">
        <span className="material-symbols-outlined text-[20px]">check_circle</span>
        <span className="min-w-0 truncate"><strong>{draft.title}</strong> wurde als Projekt angelegt.</span>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <>
        <div className="rounded-2xl border border-primary/40 bg-white p-3 space-y-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">edit_note</span>
            <span className="font-bold text-sm truncate">{draft.title || 'Entwurf'}</span>
            {disabled && <span className="text-[11px] font-mono text-on-surface-variant animate-pulse">Fio arbeitet …</span>}
          </div>
          <p className="text-xs text-on-surface-variant">{draft.phases.length} Abschnitte · {taskCount} Aufgaben</p>
          <button type="button" onClick={() => setDrawerOpen(true)} className="w-full h-10 rounded-xl bg-neutral-900 text-white text-sm font-bold cursor-pointer">
            Entwurf öffnen
          </button>
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
    <div className="rounded-2xl border border-primary/40 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[20px] text-primary">edit_note</span>
        <span className="font-bold text-sm">Projekt-Entwurf</span>
        {disabled && <span className="text-[11px] font-mono text-on-surface-variant animate-pulse">Fio arbeitet …</span>}
      </div>
      <DraftEditor {...props} />
    </div>
  );
};

export default ProjectDraftCard;
