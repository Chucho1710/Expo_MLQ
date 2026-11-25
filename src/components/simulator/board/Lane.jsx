import React from 'react';
import {
  ALGORITHMS,
  queueName,
  queuePriorityLabel,
  queuePalette
} from '../../../engine/mlqEngine.js';
import ProcessChip from './ProcessChip.jsx';

export default function Lane({
  index,
  total,
  config,
  currentSnapshot,
  processes,
  isPercent,
  validQuotas,
  hasPref,
  processIds,
  procsInfo,
  processColors,
  simResult
}) {
  const pal = queuePalette(index);
  const cfg = config.queues[index];
  const alg = ALGORITHMS[cfg.algorithm] || ALGORITHMS.FCFS;
  const pending = currentSnapshot
    ? currentSnapshot.pending[index]
    : processes.filter((p) => p.queue === index).length;
  const cyc = currentSnapshot && currentSnapshot.cycle;
  const shareText = isPercent
    ? cyc
      ? `${config.percent[index]} % · cuota ${cyc.left[index]}/${cyc.quota[index]}`
      : validQuotas
      ? `${config.percent[index]} % · ${validQuotas[index]} u/ciclo`
      : `${config.percent[index]} %`
    : null;

  return (
    <div
      className={`lane q${index} ${hasPref ? 'has-pref' : ''}`}
      style={{
        '--q-row': index + 2,
        '--q-color': pal.base,
        '--q-soft': pal.soft
      }}
    >
      <div className="lane-head">
        <span className="lane-name">
          Cola {index + 1} · {queueName(config, index)}
        </span>
        <span className="lane-tag prio">
          {queuePriorityLabel(index, total)}
        </span>
        <span className="lane-tag">
          {alg.short + (alg.usesQuantum ? ` · q = ${cfg.quantum}` : '')}
        </span>
        <span className="lane-tag">{alg.modality}</span>
        <span className="lane-tag">
          {pending} pendiente{pending === 1 ? '' : 's'}
        </span>
        {isPercent && <span className="lane-tag share">{shareText}</span>}
        <span className="lane-pref">
          {isPercent ? '★ Turno de CPU' : '★ Preferencia de CPU'}
        </span>
      </div>
      <div className="lane-area">
        {processIds.map((id) => {
          const proc = procsInfo.get(id);
          const col = processColors.get(id) || { bg: '#1e293b', fg: '#fff' };
          const fin = simResult ? simResult.metrics.perProcess.find((m) => m.id === id)?.finish : null;
          return <ProcessChip key={id} proc={proc} color={col} finishTime={fin} />;
        })}
      </div>
    </div>
  );
}
