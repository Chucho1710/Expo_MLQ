import React from 'react';
import {
  ALGORITHMS,
  queueName,
  queuePriorityLabel,
  queuePalette,
  getProcessColors,
  allocateQuotas
} from '../engine/mlqEngine.js';

const STATE_LABEL = {
  new: 'Nuevo',
  ready: 'Listo',
  running: 'Ejecutando',
  interrupted: 'Interrumpido',
  done: 'Finalizado'
};

export default function Board({
  processes,
  config,
  currentSnapshot,
  isFinished,
  simResult
}) {
  const total = config.queues.length;
  const isPercent = config.policy === 'percent';
  const processColors = getProcessColors(processes, config);
  const snap = currentSnapshot;

  const validQuotas = isPercent ? allocateQuotas(config.percent, config.cycle) : null;
  const pref = snap ? snap.preferredQueue : null;
  const cpu = snap ? snap.cpu : null;

  // Clasificar procesos según su estado actual
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

  const renderChip = (id) => {
    const p = procsInfo.get(id);
    if (!p) return null;
    const col = processColors.get(p.id) || { bg: '#1e293b', fg: '#fff' };
    const fin = simResult ? simResult.metrics.perProcess.find((m) => m.id === id) : null;

    const dataText =
      p.state === 'new'
        ? `llega t=${p.arrival} · ráf ${p.burst}`
        : p.state === 'done'
        ? `fin t=${fin ? fin.finish : '?'}`
        : `resta ${p.remaining}/${p.burst}`;

    const executedPct = (p.executed / p.burst) * 100;

    return (
      <div
        key={p.id}
        className={`proc-chip st-${p.state}`}
        data-pid={p.id}
        style={{
          background: col.bg,
          color: col.fg,
          borderColor: 'rgba(0,0,0,.35)'
        }}
        title={`${p.id} · llegada ${p.arrival} · ráfaga ${p.burst} · restante ${p.remaining} · ${STATE_LABEL[p.state]}`}
      >
        <div className="pc-top">
          <span className="pc-id">{p.id}</span>
          <span className="pc-st">{STATE_LABEL[p.state]}</span>
        </div>
        <div className="pc-data">{dataText}</div>
        <div className="pc-bar">
          <i style={{ width: `${executedPct}%` }} />
        </div>
      </div>
    );
  };

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
          <div className="chips">{targetNew.map(renderChip)}</div>
        </div>

        {/* Carriles de cada cola */}
        {config.queues.map((cfg, i) => {
          const pal = queuePalette(i);
          const alg = ALGORITHMS[cfg.algorithm] || ALGORITHMS.FCFS;
          const pending = snap
            ? snap.pending[i]
            : processes.filter((p) => p.queue === i).length;
          const cyc = snap && snap.cycle;
          const shareText = isPercent
            ? cyc
              ? `${config.percent[i]} % · cuota ${cyc.left[i]}/${cyc.quota[i]}`
              : validQuotas
              ? `${config.percent[i]} % · ${validQuotas[i]} u/ciclo`
              : `${config.percent[i]} %`
            : null;

          return (
            <div
              key={i}
              className={`lane q${i} ${pref === i ? 'has-pref' : ''}`}
              style={{
                '--q-row': i + 2,
                '--q-color': pal.base,
                '--q-soft': pal.soft
              }}
            >
              <div className="lane-head">
                <span className="lane-name">
                  Cola {i + 1} · {queueName(config, i)}
                </span>
                <span className="lane-tag prio">
                  {queuePriorityLabel(i, total)}
                </span>
                <span className="lane-tag">
                  {alg.short + (alg.usesQuantum ? ` · q = ${cfg.quantum}` : '')}
                </span>
                <span className="lane-tag">{alg.modality}</span>
                <span className="lane-tag">
                  {pending} pendiente{pending === 1 ? '' : 's'}
                </span>
                {isPercent && <span className="lane-tag share">{shareText}</span>}
                <span className="lane-pref">
                  {isPercent ? '★ Turno de CPU' : '★ Preferencia de CPU'}
                </span>
              </div>
              <div className="lane-area">
                {(targetLanes[i] || []).map(renderChip)}
              </div>
            </div>
          );
        })}

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
        <div className={`cpu ${!cpu ? 'idle' : ''}`} aria-live="polite">
          <div className="cpu-title">
            <span>CPU</span>
            <span className="cpu-time">{snap ? `t = ${snap.t}` : 'detenida'}</span>
          </div>

          <div
            className="cpu-slot"
            data-msg={isFinished ? 'Simulación terminada' : ''}
          >
            {targetCpu.map(renderChip)}
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

        {/* Pool Finalizado */}
        <div className="pool pool-done">
          <span className="pool-title">Finalizado</span>
          <div className="chips">{targetDone.map(renderChip)}</div>
        </div>
      </div>

      <p className="hint small">
        El proceso más cercano a la CPU (derecha) es el siguiente candidato según el algoritmo de esa cola. Los procesos nunca cambian de cola.
      </p>
    </div>
  );
}
