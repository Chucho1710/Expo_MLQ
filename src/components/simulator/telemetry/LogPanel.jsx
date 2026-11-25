import React, { useRef, useEffect } from 'react';

const ICONS = {
  cycle: '↻',
  arrival: '➜',
  finish: '✔',
  queue: '◆',
  dispatch: '▶',
  quantum: '⏱',
  preempt: '⚡',
  interrupt: '⚡',
  interrupt_end: '✓',
  context: '⇄',
  idle: '…',
  info: 'ℹ',
  wait: '⏳'
};

export default function LogPanel({ events }) {
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
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
  );
}
