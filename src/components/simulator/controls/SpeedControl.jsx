import React from 'react';

export default function SpeedControl({ speed, onSpeedChange }) {
  const delayMs = Math.round(1700 - speed * 150);

  return (
    <div className="speed">
      <label htmlFor="speed">Velocidad</label>
      <span className="speed-end">lenta</span>
      <input
        id="speed"
        type="range"
        min="1"
        max="10"
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
      />
      <span className="speed-end">rápida</span>
      <output id="speed-label" htmlFor="speed">
        1 unidad / {(delayMs / 1000).toFixed(1)} s
      </output>
    </div>
  );
}
