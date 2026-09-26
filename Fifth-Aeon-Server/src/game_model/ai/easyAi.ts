import { Unit } from '../card-types/unit';
import { DefaultAI } from './defaultAi';
import { aiList } from './aiList';

/**
 * 简单难度 AI:在 DefaultAI 的完整决策核心之上引入评估噪声与
 * 概率性失误,但保留所有"正确性"行为(会阻挡、会斩杀、不非法出牌)。
 *
 * 与旧版的差异:旧版难度仅改变卡组,所有难度共享同一套短视启发式。
 */
export class EasyAI extends DefaultAI {
    /** 评估噪声幅度:分数乘以 [0.5, 1.5) 的随机系数 */
    protected noiseRange(): [number, number] {
        return [0.5, 1.5];
    }

    // 注意:不可引入"概率跳过下资源"类失误 —— 引擎规定未下资源时
    // 不能结束回合(ClientGame.pass 拒绝),跳过会导致回合死锁。
    // Easy 档的强度差异完全由评估噪声提供。

    protected evaluateCard(card: import('../card-types/card').Card) {
        const result = super.evaluateCard(card);
        const [low, high] = this.noiseRange();
        result.score *= low + Math.random() * (high - low);
        return result;
    }

    protected evaluateEnchantment(enchantment: import('../card-types/enchantment').Enchantment) {
        const result = super.evaluateEnchantment(enchantment);
        const [low, high] = this.noiseRange();
        result.score *= low + Math.random() * (high - low);
        return result;
    }

    /** 简单档不使用留防权衡 */
    protected reserveDefense(attacker: Unit): boolean {
        return false;
    }
}

aiList.registerConstructor(EasyAI);
