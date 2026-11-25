import React, { useRef, useEffect, useState } from 'react';
import { queueName, queuePalette, getProcessColors } from '../../../engine/mlqEngine.js';

function computeSegs(ticks) {
  const segs = [];
  ticks.forEach((tk) => {
    const last = segs[segs.length - 1];
    if (tk.interrupt) {
      if (last && last.isInterrupt && last.interrupt === tk.interrupt && last.end === tk.t) {
        last.end = tk.t + 1;
      } else {
        segs.push({
          isInterrupt: true,
          interrupt: tk.interrupt,
          interruptLabel: tk.interruptLabel,
          pid: null,
          queue: null,
          start: tk.t,
          end: tk.t + 1
        });
      }
    } else if (last && !last.isInterrupt && last.pid === tk.pid && !tk.dispatch && last.end === tk.t) {
      last.end = tk.t + 1;
    } else {
      segs.push({ pid: tk.pid, queue: tk.queue, start: tk.t, end: tk.t + 1 });
    }
  });
  return segs;
}

/**
 * Bloque vivo (el último segmento, el que está creciendo).
 * Se monta con width=0 y en el siguiente frame de animación se anima
 * hasta su ancho real, para que la transición CSS funcione correctamente
 * sin que los bloques ya terminados también animen al entrar al DOM.
 */
function LiveBlock({ seg, widthPct, leftPct, col, isIdle, config, ganttMs }) {
  const [w, setW] = useState(0);
  const keyRef = useRef(null);
  const isIrq = Boolean(seg.isInterrupt);
  const segKey = `${seg.start}-${isIrq ? seg.interrupt : (seg.pid || 'idle')}`;

  useEffect(() => {
    // Si el segmento cambió (nuevo proceso / nuevo idle), resetear a 0 primero
    if (keyRef.current !== segKey) {
      keyRef.current = segKey;
      setW(0);
      // Doble rAF garantiza que el navegador pinte width=0 antes de iniciar la transición CSS
      let id2 = 0;
      const id1 = requestAnimationFrame(() => {
        id2 = requestAnimationFrame(() => setW(widthPct));
      });
      return () => {
        cancelAnimationFrame(id1);
        cancelAnimationFrame(id2);
      };
    } else {
      // Mismo segmento creciendo: actualizar el ancho directamente
      setW(widthPct);
    }
  }, [segKey, widthPct]);

  return (
    <div
      key={segKey}
      className={`g-block live ${isIrq ? 'interrupt' : isIdle ? 'idle' : ''}`}
      style={{
        left: `${leftPct}%`,
        width: `${w}%`,
        '--gdur': `${ganttMs || 400}ms`,
        background: col ? col.bg : '',
        color: col ? col.fg : ''
      }}
      title={
        isIrq
          ? `Interrupción externa ${seg.interruptLabel} · t=${seg.start}→${seg.end}`
          : isIdle
            ? `CPU ociosa · t=${seg.start}→${seg.end}`
            : `${seg.pid} · cola ${queueName(config, seg.queue)} · t=${seg.start}→${seg.end}`
      }
    >
      {isIrq ? `⚡ ${seg.interruptLabel}` : isIdle ? 'ocio' : seg.pid}
    </div>
  );
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
  const prevCursorRef = useRef(-1);
  const processColors = getProcessColors(processes, config);
  const M = simResult ? simResult.makespan : 0;
  const isPercent = config.policy === 'percent';

  useEffect(() => {
    if (scrollRef.current && M > 0 && cursor >= 0) {
      // Only scroll when cursor actually advances (not on re-renders due to state updates)
      if (cursor === prevCursorRef.current) return;
      prevCursorRef.current = cursor;

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
            <span><i className="lg lg-int" /> interrupción externa</span>
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

  const step = Math.max(1, Math.ceil(M / 30));
  const axisTicks = [];
  for (let i = 0; i < M; i += step) axisTicks.push(i);
  if (!axisTicks.includes(M)) axisTicks.push(M);

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
          <span><i className="lg lg-int" /> interrupción externa</span>
          <span><b className="mk mk-fin">✔</b> finalización</span>
        </div>
      </div>

      <div className="gantt" id="gantt" style={{ '--gdur': `${ganttMs}ms` }}>
        <div className="g-scroll" ref={scrollRef}>
          <div className="g-inner" style={{ minWidth: `${Math.max(600, M * 26)}px` }}>
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
                const isIrq = Boolean(s.isInterrupt);
                const isIdle = !isIrq && s.pid === null;
                const col = (isIrq || isIdle) ? null : (processColors.get(s.pid) || { bg: '#6b7280', fg: '#fff' });
                const isLive = i === segs.length - 1 && cursor < simResult.ticks.length;
                const leftPct = (s.start / M) * 100;
                const widthPct = ((s.end - s.start) / M) * 100;

                if (isLive) {
                  return (
                    <LiveBlock
                      key={`${s.start}-${isIrq ? s.interrupt : (s.pid || 'idle')}-live`}
                      seg={s}
                      widthPct={widthPct}
                      leftPct={leftPct}
                      col={col}
                      isIdle={isIdle}
                      config={config}
                      ganttMs={ganttMs}
                    />
                  );
                }

                return (
                  <div
                    key={`${s.start}-${isIrq ? s.interrupt : (s.pid || 'idle')}-${i}`}
                    className={`g-block ${isIrq ? 'interrupt' : isIdle ? 'idle' : ''}`}
                    style={{
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      background: col ? col.bg : '',
                      color: col ? col.fg : ''
                    }}
                    title={
                      isIrq
                        ? `Interrupción externa ${s.interruptLabel} · t=${s.start}→${s.end}`
                        : isIdle
                          ? `CPU ociosa · t=${s.start}→${s.end}`
                          : `${s.pid} · cola ${queueName(config, s.queue)} · t=${s.start}→${s.end}`
                    }
                  >
                    {isIrq ? `⚡ ${s.interruptLabel}` : isIdle ? 'ocio' : s.pid}
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
