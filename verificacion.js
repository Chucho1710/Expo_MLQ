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
import MLQ, { simulate, SCENARIOS, DEFAULT_CONFIG, naturalCompare } from './src/engine/mlqEngine.js';

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
function oracleQuotas(percent, cycle) {
  // formulación distinta: se parte de los pisos y se entrega +1 a la cola con mayor resto pendiente
  const n = percent.length;
  const q = percent.map((p) => Math.floor((p * cycle) / 100));
  while (q.reduce((s, v) => s + v, 0) < cycle) {
    let best = 0;
    for (let i = 1; i < n; i++) if (percent[i] * cycle - 100 * q[i] > percent[best] * cycle - 100 * q[best]) best = i;
    q[best]++;
  }
  return q;
}
function oracle(input, cfg) {
  const nq = cfg.queues.length;
  const qRange = Array.from({ length: nq }, (_, i) => i);
  const P = input.map((p) => ({ id: p.id, a: p.arrival, b: p.burst, q: p.queue, rem: p.burst, done: false, seq: 0, fin: null }));
  let up = 0, down = 0, t = 0, cur = null, qLeft = 0, pendingExp = null;
  const timeline = [];
  const alg = (q) => cfg.queues[q].algorithm;
  const idc = (x, y) => naturalCompare(x.id, y.id);
  const pct = cfg.policy === 'percent';
  const alloc = pct ? oracleQuotas(cfg.percent, cfg.cycle) : null;
  let quota = Array(nq).fill(0);
  const pickMin = (arr, keyFn) => arr.slice().sort((x, y) => { const kx = keyFn(x), ky = keyFn(y); for (let i = 0; i < kx.length; i++) if (kx[i] !== ky[i]) return kx[i] - ky[i]; return idc(x, y); })[0];
  while (P.some((p) => !p.done)) {
    P.filter((p) => p.a === t).sort(idc).forEach((p) => { p.seq = ++up; });
    if (pendingExp) { pendingExp.seq = ++up; pendingExp = null; }
    if (pct && t % cfg.cycle === 0) quota = alloc.slice();
    const waiting = P.filter((p) => p.a <= t && !p.done && p !== cur);
    const pool = waiting.concat(cur ? [cur] : []);
    if (!pool.length) { timeline.push(null); t++; continue; }
    let topQ = Math.min(...pool.map((p) => p.q));
    if (pct) {
      const queuesWithWork = qRange.filter((q) => pool.some((p) => p.q === q));
      const withQuota = queuesWithWork.filter((q) => quota[q] > 0);
      topQ = withQuota.length ? withQuota[0] : queuesWithWork[0];
    }
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
    if (pct && quota[chosen.q] > 0) quota[chosen.q]--;
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
  const nq = cfg.queues.length;
  const qRange = Array.from({ length: nq }, (_, i) => i);
  const pct = cfg.policy === 'percent';
  const quotaNow = Array(nq).fill(0);
  const alloc = pct ? oracleQuotas(cfg.percent, cfg.cycle) : null;
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
    if (pct && tk.t % cfg.cycle === 0) { for (let q = 0; q < nq; q++) quotaNow[q] = alloc[q]; }
    const eligible = input.filter((p) => p.arrival <= tk.t && remaining[p.id] > 0);
    if (tk.pid === null) { ok(eligible.length === 0, `${label}: CPU ociosa en t=${tk.t} habiendo procesos elegibles (no conserva trabajo)`); return; }
    const run = P[tk.pid];
    ok(run.arrival <= tk.t, `${label}: ${tk.pid} corre en t=${tk.t} antes de llegar`);
    ok(remaining[tk.pid] > 0, `${label}: ${tk.pid} corre sin tiempo restante`);
    eq(tk.queue, run.queue, `${label}: ${tk.pid} conserva su cola`);
    if (!pct) {
      // 3. Prioridad fija: no hay elegibles en una cola de mayor prioridad
      ok(eligible.every((p) => p.queue >= run.queue), `${label}: violación de prioridad en t=${tk.t}`);
    } else {
      // 3b. Porcentajes: se atiende a la cola de mayor prioridad con procesos Y cuota; si ninguna tiene cuota, a la de mayor prioridad con procesos
      const withWork = qRange.filter((q) => eligible.some((p) => p.queue === q));
      const withQuota = withWork.filter((q) => quotaNow[q] > 0);
      eq(run.queue, withQuota.length ? withQuota[0] : withWork[0], `${label}: cola elegida por cuotas en t=${tk.t}`);
      if (quotaNow[run.queue] > 0) quotaNow[run.queue]--;
    }
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
        const higher = nxt && nxt.pid !== null && (pct ? P[nxt.pid].queue !== run.queue : P[nxt.pid].queue < run.queue);
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
    if (pct && i < T.length && T[i].pid !== null) eq(s.preferredQueue, T[i].queue, `${label}: cola atendida en t=${i}`);
    if (!pct && i < T.length) { const pref = Math.min(...input.filter((p) => p.arrival <= i && s.procs.find((x) => x.id === p.id).state !== 'done').map((p) => p.queue), 99); eq(s.preferredQueue, pref === 99 ? null : pref, `${label}: cola con preferencia en t=${i}`); }
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

/* ---------------------------------------------------------------
   E. POLÍTICA POR PORCENTAJES DE CPU
   --------------------------------------------------------------- */
{
  const pcfg = (percent, cycle, algs) => ({ policy: 'percent', percent, cycle, queues: (algs || ['FCFS', 'FCFS', 'FCFS']).map((a) => ({ algorithm: a, quantum: 2 })) });
  // E1. Reparto de cuotas: suma = ciclo y cada cuota difiere menos de 1 del valor exacto (todas las combinaciones)
  let allocChecks = 0;
  for (let a = 1; a <= 98; a++) for (let b = 1; a + b <= 99; b++) {
    const c = 100 - a - b;
    for (const cyc of [3, 7, 10, 12, 25, 100]) {
      const q = MLQ.allocateQuotas([a, b, c], cyc);
      eq(q.reduce((x, y) => x + y, 0), cyc, `Cuotas [${a},${b},${c}] ciclo ${cyc}: suma`);
      [a, b, c].forEach((p, i) => ok(Math.abs(q[i] - (p * cyc) / 100) < 1, `Cuotas [${a},${b},${c}] ciclo ${cyc}: cola ${i} lejos de su valor exacto`));
      eq(q, oracleQuotas([a, b, c], cyc), `Cuotas [${a},${b},${c}] ciclo ${cyc}: motor = oráculo`);
      allocChecks++;
    }
  }
  // E2. Caso calculado a mano (50/30/20, ciclo 10)
  const hand = simulate([{ id: 'A', arrival: 0, burst: 6, queue: 0 }, { id: 'B', arrival: 0, burst: 4, queue: 1 }, { id: 'C', arrival: 0, burst: 4, queue: 2 }], pcfg([50, 30, 20], 10));
  eq(blocks(hand), [['A', 0, 5], ['B', 5, 8], ['C', 8, 10], ['A', 10, 11], ['B', 11, 12], ['C', 12, 14]], 'Porcentajes (a mano): Gantt');
  const hm = Object.fromEntries(hand.metrics.perProcess.map((m) => [m.id, [m.finish, m.turnaround, m.waiting]]));
  eq(hm, { A: [11, 11, 5], B: [12, 12, 8], C: [14, 14, 10] }, 'Porcentajes (a mano): fin / retorno / espera');
  near(hand.metrics.avgWaiting, 23 / 3, 'Porcentajes (a mano): espera promedio');
  eq([hand.metrics.preemptions, hand.metrics.contextSwitches], [3, 5], 'Porcentajes (a mano): interrupciones y cambios de contexto');
  eq(hand.metrics.perQueue.map((q) => q.cpuTime), [6, 4, 4], 'Porcentajes (a mano): CPU usada por cola');
  // E3. Conservación del trabajo: una cola sola aprovecha todo el tiempo (sin interrupciones ni ocio)
  const alone = simulate([{ id: 'X', arrival: 0, burst: 15, queue: 2 }], pcfg([60, 30, 10], 10));
  eq(blocks(alone), [['X', 0, 15]], 'Porcentajes: una cola sola usa el 100 % de la CPU');
  eq(alone.metrics.preemptions, 0, 'Porcentajes: una cola sola no es interrumpida');
  // E4. Reparto exacto con las tres colas saturadas: en cada ciclo cada cola recibe EXACTAMENTE su cuota
  [[50, 30, 20, 10], [60, 30, 10, 10], [34, 33, 33, 10], [70, 20, 10, 20], [25, 25, 50, 8]].forEach(([a, b, c, cyc]) => {
    const procs = [{ id: 'S', arrival: 0, burst: 900, queue: 0 }, { id: 'I', arrival: 0, burst: 900, queue: 1 }, { id: 'B', arrival: 0, burst: 900, queue: 2 }];
    const r = simulate(procs, pcfg([a, b, c], cyc));
    const quota = MLQ.allocateQuotas([a, b, c], cyc);
    for (let w = 0; w < 60; w++) {
      const cnt = [0, 0, 0];
      for (let i = w * cyc; i < (w + 1) * cyc; i++) cnt[r.ticks[i].queue]++;
      eq(cnt, quota, `Saturado [${a},${b},${c}] ciclo ${cyc}, ventana ${w}: cuota exacta por cola`);
    }
    const first = 60 * cyc;
    const total = [0, 0, 0]; for (let i = 0; i < first; i++) total[r.ticks[i].queue]++;
    quota.forEach((qv, i) => eq(total[i] / first, qv / cyc, `Saturado [${a},${b},${c}]: fracción de CPU de la cola ${i}`));
    invariants(procs, pcfg([a, b, c], cyc), r, `Saturado [${a},${b},${c}]/${cyc}`);
  });
  // E5. Las 64 combinaciones de algoritmos × varias configuraciones de porcentaje × ambos escenarios + oráculo
  let pcombos = 0;
  [SCENARIOS.base.processes, SCENARIOS.interrupciones.processes].forEach((procs, si) => {
    for (const a0 of ALGS) for (const a1 of ALGS) for (const a2 of ALGS) {
      [[50, 30, 20, 10], [60, 30, 10, 10], [20, 30, 50, 5], [34, 33, 33, 6]].forEach(([a, b, c, cyc], k) => {
        const cfg = { policy: 'percent', percent: [a, b, c], cycle: cyc, queues: [{ algorithm: a0, quantum: 1 + (k % 3) }, { algorithm: a1, quantum: 2 }, { algorithm: a2, quantum: 3 }] };
        const label = `Esc${si} %${a}/${b}/${c} c${cyc} ${a0}/${a1}/${a2}`;
        const res = simulate(procs, cfg);
        invariants(procs, cfg, res, label);
        const o = oracle(procs, cfg);
        eq(res.ticks.map((t) => t.pid), o.timeline, `${label}: Gantt motor = oráculo`);
        pcombos++;
      });
    }
  });
  // E6. Aleatorios
  const PR = 5000;
  for (let k = 0; k < PR; k++) {
    const n = ri(1, 9), maxA = ri(0, 12);
    const procs = Array.from({ length: n }, (_, i) => ({ id: `P${i + 1}`, arrival: ri(0, maxA), burst: ri(1, 9), queue: ri(0, 2) }));
    const a = ri(5, 60), b = ri(5, 90 - a), c = 100 - a - b;
    const cyc = ri(5, 20);
    const cfg = { policy: 'percent', percent: [a, b, c], cycle: cyc, queues: [0, 1, 2].map(() => ({ algorithm: ALGS[ri(0, 3)], quantum: ri(1, 5) })) };
    if (MLQ.validateConfig(cfg).length) continue;
    const label = `Aleatorio%#${k}`;
    const res = simulate(procs, cfg);
    invariants(procs, cfg, res, label);
    const o = oracle(procs, cfg);
    eq(res.ticks.map((t) => t.pid), o.timeline, `${label}: Gantt motor = oráculo\n     procesos: ${JSON.stringify(procs)}\n     config: ${JSON.stringify(cfg)}`);
    if (failures.length > 25) break;
  }
  // E7. Validación de la política
  const q3 = [0, 1, 2].map(() => ({ algorithm: 'FCFS', quantum: 2 }));
  eq(MLQ.validateConfig({ policy: 'percent', percent: [50, 30, 20], cycle: 10, queues: q3 }), [], 'Validación: configuración correcta');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [50, 30, 30], cycle: 10, queues: q3 }).length > 0, 'Validación: la suma debe ser 100');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [0, 50, 50], cycle: 10, queues: q3 }).length > 0, 'Validación: 0 % no es válido');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [98, 1, 1], cycle: 10, queues: q3 }).length > 0, 'Validación: una cola con cuota 0 se rechaza');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [50, 30, 20], cycle: 2, queues: q3 }).length > 0, 'Validación: ciclo mínimo');
  ok(MLQ.validateConfig({ policy: 'priority', percent: [1, 1, 1], cycle: 0, queues: q3 }).length === 0, 'Validación: en prioridad fija los porcentajes se ignoran');
  // E8. Regresión: con prioridad fija, el resultado NO depende de los campos de porcentaje
  const baseA = simulate(SCENARIOS.base.processes, DEFAULT_CONFIG());
  const baseB = simulate(SCENARIOS.base.processes, Object.assign(DEFAULT_CONFIG(), { percent: [10, 10, 80], cycle: 4 }));
  eq(baseA.ticks, baseB.ticks, 'Regresión: prioridad fija ignora los porcentajes');
  console.log(` Pruebas del reparto de cuotas (mayor resto)        : ${allocChecks} combinaciones`);
  console.log(` Porcentajes: combinaciones de algoritmos × configs : ${pcombos}`);
  console.log(` Porcentajes: escenarios aleatorios                 : ${PR}`);
}

/* ---------------------------------------------------------------
   F. PRUEBAS MULTI-COLA (> 3 COLAS: 4, 5, 6 Y 7 COLAS)
   --------------------------------------------------------------- */
{
  // F1. Escenario integrado de 5 colas (calculado a mano)
  const sc5 = SCENARIOS.multicola;
  const r5 = simulate(sc5.processes, sc5.config);
  eq(blocks(r5), [
    ['P1', 0, 1], ['P2', 1, 2], ['P3', 2, 5], ['P4', 5, 7],
    ['P7', 7, 9], ['P4', 9, 12], ['P2', 12, 14], ['P6', 14, 15],
    ['P5', 15, 18], ['P1', 18, 21]
  ], 'Escenario 5 colas: Gantt exacto');
  const exp5 = {
    P1: [21, 21, 17, 0], P2: [14, 13, 10, 0], P3: [5, 3, 0, 0],
    P4: [12, 8, 3, 1], P5: [18, 12, 9, 9], P6: [15, 7, 6, 6], P7: [9, 2, 0, 0]
  };
  Object.keys(exp5).forEach((id) => {
    const m = byId(r5, id);
    eq([m.finish, m.turnaround, m.waiting, m.response], exp5[id], `Escenario 5 colas ${id}: [fin, retorno, espera, respuesta]`);
  });
  eq(r5.makespan, 21, 'Escenario 5 colas: makespan');
  eq(r5.metrics.perQueue.length, 5, 'Escenario 5 colas: 5 filas en perQueue');
  eq(r5.metrics.perQueue.map((q) => q.cpuTime), [5, 5, 3, 4, 4], 'Escenario 5 colas: CPU por cola');
  invariants(sc5.processes, sc5.config, r5, 'Escenario 5 colas');

  // F2. Escenario de 4 colas con política por porcentajes (calculado a mano: 40/30/20/10, ciclo 10)
  const cfg4pct = {
    policy: 'percent',
    percent: [40, 30, 20, 10],
    cycle: 10,
    queues: [
      { name: 'Tiempo real', algorithm: 'FCFS', quantum: 2 },
      { name: 'Sistema', algorithm: 'RR', quantum: 2 },
      { name: 'Interactiva', algorithm: 'SJF', quantum: 2 },
      { name: 'Fondo', algorithm: 'FCFS', quantum: 2 }
    ]
  };
  const procs4 = [
    { id: 'A', arrival: 0, burst: 5, queue: 0 },
    { id: 'B', arrival: 0, burst: 4, queue: 1 },
    { id: 'C', arrival: 0, burst: 3, queue: 2 },
    { id: 'D', arrival: 0, burst: 2, queue: 3 }
  ];
  const r4p = simulate(procs4, cfg4pct);
  eq(blocks(r4p), [
    ['A', 0, 4], ['B', 4, 7], ['C', 7, 9], ['D', 9, 10],
    ['A', 10, 11], ['B', 11, 12], ['C', 12, 13], ['D', 13, 14]
  ], '4 colas porcentajes (40/30/20/10): Gantt exacto');
  eq(r4p.metrics.perQueue.map((q) => q.cpuTime), [5, 4, 3, 2], '4 colas porcentajes: CPU por cola');
  invariants(procs4, cfg4pct, r4p, '4 colas porcentajes');

  // F3. Saturado con 4, 5 y 6 colas en modo porcentajes
  [
    { pct: [40, 30, 20, 10], cyc: 10 },
    { pct: [30, 25, 20, 15, 10], cyc: 20 },
    { pct: [25, 20, 20, 15, 10, 10], cyc: 20 }
  ].forEach(({ pct, cyc }) => {
    const nq = pct.length;
    const procs = Array.from({ length: nq }, (_, q) => ({ id: `Q${q + 1}`, arrival: 0, burst: 400, queue: q }));
    const cfg = { policy: 'percent', percent: pct, cycle: cyc, queues: pct.map((_, q) => ({ algorithm: ALGS[q % 4], quantum: 2 })) };
    const r = simulate(procs, cfg);
    const quota = MLQ.allocateQuotas(pct, cyc);
    eq(quota.reduce((s, v) => s + v, 0), cyc, `Saturado ${nq} colas: suma de cuotas = ciclo`);
    for (let w = 0; w < 20; w++) {
      const cnt = Array(nq).fill(0);
      for (let i = w * cyc; i < (w + 1) * cyc; i++) cnt[r.ticks[i].queue]++;
      eq(cnt, quota, `Saturado ${nq} colas ventana ${w}: cuota exacta por cola`);
    }
    invariants(procs, cfg, r, `Saturado ${nq} colas`);
  });

  // F4. Aleatorios multi-cola (4 a 7 colas, prioridad fija y porcentajes) vs oráculo
  const MULTI_RUNS = 4000;
  for (let k = 0; k < MULTI_RUNS; k++) {
    const nq = ri(4, 7);
    const n = ri(nq, 12), maxA = ri(0, 10);
    const procs = Array.from({ length: n }, (_, i) => ({
      id: `P${i + 1}`,
      arrival: ri(0, maxA),
      burst: ri(1, 8),
      queue: i < nq ? i : ri(0, nq - 1)
    }));
    const usePct = k % 2 === 1;
    let cfg;
    if (!usePct) {
      cfg = { policy: 'priority', queues: Array.from({ length: nq }, (_, i) => ({ name: `C${i + 1}`, algorithm: ALGS[ri(0, 3)], quantum: ri(1, 4) })) };
    } else {
      const cyc = ri(nq, 20);
      const pct = Array(nq).fill(Math.floor(100 / nq));
      pct[0] += 100 - pct.reduce((a, b) => a + b, 0);
      cfg = { policy: 'percent', percent: pct, cycle: cyc, queues: Array.from({ length: nq }, (_, i) => ({ name: `C${i + 1}`, algorithm: ALGS[ri(0, 3)], quantum: ri(1, 4) })) };
      if (MLQ.validateConfig(cfg).length) continue;
    }
    const label = `MultiCola(${nq})#${k}`;
    const res = simulate(procs, cfg);
    invariants(procs, cfg, res, label);
    const o = oracle(procs, cfg);
    eq(res.ticks.map((t) => t.pid), o.timeline, `${label}: Gantt motor = oráculo`);
    eq(Object.fromEntries(res.metrics.perProcess.map((m) => [m.id, m.finish])), o.fin, `${label}: finales motor = oráculo`);
    if (failures.length > 25) break;
  }

  // F5. Validaciones multi-cola
  const q4 = [0, 1, 2, 3].map(() => ({ algorithm: 'FCFS', quantum: 2 }));
  throws(() => simulate([{ id: 'P1', arrival: 0, burst: 2, queue: 4 }], { queues: q4 }), 'Cola fuera de rango (>= nq)');
  throws(() => simulate([{ id: 'P1', arrival: 0, burst: 2, queue: 0 }], { queues: [] }), '0 colas inválido');
  throws(() => simulate([{ id: 'P1', arrival: 0, burst: 2, queue: 0 }], { queues: Array.from({ length: 11 }, () => ({ algorithm: 'FCFS', quantum: 2 })) }), '>10 colas inválido');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [40, 30, 20, 10], cycle: 3, queues: q4 }).length > 0, 'Validación 4 colas: ciclo < nº de colas');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [50, 30, 20], cycle: 10, queues: q4 }).length > 0, 'Validación 4 colas: longitud de porcentajes != nº de colas');
  ok(MLQ.validateConfig({ policy: 'percent', percent: [40, 30, 20, 10], cycle: 10, queues: q4 }).length === 0, 'Validación 4 colas: configuración válida');
  console.log(` Pruebas multi-cola (4 a 7 colas, fijas + %)      : ${MULTI_RUNS} escenarios`);
}

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
