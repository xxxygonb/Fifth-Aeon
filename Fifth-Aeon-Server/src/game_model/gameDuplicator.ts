/**
 * 对局克隆器(A4):基于「确定性重放」复制一个状态一致的 ServerGame。
 *
 * 原理:引擎满足「同种子 + 同卡组 + 同动作序列 → 同一状态」
 * (engine.spec.ts 已有字节级回归),因此 clone = 重建 + 重放动作日志。
 *
 * 用途:AI 推演(Expert 攻击模拟)—— 在克隆体上尝试不同计划并让
 * 引擎真实结算,而不污染真实对局。任何一步重放失败都返回 null,
 * 调用方(AI)必须退回原有启发式,绝不影响正常对局。
 */
import { ServerGame, GameReplayInfo } from './serverGame';
import { standardFormat } from './gameFormat';

export type SimulatedGame = ServerGame;

export class ReplayDuplicator {
    /** 复制 source 的当前状态;失败返回 null */
    public static duplicate(source: ServerGame): ServerGame | null {
        let info: GameReplayInfo;
        try {
            info = source.getReplayInfo();
        } catch (e) {
            return null;
        }
        try {
            // 构造函数读取静态种子;真实对局的 RNG 均为实例成员,
            // 此处临时改静态种子不会影响任何已存在对局
            ServerGame.setSeed(info.seed);
            const clone = new ServerGame('ai-sim', standardFormat, [
                info.deckLists[0].clone(),
                info.deckLists[1].clone()
            ]);
            clone.startGame();
            for (const action of info.actions) {
                if (clone.handleAction(action) === null) {
                    return null;
                }
            }
            return clone;
        } catch (e) {
            console.error('AI sim: duplicate failed', e);
            return null;
        }
    }
}
