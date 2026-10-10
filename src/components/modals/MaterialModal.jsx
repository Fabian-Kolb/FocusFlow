import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';
import { Button, Field, IconTile, Input, Kbd, Sheet, Tabs, cx } from '../ds';

const MaterialModal = () => {
  const { activeModal, modalPayload, closeModal, addMaterial, selectedProjectId } = useModalContext();
  const isOpen = activeModal === 'material';

  const [materialName, setMaterialName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'link'
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const targetProjectId = modalPayload.projectId || selectedProjectId;
  const targetPhaseId = modalPayload.phaseId;

  // Einfügen aus der Zwischenablage (Strg+V)
  useEffect(() => {
    if (!isOpen) return;

    setMaterialName('');
    setIsDragging(false);

    const handlePaste = (e) => {
      // In Eingabefeldern nichts überschreiben
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return;
      }

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const pasteText = clipboardData.getData('text');
      if (pasteText && pasteText.trim()) {
        setMaterialName(pasteText.trim());
      } else if (clipboardData.files && clipboardData.files.length > 0) {
        const file = clipboardData.files[0];
        setMaterialName(`Screenshot_${file.name || 'Zwischenablage.png'}`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen]);

  const stopDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    stopDrag(e);
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setMaterialName(e.dataTransfer.files[0].name);
    }
  };

  const handleFileSelected = (e) => {
    if (e.target.files && e.target.files[0]) {
      setMaterialName(e.target.files[0].name);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!materialName.trim()) return;

    if (targetPhaseId) {
      addMaterial(targetProjectId, targetPhaseId, {
        name: materialName.trim(),
        content: modalPayload.content || null
      });
    }

    closeModal();
  };

  return (
    <Sheet
      open={isOpen}
      onClose={closeModal}
      title="Material anhängen"
      description="Dateien, Screenshots oder Links zu dieser Phase oder Aufgabe."
      footer={(
        <>
          <Button variant="secondary" onClick={closeModal}>Abbrechen</Button>
          <Button type="submit" form="material-form" leadingIcon="add_link">Anhängen</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: 'file', label: 'Datei oder Screenshot', icon: 'upload_file' },
            { value: 'link', label: 'Web-Link', icon: 'link' },
          ]}
        />

        <form id="material-form" onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'file' ? (
            <div
              id="drop-zone"
              role="button"
              tabIndex={0}
              className={cx(
                'cursor-pointer space-y-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
                isDragging ? 'border-accent bg-accent-subtle' : 'border-default bg-subtle hover:border-strong hover:bg-hover',
              )}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(e) => { stopDrag(e); setIsDragging(true); }}
              onDragOver={(e) => { stopDrag(e); setIsDragging(true); }}
              onDragLeave={(e) => { stopDrag(e); setIsDragging(false); }}
              onDrop={handleDrop}
            >
              <input type="file" id="file-picker-input" ref={fileInputRef} className="hidden" onChange={handleFileSelected} />
              <IconTile area="accent" icon="cloud_upload" size="lg" className="mx-auto" />
              <div>
                <p className="text-body-strong text-primary">Datei hierher ziehen oder klicken</p>
                <p className="mt-1 text-caption text-secondary">Dokumente, PDFs und Bilder (PNG, JPG, SVG, MD)</p>
              </div>
              <p className="inline-flex flex-wrap items-center justify-center gap-1.5 text-caption text-secondary">
                Tipp:
                <Kbd>Strg</Kbd> + <Kbd>V</Kbd>
                fügt ein Bild direkt ein.
              </p>
            </div>
          ) : (
            <Field label="Adresse der Website oder des Online-Dokuments">
              <Input
                leadingIcon="link"
                required
                placeholder="https://beispiel.de/dokumentation"
                value={materialName}
                onChange={(e) => setMaterialName(e.target.value)}
              />
            </Field>
          )}

          <Field label="Bezeichnung">
            <Input
              id="material-name-input"
              ref={nameInputRef}
              required
              placeholder="z. B. Briefing.pdf oder Link zum Design-System"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />
          </Field>
        </form>
      </div>
    </Sheet>
  );
};

export default MaterialModal;
