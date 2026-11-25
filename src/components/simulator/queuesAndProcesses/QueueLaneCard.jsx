import React, { useState } from 'react';
import QueueProcessItem from './QueueProcessItem.jsx';
import InlineAddProcess from './InlineAddProcess.jsx';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import {
  ALGORITHMS,
  queueName,
  queueDescription,
  queuePriorityLabel,
  queuePalette,
  isQueuePreemptive,
  getQueueModalityLabel
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
  onQueuePreemptiveChange,
  onQuantumChange,
  onPctChange,
  onMove,
  onRemove,
  onAddProcess,
  onDeleteProcess,
  toast
}) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const cfg = config.queues[index];
  const name = queueName(config, index, lang);
  const desc = queueDescription(config, index, lang);
  const pal = queuePalette(index);
  const alg = ALGORITHMS[cfg.algorithm] || ALGORITHMS.FCFS;
  const isPreemptive = isQueuePreemptive(config, index);
  const modalityLabel = getQueueModalityLabel(config, index, lang);

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
          <div className="qlevel">{en ? `Queue ${index + 1}` : `Cola ${index + 1}`}</div>
          <input
            className="qname-input"
            type="text"
            maxLength="24"
            defaultValue={name}
            key={`${lang}-${name}`}
            onBlur={(e) => onNameChange(index, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur();
            }}
            aria-label={en ? `Queue ${index + 1} name` : `Nombre de la cola ${index + 1}`}
            title={en ? 'Click to edit queue name' : 'Haz clic para editar el nombre de la cola'}
          />
        </div>
        <div className="qcard-tools">
          <span
            className="prio-pill"
            title={en ? `Priority level ${index + 1} of ${total}` : `Prioridad nivel ${index + 1} de ${total}`}
          >
            {queuePriorityLabel(index, total, lang)}
          </span>
          <button
            className="qtool"
            type="button"
            title={en ? 'Increase priority' : 'Subir prioridad'}
            aria-label={en ? `Increase priority of ${name}` : `Subir prioridad de ${name}`}
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
          >
            ↑
          </button>
          <button
            className="qtool"
            type="button"
            title={en ? 'Decrease priority' : 'Bajar prioridad'}
            aria-label={en ? `Decrease priority of ${name}` : `Bajar prioridad de ${name}`}
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
          >
            ↓
          </button>
          <button
            className="qtool qdel"
            type="button"
            title={en ? `Delete ${name}` : `Eliminar ${name}`}
            aria-label={en ? `Delete queue ${name}` : `Eliminar cola ${name}`}
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
          {en ? 'Internal algorithm' : 'Algoritmo interno'}
          <select
            value={cfg.algorithm}
            onChange={(e) => onAlgChange(index, e.target.value)}
            aria-label={en ? `Algorithm for queue ${name}` : `Algoritmo de la cola ${name}`}
          >
            {Object.keys(ALGORITHMS).map((k) => (
              <option key={k} value={k}>
                {ALGORITHMS[k].label}
              </option>
            ))}
          </select>
        </label>

        {/* Toggle Expropiativo / No expropiativo para el algoritmo de la cola */}
        {alg.canTogglePreemption && (
          <div className="qfield">
            <span style={{ fontSize: '.78rem', color: 'var(--navy-700)' }}>
              {en ? 'Algorithm behavior' : 'Comportamiento del algoritmo'}
            </span>
            <div className="preempt-mode-toggle">
              <button
                type="button"
                className={`btn btn-tiny ${isPreemptive ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => onQueuePreemptiveChange(index, true)}
                title={
                  cfg.algorithm === 'RR'
                    ? en
                      ? 'Preemptive Round Robin: yields CPU when quantum expires'
                      : 'Round Robin expropiativo: al agotar el quantum cede la CPU'
                    : en
                    ? 'SRTF: preempts if a shorter job arrives'
                    : 'SRTF: expropia si llega un proceso más corto'
                }
              >
                {en ? '⚡ Preemptive' : '⚡ Expropiativo'}
              </button>
              <button
                type="button"
                className={`btn btn-tiny ${!isPreemptive ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => onQueuePreemptiveChange(index, false)}
                title={
                  cfg.algorithm === 'RR'
                    ? en
                      ? 'Non-preemptive Round Robin: runs until burst finishes'
                      : 'Round Robin no expropiativo: ejecuta hasta terminar su ráfaga'
                    : en
                    ? 'Non-preemptive SJF: does not interrupt the running process'
                    : 'SJF no expropiativo: no interrumpe al proceso en CPU'
                }
              >
                {en ? '🛡️ Non-preemptive' : '🛡️ No expropiativo'}
              </button>
            </div>
          </div>
        )}

        {isPercent && (
          <label className="qfield qpct">
            {en ? 'CPU %' : '% de CPU'}
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
                {quota !== null ? (en ? `Quota: ${quota} u/cycle` : `Cuota: ${quota} u/ciclo`) : ''}
              </span>
            </div>
          </label>
        )}

        {alg.usesQuantum && isPreemptive && (
          <label className="qfield">
            {en ? 'Quantum (time units)' : 'Quantum (u de tiempo)'}
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
        <span className="lane-tag">{en ? 'Mode:' : 'Modalidad:'}</span>
        <span className={`mod-badge ${isPreemptive ? 'pre' : ''}`}>
          {modalityLabel}
        </span>
      </div>

      {/* SECCIÓN DE PROCESOS DENTRO DE LA COLA */}
      <div className="qcard-procs">
        <div className="qcard-procs-head">
          <span>
            {en
              ? `Processes in this queue (${procsInQueue.length})`
              : `Procesos en esta cola (${procsInQueue.length})`}
          </span>
          {!showInlineAdd && (
            <button
              className="btn btn-tiny btn-outline"
              type="button"
              onClick={() => setShowInlineAdd(true)}
              title={en ? `Add process to ${name}` : `Añadir proceso a ${name}`}
            >
              {en ? '+ Add' : '+ Añadir'}
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
            {en ? (
              <>
                No processes assigned. Click <strong>+ Add</strong> to create one.
              </>
            ) : (
              <>
                Sin procesos asignados. Haz clic en <strong>+ Añadir</strong> para agregar uno.
              </>
            )}
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
