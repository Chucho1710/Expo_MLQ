import React, { useRef, useEffect } from 'react';

const ICONS = {
  cycle: '↻',
  arrival: '➜',
  finish: '✔',
  queue: '◆',
  dispatch: '▶',
  quantum: '⏱',
  preempt: '⚡',
  context: '⇄',
  idle: '…',
  info: 'ℹ',
  wait: '⏳'
};

export default function ExplainAndLog({ currentSnapshot, simResult, cursor }) {
  const logRef = useRef(null);
  const snap = currentSnapshot;

  const events =
    simResult && cursor >= 0
      ? simResult.snapshots.slice(0, cursor + 1).flatMap((s) => s.events)
      : [];

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="two-col">
      {/* Panel 7 · ¿Qué está pasando? */}
      <div className="panel explain-panel" id="panel-explica">
        <div className="panel-head">
          <h3>7 · ¿Qué está pasando?</h3>
          <span className="time-pill" id="explain-time">
            {snap ? `Tiempo ${snap.t}` : '—'}
          </span>
        </div>
        <div id="explain" className="explain">
          {!snap ? (
            <p className="explain-intro">
              Pulsa <strong>Iniciar simulación</strong> para ver la ejecución automática, o{' '}
              <strong>Siguiente paso</strong> para avanzar una unidad de tiempo y leer aquí, en
              lenguaje sencillo, por qué el planificador toma cada decisión.
            </p>
          ) : (
            snap.explain.map((l, idx) => (
              <div key={idx} className={`ex-line t-${l.type}`}>
                <span className="ico" aria-hidden="true">
                  {ICONS[l.type] || '•'}
                </span>
                <span>{l.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Panel 8 · Registro de eventos */}
      <div className="panel log-panel" id="panel-log">
        <div className="panel-head">
          <h3>8 · Registro de eventos</h3>
          <span className="time-pill" id="log-count">
            {events.length} evento{events.length === 1 ? '' : 's'}
          </span>
        </div>
        <ol id="log" className="log" ref={logRef}>
          {events.map((e, idx) => (
            <li key={idx} className={`e-${e.type}`}>
              <span className="lt">Tiempo {e.t}:</span>
              <span className="li" aria-hidden="true">
                {ICONS[e.type] || '•'}
              </span>
              <span>{e.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
