import { useSyncExternalStore } from 'react';
import i18n from '../i18n';

export type Locale = 'zh' | 'en';

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
    listeners.add(callback);

    return () => listeners.delete(callback);
};

const notify = (): void => listeners.forEach((listener) => listener());

const setCookie = (name: string, value: string, days = 365): void => {
    if (typeof document === 'undefined') return;
    const maxAge = days * 24 * 60 * 60;
    document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`;
};

const getStoredLocale = (): Locale => {
    if (typeof window === 'undefined') return 'zh';

    const cookieLocale = getCookie('locale');
    if (cookieLocale && (cookieLocale === 'zh' || cookieLocale === 'en')) {
        return cookieLocale as Locale;
    }

    return (localStorage.getItem('locale') as Locale) || 'zh';
};

const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;

    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
    }

    return null;
};

let currentLocale: Locale = 'zh';

export function initializeLocale(): void {
    if (typeof window === 'undefined') return;

    currentLocale = getStoredLocale();
    i18n.changeLanguage(currentLocale);

    // Listen for i18n language changes
    i18n.on('languageChanged', (lng) => {
        currentLocale = lng as Locale;
        localStorage.setItem('locale', lng);
        setCookie('locale', lng);
        notify();
    });
}

export function useLocale(): Locale {
    const locale: Locale = useSyncExternalStore(
        subscribe,
        () => currentLocale,
        () => 'zh',
    );

    return locale;
}

export function updateLocale(locale: Locale): void {
    currentLocale = locale;
    i18n.changeLanguage(locale);
    localStorage.setItem('locale', locale);
    setCookie('locale', locale);
    notify();
}
