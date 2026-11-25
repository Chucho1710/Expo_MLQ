import React from 'react';

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

export default function ExplainPanel({ currentSnapshot }) {
  const snap = currentSnapshot;

  return (
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
  );
}
