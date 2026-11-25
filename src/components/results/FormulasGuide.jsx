import React from 'react';
import { queueName } from '../../engine/mlqEngine.js';

export default function FormulasGuide({ config, isPercent }) {
  const orderText = config.queues.map((_, i) => queueName(config, i)).join(' > ');

  return (
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
          ? `Política usada: porcentajes de CPU (${config.percent.join(' / ')} %, ciclo de ${config.cycle} unidades). El porcentaje real puede diferir del configurado cuando una cola se queda sin procesos y las demás aprovechan su tiempo.`
          : `Política usada: prioridad fija entre colas (${orderText}).`}
      </p>
    </div>
  );
}
