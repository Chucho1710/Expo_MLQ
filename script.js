/* =====================================================================
   MLQ — Simulador de Planificación por Colas Multinivel
   ---------------------------------------------------------------------
   Estructura del archivo
     1. Constantes, algoritmos y escenarios
     2. Motor de planificación (puro, sin DOM)  ->  simulate()
     3. Métricas                                 ->  computeMetrics()
     4. Interfaz de usuario (DOM)
   El motor se ejecuta UNA vez al iniciar y produce una "película" de
   instantáneas (una por unidad de tiempo). La interfaz solo reproduce
   esa película, de modo que Gantt, registro de eventos, explicaciones y
   métricas salen siempre de la misma fuente de verdad.
   ===================================================================== */
(function (global) {
  'use strict';

  /* ===================================================================
     1. CONSTANTES, ALGORITMOS Y ESCENARIOS
     =================================================================== */

  /** Las tres colas básicas por defecto. El índice (id) es su prioridad: 0 es la más alta. */
  const QUEUES = [
    { id: 0, name: 'Sistema',     priority: 'ALTA',  level: 1, description: 'Procesos esenciales del sistema operativo.' },
    { id: 1, name: 'Interactiva', priority: 'MEDIA', level: 2, description: 'Aplicaciones con las que interactúa el usuario.' },
    { id: 2, name: 'Batch',       priority: 'BAJA',  level: 3, description: 'Procesos por lotes y tareas en segundo plano.' }
  ];

  const QUEUE_PALETTE = [
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
  const MAX_QUEUES = QUEUE_PALETTE.length;

  function queueName(config, idx) {
    const q = config && config.queues && config.queues[idx];
    if (q && typeof q.name === 'string' && q.name.trim()) return q.name.trim();
    return QUEUES[idx] ? QUEUES[idx].name : `Cola ${idx + 1}`;
  }
  function queueDescription(config, idx) {
    const q = config && config.queues && config.queues[idx];
    if (q && typeof q.description === 'string' && q.description.trim()) return q.description.trim();
    return QUEUES[idx] ? QUEUES[idx].description : `Cola personalizada de prioridad nivel ${idx + 1}.`;
  }
  function queuePriorityLabel(idx, total) {
    if (total === 3 && QUEUES[idx]) return QUEUES[idx].priority;
    if (idx === 0) return total === 1 ? 'ÚNICA' : 'Niv. 1 · ALTA';
    if (idx === total - 1) return `Niv. ${total} · BAJA`;
    return `Niv. ${idx + 1}`;
  }
  function queuePalette(idx) {
    return QUEUE_PALETTE[idx % QUEUE_PALETTE.length];
  }

  const ALGORITHMS = {
    FCFS: { key: 'FCFS', short: 'FCFS', label: 'FCFS (First Come, First Served)', modality: 'No apropiativo', usesQuantum: false,
            note: 'Atiende por orden de llegada. Un proceso que empieza no se interrumpe dentro de su cola.' },
    SJF:  { key: 'SJF',  short: 'SJF',  label: 'SJF (Shortest Job First)', modality: 'No apropiativo', usesQuantum: false,
            note: 'Elige la ráfaga más corta entre los procesos listos. No interrumpe al que ya está ejecutando.' },
    SRTF: { key: 'SRTF', short: 'SRTF', label: 'SRTF (Shortest Remaining Time First)', modality: 'Apropiativo', usesQuantum: false,
            note: 'Siempre ejecuta el menor tiempo restante; un proceso más corto que llega puede interrumpir al actual.' },
    RR:   { key: 'RR',   short: 'RR',   label: 'Round Robin (RR)', modality: 'Apropiativo (por quantum)', usesQuantum: true,
            note: 'Cada proceso recibe un quantum; al agotarlo cede la CPU y vuelve al final de su cola.' }
  };

  const DEFAULT_CONFIG = () => ({
    policy: 'priority',          // 'priority' (prioridad fija apropiativa) | 'percent' (porcentajes de CPU)
    percent: [50, 30, 20],       // % de CPU por cola (solo con policy = 'percent'; debe sumar 100)
    cycle: 10,                   // duración del ciclo de reparto en unidades de tiempo
    queues: [
      { name: 'Sistema',     description: QUEUES[0].description, algorithm: 'RR',   quantum: 2 },
      { name: 'Interactiva', description: QUEUES[1].description, algorithm: 'RR',   quantum: 4 },
      { name: 'Batch',       description: QUEUES[2].description, algorithm: 'FCFS', quantum: 4 }
    ]
  });

  const SCENARIOS = {
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
        percent: [30, 25, 20, 15, 10],
        cycle: 10,
        queues: [
          { name: 'Sistema',       description: QUEUES[0].description,                         algorithm: 'RR',   quantum: 2 },
          { name: 'Interactiva',   description: QUEUES[1].description,                         algorithm: 'RR',   quantum: 4 },
          { name: 'Batch',         description: QUEUES[2].description,                         algorithm: 'FCFS', quantum: 4 },
          { name: 'Segundo plano', description: 'Tareas periódicas y respaldos en segundo plano.', algorithm: 'SJF',  quantum: 3 },
          { name: 'Mantenimiento', description: 'Procesos diferidos de mínima prioridad.',     algorithm: 'FCFS', quantum: 4 }
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

  /* ===================================================================
     2. MOTOR DE PLANIFICACIÓN
     ===================================================================
     Reglas implementadas (todas deterministas):

     ENTRE COLAS  : dos políticas a elegir (config.policy):
       'priority' -> prioridades fijas y apropiativas. La CPU siempre es de
                    la cola de mayor prioridad que tenga algún proceso
                    listo o en ejecución. No hay división de tiempo.
       'percent'  -> reparto por porcentajes. El tiempo se divide en ciclos de
                    `cycle` unidades; en cada ciclo cada cola recibe una cuota
                    (método del mayor resto). En cada unidad se atiende a la cola
                    de mayor prioridad que tenga procesos Y cuota disponible; si
                    las colas con procesos ya agotaron su cuota, la CPU aprovecha
                    el tiempo sobrante (no queda ociosa). Al cambiar de cola, el
                    proceso en ejecución se interrumpe y conserva su tiempo restante.
     DENTRO       : cada cola aplica su propio algoritmo.
       FCFS  -> menor (llegada, id). No apropiativo.
       SJF   -> menor tiempo de ráfaga restante, luego (llegada, id). No apropiativo.
       SRTF  -> menor tiempo restante; apropia solo si es ESTRICTAMENTE menor.
       RR    -> cola circular con quantum; al agotarlo, el proceso va al final.
     Convenciones de RR:
       - Si en el mismo instante llega un proceso y vence un quantum, el que
         llega entra primero a la cola y después el que agotó el quantum.
       - Un proceso interrumpido por una cola superior vuelve al FRENTE de su
         cola, conserva su tiempo restante y recibe un quantum nuevo al reanudar.
     Tiempo discreto: unidades enteras; el cambio de contexto no consume tiempo
     (solo se marca y se cuenta).
     =================================================================== */

  /** Comparación "natural" de identificadores: P2 < P10. */
  function naturalCompare(a, b) {
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
  function allocateQuotas(percent, cycle) {
    const n = percent.length;
    const quota = percent.map((p) => Math.floor((p * cycle) / 100));
    const rest = percent.map((p) => (p * cycle) % 100);
    let left = cycle - quota.reduce((a, b) => a + b, 0);
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => rest[b] - rest[a] || a - b);
    for (let i = 0; left > 0; i++, left--) quota[order[i % n]]++;
    return quota;
  }

  /** Errores de la configuración de colas y de la política entre colas (lista vacía = válida). */
  function validateConfig(config) {
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

  function validateInput(processes, config) {
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
    return errors;
  }

  /** Ordena una lista de procesos listos según el algoritmo; el primero es el siguiente en ser elegido. */
  function orderedReady(list, alg) {
    const arr = list.slice();
    if (alg === 'RR') return arr; // el orden de la lista ES el orden de la cola circular
    arr.sort((a, b) => {
      if ((alg === 'SJF' || alg === 'SRTF') && a.remaining !== b.remaining) return a.remaining - b.remaining;
      if (a.arrival !== b.arrival) return a.arrival - b.arrival;
      return naturalCompare(a.id, b.id);
    });
    return arr;
  }

  function simulate(input, config) {
    const errors = validateInput(input, config);
    if (errors.length) throw new Error(errors.join(' '));

    const numQueues = config.queues.length;
    const queueIndices = Array.from({ length: numQueues }, (_, i) => i);
    const qName = (q) => queueName(config, q);

    const procs = input.map((p) => ({
      id: p.id, arrival: p.arrival, burst: p.burst, queue: p.queue,
      remaining: p.burst, state: 'new', firstStart: null, finish: null
    }));
    const ready = Array.from({ length: numQueues }, () => []); // procesos esperando (no ejecutando) por cola
    const algOf = (q) => config.queues[q].algorithm;
    const quantumOf = (q) => config.queues[q].quantum;

    const ticks = [];       // una entrada por unidad de tiempo ejecutada
    const snapshots = [];   // una entrada por instante t (incluye el instante final)
    const allEvents = [];
    let cpu = null;         // { proc, qLeft }
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

    const maxArrival = Math.max(...input.map((p) => p.arrival));
    const maxTime = input.reduce((s, p) => s + p.burst, 0) + maxArrival + 2;

    /** Cola que debe tener la CPU en este instante según la política entre colas. */
    function selectQueue() {
      const cand = queueIndices.filter((q) => ready[q].length > 0 || (cpu && cpu.proc.queue === q));
      if (!cand.length) return { q: null, kind: null };
      if (!percentMode) return { q: cand[0], kind: 'priority' };
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
        const what = alg === 'SJF' ? 'la menor ráfaga' : 'el menor tiempo restante';
        const note = resumed ? ' (había sido interrumpido y conserva su tiempo restante)' : '';
        if (only) return `${head} porque es el único proceso listo de la cola${note}.`;
        const tie = next && next.remaining === chosen.remaining ? '; hay empate, así que se elige el que llegó primero o, si persiste, el de menor identificador' : '';
        return `${head} porque tiene ${what} entre los procesos listos (${chosen.remaining} unidades)${tie}${note}.`;
      }
      const note = resumed ? ' Había sido interrumpido: conserva su tiempo restante pero recibe un quantum nuevo.' : '';
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
        if (percentMode && q !== cq) {
          const why = quotaLeft[q] <= 0
            ? `la cola ${qName(q)} ya consumió su cuota (${quotaAlloc[q]} unidades) de este ciclo`
            : `ahora le corresponde a la cola ${qName(cq)} y la cola ${qName(q)} sigue después, por orden de prioridad dentro del ciclo`;
          lines.push(`Esperan en la cola ${qName(q)}: ${ids}. ${why[0].toUpperCase()}${why.slice(1)}.`);
        } else if (q > cq) {
          lines.push(`Esperan en la cola ${qName(q)}: ${ids}. La cola ${qName(cq)} tiene mayor prioridad y la CPU está ocupada por ${cpu.proc.id}.`);
        } else if (q === cq) {
          const why = {
            FCFS: 'FCFS atiende por orden de llegada y no interrumpe al proceso que ya está ejecutando.',
            SJF: 'SJF no interrumpe al proceso en ejecución, aunque haya uno más corto esperando.',
            SRTF: 'ninguno tiene un tiempo restante estrictamente menor que el del proceso en ejecución.',
            RR: 'deben esperar su turno en la cola circular hasta que se agote el quantum.'
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
      if (procs.every((p) => p.state === 'done')) {
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

      /* (d) Decisión entre colas: ¿se interrumpe al proceso actual? */
      const sel = selectQueue();
      const top = sel.q;
      selKind = sel.kind;
      if (cpu) {
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
        } else if (algOf(cq) === 'SRTF') {
          const best = orderedReady(ready[cq], 'SRTF')[0];
          if (best && best.remaining < old.remaining) {
            add('preempt',
              `${old.id} es interrumpido porque ${best.id} tiene menor tiempo restante (${best.remaining} < ${old.remaining}) en la misma cola (SRTF). ` +
              `${old.id} conserva su tiempo restante y vuelve a esperar en la cola ${qName(cq)}.`,
              { pid: old.id, queue: cq, cause: 'srtf' });
            old.state = 'interrupted';
            ready[cq].push(old);
            preemptions++;
            cpu = null;
          }
        }
      }

      /* (e) Despacho: si la CPU está libre se elige cola y luego proceso */
      let dispatched = false, ctxFrom = null, sameAsBefore = false, queueReason = null, dispatchText = null;
      if (!cpu) {
        const q = top;
        if (q !== null) {
          const candidates = orderedReady(ready[q], algOf(q));
          const chosen = candidates[0];
          ready[q].splice(ready[q].indexOf(chosen), 1);
          const resumed = chosen.state === 'interrupted';
          chosen.state = 'running';
          if (chosen.firstStart === null) chosen.firstStart = t;
          cpu = { proc: chosen, qLeft: algOf(q) === 'RR' ? quantumOf(q) : null };
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
        let why = '';
        if (a === 'FCFS' || a === 'SJF') why = `${ALGORITHMS[a].short} es no apropiativo: un proceso que ya empezó no se interrumpe dentro de su cola.`;
        else if (a === 'SRTF') why = `ningún proceso listo de su cola tiene un tiempo restante menor que ${p.remaining}.`;
        else why = `le quedan ${cpu.qLeft} unidades de quantum.`;
        let sup;
        if (percentMode) sup = selKind === 'quota'
          ? ` A la cola ${qName(p.queue)} le quedan ${quotaLeft[p.queue]} de ${quotaAlloc[p.queue]} unidades de cuota en este ciclo (incluida la actual).`
          : ` La cola ${qName(p.queue)} ya agotó su cuota, pero las demás colas con procesos también: usa el tiempo sobrante.`;
        else sup = p.queue === 0 ? '' : ' Las colas de mayor prioridad no tienen procesos listos.';
        lines.push({ type: 'info', text: `${p.id} continúa ejecutándose en la cola ${qName(p.queue)}: ${why}${sup}` });
      }
      waitingLines().forEach((l) => lines.push({ type: 'wait', text: l }));
      if (!cpu) lines.push({ type: 'idle', text: 'No hay ningún proceso listo; la CPU espera la llegada del siguiente proceso.' });

      snapshots.push(makeSnapshot(t, ev, lines, top, { dispatched }));
      ev.forEach((e) => allEvents.push(e));

      /* (g) Ejecutar el intervalo [t, t+1) */
      if (cpu) {
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
        } else if (algOf(p.queue) === 'RR' && cpu.qLeft === 0) {
          expired = { proc: p, q: p.queue };
          cpu = null;
        }
      } else {
        ticks.push({ t, pid: null, queue: null, dispatch: false, ctxFrom: null });
        lastRunPid = null;
      }
      t++;
    }

    /** Instantánea del estado en el instante t (antes de ejecutar el intervalo [t, t+1)). */
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
          quantum: algOf(cpu.proc.queue) === 'RR' ? quantumOf(cpu.proc.queue) : null, qLeft: cpu.qLeft
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

  /* ===================================================================
     3. MÉTRICAS
     =================================================================== */
  function computeMetrics(procs, busy, makespan, contextSwitches, preemptions, cpuByQueue, numQueues) {
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

  /* ===================================================================
     4. INTERFAZ DE USUARIO
     =================================================================== */
  /* Solo se monta la interfaz si existe un DOM (en Node se usa únicamente el motor). */
  function initUI() {
    const $ = (sel, root) => (root || document).querySelector(sel);
    const CELL = 38; // ancho en px de cada unidad de tiempo en el Gantt

    /** Creador de nodos DOM. Todo el texto entra como nodo de texto (sin innerHTML con datos del usuario). */
    function el(tag, props, ...children) {
      const e = document.createElement(tag);
      if (props) {
        Object.keys(props).forEach((k) => {
          const v = props[k];
          if (v === false || v == null) return;
          if (k === 'class') e.className = v;
          else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
          else e.setAttribute(k, v === true ? '' : v);
        });
      }
      children.flat().forEach((c) => { if (c == null || c === false) return; e.append(c.nodeType ? c : document.createTextNode(String(c))); });
      return e;
    }
    const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

    /* ---------- estado de la aplicación ---------- */
    const App = {
      processes: SCENARIOS.base.processes.map((p) => Object.assign({}, p)),
      config: DEFAULT_CONFIG(),
      sim: null,          // resultado de simulate() (la "película")
      cursor: -1,         // índice de la instantánea mostrada (-1 = aún no iniciada)
      status: 'idle',     // idle | running | paused | finished
      timer: null,
      chips: new Map(),
      prevDone: new Set(),
      ganttMs: 300,
      colors: new Map(),
      cfgUI: [],
      board: {}
    };

    /* ---------- colores por proceso (tonos de la cola a la que pertenece) ---------- */
    function luminance(hex) {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function mixHex(hex, targetHex, ratio) {
      const p = (h, i) => parseInt(h.slice(i, i + 2), 16);
      const ch = [1, 3, 5].map((i) => Math.round(p(hex, i) * (1 - ratio) + p(targetHex, i) * ratio));
      return '#' + ch.map((v) => v.toString(16).padStart(2, '0')).join('');
    }
    function rebuildColors() {
      App.colors.clear();
      const count = Array(App.config.queues.length).fill(0);
      App.processes.forEach((p) => {
        const q = Math.min(Math.max(0, p.queue), App.config.queues.length - 1);
        const pal = queuePalette(q);
        const bg = pal.shades[count[q]++ % pal.shades.length];
        App.colors.set(p.id, { bg, fg: luminance(bg) > 0.4 ? '#111827' : '#ffffff' });
      });
    }

    /* ---------- utilidades de interfaz ---------- */
    let toastTimer = null;
    function toast(msg) {
      const t = $('#toast');
      t.textContent = msg; t.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
    }
    const snapNow = () => (App.sim && App.cursor >= 0 ? App.sim.snapshots[App.cursor] : null);
    const lastIndex = () => (App.sim ? App.sim.snapshots.length - 1 : -1);
    const delayMs = () => Math.round(1700 - Number($('#speed').value) * 150);

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
        for (let i = 0; i < pctArr.length; i++) if (pctArr[i] > 1 && (best === -1 || pctArr[i] > pctArr[best])) best = i;
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

    /* ===============================================================
       Configuración de las colas
       =============================================================== */
    function renderQueueSelect() {
      const sel = $('#f-queue');
      if (!sel) return;
      const prev = Number(sel.value);
      sel.textContent = '';
      const total = App.config.queues.length;
      App.config.queues.forEach((_, i) => {
        const name = queueName(App.config, i);
        const prio = queuePriorityLabel(i, total).toLowerCase();
        sel.append(el('option', { value: String(i) }, `Cola ${i + 1} · ${name} (${prio})`));
      });
      if (Number.isInteger(prev) && prev >= 0 && prev < total) sel.value = String(prev);
      else sel.value = String(Math.min(1, total - 1));
    }

    function renderGanttLegend() {
      const legend = $('#gantt-legend');
      if (!legend) return;
      legend.textContent = '';
      App.config.queues.forEach((_, i) => {
        const pal = queuePalette(i);
        legend.append(el('span', null, el('i', { class: 'lg', style: `background:${pal.base}` }), queueName(App.config, i)));
      });
      legend.append(
        el('span', null, el('b', { class: 'mk mk-ctx' }, '⇄'), ' cambio de contexto'),
        el('span', null, el('b', { class: 'mk mk-pre' }, '▼'), ' interrupción'),
        el('span', null, el('b', { class: 'mk mk-fin' }, '✔'), ' finalización'));
    }

    function onQueueStructureChange(processesChanged) {
      buildConfig();
      renderQueueSelect();
      buildBoard();
      renderGanttLegend();
      onModelChange(processesChanged);
    }

    function moveQueue(idx, dir) {
      const target = idx + dir;
      const qs = App.config.queues;
      if (target < 0 || target >= qs.length) return;
      [qs[idx], qs[target]] = [qs[target], qs[idx]];
      const pc = App.config.percent;
      [pc[idx], pc[target]] = [pc[target], pc[idx]];
      App.processes.forEach((p) => {
        if (p.queue === idx) p.queue = target;
        else if (p.queue === target) p.queue = idx;
      });
      onQueueStructureChange(true);
      toast(`Prioridad actualizada: ${queueName(App.config, target)} ahora es Cola ${target + 1}.`);
    }

    function removeQueue(idx) {
      if (App.config.queues.length <= 1) { toast('Debe existir al menos una cola.'); return; }
      const removedName = queueName(App.config, idx);
      App.config.queues.splice(idx, 1);
      rebalancePercentRemove(App.config.percent, idx);
      const newLen = App.config.queues.length;
      const fallback = Math.min(idx, newLen - 1);
      let moved = 0;
      App.processes.forEach((p) => {
        if (p.queue === idx) { p.queue = fallback; moved++; }
        else if (p.queue > idx) p.queue--;
      });
      onQueueStructureChange(true);
      toast(moved
        ? `Cola "${removedName}" eliminada. ${moved} proceso(s) pasaron a ${queueName(App.config, fallback)}.`
        : `Cola "${removedName}" eliminada.`);
    }

    function addQueueFromForm(ev) {
      ev.preventDefault();
      const msg = $('#queue-form-msg');
      const total = App.config.queues.length;
      const nameRaw = $('#qf-name').value.trim() || `Cola ${total + 1}`;
      const algorithm = $('#qf-alg').value;
      const quantum = algorithm === 'RR' ? Number($('#qf-quantum').value) : 2;
      let err = '';
      if (total >= MAX_QUEUES) err = `Máximo ${MAX_QUEUES} colas para mantener la simulación legible.`;
      else if (nameRaw.length > 24) err = 'El nombre de la cola debe tener como máximo 24 caracteres.';
      else if (App.config.queues.some((_, i) => queueName(App.config, i).toLowerCase() === nameRaw.toLowerCase())) err = `Ya existe una cola llamada "${nameRaw}".`;
      else if (!ALGORITHMS[algorithm]) err = 'Algoritmo inválido.';
      else if (algorithm === 'RR' && (!Number.isInteger(quantum) || quantum < 1 || quantum > 99)) err = 'El quantum debe ser un entero entre 1 y 99.';
      msg.textContent = err;
      if (err) return;

      App.config.queues.push({
        name: nameRaw,
        description: 'Cola personalizada agregada para la simulación.',
        algorithm,
        quantum: Number.isInteger(quantum) && quantum >= 1 ? quantum : 2
      });
      rebalancePercentAdd(App.config.percent, App.config.queues.length);
      if (App.config.cycle < App.config.queues.length) App.config.cycle = App.config.queues.length;
      $('#qf-name').value = '';
      onQueueStructureChange(true);
      toast(`Cola "${nameRaw}" agregada como Cola ${App.config.queues.length}.`);
      $('#qf-name').focus();
    }

    function syncQueueFormQuantum() {
      const alg = $('#qf-alg');
      const qWrap = $('#qf-quantum-wrap');
      if (!alg || !qWrap) return;
      const show = ALGORITHMS[alg.value] && ALGORITHMS[alg.value].usesQuantum;
      qWrap.style.display = show ? '' : 'none';
    }

    function buildConfig() {
      const wrap = $('#queue-config');
      wrap.textContent = '';
      const total = App.config.queues.length;
      const maxPct = total === 1 ? 100 : 100 - (total - 1);
      App.cfgUI = App.config.queues.map((cfg, i) => {
        const name = queueName(App.config, i);
        const desc = queueDescription(App.config, i);
        const pal = queuePalette(i);

        const nameInput = el('input', {
          class: 'qname-input', type: 'text', maxlength: '24', value: name,
          'aria-label': `Nombre de la cola ${i + 1}`, title: 'Haz clic para editar el nombre de la cola'
        });
        nameInput.addEventListener('change', () => {
          const val = nameInput.value.trim();
          if (!val) { nameInput.value = queueName(App.config, i); toast('El nombre de la cola no puede estar vacío.'); return; }
          if (App.config.queues.some((_, j) => j !== i && queueName(App.config, j).toLowerCase() === val.toLowerCase())) {
            nameInput.value = queueName(App.config, i); toast(`Ya existe una cola llamada "${val}".`); return;
          }
          cfg.name = val;
          renderQueueSelect();
          renderGanttLegend();
          const laneTitle = App.board.laneHeads && App.board.laneHeads[i] && App.board.laneHeads[i].name;
          if (laneTitle) laneTitle.textContent = `Cola ${i + 1} · ${val}`;
          onModelChange(true);
        });

        const select = el('select', { id: `alg-${i}`, 'aria-label': `Algoritmo de la cola ${name}` },
          Object.keys(ALGORITHMS).map((k) => el('option', { value: k }, ALGORITHMS[k].label)));
        select.value = cfg.algorithm;
        select.addEventListener('change', () => { cfg.algorithm = select.value; onModelChange(); });

        const quantum = el('input', { id: `q-${i}`, type: 'number', min: '1', max: '99', step: '1', value: String(cfg.quantum) });
        quantum.addEventListener('change', () => {
          const v = Number(quantum.value);
          if (!Number.isInteger(v) || v < 1) { quantum.value = String(cfg.quantum); toast('El quantum debe ser un número entero mayor o igual a 1.'); return; }
          cfg.quantum = v; onModelChange();
        });
        const quantumWrap = el('label', { class: 'qfield' }, 'Quantum (unidades de tiempo)', quantum);
        const pctInput = el('input', { id: `pct-${i}`, type: 'number', min: '1', max: String(maxPct), step: '1', value: String(App.config.percent[i]) });
        pctInput.addEventListener('change', () => {
          const v = Number(pctInput.value);
          const curTotal = App.config.queues.length;
          const curMax = curTotal === 1 ? 100 : 100 - (curTotal - 1);
          if (!Number.isInteger(v) || v < 1 || v > curMax) {
            pctInput.value = String(App.config.percent[i]);
            toast(`El porcentaje debe ser un entero entre 1 y ${curMax}.`);
            return;
          }
          App.config.percent[i] = v; onModelChange();
        });
        const quotaTxt = el('span', { class: 'qquota' });
        const pctWrap = el('label', { class: 'qfield qpct' }, '% de la CPU', pctInput, quotaTxt);
        const modality = el('span', { class: 'mod-badge' });
        const note = el('p', { class: 'alg-note' });
        const pending = el('b', null, '0');
        const upBtn = el('button', { class: 'qtool', type: 'button', title: 'Subir prioridad', 'aria-label': `Subir prioridad de ${name}`, disabled: i === 0, onclick: () => moveQueue(i, -1) }, '↑');
        const downBtn = el('button', { class: 'qtool', type: 'button', title: 'Bajar prioridad', 'aria-label': `Bajar prioridad de ${name}`, disabled: i === total - 1, onclick: () => moveQueue(i, 1) }, '↓');
        const delBtn = el('button', { class: 'qtool qdel', type: 'button', title: `Eliminar ${name}`, 'aria-label': `Eliminar cola ${name}`, disabled: total <= 1, onclick: () => removeQueue(i) }, '✕');

        const card = el('article', { class: `qcard q${i}`, style: `--q-color:${pal.base};--q-soft:${pal.soft}` },
          el('header', null,
            el('div', { class: 'qhead-main' }, el('div', { class: 'qlevel' }, `Cola ${i + 1}`), nameInput),
            el('div', { class: 'qcard-tools' },
              el('span', { class: 'prio-pill', title: `Prioridad nivel ${i + 1} de ${total}` }, queuePriorityLabel(i, total)),
              upBtn, downBtn, delBtn)),
          el('p', { class: 'qdesc' }, desc),
          el('label', { class: 'qfield' }, 'Algoritmo interno', select),
          el('div', { class: 'qmeta' }, el('span', { class: 'lane-tag' }, 'Modalidad:'), modality),
          note,
          pctWrap,
          quantumWrap,
          el('div', { class: 'qpending' }, 'Procesos pendientes: ', pending));
        wrap.append(card);
        return { select, quantum, quantumWrap, modality, note, pending, pctInput, quotaTxt };
      });
      const qfName = $('#qf-name');
      if (qfName) qfName.placeholder = `Cola ${total + 1}`;
      updateConfigView();
    }

    /** Cuotas válidas del ciclo (o null si la configuración por porcentajes aún no es válida). */
    function currentQuotas() {
      const c = App.config;
      if (c.policy !== 'percent' || validateConfig(c).length) return null;
      return allocateQuotas(c.percent, c.cycle);
    }

    function updateConfigView() {
      const snap = snapNow();
      const percent = App.config.policy === 'percent';
      const total = App.config.queues.length;
      const minCycle = Math.max(3, total);
      document.querySelectorAll('input[name=policy]').forEach((r) => { r.checked = r.value === App.config.policy; });
      $('#panel-config').classList.toggle('percent-on', percent);
      $('#policy-extra').hidden = !percent;
      $('#cycle').min = String(minCycle);
      $('#cycle').value = String(App.config.cycle);
      const sum = App.config.percent.reduce((a, b) => a + b, 0);
      const sumEl = $('#pct-sum');
      sumEl.textContent = `Suma: ${sum} %`;
      sumEl.classList.toggle('bad', sum !== 100);
      const errs = percent ? validateConfig(App.config) : [];
      $('#policy-msg').textContent = errs.join(' ');
      const quotas = currentQuotas();
      App.cfgUI.forEach((u, i) => {
        u.pctInput.value = String(App.config.percent[i]);
        u.quotaTxt.textContent = '';
        if (quotas) u.quotaTxt.append('Cuota: ', el('b', null, String(quotas[i])), ` de ${App.config.cycle} unidades por ciclo`);
      });
      App.cfgUI.forEach((u, i) => {
        const cfg = App.config.queues[i], alg = ALGORITHMS[cfg.algorithm];
        u.select.value = cfg.algorithm;
        u.quantum.value = String(cfg.quantum);
        u.quantumWrap.style.display = alg.usesQuantum ? '' : 'none';
        u.modality.textContent = alg.modality;
        u.modality.classList.toggle('pre', alg.modality.startsWith('Apropiativo'));
        u.note.textContent = alg.note;
        u.pending.textContent = snap ? snap.pending[i] : App.processes.filter((p) => p.queue === i).length;
      });
      // Cabeceras de las pistas del tablero
      App.config.queues.forEach((cfg, i) => {
        const h = App.board.laneHeads && App.board.laneHeads[i];
        if (!h) return;
        h.pref.textContent = percent ? '★ Turno de CPU' : '★ Preferencia de CPU';
        const alg = ALGORITHMS[cfg.algorithm];
        h.alg.textContent = alg.short + (alg.usesQuantum ? ` · q = ${cfg.quantum}` : '');
        h.mod.textContent = alg.modality;
        const n = snap ? snap.pending[i] : App.processes.filter((p) => p.queue === i).length;
        h.pend.textContent = `${n} pendiente${n === 1 ? '' : 's'}`;
      });
    }

    /* ===============================================================
       Procesos: formulario y lista
       =============================================================== */
    function nextId() {
      let max = 0;
      App.processes.forEach((p) => { const m = /^P(\d+)$/i.exec(p.id); if (m) max = Math.max(max, Number(m[1])); });
      return `P${max + 1}`;
    }
    function renderProcList() {
      rebuildColors();
      const list = $('#proc-list');
      list.textContent = '';
      App.processes.forEach((p) => {
        const c = App.colors.get(p.id);
        list.append(el('div', { class: 'pcard' },
          el('div', { class: 'pbadge', style: `background:${c.bg};color:${c.fg}` }, p.id),
          el('div', { class: 'pname' }, `Proceso ${p.id}`),
          el('div', { class: 'pdata' }, `llegada ${p.arrival} · ráfaga ${p.burst}`),
          el('div', { class: 'pq' }, `Cola ${queueName(App.config, p.queue)}`),
          el('button', { class: 'pdel', type: 'button', title: `Eliminar ${p.id}`, 'aria-label': `Eliminar ${p.id}`, onclick: () => { App.processes = App.processes.filter((x) => x.id !== p.id); onModelChange(true); } }, '✕')));
      });
      $('#f-id').placeholder = nextId();
      buildChips();
    }
    function addProcessFromForm(ev) {
      ev.preventDefault();
      const msg = $('#form-msg');
      const idRaw = $('#f-id').value.trim() || nextId();
      const arrival = Number($('#f-arrival').value), burst = Number($('#f-burst').value), queue = Number($('#f-queue').value);
      let err = '';
      if (!/^[A-Za-z0-9_-]{1,8}$/.test(idRaw)) err = 'El identificador debe tener 1 a 8 caracteres (letras, números, guion).';
      else if (App.processes.some((p) => p.id.toLowerCase() === idRaw.toLowerCase())) err = `Ya existe un proceso llamado ${idRaw}.`;
      else if (!Number.isInteger(arrival) || arrival < 0 || arrival > 1000) err = 'El tiempo de llegada debe ser un entero entre 0 y 1000.';
      else if (!Number.isInteger(burst) || burst < 1 || burst > 1000) err = 'La ráfaga debe ser un entero entre 1 y 1000.';
      else if (!Number.isInteger(queue) || queue < 0 || queue >= App.config.queues.length) err = 'Cola seleccionada inválida.';
      else if (App.processes.length >= 30) err = 'Máximo 30 procesos para mantener la simulación legible.';
      msg.textContent = err;
      if (err) return;
      App.processes.push({ id: idRaw, arrival, burst, queue });
      $('#f-id').value = '';
      onModelChange(true);
      $('#f-id').focus();
    }
    function ensureMinQueues(minCount) {
      let changed = false;
      while (App.config.queues.length < minCount) {
        const i = App.config.queues.length;
        const def = DEFAULT_CONFIG();
        const template = def.queues[i] || { name: `Cola ${i + 1}`, description: `Cola de prioridad nivel ${i + 1}.`, algorithm: 'FCFS', quantum: 4 };
        App.config.queues.push(Object.assign({}, template));
        rebalancePercentAdd(App.config.percent, App.config.queues.length);
        changed = true;
      }
      return changed;
    }
    function loadScenario(key) {
      const sc = SCENARIOS[key];
      let structureChanged = false;
      if (sc.config) {
        App.config = JSON.parse(JSON.stringify(sc.config));
        structureChanged = true;
      } else {
        const maxQ = Math.max(...sc.processes.map((p) => p.queue), 2);
        structureChanged = ensureMinQueues(maxQ + 1);
      }
      App.processes = sc.processes.map((p) => Object.assign({}, p));
      $('#form-msg').textContent = '';
      $('#queue-form-msg').textContent = '';
      if (structureChanged) onQueueStructureChange(true);
      else onModelChange(true);
      toast(`${sc.name} cargado.`);
    }

    /** Cualquier cambio en procesos o configuración invalida la simulación en curso. */
    function onModelChange(processesChanged) {
      const wasActive = App.status !== 'idle';
      stopTimer();
      App.sim = null; App.cursor = -1; App.status = 'idle';
      if (processesChanged) renderProcList();
      if (wasActive) toast('Se reinició la simulación porque cambiaste la configuración.');
      render();
    }

    /* ===============================================================
       Tablero: colas + CPU
       =============================================================== */
    const STATE_LABEL = { new: 'Nuevo', ready: 'Listo', running: 'Ejecutando', interrupted: 'Interrumpido', done: 'Finalizado' };

    function buildBoard() {
      const board = $('#board');
      board.textContent = '';
      const total = App.config.queues.length;
      board.style.setProperty('--q-count', String(total));
      const b = App.board;
      b.poolNew = el('div', { class: 'chips' });
      b.poolDone = el('div', { class: 'chips' });
      board.append(
        el('div', { class: 'pool pool-new' }, el('span', { class: 'pool-title' }, 'Nuevo · aún no llega'), b.poolNew));
      b.lanes = []; b.laneHeads = []; b.arrows = [];
      App.config.queues.forEach((_, i) => {
        const pal = queuePalette(i);
        const nameEl = el('span', { class: 'lane-name' }, `Cola ${i + 1} · ${queueName(App.config, i)}`);
        const head = { name: nameEl, alg: el('span', { class: 'lane-tag' }), mod: el('span', { class: 'lane-tag' }), pend: el('span', { class: 'lane-tag' }), share: el('span', { class: 'lane-tag share' }), pref: el('span', { class: 'lane-pref' }, '★ Preferencia de CPU') };
        const area = el('div', { class: 'lane-area' });
        const lane = el('div', { class: `lane q${i}`, style: `--q-row:${i + 2};--q-color:${pal.base};--q-soft:${pal.soft}` },
          el('div', { class: 'lane-head' },
            nameEl,
            el('span', { class: 'lane-tag prio' }, queuePriorityLabel(i, total)),
            head.alg, head.mod, head.pend, head.share, head.pref),
          area);
        b.lanes.push({ lane, area }); b.laneHeads.push(head);
        board.append(lane);
      });
      const arrows = el('div', { class: 'arrows' });
      App.config.queues.forEach(() => {
        const a = el('div', { class: 'arrow' });
        a.innerHTML = '<svg viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h36M30 4l9 8-9 8"/></svg>';
        b.arrows.push(a); arrows.append(a);
      });
      b.cpuSlot = el('div', { class: 'cpu-slot' });
      b.cpuTime = el('span', { class: 'cpu-time' }, '');
      b.cpuCycleDt = el('dt', null, 'Ciclo'); b.cpuCycle = el('dd', null, '—'); b.cpuQueue = el('dd', null, '—'); b.cpuAlg = el('dd', null, '—'); b.cpuExec = el('dd', null, '—'); b.cpuRem = el('dd', null, '—'); b.cpuQ = el('dd', null, '—');
      b.cpuBar = el('i'); b.cpuDots = el('div', { class: 'cpu-q' }); b.cpuPref = el('div', { class: 'cpu-pref' });
      b.cpu = el('div', { class: 'cpu idle', 'aria-live': 'polite' },
        el('div', { class: 'cpu-title' }, el('span', null, 'CPU'), b.cpuTime),
        b.cpuSlot,
        el('div', { class: 'cpu-bar', title: 'Progreso de la ráfaga' }, b.cpuBar),
        el('dl', { class: 'cpu-info' },
          el('dt', null, 'Cola de origen'), b.cpuQueue,
          el('dt', null, 'Algoritmo'), b.cpuAlg,
          el('dt', null, 'Ejecutado'), b.cpuExec,
          el('dt', null, 'Restante'), b.cpuRem,
          el('dt', null, 'Quantum restante'), b.cpuQ,
          b.cpuCycleDt, b.cpuCycle),
        b.cpuDots, b.cpuPref);
      board.append(arrows, b.cpu,
        el('div', { class: 'pool pool-done' }, el('span', { class: 'pool-title' }, 'Finalizado'), b.poolDone));
    }

    function buildChips() {
      App.chips.clear();
      const b = App.board;
      if (!b.poolNew) return;
      [b.poolNew, b.poolDone, b.cpuSlot].concat(b.lanes.map((l) => l.area)).forEach((c) => { c.textContent = ''; });
      App.processes.forEach((p) => {
        const c = App.colors.get(p.id);
        const chip = el('div', { class: 'proc-chip st-new', 'data-pid': p.id, style: `background:${c.bg};color:${c.fg};border-color:rgba(0,0,0,.35)` },
          el('div', { class: 'pc-top' }, el('span', { class: 'pc-id' }, p.id), el('span', { class: 'pc-st' }, 'Nuevo')),
          el('div', { class: 'pc-data' }, ''),
          el('div', { class: 'pc-bar' }, el('i')));
        chip.addEventListener('animationend', () => chip.classList.remove('moved'));
        chip._at = null;
        App.chips.set(p.id, chip);
      });
    }

    function place(container, key, ids) {
      ids.forEach((id, i) => {
        const chip = App.chips.get(id);
        if (!chip) return;
        if (chip._at !== key) {
          const first = chip._at === null;
          chip._at = key;
          if (!first) { chip.classList.remove('moved'); void chip.offsetWidth; chip.classList.add('moved'); }
        }
        if (container.children[i] !== chip) container.insertBefore(chip, container.children[i] || null);
      });
    }

    function renderBoard() {
      const b = App.board, snap = snapNow();
      const info = new Map();
      const target = { new: [], done: [], cpu: [], lanes: Array.from({ length: App.config.queues.length }, () => []) };
      if (!snap) {
        App.processes.forEach((p) => { info.set(p.id, { state: 'new', remaining: p.burst, executed: 0, burst: p.burst, arrival: p.arrival }); target.new.push(p.id); });
      } else {
        snap.procs.forEach((p) => {
          info.set(p.id, p);
          if (p.state === 'new') target.new.push(p.id);
          else if (p.state === 'done') target.done.push(p.id);
          else if (p.state === 'running') target.cpu.push(p.id);
        });
        snap.queues.forEach((ids, q) => { target.lanes[q] = ids; });
      }
      info.forEach((p, id) => {
        const chip = App.chips.get(id); if (!chip) return;
        chip.className = `proc-chip st-${p.state}` + (chip.classList.contains('moved') ? ' moved' : '');
        chip.querySelector('.pc-st').textContent = STATE_LABEL[p.state];
        const fin = App.sim ? App.sim.metrics.perProcess.find((m) => m.id === id) : null;
        chip.querySelector('.pc-data').textContent = p.state === 'new' ? `llega t=${p.arrival} · ráf ${p.burst}`
          : p.state === 'done' ? `fin t=${fin ? fin.finish : '?'}` : `resta ${p.remaining}/${p.burst}`;
        chip.querySelector('.pc-bar i').style.width = `${(p.executed / p.burst) * 100}%`;
        chip.title = `${id} · llegada ${p.arrival} · ráfaga ${p.burst} · restante ${p.remaining} · ${STATE_LABEL[p.state]}`;
      });
      place(b.poolNew, 'new', target.new);
      place(b.poolDone, 'done', target.done);
      place(b.cpuSlot, 'cpu', target.cpu);
      b.lanes.forEach((l, q) => place(l.area, `lane${q}`, target.lanes[q]));

      // Política por porcentajes: cuota de cada cola y posición dentro del ciclo
      const percent = App.config.policy === 'percent';
      const quotas = currentQuotas();
      b.laneHeads.forEach((h, q) => {
        h.share.style.display = percent ? '' : 'none';
        if (!percent) return;
        const cyc = snap && snap.cycle;
        h.share.textContent = cyc ? `${App.config.percent[q]} % · cuota ${cyc.left[q]}/${cyc.quota[q]}`
          : (quotas ? `${App.config.percent[q]} % · ${quotas[q]} u/ciclo` : `${App.config.percent[q]} %`);
      });
      b.cpuCycleDt.style.display = b.cpuCycle.style.display = percent ? '' : 'none';
      b.cpuCycle.textContent = snap && snap.cycle ? `${snap.cycle.index + 1} · u. ${snap.cycle.pos + 1}/${snap.cycle.length}` : '—';

      // Preferencia entre colas
      const pref = snap ? snap.preferredQueue : null;
      b.lanes.forEach((l, q) => l.lane.classList.toggle('has-pref', pref === q));
      b.arrows.forEach((a, q) => a.classList.toggle('active', pref === q));

      // CPU
      const cpu = snap ? snap.cpu : null;
      b.cpu.classList.toggle('idle', !cpu);
      b.cpuTime.textContent = snap ? `t = ${snap.t}` : 'detenida';
      b.cpuSlot.dataset.msg = snap && App.cursor === lastIndex() ? 'Simulación terminada' : '';
      if (cpu) {
        b.cpuQueue.textContent = queueName(App.config, cpu.queue);
        b.cpuAlg.textContent = ALGORITHMS[cpu.algorithm].short;
        b.cpuExec.textContent = `${cpu.executed} / ${cpu.burst}`;
        b.cpuRem.textContent = String(cpu.remaining);
        b.cpuQ.textContent = cpu.quantum === null ? 'n/a' : `${cpu.qLeft} / ${cpu.quantum}`;
        b.cpuBar.style.width = `${(cpu.executed / cpu.burst) * 100}%`;
        b.cpuDots.textContent = '';
        if (cpu.quantum !== null && cpu.quantum <= 14) for (let i = 0; i < cpu.quantum; i++) b.cpuDots.append(el('i', { class: i < cpu.qLeft ? '' : 'off' }));
      } else {
        [b.cpuQueue, b.cpuAlg, b.cpuExec, b.cpuRem, b.cpuQ].forEach((d) => { d.textContent = '—'; });
        b.cpuBar.style.width = '0'; b.cpuDots.textContent = '';
      }
      b.cpuPref.textContent = '';
      b.cpuPref.append(percent ? 'Cola atendida (reparto por ciclo): ' : 'Cola con preferencia: ', el('b', null, pref === null ? (snap ? 'ninguna (sin procesos listos)' : '—') : queueName(App.config, pref)));
    }

    /* ===============================================================
       ¿Qué está pasando? + registro
       =============================================================== */
    const ICONS = { cycle: '↻', arrival: '➜', finish: '✔', queue: '◆', dispatch: '▶', quantum: '⏱', preempt: '⚡', context: '⇄', idle: '…', info: 'ℹ', wait: '⏳' };

    function renderExplain() {
      const box = $('#explain'), snap = snapNow();
      box.textContent = '';
      $('#explain-time').textContent = snap ? `Tiempo ${snap.t}` : '—';
      if (!snap) {
        box.append(el('p', { class: 'explain-intro' },
          'Pulsa ', el('strong', null, 'Iniciar simulación'), ' para ver la ejecución automática, o ', el('strong', null, 'Siguiente paso'),
          ' para avanzar una unidad de tiempo y leer aquí, en lenguaje sencillo, por qué el planificador toma cada decisión.'));
        return;
      }
      snap.explain.forEach((l) => box.append(el('div', { class: `ex-line t-${l.type}` }, el('span', { class: 'ico', 'aria-hidden': 'true' }, ICONS[l.type] || '•'), el('span', null, l.text))));
    }

    function renderLog() {
      const ol = $('#log');
      ol.textContent = '';
      const events = App.sim && App.cursor >= 0 ? App.sim.snapshots.slice(0, App.cursor + 1).flatMap((s) => s.events) : [];
      events.forEach((e) => ol.append(el('li', { class: `e-${e.type}` }, el('span', { class: 'lt' }, `Tiempo ${e.t}:`), el('span', { class: 'li', 'aria-hidden': 'true' }, ICONS[e.type] || '•'), el('span', null, e.text))));
      $('#log-count').textContent = `${events.length} evento${events.length === 1 ? '' : 's'}`;
      ol.scrollTop = ol.scrollHeight;
    }

    /* ===============================================================
       Diagrama de Gantt
       =============================================================== */
    const G = { sim: null, track: null, strip: null, axis: null, scroll: null, segs: [], marks: new Map() };

    /** Agrupa los ticks en segmentos: se corta por cambio de proceso o por un nuevo despacho (p. ej. quantum agotado). */
    function computeSegs(ticks) {
      const segs = [];
      ticks.forEach((tk) => {
        const last = segs[segs.length - 1];
        if (last && last.pid === tk.pid && !tk.dispatch && last.end === tk.t) last.end = tk.t + 1;
        else segs.push({ pid: tk.pid, queue: tk.queue, start: tk.t, end: tk.t + 1 });
      });
      return segs;
    }

    /**
     * El Gantt es persistente: no se redibuja en cada paso. El bloque en curso crece con una
     * transición lineal cuya duración es la del paso, así que "se va cargando" de forma continua.
     */
    function renderGantt() {
      const host = $('#gantt');
      if (!App.sim || App.cursor < 0) {
        if (G.sim !== null || !host.firstChild) {
          host.textContent = '';
          host.append(el('div', { class: 'gantt-empty' }, 'El diagrama se irá cargando aquí, unidad por unidad, cuando inicies la simulación.'));
          G.sim = null; G.segs = []; G.marks.clear();
        }
        return;
      }
      const sim = App.sim, M = sim.makespan, cur = App.cursor;

      if (G.sim !== sim) { // esqueleto: pista gris completa + eje hasta el makespan
        host.textContent = '';
        G.sim = sim; G.segs = []; G.marks.clear();
        G.track = el('div', { class: 'g-track', style: `background-size:${100 / M}% 100%` });
        G.strip = el('div', { class: 'g-strip' });
        G.axis = el('div', { class: 'g-axis' });
        const inner = el('div', { class: 'g-inner', style: `min-width:${M * 26}px` }, G.strip, G.track, G.axis);
        G.scroll = el('div', { class: 'g-scroll' }, inner);
        host.append(G.scroll);
        if (sim.config.policy === 'percent') {
          for (let k = sim.config.cycle; k < M; k += sim.config.cycle) G.track.append(el('div', { class: 'g-cycle', style: `left:${(k / M) * 100}%`, title: `Inicio del ciclo ${k / sim.config.cycle + 1}` }));
        }
        const px = Math.max(26, (host.clientWidth || 800) / M);
        const step = Math.max(1, Math.ceil(34 / px));
        const ticks = [];
        for (let i = 0; i < M; i += step) ticks.push(i);
        ticks.push(M);
        ticks.forEach((i) => G.axis.append(el('span', { class: 'g-tick', style: `left:${(i / M) * 100}%` }, String(i))));
      }
      host.style.setProperty('--gdur', `${App.ganttMs}ms`);

      const ticks = sim.ticks.slice(0, cur + 1);
      const segs = computeSegs(ticks);
      while (G.segs.length > segs.length) G.segs.pop().remove();
      segs.forEach((s, i) => {
        let node = G.segs[i];
        const created = !node;
        if (created) {
          node = el('div', { class: 'g-block', style: `left:${(s.start / M) * 100}%;width:0%` });
          G.track.append(node); G.segs[i] = node;
          node.getBoundingClientRect(); // fuerza el reflujo para que el ancho 0 → N% se anime
        }
        const c = s.pid === null ? null : (App.colors.get(s.pid) || { bg: '#6b7280', fg: '#fff' });
        node.className = 'g-block' + (s.pid === null ? ' idle' : '') + (i === segs.length - 1 && cur < sim.ticks.length ? ' live' : '');
        node.style.left = `${(s.start / M) * 100}%`;
        node.style.background = c ? c.bg : '';
        node.style.color = c ? c.fg : '';
        node.textContent = s.pid === null ? 'ocio' : s.pid;
        node.title = s.pid === null ? `CPU ociosa · t=${s.start}→${s.end}` : `${s.pid} · cola ${queueName(sim.config, s.queue)} · t=${s.start}→${s.end}`;
        node.style.width = `${((s.end - s.start) / M) * 100}%`;
      });

      // marcas: interrupciones, finalizaciones y cambios de contexto (aparecen al llegar su instante)
      const wanted = new Map();
      sim.snapshots.slice(0, cur + 1).forEach((snap) => snap.events.forEach((e) => {
        if (e.type === 'preempt') wanted.set(`p${e.t}${e.pid}`, { cls: 'pre', parent: G.strip, t: e.t, txt: '▼', title: `t=${e.t}: ${e.pid} interrumpido` });
        else if (e.type === 'context') wanted.set(`c${e.t}`, { cls: 'ctx', parent: G.strip, t: e.t, txt: '⇄', title: `t=${e.t}: cambio de contexto ${e.from} → ${e.to}` });
        else if (e.type === 'finish') wanted.set(`f${e.t}${e.pid}`, { cls: 'fin', parent: G.track, t: e.t, txt: '✔', title: `t=${e.t}: ${e.pid} finaliza` });
      }));
      G.marks.forEach((node, k) => { if (!wanted.has(k)) { node.remove(); G.marks.delete(k); } });
      wanted.forEach((w, k) => {
        if (G.marks.has(k)) return;
        const node = el('span', { class: `g-mark ${w.cls}`, style: `left:${(w.t / M) * 100}%`, title: w.title }, w.txt);
        w.parent.append(node); G.marks.set(k, node);
      });

      // seguir el avance si la pista es más ancha que la pantalla
      if (G.scroll.scrollWidth > G.scroll.clientWidth) {
        const x = ((cur + 1) / M) * G.scroll.scrollWidth - G.scroll.clientWidth + 80;
        G.scroll.scrollTo({ left: Math.max(0, x), behavior: App.status === 'running' ? 'smooth' : 'auto' });
      }
    }

    /* ===============================================================
       Cronograma matricial por proceso (Gantt en tabla)
       =============================================================== */
    const GT = { sim: null, scroll: null, headCols: [], rows: [] };

    function renderGanttTable() {
      const host = $('#gantt-table');
      if (!host) return;
      if (!App.sim || App.cursor < 0) {
        if (GT.sim !== null || !host.firstChild) {
          host.textContent = '';
          host.append(el('div', { class: 'gantt-empty' }, 'La matriz de ejecución por proceso se completará aquí, unidad por unidad, cuando inicies la simulación.'));
          GT.sim = null; GT.scroll = null; GT.headCols = []; GT.rows = [];
        }
        return;
      }
      const sim = App.sim, M = sim.makespan, cur = App.cursor, snap = snapNow();

      if (GT.sim !== sim) {
        host.textContent = '';
        GT.sim = sim; GT.headCols = []; GT.rows = [];
        const timeHeaders = Array.from({ length: M + 1 }, (_, t) => {
          const th = el('th', { class: 'gt-col-t', scope: 'col' }, String(t));
          GT.headCols.push(th);
          return th;
        });
        const thead = el('thead', null, el('tr', null,
          el('th', { class: 'gt-col-proc', scope: 'col' }, 't (u)'),
          timeHeaders,
          el('th', { class: 'gt-col-rem', scope: 'col', title: 'Tiempo restante durante la ejecución; al finalizar muestra el instante de término (t = Fin)' }, 'Restante / Fin')));

        const bodyRows = App.processes.map((p) => {
          const c = App.colors.get(p.id) || { bg: queuePalette(p.queue).base, fg: '#ffffff' };
          const waitBg = mixHex(c.bg, '#ffffff', 0.84);
          const m = sim.metrics.perProcess.find((x) => x.id === p.id);
          const cells = Array.from({ length: M + 1 }, () => {
            const box = el('div', { class: 'gt-cell gt-future' });
            return { td: el('td', { class: 'gt-td' }, box), box, sig: '' };
          });
          const remEl = el('span', { class: 'gt-rem-pill' }, '');
          const procBtn = el('span', {
            class: 'gt-proc-pill',
            style: `background:${c.bg};color:${c.fg}`,
            title: `${p.id} · Cola ${queueName(sim.config, p.queue)} · llegada ${p.arrival} · ráfaga ${p.burst}`
          }, p.id);
          const tr = el('tr', null,
            el('th', { class: 'gt-proc', scope: 'row' }, procBtn),
            cells.map((x) => x.td),
            el('td', { class: 'gt-rem' }, remEl));
          GT.rows.push({ proc: p, finish: m.finish, c, waitBg, cells, remEl });
          return tr;
        });
        const table = el('table', { class: 'gt-matrix' }, thead, el('tbody', null, bodyRows));
        GT.scroll = el('div', { class: 'gt-scroll' }, table);
        host.append(GT.scroll);
      }

      GT.headCols.forEach((th, t) => th.classList.toggle('is-now', t === cur));

      GT.rows.forEach(({ proc, finish, c, waitBg, cells, remEl }) => {
        const snapProc = snap.procs.find((x) => x.id === proc.id);
        const qLabel = queueName(sim.config, proc.queue);
        for (let t = 0; t <= M; t++) {
          const cell = cells[t];
          let cls, bg, fg, txt, title;
          if (t > cur) {
            cls = 'gt-cell gt-future'; bg = ''; fg = ''; txt = '';
            title = `${proc.id} · t = ${t}: pendiente`;
          } else if (t === finish) {
            cls = 'gt-cell gt-fin'; bg = ''; fg = ''; txt = 'F';
            title = `${proc.id} · t = ${t}: finaliza ejecución`;
          } else if (t < M && sim.ticks[t].pid === proc.id) {
            const isArr = t === proc.arrival;
            cls = 'gt-cell gt-run' + (isArr ? ' has-x' : '') + (t === cur ? ' is-live' : '');
            bg = c.bg; fg = c.fg; txt = isArr ? 'x' : '';
            title = `${proc.id} · t = ${t}: ${isArr ? 'llega y ejecuta en CPU' : 'ejecutando en CPU'} (${qLabel})`;
          } else if (t >= proc.arrival && t < finish) {
            const isArr = t === proc.arrival;
            cls = 'gt-cell gt-wait' + (isArr ? ' has-x' : '');
            bg = waitBg; fg = '#1f2937'; txt = isArr ? 'x' : '';
            title = `${proc.id} · t = ${t}: ${isArr ? 'llega y espera en cola' : 'esperando en cola'} ${qLabel}`;
          } else {
            cls = 'gt-cell gt-off'; bg = ''; fg = ''; txt = '';
            title = `${proc.id} · t = ${t}: ${t < proc.arrival ? 'aún no llega' : 'ya finalizó'}`;
          }
          const sig = `${cls}|${bg}|${fg}|${txt}`;
          if (cell.sig !== sig) {
            cell.sig = sig;
            cell.box.className = cls;
            cell.box.style.background = bg;
            cell.box.style.color = fg;
            cell.box.textContent = txt;
            cell.box.title = title;
          }
        }
        if (snapProc.state === 'done') {
          remEl.className = 'gt-rem-pill is-done';
          remEl.style.background = waitBg;
          remEl.style.color = '#111827';
          remEl.textContent = `t = ${finish}`;
        } else {
          remEl.className = 'gt-rem-pill ' + (snapProc.state === 'new' ? 'is-new' : 'is-active');
          remEl.style.background = '';
          remEl.style.color = '';
          remEl.textContent = `resta ${snapProc.remaining}`;
        }
      });

      if (GT.scroll && GT.scroll.scrollWidth > GT.scroll.clientWidth && GT.headCols[cur]) {
        const th = GT.headCols[cur];
        const target = th.offsetLeft - GT.scroll.clientWidth + 140;
        GT.scroll.scrollTo({ left: Math.max(0, target), behavior: App.status === 'running' ? 'smooth' : 'auto' });
      }
    }

    /* ===============================================================
       Tabla de procesos en vivo (Fin / Retorno / Espera se llenan al terminar)
       =============================================================== */
    function renderProcTable() {
      const host = $('#proc-table');
      const snap = snapNow();
      const metrics = App.sim ? App.sim.metrics.perProcess : [];
      const done = new Set();
      host.textContent = '';
      const rows = App.processes.map((p) => {
        const st = snap ? snap.procs.find((x) => x.id === p.id).state : 'new';
        const m = metrics.find((x) => x.id === p.id);
        const isDone = st === 'done' && m;
        if (isDone) done.add(p.id);
        const fresh = isDone && !App.prevDone.has(p.id);
        const cell = (v) => el('td', { class: fresh ? 'fill' : '' }, isDone ? String(v) : '');
        const qColor = queuePalette(p.queue).base;
        return el('tr', { class: st === 'running' ? 'row-run' : (st === 'new' && snap ? 'row-new' : '') },
          el('th', { scope: 'row', style: `color:${qColor}` }, p.id),
          el('td', null, el('span', { class: 'qtxt', style: `color:${qColor}` }, `Q${p.queue + 1}`), ` · ${queueName(App.config, p.queue)}`),
          el('td', null, String(p.arrival)), el('td', null, String(p.burst)),
          cell(m ? m.finish : ''), cell(m ? m.turnaround : ''), cell(m ? m.waiting : ''));
      });
      App.prevDone = done;
      host.append(el('table', { class: 'ptable' },
        el('thead', null, el('tr', null, ['Proceso', 'Cola', 'Llegada', 'Ráfaga', 'Fin', 'Retorno', 'Espera'].map((h) => el('th', null, h)))),
        el('tbody', null, rows)));
    }

    /* ===============================================================
       Resultados
       =============================================================== */
    function renderResults() {
      const box = $('#results');
      box.textContent = '';
      if (!App.sim || App.cursor < lastIndex()) {
        box.append(el('div', { class: 'res-empty' },
          el('p', null, el('strong', null, 'Los resultados aparecen cuando termina la simulación.')),
          el('p', null, 'Ejecuta la simulación completa o pulsa «Ir al final» en el simulador.'),
          el('a', { class: 'btn btn-outline', href: '#simulador' }, 'Volver al simulador')));
        return;
      }
      const m = App.sim.metrics, cfg = App.sim.config, percent = cfg.policy === 'percent';
      const kpi = (label, value, sub) => el('div', { class: 'kpi' }, el('small', null, label), el('strong', null, value), sub ? el('span', null, ` ${sub}`) : null);
      box.append(el('div', { class: 'kpis' },
        kpi('Tiempo total (makespan)', String(m.makespan), 'unidades'),
        kpi('Utilización de CPU', `${fmt(m.utilization)}%`, `${m.busy} ocupada · ${m.idle} ociosa`),
        kpi('Espera promedio', fmt(m.avgWaiting)),
        kpi('Retorno promedio', fmt(m.avgTurnaround)),
        kpi('Respuesta promedio', fmt(m.avgResponse)),
        kpi('Cambios de contexto', String(m.contextSwitches), `${m.preemptions} interrupción(es) entre colas`)));

      // tabla por proceso (a todo el ancho)
      const head = ['Proceso', 'Cola', 'Llegada', 'Ráfaga', '1.ª vez en CPU', 'Fin', 'Espera', 'Retorno', 'Respuesta'];
      const table = el('table', null,
        el('thead', null, el('tr', null, head.map((h, i) => el('th', { class: i >= 2 ? 'tnum' : '' }, h)))),
        el('tbody', null, m.perProcess.map((p) => el('tr', null,
          el('th', { scope: 'row' }, p.id),
          el('td', null, el('span', { class: 'qdot', style: `background:${queuePalette(p.queue).base}` }), queueName(cfg, p.queue)),
          [p.arrival, p.burst, p.start, p.finish, p.waiting, p.turnaround, p.response].map((v) => el('td', { class: 'tnum' }, String(v)))))),
        el('tfoot', null, el('tr', null, el('td', { colspan: '6' }, 'Promedios'), el('td', { class: 'tnum' }, fmt(m.avgWaiting)), el('td', { class: 'tnum' }, fmt(m.avgTurnaround)), el('td', { class: 'tnum' }, fmt(m.avgResponse)))));
      box.append(el('div', { class: 'res-main' }, el('div', { class: 'table-wrap' }, table)));

      // por cola (incluye la CPU realmente usada) + cómo se calculan las métricas
      const quotas = percent ? allocateQuotas(cfg.percent, cfg.cycle) : null;
      const qHead = ['Cola', 'Procesos', 'Espera prom.', 'Retorno prom.', 'CPU usada'].concat(percent ? ['% configurado'] : []);
      const qTable = el('table', null,
        el('thead', null, el('tr', null, qHead.map((h, i) => el('th', { class: i ? 'tnum' : '' }, h)))),
        el('tbody', null, m.perQueue.map((q) => el('tr', null,
          el('th', { scope: 'row' }, el('span', { class: 'qdot', style: `background:${queuePalette(q.queue).base}` }), queueName(cfg, q.queue)),
          el('td', { class: 'tnum' }, String(q.count)),
          el('td', { class: 'tnum' }, q.count ? fmt(q.avgWaiting) : '—'),
          el('td', { class: 'tnum' }, q.count ? fmt(q.avgTurnaround) : '—'),
          el('td', { class: 'tnum' }, `${q.cpuTime} u (${m.busy ? (Math.round((q.cpuTime / m.busy) * 1000) / 10).toFixed(1) : '0.0'} %)`),
          percent ? el('td', { class: 'tnum' }, `${cfg.percent[q.queue]} % · ${quotas[q.queue]} u/ciclo`) : null))));
      const orderText = cfg.queues.map((_, i) => queueName(cfg, i)).join(' > ');
      const how = el('div', { class: 'how' },
        el('h4', null, 'Cómo se calculan'),
        el('ul', null,
          el('li', null, el('code', null, 'Retorno'), ' = finalización − llegada'),
          el('li', null, el('code', null, 'Espera'), ' = retorno − ráfaga'),
          el('li', null, el('code', null, 'Respuesta'), ' = 1.ª vez en CPU − llegada'),
          el('li', null, el('code', null, 'Utilización'), ' = tiempo con CPU ocupada ÷ makespan')),
        el('p', null, percent
          ? `Política usada: porcentajes de CPU (${cfg.percent.join(' / ')} %, ciclo de ${cfg.cycle} unidades). El porcentaje real puede diferir del configurado cuando una cola se queda sin procesos y las demás aprovechan su tiempo.`
          : `Política usada: prioridad fija entre colas (${orderText}).`));
      box.append(el('div', { class: 'res-grid' }, el('div', { class: 'res-block' }, el('h4', null, 'Promedios por cola'), el('div', { class: 'table-wrap' }, qTable)), how));
    }

    /* ===============================================================
       Controles de la simulación
       =============================================================== */
    function ensureSim() {
      if (App.sim) return true;
      try { App.sim = simulate(App.processes, App.config); return true; }
      catch (e) { App.sim = null; toast(e.message); return false; }
    }
    function stopTimer() { if (App.timer) { clearTimeout(App.timer); App.timer = null; } }
    function schedule() {
      stopTimer();
      if (App.status !== 'running') return;
      App.timer = setTimeout(() => {
        App.timer = null;
        if (App.status !== 'running') return;
        if (App.cursor < lastIndex()) App.cursor++;
        if (App.cursor >= lastIndex()) App.status = 'finished';
        render();
        schedule();
      }, delayMs());
    }
    function start() { if (App.status !== 'idle' || !ensureSim()) return; App.cursor = 0; App.status = 'running'; render(); schedule(); }
    function pause() { if (App.status !== 'running') return; stopTimer(); App.status = 'paused'; render(); }
    function resume() { if (App.status !== 'paused') return; App.status = 'running'; render(); schedule(); }
    function stepNext() {
      if (App.status === 'running' || App.status === 'finished') return;
      if (!ensureSim()) return;
      if (App.cursor < 0) { App.cursor = 0; App.status = 'paused'; }
      else if (App.cursor < lastIndex()) App.cursor++;
      if (App.cursor >= lastIndex()) App.status = 'finished';
      render();
    }
    function stepBack() {
      if (!(App.status === 'paused' || App.status === 'finished') || App.cursor <= 0) return;
      App.cursor--; App.status = 'paused'; render();
    }
    function goEnd() {
      if (App.status === 'finished') return;
      if (!ensureSim()) return;
      stopTimer(); App.cursor = lastIndex(); App.status = 'finished'; render();
    }
    function reset() { stopTimer(); App.sim = null; App.cursor = -1; App.status = 'idle'; render(); }

    function updateControls() {
      const st = App.status;
      $('#btn-start').disabled = st !== 'idle';
      $('#btn-pause').disabled = st !== 'running';
      $('#btn-resume').disabled = st !== 'paused';
      $('#btn-step').disabled = st === 'running' || st === 'finished';
      $('#btn-back').disabled = !((st === 'paused' || st === 'finished') && App.cursor > 0);
      $('#btn-end').disabled = st === 'finished';
      $('#btn-reset').disabled = st === 'idle';
      $('#clock').textContent = App.cursor >= 0 ? String(snapNow().t) : '—';
      const d = delayMs();
      $('#speed-label').textContent = `1 unidad / ${(d / 1000).toFixed(1)} s`;
    }

    function render() {
      App.ganttMs = App.status === 'running' ? delayMs() : 280;
      updateConfigView();
      renderBoard();
      renderExplain();
      renderLog();
      renderGantt();
      renderGanttTable();
      renderProcTable();
      renderResults();
      updateControls();
    }

    /* ---------- arranque ---------- */
    buildConfig();
    renderQueueSelect();
    buildBoard();
    renderGanttLegend();
    renderProcList();
    syncQueueFormQuantum();

    document.querySelectorAll('input[name=policy]').forEach((r) => r.addEventListener('change', () => { if (r.checked) { App.config.policy = r.value; onModelChange(); } }));
    $('#cycle').addEventListener('change', () => {
      const v = Number($('#cycle').value);
      const minCycle = Math.max(3, App.config.queues.length);
      if (!Number.isInteger(v) || v < minCycle || v > 100) {
        $('#cycle').value = String(App.config.cycle);
        toast(`El ciclo debe ser un entero entre ${minCycle} y 100 unidades.`);
        return;
      }
      App.config.cycle = v; onModelChange();
    });
    $('#queue-form').addEventListener('submit', addQueueFromForm);
    $('#qf-alg').addEventListener('change', syncQueueFormQuantum);
    $('#proc-form').addEventListener('submit', addProcessFromForm);
    $('#btn-base').addEventListener('click', () => loadScenario('base'));
    $('#btn-interrup').addEventListener('click', () => loadScenario('interrupciones'));
    $('#btn-multicola').addEventListener('click', () => loadScenario('multicola'));
    $('#btn-clear').addEventListener('click', () => { App.processes = []; onModelChange(true); });
    $('#btn-config-reset').addEventListener('click', () => {
      App.config = DEFAULT_CONFIG();
      let clamped = 0;
      App.processes.forEach((p) => { if (p.queue >= App.config.queues.length) { p.queue = App.config.queues.length - 1; clamped++; } });
      $('#queue-form-msg').textContent = '';
      onQueueStructureChange(true);
      toast(clamped ? `Configuración predeterminada restaurada (${clamped} proceso(s) reasignados a Batch).` : 'Configuración predeterminada restaurada.');
    });
    $('#btn-start').addEventListener('click', start);
    $('#btn-pause').addEventListener('click', pause);
    $('#btn-resume').addEventListener('click', resume);
    $('#btn-step').addEventListener('click', stepNext);
    $('#btn-back').addEventListener('click', stepBack);
    $('#btn-end').addEventListener('click', goEnd);
    $('#btn-reset').addEventListener('click', reset);
    $('#speed').addEventListener('input', () => { updateControls(); });
    document.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); stepNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBack(); }
      else if (e.key === ' ') { e.preventDefault(); if (App.status === 'running') pause(); else if (App.status === 'paused') resume(); else if (App.status === 'idle') start(); }
    });
    render();
    global.MLQ_APP = App; // útil para depurar desde la consola
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUI);
    else initUI();
  }

  /* ===================================================================
     EXPORTACIÓN (navegador: window.MLQ · Node: require)
     =================================================================== */
  const api = { QUEUES, QUEUE_PALETTE, MAX_QUEUES, ALGORITHMS, SCENARIOS, DEFAULT_CONFIG, simulate, computeMetrics, validateInput, validateConfig, allocateQuotas, naturalCompare, orderedReady, queueName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.MLQ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
