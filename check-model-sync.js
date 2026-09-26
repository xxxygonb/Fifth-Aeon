/**
 * 三副本同步检查：game_model 规则引擎同时存在于三处，必须保持一致。
 * 用法: node check-model-sync.js   （不一致时退出码 1，可挂 CI / 启动脚本）
 *
 *   1. Fifth-Aeon-Model                      —— 权威源
 *   2. Fifth-Aeon-Web-Client/src/app/game_model —— 必须与 1 完全一致
 *   3. Fifth-Aeon-Server/src/game_model         —— 允许 3 个已知差异文件
 *      （animator.ts / card-types/item.ts / serverGame.ts，均为格式或
 *        服务端 i18n 适配，详见 docs/fix-report-2026-09-20.md）
 */
const fs = require('fs');
const path = require('path');

const MODEL = path.join(__dirname, 'Fifth-Aeon-Model');
const CLIENT = path.join(__dirname, 'Fifth-Aeon-Web-Client', 'src', 'app', 'game_model');
const SERVER = path.join(__dirname, 'Fifth-Aeon-Server', 'src', 'game_model');

// 服务端副本允许有差异的文件（相对路径，/ 分隔）
const SERVER_DIFF_WHITELIST = new Set([
    'animator.ts',
    'card-types/item.ts',
    'serverGame.ts'
]);

function walk(dir, out = [], prefix = '') {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git') {
            continue;
        }
        const rel = prefix ? prefix + '/' + name : name;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            walk(full, out, rel);
        } else if (/\.(ts|json|md)$/.test(name)) {
            out.push(rel);
        }
    }
    return out;
}

function diffCopy(label, base, other, whitelist) {
    const baseFiles = new Set(walk(base));
    const otherFiles = new Set(walk(other));
    let issues = 0;

    for (const rel of baseFiles) {
        if (!otherFiles.has(rel)) {
            console.log(`[${label}] 缺少文件: ${rel}`);
            issues++;
            continue;
        }
        if (whitelist && whitelist.has(rel)) {
            continue;
        }
        const a = fs.readFileSync(path.join(base, rel), 'utf8');
        const b = fs.readFileSync(path.join(other, rel), 'utf8');
        if (a !== b) {
            console.log(`[${label}] 内容不一致: ${rel}`);
            issues++;
        }
    }
    for (const rel of otherFiles) {
        if (!baseFiles.has(rel)) {
            console.log(`[${label}] 多出文件: ${rel}`);
            issues++;
        }
    }
    return issues;
}

console.log('检查 game_model 三副本同步...');
let issues = 0;
issues += diffCopy('Client 副本', MODEL, CLIENT, null);
issues += diffCopy('Server 副本', MODEL, SERVER, SERVER_DIFF_WHITELIST);

if (issues === 0) {
    console.log('OK：三副本一致（Server 副本仅白名单差异）。');
    process.exit(0);
} else {
    console.log(`---\n发现 ${issues} 处不同步，请用文档中的 Copy-Item 命令同步（勿覆盖服务端白名单文件）。`);
    process.exit(1);
}
