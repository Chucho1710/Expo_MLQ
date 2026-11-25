import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {}
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem('mlq_lang');
      if (saved === 'en' || saved === 'es') return saved;
    } catch (_) {
      // ignore storage errors
    }
    return 'en';
  });

  const setLang = useCallback((next) => {
    const valid = next === 'es' ? 'es' : 'en';
    setLangState(valid);
    try {
      localStorage.setItem('mlq_lang', valid);
    } catch (_) {
      // ignore storage errors
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'es' : 'en');
  }, [lang, setLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title =
      lang === 'en'
        ? 'MLQ — Multilevel Queue Scheduling · Interactive Simulator'
        : 'MLQ — Planificación por Colas Multinivel · Simulador interactivo';
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
