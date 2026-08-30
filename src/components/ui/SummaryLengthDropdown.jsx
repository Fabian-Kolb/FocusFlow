import React, { useState, useRef, useEffect } from 'react';

export const SUMMARY_LENGTH_OPTIONS = [
  {
    id: 'compact',
    name: 'Kompakt',
    icon: 'short_text',
  },
  {
    id: 'normal',
    name: 'Präzise',
    icon: 'notes',
  },
  {
    id: 'detailed',
    name: 'Ausführlich',
    icon: 'subject',
  },
];

const SummaryLengthDropdown = ({ value = 'normal', onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = SUMMARY_LENGTH_OPTIONS.find((o) => o.id === value) || SUMMARY_LENGTH_OPTIONS[1];

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 dark:bg-surface-low/95 backdrop-blur-md border border-outline-variant hover:border-primary/40 text-on-surface rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer group ${
          isOpen ? 'ring-2 ring-primary/20 border-primary' : ''
        }`}
        title="Zusammenfassungs-Länge auswählen"
      >
        <span className="material-symbols-outlined text-[15px] text-primary">
          {selectedOption.icon}
        </span>
        <span className="text-xs font-mono font-bold text-primary">
          {selectedOption.name}
        </span>
        <span className={`material-symbols-outlined text-[16px] text-on-surface-variant group-hover:text-primary transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-40 bg-white/95 dark:bg-surface-low/95 backdrop-blur-xl border border-outline-variant/80 rounded-xl shadow-xl z-50 p-1.5 space-y-0.5 animate-scaleIn">
          <div className="px-2 py-0.5 text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
            Länge
          </div>

          <div className="space-y-0.5">
            {SUMMARY_LENGTH_OPTIONS.map((opt) => {
              const isSelected = opt.id === value;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-all cursor-pointer flex items-center justify-between group/item ${
                    isSelected
                      ? 'bg-primary/10 border-primary/30 text-primary font-bold shadow-2xs'
                      : 'bg-transparent border-transparent hover:bg-surface-low text-on-surface hover:text-primary'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`material-symbols-outlined text-[14px] ${isSelected ? 'text-primary' : 'text-on-surface-variant group-hover/item:text-primary'}`}>
                      {opt.icon}
                    </span>
                    <span className="truncate">{opt.name}</span>
                  </div>

                  {isSelected && (
                    <span className="material-symbols-outlined text-[14px] text-primary shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SummaryLengthDropdown;
