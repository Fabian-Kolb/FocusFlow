import React from 'react';

const Dashboard = ({ setCurrentScreen }) => {
  return (
    <div className="screen-transition">
      <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-outline-variant pb-6">
        <div>
          <span className="text-xs text-on-surface-variant mb-1 block mono uppercase">Fokus-Modus</span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">Guten Morgen, Fabian</h1>
        </div>

        {/* KI-Coach Trigger */}
        <div
          className="p-3 bg-white border border-primary flex items-center gap-3 hover:border-black transition-all cursor-pointer shadow-sm group w-full md:w-auto"
          onClick={() => setCurrentScreen('coach')}
        >
          <div className="w-9 h-9 bg-primary text-on-primary flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-mono font-bold block text-primary uppercase whitespace-nowrap">
              ANFANGSHILFE (KI COACH)
            </span>
            <div className="marquee-wrapper">
              <p className="text-xs text-on-surface-variant group-hover:text-primary transition-colors marquee-content">
                Blockade beim Start? Coach nach dem ersten Schritt fragen →
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Haupt-Ergebnis heute (The Main Outcome) */}
      <div className="p-3.5 sm:p-6 bg-white border-2 border-primary mb-6 sm:mb-8 shadow-sm">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-[11px] sm:text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center gap-1.5 truncate">
            <span className="material-symbols-outlined text-[16px] sm:text-[18px] flex-shrink-0">stars</span>
            <span className="truncate">HAUPT-ERGEBNIS HEUTE (MUST-WIN)</span>
          </span>
          <span className="text-[10px] sm:text-xs mono px-2 py-0.5 bg-surface-low border border-outline-variant font-bold whitespace-nowrap flex-shrink-0">
            PRIO 1
          </span>
        </div>
        <div className="marquee-wrapper">
          <p className="text-base sm:text-lg font-bold leading-snug marquee-content">
            Marktanalyse für Projekt 'Re-Branding 2024' abschließen
          </p>
        </div>
        <p className="text-xs text-on-surface-variant mt-1">
          Dieses eine konkrete Ergebnis macht deinen heutigen Tag zum vollen Erfolg.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Hauptliste "Heute" */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between gap-2 border-b border-primary pb-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
              <h2 className="text-lg sm:text-xl font-bold">Heute</h2>
              <span
                className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 bg-surface-low border border-outline-variant text-primary font-medium whitespace-nowrap"
                title="Optimales Tageslimit für maximale Fokus-Qualität"
              >
                KAPAZITÄT: 4 / MAX 5 (OPTIMAL)
              </span>
            </div>
            <span className="text-xs text-on-surface-variant mono whitespace-nowrap">2/4 Erledigt</span>
          </div>

          <div className="space-y-2">
            {/* Task 1 */}
            <div className="p-3 sm:p-4 bg-white border border-outline-variant flex items-center gap-3 sm:gap-4 group hover:border-primary transition-all">
              <input
                type="checkbox"
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded-none focus:ring-0 cursor-pointer mt-0.5 flex-shrink-0"
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
            </div>

            {/* Task 2 */}
            <div className="p-3 sm:p-4 bg-white border border-outline-variant flex items-center gap-3 sm:gap-4 group hover:border-primary transition-all">
              <input
                type="checkbox"
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded-none focus:ring-0 cursor-pointer mt-0.5 flex-shrink-0"
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
            </div>
            
            {/* Completed Task 1 */}
            <div className="p-3 sm:p-4 bg-white border border-outline-variant flex items-center gap-3 sm:gap-4 group opacity-60">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded-none focus:ring-0 cursor-pointer mt-0.5 flex-shrink-0"
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
            </div>

            {/* Completed Task 2 */}
            <div className="p-3 sm:p-4 bg-white border border-outline-variant flex items-center gap-3 sm:gap-4 group opacity-60">
              <input
                type="checkbox"
                defaultChecked
                className="w-5 h-5 border-2 border-outline-variant text-primary rounded-none focus:ring-0 cursor-pointer mt-0.5 flex-shrink-0"
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
            </div>
          </div>
        </div>

        {/* Sidebar Widgets */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-4 sm:p-6 bg-surface-low border border-outline-variant">
            <h3 className="text-xs font-mono text-on-surface-variant mb-4 border-b border-outline-variant pb-2 uppercase">
              FOKUS SCORE
            </h3>
            <div className="flex items-end gap-2 mb-3">
              <span className="text-4xl font-bold leading-none">84</span>
              <span className="text-xs text-on-surface-variant mb-1 mono">/100</span>
            </div>
            <div className="w-full bg-outline-variant h-1.5">
              <div className="bg-primary h-full" style={{ width: '84%' }}></div>
            </div>
          </div>

          <div
            className="p-4 sm:p-6 bg-white border border-outline-variant hover:border-primary transition-all cursor-pointer"
            onClick={() => setCurrentScreen('project-detail')}
          >
            <h3 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-2 uppercase">
              NÄCHSTES PROJEKT
            </h3>
            <p className="text-base font-bold mb-1 truncate">Re-Branding 2024</p>
            <p className="text-xs text-on-surface-variant mb-3 truncate">
              Nächste Etappe: Stakeholder Interviews führen
            </p>
            <div className="flex justify-between text-xs mono mb-1">
              <span>Fortschritt</span>
              <span>45%</span>
            </div>
            <div className="w-full bg-surface-low h-1.5 border border-outline-variant">
              <div className="bg-primary h-full" style={{ width: '45%' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
