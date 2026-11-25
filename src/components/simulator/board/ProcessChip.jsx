import React from 'react';

const STATE_LABEL = {
  new: 'Nuevo',
  ready: 'Listo',
  running: 'Ejecutando',
  interrupted: 'Interrumpido',
  done: 'Finalizado'
};

export default function ProcessChip({ proc, color, finishTime }) {
  if (!proc) return null;

  const dataText =
    proc.state === 'new'
      ? `llega t=${proc.arrival} · ráf ${proc.burst}`
      : proc.state === 'done'
      ? `fin t=${finishTime !== undefined ? finishTime : '?'}`
      : `resta ${proc.remaining}/${proc.burst}`;

  const executedPct = (proc.executed / proc.burst) * 100;

  return (
    <div
      className={`proc-chip st-${proc.state}`}
      data-pid={proc.id}
      style={{
        background: color.bg,
        color: color.fg,
        borderColor: 'rgba(0,0,0,.35)'
      }}
      title={`${proc.id} · llegada ${proc.arrival} · ráfaga ${proc.burst} · restante ${proc.remaining} · ${STATE_LABEL[proc.state]}`}
    >
      <div className="pc-top">
        <span className="pc-id">{proc.id}</span>
        <span className="pc-st">{STATE_LABEL[proc.state]}</span>
      </div>
      <div className="pc-data">{dataText}</div>
      <div className="pc-bar">
        <i style={{ width: `${executedPct}%` }} />
      </div>
    </div>
  );
}
