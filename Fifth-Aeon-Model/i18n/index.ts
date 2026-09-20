import { zhCN } from './zh-CN';
import { zhCNCards } from './zh-CN-cards';
import { enUS } from './en-US';

/**
 * Lightweight i18n for the shared game model.
 *
 * Design: English source text is used as the dictionary key. Translations are
 * looked up in the active locale's dictionary; if an entry is missing the
 * original English text is returned (graceful degradation), so game logic and
 * network messages never break when a translation is incomplete.
 *
 * The client sets the locale once at startup (see client i18n service).
 * The server keeps the default locale so protocols stay unchanged.
 */

export type Locale = 'zh-CN' | 'en-US';

let locale: Locale = 'en-US';

const dictionaries: Record<Locale, Record<string, string>> = {
    'en-US': enUS,
    'zh-CN': { ...zhCN, ...zhCNCards }
};

export function setLocale(l: Locale) {
    locale = l;
}

export function getLocale(): Locale {
    return locale;
}

/**
 * Translate a static string. The key is the English source text.
 */
export function t(text: string): string {
    if (locale === 'en-US') {
        return text;
    }
    return dictionaries[locale][text] ?? text;
}

/**
 * Translate a templated string with {placeholder} interpolation.
 * The key is the English template source text.
 *
 * Example: tf('Play: Deal {n} damage to a unit.', { n: 3 })
 */
export function tf(
    template: string,
    params: Record<string, string | number>
): string {
    const localized =
        locale === 'en-US'
            ? template
            : dictionaries[locale][template] ?? template;
    return localized.replace(/\{(\w+)\}/g, (match, name) =>
        params.hasOwnProperty(name) ? String(params[name]) : match
    );
}
