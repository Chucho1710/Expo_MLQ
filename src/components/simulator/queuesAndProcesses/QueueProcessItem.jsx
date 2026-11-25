import React from 'react';

export default function QueueProcessItem({ process, color, onDelete }) {
  return (
    <div className="qcard-proc-item">
      <div className="qcard-proc-left">
        <span
          className="qcard-proc-badge"
          style={{ background: color.bg, color: color.fg }}
        >
          {process.id}
        </span>
        <div className="qcard-proc-info">
          <span className="qcard-proc-tag">
            Llegada: <strong>t={process.arrival}</strong>
          </span>
          <span className="qcard-proc-tag">
            Ráfaga: <strong>{process.burst} u</strong>
          </span>
        </div>
      </div>
      <button
        className="qtool qdel"
        type="button"
        title={`Eliminar ${process.id}`}
        aria-label={`Eliminar proceso ${process.id}`}
        onClick={() => onDelete(process.id)}
      >
        ✕
      </button>
    </div>
  );
}
