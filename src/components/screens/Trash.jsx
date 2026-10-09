import React, { useState } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Badge, Button, Card, EmptyState, Icon, IconButton, Input, PageHeader } from '../ds';
import { useConfirm } from '../../context/ConfirmContext';

// Art des Eintrags als Badge: Farbe nur mit Bedeutung, daher alle neutral (Icon und Wort tragen die Unterscheidung)
const TYPE_INFO = {
  project: { icon: 'folder', label: 'Projekt' },
  reminder: { icon: 'notifications', label: 'Erinnerung' },
  inbox: { icon: 'lightbulb', label: 'Gedanke' },
};

const Trash = ({ setCurrentScreen }) => {
  const {
    trashItems,
    restoreItem,
    permanentlyDeleteItem,
    setSelectedProjectId,
    setSelectedReminderId
  } = useModalContext();

  const confirm = useConfirm();
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
    // Gedanken haben noch keine Detailansicht
  };

  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return 30;
    const deletedTime = new Date(deletedAt).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
    return Math.max(0, 30 - diffDays);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Papierkorb"
        description="Elemente werden nach 30 Tagen endgültig gelöscht."
        className="md:items-center"
        actions={(
          <div className="w-full md:w-72">
            <Input
              type="search"
              leadingIcon="search"
              placeholder="Papierkorb durchsuchen"
              aria-label="Papierkorb durchsuchen"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      />

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="delete"
          title={searchQuery ? 'Keine Treffer' : 'Der Papierkorb ist leer'}
          description={searchQuery
            ? 'Probiere einen anderen Suchbegriff.'
            : 'Gelöschte Projekte, Erinnerungen und Gedanken liegen hier 30 Tage, bevor sie endgültig verschwinden.'}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const typeInfo = TYPE_INFO[item._type] || { icon: 'description', label: 'Eintrag' };
            const daysRemaining = getDaysRemaining(item.deletedAt);
            const isCritical = daysRemaining <= 3;

            return (
              <Card
                key={item.id}
                interactive={item._type !== 'inbox'}
                className="flex flex-col justify-between"
                onClick={() => handleItemClick(item)}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <Badge tone="neutral" icon={typeInfo.icon}>{typeInfo.label}</Badge>
                    <Badge tone={isCritical ? 'danger' : 'neutral'} icon={isCritical ? 'warning' : 'schedule'}>
                      Noch {daysRemaining} {daysRemaining === 1 ? 'Tag' : 'Tage'}
                    </Badge>
                  </div>

                  <h3 className="line-clamp-2 text-subheading text-primary">
                    {item.title || item.summary || 'Ohne Titel'}
                  </h3>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-subtle pt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon="restore"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreItem(item.id, item._type);
                    }}
                  >
                    Wiederherstellen
                  </Button>
                  <IconButton
                    icon="delete_forever"
                    label="Endgültig löschen"
                    variant="danger-ghost"
                    size="sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: 'Endgültig löschen?',
                        message: 'Dieses Element wird unwiderruflich gelöscht.',
                        confirmLabel: 'Endgültig löschen',
                        destructive: true,
                      });
                      if (ok) permanentlyDeleteItem(item.id, item._type);
                    }}
                  />
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
