import React, { useState } from 'react';
import {
  ALGORITHMS,
  MAX_QUEUES,
  queueName,
  queueDescription,
  queuePriorityLabel,
  queuePalette,
  allocateQuotas,
  validateConfig
} from '../engine/mlqEngine.js';

function rebalancePercentAdd(pctArr, newLen) {
  const sum = pctArr.reduce((a, b) => a + b, 0);
  const validExisting = pctArr.length === newLen - 1 && sum === 100 && pctArr.every((v) => Number.isInteger(v) && v >= 1);
  if (!validExisting) {
    pctArr.push(Math.max(1, Math.floor(100 / newLen)));
    return;
  }
  const surplus = pctArr.reduce((s, v) => s + Math.max(0, v - 1), 0);
  const share = Math.min(10, Math.floor(100 / newLen), surplus);
  if (share < 1) {
    pctArr.push(1);
    return;
  }
  let need = share;
  while (need > 0) {
    let best = -1;
    for (let i = 0; i < pctArr.length; i++) {
      if (pctArr[i] > 1 && (best === -1 || pctArr[i] > pctArr[best])) best = i;
    }
    if (best === -1) break;
    pctArr[best]--;
    need--;
  }
  pctArr.push(share);
}

function rebalancePercentRemove(pctArr, idx) {
  const oldSum = pctArr.reduce((a, b) => a + b, 0);
  const removed = pctArr.splice(idx, 1)[0] || 0;
  if (pctArr.length && oldSum === 100 && pctArr.every((v) => Number.isInteger(v) && v >= 1)) {
    pctArr[0] += removed;
  }
}

export default function QueueConfigPanel({
  config,
  processes,
  currentSnapshot,
  onChangeConfig,
  onResetConfig,
  toast
}) {
  const [newQueueName, setNewQueueName] = useState('');
  const [newQueueAlg, setNewQueueAlg] = useState('RR');
  const [newQueueQuantum, setNewQueueQuantum] = useState(2);
  const [formMsg, setFormMsg] = useState('');

  const total = config.queues.length;
  const isPercent = config.policy === 'percent';
  const minCycle = Math.max(3, total);
  const maxPct = total === 1 ? 100 : 100 - (total - 1);
  const sumPct = config.percent.reduce((a, b) => a + b, 0);

  const policyErrors = isPercent ? validateConfig(config) : [];
  const validQuotas = isPercent && policyErrors.length === 0 ? allocateQuotas(config.percent, config.cycle) : null;

  const handlePolicyChange = (policy) => {
    onChangeConfig({ ...config, policy });
  };

  const handleCycleChange = (e) => {
    const v = Number(e.target.value);
    if (!Number.isInteger(v) || v < minCycle || v > 100) {
      toast(`El ciclo debe ser un entero entre ${minCycle} y 100 unidades.`);
      return;
    }
    onChangeConfig({ ...config, cycle: v });
  };

  const handleQueueNameChange = (idx, value) => {
    const val = value.trim();
    if (!val) {
      toast('El nombre de la cola no puede estar vacío.');
      return;
    }
    if (config.queues.some((_, j) => j !== idx && queueName(config, j).toLowerCase() === val.toLowerCase())) {
      toast(`Ya existe una cola llamada "${val}".`);
      return;
    }
    const nextQueues = config.queues.map((q, i) => (i === idx ? { ...q, name: val } : q));
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleQueueAlgChange = (idx, algKey) => {
    const nextQueues = config.queues.map((q, i) => (i === idx ? { ...q, algorithm: algKey } : q));
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleQueueQuantumChange = (idx, value) => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1) {
      toast('El quantum debe ser un número entero mayor o igual a 1.');
      return;
    }
    const nextQueues = config.queues.map((q, i) => (i === idx ? { ...q, quantum: v } : q));
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleQueuePctChange = (idx, value) => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1 || v > maxPct) {
      toast(`El porcentaje debe ser un entero entre 1 y ${maxPct}.`);
      return;
    }
    const nextPct = [...config.percent];
    nextPct[idx] = v;
    onChangeConfig({ ...config, percent: nextPct });
  };

  const moveQueue = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= total) return;
    const nextQueues = [...config.queues];
    [nextQueues[idx], nextQueues[target]] = [nextQueues[target], nextQueues[idx]];
    const nextPct = [...config.percent];
    [nextPct[idx], nextPct[target]] = [nextPct[target], nextPct[idx]];

    // Reasignar colas de los procesos para que sigan a su cola
    const nextProcs = processes.map((p) => {
      if (p.queue === idx) return { ...p, queue: target };
      if (p.queue === target) return { ...p, queue: idx };
      return p;
    });

    onChangeConfig({ ...config, queues: nextQueues, percent: nextPct }, nextProcs);
  };

  const removeQueue = (idx) => {
    if (total <= 1) {
      toast('Debe haber al menos una cola en el sistema.');
      return;
    }
    const name = queueName(config, idx);
    const nextQueues = config.queues.filter((_, i) => i !== idx);
    const nextPct = [...config.percent];
    rebalancePercentRemove(nextPct, idx);

    // Ajustar cola de los procesos
    let reassigned = 0;
    const nextProcs = processes.map((p) => {
      if (p.queue === idx) {
        reassigned++;
        return { ...p, queue: Math.min(idx, nextQueues.length - 1) };
      }
      if (p.queue > idx) {
        return { ...p, queue: p.queue - 1 };
      }
      return p;
    });

    toast(
      reassigned
        ? `Cola "${name}" eliminada (${reassigned} proceso(s) reasignados).`
        : `Cola "${name}" eliminada.`
    );
    onChangeConfig({ ...config, queues: nextQueues, percent: nextPct }, nextProcs);
  };

  const handleAddQueue = (e) => {
    e.preventDefault();
    if (total >= MAX_QUEUES) {
      setFormMsg(`Máximo ${MAX_QUEUES} colas permitidas.`);
      return;
    }
    const name = newQueueName.trim() || `Cola ${total + 1}`;
    if (config.queues.some((_, i) => queueName(config, i).toLowerCase() === name.toLowerCase())) {
      setFormMsg(`Ya existe una cola llamada "${name}".`);
      return;
    }
    const alg = ALGORITHMS[newQueueAlg];
    const quantum = alg.usesQuantum ? Number(newQueueQuantum) : 4;
    if (alg.usesQuantum && (!Number.isInteger(quantum) || quantum < 1 || quantum > 99)) {
      setFormMsg('El quantum debe ser un entero entre 1 y 99.');
      return;
    }

    setFormMsg('');
    const nextQueues = [
      ...config.queues,
      {
        name,
        description: `Cola de prioridad nivel ${total + 1}.`,
        algorithm: newQueueAlg,
        quantum
      }
    ];
    const nextPct = [...config.percent];
    rebalancePercentAdd(nextPct, nextQueues.length);

    setNewQueueName('');
    setNewQueueQuantum(2);
    toast(`Cola "${name}" agregada con prioridad nivel ${nextQueues.length}.`);
    onChangeConfig({ ...config, queues: nextQueues, percent: nextPct });
  };

  return (
    <div className={`panel ${isPercent ? 'percent-on' : ''}`} id="panel-config">
      <div className="panel-head">
        <h3>1 · Configuración de las colas</h3>
        <button className="btn btn-small btn-outline" type="button" onClick={onResetConfig}>
          Restaurar configuración
        </button>
      </div>

      <p className="hint">
        Elige cómo se reparte la CPU <strong>entre</strong> las colas y, para cada cola, qué algoritmo usa <strong>por dentro</strong>.
        La prioridad va de <strong>Cola 1 (más alta)</strong> hacia abajo; puedes conservar las 3 colas básicas, editarlas, reordenarlas o agregar más colas.
      </p>

      <div className="policy">
        <div className="policy-opts" role="radiogroup" aria-label="Política de planificación entre colas">
          <label className="policy-opt">
            <input
              type="radio"
              name="policy"
              value="priority"
              checked={!isPercent}
              onChange={() => handlePolicyChange('priority')}
            />
            <span>
              <b>Prioridad fija</b>
              <small>
                La CPU es siempre de la cola de mayor prioridad con procesos listos. Es apropiativa: si llega un proceso a una cola superior, interrumpe al actual.
              </small>
            </span>
          </label>
          <label className="policy-opt">
            <input
              type="radio"
              name="policy"
              value="percent"
              checked={isPercent}
              onChange={() => handlePolicyChange('percent')}
            />
            <span>
              <b>Porcentajes de CPU</b>
              <small>
                El tiempo se divide en ciclos y cada cola recibe un porcentaje. Ninguna cola se queda sin CPU, pero las de menor prioridad ya no esperan indefinidamente.
              </small>
            </span>
          </label>
        </div>

        {isPercent && (
          <div className="policy-extra">
            <label className="cycle-field">
              Duración del ciclo (unidades)
              <input
                id="cycle"
                type="number"
                min={minCycle}
                max="100"
                step="1"
                value={config.cycle}
                onChange={handleCycleChange}
              />
            </label>
            <div className={`pct-sum ${sumPct !== 100 ? 'bad' : ''}`} aria-live="polite">
              Suma: {sumPct} %
            </div>
            <p className="hint small" style={{ margin: 0, flex: '1 1 280px' }}>
              En cada ciclo, cada cola usa su cuota por orden de prioridad (Cola 1, Cola 2, …, Cola N). Si una cola está vacía, su tiempo lo aprovechan las demás: la CPU no se desperdicia.
            </p>
          </div>
        )}

        {policyErrors.length > 0 && (
          <p className="form-msg" role="alert" aria-live="polite">
            {policyErrors.join(' ')}
          </p>
        )}
      </div>

      {/* Formulario para agregar colas */}
      <form className="queue-form" onSubmit={handleAddQueue} autoComplete="off" noValidate>
        <label>
          Nueva cola
          <input
            type="text"
            maxLength="24"
            placeholder={`Cola ${total + 1}`}
            value={newQueueName}
            onChange={(e) => setNewQueueName(e.target.value)}
          />
        </label>
        <label>
          Algoritmo interno
          <select value={newQueueAlg} onChange={(e) => setNewQueueAlg(e.target.value)}>
            <option value="FCFS">FCFS (First Come, First Served)</option>
            <option value="SJF">SJF (Shortest Job First)</option>
            <option value="SRTF">SRTF (Shortest Remaining Time First)</option>
            <option value="RR">Round Robin (RR)</option>
          </select>
        </label>
        {ALGORITHMS[newQueueAlg]?.usesQuantum && (
          <label>
            Quantum
            <input
              type="number"
              min="1"
              max="99"
              step="1"
              value={newQueueQuantum}
              onChange={(e) => setNewQueueQuantum(e.target.value)}
            />
          </label>
        )}
        <button className="btn btn-primary" type="submit">
          + Agregar cola
        </button>
      </form>
      {formMsg && <p className="form-msg" role="alert" aria-live="polite">{formMsg}</p>}

      {/* Lista de tarjetas de configuración de cada cola */}
      <div className="queue-config">
        {config.queues.map((cfg, i) => {
          const name = queueName(config, i);
          const desc = queueDescription(config, i);
          const pal = queuePalette(i);
          const alg = ALGORITHMS[cfg.algorithm] || ALGORITHMS.FCFS;
          const pendingCount = currentSnapshot
            ? currentSnapshot.pending[i]
            : processes.filter((p) => p.queue === i).length;
          const quota = validQuotas ? validQuotas[i] : null;

          return (
            <article
              key={i}
              className={`qcard q${i}`}
              style={{ '--q-color': pal.base, '--q-soft': pal.soft }}
            >
              <header>
                <div className="qhead-main">
                  <div className="qlevel">Cola {i + 1}</div>
                  <input
                    className="qname-input"
                    type="text"
                    maxLength="24"
                    defaultValue={name}
                    key={name}
                    onBlur={(e) => handleQueueNameChange(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.target.blur();
                    }}
                    aria-label={`Nombre de la cola ${i + 1}`}
                    title="Haz clic para editar el nombre de la cola"
                  />
                </div>
                <div className="qcard-tools">
                  <span className="prio-pill" title={`Prioridad nivel ${i + 1} de ${total}`}>
                    {queuePriorityLabel(i, total)}
                  </span>
                  <button
                    className="qtool"
                    type="button"
                    title="Subir prioridad"
                    aria-label={`Subir prioridad de ${name}`}
                    disabled={i === 0}
                    onClick={() => moveQueue(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="qtool"
                    type="button"
                    title="Bajar prioridad"
                    aria-label={`Bajar prioridad de ${name}`}
                    disabled={i === total - 1}
                    onClick={() => moveQueue(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="qtool qdel"
                    type="button"
                    title={`Eliminar ${name}`}
                    aria-label={`Eliminar cola ${name}`}
                    disabled={total <= 1}
                    onClick={() => removeQueue(i)}
                  >
                    ✕
                  </button>
                </div>
              </header>

              <p className="qdesc">{desc}</p>

              <label className="qfield">
                Algoritmo interno
                <select
                  value={cfg.algorithm}
                  onChange={(e) => handleQueueAlgChange(i, e.target.value)}
                  aria-label={`Algoritmo de la cola ${name}`}
                >
                  {Object.keys(ALGORITHMS).map((k) => (
                    <option key={k} value={k}>
                      {ALGORITHMS[k].label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="qmeta">
                <span className="lane-tag">Modalidad:</span>
                <span className={`mod-badge ${alg.modality.startsWith('Apropiativo') ? 'pre' : ''}`}>
                  {alg.modality}
                </span>
              </div>

              <p className="alg-note">{alg.note}</p>

              {isPercent && (
                <label className="qfield qpct">
                  % de la CPU
                  <input
                    type="number"
                    min="1"
                    max={maxPct}
                    step="1"
                    value={config.percent[i] ?? ''}
                    onChange={(e) => handleQueuePctChange(i, e.target.value)}
                  />
                  <span className="qquota">
                    {quota !== null && (
                      <>
                        Cuota: <b>{quota}</b> de {config.cycle} unidades por ciclo
                      </>
                    )}
                  </span>
                </label>
              )}

              {alg.usesQuantum && (
                <label className="qfield">
                  Quantum (unidades de tiempo)
                  <input
                    type="number"
                    min="1"
                    max="99"
                    step="1"
                    value={cfg.quantum}
                    onChange={(e) => handleQueueQuantumChange(i, e.target.value)}
                  />
                </label>
              )}

              <div className="qpending">
                Procesos pendientes: <b>{pendingCount}</b>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
