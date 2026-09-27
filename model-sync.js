/**
 * game_model 单一源同步工具（B1/C3）。
 *
 * Fifth-Aeon-Model 是规则引擎的唯一权威源；
 * Fifth-Aeon-Server/src/game_model 与 Fifth-Aeon-Web-Client/src/app/game_model
 * 是【生成的副本】（构建产物），禁止手工编辑。
 *
 * 用法:
 *   node model-sync.js           # 同步模式: 把 Model 刷到两个副本(保留白名单 override)
 *   node model-sync.js --check   # 检查模式: 只校验不写入, 有任何漂移则 exit 1 (CI 用)
 *
 * Override 白名单: 副本中允许与 Model 不同的文件(必须在此显式登记):
 *   - Server/src/game_model/serverGame.ts —— 服务端权威回放扩展(GameReplay/getReplay)
 *     以及服务端专用动作校验,客户端不使用该文件的服务端行为。
 */
const fs = require('fs');
const path = require('path');

const MODEL = path.join(__dirname, 'Fifth-Aeon-Model');
const COPIES = [
    {
        label: 'Server',
        dir: path.join(__dirname, 'Fifth-Aeon-Server', 'src', 'game_model')
    },
    {
        label: 'Client',
        dir: path.join(__dirname, 'Fifth-Aeon-Web-Client', 'src', 'app', 'game_model')
    }
];

/** 允许与 Model 不同的文件: `${copyLabel}:${相对路径}` */
const OVERRIDE_WHITELIST = new Set(['Server:serverGame.ts']);

const EXTS = /\.(ts|json|md)$/;

function walk(dir, out = [], prefix = '') {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === '.git') continue;
        const rel = prefix ? prefix + '/' + name : name;
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) {
            walk(full, out, rel);
        } else if (EXTS.test(name)) {
            out.push(rel);
        }
    }
    return out;
}

const isCheck = process.argv.includes('--check');
let issues = 0;
let copied = 0;
let kept = 0;

const modelFiles = walk(MODEL);

for (const copy of COPIES) {
    const copyFiles = new Set(walk(copy.dir));

    for (const rel of modelFiles) {
        const src = path.join(MODEL, rel);
        const dst = path.join(copy.dir, rel);
        const dstExists = fs.existsSync(dst);
        const isOverride =
            dstExists &&
            (OVERRIDE_WHITELIST.has(`${copy.label}:${rel}`) ||
                fs.readFileSync(src, 'utf8') === fs.readFileSync(dst, 'utf8'));

        if (isOverride) {
            kept++;
            continue;
        }

        const content = fs.readFileSync(src, 'utf8');
        if (isCheck) {
            if (!dstExists || fs.readFileSync(dst, 'utf8') !== content) {
                console.log(`[${copy.label}] 漂移: ${rel}`);
                issues++;
            }
        } else {
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.writeFileSync(dst, content);
            copied++;
        }
    }

    // 副本中多出的文件: 白名单 override 之外都属于漂移
    for (const rel of copyFiles) {
        if (modelFiles.includes(rel)) continue;
        if (OVERRIDE_WHITELIST.has(`${copy.label}:${rel}`)) {
            kept++;
            continue;
        }
        console.log(`[${copy.label}] 多出文件(请手工处理): ${rel}`);
        issues++;
    }
}

if (isCheck) {
    if (issues === 0) {
        console.log(
            `OK: 副本与 Model 一致 (Model ${modelFiles.length} 个文件, override 白名单 ${OVERRIDE_WHITELIST.size} 项)。`
        );
        process.exit(0);
    }
    console.log(`---\n发现 ${issues} 处漂移。请运行: node model-sync.js (或以 Model 为准修改代码)。`);
    process.exit(1);
}

console.log(
    `同步完成: 复制 ${copied} 个文件, 保留 override/一致 ${kept} 个, 白名单 ${OVERRIDE_WHITELIST.size} 项。`
);
if (issues > 0) {
    console.log(`注意: ${issues} 个副本多出文件未自动删除, 请手工处理。`);
    process.exit(1);
}
