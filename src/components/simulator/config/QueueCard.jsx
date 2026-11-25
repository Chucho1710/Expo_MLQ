import React from 'react';
import {
  ALGORITHMS,
  queueName,
  queueDescription,
  queuePriorityLabel,
  queuePalette
} from '../../../engine/mlqEngine.js';

export default function QueueCard({
  index,
  total,
  config,
  isPercent,
  maxPct,
  quota,
  pendingCount,
  onNameChange,
  onAlgChange,
  onQuantumChange,
  onPctChange,
  onMove,
  onRemove
}) {
  const cfg = config.queues[index];
  const name = queueName(config, index);
  const desc = queueDescription(config, index);
  const pal = queuePalette(index);
  const alg = ALGORITHMS[cfg.algorithm] || ALGORITHMS.FCFS;

  return (
    <article
      className={`qcard q${index}`}
      style={{ '--q-color': pal.base, '--q-soft': pal.soft }}
    >
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

      <div className="qmeta">
        <span className="lane-tag">Modalidad:</span>
        <span className={`mod-badge ${alg.modality.startsWith('Apropiativo') ? 'pre' : ''}`}>
          {alg.modality}
        </span>
      </div>

      <p className="alg-note">{alg.note}</p>

      {isPercent && (
        <label className="qfield qpct">
          % de la CPU
          <input
            type="number"
            min="1"
            max={maxPct}
            step="1"
            value={config.percent[index] ?? ''}
            onChange={(e) => onPctChange(index, e.target.value)}
          />
          <span className="qquota">
            {quota !== null && (
              <>
                Cuota: <b>{quota}</b> de {config.cycle} unidades por ciclo
              </>
            )}
          </span>
        </label>
      )}

      {alg.usesQuantum && (
        <label className="qfield">
          Quantum (unidades de tiempo)
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

      <div className="qpending">
        Procesos pendientes: <b>{pendingCount}</b>
      </div>
    </article>
  );
}
