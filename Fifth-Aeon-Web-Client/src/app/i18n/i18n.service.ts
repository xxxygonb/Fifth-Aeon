import { Injectable } from '@angular/core';
import { setLocale, t as modelT } from '../game_model/i18n';
import { zhCNUI } from './zh-CN';
import { zhCNUI2 } from './zh-CN-2';
import { enUSUI } from './en-US';

export type Lang = 'zh-CN' | 'en-US';

const STORAGE_KEY = 'fa.locale';

const dictionaries: Record<Lang, Record<string, string>> = {
    'zh-CN': { ...zhCNUI, ...zhCNUI2 },
    'en-US': enUSUI
};

/**
 * UI i18n service. Default language is zh-CN.
 * Switching language persists to localStorage and applies the shared game
 * model locale (card names, descriptions, logs). Components that do not
 * reactively re-render should reload the page after setLang().
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
    private lang: Lang;

    constructor() {
        const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
        this.lang = stored === 'en-US' ? 'en-US' : 'zh-CN';
        this.applyModelLocale();
    }

    getLang(): Lang {
        return this.lang;
    }

    setLang(lang: Lang) {
        this.lang = lang;
        localStorage.setItem(STORAGE_KEY, lang);
        this.applyModelLocale();
    }

    tr(key: string, params?: Record<string, string | number>): string {
        let text =
            this.lang === 'zh-CN'
                ? dictionaries['zh-CN'][key] ?? modelT(key) ?? key
                : key;
        if (params) {
            text = text.replace(/\{(\w+)\}/g, (match, name) =>
                params.hasOwnProperty(name) ? String(params[name]) : match
            );
        }
        return text;
    }

    private applyModelLocale() {
        setLocale(this.lang);
    }
}
