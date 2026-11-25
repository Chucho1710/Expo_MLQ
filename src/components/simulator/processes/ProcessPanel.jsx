import React from 'react';
import ProcessForm from './ProcessForm.jsx';
import ProcessCard from './ProcessCard.jsx';
import { getProcessColors } from '../../../engine/mlqEngine.js';

export default function ProcessPanel({
  processes,
  config,
  onProcessesChange,
  onLoadScenario,
  onClearProcesses,
  toast
}) {
  const nextId = () => {
    let max = 0;
    processes.forEach((p) => {
      const m = /^P(\d+)$/i.exec(p.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `P${max + 1}`;
  };

  const processColors = getProcessColors(processes, config);

  const handleAddProcess = (newProcess) => {
    onProcessesChange([...processes, newProcess]);
  };

  const handleDeleteProcess = (id) => {
    const next = processes.filter((p) => p.id !== id);
    onProcessesChange(next);
    toast(`Proceso ${id} eliminado.`);
  };

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

      <ProcessForm
        config={config}
        processes={processes}
        nextPlaceholderId={nextId()}
        onAddProcess={handleAddProcess}
        toast={toast}
      />

      <div className="proc-list">
        {processes.map((p) => {
          const col = processColors.get(p.id) || { bg: '#1e293b', fg: '#fff' };
          return (
            <ProcessCard
              key={p.id}
              process={p}
              config={config}
              color={col}
              onDelete={handleDeleteProcess}
            />
          );
        })}
      </div>
    </div>
  );
}
