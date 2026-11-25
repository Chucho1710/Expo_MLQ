import React from 'react';
import { queueName, queuePalette, allocateQuotas } from '../../engine/mlqEngine.js';

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function QueueSummaryTable({ metrics, config, isPercent }) {
  const quotas = isPercent ? allocateQuotas(config.percent, config.cycle) : null;

  return (
    <div className="res-block">
      <h4>Promedios por cola</h4>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cola</th>
              <th className="tnum">Procesos</th>
              <th className="tnum">Espera prom.</th>
              <th className="tnum">Retorno prom.</th>
              <th className="tnum">CPU usada</th>
              {isPercent && <th className="tnum">% configurado</th>}
            </tr>
          </thead>
          <tbody>
            {metrics.perQueue.map((q) => {
              const cpuPct = metrics.busy
                ? (Math.round((q.cpuTime / metrics.busy) * 1000) / 10).toFixed(1)
                : '0.0';
              return (
                <tr key={q.queue}>
                  <th scope="row">
                    <span
                      className="qdot"
                      style={{ background: queuePalette(q.queue).base }}
                    />
                    {queueName(config, q.queue)}
                  </th>
                  <td className="tnum">{q.count}</td>
                  <td className="tnum">{q.count ? fmt(q.avgWaiting) : '—'}</td>
                  <td className="tnum">{q.count ? fmt(q.avgTurnaround) : '—'}</td>
                  <td className="tnum">
                    {q.cpuTime} u ({cpuPct} %)
                  </td>
                  {isPercent && (
                    <td className="tnum">
                      {config.percent[q.queue]} % · {quotas ? quotas[q.queue] : '—'} u/ciclo
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
