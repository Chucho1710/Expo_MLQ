import React, { useState } from 'react';
import ImportJsonModal from './ImportJsonModal.jsx';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import {
  ALGORITHMS,
  MAX_QUEUES,
  queueName,
  queuePriorityLabel,
  validateInterruptions
} from '../../../engine/mlqEngine.js';

export default function GlobalActionsBar({
  config,
  processes,
  interruptions = [],
  nextPlaceholderId,
  isPercent,
  sumPct,
  minCycle,
  policyErrors,
  onPolicyChange,
  onMlqPreemptiveChange,
  onCycleChange,
  onClearProcesses,
  onResetConfig,
  onAddProcess,
  onAddQueue,
  onInterruptionsChange,
  onImport,
  toast
}) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [showGlobalAddProc, setShowGlobalAddProc] = useState(false);
  const [showAddQueue, setShowAddQueue] = useState(false);
  const [showAddInterrupt, setShowAddInterrupt] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Formulario global de procesos
  const [pId, setPId] = useState('');
  const [pArrival, setPArrival] = useState('0');
  const [pBurst, setPBurst] = useState('3');
  const [pQueue, setPQueue] = useState('0');
  const [pErr, setPErr] = useState('');

  // Formulario de colas
  const [qName, setQName] = useState('');
  const [qAlg, setQAlg] = useState('RR');
  const [qQuantum, setQQuantum] = useState(2);
  const [qErr, setQErr] = useState('');

  // Formulario de interrupciones externas
  const [irqLabel, setIrqLabel] = useState('');
  const [irqTime, setIrqTime] = useState('2');
  const [irqDuration, setIrqDuration] = useState('2');
  const [irqErr, setIrqErr] = useState('');

  const total = config.queues.length;
  const isMlqPreemptive = config.preemptive !== false;

  const handleCreateProcess = (e) => {
    e.preventDefault();
    const idRaw = pId.trim() || nextPlaceholderId;
    const arr = Number(pArrival);
    const bst = Number(pBurst);
    const qIdx = Number(pQueue);

    if (!/^[A-Za-z0-9_-]{1,8}$/.test(idRaw)) {
      setPErr(en ? 'ID: 1-8 letters, numbers, or hyphen.' : 'ID: 1-8 letras, números o guion.');
      return;
    }
    if (processes.some((p) => p.id.toLowerCase() === idRaw.toLowerCase())) {
      setPErr(en ? `Process ${idRaw} already exists.` : `Ya existe el proceso ${idRaw}.`);
      return;
    }
    if (!Number.isInteger(arr) || arr < 0 || arr > 1000) {
      setPErr(en ? 'Arrival must be an integer >= 0.' : 'Llegada debe ser entero >= 0.');
      return;
    }
    if (!Number.isInteger(bst) || bst < 1 || bst > 1000) {
      setPErr(en ? 'Burst must be an integer >= 1.' : 'Ráfaga debe ser entero >= 1.');
      return;
    }
    if (processes.length >= 30) {
      setPErr(en ? 'Maximum 30 processes.' : 'Máximo 30 procesos.');
      return;
    }

    setPErr('');
    onAddProcess({ id: idRaw, arrival: arr, burst: bst, queue: qIdx });
    toast(
      en
        ? `Process ${idRaw} added to queue ${queueName(config, qIdx, lang)}.`
        : `Proceso ${idRaw} agregado a la cola ${queueName(config, qIdx, lang)}.`
    );
    setPId('');
    setShowGlobalAddProc(false);
  };

  const handleCreateQueue = (e) => {
    e.preventDefault();
    if (total >= MAX_QUEUES) {
      setQErr(en ? `Maximum ${MAX_QUEUES} queues allowed.` : `Máximo ${MAX_QUEUES} colas permitidas.`);
      return;
    }
    const name = qName.trim() || (en ? `Queue ${total + 1}` : `Cola ${total + 1}`);
    if (config.queues.some((_, i) => queueName(config, i, lang).toLowerCase() === name.toLowerCase())) {
      setQErr(en ? `A queue named "${name}" already exists.` : `Ya existe una cola llamada "${name}".`);
      return;
    }
    const alg = ALGORITHMS[qAlg];
    const quantum = alg.usesQuantum ? Number(qQuantum) : 4;
    if (alg.usesQuantum && (!Number.isInteger(quantum) || quantum < 1 || quantum > 99)) {
      setQErr(en ? 'Quantum must be an integer between 1 and 99.' : 'El quantum debe ser un entero entre 1 y 99.');
      return;
    }

    setQErr('');
    onAddQueue({
      name,
      description: en ? `Priority level ${total + 1} queue.` : `Cola de prioridad nivel ${total + 1}.`,
      algorithm: qAlg,
      quantum,
      preemptive: alg.key === 'RR' || alg.key === 'SRTF'
    });
    setQName('');
    setShowAddQueue(false);
  };

  const handleImportClick = () => {
    setShowImportModal(true);
  };

  const handleImportSuccess = ({ processes: procs, config: cfg, interruptions: ints }) => {
    onImport(procs, cfg, ints);
    const parts = [en ? `${procs.length} process(es)` : `${procs.length} proceso(s)`];
    if (cfg) parts.push(en ? 'configuration' : 'configuración');
    if (ints && ints.length) parts.push(en ? `${ints.length} interruption(s)` : `${ints.length} interrupción(es)`);
    toast(en ? `Imported: ${parts.join(', ')}.` : `Importado: ${parts.join(', ')}.`);
  };

  const handleCreateInterrupt = (e) => {
    e.preventDefault();
    const timeVal = Number(irqTime);
    const durVal = Number(irqDuration);
    const nextIdx = interruptions.length + 1;
    const labelVal = irqLabel.trim() || `IRQ${nextIdx}`;
    const candidate = {
      id: `IRQ_${Date.now()}_${nextIdx}`,
      label: labelVal,
      time: timeVal,
      duration: durVal
    };
    const nextList = [...interruptions, candidate];
    const errs = validateInterruptions(nextList, lang);
    if (errs.length) {
      setIrqErr(errs[0]);
      return;
    }
    setIrqErr('');
    onInterruptionsChange(nextList.sort((a, b) => a.time - b.time));
    toast(
      en
        ? `Interruption "${labelVal}" scheduled at t = ${timeVal} (${durVal} u).`
        : `Interrupción "${labelVal}" programada en t = ${timeVal} (${durVal} u).`
    );
    setIrqLabel('');
    setShowAddInterrupt(false);
  };

  const handleRemoveInterrupt = (id) => {
    const nextList = interruptions.filter((ir) => ir.id !== id);
    onInterruptionsChange(nextList);
    toast(en ? 'Interruption removed.' : 'Interrupción eliminada.');
  };

  return (
    <div className="global-actions-bar">
      {/* Barra de acciones: importar / vaciar / restaurar */}
      <div className="scenario-presets-row">
        <div className="preset-label">
          <span>Acciones rápidas:</span>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-small btn-primary"
            type="button"
            onClick={handleImportClick}
            title="Importar procesos y configuración desde un archivo JSON"
          >
            ↑ Importar JSON
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={onClearProcesses}
          >
            Vaciar procesos
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={onResetConfig}
          >
            Restaurar colas
          </button>
        </div>
      </div>

      {/* Selector de Política entre colas */}
      <div className="policy-selection-box">
        <div className="policy-opts" role="radiogroup" aria-label="Política de planificación entre colas">
          <div className={`policy-opt ${!isPercent ? 'is-active' : ''}`}>
            <label className="policy-opt-label">
              <input
                type="radio"
                name="policy"
                value="priority"
                checked={!isPercent}
                onChange={() => onPolicyChange('priority')}
              />
              <span>
                <b>Prioridad fija entre colas (MLQ)</b>
                <small>
                  El planificador atiende las colas en orden estricto de prioridad (Cola 1 &gt; Cola 2 &gt; ...).
                </small>
              </span>
            </label>

            {/* Selector de Expropiativo vs No Expropiativo para MLQ */}
            {!isPercent && (
              <div className="policy-sub-opts">
                <span className="sub-opt-title">Modo entre colas:</span>
                <label className={`sub-opt-btn ${isMlqPreemptive ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="mlq-preempt-mode"
                    checked={isMlqPreemptive}
                    onChange={() => onMlqPreemptiveChange(true)}
                  />
                  <span>⚡ Expropiativo (Apropiativo)</span>
                </label>
                <label className={`sub-opt-btn ${!isMlqPreemptive ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="mlq-preempt-mode"
                    checked={!isMlqPreemptive}
                    onChange={() => onMlqPreemptiveChange(false)}
                  />
                  <span>🛡️ No expropiativo</span>
                </label>
              </div>
            )}
          </div>

          <div className={`policy-opt ${isPercent ? 'is-active' : ''}`}>
            <label className="policy-opt-label">
              <input
                type="radio"
                name="policy"
                value="percent"
                checked={isPercent}
                onChange={() => onPolicyChange('percent')}
              />
              <span>
                <b>Porcentajes de CPU</b>
                <small>
                  El tiempo se reparte en ciclos según los porcentajes asignados. Evita la inanición de colas bajas.
                </small>
              </span>
            </label>
          </div>
        </div>

        {isPercent && (
          <div className="policy-extra">
            <label className="cycle-field">
              Duración del ciclo (u)
              <input
                id="cycle"
                type="number"
                min={minCycle}
                max="100"
                step="1"
                value={config.cycle}
                onChange={onCycleChange}
              />
            </label>
            <div className={`pct-sum ${sumPct !== 100 ? 'bad' : ''}`} aria-live="polite">
              Suma: {sumPct} %
            </div>
          </div>
        )}

        {policyErrors.length > 0 && (
          <p className="form-msg" role="alert" aria-live="polite">
            {policyErrors.join(' ')}
          </p>
        )}
      </div>

      {/* Barra de acción rápida para agregar Proceso o Cola */}
      <div className="quick-actions-toolbar">
        <div className="toolbar-buttons">
          <button
            className={`btn btn-small ${showGlobalAddProc ? 'btn-primary' : 'btn-outline'}`}
            type="button"
            onClick={() => {
              setShowGlobalAddProc(!showGlobalAddProc);
              setShowAddQueue(false);
            }}
          >
            {showGlobalAddProc ? 'Cerrar formulario de proceso' : '+ Agregar Proceso Global'}
          </button>

          <button
            className={`btn btn-small ${showAddQueue ? 'btn-primary' : 'btn-outline'}`}
            type="button"
            disabled={total >= MAX_QUEUES}
            onClick={() => {
              setShowAddQueue(!showAddQueue);
              setShowGlobalAddProc(false);
              setShowAddInterrupt(false);
            }}
          >
            {showAddQueue ? 'Cerrar formulario de cola' : '+ Crear Nueva Cola'}
          </button>

          <button
            className={`btn btn-small ${showAddInterrupt ? 'btn-primary' : 'btn-outline'}`}
            type="button"
            onClick={() => {
              setShowAddInterrupt(!showAddInterrupt);
              setShowGlobalAddProc(false);
              setShowAddQueue(false);
            }}
          >
            {showAddInterrupt ? 'Cerrar interrupción' : '⚡ Añadir Interrupción'}
          </button>
        </div>

        {/* Formulario desplegable para agregar Proceso */}
        {showGlobalAddProc && (
          <form className="proc-form" onSubmit={handleCreateProcess}>
            <label>
              Proceso
              <input
                type="text"
                maxLength="8"
                placeholder={nextPlaceholderId}
                value={pId}
                onChange={(e) => setPId(e.target.value)}
              />
            </label>
            <label>
              Llegada
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={pArrival}
                onChange={(e) => setPArrival(e.target.value)}
                required
              />
            </label>
            <label>
              Ráfaga (burst)
              <input
                type="number"
                min="1"
                max="1000"
                step="1"
                value={pBurst}
                onChange={(e) => setPBurst(e.target.value)}
                required
              />
            </label>
            <label>
              Cola de destino
              <select value={pQueue} onChange={(e) => setPQueue(e.target.value)}>
                {config.queues.map((_, i) => (
                  <option key={i} value={i}>
                    Cola {i + 1} · {queueName(config, i)} ({queuePriorityLabel(i, total).toLowerCase()})
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">
              + Agregar proceso
            </button>
          </form>
        )}
        {pErr && <p className="form-msg" role="alert">{pErr}</p>}

        {/* Formulario desplegable para agregar Cola */}
        {showAddQueue && (
          <form className="queue-form" onSubmit={handleCreateQueue}>
            <label>
              Nombre de la cola
              <input
                type="text"
                maxLength="24"
                placeholder={`Cola ${total + 1}`}
                value={qName}
                onChange={(e) => setQName(e.target.value)}
              />
            </label>
            <label>
              Algoritmo
              <select value={qAlg} onChange={(e) => setQAlg(e.target.value)}>
                <option value="FCFS">FCFS (First Come, First Served)</option>
                <option value="SJF">SJF (Shortest Job First)</option>
                <option value="SRTF">SRTF (Shortest Remaining Time First)</option>
                <option value="RR">Round Robin (RR)</option>
              </select>
            </label>
            {ALGORITHMS[qAlg]?.usesQuantum && (
              <label>
                Quantum
                <input
                  type="number"
                  min="1"
                  max="99"
                  step="1"
                  value={qQuantum}
                  onChange={(e) => setQQuantum(e.target.value)}
                />
              </label>
            )}
            <button className="btn btn-primary" type="submit">
              + Crear cola
            </button>
          </form>
        )}
        {qErr && <p className="form-msg" role="alert">{qErr}</p>}

        {/* Formulario desplegable para programar Interrupción externa */}
        {showAddInterrupt && (
          <form className="interrupt-form" onSubmit={handleCreateInterrupt}>
            <label>
              Etiqueta / Motivo
              <input
                type="text"
                maxLength="16"
                placeholder={`IRQ${interruptions.length + 1} (E/S, Disco...)`}
                value={irqLabel}
                onChange={(e) => setIrqLabel(e.target.value)}
              />
            </label>
            <label>
              Instante (t)
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={irqTime}
                onChange={(e) => setIrqTime(e.target.value)}
                required
              />
            </label>
            <label>
              Duración (u)
              <input
                type="number"
                min="1"
                max="100"
                step="1"
                value={irqDuration}
                onChange={(e) => setIrqDuration(e.target.value)}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit">
              ⚡ Programar interrupción
            </button>
          </form>
        )}
        {irqErr && <p className="form-msg" role="alert">{irqErr}</p>}

        {interruptions.length > 0 && (
          <div className="interrupts-bar" aria-label="Interrupciones programadas">
            <span className="interrupts-bar-label">⚡ Interrupciones programadas:</span>
            <div className="interrupts-pills">
              {interruptions.map((ir) => (
                <span key={ir.id} className="interrupt-pill">
                  <b>{ir.label}</b>
                  <span>t = {ir.time}</span>
                  <small>({ir.duration} u)</small>
                  <button
                    type="button"
                    className="interrupt-pill-del"
                    onClick={() => handleRemoveInterrupt(ir.id)}
                    aria-label={`Eliminar interrupción ${ir.label}`}
                    title="Eliminar interrupción"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {interruptions.length > 1 && (
              <button
                type="button"
                className="btn btn-small btn-danger"
                onClick={() => {
                  onInterruptionsChange([]);
                  toast('Interrupciones eliminadas.');
                }}
              >
                Vaciar
              </button>
            )}
          </div>
        )}
      </div>

      <ImportJsonModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
