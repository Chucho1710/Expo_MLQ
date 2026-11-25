import React, { useRef, useEffect } from 'react';
import { queueName, queuePalette, getProcessColors } from '../engine/mlqEngine.js';

function computeSegs(ticks) {
  const segs = [];
  ticks.forEach((tk) => {
    const last = segs[segs.length - 1];
    if (last && last.pid === tk.pid && !tk.dispatch && last.end === tk.t) {
      last.end = tk.t + 1;
    } else {
      segs.push({ pid: tk.pid, queue: tk.queue, start: tk.t, end: tk.t + 1 });
    }
  });
  return segs;
}

export default function GanttChart({
  simResult,
  cursor,
  processes,
  config,
  status,
  ganttMs
}) {
  const scrollRef = useRef(null);
  const processColors = getProcessColors(processes, config);

  const M = simResult ? simResult.makespan : 0;
  const isPercent = config.policy === 'percent';

  // Auto-scroll durante la ejecución
  useEffect(() => {
    if (scrollRef.current && M > 0 && cursor >= 0) {
      const el = scrollRef.current;
      if (el.scrollWidth > el.clientWidth) {
        const x = ((cursor + 1) / M) * el.scrollWidth - el.clientWidth + 80;
        el.scrollTo({
          left: Math.max(0, x),
          behavior: status === 'running' ? 'smooth' : 'auto'
        });
      }
    }
  }, [cursor, M, status]);

  if (!simResult || cursor < 0) {
    return (
      <div className="panel" id="panel-gantt">
        <div className="panel-head">
          <h3>4 · Diagrama de Gantt</h3>
          <div className="gantt-legend" id="gantt-legend">
            {config.queues.map((_, i) => (
              <span key={i}>
                <i className="lg" style={{ background: queuePalette(i).base }} />
                {queueName(config, i)}
              </span>
            ))}
            <span><b className="mk mk-ctx">⇄</b> cambio de contexto</span>
            <span><b className="mk mk-pre">▼</b> interrupción</span>
            <span><b className="mk mk-fin">✔</b> finalización</span>
          </div>
        </div>
        <div className="gantt" id="gantt">
          <div className="gantt-empty">
            El diagrama se irá cargando aquí, unidad por unidad, cuando inicies la simulación.
          </div>
        </div>
      </div>
    );
  }

  const ticks = simResult.ticks.slice(0, cursor + 1);
  const segs = computeSegs(ticks);

  // Calcular marcas hasta el cursor actual
  const preMarks = [];
  const ctxMarks = [];
  const finMarks = [];

  simResult.snapshots.slice(0, cursor + 1).forEach((snap) => {
    snap.events.forEach((e) => {
      if (e.type === 'preempt') {
        preMarks.push({
          key: `p-${e.t}-${e.pid}`,
          t: e.t,
          title: `t=${e.t}: ${e.pid} interrumpido`
        });
      } else if (e.type === 'context') {
        ctxMarks.push({
          key: `c-${e.t}`,
          t: e.t,
          title: `t=${e.t}: cambio de contexto ${e.from} → ${e.to}`
        });
      } else if (e.type === 'finish') {
        finMarks.push({
          key: `f-${e.t}-${e.pid}`,
          t: e.t,
          title: `t=${e.t}: ${e.pid} finaliza`
        });
      }
    });
  });

  // Ticks para el eje de tiempo
  const step = Math.max(1, Math.ceil(M / 30));
  const axisTicks = [];
  for (let i = 0; i < M; i += step) axisTicks.push(i);
  if (!axisTicks.includes(M)) axisTicks.push(M);

  // Líneas divisorias de ciclo
  const cycleDividers = [];
  if (isPercent && config.cycle > 0) {
    for (let k = config.cycle; k < M; k += config.cycle) {
      cycleDividers.push(k);
    }
  }

  return (
    <div className="panel" id="panel-gantt">
      <div className="panel-head">
        <h3>4 · Diagrama de Gantt</h3>
        <div className="gantt-legend" id="gantt-legend">
          {config.queues.map((_, i) => (
            <span key={i}>
              <i className="lg" style={{ background: queuePalette(i).base }} />
              {queueName(config, i)}
            </span>
          ))}
          <span><b className="mk mk-ctx">⇄</b> cambio de contexto</span>
          <span><b className="mk mk-pre">▼</b> interrupción</span>
          <span><b className="mk mk-fin">✔</b> finalización</span>
        </div>
      </div>

      <div className="gantt" id="gantt" style={{ '--gdur': `${ganttMs}ms` }}>
        <div className="g-scroll" ref={scrollRef}>
          <div className="g-inner" style={{ minWidth: `${Math.max(600, M * 26)}px` }}>
            {/* Tira superior para marcas de interrupción y cambio de contexto */}
            <div className="g-strip">
              {preMarks.map((m) => (
                <span
                  key={m.key}
                  className="g-mark pre"
                  style={{ left: `${(m.t / M) * 100}%` }}
                  title={m.title}
                >
                  ▼
                </span>
              ))}
              {ctxMarks.map((m) => (
                <span
                  key={m.key}
                  className="g-mark ctx"
                  style={{ left: `${(m.t / M) * 100}%` }}
                  title={m.title}
                >
                  ⇄
                </span>
              ))}
            </div>

            {/* Pista de bloques de ejecución */}
            <div
              className="g-track"
              style={{ backgroundSize: `${100 / M}% 100%` }}
            >
              {cycleDividers.map((k) => (
                <div
                  key={k}
                  className="g-cycle"
                  style={{ left: `${(k / M) * 100}%` }}
                  title={`Inicio del ciclo ${k / config.cycle + 1}`}
                />
              ))}

              {segs.map((s, i) => {
                const isIdle = s.pid === null;
                const col = isIdle ? null : (processColors.get(s.pid) || { bg: '#6b7280', fg: '#fff' });
                const isLive = i === segs.length - 1 && cursor < simResult.ticks.length;
                const leftPct = (s.start / M) * 100;
                const widthPct = ((s.end - s.start) / M) * 100;

                return (
                  <div
                    key={`${s.start}-${s.pid || 'idle'}-${i}`}
                    className={`g-block ${isIdle ? 'idle' : ''} ${isLive ? 'live' : ''}`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: col ? col.bg : '',
                      color: col ? col.fg : ''
                    }}
                    title={
                      isIdle
                        ? `CPU ociosa · t=${s.start}→${s.end}`
                        : `${s.pid} · cola ${queueName(config, s.queue)} · t=${s.start}→${s.end}`
                    }
                  >
                    {isIdle ? 'ocio' : s.pid}
                  </div>
                );
              })}

              {finMarks.map((m) => (
                <span
                  key={m.key}
                  className="g-mark fin"
                  style={{ left: `${(m.t / M) * 100}%` }}
                  title={m.title}
                >
                  ✔
                </span>
              ))}
            </div>

            {/* Eje de tiempo con ticks */}
            <div className="g-axis">
              {axisTicks.map((t) => (
                <span
                  key={t}
                  className="g-tick"
                  style={{ left: `${(t / M) * 100}%` }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
