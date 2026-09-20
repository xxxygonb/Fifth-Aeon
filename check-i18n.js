/**
 * 汉化覆盖率检查脚本（开发辅助，不参与构建）
 * 用法: node check-i18n.js
 * 1. 提取 Model 中 t('..') / tf('..') 的 key，对比 zh-CN.ts / zh-CN-cards.ts
 * 2. 提取 Client 中 i18n.tr('..') 的 key，对比 UI 字典 + Model 字典
 */
const fs = require('fs');
const path = require('path');

const MODEL = 'g:/Fifth-Aeon/Fifth-Aeon-Model';
const CLIENT = 'g:/Fifth-Aeon/Fifth-Aeon-Web-Client';

function walk(dir, ext, out = []) {
    for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        const st = fs.statSync(p);
        if (st.isDirectory()) {
            if (f === 'node_modules' || f === 'dist' || f === '.git') continue;
            walk(p, ext, out);
        } else if (p.endsWith(ext)) out.push(p);
    }
    return out;
}

function extractDictKeys(file) {
    const src = fs.readFileSync(file, 'utf8');
    const keys = [];
    // 匹配顶层 "key": 'value' / key: 'value' / 'key': "value" 等（支持 \' 等转义）
    const re = /^\s{4}(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|([A-Za-z][A-Za-z0-9 ._$]*))\s*:/gm;
    let m;
    const norm = s => s.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, '\n');
    while ((m = re.exec(src))) {
        if (m[1] !== undefined) keys.push(norm(m[1]));
        else if (m[2] !== undefined) keys.push(norm(m[2]));
        else keys.push(m[3]);
    }
    return keys;
}

// ---- Model ----
const modelDict = new Set([
    ...extractDictKeys(path.join(MODEL, 'i18n/zh-CN.ts')),
    ...extractDictKeys(path.join(MODEL, 'i18n/zh-CN-cards.ts'))
]);
const modelMissing = new Set();
for (const f of walk(path.join(MODEL, 'cards'), '.ts')
    .concat(walk(path.join(MODEL), '.ts').filter(p => /log\.ts|strings\.ts|targeter\.ts|resource\.ts$/.test(p)))) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /\b(?:t|tf)\(\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
        const key = m[1].replace(/\\'/g, "'").replace(/\\n/g, '\n');
        if (!modelDict.has(key)) modelMissing.add(key + '  [' + path.basename(f) + ']');
    }
}

// ---- Client ----
const clientDict = new Set([
    ...extractDictKeys(path.join(CLIENT, 'src/app/i18n/zh-CN.ts')),
    ...extractDictKeys(path.join(CLIENT, 'src/app/i18n/zh-CN-2.ts')),
    ...modelDict // tr() 会回退到 model 字典
]);
const clientMissing = new Set();
for (const f of walk(path.join(CLIENT, 'src/app'), '.ts').concat(walk(path.join(CLIENT, 'src/app'), '.html'))) {
    const src = fs.readFileSync(f, 'utf8');
    const re = /i18n\.tr\(\s*'((?:[^'\\]|\\.)*)'|\|\s*tr\s*(?::\s*)?\s*'((?:[^'\\]|\\.)*)'/g;
    let m;
    while ((m = re.exec(src))) {
        const key = (m[1] ?? m[2] ?? '').replace(/\\'/g, "'").replace(/\\n/g, '\n');
        if (key && !clientDict.has(key)) clientMissing.add(key + '  [' + path.relative(CLIENT, f) + ']');
    }
}

console.log('=== Model 字典缺失 (' + modelMissing.size + ') ===');
for (const k of [...modelMissing].sort()) console.log('  ' + JSON.stringify(k));
console.log('=== Client 字典缺失 (' + clientMissing.size + ') ===');
for (const k of [...clientMissing].sort()) console.log('  ' + JSON.stringify(k));
