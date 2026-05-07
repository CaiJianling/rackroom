
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import zh from './locales/zh.json';

const resources = {
    zh: { translation: zh },
    en: { translation: en },
};

const getInitialLanguage = (): string => {
    if (typeof window === 'undefined') return 'zh';

    try {
        const stored = localStorage.getItem('locale');
        if (stored === 'en' || stored === 'zh') return stored;

        const cookieMatch = document.cookie.match(/locale=(en|zh)/);
        if (cookieMatch && (cookieMatch[1] === 'en' || cookieMatch[1] === 'zh')) {
            return cookieMatch[1];
        }
    } catch {}

    return 'zh';
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'zh',
        lng: getInitialLanguage(),
        interpolation: {
            escapeValue: false,
        },
        react: {
            useSuspense: false,
        },
    });

export default i18n;