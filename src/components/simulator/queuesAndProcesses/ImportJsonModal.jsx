import React, { useState, useRef, useEffect } from 'react';

/** Validates and parses a JSON import for processes + optional config + optional interruptions */
export function parseImport(raw) {
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error('JSON inválido. Verifica la sintaxis del archivo.');
  }

  let processes;
  let config = null;
  let interruptions = [];

  if (Array.isArray(obj)) {
    processes = obj;
  } else if (obj && Array.isArray(obj.processes)) {
    processes = obj.processes;
    config = obj.config || null;
    if (Array.isArray(obj.interruptions)) {
      interruptions = obj.interruptions;
    }
  } else {
    throw new Error('El JSON debe contener un array "processes" o ser directamente un array de procesos.');
  }

  if (!processes.length) throw new Error('El array de procesos está vacío.');

  processes.forEach((p, i) => {
    if (!p.id || typeof p.id !== 'string') throw new Error(`Proceso [${i}]: falta el campo "id".`);
    if (!Number.isInteger(p.arrival) || p.arrival < 0) throw new Error(`${p.id}: "arrival" debe ser un entero ≥ 0.`);
    if (!Number.isInteger(p.burst) || p.burst < 1) throw new Error(`${p.id}: "burst" debe ser un entero ≥ 1.`);
    if (!Number.isInteger(p.queue) || p.queue < 0) throw new Error(`${p.id}: "queue" debe ser un entero ≥ 0.`);
  });

  interruptions.forEach((ir, i) => {
    if (!ir || !Number.isInteger(ir.time) || ir.time < 0) {
      throw new Error(`Interrupción [${i}]: "time" debe ser un entero ≥ 0.`);
    }
    if (!Number.isInteger(ir.duration) || ir.duration < 1) {
      throw new Error(`Interrupción [${i}]: "duration" debe ser un entero ≥ 1.`);
    }
  });

  return { processes, config, interruptions };
}

export default function ImportJsonModal({ isOpen, onClose, onImportSuccess }) {
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragDepthRef = useRef(0);

  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      setErrorMsg('');
      setFileName('');
      setIsDragOver(false);
      dragDepthRef.current = 0;
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const processFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.json') && file.type !== 'application/json') {
      setErrorMsg('Por favor selecciona un archivo con extensión .json.');
      return;
    }

    setFileName(file.name);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseImport(ev.target.result);
        onImportSuccess(parsed);
        onClose();
      } catch (err) {
        setErrorMsg(err.message || 'No se pudo leer el archivo JSON.');
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error al leer el archivo desde el disco.');
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    processFile(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    processFile(file);
  };

  const handleBackdropClick = (e) => {
    // Light dismiss fallback when clicking the backdrop outside the dialog card
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const handleDialogClose = () => {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="import-dialog"
      aria-labelledby="import-dialog-title"
      closedby="any"
      onClose={handleDialogClose}
      onClick={handleBackdropClick}
    >
      <div className="import-dialog-card">
        <div className="import-dialog-head">
          <div>
            <h3 id="import-dialog-title">Importar escenario JSON</h3>
            <p className="import-dialog-sub">
              Carga un archivo con tus procesos, colas e interrupciones.
            </p>
          </div>
          <button
            type="button"
            className="import-dialog-close"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            ✕
          </button>
        </div>

        <div
          className={`import-dropzone ${isDragOver ? 'is-dragover' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="import-drop-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9 15 3-3 3 3" />
            </svg>
          </div>

          <p className="import-drop-title">
            {isDragOver
              ? 'Suelta el archivo JSON aquí'
              : 'Arrastra y suelta tu archivo .json aquí'}
          </p>
          <span className="import-drop-or">o bien</span>

          <button
            type="button"
            className="btn btn-primary"
            autoFocus
            onClick={() => fileInputRef.current?.click()}
          >
            Buscar en el ordenador
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {fileName && !errorMsg && (
            <p className="import-file-name">Archivo seleccionado: {fileName}</p>
          )}
        </div>

        {errorMsg && (
          <p className="import-dialog-error" role="alert">
            {errorMsg}
          </p>
        )}

        <div className="import-dialog-foot">
          <small>
            Formato aceptado: <code>{'{ "processes": [...], "config": {...}, "interruptions": [...] }'}</code> o un array de procesos.
          </small>
          <button type="button" className="btn btn-small btn-outline-dark" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </dialog>
  );
}
