import React from 'react';
import { queueName, queuePalette } from '../../engine/mlqEngine.js';

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function FullProcessTable({ metrics, config }) {
  return (
    <div className="res-main">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Proceso</th>
              <th>Cola</th>
              <th className="tnum">Llegada</th>
              <th className="tnum">Ráfaga</th>
              <th className="tnum">1.ª vez en CPU</th>
              <th className="tnum">Fin</th>
              <th className="tnum">Espera</th>
              <th className="tnum">Retorno</th>
              <th className="tnum">Respuesta</th>
            </tr>
          </thead>
          <tbody>
            {metrics.perProcess.map((p) => (
              <tr key={p.id}>
                <th scope="row">{p.id}</th>
                <td>
                  <span
                    className="qdot"
                    style={{ background: queuePalette(p.queue).base }}
                  />
                  {queueName(config, p.queue)}
                </td>
                <td className="tnum">{p.arrival}</td>
                <td className="tnum">{p.burst}</td>
                <td className="tnum">{p.start}</td>
                <td className="tnum">{p.finish}</td>
                <td className="tnum">{p.waiting}</td>
                <td className="tnum">{p.turnaround}</td>
                <td className="tnum">{p.response}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="6">Promedios</td>
              <td className="tnum">{fmt(metrics.avgWaiting)}</td>
              <td className="tnum">{fmt(metrics.avgTurnaround)}</td>
              <td className="tnum">{fmt(metrics.avgResponse)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
