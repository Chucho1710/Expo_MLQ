import React from 'react';
import Lane from './Lane.jsx';
import CpuSlot from './CpuSlot.jsx';
import ProcessChip from './ProcessChip.jsx';
import {
  getProcessColors,
  allocateQuotas
} from '../../../engine/mlqEngine.js';

export default function Board({
  processes,
  config,
  currentSnapshot,
  isFinished,
  simResult,
  ganttMs
}) {
  const total = config.queues.length;
  const isPercent = config.policy === 'percent';
  const processColors = getProcessColors(processes, config);
  const snap = currentSnapshot;

  const validQuotas = isPercent ? allocateQuotas(config.percent, config.cycle) : null;
  const pref = snap ? snap.preferredQueue : null;
  const cpu = snap ? snap.cpu : null;

  const procsInfo = new Map();
  const targetNew = [];
  const targetDone = [];
  const targetCpu = [];
  const targetLanes = Array.from({ length: total }, () => []);

  if (!snap) {
    processes.forEach((p) => {
      procsInfo.set(p.id, {
        id: p.id,
        state: 'new',
        remaining: p.burst,
        executed: 0,
        burst: p.burst,
        arrival: p.arrival,
        queue: p.queue
      });
      targetNew.push(p.id);
    });
  } else {
    snap.procs.forEach((p) => {
      procsInfo.set(p.id, p);
      if (p.state === 'new') targetNew.push(p.id);
      else if (p.state === 'done') targetDone.push(p.id);
      else if (p.state === 'running') targetCpu.push(p.id);
    });
    snap.queues.forEach((ids, q) => {
      if (targetLanes[q]) targetLanes[q] = ids;
    });
  }

  return (
    <div className="panel board-panel" id="panel-tablero">
      <div className="panel-head">
        <h3>3 · Colas y CPU</h3>
        <div className="state-legend" aria-label="Estados de los procesos">
          <span className="chip-legend st-new">Nuevo</span>
          <span className="chip-legend st-ready">Listo</span>
          <span className="chip-legend st-running">Ejecutándose</span>
          <span className="chip-legend st-interrupted">Interrumpido</span>
          <span className="chip-legend st-done">Finalizado</span>
        </div>
      </div>

      <div className="board" id="board" style={{ '--q-count': String(total) }}>
        {/* Pool Nuevo */}
        <div className="pool pool-new">
          <span className="pool-title">Nuevo · aún no llega</span>
          <div className="chips">
            {targetNew.map((id) => (
              <ProcessChip
                key={id}
                proc={procsInfo.get(id)}
                color={processColors.get(id) || { bg: '#1e293b', fg: '#fff' }}
              />
            ))}
          </div>
        </div>

        {/* Carriles de cada cola */}
        {config.queues.map((_, i) => (
          <Lane
            key={i}
            index={i}
            total={total}
            config={config}
            currentSnapshot={snap}
            processes={processes}
            isPercent={isPercent}
            validQuotas={validQuotas}
            hasPref={pref === i}
            processIds={targetLanes[i] || []}
            procsInfo={procsInfo}
            processColors={processColors}
            simResult={simResult}
          />
        ))}

        {/* Flechas de preferencia hacia la CPU */}
        <div className="arrows">
          {config.queues.map((_, i) => (
            <div key={i} className={`arrow ${pref === i ? 'active' : ''}`}>
              <svg
                viewBox="0 0 44 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12h36M30 4l9 8-9 8" />
              </svg>
            </div>
          ))}
        </div>

        {/* Bloque CPU */}
        <CpuSlot
          cpu={cpu}
          snap={snap}
          config={config}
          isPercent={isPercent}
          pref={pref}
          isFinished={isFinished}
          targetCpu={targetCpu}
          procsInfo={procsInfo}
          processColors={processColors}
          simResult={simResult}
          ganttMs={ganttMs}
        />

        {/* Pool Finalizado */}
        <div className="pool pool-done">
          <span className="pool-title">Finalizado</span>
          <div className="chips">
            {targetDone.map((id) => {
              const fin = simResult ? simResult.metrics.perProcess.find((m) => m.id === id)?.finish : null;
              return (
                <ProcessChip
                  key={id}
                  proc={procsInfo.get(id)}
                  color={processColors.get(id) || { bg: '#1e293b', fg: '#fff' }}
                  finishTime={fin}
                />
              );
            })}
          </div>
        </div>
      </div>

      <p className="hint small">
        El proceso más cercano a la CPU (derecha) es el siguiente candidato según el algoritmo de esa cola. Los procesos nunca cambian de cola.
      </p>
    </div>
  );
}
