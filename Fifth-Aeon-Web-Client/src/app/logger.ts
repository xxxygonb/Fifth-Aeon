import { isDevMode } from '@angular/core';

/**
 * 统一日志出口(C15):
 *  - debug/info 仅开发模式输出(ng serve / dev build),生产构建静默;
 *  - warn/error 始终输出(带 [FA] 前缀便于过滤)。
 * 使用模块级函数而非 Injectable:纯类(如 Messenger/P2PClient)无法 DI。
 */
const dev = isDevMode();

function stamp(args: any[]) {
    return ['[FA]', ...args];
}

export const log = {
    debug(...args: any[]) {
        if (dev) {
            console.log(...stamp(args));
        }
    },
    info(...args: any[]) {
        if (dev) {
            console.info(...stamp(args));
        }
    },
    warn(...args: any[]) {
        console.warn(...stamp(args));
    },
    error(...args: any[]) {
        console.error(...stamp(args));
    }
};
