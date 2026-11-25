import React from 'react';
import { queueName } from '../../../engine/mlqEngine.js';

export default function ProcessCard({ process, config, color, onDelete }) {
  return (
    <div className="pcard">
      <div
        className="pbadge"
        style={{ background: color.bg, color: color.fg }}
      >
        {process.id}
      </div>
      <div className="pname">Proceso {process.id}</div>
      <div className="pdata">
        llegada {process.arrival} · ráfaga {process.burst}
      </div>
      <div className="pq">
        Cola {queueName(config, process.queue)}
      </div>
      <button
        className="pdel"
        type="button"
        title={`Eliminar ${process.id}`}
        aria-label={`Eliminar ${process.id}`}
        onClick={() => onDelete(process.id)}
      >
        ✕
      </button>
    </div>
  );
}
