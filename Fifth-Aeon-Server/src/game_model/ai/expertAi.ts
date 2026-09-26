import { Unit } from '../card-types/unit';
import { BoardEvaluator } from './boardEvaluator';
import { DefaultAI } from './defaultAi';
import { aiList } from './aiList';

/**
 * 专家难度 AI:满配决策核心 + 留防权衡。
 *
 * 留防:当对手仍有一定生命(斩杀无望)且我方场面劣势时,
 * 高价值的攻击者留守防守,避免攻出去被白换。
 */
export class ExpertAI extends DefaultAI {
    protected reserveDefense(attacker: Unit): boolean {
        const enemyLife = this.game.getPlayer(this.enemyNumber).getLife();
        if (enemyLife <= 8) {
            // 接近斩杀区间,不留防,全力抢血
            return false;
        }
        const boardDiff = BoardEvaluator.evaluateBoard(
            this.game,
            this.playerNumber,
            this.enemyNumber
        );
        // 场面劣势时,高价值单位留守
        return boardDiff < 0 && BoardEvaluator.unitValue(attacker, this.game) >= 8;
    }
}

aiList.registerConstructor(ExpertAI);
