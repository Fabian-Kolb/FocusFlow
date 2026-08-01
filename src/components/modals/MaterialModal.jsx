import React, { useState, useEffect, useRef } from 'react';
import { useModalContext } from '../../context/ModalContext';

const MaterialModal = () => {
  const { activeModal, modalPayload, closeModal, addMaterial, selectedProjectId } = useModalContext();
  const isOpen = activeModal === 'material';

  const [materialName, setMaterialName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const nameInputRef = useRef(null);

  const targetProjectId = modalPayload.projectId || selectedProjectId;
  const targetPhaseId = modalPayload.phaseId;

  // Global Clipboard Paste Listener (Ctrl+V / Strg+V)
  useEffect(() => {
    if (!isOpen) return;

    setMaterialName('');
    setIsDragging(false);

    const handlePaste = (e) => {
      // Don't override if typing in an input
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

  if (!isOpen) {
    return (
      <div id="material-modal" className="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"></div>
    );
  }

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
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

  const handleDropZoneClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!materialName.trim()) return;

    if (targetPhaseId) {
      addMaterial(targetProjectId, targetPhaseId, { name: materialName.trim() });
    }

    closeModal();
  };

  return (
    <div
      id="material-modal"
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white border-2 border-primary w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-[22px] text-primary">upload_file</span>
            <h2 className="text-xs sm:text-sm font-bold font-mono uppercase truncate">MATERIAL / DOKUMENT ANHÄNGEN</h2>
          </div>
          <button
            type="button"
            className="p-1 hover:bg-surface-low border border-outline-variant transition-colors"
            onClick={closeModal}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* DRAG AND DROP ZONE WITH STRG+V HINWEIS */}
          <div
            id="drop-zone"
            className={`border-2 border-dashed p-6 text-center space-y-2 transition-colors cursor-pointer relative ${
              isDragging ? 'border-primary bg-primary/5' : 'border-primary/50 bg-surface-low hover:border-primary'
            }`}
            onClick={handleDropZoneClick}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-picker-input"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelected}
            />
            <div className="w-10 h-10 bg-white border border-outline-variant rounded-full flex items-center justify-center mx-auto text-primary">
              <span className="material-symbols-outlined text-[22px]">cloud_upload</span>
            </div>
            <div>
              <p className="text-xs font-mono font-bold text-primary">DATEI HIERHER ZIEHEN ODER KLICKEN</p>
              <p className="text-[11px] text-on-surface-variant mt-0.5">Unterstützt Dokumente, Bilder, PDFs (max. 25 MB)</p>
            </div>
            <div className="inline-block px-2.5 py-1 bg-white border border-outline-variant text-[10px] font-mono text-primary font-bold">
              💡 TIPP: <kbd className="px-1 bg-surface-low border rounded">Strg</kbd> + <kbd className="px-1 bg-surface-low border rounded">V</kbd> um Bild aus Zwischenablage einzufügen
            </div>
          </div>

          {/* GEWÄHLTE DATEI / ODER WEB LINK */}
          <div className="space-y-2">
            <label className="block text-xs font-mono font-bold text-primary uppercase">
              ODER WEB-LINK / DOKUMENTEN-NAME *
            </label>
            <input
              type="text"
              id="material-name-input"
              ref={nameInputRef}
              required
              className="w-full border border-outline-variant px-3 py-2 text-xs focus:border-primary outline-none"
              placeholder="z.B. Briefing-Dokument.pdf oder https://..."
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />
          </div>

          <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="px-4 py-2 border border-outline-variant text-xs font-mono font-bold text-on-surface-variant hover:text-primary transition-colors"
              onClick={closeModal}
            >
              ABBRECHEN
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-white text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-sm"
            >
              ANHÄNGEN
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialModal;
