import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function QueueProcessItem({ process, color, onDelete }) {
  const { lang } = useLanguage();
  const en = lang === 'en';

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
            {en ? 'Arrival:' : 'Llegada:'} <strong>t={process.arrival}</strong>
          </span>
          <span className="qcard-proc-tag">
            {en ? 'Burst:' : 'Ráfaga:'} <strong>{process.burst} u</strong>
          </span>
        </div>
      </div>
      <button
        className="qtool qdel"
        type="button"
        title={en ? `Delete ${process.id}` : `Eliminar ${process.id}`}
        aria-label={en ? `Delete process ${process.id}` : `Eliminar proceso ${process.id}`}
        onClick={() => onDelete(process.id)}
      >
        ✕
      </button>
    </div>
  );
}
