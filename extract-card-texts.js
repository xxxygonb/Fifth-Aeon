/**
 * 提取卡牌工厂函数中传入的自定义描述文本（构造函数的 text 参数）。
 * 用法: node extract-card-texts.js
 */
const fs = require('fs');
const path = require('path');

const MODEL = 'g:/Fifth-Aeon/Fifth-Aeon-Model';
const cardsDir = path.join(MODEL, 'cards');
const out = new Map();

for (const f of fs.readdirSync(cardsDir).filter(f => f.endsWith('Cards.ts'))) {
    const src = fs.readFileSync(path.join(cardsDir, f), 'utf8');
    // 匹配工厂函数名，便于定位
    const fnRe = /export function (\w+)\(\)/g;
    let fn;
    const fns = [];
    while ((fn = fnRe.exec(src))) {
        fns.push({ name: fn[1], start: fn.index });
    }
    for (let i = 0; i < fns.length; i++) {
        const end = i + 1 < fns.length ? fns[i + 1].start : src.length;
        const body = src.slice(fns[i].start, end);
        // 候选：单独成行的单引号字符串（构造函数参数）
        const strRe = /(?:^|\n)\s{4,}'((?:[^'\\]|\\.)+)',?\s*(?=\n)/g;
        let m;
        while ((m = strRe.exec(body))) {
            const s = m[1];
            // 过滤：名称（单词）、图片、ID
            if (!s.includes(' ')) continue;
            if (s.endsWith('.png')) continue;
            if (/^[A-Z][a-zA-Z]+$/.test(s)) continue;
            if (!out.has(s)) out.set(s, fns[i].name + ' @ ' + f);
        }
    }
}

console.log('total: ' + out.size);
for (const [s, loc] of out) {
    console.log(JSON.stringify(s) + '   // ' + loc);
}
