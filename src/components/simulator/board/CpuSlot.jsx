import React from 'react';
import { ALGORITHMS, queueName } from '../../../engine/mlqEngine.js';
import ProcessChip from './ProcessChip.jsx';

export default function CpuSlot({
  cpu,
  snap,
  config,
  isPercent,
  pref,
  isFinished,
  targetCpu,
  procsInfo,
  processColors,
  simResult
}) {
  return (
    <div className={`cpu ${!cpu ? 'idle' : ''}`} aria-live="polite">
      <div className="cpu-title">
        <span>CPU</span>
        <span className="cpu-time">{snap ? `t = ${snap.t}` : 'detenida'}</span>
      </div>

      <div
        className="cpu-slot"
        data-msg={isFinished ? 'Simulación terminada' : ''}
      >
        {targetCpu.map((id) => {
          const proc = procsInfo.get(id);
          const col = processColors.get(id) || { bg: '#1e293b', fg: '#fff' };
          const fin = simResult ? simResult.metrics.perProcess.find((m) => m.id === id)?.finish : null;
          return <ProcessChip key={id} proc={proc} color={col} finishTime={fin} />;
        })}
      </div>

      <div className="cpu-bar" title="Progreso de la ráfaga">
        <i
          style={{
            width: cpu ? `${(cpu.executed / cpu.burst) * 100}%` : '0%'
          }}
        />
      </div>

      <dl className="cpu-info">
        <dt>Cola de origen</dt>
        <dd>{cpu ? queueName(config, cpu.queue) : '—'}</dd>
        <dt>Algoritmo</dt>
        <dd>{cpu ? ALGORITHMS[cpu.algorithm]?.short : '—'}</dd>
        <dt>Ejecutado</dt>
        <dd>{cpu ? `${cpu.executed} / ${cpu.burst}` : '—'}</dd>
        <dt>Restante</dt>
        <dd>{cpu ? String(cpu.remaining) : '—'}</dd>
        <dt>Quantum restante</dt>
        <dd>
          {cpu
            ? cpu.quantum === null
              ? 'n/a'
              : `${cpu.qLeft} / ${cpu.quantum}`
            : '—'}
        </dd>
        {isPercent && (
          <>
            <dt>Ciclo</dt>
            <dd>
              {snap && snap.cycle
                ? `${snap.cycle.index + 1} · u. ${snap.cycle.pos + 1}/${snap.cycle.length}`
                : '—'}
            </dd>
          </>
        )}
      </dl>

      <div className="cpu-q">
        {cpu &&
          cpu.quantum !== null &&
          cpu.quantum <= 14 &&
          Array.from({ length: cpu.quantum }, (_, k) => (
            <i key={k} className={k < cpu.qLeft ? '' : 'off'} />
          ))}
      </div>

      <div className="cpu-pref">
        {isPercent ? 'Cola atendida (reparto por ciclo): ' : 'Cola con preferencia: '}
        <b>
          {pref === null
            ? snap
              ? 'ninguna (sin procesos listos)'
              : '—'
            : queueName(config, pref)}
        </b>
      </div>
    </div>
  );
}
