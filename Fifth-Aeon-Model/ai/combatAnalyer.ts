import { Unit } from '../card-types/unit';
import { Lethal, Shielded } from '../cards/mechanics/skills';
import { TransformDamaged } from '../cards/mechanics/decaySpecials';

/** Represents the outcome of a 1v1 fight based on which of the two units die */
export enum BlockOutcome {
    AttackerDies,
    NeitherDies,
    BothDie,
    BlockerDies
}

export class CombatAnalyzer {
    /** Categorizes a block by what its outcome will be (if the attacker, blocker or both will die) */
    public static categorizeBlock(attacker: Unit, blocker: Unit): BlockOutcome {
        const isAttackerLethal =
            attacker.hasMechanicWithId(Lethal.getId()) ||
            attacker.hasMechanicWithId(TransformDamaged.getId());
        const isBlockerLethal =
            blocker.hasMechanicWithId(Lethal.getId()) ||
            blocker.hasMechanicWithId(TransformDamaged.getId());

        let shield = attacker.hasMechanicWithId(Shielded.getId()) as Shielded;
        const isAttackerShielded = shield && !shield.isDepleted();
        shield = blocker.hasMechanicWithId(Shielded.getId()) as Shielded;
        const isBlockerShielded = shield && !shield.isDepleted();

        const attackerDies =
            !isAttackerShielded &&
            (isBlockerLethal || blocker.getDamage() >= attacker.getLife());
        const blockerDies =
            !isBlockerShielded &&
            (isAttackerLethal || attacker.getDamage() >= blocker.getLife());

        if (attackerDies && blockerDies) {
            return BlockOutcome.BothDie;
        } else if (attackerDies) {
            return BlockOutcome.AttackerDies;
        } else if (blockerDies) {
            return BlockOutcome.BlockerDies;
        } else {
            return BlockOutcome.NeitherDies;
        }
    }

    public static evaluateAllBlocks(
        blockers: Unit[],
        attackers: Unit[],
        evaluator: (blocks: [Unit, Unit?][]) => number
    ) {
        const attackersBlockerCanBlock = blockers
            .map(
                blocker =>
                    [
                        blocker,
                        attackers.filter(attacker =>
                            blocker.canBlockTarget(attacker)
                        )
                    ] as [Unit, Unit[]]
            )
            .filter(blockCombo => blockCombo[1].length > 0);

        if (attackersBlockerCanBlock.length === 0) {
            return undefined;
        }

        const lastBlocker = attackersBlockerCanBlock.length - 1;
        const highestBlocks = attackersBlockerCanBlock.map(
            combo => combo[1].length
        );
        const notBlocking = -1;
        const blockCombination = attackersBlockerCanBlock.map(_ => notBlocking);

        let bestScore = -Infinity;
        let bestCombo;
        // 组合空间爆炸防护:全场多单位时 8^7 量级的枚举不可承受,
        // 超限退化为贪心 —— 每个阻挡者独立选择对己方最有利的单拦目标
        const totalCombos = highestBlocks.reduce(
            (acc, count) => acc * (count + 1),
            1
        );
        if (totalCombos > 20000) {
            return attackersBlockerCanBlock.map(([blocker, options]) => {
                let best: [Unit, Unit?] = [blocker, undefined];
                let bestLocal = -Infinity;
                for (const attacker of options) {
                    const type = CombatAnalyzer.categorizeBlock(
                        attacker,
                        blocker
                    );
                    const localScore =
                        type === BlockOutcome.AttackerDies
                            ? 100
                            : type === BlockOutcome.NeitherDies
                            ? 0
                            : type === BlockOutcome.BothDie
                            ? -25
                            : -100;
                    if (localScore > bestLocal) {
                        bestLocal = localScore;
                        best = [blocker, attacker];
                    }
                }
                return best;
            });
        }
        // 枚举全部"阻挡者→攻击者"分配组合;进位溢出(全部回到未阻挡)
        // 时枚举完毕 —— 原实现缺少该终止条件,枚举完会死循环
        while (true) {
            const combo: [Unit, Unit?][] = this.makeCombo(
                blockCombination,
                attackersBlockerCanBlock
            );
            const score = evaluator(combo);
            if (score > bestScore) {
                bestScore = score;
                bestCombo = combo;
            }

            /// Compute the next combo
            let currentDigit = 0;
            let exhausted = false;
            while (true) {
                blockCombination[currentDigit]++;
                if (
                    blockCombination[currentDigit] !==
                    highestBlocks[currentDigit]
                ) {
                    break;
                }
                blockCombination[currentDigit] = notBlocking;
                currentDigit++;
                if (currentDigit > lastBlocker) {
                    exhausted = true;
                    break;
                }
            }
            if (exhausted) {
                break;
            }
        }

        return bestCombo;
    }

    public static  makeCombo(
        blockCombination: number[],
        attackersBlockerCanBlock: [Unit, Unit[]][]
    ): [Unit, Unit?][] {
        return blockCombination.map((comboNumber, i) => [
            attackersBlockerCanBlock[i][0],
            comboNumber === -1 ? undefined : attackersBlockerCanBlock[i][1][comboNumber]
        ]);
    }
}
