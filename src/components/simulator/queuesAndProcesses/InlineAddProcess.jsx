import React, { useState } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function InlineAddProcess({
  queueIndex,
  queueName,
  nextPlaceholderId,
  processes,
  onAddProcess,
  onCancel,
  toast
}) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [id, setId] = useState('');
  const [arrival, setArrival] = useState('0');
  const [burst, setBurst] = useState('3');
  const [err, setErr] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const idRaw = id.trim() || nextPlaceholderId;
    const arr = Number(arrival);
    const bst = Number(burst);

    if (!/^[A-Za-z0-9_-]{1,8}$/.test(idRaw)) {
      setErr(en ? 'ID: 1-8 letters, numbers, or hyphen.' : 'ID: 1-8 letras, números o guion.');
      return;
    }
    if (processes.some((p) => p.id.toLowerCase() === idRaw.toLowerCase())) {
      setErr(en ? `Process ${idRaw} already exists.` : `Ya existe el proceso ${idRaw}.`);
      return;
    }
    if (!Number.isInteger(arr) || arr < 0 || arr > 1000) {
      setErr(en ? 'Arrival must be an integer >= 0.' : 'Llegada debe ser entero >= 0.');
      return;
    }
    if (!Number.isInteger(bst) || bst < 1 || bst > 1000) {
      setErr(en ? 'Burst must be an integer >= 1.' : 'Ráfaga debe ser entero >= 1.');
      return;
    }
    if (processes.length >= 30) {
      setErr(en ? 'Maximum 30 processes.' : 'Máximo 30 procesos.');
      return;
    }

    setErr('');
    onAddProcess({ id: idRaw, arrival: arr, burst: bst, queue: queueIndex });
    toast(en ? `Process ${idRaw} added to ${queueName}.` : `Proceso ${idRaw} añadido a ${queueName}.`);
    onCancel();
  };

  return (
    <form className="inline-proc-form" onSubmit={handleSubmit}>
      <div className="inline-proc-grid">
        <label>
          ID
          <input
            type="text"
            maxLength="8"
            placeholder={nextPlaceholderId}
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
        </label>
        <label>
          {en ? 'Arrival' : 'Llegada'}
          <input
            type="number"
            min="0"
            max="1000"
            step="1"
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            required
          />
        </label>
        <label>
          {en ? 'Burst' : 'Ráfaga'}
          <input
            type="number"
            min="1"
            max="1000"
            step="1"
            value={burst}
            onChange={(e) => setBurst(e.target.value)}
            required
          />
        </label>
      </div>

      {err && <span className="inline-err">{err}</span>}

      <div className="inline-proc-actions">
        <button className="btn btn-small btn-primary" type="submit">
          {en ? '+ Add to this queue' : '+ Añadir a esta cola'}
        </button>
        <button
          className="btn btn-small btn-outline"
          type="button"
          onClick={onCancel}
        >
          {en ? 'Cancel' : 'Cancelar'}
        </button>
      </div>
    </form>
  );
}
