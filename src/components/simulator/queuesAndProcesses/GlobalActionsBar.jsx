import React, { useState } from 'react';
import {
  ALGORITHMS,
  MAX_QUEUES,
  queueName,
  queuePriorityLabel
} from '../../../engine/mlqEngine.js';

export default function GlobalActionsBar({
  config,
  processes,
  nextPlaceholderId,
  isPercent,
  sumPct,
  minCycle,
  policyErrors,
  onPolicyChange,
  onMlqPreemptiveChange,
  onCycleChange,
  onLoadScenario,
  onClearProcesses,
  onResetConfig,
  onAddProcess,
  onAddQueue,
  toast
}) {
  const [showGlobalAddProc, setShowGlobalAddProc] = useState(false);
  const [showAddQueue, setShowAddQueue] = useState(false);

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

  const total = config.queues.length;
  const isMlqPreemptive = config.preemptive !== false;

  const handleCreateProcess = (e) => {
    e.preventDefault();
    const idRaw = pId.trim() || nextPlaceholderId;
    const arr = Number(pArrival);
    const bst = Number(pBurst);
    const qIdx = Number(pQueue);

    if (!/^[A-Za-z0-9_-]{1,8}$/.test(idRaw)) {
      setPErr('ID: 1-8 letras, números o guion.');
      return;
    }
    if (processes.some((p) => p.id.toLowerCase() === idRaw.toLowerCase())) {
      setPErr(`Ya existe el proceso ${idRaw}.`);
      return;
    }
    if (!Number.isInteger(arr) || arr < 0 || arr > 1000) {
      setPErr('Llegada debe ser entero >= 0.');
      return;
    }
    if (!Number.isInteger(bst) || bst < 1 || bst > 1000) {
      setPErr('Ráfaga debe ser entero >= 1.');
      return;
    }
    if (processes.length >= 30) {
      setPErr('Máximo 30 procesos.');
      return;
    }

    setPErr('');
    onAddProcess({ id: idRaw, arrival: arr, burst: bst, queue: qIdx });
    toast(`Proceso ${idRaw} agregado a la cola ${queueName(config, qIdx)}.`);
    setPId('');
    setShowGlobalAddProc(false);
  };

  const handleCreateQueue = (e) => {
    e.preventDefault();
    if (total >= MAX_QUEUES) {
      setQErr(`Máximo ${MAX_QUEUES} colas permitidas.`);
      return;
    }
    const name = qName.trim() || `Cola ${total + 1}`;
    if (config.queues.some((_, i) => queueName(config, i).toLowerCase() === name.toLowerCase())) {
      setQErr(`Ya existe una cola llamada "${name}".`);
      return;
    }
    const alg = ALGORITHMS[qAlg];
    const quantum = alg.usesQuantum ? Number(qQuantum) : 4;
    if (alg.usesQuantum && (!Number.isInteger(quantum) || quantum < 1 || quantum > 99)) {
      setQErr('El quantum debe ser un entero entre 1 y 99.');
      return;
    }

    setQErr('');
    onAddQueue({
      name,
      description: `Cola de prioridad nivel ${total + 1}.`,
      algorithm: qAlg,
      quantum,
      preemptive: alg.key === 'RR' || alg.key === 'SRTF'
    });
    setQName('');
    setShowAddQueue(false);
  };

  return (
    <div className="global-actions-bar">
      {/* Botones de Escenarios y Presets */}
      <div className="scenario-presets-row">
        <div className="preset-label">
          <span>Escenarios predefinidos:</span>
        </div>
        <div className="btn-row">
          <button
            className="btn btn-small btn-primary"
            type="button"
            onClick={() => onLoadScenario('base')}
          >
            Escenario base
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={() => onLoadScenario('interrupciones')}
          >
            Con interrupciones
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={() => onLoadScenario('multicola')}
          >
            5 colas
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
            }}
          >
            {showAddQueue ? 'Cerrar formulario de cola' : '+ Crear Nueva Cola'}
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
      </div>
    </div>
  );
}
