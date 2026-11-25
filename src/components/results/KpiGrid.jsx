import React from 'react';

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function KpiGrid({ metrics }) {
  return (
    <div className="kpis">
      <div className="kpi">
        <small>Tiempo total (makespan)</small>
        <strong>{metrics.makespan}</strong>
        <span> unidades</span>
      </div>
      <div className="kpi">
        <small>Utilización de CPU</small>
        <strong>{fmt(metrics.utilization)}%</strong>
        <span> {metrics.busy} ocupada · {metrics.idle} ociosa</span>
      </div>
      <div className="kpi">
        <small>Espera promedio</small>
        <strong>{fmt(metrics.avgWaiting)}</strong>
      </div>
      <div className="kpi">
        <small>Retorno promedio</small>
        <strong>{fmt(metrics.avgTurnaround)}</strong>
      </div>
      <div className="kpi">
        <small>Respuesta promedio</small>
        <strong>{fmt(metrics.avgResponse)}</strong>
      </div>
      <div className="kpi">
        <small>Cambios de contexto</small>
        <strong>{metrics.contextSwitches}</strong>
        <span> {metrics.preemptions} interrupción(es) entre colas</span>
      </div>
    </div>
  );
}
