import React, { useState, useRef, useEffect } from 'react';
import { Button, Menu, MenuItem, MenuLabel } from '../ds';

export const AI_MODELS = [
  { id: 'eco', name: 'Eco', category: 'Eco', icon: 'eco' },
  { id: 'gemini-3.6-flash', name: '3.6 Flash', category: 'Flash', icon: 'bolt' },
  { id: 'gemini-3.5-flash', name: '3.5 Flash', category: 'Flash', icon: 'bolt' },
  { id: 'gemini-3-flash', name: '3.0 Flash', category: 'Flash', icon: 'bolt' },
  { id: 'gemini-2.5-flash', name: '2.5 Flash', category: 'Flash', icon: 'bolt' },
  { id: 'gemini-3.5-flash-lite', name: '3.5 Lite', category: 'Lite', icon: 'bolt' },
  { id: 'gemini-3.1-flash-lite', name: '3.1 Lite', category: 'Lite', icon: 'bolt' },
  { id: 'gemini-2.5-flash-lite', name: '2.5 Lite', category: 'Lite', icon: 'bolt' },
];

const ModelSelectorDropdown = ({ activeModel, onSelectModel, showEco = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const availableModels = showEco ? AI_MODELS : AI_MODELS.filter((m) => m.id !== 'eco');
  const selectedModelObj = availableModels.find((m) => m.id === activeModel) || availableModels[0];

  // Schließt bei Klick daneben und mit Esc
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const categories = [
    ...(showEco ? [{ title: 'Eco', models: availableModels.filter((m) => m.category === 'Eco') }] : []),
    { title: 'Flash', models: availableModels.filter((m) => m.category === 'Flash') },
    { title: 'Lite', models: availableModels.filter((m) => m.category === 'Lite') },
  ];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={selectedModelObj.icon || 'bolt'}
        trailingIcon="expand_more"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="KI-Modell auswählen"
      >
        {selectedModelObj.name}
      </Button>

      {isOpen && (
        <Menu label="KI-Modell" className="absolute right-0 top-full z-dropdown mt-1.5 w-52">
          {categories.map((cat, i) => (
            <div key={cat.title}>
              {i > 0 && <div className="my-1" />}
              <MenuLabel>{cat.title}</MenuLabel>
              {cat.models.map((m) => (
                <MenuItem
                  key={m.id}
                  icon={m.icon || 'bolt'}
                  selected={m.id === activeModel}
                  onClick={() => {
                    onSelectModel(m.id);
                    setIsOpen(false);
                  }}
                >
                  {m.name}
                </MenuItem>
              ))}
            </div>
          ))}
        </Menu>
      )}
    </div>
  );
};

export default ModelSelectorDropdown;
