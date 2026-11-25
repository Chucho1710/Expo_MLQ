import React, { useState, useEffect, useCallback, useRef } from 'react';
import Topbar from './components/layout/Topbar.jsx';
import Hero from './components/layout/Hero.jsx';
import Footer from './components/layout/Footer.jsx';
import TheorySection from './components/theory/TheorySection.jsx';
import SimulatorSection from './components/simulator/SimulatorSection.jsx';
import ResultsSection from './components/results/ResultsSection.jsx';
import Toast from './components/common/Toast.jsx';

import {
  DEFAULT_CONFIG,
  simulate,
  queueName
} from './engine/mlqEngine.js';

/* ─── Export helpers ──────────────────────────────────────────────── */

function downloadText(content, filename, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function exportJSON(processes, config, simResult, interruptions = []) {
  const payload = {
    processes,
    config,
    ...(interruptions.length ? { interruptions } : {}),
    ...(simResult ? { results: simResult.metrics } : {})
  };
  downloadText(JSON.stringify(payload, null, 2), 'mlq-simulacion.json', 'application/json');
}

function exportCSV(simResult, config) {
  if (!simResult) return;
  const m = simResult.metrics;
  const header = ['Proceso', 'Cola', 'Llegada', 'Ráfaga', '1ª CPU', 'Fin', 'Espera', 'Retorno', 'Respuesta'];
  const rows = m.perProcess.map((p) => [
    p.id,
    queueName(config, p.queue),
    p.arrival,
    p.burst,
    p.start,
    p.finish,
    p.waiting,
    p.turnaround,
    p.response,
  ]);
  const footer = [
    'Promedios', '', '', '', '', '',
    m.avgWaiting.toFixed(2),
    m.avgTurnaround.toFixed(2),
    m.avgResponse.toFixed(2),
  ];
  const csv = [header, ...rows, footer]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  downloadText(csv, 'mlq-resultados.csv', 'text/csv;charset=utf-8');
}

/** Renders the Gantt as a minimal SVG and triggers download */
function exportGanttSVG(simResult, processes, config) {
  if (!simResult) return;
  const { ticks, makespan } = simResult;
  const M = makespan;

  // Build segments
  const segs = [];
  ticks.forEach((tk) => {
    const last = segs[segs.length - 1];
    if (tk.interrupt) {
      if (last && last.isInterrupt && last.interrupt === tk.interrupt && last.end === tk.t) {
        last.end = tk.t + 1;
      } else {
        segs.push({ isInterrupt: true, interrupt: tk.interrupt, interruptLabel: tk.interruptLabel, pid: null, queue: null, start: tk.t, end: tk.t + 1 });
      }
    } else if (last && !last.isInterrupt && last.pid === tk.pid && !tk.dispatch && last.end === tk.t) {
      last.end = tk.t + 1;
    } else {
      segs.push({ pid: tk.pid, queue: tk.queue, start: tk.t, end: tk.t + 1 });
    }
  });

  const queueColors = config.queues.map((_, i) => {
    const shades = ['#7a0c1e','#1e293b','#6b7280','#0f766e','#b45309','#4338ca','#7e22ce','#15803d','#0369a1','#9a3412'];
    return shades[i % shades.length];
  });

  const W = Math.max(800, M * 24);
  const H = 80;
  const trackH = 32;
  const trackY = 24;
  const pxPerUnit = W / M;

  let svgParts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="monospace" font-size="11">`];
  svgParts.push(`<rect width="${W}" height="${H}" fill="#f4f5f7"/>`);

  // Axis labels
  const step = Math.max(1, Math.ceil(M / 30));
  for (let i = 0; i <= M; i += step) {
    const x = (i / M) * W;
    svgParts.push(`<line x1="${x}" y1="${trackY + trackH}" x2="${x}" y2="${trackY + trackH + 6}" stroke="#6b7280" stroke-width="1"/>`);
    svgParts.push(`<text x="${x}" y="${trackY + trackH + 16}" text-anchor="middle" fill="#374151">${i}</text>`);
  }

  // Segments
  segs.forEach((s) => {
    const isIdle = !s.isInterrupt && s.pid === null;
    const x = (s.start / M) * W;
    const w = Math.max(1, ((s.end - s.start) / M) * W);
    const fill = s.isInterrupt ? '#d97706' : isIdle ? '#d1d5db' : (queueColors[s.queue] || '#6b7280');
    const fg = s.isInterrupt ? '#ffffff' : isIdle ? '#374151' : '#ffffff';
    const label = s.isInterrupt ? `⚡ ${s.interruptLabel}` : isIdle ? '…' : s.pid;
    svgParts.push(`<rect x="${x}" y="${trackY}" width="${w}" height="${trackH}" fill="${fill}" rx="2"/>`);
    if (w > 16) {
      svgParts.push(`<text x="${x + w / 2}" y="${trackY + trackH / 2 + 4}" text-anchor="middle" fill="${fg}">${label}</text>`);
    }
  });

  // Legend
  config.queues.forEach((_, i) => {
    const lx = i * 100 + 4;
    svgParts.push(`<rect x="${lx}" y="4" width="12" height="12" fill="${queueColors[i]}" rx="2"/>`);
    svgParts.push(`<text x="${lx + 15}" y="14" fill="#111827">${queueName(config, i)}</text>`);
  });

  svgParts.push('</svg>');
  downloadText(svgParts.join('\n'), 'mlq-gantt.svg', 'image/svg+xml');
}

/* ─── App ─────────────────────────────────────────────────────────── */

export default function App() {
  const [config, setConfig] = useState(() => DEFAULT_CONFIG());
  const [processes, setProcesses] = useState([]);
  const [interruptions, setInterruptions] = useState([]);
  const [simResult, setSimResult] = useState(null);
  const [cursor, setCursor] = useState(-1);
  const [status, setStatus] = useState('idle'); // idle | running | paused | finished
  const [speed, setSpeed] = useState(4);

  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    setToastVisible(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 3200);
  }, []);

  const resetSimulation = useCallback((reasonMsg) => {
    setStatus((prevStatus) => {
      if (prevStatus !== 'idle' && reasonMsg) {
        showToast(reasonMsg);
      }
      return 'idle';
    });
    setSimResult(null);
    setCursor(-1);
  }, [showToast]);

  const ensureSim = useCallback(() => {
    if (simResult) return simResult;
    try {
      const res = simulate(processes, config, interruptions);
      setSimResult(res);
      return res;
    } catch (err) {
      setSimResult(null);
      showToast(err.message);
      return null;
    }
  }, [simResult, processes, config, interruptions, showToast]);

  const handleStart = useCallback(() => {
    if (status !== 'idle') return;
    const res = ensureSim();
    if (!res) return;
    setCursor(0);
    setStatus('running');
  }, [status, ensureSim]);

  const handlePause = useCallback(() => {
    if (status !== 'running') return;
    setStatus('paused');
  }, [status]);

  const handleResume = useCallback(() => {
    if (status !== 'paused') return;
    setStatus('running');
  }, [status]);

  const handleStepNext = useCallback(() => {
    if (status === 'running' || status === 'finished') return;
    const res = ensureSim();
    if (!res) return;
    const lastIdx = res.snapshots.length - 1;

    setCursor((prev) => {
      const next = prev < 0 ? 0 : Math.min(prev + 1, lastIdx);
      if (next >= lastIdx) setStatus('finished');
      else setStatus('paused');
      return next;
    });
  }, [status, ensureSim]);

  const handleStepBack = useCallback(() => {
    if (!(status === 'paused' || status === 'finished') || cursor <= 0) return;
    setCursor((prev) => prev - 1);
    setStatus('paused');
  }, [status, cursor]);

  const handleGoEnd = useCallback(() => {
    if (status === 'finished') return;
    const res = ensureSim();
    if (!res) return;
    setCursor(res.snapshots.length - 1);
    setStatus('finished');
  }, [status, ensureSim]);

  const handleReset = useCallback(() => {
    resetSimulation();
  }, [resetSimulation]);

  // Ejecución automática paso a paso cuando status === 'running'
  useEffect(() => {
    if (status !== 'running') return;
    const baseDelayMs = Math.round(1700 - speed * 150);

    const currentSnap = simResult && cursor >= 0 ? simResult.snapshots[cursor] : null;
    const isFinishingBurst = currentSnap?.cpu?.remaining === 1;
    const delayMs = isFinishingBurst ? baseDelayMs + 650 : baseDelayMs;

    const timer = setTimeout(() => {
      if (!simResult) return;
      const lastIdx = simResult.snapshots.length - 1;

      setCursor((prev) => {
        if (prev >= lastIdx) {
          setStatus('finished');
          return prev;
        }
        const next = prev + 1;
        if (next >= lastIdx) {
          setStatus('finished');
        }
        return next;
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [status, cursor, simResult, speed]);

  // Cambios de configuración de colas
  const handleConfigChange = (newConfig, nextProcs) => {
    resetSimulation('Se reinició la simulación porque cambiaste la configuración.');
    setConfig(newConfig);
    if (nextProcs) setProcesses(nextProcs);
  };

  const handleResetConfig = () => {
    const def = DEFAULT_CONFIG();
    let clamped = 0;
    const nextProcs = processes.map((p) => {
      if (p.queue >= def.queues.length) {
        clamped++;
        return { ...p, queue: def.queues.length - 1 };
      }
      return p;
    });
    resetSimulation(
      clamped
        ? `Configuración predeterminada restaurada (${clamped} proceso(s) reasignados a Batch).`
        : 'Configuración predeterminada restaurada.'
    );
    setConfig(def);
    setProcesses(nextProcs);
  };

  // Cambios en procesos
  const handleProcessesChange = (newProcs) => {
    resetSimulation('Se reinició la simulación porque cambiaste los procesos.');
    setProcesses(newProcs);
  };

  // Cambios en interrupciones externas
  const handleInterruptionsChange = (newInterruptions) => {
    resetSimulation('Se reinició la simulación porque cambiaste las interrupciones.');
    setInterruptions(newInterruptions);
  };

  // Importar JSON: { processes, config?, interruptions? }
  const handleImport = (procs, cfg, ints = []) => {
    resetSimulation();
    if (cfg) {
      // Clamp queue indices to the imported config's queue count
      const qCount = cfg.queues.length;
      const fixedProcs = procs.map((p) => ({
        ...p,
        queue: Math.min(Math.max(0, p.queue), qCount - 1)
      }));
      setConfig(cfg);
      setProcesses(fixedProcs);
    } else {
      // Clamp to current config's queue count
      const qCount = config.queues.length;
      const fixedProcs = procs.map((p) => ({
        ...p,
        queue: Math.min(Math.max(0, p.queue), qCount - 1)
      }));
      setProcesses(fixedProcs);
    }
    setInterruptions(Array.isArray(ints) ? ints : []);
  };

  const handleClearProcesses = () => {
    resetSimulation();
    setProcesses([]);
    showToast('Lista de procesos vaciada.');
  };

  // Export handlers
  const handleExportJSON = () => {
    exportJSON(processes, config, simResult, interruptions);
    showToast('Exportado como mlq-simulacion.json');
  };
  const handleExportCSV = () => {
    if (!simResult) { showToast('Ejecuta la simulación primero.'); return; }
    exportCSV(simResult, config);
    showToast('Tabla exportada como mlq-resultados.csv');
  };
  const handleExportGanttSVG = () => {
    if (!simResult) { showToast('Ejecuta la simulación primero.'); return; }
    exportGanttSVG(simResult, processes, config);
    showToast('Diagrama de Gantt exportado como mlq-gantt.svg');
  };

  const currentSnapshot =
    simResult && cursor >= 0 ? simResult.snapshots[cursor] : null;
  const isFinished =
    simResult && cursor >= simResult.snapshots.length - 1;
  const ganttMs = status === 'running' ? Math.round(1700 - speed * 150) : 280;

  return (
    <>
      <Topbar />

      <Hero />

      <main>
        <TheorySection />

        <SimulatorSection
          config={config}
          processes={processes}
          interruptions={interruptions}
          currentSnapshot={currentSnapshot}
          simResult={simResult}
          cursor={cursor}
          status={status}
          speed={speed}
          isFinished={isFinished}
          ganttMs={ganttMs}
          onChangeConfig={handleConfigChange}
          onResetConfig={handleResetConfig}
          onProcessesChange={handleProcessesChange}
          onInterruptionsChange={handleInterruptionsChange}
          onImport={handleImport}
          onClearProcesses={handleClearProcesses}
          onSpeedChange={setSpeed}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStepNext={handleStepNext}
          onStepBack={handleStepBack}
          onGoEnd={handleGoEnd}
          onReset={handleReset}
          toast={showToast}
        />

        <ResultsSection
          simResult={simResult}
          cursor={cursor}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
          onExportGanttSVG={handleExportGanttSVG}
        />
      </main>

      <Footer />

      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}
