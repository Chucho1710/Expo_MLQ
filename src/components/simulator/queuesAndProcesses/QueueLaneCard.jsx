import React, { useState } from 'react';
import QueueProcessItem from './QueueProcessItem.jsx';
import InlineAddProcess from './InlineAddProcess.jsx';
import {
  ALGORITHMS,
  queueName,
  queueDescription,
  queuePriorityLabel,
  queuePalette
} from '../../../engine/mlqEngine.js';

export default function QueueLaneCard({
  index,
  total,
  config,
  processes,
  isPercent,
  maxPct,
  quota,
  nextPlaceholderId,
  processColors,
  onNameChange,
  onAlgChange,
  onQuantumChange,
  onPctChange,
  onMove,
  onRemove,
  onAddProcess,
  onDeleteProcess,
  toast
}) {
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const cfg = config.queues[index];
  const name = queueName(config, index);
  const desc = queueDescription(config, index);
  const pal = queuePalette(index);
  const alg = ALGORITHMS[cfg.algorithm] || ALGORITHMS.FCFS;

  // Filtrar solo los procesos de esta cola
  const procsInQueue = processes.filter((p) => p.queue === index);

  return (
    <article
      className={`qcard q${index}`}
      style={{ '--q-color': pal.base, '--q-soft': pal.soft }}
    >
      {/* Cabecera de la cola */}
      <header>
        <div className="qhead-main">
          <div className="qlevel">Cola {index + 1}</div>
          <input
            className="qname-input"
            type="text"
            maxLength="24"
            defaultValue={name}
            key={name}
            onBlur={(e) => onNameChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
            aria-label={`Nombre de la cola ${index + 1}`}
            title="Haz clic para editar el nombre de la cola"
          />
        </div>
        <div className="qcard-tools">
          <span className="prio-pill" title={`Prioridad nivel ${index + 1} de ${total}`}>
            {queuePriorityLabel(index, total)}
          </span>
          <button
            className="qtool"
            type="button"
            title="Subir prioridad"
            aria-label={`Subir prioridad de ${name}`}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            ↑
          </button>
          <button
            className="qtool"
            type="button"
            title="Bajar prioridad"
            aria-label={`Bajar prioridad de ${name}`}
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            ↓
          </button>
          <button
            className="qtool qdel"
            type="button"
            title={`Eliminar ${name}`}
            aria-label={`Eliminar cola ${name}`}
            disabled={total <= 1}
            onClick={() => onRemove(index)}
          >
            ✕
          </button>
        </div>
      </header>

      <p className="qdesc">{desc}</p>

      {/* Parámetros internos de la cola */}
      <div className="qcard-params">
        <label className="qfield">
          Algoritmo interno
          <select
            value={cfg.algorithm}
            onChange={(e) => onAlgChange(index, e.target.value)}
            aria-label={`Algoritmo de la cola ${name}`}
          >
            {Object.keys(ALGORITHMS).map((k) => (
              <option key={k} value={k}>
                {ALGORITHMS[k].label}
              </option>
            ))}
          </select>
        </label>

        {isPercent && (
          <label className="qfield qpct">
            % de CPU
            <div className="qpct-row">
              <input
                type="number"
                min="1"
                max={maxPct}
                step="1"
                value={config.percent[index] ?? ''}
                onChange={(e) => onPctChange(index, e.target.value)}
              />
              <span className="qquota">
                {quota !== null ? `Cuota: ${quota} u/ciclo` : ''}
              </span>
            </div>
          </label>
        )}

        {alg.usesQuantum && (
          <label className="qfield">
            Quantum (u)
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              value={cfg.quantum}
              onChange={(e) => onQuantumChange(index, e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="qmeta">
        <span className="lane-tag">Modalidad:</span>
        <span className={`mod-badge ${alg.modality.startsWith('Apropiativo') ? 'pre' : ''}`}>
          {alg.modality}
        </span>
      </div>

      {/* SECCIÓN DE PROCESOS DENTRO DE LA COLA */}
      <div className="qcard-procs">
        <div className="qcard-procs-head">
          <span>Procesos en esta cola ({procsInQueue.length})</span>
          {!showInlineAdd && (
            <button
              className="btn btn-tiny btn-outline"
              type="button"
              onClick={() => setShowInlineAdd(true)}
              title={`Añadir proceso a ${name}`}
            >
              + Añadir
            </button>
          )}
        </div>

        {showInlineAdd && (
          <InlineAddProcess
            queueIndex={index}
            queueName={name}
            nextPlaceholderId={nextPlaceholderId}
            processes={processes}
            onAddProcess={onAddProcess}
            onCancel={() => setShowInlineAdd(false)}
            toast={toast}
          />
        )}

        {procsInQueue.length === 0 ? (
          <div className="qcard-empty">
            Sin procesos asignados. Haz clic en <strong>+ Añadir</strong> para agregar uno.
          </div>
        ) : (
          <div className="qcard-proc-list">
            {procsInQueue.map((p) => (
              <QueueProcessItem
                key={p.id}
                process={p}
                color={processColors.get(p.id) || { bg: '#1e293b', fg: '#fff' }}
                onDelete={onDeleteProcess}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
