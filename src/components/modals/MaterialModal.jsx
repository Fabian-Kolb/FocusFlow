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
      addMaterial(targetProjectId, targetPhaseId, { 
        name: materialName.trim(),
        content: modalPayload.content || null
      });
    }

    closeModal();
  };

  const [activeTab, setActiveTab] = useState('file'); // 'file' | 'link'

  return (
    <div
      id="material-modal"
      className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
    >
      <div className="bg-white border border-primary/20 w-full max-w-lg p-6 space-y-5 shadow-2xl rounded-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">attach_file</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold font-mono text-primary uppercase tracking-wider">MATERIAL / LINK ANHÄNGEN</h2>
              <p className="text-[11px] text-on-surface-variant font-normal">Füge Dateien, Screenshots oder Links zu dieser Phase oder Task hinzu</p>
            </div>
          </div>
          <button
            type="button"
            className="p-1.5 hover:bg-surface-low rounded-xl text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
            onClick={closeModal}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-surface-low p-1 rounded-xl border border-outline-variant">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'file' ? 'bg-white text-primary shadow-sm border border-outline-variant' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">upload_file</span>
            <span>Datei / Screenshot</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 py-1.5 text-xs font-mono font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'link' ? 'bg-white text-primary shadow-sm border border-outline-variant' : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">link</span>
            <span>Website / Web-Link</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {activeTab === 'file' ? (
            /* DRAG AND DROP ZONE WITH STRG+V HINWEIS */
            <div
              id="drop-zone"
              className={`border-2 border-dashed rounded-xl p-6 text-center space-y-3 transition-all cursor-pointer relative ${
                isDragging ? 'border-primary bg-primary/10 scale-[0.99]' : 'border-outline-variant hover:border-primary bg-surface-low/50 hover:bg-surface-low'
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
              <div className="w-12 h-12 bg-primary text-on-primary rounded-full flex items-center justify-center mx-auto shadow-md">
                <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
              </div>
              <div>
                <p className="text-xs font-mono font-bold text-primary">DATEI HIERHER ZIEHEN ODER KLICKEN</p>
                <p className="text-[11px] text-on-surface-variant mt-1">Unterstützt Dokumente, PDFs, Bilder (PNG, JPG, SVG, MD)</p>
              </div>
              <div className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-outline-variant rounded-lg text-[10px] font-mono text-primary font-bold shadow-sm">
                <span>💡 TIPP:</span>
                <kbd className="px-1 py-0.5 bg-surface-low border border-outline-variant rounded text-[9px]">Strg</kbd>
                <span>+</span>
                <kbd className="px-1 py-0.5 bg-surface-low border border-outline-variant rounded text-[9px]">V</kbd>
                <span>Bild direkt einfügen</span>
              </div>
            </div>
          ) : (
            /* WEB LINK INPUT */
            <div className="space-y-2 p-4 bg-surface-low border border-outline-variant rounded-xl">
              <label className="block text-xs font-mono font-bold text-primary uppercase">
                WEBSITE-URL ODER ONLINE-DOKUMENT *
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">
                  link
                </span>
                <input
                  type="text"
                  required
                  className="w-full border border-outline-variant pl-9 pr-3 py-2 text-xs rounded-lg focus:border-primary outline-none bg-white font-mono"
                  placeholder="https://beispiel.de/dokumentation"
                  value={materialName}
                  onChange={(e) => setMaterialName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* GEWÄHLTER NAME INPUT FOR FILE / LINK */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono font-bold text-primary uppercase">
              BEZEICHNUNG / TITEL DES MATERIALS *
            </label>
            <input
              type="text"
              id="material-name-input"
              ref={nameInputRef}
              required
              className="w-full border border-outline-variant px-3 py-2 text-xs rounded-lg focus:border-primary outline-none bg-white"
              placeholder="z.B. Briefing-Dokument.pdf oder Design-System Link"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
            />
          </div>

          <div className="border-t border-outline-variant pt-4 flex items-center justify-end gap-2.5">
            <button
              type="button"
              className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-mono font-bold text-on-surface-variant hover:text-primary hover:bg-surface-low transition-colors cursor-pointer"
              onClick={closeModal}
            >
              ABBRECHEN
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary text-white rounded-xl text-xs font-mono font-bold hover:bg-neutral-800 transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              <span>ANHÄNGEN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialModal;
