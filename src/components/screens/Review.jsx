import React from 'react';
import { weeklyReport } from '../../data/mockData';

const Review = () => {
  const {
    weekLabel,
    title,
    subtitle,
    dailyStats,
    totalCompletedTasks,
    totalMilestones,
    successRatePct,
    topAchievements
  } = weeklyReport;

  // Calculate SVG strokeDashoffset dynamically based on successRatePct
  // Circumference = 2 * PI * 42 ~= 263.89 ~ 264
  const circumference = 264;
  const strokeDashoffset = Math.round(circumference * (1 - successRatePct / 100));

  return (
    <div className="screen-transition">
      {/* Screen Header */}
      <div className="mb-8 text-left">
        <span className="text-xs text-on-surface-variant mb-1 block mono uppercase">
          {weekLabel}
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>
      </div>

      {/* 12-Column Responsive Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Bar Chart & Summary Stats (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          <div className="p-6 bg-white border border-outline-variant">
            <h3 className="text-xs font-mono text-on-surface-variant mb-6 border-b border-outline-variant pb-2 uppercase">
              ABGESCHLOSSENE AUFGABEN PRO TAG
            </h3>

            {/* 7-Day Vertical Bar Chart Graphic */}
            <div className="h-52 flex items-end justify-between gap-2 sm:gap-3 mb-4 pt-4 px-2 border-b border-outline-variant pb-4">
              {dailyStats.map((stat, idx) => (
                <div key={idx} className="flex flex-col items-center flex-grow gap-2 h-full justify-end">
                  <div
                    className={`w-full transition-all duration-500 ${
                      stat.isWeekend ? 'bg-outline-variant' : 'bg-primary'
                    }`}
                    style={{ height: `${stat.heightPct}%` }}
                  ></div>
                  <span className="text-[10px] sm:text-xs font-mono text-on-surface-variant">
                    {stat.day}
                  </span>
                </div>
              ))}
            </div>

            {/* Summary Stats Cards Grid */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-3 bg-surface-low border border-outline-variant">
                <span className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant block">
                  GESAMT ERLEDIGT
                </span>
                <span className="text-xl sm:text-2xl font-bold">{totalCompletedTasks} Aufgaben</span>
              </div>
              <div className="p-3 bg-surface-low border border-outline-variant">
                <span className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant block">
                  MEILENSTEINE
                </span>
                <span className="text-xl sm:text-2xl font-bold">{totalMilestones} Phasen</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: SVG Radial Output Gauge & Top Achievements (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Top Card: Output & Success Rate Radial Gauge */}
          <div className="p-6 bg-white border border-outline-variant flex flex-col justify-between">
            <h3 className="text-xs font-mono text-on-surface-variant mb-4 border-b border-outline-variant pb-2 uppercase">
              OUTPUT & ERFOLGS-RATE
            </h3>
            <div className="flex items-center justify-center py-6 relative">
              <svg className="w-36 h-36 sm:w-40 sm:h-40" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E5E5" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#1A1A1A"
                  strokeWidth="10"
                  strokeDasharray="264"
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  className="transition-all duration-700 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl sm:text-3xl font-bold">{successRatePct}%</span>
                <span className="text-[10px] mono text-on-surface-variant mt-1">Ziel-Erfüllung</span>
              </div>
            </div>
          </div>

          {/* Bottom Card: Top Achievements Checklist */}
          <div className="p-5 bg-white border border-outline-variant space-y-3 shadow-sm">
            <h4 className="text-xs font-mono font-bold text-primary uppercase border-b border-outline-variant pb-2">
              TOP-ERFOLGE DIESER WOCHE
            </h4>
            <div className="space-y-2 text-xs">
              {topAchievements.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0">
                    ✓
                  </span>
                  <span className="font-medium truncate">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Review;
