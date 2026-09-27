import { GameActionType, GameAction } from '../events/gameAction';
import { GamePhase } from '../game';
import { Unit } from '../card-types/unit';
import { BoardEvaluator } from './boardEvaluator';
import { BlockOutcome, CombatAnalyzer } from './combatAnalyer';
import { DefaultAI } from './defaultAi';
import { ServerGame } from '../serverGame';
import { aiList } from './aiList';

/**
 * 专家难度 AI:满配决策核心 + 留防权衡 + 引擎级攻击推演(A4)。
 *
 * - 留防:当对手仍有一定生命(斩杀无望)且我方场面劣势时,
 *   高价值的攻击者留守防守,避免攻出去被白换。
 * - 攻击推演(A4):在「确定性重放克隆」的对局上分别结算
 *   「全力攻 / 按兵不动(及逐个单攻)」计划,防守方按与自身
 *   相同的贪心策略阻挡,取引擎真实结算后的场面收益最高者。
 *   模拟失败(克隆/重放异常)一律退回启发式计划,绝不影响对局。
 */
export class ExpertAI extends DefaultAI {
    protected useAttackSimulation = true;

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

    /**
     * A4:候选计划 = {不攻, 启发式计划, 启发式计划去掉每个单位}。
     * 在克隆对局上逐个结算,取场面收益最高者(平局偏保守)。
     */
    protected refineAttackPlan(
        plan: Unit[],
        potentialBlockers: Unit[],
        enemyLife: number
    ): Unit[] {
        if (!this.simulator || plan.length === 0) {
            return plan;
        }
        const candidates: Unit[][] = [[], plan];
        for (const unit of plan) {
            candidates.push(plan.filter(u => u.getId() !== unit.getId()));
        }
        let bestPlan: Unit[] = [];
        let bestScore = -Infinity;
        for (const candidate of candidates) {
            const score = this.simulateAttackPlan(candidate);
            if (score === null) {
                // 模拟不可用 → 保守沿用启发式计划
                return plan;
            }
            // 平局偏保守:严格大于才替换(初始 best 为不攻)
            if (score > bestScore) {
                bestScore = score;
                bestPlan = candidate;
            }
        }
        return bestPlan;
    }

    /**
     * 在克隆对局上结算一个攻击计划:
     * 宣攻 → 进攻方过牌 → 防守方按贪心策略阻挡(与自身 block 同源评分)→
     * 结算至战斗结束 → 返回「场面+生命」综合收益(相对双方,越高越好)。
     */
    private simulateAttackPlan(plan: Unit[]): number | null {
        const provider = this.simulator;
        if (!provider) {
            return null;
        }
        const clone: ServerGame | null = provider();
        if (!clone) {
            return null;
        }
        try {
            for (const unit of plan) {
                const cloneUnit = clone.getUnitById(unit.getId());
                if (!cloneUnit) {
                    return null;
                }
                if (
                    clone.handleAction({
                        player: this.playerNumber,
                        type: GameActionType.ToggleAttack,
                        unitId: cloneUnit.getId()
                    } as GameAction) === null
                ) {
                    return null;
                }
            }
            // 驱动至战斗结束:阶段回到 Play2(同回合第二行动阶段)或分出胜负
            for (let step = 0; step < 8; step++) {
                if (clone.getWinner() !== -1) {
                    break;
                }
                const phase = clone.getPhase();
                if (phase === GamePhase.Play2 || phase === GamePhase.End) {
                    break;
                }
                if (phase === GamePhase.Block) {
                    this.declareGreedyBlocksInClone(clone);
                }
                const active = clone.getActivePlayer();
                if (
                    clone.handleAction({
                        player: active,
                        type: GameActionType.Pass
                    } as GameAction) === null
                ) {
                    return null;
                }
            }
            return BoardEvaluator.evaluateBoard(
                clone,
                this.playerNumber,
                this.enemyNumber
            );
        } catch (e) {
            console.error('Expert AI: attack simulation failed', e);
            return null;
        }
    }

    /**
     * 克隆体中的防守方阻挡选择:与 AI 自身 block 决策同源
     * (CombatAnalyzer 枚举 + 价值评分),从防守方视角取最优。
     */
    private declareGreedyBlocksInClone(clone: ServerGame) {
        const defender = this.enemyNumber;
        const blockers = clone
            .getBoard()
            .getPlayerUnits(defender)
            .filter(unit => unit.canBlock());
        const attackers = clone.getAttackers();
        if (attackers.length === 0 || blockers.length === 0) {
            return;
        }
        const best = CombatAnalyzer.evaluateAllBlocks(
            blockers,
            attackers,
            blocks => this.scoreDefenderBlocks(clone, blocks, attackers)
        );
        if (!best) {
            return;
        }
        for (const pair of best) {
            const blocker = pair[0];
            const attacker = pair[1];
            if (!attacker) {
                continue;
            }
            clone.handleAction({
                player: defender,
                type: GameActionType.DeclareBlocker,
                blockerId: blocker.getId(),
                blockedId: attacker.getId()
            } as GameAction);
        }
    }

    /** 防守方视角的阻挡方案评分:保单位 + 换掉攻击者 + 减少面伤 */
    private scoreDefenderBlocks(
        clone: ServerGame,
        blocks: [Unit, Unit?][],
        attackers: Unit[]
    ): number {
        let score = 0;
        const blocked = new Set<string>();
        for (const [blocker, attacker] of blocks) {
            if (!attacker) {
                continue;
            }
            blocked.add(attacker.getId());
            const outcome = CombatAnalyzer.categorizeBlock(attacker, blocker);
            const attackerValue = BoardEvaluator.unitValue(attacker, clone);
            const blockerValue = BoardEvaluator.unitValue(blocker, clone);
            switch (outcome) {
                case BlockOutcome.AttackerDies:
                    score += attackerValue;
                    break;
                case BlockOutcome.BlockerDies:
                    score -= blockerValue - attacker.getDamage();
                    break;
                case BlockOutcome.BothDie:
                    score += attackerValue - blockerValue;
                    break;
                case BlockOutcome.NeitherDies:
                    // 攻击被吸收(攻击者白打一场)
                    score += 0.5 * attacker.getDamage();
                    break;
            }
        }
        // 未被阻挡的攻击者将打脸
        for (const attacker of attackers) {
            if (!blocked.has(attacker.getId())) {
                score -= attacker.getDamage() * BoardEvaluator.faceDamageWeight;
            }
        }
        return score;
    }
}

aiList.registerConstructor(ExpertAI);
