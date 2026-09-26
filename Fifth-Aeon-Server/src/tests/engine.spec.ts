import { expect } from 'chai';
import { cardList } from '../game_model/cards/cardList';
import { DeckList } from '../game_model/deckList';
import { standardFormat } from '../game_model/gameFormat';
import { GamePhase } from '../game_model/game';
import { ServerGame } from '../game_model/serverGame';
import { CardType } from '../game_model/card-types/card';
import { GameActionType } from '../game_model/events/gameAction';

/**
 * ServerGame 动作验证回归测试（权威服务器使用的正是本目录的 game_model 副本）。
 *
 * 约定：handleAction 返回 GameSyncEvent[] 表示接受，返回 null 表示拒绝。
 * 拒绝动作不允许污染棋盘状态（先校验后变更）。
 */

const KEEP_HAND = { choice: [] as string[] };

/** 构建一副合法的标准赛制卡组:10 种不同卡 × 4 张 = 40 张 */
function buildDeck(filter: (cost: number) => boolean): DeckList {
    const deck = new DeckList(standardFormat);
    const picked: string[] = [];
    for (const card of cardList.getCards()) {
        if (
            card.getCardType() === CardType.Unit &&
            filter(card.getCost().getNumeric()) &&
            !picked.includes(card.getDataId())
        ) {
            picked.push(card.getDataId());
            for (let i = 0; i < standardFormat.maxCardsOfType; i++) {
                expect(
                    deck.addCard(card),
                    `加入卡牌 ${card.getDataId()} 应成功`
                ).to.equal(true);
            }
        }
        if (picked.length >= 10) {
            break;
        }
    }
    expect(picked.length, '需要至少 10 种满足费用条件的卡牌').to.be.at.least(10);
    expect(deck.size()).to.equal(40);
    return deck;
}

function newGame(): ServerGame {
    // 全部使用费用 >= 2 的单位,保证"资源不足拒绝"用例的确定性
    ServerGame.setSeed(20260926);
    return new ServerGame('回归测试', standardFormat, [
        buildDeck(cost => cost >= 2),
        buildDeck(cost => cost >= 2)
    ]);
}

/** 开局并让双方保留手牌(调度/换手),进入玩家 0 的主阶段 */
function startWithMulligans(): ServerGame {
    const game = newGame();
    game.startGame();
    for (const player of [0, 1]) {
        const result = game.handleAction({
            type: GameActionType.CardChoice,
            player,
            ...KEEP_HAND
        });
        expect(result, `玩家 ${player} 的调度选择应被接受`).to.not.equal(null);
    }
    return game;
}

describe('ServerGame 动作验证回归', () => {
    it('开局后处于玩家 0 回合,双方有调度选择待回答', () => {
        const game = newGame();
        game.startGame();
        expect(game.getActivePlayer()).to.equal(0);
        expect(game.isPlayerTurn(0)).to.equal(true);
        // 调度未完成:其他动作全部拒绝
        expect(
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 0,
                resourceType: 'Growth'
            })
        ).to.equal(null);
    });

    it('非行动玩家不能 Pass,行动玩家 Pass 后回合移交', () => {
        const game = startWithMulligans();
        expect(
            game.handleAction({ type: GameActionType.Pass, player: 1 })
        ).to.equal(null);

        const result = game.handleAction({ type: GameActionType.Pass, player: 0 });
        expect(result, '行动玩家 Pass 应被接受').to.not.equal(null);
        expect(game.getActivePlayer()).to.equal(1);
        expect(game.isPlayerTurn(1)).to.equal(true);
        // 移交后原玩家再 Pass 被拒绝
        expect(
            game.handleAction({ type: GameActionType.Pass, player: 0 })
        ).to.equal(null);
    });

    it('每回合限下一次资源,非法资源类型被拒绝', () => {
        const game = startWithMulligans();
        // 非法类型
        expect(
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 0,
                resourceType: 'Bogus'
            })
        ).to.equal(null);

        // 合法下资源
        const before = game.getPlayer(0).getPool().getMaxNumeric();
        const result = game.handleAction({
            type: GameActionType.PlayResource,
            player: 0,
            resourceType: 'Growth'
        });
        expect(result, '下资源应被接受').to.not.equal(null);
        expect(game.getPlayer(0).getPool().getMaxNumeric()).to.equal(before + 1);

        // 本回合第二次下资源被拒绝
        expect(
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 0,
                resourceType: 'Growth'
            })
        ).to.equal(null);

        // 非行动玩家下资源同样被拒绝
        expect(
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 1,
                resourceType: 'Growth'
            })
        ).to.equal(null);
    });

    it('资源不足时不能出牌', () => {
        const game = startWithMulligans();
        const hand = game.getPlayer(0).getHand();
        // 本局卡组全部费用 >= 2,首回合能量 1,任意手牌都付不起
        const unaffordable = hand.find(
            card => card.getCost().getNumeric() >= 2
        );
        expect(unaffordable, '手牌中应有付不起的卡').to.not.equal(undefined);
        expect(
            game.handleAction({
                type: GameActionType.PlayCard,
                player: 0,
                id: unaffordable!.getId(),
                targetIds: []
            })
        ).to.equal(null);
        // 被拒绝的牌必须仍在手牌中(拒绝不得污染状态)
        expect(
            game.getPlayer(0).getHand().some(c => c.getId() === unaffordable!.getId())
        ).to.equal(true);
    });

    it('不能打出对手的手牌或不存在的卡', () => {
        const game = startWithMulligans();
        const opponentCard = game.getPlayer(1).getHand()[0];
        expect(
            game.handleAction({
                type: GameActionType.PlayCard,
                player: 0,
                id: opponentCard.getId(),
                targetIds: []
            })
        ).to.equal(null);
        expect(
            game.handleAction({
                type: GameActionType.PlayCard,
                player: 0,
                id: 'no-such-card-id',
                targetIds: []
            })
        ).to.equal(null);
        // 对手的手牌必须原封不动
        expect(
            game
                .getPlayer(1)
                .getHand()
                .some(c => c.getId() === opponentCard.getId())
        ).to.equal(true);
    });

    it('非战斗阶段不能宣攻,己方回合不能声明阻挡,无待选时选择被拒绝', () => {
        const game = startWithMulligans();
        expect(game.getPhase()).to.not.equal(GamePhase.Block);
        expect(
            game.handleAction({
                type: GameActionType.ToggleAttack,
                player: 0,
                unitId: 'no-such-unit'
            })
        ).to.equal(null);
        expect(
            game.handleAction({
                type: GameActionType.DeclareBlocker,
                player: 0,
                blockerId: 'no-such-unit',
                blockedId: null
            })
        ).to.equal(null);
        expect(
            game.handleAction({
                type: GameActionType.CardChoice,
                player: 0,
                ...KEEP_HAND
            })
        ).to.equal(null);
    });

    it('Quit 立即结束对局,对手获胜', () => {
        const game = startWithMulligans();
        expect(game.getWinner()).to.equal(-1);
        const result = game.handleAction({ type: GameActionType.Quit, player: 0 });
        expect(result).to.not.equal(null);
        expect(game.getWinner()).to.equal(1);
    });

    it('相同种子 + 相同动作序列产生完全相同的事件流(重放确定性)', () => {
        const script = (game: ServerGame) => {
            game.startGame();
            for (const player of [0, 1]) {
                game.handleAction({
                    type: GameActionType.CardChoice,
                    player,
                    ...KEEP_HAND
                });
            }
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 0,
                resourceType: 'Growth'
            });
            game.handleAction({ type: GameActionType.Pass, player: 0 });
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 1,
                resourceType: 'Decay'
            });
            game.handleAction({ type: GameActionType.Pass, player: 1 });
            game.handleAction({ type: GameActionType.Pass, player: 0 });
            game.handleAction({ type: GameActionType.Pass, player: 1 });
        };

        const a = newGame();
        const b = newGame();
        script(a);
        script(b);
        // 卡牌实例 id 由实例化时随机生成(与种子无关),归一化后对比:
        // 卡牌数据序列、阶段推进、资源颜色必须完全一致
        const normalize = (game: ServerGame) =>
            JSON.stringify((game as any).events).replace(
                /"id":"[a-f0-9]+"/g,
                '"id":"X"'
            );
        expect(normalize(a)).to.equal(normalize(b));
        // 确定性重放元数据:同一动作日志
        expect(JSON.stringify(a.getReplay().actions)).to.equal(
            JSON.stringify(b.getReplay().actions)
        );
    });
});

describe('DeckList 卡组构建规则', () => {
    it('同名卡超过上限时 addCard 拒绝', () => {
        const deck = new DeckList(standardFormat);
        const card = cardList
            .getCards()
            .find(c => c.getCardType() === CardType.Unit)!;
        for (let i = 0; i < standardFormat.maxCardsOfType; i++) {
            expect(deck.addCard(card)).to.equal(true);
        }
        expect(deck.addCard(card)).to.equal(false);
    });

    it('张数不足 40 的卡组不合法,40 张且同名 <=4 合法', () => {
        const full = buildDeck(cost => cost >= 2);
        expect(full.isValid()).to.equal(true);

        const short = new DeckList(standardFormat);
        const card = cardList
            .getCards()
            .find(c => c.getCardType() === CardType.Unit)!;
        for (let i = 0; i < 39; i++) {
            short.addCard(card);
        }
        expect(short.isValid()).to.equal(false);
    });
});
