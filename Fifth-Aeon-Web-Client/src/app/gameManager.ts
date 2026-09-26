import { Injectable, NgZone } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SpeedService } from 'app/speed.service';
import { every, sample } from 'lodash';
import { DamageDistributionDialogComponent } from './game/damage-distribution-dialog/damage-distribution-dialog.component';
import { OverlayService } from './game/overlay.service';
import { AI } from './game_model/ai/ai';
import { AIConstructor } from './game_model/ai/aiList';
import { DefaultAI } from './game_model/ai/defaultAi';
import { ClientGame } from './game_model/clientGame';
import { DeckList } from './game_model/deckList';
import { Card } from './game_model/card-types/card';
import { GameAction, GameActionType } from './game_model/events/gameAction';
import { GameSyncEvent, SyncEventType } from './game_model/events/syncEvent';
import { Game, GamePhase } from './game_model/game';
import { standardFormat } from './game_model/gameFormat';
import { Log } from './game_model/log';
import { Scenario } from './game_model/scenario';
import { ServerGame } from './game_model/serverGame';
import { Unit } from './game_model/card-types/unit';
import { MessageType, Messenger } from './messenger';
import { MessengerService } from './messenger.service';
import { SoundManager } from './sound';
import { TipService } from './tips';
import { aiManager } from './game_model/aiManager';
import { GameType } from './gameType';

@Injectable()
export class GameManager {
    private username = '';
    private opponentUsername = '';
    private deck: DeckList = new DeckList(standardFormat);
    private playerNumber = 0;
    private opponentNumber = 1;

    private game1: ClientGame | null = null;
    private game2: ClientGame | null = null;
    private gameModel: ServerGame | null = null;

    private ais: Array<AI> = [];
    private aisByPlayerNumber: Array<AI | null> = [];

    private log: Log | null = null;
    private onGameEnd: ((won: boolean, quit: boolean) => any) | null = null;
    private messenger: Messenger;
    private localMessenger: Messenger;

    private gameType: GameType = GameType.AiGame;

    /** 重放模式：整局历史事件回放期间只同步状态，不触发提示/音效/弹窗 */
    private replaying = false;

    constructor(
        private soundManager: SoundManager,
        private tips: TipService,
        private zone: NgZone,
        public dialog: MatDialog,
        private overlay: OverlayService,
        private speed: SpeedService,
        messengerService: MessengerService
    ) {
        this.startAiWithSpeed(1000);

        this.messenger = messengerService.getMessenger();
        this.messenger.addHandler(
            MessageType.GameEvent,
            msg => this.handleGameEvent(msg.data),
            this
        );
        this.messenger.addHandler(
            MessageType.GameEvents,
            msg => {
                const events = msg.data as GameSyncEvent[];
                events.forEach(e => this.handleGameEvent(e));
            },
            this
        );
        this.messenger.addHandler(
            MessageType.Connect,
            msg => this.handleP2PConnect(msg),
            this
        );
        this.messenger.addHandler(
            MessageType.Ping,
            () => { }, // Ignore
            this
        );
        this.messenger.addHandler(
            MessageType.SetDeck,
            msg => this.handleSetDeck(msg),
            this
        );
        this.messenger.addHandler( // Host receives actions from Joiner
            MessageType.GameAction,
            msg => {
                if (this.gameType === GameType.P2PHost) {
                    if (this.gameModel) {
                        const res = this.gameModel.handleAction(msg.data);
                        if (res) {
                            this.sendEventsToLocalPlayers(res);
                        }
                    }
                }
            },
            this
        );

        this.localMessenger = messengerService.getLocalMessenger();
        this.localMessenger.addHandler(MessageType.GameEvent, msg => {
            this.handleGameEvent(msg.data);
        });
        this.localMessenger.addHandler(MessageType.TransferScenario, msg => {
            const scenario = new Scenario(msg.data.scenario);
            if (this.game1) {
                scenario.apply(this.game1);
            }
        });

        this.setupAiManager();

        this.reset();
    }

    private setupAiManager() {
        const localStorageKey = 'ai-data';
        aiManager.save = data => localStorage.setItem(localStorageKey, JSON.stringify(data));

        const json = localStorage.getItem(localStorageKey);
        if (json) {
            aiManager.load(JSON.parse(json));
        }
    }

    public reset() {
        this.stopAI();
        this.game1 = null;
        this.game2 = null;
        this.gameModel = null;
        this.ais = [];
        this.replaying = false;
    }

    /**
     * 整局事件重放结束：恢复正常的提示/音效/动画副作用。
     * 若重放结束时的当前阶段正是需要本地玩家分配伤害的阶段，
     * 补弹分配窗口（历史中的分配阶段已被跳过）。
     */
    public finishReplay() {
        if (!this.replaying) {
            return;
        }
        this.replaying = false;
        console.log('[recovery] replay finished');
        const game = this.game1;
        if (
            game &&
            game.getPhase() === GamePhase.DamageDistribution &&
            game.isActivePlayer(this.playerNumber)
        ) {
            this.createDamageSelectors();
        }
    }

    private stopAI() {
        for (const ai of this.ais) {
            ai.stopActing();
        }
    }

    public startAiWithSpeed(ms: number) {
        for (const ai of this.ais) {
            ai.startActingDelayMode(ms, this.overlay.getAnimator());
        }
    }

    // Game Actions -------------------------------------------------------------------------
    public attackWithAll() {
        const game = this.game1;
        if (
            !game ||
            this.playerNumber !== game.getCurrentPlayer().getPlayerNumber()
        ) {
            return;
        }
        const potential = game
            .getCurrentPlayerUnits()
            .filter(unit => unit.canAttack());
        const allAttacking = every(potential, unit => unit.isAttacking());
        potential.forEach(unit => {
            if (allAttacking || !unit.isAttacking()) {
                game.declareAttacker(unit);
            }
        });
    }

    // Decks -----------------------------------------------------
    public setDeck(deck: DeckList) {
        this.deck = deck;
        this.p2pDeckConfirmed = true;
        this.checkP2PStart();
    }
    // ...


    public getDeck() {
        return this.deck;
    }

    // Action communication -------------------------------------

    private sendEventsToLocalPlayers(events: GameSyncEvent[]) {
        setTimeout(() => {
            // If we are P2P Host, we must relay events to the client
            if (this.gameType === GameType.P2PHost) {
                // Send all events in one batch to prevent ordering issues
                this.messenger.sendMessageToServer(MessageType.GameEvents, events);
            }

            for (const event of events) {
                for (const ai of this.ais) {
                    ai.handleGameEvent(event);
                }
                this.handleGameEvent(event);
            }
        }, 10);
    }

    private checkPriorityChange(event: GameSyncEvent) {
        if (!this.gameModel || !this.gameModel.canTakeAction()) {
            return;
        }
        if (
            event.type === SyncEventType.TurnStart ||
            event.type === SyncEventType.PhaseChange ||
            event.type === SyncEventType.ChoiceMade
        ) {
            const aiToSend = this.aisByPlayerNumber[
                this.gameModel.getActivePlayer()
            ];
            if (aiToSend) {
                aiToSend.onGainPriority();
            }
        }
    }

    private sendGameAction(action: GameAction, isAi: boolean = false) {
        if (this.gameType === GameType.PublicGame || this.gameType === GameType.P2PJoin) {
            this.messenger.sendMessageToServer(MessageType.GameAction, action);
            return;
        } else if (this.gameType === GameType.ServerAIGame) {
            if (this.localMessenger) {
                this.localMessenger.sendMessageToServer(
                    MessageType.GameAction,
                    action
                );
            }
            return;
        }

        if (!this.gameModel) {
            console.warn('Sent action to empty game model');
            return;
        }

        const res = this.gameModel.handleAction(action);
        if (res === null) {
            console.error(
                'An action sent to game model by',
                isAi ? 'the A.I' : 'the player',
                'failed.',
                'It was',
                GameActionType[action.type],
                'with',
                action
            );
            return;
        }
        this.sendEventsToLocalPlayers(res);
        // AI 局:每个动作落地后节流保存快照,供刷新后重放恢复
        this.saveAiSnapshot();
    }

    // Dialogs ----------------------------------------------------------
    public addBlockOverlay(blocker: string, blocked: string | null) {
        if (blocked === null) {
            this.overlay.removeBlocker(blocker);
            return;
        }
        const game = this.game1;
        if (
            game !== null &&
            game.getUnitById(blocker).getBlockedUnitId() !== null
        ) {
            this.overlay.removeBlocker(blocker);
        }
        this.overlay.addBlocker(blocker, blocked);
    }

    private openDamageSelector(attacker: Unit, defenders: Unit[]) {
        const config = new MatDialogConfig();
        config.disableClose = true;
        const dialogRef = this.dialog.open(
            DamageDistributionDialogComponent,
            config
        );

        dialogRef.componentInstance.attacker = attacker;
        dialogRef.componentInstance.defenders = defenders;

        return dialogRef
            .afterClosed()
            .toPromise()
            .then((order: Unit[]) => {
                const game = this.game1;
                if (!game) {
                    throw new Error('Game has not started.');
                }
                game.setAttackOrder(attacker, order);
            });
    }

    private createDamageSelectors() {
        const playerGame = this.game1;
        if (!playerGame) {
            throw new Error('Games not in progress');
        }
        const orderables = Array.from(
            playerGame.getModableDamageDistributions().entries()
        ).map(entry => {
            return {
                attacker: playerGame.getUnitById(entry[0]),
                blockers: entry[1]
            };
        });
        const runNext = () => {
            if (orderables.length === 0) {
                playerGame.pass();
                return;
            }
            const next = orderables.pop();
            if (next) {
                this.openDamageSelector(next.attacker, next.blockers).then(
                    runNext
                );
            }
        };
        runNext();
    }

    private handleGameEvent(event: GameSyncEvent) {
        const playerGame = this.game1;
        if (!playerGame) {
            throw new Error('Games not in progress');
        }

        // 重放历史事件：只同步状态，跳过提示/音效/动画弹窗等副作用
        if (this.replaying) {
            this.zone.run(() =>
                playerGame.syncServerEvent(this.playerNumber, event)
            );
            return;
        }

        // The game is being controlled by the player, so display tips and update the game state
        // (otherwise the A.I will manage this so we needn't bother)
        if (this.ais.length < 2) {
            this.zone.run(() =>
                playerGame.syncServerEvent(this.playerNumber, event)
            );
            this.tips.handleGameEvent(playerGame, this.playerNumber, event);
        }

        if (this.ais.length > 0) {
            this.checkPriorityChange(event);
        }

        this.soundManager.handleGameEvent(event);
        switch (event.type) {
            case SyncEventType.TurnStart:
                if (event.turn !== this.playerNumber) {
                    return;
                }
                break;
            case SyncEventType.EnchantmentModified:
                const avatar =
                    playerGame.getCurrentPlayer().getPlayerNumber() ===
                        this.playerNumber
                        ? 'player'
                        : 'enemy';
                this.overlay.addInteractionArrow(avatar, event.enchantmentId);
                break;
            case SyncEventType.Block:
                this.addBlockOverlay(event.blockerId, event.blockedId);
                break;
            case SyncEventType.PhaseChange:
                if (
                    event.phase === GamePhase.DamageDistribution &&
                    playerGame.isActivePlayer(this.playerNumber)
                ) {
                    this.createDamageSelectors();
                }
                if (event.phase === GamePhase.Play2) {
                    this.overlay.clearBlockers();
                }
                break;
            case SyncEventType.PlayCard:
                this.overlay.onPlay(
                    playerGame.getCardById(event.played.id),
                    playerGame,
                    this.playerNumber
                );
                break;
            case SyncEventType.Ended:
                this.endGame(event.winner, event.quit);
                break;
        }
    }

    public getGame(): ClientGame | null {
        return this.game1;
    }

    public getPlayerData() {
        return {
            me: this.playerNumber,
            op: this.opponentNumber
        };
    }

    public setUsername(username: string) {
        this.username = username;
    }

    public getUsername() {
        return this.username;
    }

    public getOpponentUsername() {
        return this.opponentUsername;
    }

    public setGameEndCallback(
        newCallback: (won: boolean, quit: boolean) => any
    ) {
        this.onGameEnd = newCallback;
    }

    public getLog() {
        return this.log;
    }

    public isInputEnabled() {
        return this.ais.length < 2;
    }

    // Game Life cycle ------------------------------------------------

    /** Invoked when the game ends (because a player won) */
    private endGame(winner: number, quit: boolean) {
        const playerWon = winner === this.playerNumber;
        this.stopAI();
        this.overlay
            .getAnimator()
            .awaitAnimationEnd()
            .then(() => {
                aiManager.recordGameResult(playerWon);
                if (this.onGameEnd) {
                    this.onGameEnd(playerWon, quit);
                } else {
                    console.warn('No Game end callback');
                }
            });

        this.soundManager
            .playImportantSound(playerWon ? 'fanfare' : 'defeat')
            .then(() => {
                if (!this.gameModel) {
                    this.soundManager.setFactionContext(new Set());
                }
            });
    }

    /** Invoked when we quit the game (before its over) */
    public exitGame() {
        this.sendGameAction({
            type: GameActionType.Quit,
            player: this.playerNumber
        });
    }

    /** 当前是否为纯本地对局(AI/双 AI),不经服务器 */
    public isLocalGame(): boolean {
        return (
            this.gameType === GameType.AiGame ||
            this.gameType === GameType.DoubleAiGame
        );
    }

    /** Starts a multiplayer game */
    public startMultiplayerGame(
        playerNumber: number,
        opponentName: string,
        replay = false
    ) {
        this.gameType = GameType.PublicGame;
        this.replaying = replay;
        this.soundManager.setFactionContext(this.deck.getColors());
        this.ais = [];
        this.gameModel = null;
        this.playerNumber = playerNumber;
        this.opponentNumber = 1 - this.playerNumber;

        this.log = new Log(this.playerNumber);

        this.game1 = new ClientGame(
            'player',
            (_, action) => this.sendGameAction(action, false),
            this.overlay.getAnimator(),
            this.log
        );

        this.game1.enableAnimations();
        this.game1.setOwningPlayer(this.playerNumber);

        this.soundManager.playImportantSound('gong');
        this.zone.run(() => {
            this.opponentUsername = opponentName;
        });
    }

    public async startAiServerGame() {
        this.gameType = GameType.ServerAIGame;
        this.playerNumber = Math.random() > 0.5 ? 1 : 0;
        this.opponentNumber = 1 - this.playerNumber;
        this.localMessenger.sendMessageToServer(MessageType.StartGame, {
            playerNumber: this.opponentNumber,
            deck: this.deck.getSavable()
        });

        this.soundManager.setFactionContext(this.deck.getColors());
        this.ais = [];
        this.gameModel = null;

        this.log = new Log(this.playerNumber);

        this.game1 = new ClientGame(
            'player',
            (_, action) => this.sendGameAction(action, false),
            this.overlay.getAnimator(),
            this.log
        );
        this.game1.setOwningPlayer(this.playerNumber);
        this.game1.enableAnimations();

        this.soundManager.playImportantSound('gong');
        this.zone.run(() => {
            this.opponentUsername = 'Server A.I';
        });
    }

    public startAIGame(aiCount = 1, scenario?: Scenario) {
        this.soundManager.setFactionContext(this.deck.getColors());
        this.reset();
        ServerGame.setSeed(new Date().getTime());

        // The player always goes first vs the A.I
        this.playerNumber = 0;
        this.opponentNumber = 1;
        this.log = new Log(this.playerNumber);

        const matchup = aiManager.getLeveledOpponent();
        const aiDeck = matchup.deck;

        this.setupAiGame(matchup.ai, aiDeck);
        this.clearAiSnapshot();

        // scenario = tutorialCampaign[0];
        if (scenario && this.gameModel && this.game1 && this.game2) {
            this.applyScenario(scenario, [
                this.gameModel,
                this.game1,
                this.game2
            ]);
        }

        this.zone.run(() => {
            this.opponentUsername = aiDeck.name;
            if (this.gameModel) {
                this.sendEventsToLocalPlayers(this.gameModel.startGame());
            }
            this.startAiWithSpeed(this.speed.speeds.aiTick);
        });
    }

    /**
     * AI 对局公共装配:权威端 + 双方镜像(供开局与快照恢复共用)。
     * 调用前需设置 playerNumber/opponentNumber/log,并完成 reset()。
     */
    private setupAiGame(aiCtor: AIConstructor, aiDeck: DeckList) {
        this.gameType = GameType.AiGame;
        this.gameModel = new ServerGame('server', standardFormat, [
            this.deck,
            aiDeck
        ]);
        const log = this.log === null ? undefined : this.log;
        this.game1 = new ClientGame(
            'player',
            (_, action) => this.sendGameAction(action, false),
            this.overlay.getAnimator(),
            log
        );
        this.game1.setOwningPlayer(this.playerNumber);
        this.game1.enableAnimations();
        this.game2 = new ClientGame(
            'ai',
            (_, action) => this.sendGameAction(action, true),
            this.overlay.getAnimator()
        );
        this.game2.setOwningPlayer(this.opponentNumber);

        const newAI = new aiCtor(this.opponentNumber, this.game2, aiDeck);
        this.ais.push(newAI);
        this.aisByPlayerNumber = [null, newAI];
    }

    // ---- AI 局快照(刷新恢复)--------------------------------------
    // 引擎的 getReplay() 导出 {seed, actionLog, deckLists}:种子决定洗牌,
    // 逐条重放动作日志即可完整重建对局(历史重放不经过 AI 决策,
    // EasyAI 的评估噪声不影响还原)。快照存 localStorage,节流写入。

    private static readonly AI_SNAPSHOT_KEY = 'fa-ai-snapshot';
    private aiSnapshotDirty = false;
    private aiSnapshotTimer: any = null;

    private saveAiSnapshot() {
        if (this.gameType !== GameType.AiGame || !this.gameModel) {
            return;
        }
        try {
            // 同步立即写:快照几十 KB,localStorage 写入 ~1ms,
            // 保证刷新恢复点与真实状态零偏差(节流会丢失最后几秒的 AI 动作)
            const snapshot = {
                replay: this.gameModel.getReplay(),
                difficulty: aiManager.getConcreteDifficulty(),
                savedAt: Date.now()
            };
            localStorage.setItem(
                GameManager.AI_SNAPSHOT_KEY,
                JSON.stringify(snapshot)
            );
        } catch (e) {
            // 快照失败不影响对局(存储满/序列化异常)
        }
    }

    public hasAiSnapshot(): boolean {
        try {
            return !!localStorage.getItem(GameManager.AI_SNAPSHOT_KEY);
        } catch (e) {
            return false;
        }
    }

    public clearAiSnapshot() {
        try {
            localStorage.removeItem(GameManager.AI_SNAPSHOT_KEY);
        } catch (e) {
            // 忽略
        }
        this.aiSnapshotDirty = false;
        if (this.aiSnapshotTimer) {
            clearTimeout(this.aiSnapshotTimer);
            this.aiSnapshotTimer = null;
        }
    }

    /**
     * 从快照恢复 AI 对局(刷新后由 InPlayGuard 调用)。
     * 成功:重建权威端并重放全部动作,恢复镜像与 AI,返回 true;
     * 失败(快照缺失/损坏/重放异常):清除快照并返回 false。
     */
    public restoreAIGame(): boolean {
        try {
            const raw = localStorage.getItem(GameManager.AI_SNAPSHOT_KEY);
            if (!raw) {
                console.warn('[ai-restore] no snapshot');
                return false;
            }
            const snapshot = JSON.parse(raw);
            const replay = snapshot.replay;
            if (
                !replay ||
                !Array.isArray(replay.actions) ||
                !replay.deckLists
            ) {
                console.warn(
                    '[ai-restore] bad snapshot shape',
                    Object.keys(snapshot),
                    Object.keys(replay || {})
                );
                this.clearAiSnapshot();
                return false;
            }
            console.log(
                '[ai-restore] replaying',
                replay.actions.length,
                'actions, seed',
                replay.seed
            );
            const decks = replay.deckLists.map((saved: any) => {
                const d = new DeckList(standardFormat);
                d.fromSavable(saved);
                return d;
            });
            this.soundManager.setFactionContext(decks[0].getColors());
            this.reset();
            ServerGame.setSeed(replay.seed);
            this.playerNumber = 0;
            this.opponentNumber = 1;
            this.log = new Log(this.playerNumber);
            this.deck = decks[0];
            const ctor = aiManager.getLeveledAIFor(snapshot.difficulty);
            console.log('[ai-restore] ctor:', String(ctor), 'difficulty:', snapshot.difficulty);
            this.setupAiGame(ctor, decks[1]);
            if (!this.gameModel || !this.game1 || !this.game2) {
                this.clearAiSnapshot();
                return false;
            }
            const gameModel = this.gameModel;

            // 原局的挂起选择(调度/弃牌)用"回调式应答"精确重放:
            // 不经 handleAction/CardChoice(避免与重放循环交错),
            // 直接以原局的回答推进权威状态,事件由 startGame/动作本身产生。
            // 确定性 id 保证原局的 choice ids 在重放实例上有效。
            const savedChoices = replay.actions.filter(
                (action: any) => action.type === GameActionType.CardChoice
            );
            gameModel.promptCardChoice = (
                player: number,
                options: Card[],
                min: number,
                max: number,
                callback: ((cards: Card[]) => void) | null
            ) => {
                if (!callback) {
                    return;
                }
                const saved = savedChoices.find(
                    (action: any) => action.player === player
                );
                if (saved && saved.choice) {
                    const picked = options.filter(option =>
                        saved.choice.includes(option.getId())
                    );
                    if (picked.length >= Math.min(min, options.length)) {
                        callback(picked);
                        return;
                    }
                }
                // 无原局回答(如 AI 的选择)时按费用排序兜底
                callback(
                    [...options]
                        .sort(
                            (a, b) =>
                                b.getCost().getNumeric() -
                                a.getCost().getNumeric()
                        )
                        .slice(
                            0,
                            Math.max(min, Math.min(max, options.length))
                        )
                );
            };

            // 线性收集全部事件:startGame + 每个动作(跳过已消化的选择)
            const allEvents: GameSyncEvent[] = [];
            allEvents.push(...gameModel.startGame());
            for (const action of replay.actions) {
                if (action.type === GameActionType.CardChoice) {
                    continue;
                }
                const events = gameModel.handleAction(action);
                if (events) {
                    allEvents.push(...events);
                }
            }

            // 单一应用循环:中立视角(-1)让全部事件无差别应用到两个镜像
            // (正常同步会跳过"自己"的动作以防乐观重复,但刷新后镜像
            // 没有乐观状态,跳过会丢失自己的资源/手牌历史)。
            const c38check = allEvents
                .filter(e => JSON.stringify(e).includes('c38'))
                .map(e => ({ t: e.type, n: e.number }));
            console.log(
                '[ai-restore] events mentioning c38:',
                JSON.stringify(c38check)
            );
            console.log(
                '[ai-restore] allEvents numbers:',
                JSON.stringify(
                    allEvents.map(e => e.number)
                )
            );
            this.replaying = true;
            const restorePlayerNumber = this.playerNumber;
            const aiPlayerNumber = this.ais[0].getPlayerNumber();
            this.playerNumber = -1;
            (this.ais[0] as any).playerNumber = -1;
            for (const event of allEvents) {
                for (const ai of this.ais) {
                    ai.handleGameEvent(event);
                }
                this.handleGameEvent(event);
            }
            this.playerNumber = restorePlayerNumber;
            (this.ais[0] as any).playerNumber = aiPlayerNumber;
            this.replaying = false;
            this.finishReplay();

            this.zone.run(() => {
                this.opponentUsername = decks[1].name;
                this.startAiWithSpeed(this.speed.speeds.aiTick);
            });
            return true;
        } catch (e) {
            console.error('AI 对局恢复失败', e);
            this.clearAiSnapshot();
            this.reset();
            return false;
        }
    }

    private applyScenario(scenario: Scenario, games: Array<Game>) {
        games.forEach(game => {
            scenario.apply(game);
        });
    }

    private handleP2PConnect(msg: any) {
        // When we receive a Connect message in P2P, it means the other peer is ready.
        console.log('P2P Connect received', msg);
    }

    public startP2PBackendGame(isHost: boolean) {
        this.gameType = isHost ? GameType.P2PHost : GameType.P2PJoin;
        this.playerNumber = isHost ? 0 : 1;
        this.opponentNumber = 1 - this.playerNumber;
        this.opponentDeck = null; // Reset opponent deck
        this.p2pDeckConfirmed = false;
    }

    private opponentDeck: DeckList | null = null;
    private p2pDeckConfirmed = false;

    private handleSetDeck(msg: any) {
        if (this.gameType === GameType.P2PHost) {
            // Host receives deck from Joiner
            console.log('Host received opponent deck', msg);
            this.opponentDeck = new DeckList();
            this.opponentDeck.fromJson(msg.data.deckList);

            this.checkP2PStart();
        } else if (this.gameType === GameType.P2PJoin) {
            // Joiner receives deck from Host
            console.log('Joiner received opponent deck', msg);
            this.opponentDeck = new DeckList();
            this.opponentDeck.fromJson(msg.data.deckList);
        }
    }

    private checkP2PStart() {
        if (this.gameType === GameType.P2PHost && this.p2pDeckConfirmed && this.deck && this.opponentDeck && !this.gameModel) {
            this.startP2PGameSession();
        }
    }

    public onP2PGameStarted: () => void = () => { };

    private startP2PGameSession() {
        console.log('Starting P2P Game Session as Host');
        // Initialize ServerGame
        ServerGame.setSeed(new Date().getTime());
        // Host is 0, Joiner is 1
        this.gameModel = new ServerGame('server', standardFormat, [
            this.deck,
            this.opponentDeck!
        ]);

        this.ais = [];
        this.log = new Log(this.playerNumber);

        // Host Game (Client Side)
        this.game1 = new ClientGame(
            'player',
            (_, action) => this.sendGameAction(action, false),
            this.overlay.getAnimator(),
            this.log
        );
        this.game1.setOwningPlayer(this.playerNumber);
        this.game1.enableAnimations();

        this.soundManager.setFactionContext(this.deck.getColors());
        this.soundManager.playImportantSound('gong');

        this.zone.run(() => {
            this.opponentUsername = 'Remote Opponent';
            if (this.gameModel) {
                const events = this.gameModel.startGame();
                this.sendEventsToLocalPlayers(events);

                this.messenger.sendMessageToServer(MessageType.StartGame, {
                    playerNumber: this.opponentNumber,
                    opponent: this.username
                });

                this.onP2PGameStarted();
            }
        });
    }
}
