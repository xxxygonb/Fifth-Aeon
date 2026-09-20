import { getLocale } from './i18n';

export function properList(arr: Array<string>) {
    if (arr.length === 1) {
        return arr[0];
    } else if (arr.length === 2) {
        return arr.join(t0('and'));
    } else if (arr.length > 2) {
        return (
            arr.slice(0, -1).join(t0('listSeparator')) +
            t0('and') +
            arr.slice(-1)
        );
    }
    return '';
}

function t0(key: string) {
    if (getLocale() !== 'zh-CN') {
        return key === 'and' ? ' and ' : ', ';
    }
    return key === 'and' ? '和' : '、';
}

export function properCase(str: string) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

export function a(nextWord: string) {
    return 'aeioAEIO'.includes(nextWord[0]) ? 'an' : 'a';
}

function symbol(number: number) {
    return number > 0 ? '+' : '';
}

export function formatBuff(damage: number, life: number) {
    return `${symbol(damage)}${damage}/${symbol(life)}${life}`;
}

export function removeFirstCapital(text: string) {
    return text[0].toLocaleLowerCase() + text.substr(1);
}
