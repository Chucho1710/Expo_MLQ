import React from 'react';
import KpiGrid from './KpiGrid.jsx';
import FullProcessTable from './FullProcessTable.jsx';
import QueueSummaryTable from './QueueSummaryTable.jsx';
import FormulasGuide from './FormulasGuide.jsx';

export default function ResultsSection({ simResult, cursor, onExportCSV, onExportJSON, onExportGanttSVG }) {
  const isFinished = simResult && cursor >= simResult.snapshots.length - 1;

  if (!isFinished) {
    return (
      <section className="section wrap" id="resultados">
        <div className="section-head">
          <span className="eyebrow">Resultados</span>
          <h2>Métricas de la simulación</h2>
          <p>
            Se calculan con los datos reales de la ejecución: llegada, interrupciones y tiempo de CPU de cada proceso.
          </p>
        </div>
        <div id="results">
          <div className="res-empty">
            <p><strong>Los resultados aparecen cuando termina la simulación.</strong></p>
            <p>Ejecuta la simulación completa o pulsa «Ir al final» en el simulador.</p>
            <a className="btn btn-outline" href="#simulador">Volver al simulador</a>
          </div>
        </div>
      </section>
    );
  }

  const m = simResult.metrics;
  const cfg = simResult.config;
  const isPercent = cfg.policy === 'percent';

  return (
    <section className="section wrap" id="resultados">
      <div className="section-head">
        <span className="eyebrow">Resultados</span>
        <h2>Métricas de la simulación</h2>
        <p>
          Se calculan con los datos reales de la ejecución: llegada, interrupciones y tiempo de CPU de cada proceso.
        </p>
      </div>

      {/* Export toolbar */}
      <div className="export-toolbar">
        <span className="export-label">Exportar:</span>
        <div className="btn-row">
          <button className="btn btn-small btn-primary" type="button" onClick={onExportCSV} title="Descargar tabla de métricas en formato CSV">
            ↓ Tabla (CSV)
          </button>
          <button className="btn btn-small btn-outline" type="button" onClick={onExportGanttSVG} title="Descargar diagrama de Gantt como imagen SVG vectorial">
            ↓ Gantt (SVG)
          </button>
          <button className="btn btn-small btn-outline" type="button" onClick={onExportJSON} title="Descargar configuración, procesos y resultados como JSON (importable)">
            ↓ Simulación completa (JSON)
          </button>
        </div>
      </div>

      <div id="results">
        <KpiGrid metrics={m} />

        <FullProcessTable metrics={m} config={cfg} />

        <div className="res-grid">
          <QueueSummaryTable metrics={m} config={cfg} isPercent={isPercent} />
          <FormulasGuide config={cfg} isPercent={isPercent} />
        </div>
      </div>
    </section>
  );
}
