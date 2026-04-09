'use client';

import { useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import en from '../locales/en.json';
import zh from '../locales/zh.json';

const translations = { en, zh };

const THEME_LABEL_OVERRIDES = {
    en: {
        'sidebar.navThemeDark': 'Light',
        'sidebar.navThemeLight': 'Dark',
        'sidebar.tooltipThemeDark': 'Light',
        'sidebar.tooltipThemeLight': 'Dark',
    },
    zh: {
        'sidebar.navThemeDark': '亮色',
        'sidebar.navThemeLight': '暗色',
        'sidebar.tooltipThemeDark': '亮色',
        'sidebar.tooltipThemeLight': '暗色',
    },
};

export function useI18n() {
    // Default to 'zh' if language is null initially
    const language = useAppStore(state => state.language) || 'zh';

    const t = useCallback((path) => {
        const override = THEME_LABEL_OVERRIDES[language]?.[path];
        if (override) return override;

        const keys = path.split('.');
        let current = translations[language] || translations['zh'];

        for (const key of keys) {
            if (current === undefined || current[key] === undefined) {
                console.warn(`Translation missing for key: ${path} in lang: ${language}`);
                // Fallback to Chinese
                if (language !== 'zh' && translations['zh']) {
                    let fallback = translations['zh'];
                    for (const k of keys) {
                        if (fallback[k] === undefined) return path;
                        fallback = fallback[k];
                    }
                    return fallback;
                }
                return path;
            }
            current = current[key];
        }
        return current;
    }, [language]);

    return { t, language };
}
