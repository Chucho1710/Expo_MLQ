import React, { useRef, useEffect } from 'react';
import { queueName, queuePalette, getProcessColors, mixHex } from '../../../engine/mlqEngine.js';

export default function GanttTable({
  simResult,
  cursor,
  currentSnapshot,
  processes,
  config,
  status
}) {
  const scrollRef = useRef(null);
  const headColsRef = useRef([]);
  const processColors = getProcessColors(processes, config);

  const M = simResult ? simResult.makespan : 0;

  useEffect(() => {
    if (scrollRef.current && cursor >= 0 && headColsRef.current[cursor]) {
      const el = scrollRef.current;
      const th = headColsRef.current[cursor];
      if (th && el.scrollWidth > el.clientWidth) {
        const target = th.offsetLeft - el.clientWidth + 140;
        el.scrollTo({
          left: Math.max(0, target),
          behavior: status === 'running' ? 'smooth' : 'auto'
        });
      }
    }
  }, [cursor, status]);

  if (!simResult || cursor < 0) {
    return (
      <div className="panel" id="panel-gantt-table">
        <div className="panel-head">
          <h3>5 · Cronograma por proceso (Gantt en tabla)</h3>
          <div className="gt-legend" aria-label="Leyenda del cronograma por proceso">
            <span><b className="gt-sym gt-sym-x">x</b> llegada</span>
            <span><i className="gt-sw gt-sw-wait" /> esperando</span>
            <span><i className="gt-sw gt-sw-run" /> ejecutándose</span>
            <span><b className="gt-sym gt-sym-f">F</b> finalización</span>
          </div>
        </div>
        <div className="gantt-table" id="gantt-table">
          <div className="gantt-empty">
            La matriz de ejecución por proceso se completará aquí, unidad por unidad, cuando inicies la simulación.
          </div>
        </div>
      </div>
    );
  }

  const snap = currentSnapshot;

  return (
    <div className="panel" id="panel-gantt-table">
      <div className="panel-head">
        <h3>5 · Cronograma por proceso (Gantt en tabla)</h3>
        <div className="gt-legend" aria-label="Leyenda del cronograma por proceso">
          <span><b className="gt-sym gt-sym-x">x</b> llegada</span>
          <span><i className="gt-sw gt-sw-wait" /> esperando</span>
          <span><i className="gt-sw gt-sw-run" /> ejecutándose</span>
          <span><b className="gt-sym gt-sym-f">F</b> finalización</span>
        </div>
      </div>

      <div className="gantt-table" id="gantt-table">
        <div className="gt-scroll" ref={scrollRef}>
          <table className="gt-matrix">
            <thead>
              <tr>
                <th className="gt-col-proc" scope="col">t (u)</th>
                {Array.from({ length: M + 1 }, (_, t) => (
                  <th
                    key={t}
                    ref={(el) => (headColsRef.current[t] = el)}
                    className={`gt-col-t ${t === cursor ? 'is-now' : ''}`}
                    scope="col"
                  >
                    {t}
                  </th>
                ))}
                <th
                  className="gt-col-rem"
                  scope="col"
                  title="Tiempo restante durante la ejecución; al finalizar muestra el instante de término (t = Fin)"
                >
                  Restante / Fin
                </th>
              </tr>
            </thead>
            <tbody>
              {processes.map((proc) => {
                const c = processColors.get(proc.id) || {
                  bg: queuePalette(proc.queue).base,
                  fg: '#ffffff'
                };
                const waitBg = mixHex(c.bg, '#ffffff', 0.84);
                const metric = simResult.metrics.perProcess.find((x) => x.id === proc.id);
                const finish = metric ? metric.finish : null;
                const snapProc = snap
                  ? snap.procs.find((x) => x.id === proc.id)
                  : { state: 'new', remaining: proc.burst };
                const qLabel = queueName(config, proc.queue);

                return (
                  <tr key={proc.id}>
                    <th className="gt-proc" scope="row">
                      <span
                        className="gt-proc-pill"
                        style={{ background: c.bg, color: c.fg }}
                        title={`${proc.id} · Cola ${qLabel} · llegada ${proc.arrival} · ráfaga ${proc.burst}`}
                      >
                        {proc.id}
                      </span>
                    </th>

                    {Array.from({ length: M + 1 }, (_, t) => {
                      let cls = '';
                      let bg = '';
                      let fg = '';
                      let txt = '';
                      let title = '';

                      if (t > cursor) {
                        cls = 'gt-cell gt-future';
                        title = `${proc.id} · t = ${t}: pendiente`;
                      } else if (t === finish) {
                        cls = 'gt-cell gt-fin';
                        txt = 'F';
                        title = `${proc.id} · t = ${t}: finaliza ejecución`;
                      } else if (t < M && simResult.ticks[t].pid === proc.id) {
                        const isArr = t === proc.arrival;
                        cls = `gt-cell gt-run ${isArr ? 'has-x' : ''} ${t === cursor ? 'is-live' : ''}`;
                        bg = c.bg;
                        fg = c.fg;
                        txt = isArr ? 'x' : '';
                        title = `${proc.id} · t = ${t}: ${isArr ? 'llega y ejecuta en CPU' : 'ejecutando en CPU'} (${qLabel})`;
                      } else if (t >= proc.arrival && t < finish) {
                        const isArr = t === proc.arrival;
                        cls = `gt-cell gt-wait ${isArr ? 'has-x' : ''}`;
                        bg = waitBg;
                        fg = '#1f2937';
                        txt = isArr ? 'x' : '';
                        title = `${proc.id} · t = ${t}: ${isArr ? 'llega y espera en cola' : 'esperando en cola'} ${qLabel}`;
                      } else {
                        cls = 'gt-cell gt-off';
                        title = `${proc.id} · t = ${t}: ${t < proc.arrival ? 'aún no llega' : 'ya finalizó'}`;
                      }

                      return (
                        <td key={t} className="gt-td">
                          <div
                            className={cls}
                            style={{ background: bg, color: fg }}
                            title={title}
                          >
                            {txt}
                          </div>
                        </td>
                      );
                    })}

                    <td className="gt-rem">
                      {snapProc?.state === 'done' ? (
                        <span
                          className="gt-rem-pill is-done"
                          style={{ background: waitBg, color: '#111827' }}
                        >
                          t = {finish}
                        </span>
                      ) : (
                        <span
                          className={`gt-rem-pill ${snapProc?.state === 'new' ? 'is-new' : 'is-active'}`}
                        >
                          resta {snapProc?.remaining ?? proc.burst}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
