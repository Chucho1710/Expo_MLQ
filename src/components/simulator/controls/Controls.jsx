import React, { useEffect } from 'react';
import SpeedControl from './SpeedControl.jsx';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

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
  const { lang } = useLanguage();
  const en = lang === 'en';

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
          {en ? '▶ Start simulation' : '▶ Iniciar simulación'}
        </button>
        <button
          className="btn btn-warn"
          id="btn-pause"
          type="button"
          disabled={status !== 'running'}
          onClick={onPause}
        >
          {en ? '❚❚ Pause' : '❚❚ Pausar'}
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-resume"
          type="button"
          disabled={status !== 'paused'}
          onClick={onResume}
        >
          {en ? '▶ Resume' : '▶ Continuar'}
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-back"
          type="button"
          disabled={!(status === 'paused' || status === 'finished') || cursor <= 0}
          onClick={onStepBack}
        >
          {en ? '◀ Previous step' : '◀ Paso anterior'}
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-step"
          type="button"
          disabled={status === 'running' || status === 'finished'}
          onClick={onStepNext}
        >
          {en ? 'Next step ▶▮' : 'Siguiente paso ▶▮'}
        </button>
        <button
          className="btn btn-outline-dark"
          id="btn-end"
          type="button"
          disabled={status === 'finished'}
          onClick={onGoEnd}
        >
          {en ? '⏭ Go to end' : '⏭ Ir al final'}
        </button>
        <button
          className="btn btn-danger"
          id="btn-reset"
          type="button"
          disabled={status === 'idle'}
          onClick={onReset}
        >
          {en ? '↺ Reset' : '↺ Reiniciar'}
        </button>
      </div>

      <SpeedControl speed={speed} onSpeedChange={onSpeedChange} />

      <div className="clock" aria-live="polite">
        {en ? 'Time' : 'Tiempo'} <strong id="clock">{currentSnapshot ? currentSnapshot.t : '—'}</strong>
      </div>
    </div>
  );
}
