import React from 'react';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import FioIcon from '../ui/FioIcon';

const Dashboard = ({ setCurrentScreen }) => {
  return (
    <div className="screen-transition">
      <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="text-xs text-on-surface-variant mb-1 block mono uppercase">Fokus-Modus</span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">Guten Morgen, Fabian</h1>
        </div>

        {/* Fio Trigger */}
        <button
          onClick={() => setCurrentScreen('coach')}
          title="Fio öffnen"
          className="w-11 h-11 bg-primary text-white rounded-2xl hover:bg-neutral-800 flex items-center justify-center transition-all shadow-sm p-2.5 cursor-pointer shrink-0"
        >
          <FioIcon className="w-full h-full text-white" color="currentColor" />
        </button>
      </div>

      {/* Haupt-Ergebnis heute (The Main Outcome) */}
      <Card className="border-2 border-primary mb-6 sm:mb-8 shadow-md">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] sm:text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-[16px] sm:text-[18px] flex-shrink-0">stars</span>
            <span className="truncate">HAUPT-ERGEBNIS HEUTE (MUST-WIN)</span>
          </span>
          <Badge>PRIO 1</Badge>
        </div>
        <div className="marquee-wrapper">
          <p className="text-base sm:text-lg font-bold leading-snug marquee-content">
            Marktanalyse für Projekt 'Re-Branding 2024' abschließen
          </p>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Dieses eine konkrete Ergebnis macht deinen heutigen Tag zum vollen Erfolg.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Hauptliste "Heute" */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-outline-variant pb-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <h2 className="text-lg sm:text-xl font-bold">Heute</h2>
              <span title="Optimales Tageslimit für maximale Fokus-Qualität">
                <Badge variant="outline">KAPAZITÄT: 4 / MAX 5 (OPTIMAL)</Badge>
              </span>
            </div>
            <span className="text-xs text-on-surface-variant mono whitespace-nowrap">2/4 Erledigt</span>
          </div>

          <div className="space-y-3">
            {/* Task 1 */}
            <Card interactive padding="small" className="flex items-center gap-3 sm:gap-4">
              <input
                type="checkbox"
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded focus:ring-primary cursor-pointer mt-0.5 flex-shrink-0"
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-on-surface-variant mb-0.5 no-wrap-scroll">
                  <span className="font-bold text-primary">Re-Branding 2024</span>
                  <span>›</span>
                  <span>Phase 1: Vorbereitung</span>
                </div>
                <div className="marquee-wrapper">
                  <span className="text-xs sm:text-sm font-medium block marquee-content">
                    Marktanalyse für Projekt 'Re-Branding' abschließen
                  </span>
                </div>
              </div>
              <span className="text-[11px] sm:text-xs text-on-surface-variant mono whitespace-nowrap flex-shrink-0">
                09:00 Uhr
              </span>
            </Card>

            {/* Task 2 */}
            <Card interactive padding="small" className="flex items-center gap-3 sm:gap-4">
              <input
                type="checkbox"
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded focus:ring-primary cursor-pointer mt-0.5 flex-shrink-0"
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-on-surface-variant mb-0.5 no-wrap-scroll">
                  <span className="font-bold text-primary">Re-Branding 2024</span>
                  <span>›</span>
                  <span>Phase 2: Konzept</span>
                </div>
                <div className="marquee-wrapper">
                  <span className="text-xs sm:text-sm font-medium block marquee-content">
                    Deep Work: UI Design Prototyping
                  </span>
                </div>
              </div>
              <span className="text-[11px] sm:text-xs text-on-surface-variant mono whitespace-nowrap flex-shrink-0">
                11:00 Uhr
              </span>
            </Card>
            
            {/* Completed Task 1 */}
            <Card padding="small" className="flex items-center gap-3 sm:gap-4 opacity-60">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded focus:ring-primary cursor-pointer mt-0.5 flex-shrink-0"
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-on-surface-variant mb-0.5 no-wrap-scroll">
                  <span className="font-bold text-primary">Orga & Routine</span>
                  <span>›</span>
                  <span>Tagesabschluss</span>
                </div>
                <span className="text-xs sm:text-sm font-medium block line-through truncate">
                  E-Mails & Benachrichtigungen sortieren
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-on-surface-variant mono whitespace-nowrap flex-shrink-0">
                08:00 Uhr
              </span>
            </Card>

            {/* Completed Task 2 */}
            <Card padding="small" className="flex items-center gap-3 sm:gap-4 opacity-60">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded focus:ring-primary cursor-pointer mt-0.5 flex-shrink-0"
              />
              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono text-on-surface-variant mb-0.5 no-wrap-scroll">
                  <span className="font-bold text-primary">Teamevent Planung</span>
                  <span>›</span>
                  <span>Phase 1: Abstimmung</span>
                </div>
                <span className="text-xs sm:text-sm font-medium block line-through truncate">
                  Weekly Alignment mit dem Team
                </span>
              </div>
              <span className="text-[11px] sm:text-xs text-on-surface-variant mono whitespace-nowrap flex-shrink-0">
                08:30 Uhr
              </span>
            </Card>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="lg:col-span-4 space-y-6">
          <Card padding="normal" className="bg-surface-low border-transparent">
            <h3 className="text-xs font-mono text-on-surface-variant mb-4 border-b border-outline-variant pb-2 uppercase tracking-wider">
              FOKUS SCORE
            </h3>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold leading-none">84</span>
              <span className="text-xs text-on-surface-variant mb-1 mono">/100</span>
            </div>
            <div className="w-full bg-outline-variant h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '84%' }}></div>
            </div>
          </Card>

          <Card
            interactive
            padding="normal"
            onClick={() => setCurrentScreen('project-detail')}
          >
            <h3 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-2 uppercase tracking-wider">
              NÄCHSTES PROJEKT
            </h3>
            <p className="text-base font-bold mb-1 truncate">Re-Branding 2024</p>
            <p className="text-xs text-on-surface-variant mb-3 truncate">
              Nächste Etappe: Stakeholder Interviews führen
            </p>
            <div className="flex justify-between text-xs mono mb-1.5 font-bold">
              <span>Fortschritt</span>
              <span>45%</span>
            </div>
            <div className="w-full bg-surface-low h-2 border border-outline-variant rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full" style={{ width: '45%' }}></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
