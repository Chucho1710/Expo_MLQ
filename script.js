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

  /** Las tres colas. El índice (id) es también su prioridad: 0 es la más alta. Fijas. */
  const QUEUES = [
    { id: 0, name: 'Sistema',     priority: 'ALTA',  level: 1, description: 'Procesos esenciales del sistema operativo.' },
    { id: 1, name: 'Interactiva', priority: 'MEDIA', level: 2, description: 'Aplicaciones con las que interactúa el usuario.' },
    { id: 2, name: 'Batch',       priority: 'BAJA',  level: 3, description: 'Procesos por lotes y tareas en segundo plano.' }
  ];

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
    queues: [
      { algorithm: 'RR',   quantum: 2 },
      { algorithm: 'RR',   quantum: 4 },
      { algorithm: 'FCFS', quantum: 4 }
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
    }
  };

  /* ===================================================================
     2. MOTOR DE PLANIFICACIÓN
     ===================================================================
     Reglas implementadas (todas deterministas):

     ENTRE COLAS  : prioridades fijas y apropiativas. La CPU siempre es de
                    la cola de mayor prioridad que tenga algún proceso
                    listo o en ejecución. No hay división de tiempo.
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

  function validateInput(processes, config) {
    const errors = [];
    if (!Array.isArray(processes) || processes.length === 0) errors.push('Agrega al menos un proceso.');
    const seen = new Set();
    (processes || []).forEach((p) => {
      if (!/^[A-Za-z0-9_-]{1,8}$/.test(String(p.id))) errors.push(`Identificador inválido: "${p.id}".`);
      if (seen.has(p.id)) errors.push(`Identificador repetido: ${p.id}.`);
      seen.add(p.id);
      if (!Number.isInteger(p.arrival) || p.arrival < 0 || p.arrival > 1000) errors.push(`${p.id}: la llegada debe ser un entero entre 0 y 1000.`);
      if (!Number.isInteger(p.burst) || p.burst < 1 || p.burst > 1000) errors.push(`${p.id}: la ráfaga debe ser un entero entre 1 y 1000.`);
      if (![0, 1, 2].includes(p.queue)) errors.push(`${p.id}: cola inválida.`);
    });
    if (!config || !Array.isArray(config.queues) || config.queues.length !== 3) {
      errors.push('La configuración debe tener tres colas.');
    } else {
      config.queues.forEach((c, i) => {
        if (!ALGORITHMS[c.algorithm]) errors.push(`Cola ${QUEUES[i].name}: algoritmo inválido.`);
        if (c.algorithm === 'RR' && (!Number.isInteger(c.quantum) || c.quantum < 1)) errors.push(`Cola ${QUEUES[i].name}: el quantum debe ser un entero ≥ 1.`);
      });
    }
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

  const qName = (q) => QUEUES[q].name;

  function simulate(input, config) {
    const errors = validateInput(input, config);
    if (errors.length) throw new Error(errors.join(' '));

    const procs = input.map((p) => ({
      id: p.id, arrival: p.arrival, burst: p.burst, queue: p.queue,
      remaining: p.burst, state: 'new', firstStart: null, finish: null
    }));
    const ready = [[], [], []];                    // procesos esperando (no ejecutando) por cola
    const algOf = (q) => config.queues[q].algorithm;
    const quantumOf = (q) => config.queues[q].quantum;

    const ticks = [];       // una entrada por unidad de tiempo ejecutada
    const snapshots = [];   // una entrada por instante t (incluye el instante final)
    const allEvents = [];
    let cpu = null;         // { proc, qLeft }
    let carry = [];         // eventos del final del intervalo anterior (finalizaciones)
    let expired = null;     // { proc, q } quantum agotado en el intervalo anterior
    let t = 0, busy = 0, ctx = 0, preemptions = 0;
    let lastRunPid = null, lastQueue = null, idleActive = false;

    const maxArrival = Math.max(...input.map((p) => p.arrival));
    const maxTime = input.reduce((s, p) => s + p.burst, 0) + maxArrival + 2;

    /** Cola con preferencia: la de mayor prioridad con algún proceso listo (o ejecutando). */
    function topQueue(includeCpu) {
      for (let q = 0; q < 3; q++) {
        if (ready[q].length > 0) return q;
        if (includeCpu && cpu && cpu.proc.queue === q) return q;
      }
      return null;
    }

    function reasonForQueue(q) {
      if (q === 0) return 'tiene la prioridad más alta y tiene procesos listos';
      if (q === 1) return 'la cola Sistema está vacía y Interactiva es la siguiente en prioridad';
      return 'las colas Sistema e Interactiva están vacías, por lo que Batch puede usar la CPU';
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
      for (let q = 0; q < 3; q++) {
        const list = orderedReady(ready[q], algOf(q));
        if (!list.length) continue;
        const ids = list.map((p) => p.id).join(', ');
        if (q > cq) {
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

      /* (d) Decisión entre colas: ¿se interrumpe al proceso actual? */
      let top = topQueue(true);
      if (cpu) {
        const old = cpu.proc;
        const cq = old.queue;
        if (top < cq) {
          const cause = arriving.filter((p) => p.queue < cq).sort((a, b) => a.queue - b.queue)[0];
          add('preempt',
            `${old.id} (cola ${qName(cq)}) es interrumpido ` +
            (cause ? `porque ${cause.id} llegó a la cola ${qName(cause.queue)}, que tiene mayor prioridad. ` : `porque la cola ${qName(top)}, de mayor prioridad, tiene procesos listos. `) +
            `${old.id} conserva su tiempo restante (${old.remaining}) y permanece en su cola ${qName(cq)}.`,
            { pid: old.id, queue: cq, cause: 'queue' });
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
        const q = topQueue(false);
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
        const sup = p.queue === 0 ? '' : ' Las colas de mayor prioridad no tienen procesos listos.';
        lines.push({ type: 'info', text: `${p.id} continúa ejecutándose en la cola ${qName(p.queue)}: ${why}${sup}` });
      }
      waitingLines().forEach((l) => lines.push({ type: 'wait', text: l }));
      if (!cpu) lines.push({ type: 'idle', text: 'No hay ningún proceso listo; la CPU espera la llegada del siguiente proceso.' });

      snapshots.push(makeSnapshot(t, ev, lines, topQueue(true), { dispatched }));
      ev.forEach((e) => allEvents.push(e));

      /* (g) Ejecutar el intervalo [t, t+1) */
      if (cpu) {
        const p = cpu.proc;
        ticks.push({ t, pid: p.id, queue: p.queue, dispatch: dispatched, ctxFrom });
        p.remaining--;
        busy++;
        if (cpu.qLeft !== null) cpu.qLeft--;
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
        queues: [0, 1, 2].map((q) => orderedReady(ready[q], algOf(q)).map((p) => p.id)),
        pending: [0, 1, 2].map((q) => procs.filter((p) => p.queue === q && p.state !== 'done').length)
      };
    }

    const makespan = t;
    const metrics = computeMetrics(procs, busy, makespan, ctx, preemptions);
    return { snapshots, ticks, events: allEvents, metrics, makespan, config: JSON.parse(JSON.stringify(config)) };
  }

  /* ===================================================================
     3. MÉTRICAS
     =================================================================== */
  function computeMetrics(procs, busy, makespan, contextSwitches, preemptions) {
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
    const perQueue = [0, 1, 2].map((q) => {
      const list = perProcess.filter((p) => p.queue === q);
      return { queue: q, count: list.length, avgWaiting: avg(list, (p) => p.waiting), avgTurnaround: avg(list, (p) => p.turnaround), avgResponse: avg(list, (p) => p.response) };
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
    const SHADES = [
      ['#7a0c1e', '#9a1b30', '#5e0916', '#b33246', '#8c1427', '#a8263b'],
      ['#1e293b', '#334155', '#0f172a', '#475569', '#27354d', '#3b4a63'],
      ['#6b7280', '#9ca3af', '#4b5563', '#7c8591', '#a3aab5', '#5f6672']
    ];
    function luminance(hex) {
      const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }
    function rebuildColors() {
      App.colors.clear();
      const count = [0, 0, 0];
      App.processes.forEach((p) => {
        const bg = SHADES[p.queue][count[p.queue]++ % 6];
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

    /* ===============================================================
       Configuración de las colas
       =============================================================== */
    function buildConfig() {
      const wrap = $('#queue-config');
      wrap.textContent = '';
      App.cfgUI = QUEUES.map((q) => {
        const cfg = App.config.queues[q.id];
        const select = el('select', { id: `alg-${q.id}`, 'aria-label': `Algoritmo de la cola ${q.name}` },
          Object.keys(ALGORITHMS).map((k) => el('option', { value: k }, ALGORITHMS[k].label)));
        select.value = cfg.algorithm;
        select.addEventListener('change', () => { cfg.algorithm = select.value; onModelChange(); });

        const quantum = el('input', { id: `q-${q.id}`, type: 'number', min: '1', max: '99', step: '1', value: String(cfg.quantum) });
        quantum.addEventListener('change', () => {
          const v = Number(quantum.value);
          if (!Number.isInteger(v) || v < 1) { quantum.value = String(cfg.quantum); toast('El quantum debe ser un número entero mayor o igual a 1.'); return; }
          cfg.quantum = v; onModelChange();
        });
        const quantumWrap = el('label', { class: 'qfield' }, 'Quantum (unidades de tiempo)', quantum);
        const modality = el('span', { class: 'mod-badge' });
        const note = el('p', { class: 'alg-note' });
        const pending = el('b', null, '0');
        const card = el('article', { class: `qcard q${q.id}` },
          el('header', null,
            el('div', null, el('div', { class: 'qlevel' }, `Cola ${q.level}`), el('h4', null, q.name)),
            el('span', { class: 'prio-pill', title: 'La prioridad de cada cola es fija y no se puede modificar' }, `🔒 ${q.priority}`)),
          el('p', { class: 'qdesc' }, q.description),
          el('label', { class: 'qfield' }, 'Algoritmo interno', select),
          el('div', { class: 'qmeta' }, el('span', { class: 'lane-tag' }, 'Modalidad:'), modality),
          note,
          quantumWrap,
          el('div', { class: 'qpending' }, 'Procesos pendientes: ', pending));
        wrap.append(card);
        return { select, quantum, quantumWrap, modality, note, pending };
      });
      updateConfigView();
    }

    function updateConfigView() {
      const snap = snapNow();
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
      QUEUES.forEach((q, i) => {
        const h = App.board.laneHeads && App.board.laneHeads[i];
        if (!h) return;
        const cfg = App.config.queues[i], alg = ALGORITHMS[cfg.algorithm];
        h.alg.textContent = alg.short + (alg.usesQuantum ? ` · q = ${cfg.quantum}` : '');
        h.mod.textContent = alg.modality;
        const n = snapNow() ? snapNow().pending[i] : App.processes.filter((p) => p.queue === i).length;
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
          el('div', { class: 'pq' }, `Cola ${QUEUES[p.queue].name}`),
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
      else if (App.processes.length >= 30) err = 'Máximo 30 procesos para mantener la simulación legible.';
      msg.textContent = err;
      if (err) return;
      App.processes.push({ id: idRaw, arrival, burst, queue });
      $('#f-id').value = '';
      onModelChange(true);
      $('#f-id').focus();
    }
    function loadScenario(key) {
      App.processes = SCENARIOS[key].processes.map((p) => Object.assign({}, p));
      $('#form-msg').textContent = '';
      onModelChange(true);
      toast(`${SCENARIOS[key].name} cargado.`);
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
      const b = App.board;
      b.poolNew = el('div', { class: 'chips' });
      b.poolDone = el('div', { class: 'chips' });
      board.append(
        el('div', { class: 'pool pool-new' }, el('span', { class: 'pool-title' }, 'Nuevo · aún no llega'), b.poolNew));
      b.lanes = []; b.laneHeads = []; b.arrows = [];
      QUEUES.forEach((q) => {
        const head = { alg: el('span', { class: 'lane-tag' }), mod: el('span', { class: 'lane-tag' }), pend: el('span', { class: 'lane-tag' }) };
        const area = el('div', { class: 'lane-area' });
        const lane = el('div', { class: `lane q${q.id}`, style: `grid-row:${q.id + 2}` },
          el('div', { class: 'lane-head' },
            el('span', { class: 'lane-name' }, `Cola ${q.level} · ${q.name}`),
            el('span', { class: 'lane-tag prio' }, `Prioridad ${q.priority}`),
            head.alg, head.mod, head.pend,
            el('span', { class: 'lane-pref' }, '★ Preferencia de CPU')),
          area);
        b.lanes.push({ lane, area }); b.laneHeads.push(head);
        board.append(lane);
      });
      const arrows = el('div', { class: 'arrows' });
      QUEUES.forEach(() => {
        const a = el('div', { class: 'arrow' });
        a.innerHTML = '<svg viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h36M30 4l9 8-9 8"/></svg>';
        b.arrows.push(a); arrows.append(a);
      });
      b.cpuSlot = el('div', { class: 'cpu-slot' });
      b.cpuTime = el('span', { class: 'cpu-time' }, '');
      b.cpuQueue = el('dd', null, '—'); b.cpuAlg = el('dd', null, '—'); b.cpuExec = el('dd', null, '—'); b.cpuRem = el('dd', null, '—'); b.cpuQ = el('dd', null, '—');
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
          el('dt', null, 'Quantum restante'), b.cpuQ),
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
      const target = { new: [], done: [], cpu: [], lanes: [[], [], []] };
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
        b.cpuQueue.textContent = QUEUES[cpu.queue].name;
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
      b.cpuPref.append('Cola con preferencia: ', el('b', null, pref === null ? (snap ? 'ninguna (sin procesos listos)' : '—') : QUEUES[pref].name));
    }

    /* ===============================================================
       ¿Qué está pasando? + registro
       =============================================================== */
    const ICONS = { arrival: '➜', finish: '✔', queue: '◆', dispatch: '▶', quantum: '⏱', preempt: '⚡', context: '⇄', idle: '…', info: 'ℹ', wait: '⏳' };

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
        node.title = s.pid === null ? `CPU ociosa · t=${s.start}→${s.end}` : `${s.pid} · cola ${QUEUES[s.queue].name} · t=${s.start}→${s.end}`;
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
        return el('tr', { class: st === 'running' ? 'row-run' : (st === 'new' && snap ? 'row-new' : '') },
          el('th', { scope: 'row', style: `color:${SHADES[p.queue][0]}` }, p.id),
          el('td', null, el('span', { class: 'qtxt', style: `color:${SHADES[p.queue][0]}` }, `Q${p.queue + 1}`), ` · ${QUEUES[p.queue].name}`),
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
      const m = App.sim.metrics;
      const kpi = (label, value, sub) => el('div', { class: 'kpi' }, el('small', null, label), el('strong', null, value), sub ? el('span', null, ` ${sub}`) : null);
      box.append(el('div', { class: 'kpis' },
        kpi('Tiempo total (makespan)', String(m.makespan), 'unidades'),
        kpi('Utilización de CPU', `${fmt(m.utilization)}%`, `${m.busy} ocupada · ${m.idle} ociosa`),
        kpi('Espera promedio', fmt(m.avgWaiting)),
        kpi('Retorno promedio', fmt(m.avgTurnaround)),
        kpi('Respuesta promedio', fmt(m.avgResponse)),
        kpi('Cambios de contexto', String(m.contextSwitches), `${m.preemptions} interrupción(es) por prioridad`)));

      // tabla
      const head = ['Proceso', 'Cola', 'Llegada', 'Ráfaga', '1.ª vez en CPU', 'Fin', 'Espera', 'Retorno', 'Respuesta'];
      const table = el('table', null,
        el('thead', null, el('tr', null, head.map((h, i) => el('th', { class: i >= 2 ? 'tnum' : '' }, h)))),
        el('tbody', null, m.perProcess.map((p) => el('tr', null,
          el('th', { scope: 'row' }, p.id),
          el('td', null, el('span', { class: 'qdot', style: `background:${SHADES[p.queue][0]}` }), QUEUES[p.queue].name),
          [p.arrival, p.burst, p.start, p.finish, p.waiting, p.turnaround, p.response].map((v) => el('td', { class: 'tnum' }, String(v)))))),
        el('tfoot', null, el('tr', null, el('td', { colspan: '6' }, 'Promedios'), el('td', { class: 'tnum' }, fmt(m.avgWaiting)), el('td', { class: 'tnum' }, fmt(m.avgTurnaround)), el('td', { class: 'tnum' }, fmt(m.avgResponse)))));

      // gráficas
      const maxT = Math.max(...m.perProcess.map((p) => p.turnaround), 1);
      const chart = el('div', { class: 'chart' },
        el('h4', null, 'Tiempo de retorno de cada proceso'),
        el('div', { class: 'sub' }, 'Longitud total = retorno = espera + ráfaga'),
        m.perProcess.map((p) => el('div', { class: 'bar-row' },
          el('span', { class: 'bid' }, p.id),
          el('div', { class: 'bar-track', title: `${p.id}: espera ${p.waiting} + ráfaga ${p.burst} = retorno ${p.turnaround}` },
            el('i', { class: 'bar-wait', style: `width:${(p.waiting / maxT) * 100}%` }), el('i', { class: 'bar-run', style: `width:${(p.burst / maxT) * 100}%` })),
          el('span', { class: 'bval' }, String(p.turnaround)))),
        el('div', { class: 'chart-legend' }, el('span', null, el('i', { class: 'bar-wait' }), 'Espera'), el('span', null, el('i', { class: 'bar-run' }), 'Ejecución')));
      const circ = 2 * Math.PI * 34;
      const ring = el('div', { class: 'ring-wrap' });
      ring.innerHTML = `<svg class="ring" viewBox="0 0 84 84" role="img" aria-label="Utilización de CPU ${fmt(m.utilization)}%"><circle cx="42" cy="42" r="34" fill="none" stroke="#eef0ec" stroke-width="10"/><circle cx="42" cy="42" r="34" fill="none" stroke="#0a7a42" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(m.utilization / 100) * circ} ${circ}" transform="rotate(-90 42 42)"/><text x="42" y="47" text-anchor="middle" font-size="15" font-weight="800" fill="#04361f">${Math.round(m.utilization)}%</text></svg>`;
      ring.append(el('div', null, el('strong', null, 'Utilización de CPU'), el('div', { class: 'hint' }, `${m.busy} de ${m.makespan} unidades con la CPU ocupada.`)));
      chart.append(ring);

      const qTable = el('table', null,
        el('thead', null, el('tr', null, ['Cola', 'Procesos', 'Espera prom.', 'Retorno prom.'].map((h, i) => el('th', { class: i ? 'tnum' : '' }, h)))),
        el('tbody', null, m.perQueue.map((q) => el('tr', null,
          el('th', { scope: 'row' }, el('span', { class: 'qdot', style: `background:${SHADES[q.queue][0]}` }), QUEUES[q.queue].name),
          el('td', { class: 'tnum' }, String(q.count)),
          el('td', { class: 'tnum' }, q.count ? fmt(q.avgWaiting) : '—'),
          el('td', { class: 'tnum' }, q.count ? fmt(q.avgTurnaround) : '—')))));

      box.append(el('div', { class: 'res-grid' },
        el('div', null, el('div', { class: 'table-wrap' }, table), el('p', { class: 'formula' }, 'Fórmulas: ', el('code', null, 'retorno = finalización − llegada'), ' · ', el('code', null, 'espera = retorno − ráfaga'), ' · ', el('code', null, 'respuesta = 1.ª vez en CPU − llegada'), ' · ', el('code', null, 'utilización = tiempo ocupada / makespan')),
          el('h4', { style: 'margin:1rem 0 .4rem' }, 'Promedios por cola'), el('div', { class: 'table-wrap' }, qTable)),
        chart));
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
      renderProcTable();
      renderResults();
      updateControls();
    }

    /* ---------- arranque ---------- */
    buildConfig();
    buildBoard();
    renderProcList();

    $('#proc-form').addEventListener('submit', addProcessFromForm);
    $('#btn-base').addEventListener('click', () => loadScenario('base'));
    $('#btn-interrup').addEventListener('click', () => loadScenario('interrupciones'));
    $('#btn-clear').addEventListener('click', () => { App.processes = []; onModelChange(true); });
    $('#btn-config-reset').addEventListener('click', () => { App.config = DEFAULT_CONFIG(); buildConfig(); onModelChange(); toast('Configuración predeterminada restaurada.'); });
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
  const api = { QUEUES, ALGORITHMS, SCENARIOS, DEFAULT_CONFIG, simulate, computeMetrics, validateInput, naturalCompare, orderedReady };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.MLQ = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
