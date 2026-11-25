import React from 'react';
import QueuesAndProcessesSection from './queuesAndProcesses/QueuesAndProcessesSection.jsx';
import Controls from './controls/Controls.jsx';
import Board from './board/Board.jsx';
import GanttChart from './gantt/GanttChart.jsx';
import GanttTable from './gantt/GanttTable.jsx';
import LiveProcessTable from './processTable/LiveProcessTable.jsx';
import TelemetrySection from './telemetry/TelemetrySection.jsx';

export default function SimulatorSection({
  config,
  processes,
  currentSnapshot,
  simResult,
  cursor,
  status,
  speed,
  isFinished,
  ganttMs,
  onChangeConfig,
  onResetConfig,
  onProcessesChange,
  onLoadScenario,
  onClearProcesses,
  onSpeedChange,
  onStart,
  onPause,
  onResume,
  onStepNext,
  onStepBack,
  onGoEnd,
  onReset,
  toast
}) {
  return (
    <section className="sim-section" id="simulador">
      <div className="wrap">
        <div className="section-head on-dark">
          <span className="eyebrow">Laboratorio</span>
          <h2>Simulador interactivo de MLQ</h2>
          <p>
            Configura las colas con sus procesos y observa cada decisión del planificador.
            Atajos: <kbd>Espacio</kbd> pausar/continuar · <kbd>→</kbd> siguiente paso · <kbd>←</kbd> paso anterior.
          </p>
        </div>

        {/* 1 · Sección Unificada de Colas y Procesos */}
        <QueuesAndProcessesSection
          config={config}
          processes={processes}
          onChangeConfig={onChangeConfig}
          onResetConfig={onResetConfig}
          onProcessesChange={onProcessesChange}
          onLoadScenario={onLoadScenario}
          onClearProcesses={onClearProcesses}
          toast={toast}
        />

        {/* Controles de reproducción */}
        <Controls
          status={status}
          cursor={cursor}
          currentSnapshot={currentSnapshot}
          speed={speed}
          onSpeedChange={onSpeedChange}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onStepNext={onStepNext}
          onStepBack={onStepBack}
          onGoEnd={onGoEnd}
          onReset={onReset}
        />

        {/* 3 · Tablero: Colas y CPU */}
        <Board
          processes={processes}
          config={config}
          currentSnapshot={currentSnapshot}
          isFinished={isFinished}
          simResult={simResult}
          ganttMs={ganttMs}
        />

        {/* 4 · Diagrama de Gantt */}
        <GanttChart
          simResult={simResult}
          cursor={cursor}
          processes={processes}
          config={config}
          status={status}
          ganttMs={ganttMs}
        />

        {/* 5 · Cronograma por proceso (Gantt en tabla) */}
        <GanttTable
          simResult={simResult}
          cursor={cursor}
          currentSnapshot={currentSnapshot}
          processes={processes}
          config={config}
          status={status}
        />

        {/* 6 · Tabla de procesos */}
        <LiveProcessTable
          processes={processes}
          config={config}
          currentSnapshot={currentSnapshot}
          simResult={simResult}
        />

        {/* 7 y 8 · ¿Qué está pasando? + Registro de eventos */}
        <TelemetrySection
          currentSnapshot={currentSnapshot}
          simResult={simResult}
          cursor={cursor}
        />
      </div>
    </section>
  );
}
