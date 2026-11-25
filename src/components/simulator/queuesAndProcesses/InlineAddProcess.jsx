import React, { useState } from 'react';

export default function InlineAddProcess({
  queueIndex,
  queueName,
  nextPlaceholderId,
  processes,
  onAddProcess,
  onCancel,
  toast
}) {
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
      setErr('ID: 1-8 letras, números o guion.');
      return;
    }
    if (processes.some((p) => p.id.toLowerCase() === idRaw.toLowerCase())) {
      setErr(`Ya existe el proceso ${idRaw}.`);
      return;
    }
    if (!Number.isInteger(arr) || arr < 0 || arr > 1000) {
      setErr('Llegada debe ser entero >= 0.');
      return;
    }
    if (!Number.isInteger(bst) || bst < 1 || bst > 1000) {
      setErr('Ráfaga debe ser entero >= 1.');
      return;
    }
    if (processes.length >= 30) {
      setErr('Máximo 30 procesos.');
      return;
    }

    setErr('');
    onAddProcess({ id: idRaw, arrival: arr, burst: bst, queue: queueIndex });
    toast(`Proceso ${idRaw} añadido a ${queueName}.`);
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
          Llegada
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
          Ráfaga
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
          + Añadir a esta cola
        </button>
        <button
          className="btn btn-small btn-outline"
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
