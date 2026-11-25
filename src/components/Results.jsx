import React from 'react';
import { queueName, queuePalette, allocateQuotas } from '../engine/mlqEngine.js';

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function Results({ simResult, cursor, config }) {
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
  const quotas = isPercent ? allocateQuotas(cfg.percent, cfg.cycle) : null;
  const orderText = cfg.queues.map((_, i) => queueName(cfg, i)).join(' > ');

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
        {/* KPIs */}
        <div className="kpis">
          <div className="kpi">
            <small>Tiempo total (makespan)</small>
            <strong>{m.makespan}</strong>
            <span> unidades</span>
          </div>
          <div className="kpi">
            <small>Utilización de CPU</small>
            <strong>{fmt(m.utilization)}%</strong>
            <span> {m.busy} ocupada · {m.idle} ociosa</span>
          </div>
          <div className="kpi">
            <small>Espera promedio</small>
            <strong>{fmt(m.avgWaiting)}</strong>
          </div>
          <div className="kpi">
            <small>Retorno promedio</small>
            <strong>{fmt(m.avgTurnaround)}</strong>
          </div>
          <div className="kpi">
            <small>Respuesta promedio</small>
            <strong>{fmt(m.avgResponse)}</strong>
          </div>
          <div className="kpi">
            <small>Cambios de contexto</small>
            <strong>{m.contextSwitches}</strong>
            <span> {m.preemptions} interrupción(es) entre colas</span>
          </div>
        </div>

        {/* Tabla completa por proceso */}
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
                {m.perProcess.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.id}</th>
                    <td>
                      <span
                        className="qdot"
                        style={{ background: queuePalette(p.queue).base }}
                      />
                      {queueName(cfg, p.queue)}
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
                  <td className="tnum">{fmt(m.avgWaiting)}</td>
                  <td className="tnum">{fmt(m.avgTurnaround)}</td>
                  <td className="tnum">{fmt(m.avgResponse)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Promedios por cola y explicación */}
        <div className="res-grid">
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
                  {m.perQueue.map((q) => {
                    const cpuPct = m.busy
                      ? (Math.round((q.cpuTime / m.busy) * 1000) / 10).toFixed(1)
                      : '0.0';
                    return (
                      <tr key={q.queue}>
                        <th scope="row">
                          <span
                            className="qdot"
                            style={{ background: queuePalette(q.queue).base }}
                          />
                          {queueName(cfg, q.queue)}
                        </th>
                        <td className="tnum">{q.count}</td>
                        <td className="tnum">{q.count ? fmt(q.avgWaiting) : '—'}</td>
                        <td className="tnum">{q.count ? fmt(q.avgTurnaround) : '—'}</td>
                        <td className="tnum">
                          {q.cpuTime} u ({cpuPct} %)
                        </td>
                        {isPercent && (
                          <td className="tnum">
                            {cfg.percent[q.queue]} % · {quotas ? quotas[q.queue] : '—'} u/ciclo
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="how">
            <h4>Cómo se calculan</h4>
            <ul>
              <li><code>Retorno</code> = finalización − llegada</li>
              <li><code>Espera</code> = retorno − ráfaga</li>
              <li><code>Respuesta</code> = 1.ª vez en CPU − llegada</li>
              <li><code>Utilización</code> = tiempo con CPU ocupada ÷ makespan</li>
            </ul>
            <p>
              {isPercent
                ? `Política usada: porcentajes de CPU (${cfg.percent.join(' / ')} %, ciclo de ${cfg.cycle} unidades). El porcentaje real puede diferir del configurado cuando una cola se queda sin procesos y las demás aprovechan su tiempo.`
                : `Política usada: prioridad fija entre colas (${orderText}).`}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
