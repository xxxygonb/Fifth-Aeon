Error.stackTraceLimit = 200;
/**
 * AI vs AI 基准脚本(开发辅助,不参与构建/测试)。
 *
 * 用法(在 Fifth-Aeon-Server 目录,建议加大调用栈以容忍旧 AI 的递归缺陷):
 *   node --stack-size=8000 -r ts-node/register src/tests/aiBenchmark.ts [局数] [AI-A] [AI-B]
 *   AI 名可选: default(当前 DefaultAI) | legacy(改造前快照) | easy | medium | expert(P2 后可用)
 *
 * 输出:胜率(按先后手分列)、平均回合数、单局耗时、僵局/崩溃次数。
 * 对局规则:同一副卡组镜像,先后手各一半,消除先手优势偏差。
 *
 * 驱动模型(复刻 gameManager 的 AI 对局装配):
 *   - ServerGame 为权威端,两个 AI 各持一个 ClientGame 镜像
 *   - AI 动作 → ServerGame.handleAction → 事件队列 → drain 同步双方镜像
 *   - 每轮让出事件循环(setImmediate + setTimeout)以执行 AI 的异步选牌回答
 *   - 僵局兜底:连续 3 轮无变化时,先回答权威端挂起的选择(原版 AI 对局
 *     中该选择无人应答会导致卡死),再强制优先权持有者过
 */
import { ServerGame } from '../game_model/serverGame';
import { ClientGame } from '../game_model/clientGame';
import { DeckList } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';
import { GameSyncEvent, SyncEventType } from '../game_model/events/syncEvent';
import { GameAction, GameActionType } from '../game_model/events/gameAction';
import { decksByLevel } from '../game_model/scenarios/decks';
import { AI } from '../game_model/ai/ai';
import { AIConstructor } from '../game_model/ai/aiList';
import { Animator } from '../game_model/animator';

type CtorBundle = Record<string, AIConstructor>;

async function resolveCtors(): Promise<CtorBundle> {
    const mod: any = await import('../game_model/ai/defaultAi');
    const legacy: any = await import('../game_model/ai/legacyDefaultAi');
    const bundle: CtorBundle = {
        default: mod.DefaultAI,
        legacy: legacy.LegacyAI
    };
    // P2 难度分档 AI 存在时自动纳入
    for (const name of ['EasyAI', 'MediumAI', 'ExpertAI']) {
        try {
            const m: any = await import(`../game_model/ai/${name.toLowerCase()}`);
            if (m[name]) {
                bundle[name.toLowerCase()] = m[name];
            }
        } catch (e) {
            // 分档 AI 尚未实现时忽略
        }
    }
    return bundle;
}

interface GameOutcome {
    winner: number; // 0/1,-1 超时/崩溃
    turns: number;
    ms: number;
    stalls: number;
    crash: string;
}

function pickDecks(): [DeckList, DeckList] {
    const pool = decksByLevel.medium;
    const base = pool[Math.floor(Math.random() * pool.length)];
    return [base.clone(), base.clone()];
}

async function runGame(
    ctorA: AIConstructor,
    ctorB: AIConstructor,
    maxTurns = 120
): Promise<GameOutcome> {
    ServerGame.setSeed(Math.floor(Math.random() * 1e9));
    const [deckA, deckB] = pickDecks();
    const server = new ServerGame('bench', standardFormat, [deckA, deckB]);
    const queue: GameSyncEvent[] = [];

    // 权威端选择(调度/弃牌等)正常由 AI 经 CardChoice action 回答;
    // 长时间无人回答时由驱动兜底(按费用排序选取)
    const answerPendingChoice = () => {
        const choices = (server as any).currentChoices;
        for (const player of [0, 1]) {
            const pending = choices ? choices[player] : null;
            if (!pending) {
                continue;
            }
            const picked = [...pending.validCards]
                .sort(
                    (a: any, b: any) =>
                        b.getCost().getNumeric() - a.getCost().getNumeric()
                )
                .slice(
                    0,
                    Math.max(
                        pending.min,
                        Math.min(pending.max, pending.validCards.size)
                    )
                )
                .map((card: any) => card.getId());
            const res = server.handleAction({
                type: GameActionType.CardChoice,
                player: player,
                choice: picked
            });
            if (res) {
                queue.push(...res);
            }
        }
    };

    const send = (action: GameAction) => {
        const res = server.handleAction(action);
        if (res) {
            queue.push(...res);
        }
        return res !== null;
    };

    const g0 = new ClientGame('a', (_, action) => send(action), new Animator());
    const g1 = new ClientGame('b', (_, action) => send(action), new Animator());
    const ai0: AI = new ctorA(0, g0, deckA);
    const ai1: AI = new ctorB(1, g1, deckB);
    const ais = [ai0, ai1];
    ai0.startActingImmediateMode();
    ai1.startActingImmediateMode();

    const stateSignature = () =>
        `${server.getActivePlayer()}-${server.getPhase()}-${
            (server as any).turnNum
        }`;

    const drain = () => {
        // 只同步事件,不触发 AI 优先权 —— 与浏览器一致(事件分批处理),
        // 否则 AI 动作产生的新事件会在 drain 内无限重入。
        // 镜像偶发撕裂(驱动无 10ms 批次间隔)不中断权威对局:胜负由权威端裁决
        while (queue.length > 0 && server.getWinner() === -1) {
            const e = queue.shift() as GameSyncEvent;
            try {
                ai0.handleGameEvent(e);
            } catch (err) {
                console.warn('AI0 镜像同步异常(忽略):', (err as any).message);
            }
            try {
                ai1.handleGameEvent(e);
            } catch (err) {
                console.warn('AI1 镜像同步异常(忽略):', (err as any).message);
            }
        }
    };

    const t0 = Date.now();
    let stalls = 0;
    let crash = '';
    try {
        queue.push(...server.startGame());
        drain();

        let guard = 0;
        let stallCount = 0;
        while (server.getWinner() === -1 && guard++ < 2000) {
            // DefaultAI 通过 setTimeout(0) 异步回答选牌;Node 中 setImmediate
            // 先于 setTimeout 执行,混合让出确保 AI 的回答回调有机会运行
            await new Promise(resolve => setImmediate(resolve));
            await new Promise(resolve => setTimeout(resolve, 0));
            const before = stateSignature();
            const beforeEvents = queue.length;
            ais[server.getActivePlayer()].onGainPriority();
            drain();
            if (server.getWinner() !== -1) {
                break;
            }
            if (stateSignature() === before && queue.length === beforeEvents) {
                stallCount++;
                if (stallCount < 3) {
                    continue;
                }
                const choices = (server as any).currentChoices;
                if (choices && (choices[0] || choices[1])) {
                    answerPendingChoice();
                    drain();
                } else {
                    stalls++;
                    const res = server.handleAction({
                        type: GameActionType.Pass,
                        player: server.getActivePlayer()
                    });
                    if (res) {
                        queue.push(...res);
                    }
                    drain();
                }
            } else {
                stallCount = 0;
            }
            if ((server as any).turnNum > maxTurns || Date.now() - t0 > 10000) {
                break; // 单局硬超时 10 秒,防止个别局面拖垮整个基准
            }
        }
    } catch (e) {
        // 旧 AI 在立即模式下存在自递归爆栈可能(新实现已消除);
        // 打印去重后的调用栈帧,定位递归来源
        const stack = String((e as any) && (e as any).stack || '');
        const frames = stack
            .split('\n')
            .filter(l => l.includes(' at '))
            .map(l => l.replace(/:[0-9]+:[0-9]+/, '').trim());
        const uniq: string[] = [];
        for (const f of frames) {
            if (!uniq.includes(f)) {
                uniq.push(f);
            }
            if (uniq.length > 30) {
                break;
            }
        }
        crash = uniq.join(' <- ');
    }

    return {
        winner: server.getWinner(),
        turns: (server as any).turnNum,
        ms: Date.now() - t0,
        stalls: stalls,
        crash: crash
    };
}

async function bench(
    nameA: string,
    nameB: string,
    games: number,
    ctors: CtorBundle
) {
    const ctorA = ctors[nameA];
    const ctorB = ctors[nameB];
    if (!ctorA || !ctorB) {
        console.error(`未知 AI 名: ${nameA} / ${nameB},可用:`, Object.keys(ctors));
        process.exit(1);
    }
    const result = {
        games: 0,
        aWins: 0,
        bWins: 0,
        aWinsFirst: 0,
        aWinsSecond: 0,
        timeouts: 0,
        crashes: 0,
        totalTurns: 0,
        totalMs: 0,
        totalStalls: 0
    };
    for (let i = 0; i < games; i++) {
        // 先后手各一半,消除先手优势
        const aFirst = i % 2 === 0;
        const outcome = aFirst
            ? await runGame(ctorA, ctorB)
            : await runGame(ctorB, ctorA);
        console.log(
            `  局 ${i + 1}: 胜者=${outcome.winner} 回合=${outcome.turns} ` +
                `${outcome.ms}ms 僵局=${outcome.stalls}${
                    outcome.crash ? ' 崩溃=' + outcome.crash : ''
                }`
        );
        result.games++;
        result.totalTurns += outcome.turns;
        result.totalMs += outcome.ms;
        result.totalStalls += outcome.stalls;
        if (outcome.crash) {
            result.crashes++;
        }
        if (outcome.winner === -1) {
            result.timeouts++;
        } else {
            const aWon = aFirst ? outcome.winner === 0 : outcome.winner === 1;
            if (aWon) {
                result.aWins++;
                if (aFirst) {
                    result.aWinsFirst++;
                } else {
                    result.aWinsSecond++;
                }
            } else {
                result.bWins++;
            }
        }
    }
    const winRate = ((result.aWins / result.games) * 100).toFixed(1);
    const avgTurns = (result.totalTurns / result.games).toFixed(1);
    const avgMs = Math.round(result.totalMs / result.games);
    console.log(
        `[${nameA} vs ${nameB}] ${result.games} 局 | ` +
            `${nameA} 胜率 ${winRate}% (先手 ${result.aWinsFirst}/${Math.ceil(
                games / 2
            )}, 后手 ${result.aWinsSecond}/${Math.floor(games / 2)}) | ` +
            `平均 ${avgTurns} 回合, ${avgMs}ms/局 | ` +
            `超时 ${result.timeouts}, 僵局 ${result.totalStalls}, 崩溃 ${result.crashes}`
    );
}

(async () => {
    const games = parseInt(process.argv[2] || '60', 10);
    const nameA = process.argv[3] || 'legacy';
    const nameB = process.argv[4] || 'legacy';
    const ctors = await resolveCtors();
    console.log(`=== AI 基准: ${games} 局 ${nameA} vs ${nameB} ===`);
    await bench(nameA, nameB, games, ctors);
    process.exit(0);
})();
