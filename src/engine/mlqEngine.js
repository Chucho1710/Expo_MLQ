/* =====================================================================
   MLQ — Motor de Planificación por Colas Multinivel (Pure Engine)
   ===================================================================== */

/** Las tres colas básicas por defecto. El índice (id) es su prioridad: 0 es la más alta. */
export const QUEUES = [
  { id: 0, name: 'Sistema',     priority: 'ALTA',  level: 1, description: 'Procesos esenciales del sistema operativo.' },
  { id: 1, name: 'Interactiva', priority: 'MEDIA', level: 2, description: 'Aplicaciones con las que interactúa el usuario.' },
  { id: 2, name: 'Batch',       priority: 'BAJA',  level: 3, description: 'Procesos por lotes y tareas en segundo plano.' }
];

export const QUEUE_PALETTE = [
  { base: '#7a0c1e', soft: '#fcf4f5', shades: ['#7a0c1e', '#9a1b30', '#5e0916', '#b33246', '#8c1427', '#a8263b'] },
  { base: '#1e293b', soft: '#eef1f6', shades: ['#1e293b', '#334155', '#0f172a', '#475569', '#27354d', '#3b4a63'] },
  { base: '#6b7280', soft: '#f1f3f5', shades: ['#6b7280', '#9ca3af', '#4b5563', '#7c8591', '#a3aab5', '#5f6672'] },
  { base: '#0f766e', soft: '#effaf8', shades: ['#0f766e', '#0d9488', '#115e59', '#14b8a6', '#134e4a', '#2dd4bf'] },
  { base: '#b45309', soft: '#fef6eb', shades: ['#b45309', '#d97706', '#92400e', '#f59e0b', '#78350f', '#c26d10'] },
  { base: '#4338ca', soft: '#eef0fc', shades: ['#4338ca', '#4f46e5', '#3730a3', '#6366f1', '#312e81', '#5b52e8'] },
  { base: '#7e22ce', soft: '#f7f0fd', shades: ['#7e22ce', '#9333ea', '#6b21a8', '#a855f7', '#581c87', '#8b35db'] },
  { base: '#15803d', soft: '#edf9f1', shades: ['#15803d', '#16a34a', '#166534', '#22c55e', '#14532d', '#1e9449'] },
  { base: '#0369a1', soft: '#edf7fc', shades: ['#0369a1', '#0284c7', '#075985', '#0ea5e9', '#0c4a6e', '#1d7fb8'] },
  { base: '#9a3412', soft: '#fcf1ed', shades: ['#9a3412', '#c2410c', '#7c2d12', '#ea580c', '#6c2710', '#d9531e'] }
];
export const MAX_QUEUES = QUEUE_PALETTE.length;

export function queueName(config, idx) {
  const q = config && config.queues && config.queues[idx];
  if (q && typeof q.name === 'string' && q.name.trim()) return q.name.trim();
  return QUEUES[idx] ? QUEUES[idx].name : `Cola ${idx + 1}`;
}

export function queueDescription(config, idx) {
  const q = config && config.queues && config.queues[idx];
  if (q && typeof q.description === 'string' && q.description.trim()) return q.description.trim();
  return QUEUES[idx] ? QUEUES[idx].description : `Cola personalizada de prioridad nivel ${idx + 1}.`;
}

export function queuePriorityLabel(idx, total) {
  if (total === 3 && QUEUES[idx]) return QUEUES[idx].priority;
  if (idx === 0) return total === 1 ? 'ÚNICA' : 'Niv. 1 · ALTA';
  if (idx === total - 1) return `Niv. ${total} · BAJA`;
  return `Niv. ${idx + 1}`;
}

export function queuePalette(idx) {
  return QUEUE_PALETTE[idx % QUEUE_PALETTE.length];
}

export function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function mixHex(hex, targetHex, ratio) {
  const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
  const ch = [1, 3, 5].map((i) => Math.round(p(hex, i) * (1 - ratio) + p(targetHex, i) * ratio));
  return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function getProcessColors(processes, config) {
  const colors = new Map();
  const count = Array(config.queues.length).fill(0);
  processes.forEach((p) => {
    const q = Math.min(Math.max(0, p.queue), config.queues.length - 1);
    const pal = queuePalette(q);
    const bg = pal.shades[count[q]++ % pal.shades.length];
    colors.set(p.id, { bg, fg: luminance(bg) > 0.4 ? '#111827' : '#ffffff' });
  });
  return colors;
}

export const ALGORITHMS = {
  FCFS: {
    key: 'FCFS',
    short: 'FCFS',
    label: 'FCFS (First Come, First Served)',
    modality: 'No expropiativo',
    usesQuantum: false,
    canTogglePreemption: false,
    note: 'Atiende por orden de llegada. Un proceso que empieza no se interrumpe dentro de su cola.'
  },
  SJF: {
    key: 'SJF',
    short: 'SJF',
    label: 'SJF (Shortest Job First)',
    modality: 'No expropiativo',
    usesQuantum: false,
    canTogglePreemption: true,
    note: 'Elige la ráfaga más corta. En modo no expropiativo no interrumpe al proceso en CPU; en modo expropiativo (SRTF) lo desaloja si llega uno más corto.'
  },
  SRTF: {
    key: 'SRTF',
    short: 'SRTF',
    label: 'SRTF (Shortest Remaining Time First)',
    modality: 'Expropiativo',
    usesQuantum: false,
    canTogglePreemption: true,
    note: 'Siempre ejecuta el menor tiempo restante; un proceso más corto que llega desaloja al actual.'
  },
  RR: {
    key: 'RR',
    short: 'RR',
    label: 'Round Robin (RR)',
    modality: 'Expropiativo (por quantum)',
    usesQuantum: true,
    canTogglePreemption: false,
    note: 'Cada proceso recibe un quantum de tiempo. Al agotarlo cede la CPU y vuelve al final de la cola circular. Round Robin es siempre expropiativo por definición.'
  }
};

/** Determina si una cola tiene habilitada la expropiación interna.
 *  Round Robin es SIEMPRE expropiativo (no tiene modo no-expropiativo). */
export function isQueuePreemptive(config, qIdx) {
  const q = config && config.queues && config.queues[qIdx];
  if (!q) return false;
  // RR is always preemptive — ignoring any stored preemptive flag
  if (q.algorithm === 'RR' || q.algorithm === 'SRTF') return true;
  if (q.preemptive !== undefined) return Boolean(q.preemptive);
  return false;
}

export function getQueueModalityLabel(config, qIdx) {
  const q = config && config.queues && config.queues[qIdx];
  if (!q) return 'No expropiativo';
  const pre = isQueuePreemptive(config, qIdx);
  if (q.algorithm === 'FCFS') return 'No expropiativo';
  if (q.algorithm === 'RR') return `Expropiativo (q = ${q.quantum})`;
  if (q.algorithm === 'SJF' || q.algorithm === 'SRTF') return pre ? 'Expropiativo (SRTF)' : 'No expropiativo (SJF)';
  return pre ? 'Expropiativo' : 'No expropiativo';
}

export const DEFAULT_CONFIG = () => ({
  policy: 'priority',          // 'priority' (prioridad fija) | 'percent' (porcentajes de CPU)
  preemptive: true,            // true = MLQ expropiativo entre colas | false = MLQ no expropiativo
  percent: [50, 30, 20],       // % de CPU por cola (solo con policy = 'percent'; debe sumar 100)
  cycle: 10,                   // duración del ciclo de reparto en unidades de tiempo
  queues: [
    { name: 'Sistema',     description: QUEUES[0].description, algorithm: 'RR',   quantum: 2, preemptive: true },
    { name: 'Interactiva', description: QUEUES[1].description, algorithm: 'RR',   quantum: 4, preemptive: true },
    { name: 'Batch',       description: QUEUES[2].description, algorithm: 'FCFS', quantum: 4, preemptive: false }
  ]
});

export const SCENARIOS = {
  base: {
    name: 'Escenario base',
    processes: [
      { id: 'P1', arrival: 0, burst: 5, queue: 0 },
      { id: 'P2', arrival: 1, burst: 4, queue: 1 },
      { id: 'P3', arrival: 2, burst: 6, queue: 2 },
      { id: 'P4', arrival: 3, burst: 3, queue: 0 },
      { id: 'P5', arrival: 4, burst: 5, queue: 1 },
      { id: 'P6', arrival: 6, burst: 2, queue: 2 }
    ]
  },
  interrupciones: {
    name: 'Escenario con interrupciones entre colas',
    processes: [
      { id: 'P1', arrival: 0, burst: 6, queue: 2 },
      { id: 'P2', arrival: 2, burst: 4, queue: 1 },
      { id: 'P3', arrival: 3, burst: 3, queue: 0 },
      { id: 'P4', arrival: 5, burst: 2, queue: 1 },
      { id: 'P5', arrival: 7, burst: 3, queue: 2 }
    ]
  },
  multicola: {
    name: 'Escenario de 5 colas',
    config: {
      policy: 'priority',
      preemptive: true,
      percent: [30, 25, 20, 15, 10],
      cycle: 10,
      queues: [
        { name: 'Sistema',       description: QUEUES[0].description,                         algorithm: 'RR',   quantum: 2, preemptive: true },
        { name: 'Interactiva',   description: QUEUES[1].description,                         algorithm: 'RR',   quantum: 4, preemptive: true },
        { name: 'Batch',         description: QUEUES[2].description,                         algorithm: 'FCFS', quantum: 4, preemptive: false },
        { name: 'Segundo plano', description: 'Tareas periódicas y respaldos en segundo plano.', algorithm: 'SJF',  quantum: 3, preemptive: false },
        { name: 'Mantenimiento', description: 'Procesos diferidos de mínima prioridad.',     algorithm: 'FCFS', quantum: 4, preemptive: false }
      ]
    },
    processes: [
      { id: 'P1', arrival: 0, burst: 4, queue: 4 },
      { id: 'P2', arrival: 1, burst: 3, queue: 2 },
      { id: 'P3', arrival: 2, burst: 3, queue: 0 },
      { id: 'P4', arrival: 4, burst: 5, queue: 1 },
      { id: 'P5', arrival: 6, burst: 3, queue: 3 },
      { id: 'P6', arrival: 8, burst: 1, queue: 3 },
      { id: 'P7', arrival: 7, burst: 2, queue: 0 }
    ]
  }
};

/** Comparación "natural" de identificadores: P2 < P10. */
export function naturalCompare(a, b) {
  const ta = String(a).split(/(\d+)/);
  const tb = String(b).split(/(\d+)/);
  const n = Math.max(ta.length, tb.length);
  for (let i = 0; i < n; i++) {
    const x = ta[i] || '';
    const y = tb[i] || '';
    if (x === y) continue;
    if (i % 2 === 1) {
      const nx = Number(x), ny = Number(y);
      if (nx !== ny) return nx - ny;
    }
    return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * Reparte las `cycle` unidades de un ciclo entre las N colas según sus porcentajes,
 * con el método del mayor resto (la suma es siempre exactamente `cycle`).
 * Desempate de restos iguales: la cola de mayor prioridad.
 */
export function allocateQuotas(percent, cycle) {
  const n = percent.length;
  const quota = percent.map((p) => Math.floor((p * cycle) / 100));
  const rest = percent.map((p) => (p * cycle) % 100);
  let left = cycle - quota.reduce((a, b) => a + b, 0);
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => rest[b] - rest[a] || a - b);
  for (let i = 0; left > 0; i++, left--) quota[order[i % n]]++;
  return quota;
}

/** Errores de la configuración de colas y de la política entre colas (lista vacía = válida). */
export function validateConfig(config) {
  const errors = [];
  if (!config || !Array.isArray(config.queues) || config.queues.length < 1 || config.queues.length > MAX_QUEUES) {
    errors.push(`La configuración debe tener entre 1 y ${MAX_QUEUES} colas.`);
    return errors;
  }
  const n = config.queues.length;
  config.queues.forEach((c, i) => {
    const name = queueName(config, i);
    if (!c || !ALGORITHMS[c.algorithm]) errors.push(`Cola ${name}: algoritmo inválido.`);
    if (c && c.algorithm === 'RR' && (!Number.isInteger(c.quantum) || c.quantum < 1)) errors.push(`Cola ${name}: el quantum debe ser un entero ≥ 1.`);
  });
  if (config.policy !== undefined && config.policy !== 'priority' && config.policy !== 'percent') errors.push('Política entre colas inválida.');
  if (config.policy === 'percent') {
    const pc = config.percent;
    const minCycle = Math.max(3, n);
    const maxPct = n === 1 ? 100 : 100 - (n - 1);
    if (!Array.isArray(pc) || pc.length !== n || pc.some((v) => !Number.isInteger(v) || v < 1 || v > maxPct)) {
      errors.push(`Cada porcentaje de CPU debe ser un entero entre 1 y ${maxPct}.`);
    } else {
      const sum = pc.reduce((a, b) => a + b, 0);
      if (sum !== 100) {
        errors.push(`Los porcentajes deben sumar 100 % (ahora suman ${sum} %).`);
      } else if (!Number.isInteger(config.cycle) || config.cycle < minCycle || config.cycle > 100) {
        errors.push(`El ciclo debe ser un entero entre ${minCycle} y 100 unidades.`);
      } else {
        const quota = allocateQuotas(pc, config.cycle);
        quota.forEach((v, i) => { if (v < 1) errors.push(`La cola ${queueName(config, i)} recibiría 0 unidades por ciclo: aumenta el ciclo o su porcentaje.`); });
      }
    }
  }
  return errors;
}

export function validateInterruptions(interruptions) {
  const errors = [];
  if (interruptions === undefined || interruptions === null) return errors;
  if (!Array.isArray(interruptions)) {
    errors.push('Las interrupciones deben ser una lista.');
    return errors;
  }
  const sorted = [];
  interruptions.forEach((ir, idx) => {
    const label = ir && ir.label ? String(ir.label).trim() : `IRQ${idx + 1}`;
    if (!ir || !Number.isInteger(ir.time) || ir.time < 0 || ir.time > 1000) {
      errors.push(`Interrupción ${label}: el instante debe ser un entero entre 0 y 1000.`);
    }
    if (!ir || !Number.isInteger(ir.duration) || ir.duration < 1 || ir.duration > 100) {
      errors.push(`Interrupción ${label}: la duración debe ser un entero entre 1 y 100.`);
    }
    if (ir && Number.isInteger(ir.time) && Number.isInteger(ir.duration) && ir.duration >= 1) {
      sorted.push({ label, start: ir.time, end: ir.time + ir.duration });
    }
  });
  sorted.sort((a, b) => a.start - b.start);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start < sorted[i - 1].end) {
      errors.push(`Las interrupciones ${sorted[i - 1].label} y ${sorted[i].label} se solapan en el tiempo.`);
    }
  }
  return errors;
}

export function validateInput(processes, config, interruptions = []) {
  const errors = [];
  if (!Array.isArray(processes) || processes.length === 0) errors.push('Agrega al menos un proceso.');
  const cfgErrors = validateConfig(config);
  const numQueues = config && Array.isArray(config.queues) ? config.queues.length : 0;
  const seen = new Set();
  (processes || []).forEach((p) => {
    if (!/^[A-Za-z0-9_-]{1,8}$/.test(String(p.id))) errors.push(`Identificador inválido: "${p.id}".`);
    if (seen.has(p.id)) errors.push(`Identificador repetido: ${p.id}.`);
    seen.add(p.id);
    if (!Number.isInteger(p.arrival) || p.arrival < 0 || p.arrival > 1000) errors.push(`${p.id}: la llegada debe ser un entero entre 0 y 1000.`);
    if (!Number.isInteger(p.burst) || p.burst < 1 || p.burst > 1000) errors.push(`${p.id}: la ráfaga debe ser un entero entre 1 y 1000.`);
    if (numQueues > 0 && (!Number.isInteger(p.queue) || p.queue < 0 || p.queue >= numQueues)) errors.push(`${p.id}: cola inválida.`);
  });
  cfgErrors.forEach((e) => errors.push(e));
  validateInterruptions(interruptions).forEach((e) => errors.push(e));
  return errors;
}

/** Ordena una lista de procesos listos según el algoritmo; el primero es el siguiente en ser elegido. */
export function orderedReady(list, alg) {
  const arr = list.slice();
  if (alg === 'RR') return arr; // el orden de la lista ES el orden de la cola circular
  arr.sort((a, b) => {
    if ((alg === 'SJF' || alg === 'SRTF') && a.remaining !== b.remaining) return a.remaining - b.remaining;
    if (a.arrival !== b.arrival) return a.arrival - b.arrival;
    return naturalCompare(a.id, b.id);
  });
  return arr;
}

export function simulate(input, config, interruptions = []) {
  const errors = validateInput(input, config, interruptions);
  if (errors.length) throw new Error(errors.join(' '));

  const numQueues = config.queues.length;
  const queueIndices = Array.from({ length: numQueues }, (_, i) => i);
  const qName = (q) => queueName(config, q);

  const mlqPreemptive = config.preemptive !== false; // true por defecto

  const procs = input.map((p) => ({
    id: p.id, arrival: p.arrival, burst: p.burst, queue: p.queue,
    remaining: p.burst, state: 'new', firstStart: null, finish: null
  }));
  const irqList = (interruptions || [])
    .map((ir, idx) => ({
      id: ir.id || `IRQ${idx + 1}`,
      label: (ir.label && String(ir.label).trim()) || ir.id || `IRQ${idx + 1}`,
      time: ir.time,
      duration: ir.duration
    }))
    .sort((a, b) => a.time - b.time);

  const ready = Array.from({ length: numQueues }, () => []); // procesos esperando (no ejecutando) por cola
  const algOf = (q) => config.queues[q].algorithm;
  const quantumOf = (q) => config.queues[q].quantum;

  const ticks = [];       // una entrada por unidad de tiempo ejecutada
  const snapshots = [];   // una entrada por instante t (incluye el instante final)
  const allEvents = [];
  let cpu = null;         // { proc, qLeft }
  let activeInterrupt = null; // { id, label, time, duration, remaining }
  let carry = [];         // eventos del final del intervalo anterior (finalizaciones)
  let expired = null;     // { proc, q } quantum agotado en el intervalo anterior
  let t = 0, busy = 0, ctx = 0, preemptions = 0;
  const cpuByQueue = Array(numQueues).fill(0);
  let lastRunPid = null, lastQueue = null, idleActive = false;

  const percentMode = config.policy === 'percent';
  const cycleLen = percentMode ? config.cycle : null;
  const quotaAlloc = percentMode ? allocateQuotas(config.percent, config.cycle) : null;
  let quotaLeft = Array(numQueues).fill(0);
  let selKind = 'priority';   // por qué se eligió la cola: 'priority' | 'quota' | 'borrow'

  const maxArrival = Math.max(...input.map((p) => p.arrival), ...irqList.map((ir) => ir.time), 0);
  const totalIrqDur = irqList.reduce((s, ir) => s + ir.duration, 0);
  const maxTime = input.reduce((s, p) => s + p.burst, 0) + totalIrqDur + maxArrival + 2;

  /** Cola que debe tener la CPU en este instante según la política entre colas. */
  function selectQueue() {
    const cand = queueIndices.filter((q) => ready[q].length > 0 || (cpu && cpu.proc.queue === q));
    if (!cand.length) return { q: null, kind: null };
    if (!percentMode) {
      if (!mlqPreemptive && cpu) {
        // En MLQ No Expropiativo, el proceso actual retiene la CPU hasta terminar
        return { q: cpu.proc.queue, kind: 'priority' };
      }
      return { q: cand[0], kind: 'priority' };
    }
    const withQuota = cand.filter((q) => quotaLeft[q] > 0);
    if (withQuota.length) return { q: withQuota[0], kind: 'quota' };
    return { q: cand[0], kind: 'borrow' };
  }

  function reasonForQueue(q) {
    if (percentMode) {
      if (selKind === 'quota') {
        return `a la cola ${qName(q)} aún le quedan ${quotaLeft[q]} de ${quotaAlloc[q]} unidades de cuota en este ciclo y es la de mayor prioridad entre las colas con procesos listos y cuota disponible`;
      }
      return `todas las colas con procesos ya agotaron su cuota del ciclo, así que la CPU aprovecha el tiempo sobrante en la de mayor prioridad (${qName(q)}) para no quedar ociosa`;
    }
    if (q === 0) return 'tiene la prioridad más alta y tiene procesos listos';
    if (q === 1) return `la cola ${qName(0)} está vacía y ${qName(1)} es la siguiente en prioridad`;
    const higher = Array.from({ length: q }, (_, i) => qName(i));
    const joined = `${higher.slice(0, -1).join(', ')} y ${higher[higher.length - 1]}`;
    return `las colas ${joined} están vacías, por lo que ${qName(q)} puede usar la CPU`;
  }

  function reasonInQueue(chosen, candidates, resumed) {
    const q = chosen.queue, alg = algOf(q);
    const head = `En la cola ${qName(q)} se aplica ${ALGORITHMS[alg].short}: se elige ${chosen.id}`;
    const only = candidates.length === 1;
    const next = candidates[1];
    if (alg === 'FCFS') {
      if (only) return `${head} porque es el único proceso listo de la cola.`;
      const tie = next && next.arrival === chosen.arrival ? ' (empate en la llegada: se desempata por identificador)' : '';
      return `${head} porque llegó primero (llegada = ${chosen.arrival})${tie}.`;
    }
    if (alg === 'SJF' || alg === 'SRTF') {
      const what = (alg === 'SJF' && !isQueuePreemptive(config, q)) ? 'la menor ráfaga' : 'el menor tiempo restante';
      const note = resumed ? ' (había sido interrumpido y conserva su tiempo restante)' : '';
      if (only) return `${head} porque es el único proceso listo de la cola${note}.`;
      const tie = next && next.remaining === chosen.remaining ? '; hay empate, así que se elige el que llegó primero o, si persiste, el de menor identificador' : '';
      return `${head} porque tiene ${what} entre los procesos listos (${chosen.remaining} unidades)${tie}${note}.`;
    }
    const isPre = isQueuePreemptive(config, q);
    const note = resumed ? ' Había sido interrumpido: conserva su tiempo restante pero recibe un quantum nuevo.' : '';
    if (!isPre) {
      return `${head} en modo Round Robin no expropiativo: ejecutará hasta completar su ráfaga.${note}`;
    }
    if (only) return `${head} porque es el único proceso listo de la cola; recibe un quantum de ${quantumOf(q)} unidades.${note}`;
    return `${head} porque está al frente de la cola circular; recibe un quantum de ${quantumOf(q)} unidades.${note}`;
  }

  function waitingLines() {
    const lines = [];
    if (!cpu) return lines;
    const cq = cpu.proc.queue;
    for (let q = 0; q < numQueues; q++) {
      const list = orderedReady(ready[q], algOf(q));
      if (!list.length) continue;
      const ids = list.map((p) => p.id).join(', ');
      if (!percentMode && q < cq && !mlqPreemptive) {
        lines.push(`Esperan en la cola ${qName(q)}: ${ids}. Tienen mayor prioridad que la cola ${qName(cq)}, pero MLQ está en modo NO EXPROPIATIVO, por lo que esperan a que ${cpu.proc.id} termine.`);
      } else if (percentMode && q !== cq) {
        const why = quotaLeft[q] <= 0
          ? `la cola ${qName(q)} ya consumió su cuota (${quotaAlloc[q]} unidades) de este ciclo`
          : `ahora le corresponde a la cola ${qName(cq)} y la cola ${qName(q)} sigue después, por orden de prioridad dentro del ciclo`;
        lines.push(`Esperan en la cola ${qName(q)}: ${ids}. ${why[0].toUpperCase()}${why.slice(1)}.`);
      } else if (q > cq) {
        lines.push(`Esperan en la cola ${qName(q)}: ${ids}. La cola ${qName(cq)} tiene mayor prioridad y la CPU está ocupada por ${cpu.proc.id}.`);
      } else if (q === cq) {
        const pre = isQueuePreemptive(config, q);
        const why = {
          FCFS: 'FCFS atiende por orden de llegada y no interrumpe al proceso que ya está ejecutando.',
          SJF: pre ? 'ninguno tiene un tiempo restante estrictamente menor que el del proceso en ejecución (SRTF).' : 'SJF en modo no expropiativo no interrumpe al proceso en ejecución.',
          SRTF: 'ninguno tiene un tiempo restante estrictamente menor que el del proceso en ejecución.',
          RR: pre ? 'deben esperar su turno en la cola circular hasta que se agote el quantum.' : 'Round Robin en modo no expropiativo permite al proceso actual ejecutar hasta terminar.'
        }[algOf(q)];
        lines.push(`Esperan en la cola ${qName(q)}: ${ids}. ${cpu.proc.id} ya tiene la CPU; ${why}`);
      }
    }
    return lines;
  }

  while (true) {
    if (t > maxTime) throw new Error('La simulación excedió el tiempo máximo esperado (posible bucle).');
    const ev = carry; carry = [];
    const add = (type, text, extra) => ev.push(Object.assign({ t, type, text }, extra || {}));

    /* (a) Llegadas en el instante t (orden por identificador) */
    const arriving = procs.filter((p) => p.arrival === t).sort((a, b) => naturalCompare(a.id, b.id));
    arriving.forEach((p) => {
      p.state = 'ready';
      ready[p.queue].push(p);
      add('arrival', `${p.id} llega a la cola ${qName(p.queue)} (ráfaga ${p.burst}).`, { pid: p.id, queue: p.queue });
    });

    /* (b) Quantum agotado en el intervalo anterior: vuelve al final, DESPUÉS de las llegadas */
    if (expired) {
      const { proc, q } = expired;
      const alone = ready[q].length === 0;
      proc.state = 'ready';
      ready[q].push(proc);
      add('quantum',
        `Finaliza el quantum de ${proc.id} (q = ${quantumOf(q)}). El proceso regresa al final de la cola ${qName(q)}.` +
        (alone ? ' No hay otros procesos listos en esa cola.' : ''),
        { pid: proc.id, queue: q });
      expired = null;
    }

    /* (c) ¿Terminó todo? Se registra la instantánea final y se sale. */
    if (procs.every((p) => p.state === 'done') && !activeInterrupt) {
      add('info', `Todos los procesos finalizaron. Tiempo total de simulación (makespan) = ${t}.`);
      snapshots.push(makeSnapshot(t, ev, ev.map((e) => ({ type: e.type, text: e.text })), null, null));
      ev.forEach((e) => allEvents.push(e));
      break;
    }

    /* (c2) Política por porcentajes: al inicio de cada ciclo se reparten las cuotas */
    const newCycle = percentMode && t % cycleLen === 0;
    if (newCycle) {
      quotaLeft = quotaAlloc.slice();
      const parts = quotaAlloc.map((v, i) => `${qName(i)} ${v}`);
      const summary = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
      add('cycle', `Comienza el ciclo ${t / cycleLen + 1} (${cycleLen} unidades): ${summary} unidades de CPU.`, { cycle: t / cycleLen + 1 });
    }

    /* (c3) Interrupción externa programada para el instante t */
    const startingIrq = !activeInterrupt ? irqList.find((ir) => ir.time === t) : null;
    if (startingIrq) {
      if (cpu) {
        const old = cpu.proc;
        const cq = old.queue;
        add('preempt',
          `Interrupción externa ${startingIrq.label} (duración ${startingIrq.duration} u): ${old.id} (cola ${qName(cq)}) es interrumpido y conserva su tiempo restante (${old.remaining}).`,
          { pid: old.id, queue: cq, cause: 'external_irq' });
        old.state = 'interrupted';
        ready[cq].unshift(old);
        preemptions++;
        cpu = null;
      } else {
        add('interrupt',
          `Interrupción externa ${startingIrq.label} en t=${t} (duración ${startingIrq.duration} u): la CPU atiende la rutina de interrupción.`,
          { irq: startingIrq.id, label: startingIrq.label });
      }
      activeInterrupt = {
        id: startingIrq.id,
        label: startingIrq.label,
        time: startingIrq.time,
        duration: startingIrq.duration,
        remaining: startingIrq.duration
      };
    }

    /* (d) Decisión entre colas: ¿se interrumpe al proceso actual? */
    const sel = activeInterrupt ? { q: null, kind: null } : selectQueue();
    const top = sel.q;
    selKind = sel.kind;
    if (!activeInterrupt && cpu) {
      const old = cpu.proc;
      const cq = old.queue;
      if (top !== cq) {
        let why;
        if (!percentMode) {
          const cause = arriving.filter((p) => p.queue < cq).sort((a, b) => a.queue - b.queue)[0];
          why = cause ? `porque ${cause.id} llegó a la cola ${qName(cause.queue)}, que tiene mayor prioridad. ` : `porque la cola ${qName(top)}, de mayor prioridad, tiene procesos listos. `;
        } else if (newCycle) {
          why = `porque comenzó un nuevo ciclo de reparto y la cola ${qName(top)} recibe su cuota de ${quotaAlloc[top]} unidades. `;
        } else if (quotaLeft[cq] <= 0) {
          why = `porque la cola ${qName(cq)} agotó su cuota de CPU en este ciclo (${quotaAlloc[cq]} unidades); ahora le corresponde a la cola ${qName(top)}. `;
        } else {
          why = `porque la cola ${qName(top)} tiene cuota disponible en este ciclo y mayor prioridad. `;
        }
        add('preempt',
          `${old.id} (cola ${qName(cq)}) es interrumpido ` + why +
          `${old.id} conserva su tiempo restante (${old.remaining}) y permanece en su cola ${qName(cq)}.`,
          { pid: old.id, queue: cq, cause: percentMode ? 'quota' : 'queue' });
        old.state = 'interrupted';
        ready[cq].unshift(old); // vuelve al frente de su cola
        preemptions++;
        cpu = null;
      } else {
        // Comprobación de expropiación dentro de la misma cola (p.ej. SRTF o SJF expropiativo)
        const isPreemptiveInside = algOf(cq) === 'SRTF' || (algOf(cq) === 'SJF' && isQueuePreemptive(config, cq));
        if (isPreemptiveInside) {
          const best = orderedReady(ready[cq], 'SRTF')[0];
          if (best && best.remaining < old.remaining) {
            add('preempt',
              `${old.id} es interrumpido porque ${best.id} tiene menor tiempo restante (${best.remaining} < ${old.remaining}) en la misma cola (SJF expropiativo / SRTF). ` +
              `${old.id} conserva su tiempo restante y vuelve a esperar en la cola ${qName(cq)}.`,
              { pid: old.id, queue: cq, cause: 'srtf' });
            old.state = 'interrupted';
            ready[cq].push(old);
            preemptions++;
            cpu = null;
          }
        }
      }
    }

    /* (e) Despacho: si la CPU está libre y no hay interrupción externa se elige cola y luego proceso */
    let dispatched = false, ctxFrom = null, sameAsBefore = false, queueReason = null, dispatchText = null;
    if (!activeInterrupt && !cpu) {
      const q = top;
      if (q !== null) {
        const candidates = orderedReady(ready[q], algOf(q));
        const chosen = candidates[0];
        ready[q].splice(ready[q].indexOf(chosen), 1);
        const resumed = chosen.state === 'interrupted';
        chosen.state = 'running';
        if (chosen.firstStart === null) chosen.firstStart = t;
        const usesQ = algOf(q) === 'RR' && isQueuePreemptive(config, q);
        cpu = { proc: chosen, qLeft: usesQ ? quantumOf(q) : null };
        dispatched = true;
        idleActive = false;
        sameAsBefore = lastRunPid === chosen.id;
        queueReason = `La CPU selecciona la cola ${qName(q)} porque ${reasonForQueue(q)}.`;
        dispatchText = reasonInQueue(chosen, candidates, resumed);
        if (!sameAsBefore) {
          if (lastRunPid === null || lastQueue !== q) add('queue', queueReason, { queue: q });
          if (lastRunPid !== null) {
            ctx++; ctxFrom = lastRunPid;
            add('context', `Cambio de contexto: la CPU pasa de ${lastRunPid} a ${chosen.id}.`, { from: lastRunPid, to: chosen.id });
          }
          add('dispatch', dispatchText, { pid: chosen.id, queue: q });
        }
        lastQueue = q;
      } else if (!idleActive) {
        idleActive = true;
        add('idle', 'La CPU queda ociosa: no hay procesos listos en ninguna cola (los siguientes aún no han llegado).');
      }
    }

    /* (f) Texto para el panel "¿Qué está pasando?" */
    const lines = [];
    ev.forEach((e) => {
      if (e.type === 'dispatch' && !ev.some((x) => x.type === 'queue')) lines.push({ type: 'queue', text: queueReason });
      lines.push({ type: e.type, text: e.text });
    });
    if (dispatched && sameAsBefore) {
      lines.push({ type: 'dispatch', text: `${queueReason.replace('La CPU selecciona', 'La CPU mantiene')} ${dispatchText}` });
    }
    if (cpu && !dispatched) {
      const p = cpu.proc, a = algOf(p.queue);
      const pre = isQueuePreemptive(config, p.queue);
      let why = '';
      if (a === 'FCFS' || (a === 'SJF' && !pre)) why = `${ALGORITHMS[a].short} es no apropiativo: un proceso que ya empezó no se interrumpe dentro de su cola.`;
      else if (a === 'SRTF' || (a === 'SJF' && pre)) why = `ningún proceso listo de su cola tiene un tiempo restante menor que ${p.remaining}.`;
      else if (a === 'RR' && !pre) why = 'Round Robin está en modo no expropiativo: ejecuta hasta completar su ráfaga.';
      else why = `le quedan ${cpu.qLeft} unidades de quantum.`;

      let sup;
      if (percentMode) sup = selKind === 'quota'
        ? ` A la cola ${qName(p.queue)} le quedan ${quotaLeft[p.queue]} de ${quotaAlloc[p.queue]} unidades de cuota en este ciclo (incluida la actual).`
        : ` La cola ${qName(p.queue)} ya agotó su cuota, pero las demás colas con procesos también: usa el tiempo sobrante.`;
      else if (!mlqPreemptive && p.queue > 0) sup = ' MLQ está en modo no expropiativo: mantiene la CPU aunque lleguen colas superiores.';
      else sup = p.queue === 0 ? '' : ' Las colas de mayor prioridad no tienen procesos listos.';
      lines.push({ type: 'info', text: `${p.id} continúa ejecutándose en la cola ${qName(p.queue)}: ${why}${sup}` });
    }
    waitingLines().forEach((l) => lines.push({ type: 'wait', text: l }));
    if (activeInterrupt) {
      lines.push({
        type: 'interrupt',
        text: `Interrupción externa ${activeInterrupt.label} en curso: la CPU atiende la rutina (restan ${activeInterrupt.remaining} de ${activeInterrupt.duration} u).`
      });
    } else if (!cpu) {
      lines.push({ type: 'idle', text: 'No hay ningún proceso listo; la CPU espera la llegada del siguiente proceso.' });
    }

    snapshots.push(makeSnapshot(t, ev, lines, top, { dispatched }));
    ev.forEach((e) => allEvents.push(e));

    /* (g) Ejecutar el intervalo [t, t+1) */
    if (activeInterrupt) {
      ticks.push({
        t,
        pid: null,
        queue: null,
        interrupt: activeInterrupt.id,
        interruptLabel: activeInterrupt.label,
        dispatch: false,
        ctxFrom: null
      });
      activeInterrupt.remaining--;
      lastRunPid = null;
      if (activeInterrupt.remaining === 0) {
        carry.push({
          t: t + 1,
          type: 'interrupt_end',
          text: `Finaliza la interrupción externa ${activeInterrupt.label}. La CPU queda disponible.`
        });
        activeInterrupt = null;
      }
    } else if (cpu) {
      const p = cpu.proc;
      ticks.push({ t, pid: p.id, queue: p.queue, dispatch: dispatched, ctxFrom });
      p.remaining--;
      busy++;
      if (cpu.qLeft !== null) cpu.qLeft--;
      cpuByQueue[p.queue]++;
      if (percentMode && quotaLeft[p.queue] > 0) quotaLeft[p.queue]--;
      lastRunPid = p.id;
      if (p.remaining === 0) {
        p.state = 'done';
        p.finish = t + 1;
        carry.push({ t: t + 1, type: 'finish', text: `${p.id} finaliza su ejecución (cola ${qName(p.queue)}).`, pid: p.id, queue: p.queue });
        cpu = null;
      } else if (algOf(p.queue) === 'RR' && isQueuePreemptive(config, p.queue) && cpu.qLeft === 0) {
        expired = { proc: p, q: p.queue };
        cpu = null;
      }
    } else {
      ticks.push({ t, pid: null, queue: null, dispatch: false, ctxFrom: null });
      lastRunPid = null;
    }
    t++;
  }

  function flags_final(flags) { return flags === null; }
  function makeSnapshot(time, evs, explain, preferred, flags) {
    return {
      t: time,
      events: evs.map((e) => Object.assign({}, e)),
      explain: explain.slice(),
      preferredQueue: preferred,
      flags: flags || {},
      cpu: cpu ? {
        pid: cpu.proc.id, queue: cpu.proc.queue, algorithm: algOf(cpu.proc.queue),
        burst: cpu.proc.burst, executed: cpu.proc.burst - cpu.proc.remaining, remaining: cpu.proc.remaining,
        quantum: (algOf(cpu.proc.queue) === 'RR' && isQueuePreemptive(config, cpu.proc.queue)) ? quantumOf(cpu.proc.queue) : null,
        qLeft: cpu.qLeft
      } : null,
      interrupt: activeInterrupt ? {
        id: activeInterrupt.id,
        label: activeInterrupt.label,
        time: activeInterrupt.time,
        duration: activeInterrupt.duration,
        remaining: activeInterrupt.remaining
      } : null,
      procs: procs.map((p) => ({
        id: p.id, queue: p.queue, arrival: p.arrival, burst: p.burst,
        state: p.state, remaining: p.remaining, executed: p.burst - p.remaining
      })),
      queues: queueIndices.map((q) => orderedReady(ready[q], algOf(q)).map((p) => p.id)),
      pending: queueIndices.map((q) => procs.filter((p) => p.queue === q && p.state !== 'done').length),
      cycle: percentMode && !flags_final(flags) ? { length: cycleLen, index: Math.floor(time / cycleLen), pos: time % cycleLen, quota: quotaAlloc.slice(), left: quotaLeft.slice() } : null
    };
  }

  const makespan = t;
  const metrics = computeMetrics(procs, busy, makespan, ctx, preemptions, cpuByQueue, numQueues);
  return { snapshots, ticks, events: allEvents, metrics, makespan, config: JSON.parse(JSON.stringify(config)) };
}

export function computeMetrics(procs, busy, makespan, contextSwitches, preemptions, cpuByQueue, numQueues) {
  const perProcess = procs.map((p) => {
    const turnaround = p.finish - p.arrival;
    return {
      id: p.id, queue: p.queue, arrival: p.arrival, burst: p.burst,
      start: p.firstStart, finish: p.finish,
      turnaround,
      waiting: turnaround - p.burst,
      response: p.firstStart - p.arrival
    };
  });
  const avg = (arr, f) => (arr.length ? arr.reduce((s, x) => s + f(x), 0) / arr.length : 0);
  const qCount = Number.isInteger(numQueues) ? numQueues : (cpuByQueue ? cpuByQueue.length : Math.max(3, ...procs.map((p) => p.queue + 1)));
  const perQueue = Array.from({ length: qCount }, (_, q) => {
    const list = perProcess.filter((p) => p.queue === q);
    return { queue: q, count: list.length, cpuTime: cpuByQueue ? (cpuByQueue[q] || 0) : 0, avgWaiting: avg(list, (p) => p.waiting), avgTurnaround: avg(list, (p) => p.turnaround), avgResponse: avg(list, (p) => p.response) };
  });
  return {
    perProcess, perQueue,
    makespan, busy, idle: makespan - busy,
    utilization: makespan > 0 ? (busy / makespan) * 100 : 0,
    avgWaiting: avg(perProcess, (p) => p.waiting),
    avgTurnaround: avg(perProcess, (p) => p.turnaround),
    avgResponse: avg(perProcess, (p) => p.response),
    contextSwitches, preemptions
  };
}

const defaultExport = {
  QUEUES, QUEUE_PALETTE, MAX_QUEUES, ALGORITHMS, SCENARIOS, DEFAULT_CONFIG,
  simulate, computeMetrics, validateInput, validateConfig, validateInterruptions, allocateQuotas,
  naturalCompare, orderedReady, queueName, queueDescription, queuePriorityLabel,
  queuePalette, luminance, mixHex, getProcessColors, isQueuePreemptive, getQueueModalityLabel
};

export default defaultExport;
