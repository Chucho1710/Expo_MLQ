import React from 'react';
import { useLanguage } from '../../../i18n/LanguageContext.jsx';

export default function SpeedControl({ speed, onSpeedChange }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const delayMs = Math.round(1700 - speed * 150);

  return (
    <div className="speed">
      <label htmlFor="speed">{en ? 'Speed' : 'Velocidad'}</label>
      <span className="speed-end">{en ? 'slow' : 'lenta'}</span>
      <input
        id="speed"
        type="range"
        min="1"
        max="10"
        value={speed}
        onChange={(e) => onSpeedChange(Number(e.target.value))}
      />
      <span className="speed-end">{en ? 'fast' : 'rápida'}</span>
      <output id="speed-label" htmlFor="speed">
        {en ? `1 unit / ${(delayMs / 1000).toFixed(1)} s` : `1 unidad / ${(delayMs / 1000).toFixed(1)} s`}
      </output>
    </div>
  );
}
