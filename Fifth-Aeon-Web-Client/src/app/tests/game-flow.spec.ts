import { ServerGame } from '../game_model/serverGame';
import { ClientGame } from '../game_model/clientGame';
import { GameActionType } from '../game_model/events/gameAction';
import { standardFormat } from '../game_model/gameFormat';
import { DeckList } from '../game_model/deckList';
import { deckMap } from '../game_model/scenarios/decks';
import { GamePhase } from '../game_model/game';
import { Animator } from '../game_model/animator';
import { cardList } from '../game_model/cards/cardList';

/**
 * 核心规则引擎回归测试:
 *  - 开局发牌与调度(mulligan)
 *  - 回合流转(TurnStart 事件显式驱动)
 *  - 末回合弃牌不推进镜像回合
 *  - 权威端与客户端镜像的重放一致性
 *  - 令牌 id 前缀
 */

function makeDeck(name: string): DeckList {
    const source = deckMap.get(name) as DeckList;
    return new DeckList(standardFormat, source.getSavable());
}

function makeModel(): ServerGame {
    ServerGame.setSeed(20260926);
    return new ServerGame('test', standardFormat, [
        makeDeck('marchOfUndeath'),
        makeDeck('theMeek')
    ]);
}

function collect(game: ServerGame, events: any[], action: any): void {
    const produced = game.handleAction(action);
    if (produced) {
        events.push(...produced);
    }
}

function makeMirror(): ClientGame {
    return new ClientGame('mirror', () => null, new Animator());
}

describe('规则引擎:开局与调度', () => {
    it('开局双方各 4 张手牌,调度提示挂起', () => {
        const game = makeModel();
        game.startGame();
        expect(game.getPlayer(0).getHand().length).toBe(4);
        expect(game.getPlayer(1).getHand().length).toBe(4);
        expect(game.getPendingChoice(0)).toBeTruthy();
        expect(game.getPendingChoice(1)).toBeTruthy();
    });

    it('调度应答后清除挂起并产生替换抽牌', () => {
        const game = makeModel();
        const events = [...game.startGame()];
        const drawsBefore = events.filter(e => e.type === 6).length;
        collect(game, events, {
            type: GameActionType.CardChoice,
            player: 0,
            choice: []
        });
        expect(game.getPendingChoice(0)).toBeNull();
        // 调度应答本身的 ChoiceMade 事件
        const newEvents = events.slice(drawsBefore);
        expect(newEvents.some(e => e.type === 7)).toBe(true);
    });

    it('调度中资源与 pass 会被拒绝(等待选择)', () => {
        const game = makeModel();
        game.startGame();
        const rejected =
            game.handleAction({
                type: GameActionType.PlayResource,
                player: 0,
                resourceType: 'Growth'
            } as any) === null;
        expect(rejected).toBe(true);
    });
});

describe('规则引擎:回合流转(事件驱动)', () => {
    it('出资源+pass 后推进到对方回合并产生 TurnStart', () => {
        const game = makeModel();
        const events = [...game.startGame()];
        collect(game, events, {
            type: GameActionType.CardChoice,
            player: 0,
            choice: []
        });
        collect(game, events, {
            type: GameActionType.CardChoice,
            player: 1,
            choice: []
        });
        const turnNumBefore = (game as any).turnNum;
        collect(game, events, {
            type: GameActionType.PlayResource,
            player: 0,
            resourceType: 'Growth'
        });
        collect(game, events, { type: GameActionType.Pass, player: 0 });
        expect((game as any).turnNum).toBe(turnNumBefore + 1);
        expect((game as any).turn).toBe(1);
        expect(game.getPhase()).toBe(GamePhase.Play1);
        const lastTurnStart = [...events]
            .reverse()
            .find(e => e.type === 1);
        expect(lastTurnStart).toBeTruthy();
        expect((lastTurnStart as any).turnNum).toBe(turnNumBefore + 1);
    });

    it('末回合弃牌:提示挂起、应答后移除并推进回合', () => {
        const game = makeModel();
        const events = [...game.startGame()];
        collect(game, events, {
            type: GameActionType.CardChoice,
            player: 0,
            choice: []
        });
        collect(game, events, {
            type: GameActionType.CardChoice,
            player: 1,
            choice: []
        });
        // 连续 pass 数回合,直到任一玩家手牌超过软上限(8)触发末回合弃牌
        let pendingPlayer = -1;
        let guard = 0;
        while (pendingPlayer === -1 && guard++ < 12) {
            for (const p of [0, 1]) {
                collect(game, events, {
                    type: GameActionType.PlayResource,
                    player: p,
                    resourceType: 'Growth'
                });
                collect(game, events, { type: GameActionType.Pass, player: p });
                if (game.getPendingChoice(p)) {
                    pendingPlayer = p;
                    break;
                }
            }
        }
        expect(pendingPlayer).not.toBe(-1);
        const handBefore = game.getPlayer(pendingPlayer).getHand().length;
        const turnNumAtPrompt = (game as any).turnNum;
        const pending = game.getPendingChoice(pendingPlayer) as any;
        const min = Math.min(pending.validCards.size, pending.min);
        const chosen = [...pending.validCards].slice(0, min);
        collect(game, events, {
            type: GameActionType.CardChoice,
            player: pendingPlayer,
            choice: chosen.map(c => c.getId())
        });
        expect(game.getPendingChoice(pendingPlayer)).toBeNull();
        expect(game.getPlayer(pendingPlayer).getHand().length)
            .toBe(handBefore - chosen.length);
        // 弃牌应答后才推进回合
        expect((game as any).turnNum).toBe(turnNumAtPrompt + 1);
    });

    describe('规则引擎:客户端镜像重放一致性', () => {
        function buildFinishedLog() {
            const game = makeModel();
            const events = [...game.startGame()];
            collect(game, events, {
                type: GameActionType.CardChoice,
                player: 0,
                choice: []
            });
            collect(game, events, {
                type: GameActionType.CardChoice,
                player: 1,
                choice: []
            });
            collect(game, events, {
                type: GameActionType.PlayResource,
                player: 0,
                resourceType: 'Growth'
            });
            collect(game, events, { type: GameActionType.Pass, player: 0 });
            collect(game, events, {
                type: GameActionType.PlayResource,
                player: 1,
                resourceType: 'Growth'
            });
            collect(game, events, { type: GameActionType.Pass, player: 1 });
            return { game, events };
        }

        it('中立视角重放后镜像与权威端状态一致', () => {
            const { game, events } = buildFinishedLog();
            const mirror = makeMirror();
            events.forEach(e => mirror.syncServerEvent(-1, e));
            expect((mirror as any).turn).toBe((game as any).turn);
            expect((mirror as any).turnNum).toBe((game as any).turnNum);
            expect(mirror.getPhase()).toBe(game.getPhase());
            expect(mirror.canTakeAction()).toBe(game.canTakeAction());
            for (const p of [0, 1]) {
                const modelHand = game
                    .getPlayer(p)
                    .getHand()
                    .map(c => c.getId());
                const mirrorHand = mirror
                    .getPlayer(p)
                    .getHand()
                    .map(c => c.getId());
                expect(mirrorHand).toEqual(modelHand);
            }
            expect(mirror.getExpectedCards()).toBe(0);
        });

        it('弃牌提示在镜像上挂起后由 ChoiceMade 事件消解', () => {
            const game = makeModel();
            const events = [...game.startGame()];
            collect(game, events, {
                type: GameActionType.CardChoice,
                player: 0,
                choice: []
            });
            collect(game, events, {
                type: GameActionType.CardChoice,
                player: 1,
                choice: []
            });
            let pendingPlayer = -1;
            let endIndex = -1;
            let guard = 0;
            while (pendingPlayer === -1 && guard++ < 12) {
                for (const p of [0, 1]) {
                    collect(game, events, {
                        type: GameActionType.PlayResource,
                        player: p,
                        resourceType: 'Growth'
                    });
                    collect(game, events, { type: GameActionType.Pass, player: p });
                    if (game.getPendingChoice(p)) {
                        pendingPlayer = p;
                        endIndex = events.length - 1;
                        break;
                    }
                }
            }
            expect(pendingPlayer).not.toBe(-1);
            const handBefore = game.getPlayer(pendingPlayer).getHand().length;
            const pending = game.getPendingChoice(pendingPlayer) as any;
            const min = Math.min(pending.validCards.size, pending.min);
            const chosen = [...pending.validCards].slice(0, min);

            const mirror = makeMirror();
            // 重放到弃牌提示出现为止:镜像应重建挂起提示
            events.slice(0, endIndex + 1).forEach(e => mirror.syncServerEvent(-1, e));
            expect(mirror.getPendingChoice(pendingPlayer)).toBeTruthy();
            const turnNumAtPrompt = (mirror as any).turnNum;

            // 模型侧应答弃牌,产生 ChoiceMade + TurnStart + Draw 事件
            collect(game, events, {
                type: GameActionType.CardChoice,
                player: pendingPlayer,
                choice: chosen.map(c => c.getId())
            });

            // 镜像重放剩余事件:提示消解、手牌移除、回合推进
            events.slice(endIndex + 1).forEach(e => mirror.syncServerEvent(-1, e));
            expect(mirror.getPendingChoice(pendingPlayer)).toBeNull();
            expect(mirror.getPlayer(pendingPlayer).getHand().length)
                .toBe(handBefore - chosen.length);
            expect((mirror as any).turnNum).toBe(turnNumAtPrompt + 1);
            expect(mirror.getExpectedCards()).toBe(0);
        });

        it('镜像不重复推进回合(弃牌回调不含 nextTurn)', () => {
            const { game, events } = buildFinishedLog();
            const mirror = makeMirror();
            events.forEach(e => mirror.syncServerEvent(-1, e));
            const turnStarts = events.filter(e => e.type === 1).length;
            expect((mirror as any).turnNum).toBe(turnStarts);
            expect((game as any).turnNum).toBe(turnStarts);
        });
    });
});

describe('规则引擎:令牌 id', () => {
    it('生成的单位 id 带 tN 前缀', () => {
        const game = makeModel();
        game.startGame();
        const counter = (game as any).generatedCardId as number;
        const token = game.playGeneratedUnit(0, cardList.getCard('Skeleton'));
        expect(token.getId()).toBe('t' + counter);
        const token2 = game.playGeneratedUnit(1, cardList.getCard('Skeleton'));
        expect(token2.getId()).toBe('t' + (counter + 1));
    });
});
