import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import fr from './locales/fr.json';
import wo from './locales/wo.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, wo: { translation: wo } },
    fallbackLng: 'fr',
    supportedLngs: ['fr', 'wo'],
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'boutikos_lang',
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
