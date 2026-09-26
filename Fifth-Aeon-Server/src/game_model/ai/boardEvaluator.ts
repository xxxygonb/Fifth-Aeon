import { Unit } from '../card-types/unit';
import { Game } from '../game';
import { EvalContext, EvalMap } from '../mechanic';

/**
 * 场面估值器:为 AI 的攻防决策提供统一的价值尺度。
 *
 * 设计约束:只调用卡牌既有的 evaluate() 接口,不依赖任何具体卡牌或机制 ——
 * 未来新卡实现 evaluate() 后(见 CARD_CREATION_GUIDE 第 12 节的既有规范)
 * 会自动接入所有 AI 决策,无需改动本文件。
 */
export class BoardEvaluator {
    /** 生命的价值系数:1 点生命 ≈ 2 点卡牌价值(生命不可再生,优于场面) */
    public static lifeWeight = 2;
    /** 手牌优势系数:每张手牌的隐性价值 */
    public static cardAdvantageWeight = 1.5;
    /** 打脸伤害的价值系数:进攻决策中 1 点未受阻伤害 ≈ 2 点价值 */
    public static faceDamageWeight = 2;

    /** 单位的战场价值(含机制加成;LethalRemoval 语境 = 被移除时的损失)。
     * 个别机制(如 EnchantmentSummon 模板)的 evaluate 存在自引用递归,
     * 与原实现一致:评估失败按 0 分处理,绝不影响对局。 */
    public static unitValue(
        unit: Unit,
        game: Game,
        evaluated: EvalMap = new Map()
    ): number {
        try {
            return unit.evaluate(game, EvalContext.LethalRemoval, evaluated);
        } catch (e) {
            return 0;
        }
    }

    /** 某一方玩家的总价值:生命 + 场上单位 + 手牌 + 可用能量 */
    public static playerValue(game: Game, playerNo: number): number {
        const player = game.getPlayer(playerNo);
        let value = player.getLife() * BoardEvaluator.lifeWeight;
        value +=
            player.getHand().length * BoardEvaluator.cardAdvantageWeight;
        value += player.getPool().getNumeric();
        const evaluated: EvalMap = new Map();
        for (const unit of game.getBoard().getPlayerUnits(playerNo)) {
            value += BoardEvaluator.unitValue(unit, game, evaluated);
        }
        return value;
    }

    /** 场面差值(正数 = playerNo 占优) */
    public static evaluateBoard(
        game: Game,
        playerNo: number,
        enemyNo: number
    ): number {
        return (
            BoardEvaluator.playerValue(game, playerNo) -
            BoardEvaluator.playerValue(game, enemyNo)
        );
    }
}
