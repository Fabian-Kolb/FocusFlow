import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';

const Inbox = ({ setCurrentScreen }) => {
  const { inboxItems, addInboxItem, deleteInboxItem, openModal } = useModalContext();
  const [inputValue, setInputValue] = useState('');

  const handleAdd = () => {
    if (!inputValue.trim()) return;
    addInboxItem(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const handleConvertToProject = (item) => {
    openModal('project', { inboxItemId: item.id, prefillTitle: item.title });
  };

  return (
    <div className="screen-transition">
      <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8">
        <div className="p-3.5 sm:p-6 bg-white border border-primary">
          <label className="text-xs font-mono block mb-3 uppercase tracking-wider text-on-surface-variant">
            WAS GEHT DIR DURCH DEN KOPF?
          </label>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-grow flex items-center gap-2">
              <input
                type="text"
                className="w-full border border-outline-variant px-3 sm:px-4 py-2.5 sm:py-3 text-sm focus:border-primary focus:ring-0 outline-none"
                placeholder="Neuer Gedanke, Aufgabe oder Notiz..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="px-3 py-2.5 sm:py-3 border border-outline-variant bg-surface-low text-primary hover:border-primary transition-colors flex items-center justify-center flex-shrink-0"
                title="Spracheingabe starten"
              >
                <span className="material-symbols-outlined text-[20px]">mic</span>
              </button>
            </div>
            <button
              className="w-full sm:w-auto px-5 py-2.5 sm:py-3 bg-primary text-on-primary text-sm font-medium hover:bg-neutral-800 transition-colors whitespace-nowrap flex-shrink-0"
              onClick={handleAdd}
            >
              Hinzufügen
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-1 uppercase">
            HEUTE
          </h2>
          <div className="space-y-2">
            {inboxItems.today.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3.5 sm:p-4 border border-outline-variant flex items-center justify-between gap-3 group hover:border-primary transition-all"
              >
                <span className="text-xs sm:text-sm">{item.title}</span>
                <div className="relative flex-shrink-0 group/dropdown">
                  <button className="p-1 hover:bg-surface-low transition-colors">
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                  <div className="hidden group-hover/dropdown:block absolute right-0 top-full mt-1 bg-white border border-primary z-20 w-48 shadow-lg">
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-low text-xs font-medium"
                      onClick={() => handleConvertToProject(item)}
                    >
                      Zu Projekt umwandeln
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-low text-xs font-medium text-red-600"
                      onClick={() => deleteInboxItem(item.id)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-mono text-on-surface-variant mb-3 border-b border-outline-variant pb-1 uppercase">
            GESTERN
          </h2>
          <div className="space-y-2">
            {inboxItems.yesterday.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3.5 sm:p-4 border border-outline-variant flex items-center justify-between gap-3 group opacity-75"
              >
                <span className="text-xs sm:text-sm text-on-surface-variant">{item.title}</span>
                <div className="relative flex-shrink-0 group/dropdown">
                  <button className="p-1 hover:bg-surface-low transition-colors">
                    <span className="material-symbols-outlined text-[20px]">more_vert</span>
                  </button>
                  <div className="hidden group-hover/dropdown:block absolute right-0 top-full mt-1 bg-white border border-primary z-20 w-48 shadow-lg">
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-low text-xs font-medium"
                      onClick={() => handleConvertToProject(item)}
                    >
                      Zu Projekt umwandeln
                    </button>
                    <button
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-low text-xs font-medium text-red-600"
                      onClick={() => deleteInboxItem(item.id)}
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inbox;
