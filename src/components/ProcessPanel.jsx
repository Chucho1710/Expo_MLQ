import React, { useState } from 'react';
import {
  SCENARIOS,
  queueName,
  queuePriorityLabel,
  getProcessColors
} from '../engine/mlqEngine.js';

export default function ProcessPanel({
  processes,
  config,
  onProcessesChange,
  onLoadScenario,
  onClearProcesses,
  toast
}) {
  const [formId, setFormId] = useState('');
  const [formArrival, setFormArrival] = useState('0');
  const [formBurst, setFormBurst] = useState('3');
  const [formQueue, setFormQueue] = useState('1');
  const [formMsg, setFormMsg] = useState('');

  const nextId = () => {
    let max = 0;
    processes.forEach((p) => {
      const m = /^P(\d+)$/i.exec(p.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `P${max + 1}`;
  };

  const processColors = getProcessColors(processes, config);

  const handleAddProcess = (e) => {
    e.preventDefault();
    const idRaw = formId.trim() || nextId();
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
    } else if (!Number.isInteger(queue) || queue < 0 || queue >= config.queues.length) {
      err = 'Cola seleccionada inválida.';
    } else if (processes.length >= 30) {
      err = 'Máximo 30 procesos para mantener la simulación legible.';
    }

    setFormMsg(err);
    if (err) return;

    const next = [...processes, { id: idRaw, arrival, burst, queue }];
    onProcessesChange(next);
    setFormId('');
    toast(`Proceso ${idRaw} agregado a la cola ${queueName(config, queue)}.`);
  };

  const handleDeleteProcess = (id) => {
    const next = processes.filter((p) => p.id !== id);
    onProcessesChange(next);
    toast(`Proceso ${id} eliminado.`);
  };

  const totalQueues = config.queues.length;

  return (
    <div className="panel" id="panel-procesos">
      <div className="panel-head">
        <h3>2 · Procesos</h3>
        <div className="btn-row">
          <button
            className="btn btn-small btn-primary"
            type="button"
            onClick={() => onLoadScenario('base')}
          >
            Cargar escenario base
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={() => onLoadScenario('interrupciones')}
          >
            Escenario con interrupciones
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={() => onLoadScenario('multicola')}
          >
            Escenario 5 colas
          </button>
          <button
            className="btn btn-small btn-outline"
            type="button"
            onClick={onClearProcesses}
          >
            Vaciar
          </button>
        </div>
      </div>

      <form className="proc-form" onSubmit={handleAddProcess} autoComplete="off" noValidate>
        <label>
          Proceso
          <input
            type="text"
            maxLength="8"
            placeholder={nextId()}
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

      <div className="proc-list">
        {processes.map((p) => {
          const col = processColors.get(p.id) || { bg: '#1e293b', fg: '#fff' };
          return (
            <div key={p.id} className="pcard">
              <div
                className="pbadge"
                style={{ background: col.bg, color: col.fg }}
              >
                {p.id}
              </div>
              <div className="pname">Proceso {p.id}</div>
              <div className="pdata">
                llegada {p.arrival} · ráfaga {p.burst}
              </div>
              <div className="pq">
                Cola {queueName(config, p.queue)}
              </div>
              <button
                className="pdel"
                type="button"
                title={`Eliminar ${p.id}`}
                aria-label={`Eliminar ${p.id}`}
                onClick={() => handleDeleteProcess(p.id)}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
