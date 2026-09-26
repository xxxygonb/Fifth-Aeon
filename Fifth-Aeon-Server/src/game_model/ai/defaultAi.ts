import { maxBy, meanBy, sortBy, sumBy, take } from 'lodash';
import { Card, CardType } from '../card-types/card';
import { Enchantment } from '../card-types/enchantment';
import { Item } from '../card-types/item';
import { Unit, isUnit } from '../card-types/unit';
import { TransformDamaged } from '../cards/mechanics/decaySpecials';
import { Lethal, Shielded } from '../cards/mechanics/skills';
import { ClientGame } from '../clientGame';
import { DeckList } from '../deckList';
import { GamePhase } from '../game';
import { EvalContext, EvalMap } from '../mechanic';
import { Player } from '../player';
import { Resource, ResourceTypeNames } from '../resource';
import { AI } from './ai';
import { aiList } from './aiList';
import { BoardEvaluator } from './boardEvaluator';
import { DeckBuilder } from './deckBuilder';
import { RandomBuilder } from './randomBuilder';
import { ChoiceHeuristic } from './heuristics';
import { BlockOutcome, CombatAnalyzer } from './combatAnalyer';
import { Permanent } from '../card-types/permanent';

/**
 * Represents an action (playing a card, an item or an enchantment)
 * whose value has already been determined (By a heuristic)
 */
interface EvaluatedAction {
    score: number;
    cost: number;
    card?: Card;
    enchantmentTarget?: Enchantment;
    target?: Permanent;
    host?: Unit;
}

/**
 * A heuristics based A.I
 *
 * This is the default opponent for singleplayer.
 *
 * It is built on heuristics and does not use any tree search based algorithm.
 * As such, it runs quite fast but is prone to making short sighted moves.
 *
 * 决策核心(2026-09 重写):
 * - selectActions:循环式贪心执行(非自递归),颜色/能量双重可行性过滤
 * - attack:斩杀检测(对手无可阻挡者且总攻致死时全体宣攻)+ 对手最优阻挡模型
 * - block:CombatAnalyzer.evaluateAllBlocks 全局枚举阻挡组合,
 *   以 BoardEvaluator 场面价值取最优(小兵换命等权衡自然涌现)
 * - 资源规划:按"新解锁手牌价值 + 卡组颜色曲线"对每种颜色打分
 *
 * 兼容性:所有评估只调用卡牌既有的 evaluate() 接口,新卡零成本接入。
 */
export class DefaultAI extends AI {
    protected enemyNumber: number;
    protected aiPlayer: Player;

    public static getDeckbuilder(): DeckBuilder {
        return new RandomBuilder();
    }

    /**
     * Creates an instance of DefaultAI.
     *
     * @param playerNumber - The number of the player the A.I will control
     * @param game - The interface by which the A.I will take actions and observe state
     * @param deck - The DeckList of the deck the A.I will play
     * @param animator - An animator to avoid acting during animations
     */
    constructor(playerNumber: number, game: ClientGame, deck: DeckList) {
        super(playerNumber, game, deck);
        this.aiPlayer = this.game.getPlayer(this.playerNumber);
        this.enemyNumber = this.game.getOtherPlayerNumber(this.playerNumber);
        this.game.setOwningPlayer(this.playerNumber);

        this.game.promptCardChoice = this.makeChoice.bind(this);
    }

    /** Triggers the A.I to consider what its next action should be */
    protected think() {
        if (this.game.getPhase() === GamePhase.Block) {
            this.block();
        } else {
            if (this.game.canPlayResource()) {
                this.sequenceActions([
                    this.playResource,
                    this.selectActions,
                    this.attack
                ]);
            } else {
                this.sequenceActions([this.selectActions, this.attack]);
            }
        }
    }

    /** Returns a deckbuilder to be used for limited tournaments */
    public getDeckbuilder(): DeckBuilder {
        throw new RandomBuilder();
    }

    /** A simple heuristic to determine which card is best to draw
       This heuristic assumes it is best to draw cards whose cost
       is close to the amount of resources we have.*/
    protected cardDrawHeuristic(card: Card): number {
        return Math.abs(
            this.aiPlayer.getPool().getNumeric() - card.getCost().getNumeric()
        );
    }

    /** Decides which cards of a set of choices to choose to draw. */
    protected evaluateToDraw(
        choices: Card[],
        min: number,
        max: number
    ): Card[] {
        return take(
            sortBy(choices, card => this.cardDrawHeuristic(card)),
            max
        );
    }

    /** Decides which cards of a set of choices to discard
     * The heuristic is the inverse of the to draw heuristic. */
    protected evaluateToDiscard(
        choices: Card[],
        min: number,
        max: number
    ): Card[] {
        return take(
            sortBy(choices, card => -this.cardDrawHeuristic(card)),
            min
        );
    }

    /** 安全评估:个别机制的 evaluate 存在自引用递归(引擎已知问题,
     * 原实现同样依赖 try/catch 幸存),失败时返回 0 分。 */
    protected safeEvaluate(card: Card): number {
        try {
            return card.evaluate(this.game, EvalContext.Play, new Map());
        } catch (e) {
            return 0;
        }
    }

    /** Decides which cards of a set to replace.
     * 2026-09 升级(P1-8):替换"强度"低于卡组平均强度的可选牌,
     * 强度 = evaluate 价值 − 费用(原实现仅按费用差排序,会换掉
     * 便宜的低费曲线卡)。强制替换(min 张)仍取最弱者。 */
    protected evaluateToReplace(
        choices: Card[],
        min: number,
        max: number
    ): Card[] {
        const strength = (card: Card) =>
            this.safeEvaluate(card) - card.getCost().getNumeric();
        const weakest = sortBy(choices, strength);
        const mandatory = take(weakest, min);
        const optional = weakest.slice(min);
        if (optional.length > 0) {
            const average = meanBy(
                this.deck.getUniqueCards(),
                strength.bind(this)
            );
            const replaceable = optional.filter(
                card => strength(card) < average
            );
            return mandatory.concat(
                take(sortBy(replaceable, strength), max - mandatory.length)
            );
        }
        return mandatory;
    }

    /** A heuristic that chooses the unit with the highest total stats (all choices must be Units) */
    protected highestStatHeuristic(
        choices: Card[],
        min: number,
        max: number
    ): Card[] {
        return take(
            sortBy(choices as Unit[], unit => -unit.getStats()),
            max
        );
    }

    /** Get the appropriate heuristic for making a choice */
    protected getHeuristic(
        heuristicType: ChoiceHeuristic
    ): (choices: Card[], min: number, max: number) => Card[] {
        switch (heuristicType) {
            case ChoiceHeuristic.DrawHeuristic:
                return this.evaluateToDraw.bind(this);
            case ChoiceHeuristic.DiscardHeuristic:
                return this.evaluateToDiscard.bind(this);
            case ChoiceHeuristic.HighestStatsHeuristic:
                return this.highestStatHeuristic.bind(this);
            case ChoiceHeuristic.ReplaceHeuristic:
                return this.evaluateToReplace.bind(this);
        }
    }

    /** Returns the cards that should be chosen for a given choice based on its heuristic */
    protected getCardToChoose(
        options: Array<Card>,
        min: number,
        max: number,
        heuristicType: ChoiceHeuristic
    ) {
        if (options.length < min) {
            return options;
        }
        const evaluator = this.getHeuristic(heuristicType);
        const choices = evaluator(options, min, max);
        if (choices.length > max || choices.length < min) {
            console.log('bug in evaluator', ChoiceHeuristic[heuristicType]);
        }
        return evaluator(options, min, max);
    }

    /** Makes a choice when requested to by the game engine (such as what cards to mulligan) */
    protected makeChoice(
        player: number,
        options: Array<Card>,
        min: number = 1,
        max: number = 1,
        callback: ((cards: Card[]) => void) | null = null,
        message: string,
        heuristicType: ChoiceHeuristic
    ) {
        if (!callback) {
            return;
        }
        this.game.deferChoice(player, options, min, max, callback);
        if (player !== this.playerNumber) {
            return;
        }

        const choiceCards = this.getCardToChoose(
            options,
            min,
            max,
            heuristicType
        );
        setTimeout(
            () => this.game.makeChoice(this.playerNumber, choiceCards),
            0
        );
    }

    /** Gets the best target for a card with a targeter.
     * The best target is considered to be the one with the highest evaluateTarget value.
     */
    protected getBestTarget(card: Card): EvaluatedAction {
        const targets = card.getTargeter().getValidTargets(card, this.game);
        const best = maxBy(targets, target =>
            card.evaluateTarget(target, this.game, new Map())
        );
        if (!best) {
            return { score: 0, cost: card.getCost().getNumeric(), card: card };
        }
        return {
            target: best,
            score: card.evaluateTarget(best, this.game, new Map()),
            cost: card.getCost().getNumeric(),
            card: card
        };
    }

    /**
     * Evaluates a card based on its value and the value of its target.
     *
     * @param  card - The card to be evaluated
     * @returns - The EvaluatedAction with the score and any targets
     */
    protected evaluateCard(card: Card): EvaluatedAction {
        let result: EvaluatedAction = {
            score: 0,
            cost: card.getCost().getNumeric(),
            card: card
        };
        if (card.getTargeter().needsInput()) {
            const best = this.getBestTarget(card);
            if (best.score > 0 || !card.getTargeter().isOptional()) {
                result = best;
            }
        }
        if (card.getCardType() === CardType.Item) {
            result.host = this.getBestHost(card as Item);
        }
        result.score += card.evaluate(this.game, EvalContext.Play, new Map());
        return result;
    }

    /**
     * Evaluates empowering/diminishing an enchantment.
     *
     * 2026-09 重写:分数 = 该附魔机制的真实评估值与修改成本之比,
     * 取绝对值以同时覆盖"强化我方附魔"与"削弱敌方附魔"两种情形
     * (原实现为 playCost / (modifyCost * power) 的经验公式)。
     */
    protected evaluateEnchantment(enchantment: Enchantment): EvaluatedAction {
        const modifyCost = enchantment.getModifyCost().getNumeric();
        const me = this.aiPlayer;
        if (
            modifyCost > me.getPool().getNumeric() ||
            !enchantment.canChangePower(me, this.game)
        ) {
            return { cost: 0, score: -1 };
        }
        const value = Math.abs(
            enchantment.evaluate(this.game, EvalContext.Play, new Map())
        );
        return {
            enchantmentTarget: enchantment,
            cost: modifyCost,
            score: value / Math.max(modifyCost, 1)
        };
    }

    /**
     * Selects and executes a series of actions (playing cards or
     * modifying enchantments).
     *
     * 2026-09 重写(原为 knapsack 选组合后仅执行单张,且自递归易爆栈):
     * 循环式贪心 —— 每轮评估全部合法动作,执行分数最高者,随后手牌/能量/
     * 场面已变化,重新评估直到没有正价值的动作。
     *
     * 可行性双重过滤:能量数值 + 四系颜色需求(原实现只看能量,
     * 可能选出执行必败的动作白白浪费回合)。
     */
    protected selectActions() {
        for (let guard = 0; guard < 12; guard++) {
            const pool = this.aiPlayer.getPool();
            const energy = pool.getNumeric();
            const actions: EvaluatedAction[] = [];

            for (const card of this.aiPlayer.getHand()) {
                if (!card.isPlayable(this.game)) {
                    continue;
                }
                const cost = card.getCost();
                if (
                    cost.getNumeric() > energy ||
                    !pool.meetsReq(cost)
                ) {
                    continue;
                }
                try {
                    const action = this.evaluateCard(card);
                    if (action.score > 0) {
                        actions.push(action);
                    }
                } catch (e) {
                    console.error('Error while evaluating', card, 'got', e);
                }
            }

            for (const enchantment of this.getModifiableEnchantments()) {
                try {
                    const action = this.evaluateEnchantment(enchantment);
                    if (action.score > 0) {
                        actions.push(action);
                    }
                } catch (e) {
                    console.error('Error while evaluating', enchantment, e);
                }
            }

            const best = maxBy(actions, action => action.score);
            if (!best) {
                break;
            }
            const executed = this.runEvaluatedAction(best);
            if (executed !== true) {
                break; // 执行失败立即停止,防止无效循环
            }
        }
        return true;
    }

    /** Plays a card based on an action */
    protected runCardPlayAction(action: EvaluatedAction) {
        const targets: Permanent[] = [];
        const host = action.host;
        const toPlay = action.card;
        if (!toPlay) {
            throw new Error('A.I card play lacks card');
        }
        if (action.target) {
            targets.push(action.target);
        }
        return this.game.playCardExtern(toPlay, targets, host);
    }

    /** Runs an action (either playing a card or modifying an enchantment) */
    protected runEvaluatedAction(action: EvaluatedAction): boolean {
        if (action.card) {
            return this.runCardPlayAction(action);
        } else if (action.enchantmentTarget) {
            return this.game.modifyEnchantment(
                this.aiPlayer,
                action.enchantmentTarget
            );
        }
        console.error('Failed to run evaluated action', action);
        return false;
    }

    /** Returns the enchantments we have enough energy to empower or diminish */
    protected getModifiableEnchantments() {
        return this.game
            .getBoard()
            .getAllEnchantments()
            .filter(enchant => this.game.canModifyEnchantment(enchant));
    }

    /**
     * Gets the best host for an item.
     * Currently it simply returns the unit with the highest value multiplier (ignoring the properties of the item).
     * @param item The item to find a host for
     */
    protected getBestHost(item: Item): Unit {
        const validHosts = item
            .getHostTargeter()
            .getValidTargets(item, this.game)
            .filter(isUnit);
        const best = maxBy(validHosts, host =>
            host.getMultiplier(
                this.game,
                EvalContext.NonlethalRemoval,
                new Map()
            )
        );
        if (best === undefined) {
            throw new Error('A.I could not find host for item');
        }
        return best;
    }

    /** Computes the most common resource among a set of cards (such as a deck or hand) */
    protected getMostCommonResource(cards: Card[]): string {
        const total = new Resource(0);
        for (const card of cards) {
            total.add(card.getCost());
        }
        return maxBy(ResourceTypeNames, type =>
            total.getOfType(type)
        ) as string;
    }

    /**
     * 模拟"下了一块该色资源"之后的资源池:
     * 能量上限 +1 并回满、该色需求 +1。
     */
    protected simulateResource(pool: Resource, type: string): Resource {
        const types: any = {};
        for (const t of ResourceTypeNames) {
            types[t] = pool.getOfType(t);
        }
        types[type] = (types[type] || 0) + 1;
        return new Resource(
            pool.getMaxNumeric() + 1,
            pool.getMaxNumeric() + 1,
            types
        );
    }

    /**
     * Decides what resource to play next.
     *
     * 2026-09 重写:对每种颜色打分而非只看"离能打出哪张牌最近"。
     *  1) 打下它之后新解锁的手牌价值(能量与颜色同时达标的卡的 evaluate 之和)
     *  2) 卡组中需要该色资源的卡牌占比(长线曲线平滑)
     * 选得分最高的颜色;无缺口时回退卡组最常见颜色。
     */
    protected getResourceToPlay(): string {
        const hand = this.aiPlayer.getHand();
        const deckCards = this.deck.getUniqueCards();
        const pool = this.aiPlayer.getPool();
        let bestType: string | null = null;
        let bestScore = -Infinity;
        for (const type of ResourceTypeNames) {
            const simulated = this.simulateResource(pool, type);
            let score = 0;
            for (const card of hand) {
                const cost = card.getCost();
                if (cost.getNumeric() > simulated.getNumeric()) {
                    continue; // 能量仍不足,下这块资源也无法立即解锁
                }
                if (!pool.meetsReq(cost) && simulated.meetsReq(cost)) {
                    score += Math.max(this.safeEvaluate(card), 1);
                }
            }
            // 长线:卡组中该色的需求占比
            for (const card of deckCards) {
                if (card.getCost().getOfType(type) > 0) {
                    score += 0.3;
                }
            }
            if (score > bestScore) {
                bestScore = score;
                bestType = type;
            }
        }
        return bestType || this.getMostCommonResource(deckCards);
    }

    protected playResource() {
        return this.game.playResource(this.getResourceToPlay());
    }

    // Attacking/Blocking -------------------------------------------------------------------------

    /**
     * Chooses which, if any, units to attack with.
     *
     * 2026-09 增强:
     * - 斩杀检测(P0-3):对手没有任何未疲惫的潜在阻挡者、且全部攻击伤害
     *   足以终结对局时,全体宣攻(原实现永远不敢全下)。
     * - 其余单位沿用"对手视角无法有利阻挡才攻"的对手模型
     *   (canFavorablyBlock,1v1;多个对手单位联合阻挡的情形见
     *   block 侧的分组结算,进攻侧联合威胁复杂度高、近似忽略)。
     * - reserveDefense 钩子(P2):Expert 档可把高价值单位留作防守。
     */
    protected attack() {
        const potentialAttackers = this.game
            .getBoard()
            .getPlayerUnits(this.playerNumber)
            .filter(unit => unit.canAttack())
            .filter(unit => unit.getDamage() > 0);
        const potentialBlockers = this.game
            .getBoard()
            .getPlayerUnits(this.enemyNumber)
            .filter(unit => !unit.isExhausted());
        const enemyLife = this.game
            .getPlayer(this.enemyNumber)
            .getLife();

        // P0-3 斩杀:对手拦不住任何攻击、且总伤害足以致死时,全体宣攻
        const totalDamage = sumBy(
            potentialAttackers,
            attacker => attacker.getDamage()
        );
        const blockable = potentialAttackers.some(attacker =>
            potentialBlockers.some(blocker =>
                blocker.canBlockTarget(attacker, true)
            )
        );
        if (!blockable && totalDamage >= enemyLife) {
            for (const attacker of potentialAttackers) {
                this.game.declareAttacker(attacker);
            }
            return true;
        }

        for (const attacker of potentialAttackers) {
            let hasBlocker = false;
            for (const blocker of potentialBlockers) {
                if (this.canFavorablyBlock(attacker, blocker)) {
                    hasBlocker = true;
                    break;
                }
            }
            if (!hasBlocker) {
                if (this.reserveDefense(attacker)) {
                    continue;
                }
                this.game.declareAttacker(attacker);
            }
        }
        return true;
    }

    /**
     * P2 钩子:是否把该单位留作防守而不宣攻。
     * DefaultAI(硬/专家难度基类)默认不启用,由难度子类覆写。
     */
    protected reserveDefense(attacker: Unit): boolean {
        return false;
    }

    /**
     * Analyzes whether a blocker can favorably block an attacker.
     * A block is considered favorable under any of the following circumstances
     *   1. Only the attacker would die
     *   2. Neither the attacker nor the blocker would die
     *   3. Both the attacker and the blocker die, but the attacker is more valuable than the blocker.
     *
     * Notably, this function cannot handle blocking with multiple units (even though that is legal).
     *
     * @param attacker - The attacking unit to consider blocking
     * @param blocker - The blocker to consider
     */
    protected canFavorablyBlock(attacker: Unit, blocker: Unit) {
        if (!blocker.canBlockTarget(attacker, true)) {
            return false;
        }
        const type = CombatAnalyzer.categorizeBlock(attacker, blocker);
        return (
            type === BlockOutcome.AttackerDies ||
            type === BlockOutcome.NeitherDies ||
            (type === BlockOutcome.BothDie &&
                attacker.evaluate(
                    this.game,
                    EvalContext.LethalRemoval,
                    new Map()
                ) >
                    blocker.evaluate(
                        this.game,
                        EvalContext.LethalRemoval,
                        new Map()
                    ))
        );
    }

    /** Declares a blocker as blocking a particular attacker */
    protected makeBlockAction(params: { blocker: Unit; attacker: Unit }) {
        return () => {
            return this.game.declareBlocker(params.blocker, params.attacker);
        };
    }

    /**
     * Determines what units should block enemy attackers.
     *
     * 2026-09 重写:
     * - P0-1 修复:原实现 filter(unit => !unit.canBlock()) 把条件取反,
     *   筛出的全是无法阻挡的单位,导致 AI 从不声明阻挡者。
     * - P0-4:用 CombatAnalyzer.evaluateAllBlocks 枚举全部
     *   "阻挡者→攻击者"分配组合(含多个阻挡者拦同一攻击者、
     *   放弃拦截保单位等),以我方场面价值取最优。
     * - "小兵换命"(chump block)由评分自然涌现:挨打的场面价值
     *   (伤害 × faceDamageWeight)高于牺牲的阻挡者时会被选中。
     */
    protected block() {
        const potentialBlockers = this.game
            .getBoard()
            .getPlayerUnits(this.playerNumber)
            .filter(unit => unit.canBlock());
        const attackers = this.game.getAttackers();
        if (attackers.length === 0 || potentialBlockers.length === 0) {
            return true;
        }

        const best = CombatAnalyzer.evaluateAllBlocks(
            potentialBlockers,
            attackers,
            blocks => this.evaluateBlockPlan(blocks, attackers)
        );
        if (!best) {
            return true;
        }
        const actions = best
            .filter(pair => pair[1] !== undefined)
            .map(pair => this.makeBlockAction({
                blocker: pair[0],
                attacker: pair[1] as Unit
            }));
        this.sequenceActions(actions);
        return true;
    }

    /** 评估一个阻挡分配方案对我方的价值(越高越好) */
    protected evaluateBlockPlan(
        blocks: [Unit, Unit?][],
        attackers: Unit[]
    ): number {
        const incoming = sumBy(
            attackers,
            attacker => attacker.getDamage()
        );
        const groups = new Map<Unit, Unit[]>();
        for (const [blocker, attacker] of blocks) {
            if (!attacker) {
                continue;
            }
            const group = groups.get(attacker) || [];
            group.push(blocker);
            groups.set(attacker, group);
        }
        const evaluated: EvalMap = new Map();
        let score = 0;
        let totalFace = 0;
        for (const attacker of attackers) {
            const group = groups.get(attacker);
            const outcome = group
                ? this.simulateBlockGroup(attacker, group, evaluated)
                : {
                      faceDamage: attacker.getDamage(),
                      killed: [] as Unit[],
                      attackerDies: false
                  };
            totalFace += outcome.faceDamage;
            if (outcome.attackerDies) {
                score += BoardEvaluator.unitValue(
                    attacker,
                    this.game,
                    evaluated
                );
            }
            for (const lost of outcome.killed) {
                score -= BoardEvaluator.unitValue(lost, this.game, evaluated);
            }
        }
        score -= totalFace * BoardEvaluator.faceDamageWeight;
        return score;
    }

    /**
     * 近似结算"多个阻挡者拦截同一攻击者":
     * 每个阻挡者把自身伤害全额打给攻击者,攻击者拥有伤害分配权 ——
     * 以对手视角贪心分配:优先击杀我方价值最高且可被击杀的阻挡者。
     * 被阻挡的攻击者的溢出伤害不打脸。
     */
    protected simulateBlockGroup(
        attacker: Unit,
        blockers: Unit[],
        evaluated: EvalMap
    ) {
        const groupDamage = sumBy(blockers, blocker => blocker.getDamage());
        const attackerDies =
            !this.isShielded(attacker) &&
            (this.hasLethalLike(blockers) ||
                groupDamage >= attacker.getLife());

        const killed: Unit[] = [];
        let remaining = attacker.getDamage();
        const attackerLethal = this.hasLethalLike([attacker]);
        const sorted = sortBy(
            blockers,
            blocker =>
                -BoardEvaluator.unitValue(blocker, this.game, evaluated)
        );
        for (const blocker of sorted) {
            if (remaining <= 0) {
                break;
            }
            if (this.isShielded(blocker)) {
                continue;
            }
            if (attackerLethal || remaining >= blocker.getLife()) {
                killed.push(blocker);
                remaining -= blocker.getLife();
            }
        }
        return {
            attackerDies: attackerDies,
            killed: killed,
            faceDamage: attackerDies ? 0 : attacker.getDamage()
        };
    }

    protected isShielded(unit: Unit): boolean {
        const shield = unit.hasMechanicWithId(Shielded.getId()) as Shielded;
        return !!shield && !shield.isDepleted();
    }

    protected hasLethalLike(units: Unit[]): boolean {
        return units.some(
            unit =>
                unit.hasMechanicWithId(Lethal.getId()) ||
                unit.hasMechanicWithId(TransformDamaged.getId())
        );
    }
}

aiList.registerConstructor(DefaultAI);
