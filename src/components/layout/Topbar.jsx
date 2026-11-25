import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

export default function Topbar() {
  const { lang, setLang } = useLanguage();
  const en = lang === 'en';

  return (
    <header className="topbar">
      <a className="brand" href="#inicio">
        <span className="brand-mark" aria-hidden="true">MLQ</span>
        <span>{en ? 'Scheduling Simulator' : 'Simulador de planificación'}</span>
      </a>
      <div className="topbar-right">
        <nav aria-label={en ? 'Sections' : 'Secciones'}>
          <a href="#teoria">{en ? 'Theory' : 'Teoría'}</a>
          <a href="#simulador">{en ? 'Simulator' : 'Simulador'}</a>
          <a href="#resultados">{en ? 'Results' : 'Resultados'}</a>
        </nav>
        <div className="lang-switch" role="group" aria-label={en ? 'Language' : 'Idioma'}>
          <button
            type="button"
            className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
            onClick={() => setLang('en')}
            aria-pressed={lang === 'en'}
          >
            EN
          </button>
          <button
            type="button"
            className={`lang-btn ${lang === 'es' ? 'active' : ''}`}
            onClick={() => setLang('es')}
            aria-pressed={lang === 'es'}
          >
            ES
          </button>
        </div>
      </div>
    </header>
  );
}
