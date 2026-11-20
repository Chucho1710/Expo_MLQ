/* =====================================================================
   verificacion.js — Prueba matemática del motor MLQ
   Uso:  node verificacion.js
   Capas de verificación:
     A. Casos de libro de texto (resultados publicados, una sola cola)
     B. Escenarios MLQ calculados A MANO (Gantt y métricas exactas)
     C. Oráculo independiente (otra implementación) vs. el motor, en
        miles de escenarios aleatorios y las 64 combinaciones de algoritmos
     D. Invariantes matemáticos sobre cada ejecución (prioridad, quantum,
        conservación del trabajo, identidades de las métricas, etc.)
   ===================================================================== */
'use strict';
const MLQ = require('./script.js');
const { simulate, SCENARIOS, DEFAULT_CONFIG, naturalCompare } = MLQ;

let checks = 0;
const failures = [];
function ok(cond, msg) { checks++; if (!cond) { failures.push(msg); } }
function eq(a, b, msg) { checks++; if (JSON.stringify(a) !== JSON.stringify(b)) failures.push(`${msg}\n     esperado: ${JSON.stringify(b)}\n     obtenido: ${JSON.stringify(a)}`); }
function near(a, b, msg) { checks++; if (Math.abs(a - b) > 1e-9) failures.push(`${msg}: esperado ${b}, obtenido ${a}`); }

/** Convierte los ticks del motor en bloques [pid, inicio, fin] (cortando solo por cambio de proceso). */
function blocks(res) {
  const out = [];
  res.ticks.forEach((tk) => {
    const last = out[out.length - 1];
    if (last && last[0] === tk.pid && last[2] === tk.t) last[2] = tk.t + 1;
    else out.push([tk.pid, tk.t, tk.t + 1]);
  });
  return out.filter((b) => b[0] !== null);
}
const byId = (res, id) => res.metrics.perProcess.find((p) => p.id === id);
const allQ = (alg, quantum) => ({ queues: [0, 1, 2].map(() => ({ algorithm: alg, quantum: quantum || 2 })) });
const cfgOne = (q, alg, quantum) => { const c = DEFAULT_CONFIG(); c.queues[q] = { algorithm: alg, quantum: quantum || 2 }; return c; };

/* ---------------------------------------------------------------
   A. CASOS DE LIBRO (se prueban en las TRES colas: el resultado no
      debe depender de qué cola se use)
   --------------------------------------------------------------- */
for (let q = 0; q < 3; q++) {
  // FCFS (Silberschatz): P1=24, P2=3, P3=3 llegan en 0 -> esperas 0, 24, 27; promedio 17
  let r = simulate([{ id: 'P1', arrival: 0, burst: 24, queue: q }, { id: 'P2', arrival: 0, burst: 3, queue: q }, { id: 'P3', arrival: 0, burst: 3, queue: q }], cfgOne(q, 'FCFS'));
  eq([byId(r, 'P1').waiting, byId(r, 'P2').waiting, byId(r, 'P3').waiting], [0, 24, 27], `FCFS libro (cola ${q}) esperas`);
  near(r.metrics.avgWaiting, 17, `FCFS libro (cola ${q}) promedio`);

  // SJF no apropiativo: (0,7) (2,4) (4,1) (5,4) -> esperas 0,6,3,7; promedio 4
  const set = [{ id: 'P1', arrival: 0, burst: 7, queue: q }, { id: 'P2', arrival: 2, burst: 4, queue: q }, { id: 'P3', arrival: 4, burst: 1, queue: q }, { id: 'P4', arrival: 5, burst: 4, queue: q }];
  r = simulate(set, cfgOne(q, 'SJF'));
  eq(blocks(r), [['P1', 0, 7], ['P3', 7, 8], ['P2', 8, 12], ['P4', 12, 16]], `SJF libro (cola ${q}) Gantt`);
  near(r.metrics.avgWaiting, 4, `SJF libro (cola ${q}) promedio`);

  // SRTF con el mismo conjunto: esperas 9,1,0,2; promedio 3
  r = simulate(set, cfgOne(q, 'SRTF'));
  eq(blocks(r), [['P1', 0, 2], ['P2', 2, 4], ['P3', 4, 5], ['P2', 5, 7], ['P4', 7, 11], ['P1', 11, 16]], `SRTF libro (cola ${q}) Gantt`);
  eq([byId(r, 'P1').waiting, byId(r, 'P2').waiting, byId(r, 'P3').waiting, byId(r, 'P4').waiting], [9, 1, 0, 2], `SRTF libro (cola ${q}) esperas`);
  near(r.metrics.avgWaiting, 3, `SRTF libro (cola ${q}) promedio`);

  // RR q=4 (Silberschatz): P1=24, P2=3, P3=3 -> esperas 6, 4, 7; promedio 5.666…
  r = simulate([{ id: 'P1', arrival: 0, burst: 24, queue: q }, { id: 'P2', arrival: 0, burst: 3, queue: q }, { id: 'P3', arrival: 0, burst: 3, queue: q }], cfgOne(q, 'RR', 4));
  eq([byId(r, 'P1').waiting, byId(r, 'P2').waiting, byId(r, 'P3').waiting], [6, 4, 7], `RR libro (cola ${q}) esperas`);
  near(r.metrics.avgWaiting, 17 / 3, `RR libro (cola ${q}) promedio`);
}

/* ---------------------------------------------------------------
   B. ESCENARIOS MLQ CALCULADOS A MANO
   --------------------------------------------------------------- */
{
  // Escenario base (Sistema RR q=2, Interactiva RR q=4, Batch FCFS)
  const r = simulate(SCENARIOS.base.processes, DEFAULT_CONFIG());
  eq(blocks(r), [['P1', 0, 4], ['P4', 4, 6], ['P1', 6, 7], ['P4', 7, 8], ['P2', 8, 12], ['P5', 12, 17], ['P3', 17, 23], ['P6', 23, 25]], 'Base: Gantt (bloques continuos)');
  // Con cortes por quantum (nuevo despacho):
  const slices = [];
  r.ticks.forEach((tk) => { const l = slices[slices.length - 1]; if (l && !tk.dispatch && l[0] === tk.pid && l[2] === tk.t) l[2] = tk.t + 1; else slices.push([tk.pid, tk.t, tk.t + 1]); });
  eq(slices, [['P1', 0, 2], ['P1', 2, 4], ['P4', 4, 6], ['P1', 6, 7], ['P4', 7, 8], ['P2', 8, 12], ['P5', 12, 16], ['P5', 16, 17], ['P3', 17, 23], ['P6', 23, 25]], 'Base: rodajas de CPU');
  const exp = { P1: [7, 7, 2, 0, 0], P2: [12, 11, 7, 7, 8], P3: [23, 21, 15, 15, 17], P4: [8, 5, 2, 1, 4], P5: [17, 13, 8, 8, 12], P6: [25, 19, 17, 17, 23] };
  Object.keys(exp).forEach((id) => {
    const m = byId(r, id);
    eq([m.finish, m.turnaround, m.waiting, m.response, m.start], exp[id], `Base ${id}: [fin, retorno, espera, respuesta, inicio]`);
  });
  eq(r.makespan, 25, 'Base: makespan');
  near(r.metrics.utilization, 100, 'Base: utilización');
  near(r.metrics.avgWaiting, 51 / 6, 'Base: espera promedio (8.5)');
  near(r.metrics.avgTurnaround, 76 / 6, 'Base: retorno promedio');
  near(r.metrics.avgResponse, 8, 'Base: respuesta promedio');
  eq(r.metrics.preemptions, 0, 'Base: sin interrupciones entre colas (ningún proceso bajo prioridad llega a tener la CPU antes que uno superior)');
}
{
  // Escenario con interrupciones (misma configuración por defecto)
  const r = simulate(SCENARIOS.interrupciones.processes, DEFAULT_CONFIG());
  eq(blocks(r), [['P1', 0, 2], ['P2', 2, 3], ['P3', 3, 6], ['P2', 6, 9], ['P4', 9, 11], ['P1', 11, 15], ['P5', 15, 18]], 'Interrupciones: Gantt');
  const exp = { P1: [15, 15, 9, 0], P2: [9, 7, 3, 0], P3: [6, 3, 0, 0], P4: [11, 6, 4, 4], P5: [18, 11, 8, 8] };
  Object.keys(exp).forEach((id) => {
    const m = byId(r, id);
    eq([m.finish, m.turnaround, m.waiting, m.response], exp[id], `Interrupciones ${id}: [fin, retorno, espera, respuesta]`);
  });
  eq(r.makespan, 18, 'Interrupciones: makespan');
  near(r.metrics.avgWaiting, 4.8, 'Interrupciones: espera promedio');
  near(r.metrics.avgTurnaround, 8.4, 'Interrupciones: retorno promedio');
  eq(r.metrics.contextSwitches, 6, 'Interrupciones: cambios de contexto');
  eq(r.metrics.preemptions, 2, 'Interrupciones: interrupciones entre colas');
}
{
  // CPU ociosa al inicio: un solo proceso que llega en t=3
  const r = simulate([{ id: 'A', arrival: 3, burst: 2, queue: 1 }], DEFAULT_CONFIG());
  eq(r.makespan, 5, 'Ocio: makespan'); eq(r.metrics.busy, 2, 'Ocio: ocupada'); near(r.metrics.utilization, 40, 'Ocio: utilización 2/5');
  eq(byId(r, 'A').response, 0, 'Ocio: respuesta 0');
}
{
  // Un proceso de menor prioridad NO puede adelantarse a uno superior aunque su ráfaga sea mucho menor
  const r = simulate([{ id: 'S', arrival: 0, burst: 5, queue: 0 }, { id: 'B', arrival: 0, burst: 1, queue: 2 }], allQ('SJF'));
  eq(blocks(r), [['S', 0, 5], ['B', 5, 6]], 'Prioridad fija: Sistema primero aunque B sea más corto');
}
{
  // Interrumpido conserva tiempo restante; SJF dentro de la cola usa menor ráfaga restante
  const r = simulate([{ id: 'L', arrival: 0, burst: 4, queue: 2 }, { id: 'H', arrival: 1, burst: 2, queue: 0 }], allQ('FCFS'));
  eq(blocks(r), [['L', 0, 1], ['H', 1, 3], ['L', 3, 6]], 'Interrupción: L conserva 3 unidades restantes');
  eq(byId(r, 'L').finish, 6, 'Interrupción: fin de L');
}
eq(['P2', 'P10', 'P1'].sort(naturalCompare), ['P1', 'P2', 'P10'], 'Orden natural de identificadores');

/* ---------------------------------------------------------------
   C. ORÁCULO INDEPENDIENTE
   Segunda implementación, escrita con otra estructura (ordenamiento por
   números de secuencia en vez de listas), para comparar tick a tick.
   --------------------------------------------------------------- */
function oracle(input, cfg) {
  const P = input.map((p) => ({ id: p.id, a: p.arrival, b: p.burst, q: p.queue, rem: p.burst, done: false, seq: 0, fin: null }));
  let up = 0, down = 0, t = 0, cur = null, qLeft = 0, pendingExp = null;
  const timeline = [];
  const alg = (q) => cfg.queues[q].algorithm;
  const idc = (x, y) => naturalCompare(x.id, y.id);
  const pickMin = (arr, keyFn) => arr.slice().sort((x, y) => { const kx = keyFn(x), ky = keyFn(y); for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return kx[i] - ky[i]; return idc(x, y); })[0];
  while (P.some((p) => !p.done)) {
    P.filter((p) => p.a === t).sort(idc).forEach((p) => { p.seq = ++up; });
    if (pendingExp) { pendingExp.seq = ++up; pendingExp = null; }
    const waiting = P.filter((p) => p.a <= t && !p.done && p !== cur);
    const pool = waiting.concat(cur ? [cur] : []);
    if (!pool.length) { timeline.push(null); t++; continue; }
    const topQ = Math.min(...pool.map((p) => p.q));
    const wTop = waiting.filter((p) => p.q === topQ);
    let chosen;
    if (cur && cur.q === topQ) {
      if (alg(topQ) === 'SRTF') {
        const best = wTop.length ? pickMin(wTop, (p) => [p.rem, p.a]) : null;
        chosen = best && best.rem < cur.rem ? best : cur;
      } else chosen = cur;
    } else {
      const a = alg(topQ);
      if (a === 'FCFS') chosen = pickMin(wTop, (p) => [p.a]);
      else if (a === 'SJF' || a === 'SRTF') chosen = pickMin(wTop, (p) => [p.rem, p.a]);
      else chosen = wTop.slice().sort((x, y) => x.seq - y.seq)[0];
    }
    if (cur && chosen !== cur && alg(cur.q) === 'RR') cur.seq = --down; // interrumpido: al frente
    if (chosen !== cur && alg(topQ) === 'RR') qLeft = cfg.queues[topQ].quantum;
    chosen.rem--; timeline.push(chosen.id);
    if (alg(chosen.q) === 'RR') qLeft--;
    if (chosen.rem === 0) { chosen.done = true; chosen.fin = t + 1; cur = null; }
    else if (alg(chosen.q) === 'RR' && qLeft === 0) { pendingExp = chosen; cur = null; }
    else cur = chosen;
    t++;
  }
  return { timeline, fin: Object.fromEntries(P.map((p) => [p.id, p.fin])) };
}

/* ---------------------------------------------------------------
   D. INVARIANTES MATEMÁTICOS
   --------------------------------------------------------------- */
function invariants(input, cfg, res, label) {
  const alg = (q) => cfg.queues[q].algorithm;
  const quantum = (q) => cfg.queues[q].quantum;
  const P = Object.fromEntries(input.map((p) => [p.id, p]));
  const T = res.ticks;
  eq(T.length, res.makespan, `${label}: nº de ticks = makespan`);
  eq(res.snapshots.length, res.makespan + 1, `${label}: nº de instantáneas = makespan + 1`);

  // 1. Conservación: cada proceso recibe exactamente su ráfaga
  const got = {}; T.forEach((tk) => { if (tk.pid) got[tk.pid] = (got[tk.pid] || 0) + 1; });
  input.forEach((p) => eq(got[p.id] || 0, p.burst, `${label}: ${p.id} recibe exactamente su ráfaga`));

  // 2. Ningún proceso corre antes de llegar / después de terminar
  const remaining = Object.fromEntries(input.map((p) => [p.id, p.burst]));
  const waitTicks = Object.fromEntries(input.map((p) => [p.id, 0]));
  const firstRun = {}, lastRun = {};
  T.forEach((tk, i) => {
    ok(tk.t === i, `${label}: ticks consecutivos`);
    const eligible = input.filter((p) => p.arrival <= tk.t && remaining[p.id] > 0);
    if (tk.pid === null) { ok(eligible.length === 0, `${label}: CPU ociosa en t=${tk.t} habiendo procesos elegibles (no conserva trabajo)`); return; }
    const run = P[tk.pid];
    ok(run.arrival <= tk.t, `${label}: ${tk.pid} corre en t=${tk.t} antes de llegar`);
    ok(remaining[tk.pid] > 0, `${label}: ${tk.pid} corre sin tiempo restante`);
    eq(tk.queue, run.queue, `${label}: ${tk.pid} conserva su cola`);
    // 3. Prioridad fija: no hay elegibles en una cola de mayor prioridad
    ok(eligible.every((p) => p.queue >= run.queue), `${label}: violación de prioridad en t=${tk.t}`);
    // 4. SRTF: el que corre tiene el menor restante de su cola
    const sameQ = eligible.filter((p) => p.queue === run.queue);
    if (alg(run.queue) === 'SRTF') ok(sameQ.every((p) => remaining[p.id] >= remaining[tk.pid]), `${label}: SRTF no ejecuta el menor restante en t=${tk.t}`);
    // 5. Espera por conteo directo
    eligible.forEach((p) => { if (p.id !== tk.pid) waitTicks[p.id]++; });
    remaining[tk.pid]--;
    if (firstRun[tk.pid] === undefined) firstRun[tk.pid] = tk.t;
    if (remaining[tk.pid] === 0) lastRun[tk.pid] = tk.t;
  });

  // 6. Reglas de despacho y de rodajas (usando el estado reconstruido tick a tick)
  const rem2 = Object.fromEntries(input.map((p) => [p.id, p.burst]));
  let slice = null; // {pid, len}
  T.forEach((tk, i) => {
    if (tk.pid !== null) {
      const run = P[tk.pid], a = alg(run.queue);
      const eligible = input.filter((p) => p.arrival <= tk.t && rem2[p.id] > 0 && p.queue === run.queue);
      if (tk.dispatch) {
        if (a === 'FCFS') ok(eligible.every((p) => p.arrival > run.arrival || (p.arrival === run.arrival && naturalCompare(p.id, run.id) >= 0)), `${label}: FCFS no respetó el orden de llegada en t=${tk.t}`);
        if (a === 'SJF' || a === 'SRTF') ok(eligible.every((p) => rem2[p.id] >= rem2[run.id]), `${label}: ${a} no eligió el menor en t=${tk.t}`);
      } else {
        ok(slice && slice.pid === tk.pid, `${label}: continuación sin rodaja previa en t=${tk.t}`);
      }
      slice = tk.dispatch || !slice || slice.pid !== tk.pid ? { pid: tk.pid, len: 1 } : { pid: tk.pid, len: slice.len + 1 };
      if (a === 'RR') ok(slice.len <= quantum(run.queue), `${label}: RR excede el quantum (${slice.len} > ${quantum(run.queue)}) en t=${tk.t}`);
      rem2[tk.pid]--;
      // ¿Cómo termina la rodaja? (solo se permiten: fin, quantum, o interrupción por cola superior / SRTF)
      const nxt = T[i + 1];
      const ended = rem2[tk.pid] === 0 || !nxt || nxt.pid !== tk.pid || nxt.dispatch;
      if (ended && rem2[tk.pid] > 0) {
        const quantumDone = a === 'RR' && slice.len === quantum(run.queue);
        const higher = nxt && nxt.pid !== null && P[nxt.pid].queue < run.queue;
        const srtf = a === 'SRTF' && nxt && nxt.pid !== tk.pid;
        ok(quantumDone || higher || srtf, `${label}: la rodaja de ${tk.pid} termina sin motivo válido en t=${tk.t + 1} (a=${a})`);
      }
    } else { slice = null; }
  });

  // 7. Métricas: identidades y recomputo independiente
  res.metrics.perProcess.forEach((m) => {
    const p = P[m.id];
    eq(m.finish, lastRun[m.id] + 1, `${label}: ${m.id} fin = último tick + 1`);
    eq(m.turnaround, m.finish - p.arrival, `${label}: ${m.id} retorno = fin − llegada`);
    eq(m.waiting, m.turnaround - p.burst, `${label}: ${m.id} espera = retorno − ráfaga`);
    eq(m.waiting, waitTicks[m.id], `${label}: ${m.id} espera = ticks contados esperando`);
    eq(m.response, firstRun[m.id] - p.arrival, `${label}: ${m.id} respuesta`);
    eq(m.start, firstRun[m.id], `${label}: ${m.id} primer arranque`);
    ok(m.waiting >= 0 && m.response >= 0 && m.response <= m.waiting, `${label}: ${m.id} 0 ≤ respuesta ≤ espera`);
  });
  const sumB = input.reduce((s, p) => s + p.burst, 0);
  eq(res.makespan, Math.max(...res.metrics.perProcess.map((m) => m.finish)), `${label}: makespan = máx. fin`);
  eq(res.metrics.busy, sumB, `${label}: CPU ocupada = Σ ráfagas`);
  near(res.metrics.utilization, (sumB / res.makespan) * 100, `${label}: utilización`);
  const n = input.length;
  near(res.metrics.avgWaiting, res.metrics.perProcess.reduce((s, m) => s + m.waiting, 0) / n, `${label}: espera promedio`);
  near(res.metrics.avgTurnaround, res.metrics.perProcess.reduce((s, m) => s + m.turnaround, 0) / n, `${label}: retorno promedio`);
  // Σ retorno = Σ espera + Σ ráfaga
  near(res.metrics.perProcess.reduce((s, m) => s + m.turnaround, 0), res.metrics.perProcess.reduce((s, m) => s + m.waiting, 0) + sumB, `${label}: Σ retorno = Σ espera + Σ ráfaga`);
  // Cambios de contexto = nº de veces que cambia el proceso entre ticks consecutivos
  let cs = 0, prev = null;
  T.forEach((tk) => { if (tk.pid !== null && prev !== null && tk.pid !== prev) cs++; prev = tk.pid; });
  eq(res.metrics.contextSwitches, cs, `${label}: cambios de contexto`);

  // 8. Coherencia de instantáneas y eventos con el Gantt
  res.snapshots.forEach((s, i) => {
    eq(s.cpu ? s.cpu.pid : null, i < T.length ? T[i].pid : null, `${label}: CPU de la instantánea ${i} = tick`);
    const seen = new Set();
    s.procs.forEach((p) => {
      eq(p.queue, P[p.id].queue, `${label}: ${p.id} nunca cambia de cola (t=${i})`);
      ok((p.state === 'new') === (P[p.id].arrival > i), `${label}: estado "nuevo" de ${p.id} en t=${i}`);
      ok((p.state === 'running') === (s.cpu !== null && s.cpu.pid === p.id), `${label}: estado "ejecutando" de ${p.id} en t=${i}`);
      const m = res.metrics.perProcess.find((x) => x.id === p.id);
      ok((p.state === 'done') === (m.finish <= i), `${label}: estado "finalizado" de ${p.id} en t=${i}`);
    });
    s.queues.forEach((ids, q) => ids.forEach((id) => {
      ok(!seen.has(id), `${label}: ${id} duplicado en colas (t=${i})`); seen.add(id);
      eq(P[id].queue, q, `${label}: ${id} aparece en su cola (t=${i})`);
      ok(['ready', 'interrupted'].includes(s.procs.find((p) => p.id === id).state), `${label}: ${id} en cola con estado válido (t=${i})`);
    }));
    // preferencia: la cola con prioridad más alta que tenga procesos
    if (i < T.length) { const pref = Math.min(...input.filter((p) => p.arrival <= i && s.procs.find((x) => x.id === p.id).state !== 'done').map((p) => p.queue), 99); eq(s.preferredQueue, pref === 99 ? null : pref, `${label}: cola con preferencia en t=${i}`); }
  });
  const fin = res.events.filter((e) => e.type === 'finish'), arr = res.events.filter((e) => e.type === 'arrival');
  eq(fin.length, n, `${label}: un evento de finalización por proceso`);
  eq(arr.length, n, `${label}: un evento de llegada por proceso`);
  fin.forEach((e) => eq(e.t, res.metrics.perProcess.find((m) => m.id === e.pid).finish, `${label}: evento de fin de ${e.pid} en su tiempo`));
  arr.forEach((e) => eq(e.t, P[e.pid].arrival, `${label}: evento de llegada de ${e.pid} en su tiempo`));
  eq(res.events.filter((e) => e.type === 'preempt').length, res.metrics.preemptions, `${label}: nº de eventos de interrupción`);
  eq(res.events.filter((e) => e.type === 'context').length, res.metrics.contextSwitches, `${label}: nº de eventos de cambio de contexto`);
}

/* --- Pruebas con las 64 combinaciones x quantums x 2 escenarios --- */
const ALGS = ['FCFS', 'SJF', 'SRTF', 'RR'];
let combos = 0;
[SCENARIOS.base.processes, SCENARIOS.interrupciones.processes].forEach((procs, si) => {
  for (const a0 of ALGS) for (const a1 of ALGS) for (const a2 of ALGS) {
    for (const quantum of [1, 2, 3, 5]) {
      const cfg = { queues: [{ algorithm: a0, quantum }, { algorithm: a1, quantum: quantum + 1 }, { algorithm: a2, quantum: Math.max(1, quantum - 1) + 1 }] };
      const label = `Esc${si} ${a0}/${a1}/${a2} q=${quantum}`;
      const res = simulate(procs, cfg);
      invariants(procs, cfg, res, label);
      const o = oracle(procs, cfg);
      eq(res.ticks.map((t) => t.pid), o.timeline, `${label}: Gantt motor = oráculo`);
      eq(Object.fromEntries(res.metrics.perProcess.map((m) => [m.id, m.finish])), o.fin, `${label}: finales motor = oráculo`);
      combos++;
    }
  }
});

/* --- Pruebas aleatorias (semilla fija, reproducibles) --- */
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = rng(20261119);
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const RANDOM_RUNS = 6000;
for (let k = 0; k < RANDOM_RUNS; k++) {
  const n = ri(1, 9), maxA = ri(0, 12);
  const procs = Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, arrival: ri(0, maxA), burst: ri(1, 9), queue: ri(0, 2) }));
  const cfg = { queues: [0, 1, 2].map(() => ({ algorithm: ALGS[ri(0, 3)], quantum: ri(1, 5) })) };
  const label = `Aleatorio#${k}`;
  const res = simulate(procs, cfg);
  invariants(procs, cfg, res, label);
  const o = oracle(procs, cfg);
  eq(res.ticks.map((t) => t.pid), o.timeline, `${label}: Gantt motor = oráculo\n     procesos: ${JSON.stringify(procs)}\n     config: ${JSON.stringify(cfg)}`);
  if (failures.length > 25) break;
}

/* --- Determinismo: misma entrada, mismo resultado; el orden de captura no importa --- */
{
  const a = simulate(SCENARIOS.interrupciones.processes, DEFAULT_CONFIG());
  const b = simulate(SCENARIOS.interrupciones.processes, DEFAULT_CONFIG());
  eq(a.ticks, b.ticks, 'Determinismo: dos ejecuciones idénticas');
  const shuffled = SCENARIOS.base.processes.slice().reverse();
  const c = simulate(shuffled, DEFAULT_CONFIG());
  eq(blocks(c), blocks(simulate(SCENARIOS.base.processes, DEFAULT_CONFIG())), 'Determinismo: el orden de captura de los procesos no altera el Gantt');
}

/* --- Validación de entrada --- */
function throws(fn, msg) { checks++; try { fn(); failures.push(msg + ' (no lanzó error)'); } catch (e) { /* ok */ } }
throws(() => simulate([], DEFAULT_CONFIG()), 'Sin procesos');
throws(() => simulate([{ id: 'P1', arrival: 0, burst: 0, queue: 0 }], DEFAULT_CONFIG()), 'Ráfaga 0');
throws(() => simulate([{ id: 'P1', arrival: -1, burst: 2, queue: 0 }], DEFAULT_CONFIG()), 'Llegada negativa');
throws(() => simulate([{ id: 'P1', arrival: 0, burst: 2, queue: 0 }, { id: 'P1', arrival: 0, burst: 2, queue: 1 }], DEFAULT_CONFIG()), 'Id repetido');
throws(() => simulate([{ id: 'P1', arrival: 0, burst: 2, queue: 0 }], { queues: [{ algorithm: 'RR', quantum: 0 }, { algorithm: 'FCFS' }, { algorithm: 'FCFS' }] }), 'Quantum 0');

/* --- Reporte --- */
console.log('='.repeat(64));
console.log(' VERIFICACIÓN MATEMÁTICA DEL SIMULADOR MLQ');
console.log('='.repeat(64));
console.log(` Combinaciones de algoritmos × quantum × escenario : ${combos}`);
console.log(` Escenarios aleatorios (semilla fija)              : ${RANDOM_RUNS}`);
console.log(` Comprobaciones individuales ejecutadas            : ${checks.toLocaleString('es-CO')}`);
if (failures.length) {
  console.log(`\n ✗ FALLOS: ${failures.length}`);
  failures.slice(0, 25).forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  process.exit(1);
} else {
  console.log('\n ✓ TODAS LAS COMPROBACIONES PASARON');
}
