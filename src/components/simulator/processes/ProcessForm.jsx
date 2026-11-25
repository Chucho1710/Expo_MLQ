import React, { useState } from 'react';
import { queueName, queuePriorityLabel } from '../../../engine/mlqEngine.js';

export default function ProcessForm({
  config,
  processes,
  nextPlaceholderId,
  onAddProcess,
  toast
}) {
  const [formId, setFormId] = useState('');
  const [formArrival, setFormArrival] = useState('0');
  const [formBurst, setFormBurst] = useState('3');
  const [formQueue, setFormQueue] = useState('1');
  const [formMsg, setFormMsg] = useState('');

  const totalQueues = config.queues.length;

  const handleSubmit = (e) => {
    e.preventDefault();
    const idRaw = formId.trim() || nextPlaceholderId;
    const arrival = Number(formArrival);
    const burst = Number(formBurst);
    const queue = Number(formQueue);

    let err = '';
    if (!/^[A-Za-z0-9_-]{1,8}$/.test(idRaw)) {
      err = 'El identificador debe tener 1 a 8 caracteres (letras, números, guion).';
    } else if (processes.some((p) => p.id.toLowerCase() === idRaw.toLowerCase())) {
      err = `Ya existe un proceso llamado ${idRaw}.`;
    } else if (!Number.isInteger(arrival) || arrival < 0 || arrival > 1000) {
      err = 'El tiempo de llegada debe ser un entero entre 0 y 1000.';
    } else if (!Number.isInteger(burst) || burst < 1 || burst > 1000) {
      err = 'La ráfaga debe ser un entero entre 1 y 1000.';
    } else if (!Number.isInteger(queue) || queue < 0 || queue >= totalQueues) {
      err = 'Cola seleccionada inválida.';
    } else if (processes.length >= 30) {
      err = 'Máximo 30 procesos para mantener la simulación legible.';
    }

    setFormMsg(err);
    if (err) return;

    onAddProcess({ id: idRaw, arrival, burst, queue });
    setFormId('');
    toast(`Proceso ${idRaw} agregado a la cola ${queueName(config, queue)}.`);
  };

  return (
    <>
      <form className="proc-form" onSubmit={handleSubmit} autoComplete="off" noValidate>
        <label>
          Proceso
          <input
            type="text"
            maxLength="8"
            placeholder={nextPlaceholderId}
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
          />
        </label>
        <label>
          Llegada
          <input
            type="number"
            min="0"
            max="1000"
            step="1"
            value={formArrival}
            onChange={(e) => setFormArrival(e.target.value)}
            required
          />
        </label>
        <label>
          Ráfaga (CPU burst)
          <input
            type="number"
            min="1"
            max="1000"
            step="1"
            value={formBurst}
            onChange={(e) => setFormBurst(e.target.value)}
            required
          />
        </label>
        <label>
          Cola
          <select value={formQueue} onChange={(e) => setFormQueue(e.target.value)}>
            {config.queues.map((_, i) => (
              <option key={i} value={i}>
                Cola {i + 1} · {queueName(config, i)} ({queuePriorityLabel(i, totalQueues).toLowerCase()})
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" type="submit">
          Agregar proceso
        </button>
      </form>
      {formMsg && <p className="form-msg" role="alert" aria-live="polite">{formMsg}</p>}
    </>
  );
}
