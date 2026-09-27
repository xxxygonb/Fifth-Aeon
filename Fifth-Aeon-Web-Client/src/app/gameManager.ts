import { Injectable, NgZone } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { SpeedService } from 'app/speed.service';
import { every, sample } from 'lodash';
import { CardChooserComponent } from './game/card-chooser/card-chooser.component';
import { DamageDistributionDialogComponent } from './game/damage-distribution-dialog/damage-distribution-dialog.component';
import { OverlayService } from './game/overlay.service';
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
import { AiGameService } from './ai-game.service';
import { log } from './logger';

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
        private aiGame: AiGameService,
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

        this.aiGame.setupPersistence();

        this.reset();
    }

    public reset() {
        this.aiGame.reset();
        this.game1 = null;
        this.game2 = null;
        this.gameModel = null;
        this.replaying = false;
    }

    /**
     * 整局事件重放结束：恢复正常的提示/音效/动画副作用。
     * 若重放结束时的当前阶段正是需要本地玩家分配伤害的阶段，
     * 补弹分配窗口（历史中的分配阶段已被跳过）。
     * 若仍有本地玩家的选择未应答（刷新发生在选择弹窗打开期间，
     * 历史中没有对应的 ChoiceMade 事件），重新弹出选择窗口。
     */
    public finishReplay() {
        if (!this.replaying) {
            return;
        }
        this.replaying = false;
        log.debug('recovery: replay finished');
        const game = this.game1;
        if (!game) {
            return;
        }
        game.setReplaying(false);
        this.reopenPendingChoiceIfNeeded();
        if (
            !this.dialog.openDialogs.some(
                d => d.componentInstance instanceof CardChooserComponent
            ) &&
            game.getPhase() === GamePhase.DamageDistribution &&
            game.isActivePlayer(this.playerNumber)
        ) {
            this.createDamageSelectors();
        }
    }

    /**
     * 若存在本地玩家未应答的选择则重开选择窗口。
     * finishReplay 与 GameComponent 构造(晚于重放完成时)都会调用;
     * 以"已有选择窗口打开"去重,避免双开。
     */
    public reopenPendingChoiceIfNeeded() {
        const game = this.game1;
        if (!game) {
            return;
        }
        if (
            this.dialog.openDialogs.some(
                d => d.componentInstance instanceof CardChooserComponent
            )
        ) {
            return;
        }
        const pending = game.getPendingChoice(this.playerNumber);
        if (!pending) {
            return;
        }
        log.debug('recovery: reopening pending choice');
        const config = new MatDialogConfig();
        config.disableClose = true;
        config.maxWidth = '95vw';
        const dialogRef = this.dialog.open(CardChooserComponent, config);
        dialogRef.componentInstance.cards = Array.from(pending.validCards);
        dialogRef.componentInstance.min = pending.min;
        dialogRef.componentInstance.max = pending.max;
        dialogRef.componentInstance.setPage();
        dialogRef.afterClosed().subscribe((result: Card[] | undefined) => {
            game.makeChoice(this.playerNumber, result || []);
        });
    }

    public isReplaying(): boolean {
        return this.replaying;
    }

    public startAiWithSpeed(ms: number) {
        this.aiGame.startWithSpeed(ms, this.overlay.getAnimator());
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

            this.aiGame.feedEvents(events);
            for (const event of events) {
                this.handleGameEvent(event);
            }
        }, 10);
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
            log.warn('Sent action to empty game model');
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

        // 时序守卫:事件号必须与期望的下一个事件号一致。不一致说明这是
        // 重复的恢复事件批(双通道恢复)或已处理过的事件,整体忽略,
        // 既防状态被二次应用,也防陈旧事件触发提示/音效/结算弹窗。
        if (event.number !== playerGame.getExpectedEventNumber()) {
            console.warn(
                '[recovery] skipping out-of-order event',
                event.number,
                'expected',
                playerGame.getExpectedEventNumber()
            );
            return;
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
        if (this.aiGame.count() < 2) {
            this.zone.run(() =>
                playerGame.syncServerEvent(this.playerNumber, event)
            );
            this.tips.handleGameEvent(playerGame, this.playerNumber, event);
        }

        if (this.aiGame.count() > 0) {
            this.aiGame.notifyPriority(event, this.gameModel);
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
        return this.aiGame.count() < 2;
    }

    // Game Life cycle ------------------------------------------------

    /** Invoked when the game ends (because a player won) */
    private endGame(winner: number, quit: boolean) {
        const playerWon = winner === this.playerNumber;
        this.aiGame.stop();
        this.overlay
            .getAnimator()
            .awaitAnimationEnd()
            .then(() => {
                this.aiGame.recordResult(playerWon);
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
        // 登录恢复与路由守卫都会请求 ResendGame,可能连续重放两局;
        // 重建前关掉旧局遗留的选择窗口,避免弹窗指向过期的游戏实例
        this.dialog.openDialogs
            .filter(d => d.componentInstance instanceof CardChooserComponent)
            .forEach(d => d.close());
        this.gameType = GameType.PublicGame;
        this.markGameMode('multiplayer');
        this.replaying = replay;
        this.soundManager.setFactionContext(this.deck.getColors());
        this.aiGame.reset();
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
        // 重放恢复:同步处理器需要应用本地玩家自己的事件(见 ClientGame.setReplaying)
        this.game1.setReplaying(replay);

        this.soundManager.playImportantSound('gong');
        this.zone.run(() => {
            this.opponentUsername = opponentName;
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
        this.markGameMode('local');

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
     * 对局模式标记:刷新后路由守卫据此决定恢复策略。
     * 联机局 → 请求服务器重发对局;本地局(AI/P2P) → 直接回大厅。
     */
    private markGameMode(mode: 'multiplayer' | 'local') {
        try {
            localStorage.setItem('fa-game-mode', mode);
        } catch (e) {
            // 忽略存储异常
        }
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

        // AI 实例/事件喂养/克隆器注入 → AiGameService(B2)
        this.aiGame.assembleAI({
            aiCtor,
            aiDeck,
            opponentNumber: this.opponentNumber,
            mirror: this.game2,
            authoritative: this.gameModel
        });
    }

    private applyScenario(scenario: Scenario, games: Array<Game>) {
        games.forEach(game => {
            scenario.apply(game);
        });
    }

    private handleP2PConnect(msg: any) {
        // When we receive a Connect message in P2P, it means the other peer is ready.
        log.debug('P2P Connect received', msg);
    }

    public startP2PBackendGame(isHost: boolean) {
        this.gameType = isHost ? GameType.P2PHost : GameType.P2PJoin;
        this.markGameMode('local');
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
            log.debug('Host received opponent deck', msg);
            this.opponentDeck = new DeckList();
            this.opponentDeck.fromJson(msg.data.deckList);

            this.checkP2PStart();
        } else if (this.gameType === GameType.P2PJoin) {
            // Joiner receives deck from Host
            log.debug('Joiner received opponent deck', msg);
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
        log.debug('Starting P2P Game Session as Host');
        // Initialize ServerGame
        ServerGame.setSeed(new Date().getTime());
        // Host is 0, Joiner is 1
        this.gameModel = new ServerGame('server', standardFormat, [
            this.deck,
            this.opponentDeck!
        ]);

        this.aiGame.reset();
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
