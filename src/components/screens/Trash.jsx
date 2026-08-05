import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import Card from '../ui/Card';
import Input from '../ui/Input';

const Trash = ({ setCurrentScreen }) => {
  const { 
    trashItems, 
    restoreItem, 
    permanentlyDeleteItem,
    setSelectedProjectId,
    setSelectedReminderId
  } = useModalContext();

  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = trashItems.filter(item => 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.summary?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemClick = (item) => {
    if (item._type === 'project') {
      setSelectedProjectId(item.id);
      setCurrentScreen('project-detail');
    } else if (item._type === 'reminder') {
      setSelectedReminderId(item.id);
      setCurrentScreen('reminder-detail');
    }
    // Inbox items don't have a detail screen yet
  };

  const getTypeInfo = (type) => {
    switch (type) {
      case 'project': return { icon: 'folder', label: 'Projekt', color: 'text-blue-600', bg: 'bg-blue-100' };
      case 'reminder': return { icon: 'notifications', label: 'Erinnerung', color: 'text-amber-600', bg: 'bg-amber-100' };
      case 'inbox': return { icon: 'inbox', label: 'Inbox', color: 'text-emerald-600', bg: 'bg-emerald-100' };
      default: return { icon: 'description', label: 'Eintrag', color: 'text-gray-600', bg: 'bg-gray-100' };
    }
  };

  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  return (
    <div className="screen-transition">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Papierkorb</h1>
          <p className="text-sm text-on-surface-variant">Elemente werden nach 30 Tagen endgültig gelöscht.</p>
        </div>
        <div className="relative flex-grow max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
            search
          </span>
          <Input
            type="text"
            className="pl-10"
            placeholder="Papierkorb durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-outline-variant rounded-2xl bg-surface-low/30">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 opacity-50">delete</span>
          <h3 className="text-lg font-bold text-on-surface mb-1">Papierkorb ist leer</h3>
          <p className="text-sm text-on-surface-variant max-w-sm">Gelöschte Projekte, Erinnerungen und Inbox-Elemente erscheinen hier für 30 Tage.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredItems.map((item) => {
            const typeInfo = getTypeInfo(item._type);
            const daysRemaining = getDaysRemaining(item.deletedAt);
            const isCritical = daysRemaining <= 3;
            
            return (
              <Card
                key={item.id}
                interactive={item._type !== 'inbox'}
                className="flex flex-col justify-between transition-all opacity-80 hover:opacity-100"
                onClick={() => handleItemClick(item)}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${typeInfo.bg} ${typeInfo.color}`}>
                      <span className="material-symbols-outlined text-[12px]">{typeInfo.icon}</span>
                      {typeInfo.label}
                    </div>
                    
                    <div className={`flex items-center gap-1 text-xs font-mono font-bold ${isCritical ? 'text-red-600' : 'text-on-surface-variant'}`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {isCritical ? 'warning' : 'schedule'}
                      </span>
                      Noch {daysRemaining} {daysRemaining === 1 ? 'Tag' : 'Tage'}
                    </div>
                  </div>
                  
                  <div className="marquee-wrapper mb-2">
                    <h3 className="text-base sm:text-lg font-bold leading-snug line-clamp-2">
                      {item.title || item.summary || 'Ohne Titel'}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-outline-variant">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreItem(item.id, item._type);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">restore</span>
                    Wiederherstellen
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('Dieses Element wird unwiderruflich gelöscht. Fortfahren?')) {
                        permanentlyDeleteItem(item.id, item._type);
                      }
                    }}
                    className="inline-flex items-center justify-center w-9 h-9 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-colors cursor-pointer"
                    title="Endgültig löschen"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Trash;
