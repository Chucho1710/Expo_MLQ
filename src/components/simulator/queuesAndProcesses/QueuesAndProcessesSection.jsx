import React from 'react';
import QueueLaneCard from './QueueLaneCard.jsx';
import GlobalActionsBar from './GlobalActionsBar.jsx';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';
import {
  queueName,
  getProcessColors,
  allocateQuotas,
  validateConfig
} from '../../../engine/mlqEngine.js';

function rebalancePercentAdd(pctArr, newLen) {
  const sum = pctArr.reduce((a, b) => a + b, 0);
  const validExisting = pctArr.length === newLen - 1 && sum === 100 && pctArr.every((v) => Number.isInteger(v) && v >= 1);
  if (!validExisting) {
    pctArr.push(Math.max(1, Math.floor(100 / newLen)));
    return;
  }
  const surplus = pctArr.reduce((s, v) => s + Math.max(0, v - 1), 0);
  const share = Math.min(10, Math.floor(100 / newLen), surplus);
  if (share < 1) {
    pctArr.push(1);
    return;
  }
  let need = share;
  while (need > 0) {
    let best = -1;
    for (let i = 0; i < pctArr.length; i++) {
      if (pctArr[i] > 1 && (best === -1 || pctArr[i] > pctArr[best])) best = i;
    }
    if (best === -1) break;
    pctArr[best]--;
    need--;
  }
  pctArr.push(share);
}

function rebalancePercentRemove(pctArr, idx) {
  const oldSum = pctArr.reduce((a, b) => a + b, 0);
  const removed = pctArr.splice(idx, 1)[0] || 0;
  if (pctArr.length && oldSum === 100 && pctArr.every((v) => Number.isInteger(v) && v >= 1)) {
    pctArr[0] += removed;
  }
}

export default function QueuesAndProcessesSection({
  config,
  processes,
  interruptions,
  onChangeConfig,
  onResetConfig,
  onProcessesChange,
  onInterruptionsChange,
  onImport,
  onClearProcesses,
  toast
}) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const total = config.queues.length;
  const isPercent = config.policy === 'percent';
  const minCycle = Math.max(3, total);
  const maxPct = total === 1 ? 100 : 100 - (total - 1);
  const sumPct = config.percent.reduce((a, b) => a + b, 0);

  const policyErrors = isPercent ? validateConfig(config) : [];
  const validQuotas = isPercent && policyErrors.length === 0 ? allocateQuotas(config.percent, config.cycle) : null;
  const processColors = getProcessColors(processes, config);

  const nextPlaceholderId = () => {
    let max = 0;
    processes.forEach((p) => {
      const m = /^P(\d+)$/i.exec(p.id);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return `P${max + 1}`;
  };

  const handlePolicyChange = (policy) => {
    onChangeConfig({ ...config, policy });
  };

  const handleCycleChange = (e) => {
    const v = Number(e.target.value);
    if (!Number.isInteger(v) || v < minCycle || v > 100) {
      toast(
        en
          ? `Cycle must be an integer between ${minCycle} and 100 units.`
          : `El ciclo debe ser un entero entre ${minCycle} y 100 unidades.`
      );
      return;
    }
    onChangeConfig({ ...config, cycle: v });
  };

  const handleQueueNameChange = (idx, value) => {
    const val = value.trim();
    if (!val) {
      toast(en ? 'Queue name cannot be empty.' : 'El nombre de la cola no puede estar vacío.');
      return;
    }
    if (config.queues.some((_, j) => j !== idx && queueName(config, j, lang).toLowerCase() === val.toLowerCase())) {
      toast(en ? `A queue named "${val}" already exists.` : `Ya existe una cola llamada "${val}".`);
      return;
    }
    const nextQueues = config.queues.map((q, i) => (i === idx ? { ...q, name: val } : q));
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleQueueAlgChange = (idx, algKey) => {
    const nextQueues = config.queues.map((q, i) => (i === idx ? { ...q, algorithm: algKey } : q));
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleQueuePreemptiveChange = (idx, value) => {
    const nextQueues = config.queues.map((q, i) =>
      i === idx ? { ...q, preemptive: value } : q
    );
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleMlqPreemptiveChange = (value) => {
    onChangeConfig({ ...config, preemptive: value });
  };

  const handleQueueQuantumChange = (idx, value) => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1) {
      toast(en ? 'Quantum must be an integer >= 1.' : 'El quantum debe ser un número entero mayor o igual a 1.');
      return;
    }
    const nextQueues = config.queues.map((q, i) => (i === idx ? { ...q, quantum: v } : q));
    onChangeConfig({ ...config, queues: nextQueues });
  };

  const handleQueuePctChange = (idx, value) => {
    const v = Number(value);
    if (!Number.isInteger(v) || v < 1 || v > maxPct) {
      toast(en ? `Percentage must be an integer between 1 and ${maxPct}.` : `El porcentaje debe ser un entero entre 1 y ${maxPct}.`);
      return;
    }
    const nextPct = [...config.percent];
    nextPct[idx] = v;
    onChangeConfig({ ...config, percent: nextPct });
  };

  const moveQueue = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= total) return;
    const nextQueues = [...config.queues];
    [nextQueues[idx], nextQueues[target]] = [nextQueues[target], nextQueues[idx]];
    const nextPct = [...config.percent];
    [nextPct[idx], nextPct[target]] = [nextPct[target], nextPct[idx]];

    // Los procesos deben seguir el movimiento de su cola
    const nextProcs = processes.map((p) => {
      if (p.queue === idx) return { ...p, queue: target };
      if (p.queue === target) return { ...p, queue: idx };
      return p;
    });

    onChangeConfig({ ...config, queues: nextQueues, percent: nextPct }, nextProcs);
  };

  const removeQueue = (idx) => {
    if (total <= 1) {
      toast(en ? 'There must be at least one queue in the system.' : 'Debe haber al menos una cola en el sistema.');
      return;
    }
    const name = queueName(config, idx, lang);
    const nextQueues = config.queues.filter((_, i) => i !== idx);
    const nextPct = [...config.percent];
    rebalancePercentRemove(nextPct, idx);

    let reassigned = 0;
    const nextProcs = processes.map((p) => {
      if (p.queue === idx) {
        reassigned++;
        return { ...p, queue: Math.min(idx, nextQueues.length - 1) };
      }
      if (p.queue > idx) {
        return { ...p, queue: p.queue - 1 };
      }
      return p;
    });

    toast(
      en
        ? reassigned
          ? `Queue "${name}" deleted (${reassigned} process(es) reassigned).`
          : `Queue "${name}" deleted.`
        : reassigned
        ? `Cola "${name}" eliminada (${reassigned} proceso(s) reasignados).`
        : `Cola "${name}" eliminada.`
    );
    onChangeConfig({ ...config, queues: nextQueues, percent: nextPct }, nextProcs);
  };

  const handleAddQueue = (newQueueTemplate) => {
    const nextQueues = [...config.queues, newQueueTemplate];
    const nextPct = [...config.percent];
    rebalancePercentAdd(nextPct, nextQueues.length);
    toast(
      en
        ? `Queue "${newQueueTemplate.name}" added at priority level ${nextQueues.length}.`
        : `Cola "${newQueueTemplate.name}" agregada con prioridad nivel ${nextQueues.length}.`
    );
    onChangeConfig({ ...config, queues: nextQueues, percent: nextPct });
  };

  const handleAddProcess = (newProcess) => {
    onProcessesChange([...processes, newProcess]);
  };

  const handleDeleteProcess = (id) => {
    const next = processes.filter((p) => p.id !== id);
    onProcessesChange(next);
    toast(en ? `Process ${id} deleted.` : `Proceso ${id} eliminado.`);
  };

  return (
    <div className={`panel unified-panel ${isPercent ? 'percent-on' : ''}`} id="panel-config">
      <div className="panel-head">
        <div>
          <h3>{en ? '1 · Queue & Process Configuration' : '1 · Configuración de Colas y Procesos'}</h3>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            {en
              ? 'Each queue manages its own priority and assigned processes. Add processes directly inside each queue.'
              : 'Cada cola gestiona su propia prioridad y sus procesos asignados. Añade procesos directamente en su respectiva cola.'}
          </p>
        </div>
      </div>

      {/* Barra de Acciones Globales (Escenarios, Políticas, Agregar Cola/Proceso) */}
      <GlobalActionsBar
        config={config}
        processes={processes}
        interruptions={interruptions}
        nextPlaceholderId={nextPlaceholderId()}
        isPercent={isPercent}
        sumPct={sumPct}
        minCycle={minCycle}
        policyErrors={policyErrors}
        onPolicyChange={handlePolicyChange}
        onMlqPreemptiveChange={handleMlqPreemptiveChange}
        onCycleChange={handleCycleChange}
        onImport={onImport}
        onClearProcesses={onClearProcesses}
        onResetConfig={onResetConfig}
        onAddProcess={handleAddProcess}
        onAddQueue={handleAddQueue}
        onInterruptionsChange={onInterruptionsChange}
        toast={toast}
      />

      {/* Grilla de Colas con sus procesos agrupados adentro */}
      <div className="queue-config unified-grid">
        {config.queues.map((_, i) => (
          <QueueLaneCard
            key={i}
            index={i}
            total={total}
            config={config}
            processes={processes}
            isPercent={isPercent}
            maxPct={maxPct}
            quota={validQuotas ? validQuotas[i] : null}
            nextPlaceholderId={nextPlaceholderId()}
            processColors={processColors}
            onNameChange={handleQueueNameChange}
            onAlgChange={handleQueueAlgChange}
            onQueuePreemptiveChange={handleQueuePreemptiveChange}
            onQuantumChange={handleQueueQuantumChange}
            onPctChange={handleQueuePctChange}
            onMove={moveQueue}
            onRemove={removeQueue}
            onAddProcess={handleAddProcess}
            onDeleteProcess={handleDeleteProcess}
            toast={toast}
          />
        ))}
      </div>
    </div>
  );
}
