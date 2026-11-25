import React, { useEffect } from 'react';

export default function Controls({
  status,
  cursor,
  currentSnapshot,
  speed,
  onSpeedChange,
  onStart,
  onPause,
  onResume,
  onStepNext,
  onStepBack,
  onGoEnd,
  onReset
}) {
  const delayMs = Math.round(1700 - speed * 150);

  // Atajos de teclado: Espacio (pausar/continuar), Flecha der (siguiente), Flecha izq (anterior)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target && e.target.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'SELECT' ||
        tag === 'TEXTAREA' ||
        tag === 'BUTTON' ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      ) {
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onStepNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onStepBack();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (status === 'running') onPause();
        else if (status === 'paused') onResume();
        else if (status === 'idle') onStart();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [status, onStepNext, onStepBack, onPause, onResume, onStart]);

  return (
    <div className="controls" id="controls">
      <div className="btn-row">
        <button
          className="btn btn-primary"
          id="btn-start"
          type="button"
          disabled={status !== 'idle'}
          onClick={onStart}
        >
          ▶ Iniciar simulación
        </button>
        <button
          className="btn btn-warn"
          id="btn-pause"
          type="button"
          disabled={status !== 'running'}
          onClick={onPause}
        >
          ❚❚ Pausar
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-resume"
          type="button"
          disabled={status !== 'paused'}
          onClick={onResume}
        >
          ▶ Continuar
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-back"
          type="button"
          disabled={!(status === 'paused' || status === 'finished') || cursor <= 0}
          onClick={onStepBack}
        >
          ◀ Paso anterior
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-step"
          type="button"
          disabled={status === 'running' || status === 'finished'}
          onClick={onStepNext}
        >
          Siguiente paso ▶▮
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-end"
          type="button"
          disabled={status === 'finished'}
          onClick={onGoEnd}
        >
          ⏭ Ir al final
        </button>
        <button
          className="btn btn-danger"
          id="btn-reset"
          type="button"
          disabled={status === 'idle'}
          onClick={onReset}
        >
          ↺ Reiniciar
        </button>
      </div>

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

      <div className="clock" aria-live="polite">
        Tiempo <strong id="clock">{currentSnapshot ? currentSnapshot.t : '—'}</strong>
      </div>
    </div>
  );
}
