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
  SCENARIOS,
  simulate
} from './engine/mlqEngine.js';

export default function App() {
  const [config, setConfig] = useState(() => DEFAULT_CONFIG());
  const [processes, setProcesses] = useState(() =>
    SCENARIOS.base.processes.map((p) => ({ ...p }))
  );
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
      const res = simulate(processes, config);
      setSimResult(res);
      return res;
    } catch (err) {
      setSimResult(null);
      showToast(err.message);
      return null;
    }
  }, [simResult, processes, config, showToast]);

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
    const delayMs = Math.round(1700 - speed * 150);

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

  const handleLoadScenario = (key) => {
    const sc = SCENARIOS[key];
    if (!sc) return;
    let nextConfig = config;

    if (sc.config) {
      nextConfig = JSON.parse(JSON.stringify(sc.config));
    } else {
      const maxQ = Math.max(...sc.processes.map((p) => p.queue), 2);
      if (config.queues.length < maxQ + 1) {
        const nextQueues = [...config.queues];
        const nextPct = [...config.percent];
        const def = DEFAULT_CONFIG();
        while (nextQueues.length < maxQ + 1) {
          const i = nextQueues.length;
          const template = def.queues[i] || {
            name: `Cola ${i + 1}`,
            description: `Cola de prioridad nivel ${i + 1}.`,
            algorithm: 'FCFS',
            quantum: 4
          };
          nextQueues.push({ ...template });
          nextPct.push(Math.max(1, Math.floor(100 / nextQueues.length)));
        }
        nextConfig = { ...config, queues: nextQueues, percent: nextPct };
      }
    }

    resetSimulation();
    setConfig(nextConfig);
    setProcesses(sc.processes.map((p) => ({ ...p })));
    showToast(`${sc.name} cargado.`);
  };

  const handleClearProcesses = () => {
    resetSimulation();
    setProcesses([]);
    showToast('Lista de procesos vaciada.');
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
          onLoadScenario={handleLoadScenario}
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

        <ResultsSection simResult={simResult} cursor={cursor} />
      </main>

      <Footer />

      <Toast message={toastMsg} visible={toastVisible} />
    </>
  );
}
