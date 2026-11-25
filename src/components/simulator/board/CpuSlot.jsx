import React, { useState, useEffect } from 'react';
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
  simResult,
  ganttMs
}) {
  const burst = cpu ? cpu.burst : 1;
  const executedBefore = cpu ? cpu.executed : 0;
  const remaining = cpu ? cpu.remaining : 0;

  // Al finalizar este tick se habrá ejecutado una unidad adicional
  const targetUnits = cpu ? Math.min(burst, executedBefore + 1) : 0;
  const progressPct = cpu ? Math.round((targetUnits / burst) * 100) : 0;
  const isCompleting = cpu && remaining === 1;

  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    if (!cpu) {
      setBarWidth(0);
      return;
    }
    const t = setTimeout(() => {
      setBarWidth(progressPct);
    }, 20);
    return () => clearTimeout(t);
  }, [cpu?.pid, cpu?.executed, progressPct, cpu]);

  const irq = snap ? snap.interrupt : null;
  const finishEvents = snap ? snap.events.filter((e) => e.type === 'finish') : [];

  return (
    <div className={`cpu ${irq ? 'is-interrupt' : !cpu ? 'idle' : ''}`} aria-live="polite">
      <div className="cpu-title">
        <span>CPU</span>
        <span className="cpu-time">{snap ? `t = ${snap.t}` : 'detenida'}</span>
      </div>

      <div
        className="cpu-slot"
        data-msg={isFinished ? 'Simulación terminada' : ''}
      >
        {irq ? (
          <div className="cpu-irq-badge">
            <span>⚡ {irq.label}</span>
            <small>Rutina de interrupción (resta {irq.remaining} u)</small>
          </div>
        ) : (
          targetCpu.map((id) => {
            const proc = procsInfo.get(id);
            const col = processColors.get(id) || { bg: '#1e293b', fg: '#fff' };
            const fin = simResult ? simResult.metrics.perProcess.find((m) => m.id === id)?.finish : null;
            return <ProcessChip key={id} proc={proc} color={col} finishTime={fin} />;
          })
        )}
      </div>

      {/* Alerta de finalización al 100% */}
      {finishEvents.length > 0 && (
        <div className="cpu-finish-alert">
          {finishEvents.map((f, i) => (
            <div key={i}>✔ {f.pid} completó el 100% de CPU</div>
          ))}
        </div>
      )}

      {/* Barra de progreso de la CPU con porcentaje explícito */}
      <div className="cpu-bar-wrap">
        <div className={`cpu-bar-label ${isCompleting ? 'is-done' : ''}`}>
          <span>Progreso:</span>
          <b>
            {cpu
              ? isCompleting
                ? '100% (¡Ráfaga completada!)'
                : `${progressPct}% (${targetUnits}/${burst})`
              : '0%'}
          </b>
        </div>
        <div className="cpu-bar" title="Progreso de la ráfaga">
          <i
            className={isCompleting ? 'completed' : ''}
            style={{
              width: `${cpu ? barWidth : 0}%`,
              '--cpu-dur': `${ganttMs || 400}ms`
            }}
          />
        </div>
      </div>

      <dl className="cpu-info">
        <dt>Cola de origen</dt>
        <dd>{cpu ? queueName(config, cpu.queue) : '—'}</dd>
        <dt>Algoritmo</dt>
        <dd>{cpu ? ALGORITHMS[cpu.algorithm]?.short : '—'}</dd>
        <dt>Ejecutado</dt>
        <dd>{cpu ? `${targetUnits} / ${cpu.burst}` : '—'}</dd>
        <dt>Restante</dt>
        <dd>{cpu ? String(Math.max(0, cpu.remaining - 1)) : '—'}</dd>
        <dt>Quantum restante</dt>
        <dd>
          {cpu
            ? cpu.quantum === null
              ? 'n/a'
              : `${Math.max(0, cpu.qLeft - 1)} / ${cpu.quantum}`
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
