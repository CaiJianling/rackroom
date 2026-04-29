/*
 * @Author: CaiJianling caijianling@outlook.com
 * @Date: 2026-03-25 03:55:13
 * @LastEditors: CaiJianling caijianling@outlook.com
 * @LastEditTime: 2026-04-27 17:35:45
 * @FilePath: /rackroom/resources/js/i18n.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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