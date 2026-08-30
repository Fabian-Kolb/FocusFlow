import React, { useState, useRef, useEffect } from 'react';

export const AI_MODELS = [
  {
    id: 'eco',
    name: 'Eco',
    category: 'Eco',
    icon: 'eco',
  },
  {
    id: 'gemini-3.6-flash',
    name: '3.6 Flash',
    category: 'Flash',
    icon: 'bolt',
  },
  {
    id: 'gemini-3.5-flash',
    name: '3.5 Flash',
    category: 'Flash',
    icon: 'bolt',
  },
  {
    id: 'gemini-3-flash',
    name: '3.0 Flash',
    category: 'Flash',
    icon: 'bolt',
  },
  {
    id: 'gemini-2.5-flash',
    name: '2.5 Flash',
    category: 'Flash',
    icon: 'bolt',
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: '3.5 Lite',
    category: 'Lite',
    icon: 'bolt',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: '3.1 Lite',
    category: 'Lite',
    icon: 'bolt',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: '2.5 Lite',
    category: 'Lite',
    icon: 'bolt',
  },
];

const ModelSelectorDropdown = ({ activeModel, onSelectModel, showEco = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const availableModels = showEco ? AI_MODELS : AI_MODELS.filter((m) => m.id !== 'eco');
  const selectedModelObj = availableModels.find((m) => m.id === activeModel) || availableModels[0];

  // Close dropdown on outside click or Escape
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

  const categories = [
    ...(showEco ? [{
      title: 'Eco',
      models: availableModels.filter((m) => m.category === 'Eco'),
    }] : []),
    {
      title: 'Flash',
      models: availableModels.filter((m) => m.category === 'Flash'),
    },
    {
      title: 'Lite',
      models: availableModels.filter((m) => m.category === 'Lite'),
    },
  ];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Button (Minimalist Pill) */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 dark:bg-surface-low/95 backdrop-blur-md border border-outline-variant hover:border-primary/40 text-on-surface rounded-lg shadow-2xs hover:shadow-xs transition-all cursor-pointer group ${
          isOpen ? 'ring-2 ring-primary/20 border-primary' : ''
        }`}
        title="KI-Modell auswählen"
      >
        <span className="material-symbols-outlined text-[15px] text-primary">
          {selectedModelObj.icon || 'bolt'}
        </span>
        <span className="text-xs font-mono font-bold text-primary">
          {selectedModelObj.name}
        </span>
        <span className={`material-symbols-outlined text-[16px] text-on-surface-variant group-hover:text-primary transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
          expand_more
        </span>
      </button>

      {/* Minimalist Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white/95 dark:bg-surface-low/95 backdrop-blur-xl border border-outline-variant/80 rounded-xl shadow-xl z-50 p-1.5 space-y-1.5 animate-scaleIn">
          {categories.map((cat, catIdx) => (
            <div key={catIdx} className="space-y-0.5">
              <div className="px-2 py-0.5 text-[10px] font-mono font-bold text-on-surface-variant/70 uppercase tracking-wider">
                {cat.title}
              </div>

              <div className="space-y-0.5">
                {cat.models.map((m) => {
                  const isSelected = m.id === activeModel;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectModel(m.id);
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
                          {m.icon || 'bolt'}
                        </span>
                        <span className="truncate">{m.name}</span>
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ModelSelectorDropdown;
