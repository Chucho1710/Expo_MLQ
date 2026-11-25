import React from 'react';
import { queueName, queuePalette } from '../../../engine/mlqEngine.js';

export default function LiveProcessTable({
  processes,
  config,
  currentSnapshot,
  simResult
}) {
  const snap = currentSnapshot;
  const metrics = simResult ? simResult.metrics.perProcess : [];

  return (
    <div className="panel" id="panel-tabla">
      <div className="panel-head">
        <h3>6 · Tabla de procesos</h3>
        <span className="hint" style={{ margin: 0 }}>
          Fin, retorno y espera se completan cuando cada proceso termina.
        </span>
      </div>
      <div className="table-wrap">
        <table className="ptable">
          <thead>
            <tr>
              <th>Proceso</th>
              <th>Cola</th>
              <th>Llegada</th>
              <th>Ráfaga</th>
              <th>Fin</th>
              <th>Retorno</th>
              <th>Espera</th>
            </tr>
          </thead>
          <tbody>
            {processes.map((p) => {
              const snapProc = snap ? snap.procs.find((x) => x.id === p.id) : null;
              const st = snapProc ? snapProc.state : 'new';
              const m = metrics.find((x) => x.id === p.id);
              const isDone = st === 'done' && m;
              const qColor = queuePalette(p.queue).base;

              const trClass =
                st === 'running' ? 'row-run' : st === 'new' && snap ? 'row-new' : '';

              return (
                <tr key={p.id} className={trClass}>
                  <th scope="row" style={{ color: qColor }}>
                    {p.id}
                  </th>
                  <td>
                    <span className="qtxt" style={{ color: qColor }}>
                      Q{p.queue + 1}
                    </span>{' '}
                    · {queueName(config, p.queue)}
                  </td>
                  <td>{p.arrival}</td>
                  <td>{p.burst}</td>
                  <td className={isDone ? 'fill' : ''}>{isDone ? m.finish : ''}</td>
                  <td className={isDone ? 'fill' : ''}>{isDone ? m.turnaround : ''}</td>
                  <td className={isDone ? 'fill' : ''}>{isDone ? m.waiting : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
