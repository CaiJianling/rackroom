import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
    zh: { translation: zh },
    en: { translation: en },
};

i18n.use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'zh',
        lng: 'zh',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['cookie', 'localStorage', 'navigator'],
            caches: ['cookie', 'localStorage'],
            lookupCookie: 'locale',
            lookupLocalStorage: 'locale',
        },
    });

export default i18n;
