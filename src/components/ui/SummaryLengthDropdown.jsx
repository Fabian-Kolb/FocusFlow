import React, { useState, useRef, useEffect } from 'react';
import { Button, Menu, MenuItem, MenuLabel } from '../ds';

export const SUMMARY_LENGTH_OPTIONS = [
  { id: 'compact', name: 'Kompakt', icon: 'short_text' },
  { id: 'normal', name: 'Präzise', icon: 'notes' },
  { id: 'detailed', name: 'Ausführlich', icon: 'subject' },
];

const SummaryLengthDropdown = ({ value = 'normal', onChange, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedOption = SUMMARY_LENGTH_OPTIONS.find((o) => o.id === value) || SUMMARY_LENGTH_OPTIONS[1];

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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        leadingIcon={selectedOption.icon}
        trailingIcon="expand_more"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Länge der Zusammenfassung auswählen"
      >
        {selectedOption.name}
      </Button>

      {isOpen && (
        <Menu label="Länge der Zusammenfassung" className="absolute left-0 top-full z-dropdown mt-1.5 w-48">
          <MenuLabel>Länge</MenuLabel>
          {SUMMARY_LENGTH_OPTIONS.map((opt) => (
            <MenuItem
              key={opt.id}
              icon={opt.icon}
              selected={opt.id === value}
              onClick={() => {
                onChange(opt.id);
                setIsOpen(false);
              }}
            >
              {opt.name}
            </MenuItem>
          ))}
        </Menu>
      )}
    </div>
  );
};

export default SummaryLengthDropdown;
