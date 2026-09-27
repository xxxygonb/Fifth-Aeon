import { Injectable, NgZone } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Hotkey, HotkeysService } from 'angular2-hotkeys';
import { CollectionService } from 'app/collection.service';
import { EndDialogComponent } from './end-dialog/end-dialog.component';
import { GameManager } from './gameManager';
import { DeckList } from './game_model/deckList';
import { Message, MessageType, Messenger } from './messenger';
import { MessengerService } from './messenger.service';
import { Preloader } from './preloader';
import { SoundManager } from './sound';
import { TipService, TipType } from './tips';
import { I18nService } from './i18n/i18n.service';
import { AuthenticationService, UserData } from './user/authentication.service';
import { SettingsDialogComponent } from './settings/settings-dialog/settings-dialog.component';
import { GameType } from './gameType';
import { aiManager } from './game_model/aiManager';
import { P2PClient } from './p2p/p2p-client';
import { ISignalingService } from './p2p/signaling/signaling-service';
import { P2PDialogComponent } from './lobby/p2p-dialog/p2p-dialog.component';
import { log } from './logger';
import { environment } from '../environments/environment';

export enum ClientState {
    UnAuth,
    InLobby,
    Waiting,
    PrivateLobby,
    PrivateLobbyFail,
    InQueue,
    InGame,
    Any
}


@Injectable()
export class WebClient {
    private username = '';
    private messenger: Messenger;
    private state: ClientState = ClientState.UnAuth;
    /** Timestamp of the last ExitQueue, used to ignore late queue receipts */
    private queueExitAt = 0;
    /** 正在恢复/已恢复的对局 id:用于识别重复的 StartGame(replay) */
    private restoredGameId: string | null = null;
    /** 上次发出 ResendGame 的时间:节流双通道恢复的重复请求 */
    private resendRequestedAt = 0;
    private connected = false;
    private connectedToLocalServer = false;
    /** 离线模式标志:进入离线游玩后置位,登录成功后清除 */
    private offline = false;
    /** 页面刷新/关闭置位:此时绝不发 Quit,交由服务器 60 秒断线保留 + 重连恢复 */
    private unloading = false;

    public getGameReward: ((won: boolean) => Promise<string>) | null = null;
    public onDeckSelected: () => void = () => null;
    private onError: (error: string) => void = () => null;

    constructor(
        private soundManager: SoundManager,
        private tips: TipService,
        private router: Router,
        private zone: NgZone,
        public dialog: MatDialog,
        private snackbar: MatSnackBar,
        private hotkeys: HotkeysService,
        private auth: AuthenticationService,
        private collection: CollectionService,
        public gameManager: GameManager,
        preloader: Preloader,
        messengerService: MessengerService,
        private i18n: I18nService
    ) {
        this.auth.onAuth(user => {
            if (user) {
                this.onLogin(user);
            }
        });

        this.messenger = messengerService.getMessenger();
        this.messenger.addHandler(MessageType.StartGame, msg => {
            // A match confirmation arriving right after we left the queue is
            // a stale pairing - do not yank the player into a game.
            if (Date.now() - this.queueExitAt < 5000 && !msg.data.replay) {
                return;
            }
            this.startGame(msg);
        }, this);
        this.messenger.addHandler(MessageType.ResendGame, () => {
            // Server acknowledged our state request: the full event log has
            // been delivered, resume normal tips/sounds/animations.
            this.gameManager.finishReplay();
        }, this);        this.messenger.addHandler(
            MessageType.ClientError,
            msg => this.clientError(msg),
            this
        );
        this.messenger.addHandler(
            MessageType.QueueJoined,
            msg => {
                // Ignore a late QueueJoined receipt after we left the queue,
                // otherwise returning to the lobby flips back to "in queue".
                if (Date.now() - this.queueExitAt < 5000) {
                    return;
                }
                this.changeState(ClientState.InQueue);
            },
            this
        );

        this.messenger.connectChange = status => {
            zone.run(() => {
                this.connected = status;
                // 联机对局中 WS 重连成功:请求增量补发断线期间缺失的事件
                if (
                    status &&
                    this.state === ClientState.InGame &&
                    localStorage.getItem('fa-game-mode') === 'multiplayer'
                ) {
                    const game = this.gameManager.getGame();
                    this.requestGameStateResend(
                        game ? game.getExpectedEventNumber() : 0
                    );
                }
            });
        };
        messengerService.getLocalMessenger().connectChange = status =>
            zone.run(() => (this.connectedToLocalServer = status));

        this.gameManager.setGameEndCallback((won, quit) =>
            this.openEndDialog(won, quit)
        );

        // 刷新/关闭页面时置位,让 exitGame 跳过 Quit:
        // 刷新后登录恢复会自动 ResendGame 回到对局(服务器保留 60 秒)
        window.addEventListener('beforeunload', () => {
            this.unloading = true;
        });

        this.addHotkeys();
    }

    private startGame(msg: Message) {
        log.debug(
            '[recovery] StartGame received',
            msg.data.replay ? '(replay)' : '(new game)'
        );
        const replay = msg.data.replay === true;
        // 双通道恢复(登录恢复 + 路由守卫)会各请求一次 ResendGame,服务器
        // 会回发两份 StartGame(replay)+全量事件。同一局只重建一次镜像:
        // 重复的 StartGame 若再建新实例,游戏组件会绑定到被丢弃的旧镜像,
        // 表现为刷新后界面冻结、点击无效(看似"游戏没有恢复")。
        if (
            replay &&
            this.isInGame() &&
            msg.data.gameId &&
            msg.data.gameId === this.restoredGameId
        ) {
            log.debug('[recovery] duplicate StartGame(replay) ignored');
            return;
        }
        this.restoredGameId = replay ? msg.data.gameId || null : null;
        this.gameManager.startMultiplayerGame(
            msg.data.playerNumber,
            msg.data.opponent,
            replay
        );
        this.changeState(ClientState.InGame);
        this.router.navigate(['/game']);
    }

    public startAIGame() {
        this.gameManager.startAIGame();
        this.changeState(ClientState.InGame);
        this.router.navigate(['/game']);
    }

    public startDoubleAIGame() {
        this.gameManager.startAIGame(2);
        this.getGameReward = () => Promise.resolve('No reward in A.I mode');
        this.changeState(ClientState.InGame);
        this.router.navigate(['/game']);
    }

    public startLocalAIGame() {
        // 服务器 AI(A3):请求服务端开一局「人类 vs AI 坐席」。
        // 此后与公共匹配同路:等待页 → 服务器 StartGame → 进入对局。
        this.router.navigate(['/queue']);
        this.messenger.sendMessageToServer(MessageType.PlayWithAI, {
            difficulty: aiManager.getConcreteDifficulty()
        });
        this.changeState(ClientState.Waiting);
    }

    private addHotkeys() {
        this.hotkeys.add(
            new Hotkey(
                'esc',
                (event: KeyboardEvent): boolean => {
                    this.openSettings();
                    return false;
                },
                [],
                this.i18n.tr('Settings')
            )
        );

        this.hotkeys.add(
            new Hotkey(
                'm',
                (event: KeyboardEvent): boolean => {
                    this.soundManager.toggleMute();
                    return false;
                },
                [],
                this.i18n.tr('Mute/Unmute')
            )
        );

        this.hotkeys.add(
            new Hotkey(
                'shift+t',
                (event: KeyboardEvent): boolean => {
                    this.tips.toggleDisable();
                    return false;
                },
                [],
                this.i18n.tr('Disable/Enable Tips')
            )
        );
    }

    // Misc --------------------
    /**
     * 请求服务器重发对局状态(StartGame(replay)+全量事件)。
     * 登录恢复与路由守卫都会调用:5 秒内只发一次,避免服务器回发两份
     * 完整事件日志导致客户端重放两遍(第二份会被时序守卫跳过,但应避免)。
     * from > 0:增量模式——客户端已有镜像,仅补发缺失的事件。
     */
    public requestGameStateResend(from = 0) {
        const now = Date.now();
        if (now - this.resendRequestedAt < 5000) {
            log.debug('[recovery] resend request throttled');
            return;
        }
        this.resendRequestedAt = now;
        log.debug('[recovery] requesting game state resend from', from);
        this.messenger.sendMessageToServer(MessageType.ResendGame, {
            from: from
        });
    }

    private onLogin(loginData: UserData) {
        this.offline = false;
        this.changeState(ClientState.InLobby);
        this.username = loginData.username;
        this.tips.setUsername(this.username);
        this.gameManager.setUsername(this.username);
        this.tips.playTip(TipType.StartGame);
        // 登录态恢复后向服务器确认是否有一局进行中的游戏；
        // 若有，服务器会回发 StartGame(replay) + 全部历史事件，直接回到对局。
        this.requestGameStateResend();
    }

    public enterOfflineMode(): boolean {
        this.offline = true;
        this.changeState(ClientState.InLobby);
        this.username = environment.serverless ? 'Player' : 'Offline Player';
        this.tips.setUsername(this.username);
        this.gameManager.setUsername(this.username);

        const hasSound = localStorage.getItem('sound-settings');
        const hasTips = localStorage.getItem('tip-store');
        return !hasSound && !hasTips;
    }

    /** 离线(或 serverless)模式:所有需要登录态的服务器消息都应跳过 */
    public isOffline(): boolean {
        return this.offline || environment.serverless;
    }

    public startP2PGame(signaling: ISignalingService, isHost: boolean) {
        const p2p = new P2PClient(signaling);
        p2p.initiate(isHost);
        this.messenger.setP2PTransport(p2p);
        this.gameManager.startP2PBackendGame(isHost);

        this.messenger.connectChange = (connected) => {
            if (connected) {
                this.zone.run(() => {
                    this.dialog.closeAll();
                    this.selectDeckAndStartGame(isHost ? GameType.P2PHost : GameType.P2PJoin);
                });
            }
        };

        this.gameManager.onP2PGameStarted = () => {
            this.changeState(ClientState.InGame);
            this.router.navigate(['/game']);
        };
    }

    public isLoggedIn() {
        return !(this.state === ClientState.UnAuth);
    }

    private clientError(msg: Message) {
        console.error(msg.data.message || msg.data);
        // 操作失败对玩家可见:弹 toast;对局内动作被拒说明本地乐观
        // 状态可能与服务器不一致,自动请求重同步(节流避免风暴)
        this.zone.run(() => {
            const text: string = msg.data.message || String(msg.data);
            this.snackbar.open(text, this.i18n.tr('Dismiss'), {
                duration: 4000
            });
        });
        if (msg.data && msg.data.type === 0 /* GameActionError */) {
            this.requestGameStateResend();
        }
        this.onError(msg.data);
    }

    // Decks -----------------------------------------------------
    public setDeck(deck: DeckList) {
        if (!deck) {
            console.error('setting undef deck', deck);
            return;
        }
        this.gameManager.setDeck(deck);
        if (!this.isOffline()) {
            this.messenger.sendMessageToServer(MessageType.SetDeck, {
                deckList: deck.toJson()
            });
        }

        if (this.onDeckSelected) {
            // Only call onDeckSelected if we haven't already started the game 
            // (e.g. P2P game might start immediately if opponent is ready)
            if (this.state !== ClientState.InGame) {
                this.onDeckSelected();
            }
        }
    }

    // Transitions -----------------------------------------------
    public returnToLobby(navigate = true) {
        switch (this.state) {
            case ClientState.InGame:
                this.exitGame();
                break;
            case ClientState.InQueue:
                this.leaveQueue();
                break;
        }
        if (navigate) {
            this.router.navigate(['/lobby']);
        }
        this.changeState(ClientState.InLobby);
    }

    public isConnected(): boolean {
        return this.connected;
    }

    public isConnectedToLocalServer(): boolean {
        return this.connectedToLocalServer;
    }

    public exitGame(final = false) {
        // Only send Quit while a game is actually in progress; after the end
        // dialog the game is already over and sending Quit again (e.g. from
        // ngOnDestroy during navigation) produces duplicate quit actions.
        // 页面刷新/关闭时绝不发 Quit —— 那会立刻终结对局、把刷新变成认输;
        // 服务器按断线 60 秒保留对局,重连后经 ResendGame 自动恢复。
        if (this.state === ClientState.InGame && !this.unloading) {
            this.gameManager.exitGame();
        }
        if (final) {
            this.messenger.close();
        } else {
            this.changeState(ClientState.InLobby);
            this.router.navigate(['/lobby']);
        }
    }

    public joinPublicQueue() {
        this.router.navigate(['/queue']);
        this.messenger.sendMessageToServer(MessageType.JoinQueue, {});
        this.changeState(ClientState.Waiting);
    }

    public startP2PDeckSelected() {
        this.router.navigate(['/queue']);
        this.changeState(ClientState.Waiting);
    }

    public openDeckSelector() {
        this.router.navigate(['/select']);
    }

    public openDeckEditor() {
        this.tips.playTip(TipType.EditDeck);
        this.router.navigate(['/deck']);
    }

    public leaveQueue() {
        this.queueExitAt = Date.now();
        this.messenger.sendMessageToServer(MessageType.ExitQueue, {});
    }

    public isInGame() {
        return this.state === ClientState.InGame;
    }

    /**
     * 对局刷新恢复(InPlayGuard 刷新后调用):
     *  联机局 → 发 ResendGame,服务器在断线保留期内回发
     *  StartGame(replay)+全量事件,轮询等待状态进入 InGame(最多 5 秒)。
     * 本地对局(AI/服务器 AI/P2P)不做刷新恢复:立即返回 false 回大厅。
     */
    public tryRestoreGame(): Promise<boolean> {
        const mode = localStorage.getItem('fa-game-mode');
        const backToLobby = () => {
            // 状态归位:大厅模板依赖 InLobby 状态渲染,防止空白页
            if (this.auth.loggedIn()) {
                this.changeState(ClientState.InLobby);
            }
            return false;
        };
        if (mode !== 'multiplayer') {
            log.debug('[tryRestore] local game or no game, skip restore');
            return Promise.resolve(backToLobby());
        }
        // WS 若尚在重连,ResendGame 会进入离线队列,重连后自动补发
        this.requestGameStateResend();
        return new Promise<boolean>(resolve => {
            const deadline = Date.now() + 5000;
            const poll = setInterval(() => {
                if (this.state === ClientState.InGame) {
                    clearInterval(poll);
                    resolve(true);
                } else if (Date.now() > deadline) {
                    clearInterval(poll);
                    // 恢复失败:已登录则把状态机推进到大厅,避免 UI 卡在中间态
                    if (this.auth.loggedIn()) {
                        this.changeState(ClientState.InLobby);
                    }
                    resolve(false);
                }
            }, 200);
        });
    }

    /** 主动退出对局(游戏菜单):AI 局直接回大厅,联机局发 Quit 结算 */
    public quitGame() {
        if (this.state !== ClientState.InGame) {
            return;
        }
        localStorage.removeItem('fa-game-mode');
        if (this.gameManager.isLocalGame()) {
            this.gameManager.reset();
            this.changeState(ClientState.InLobby);
            this.router.navigate(['/lobby']);
        } else {
            this.exitGame();
        }
    }

    private openEndDialog(playerWon: boolean, quit: boolean) {
        // 对局已分出胜负:清除对局模式标记,刷新后不再尝试恢复
        localStorage.removeItem('fa-game-mode');
        const config = new MatDialogConfig();
        config.disableClose = true;
        const dialogRef = this.dialog.open(EndDialogComponent, config);

        dialogRef.componentInstance.winner = playerWon;
        dialogRef.componentInstance.quit = quit;

        const rewardMessage = this.getGameReward
            ? this.getGameReward(playerWon)
            : this.collection.onGameEnd(playerWon, quit);
        rewardMessage
            .then(msg => (dialogRef.componentInstance.rewards = msg))
            .catch(e => {
                console.error('Failed to load rewards', e);
                dialogRef.componentInstance.rewards = this.i18n.tr(
                    'Failed to load rewards.'
                );
            });
        dialogRef.afterClosed().subscribe(result => {
            this.gameManager.reset();
            this.returnToLobby();
        });
    }

    public openSettings() {
        this.dialog.open(SettingsDialogComponent, {
            height: '350px'
        });
    }

    private changeState(newState: ClientState) {
        this.zone.run(() => (this.state = newState));
    }

    public getState() {
        return this.state;
    }

    public getUsername() {
        return this.username;
    }

    public selectDeckAndStartGame(type: GameType) {
        this.tips.playTip(TipType.SelectDeck);
        switch (type) {
            case GameType.AiGame:
                this.onDeckSelected = this.startAIGame;
                break;
            case GameType.DoubleAiGame:
                this.onDeckSelected = this.startDoubleAIGame;
                break;
            case GameType.PublicGame:
                this.onDeckSelected = this.joinPublicQueue;
                break;
            case GameType.ServerAIGame:
                this.onDeckSelected = this.startLocalAIGame;
                break;
            case GameType.P2PHost:
            case GameType.P2PJoin:
                this.onDeckSelected = this.startP2PDeckSelected;
                break;
        }
        this.router.navigate(['/select']);
    }
    public openP2PDialog(autoJoinRoom?: string) {
        if (autoJoinRoom) {
            // 链接自动加入(landing/设置阶段调用):大厅组件未挂载,
            // 先记下房间号,由 LobbyComponent 构造时补弹对话框
            this.pendingP2PRoom = autoJoinRoom;
            this.router.navigate(['/lobby']);
            return;
        }
        // 大厅内直接点击「P2P 对战」:直接弹对话框。
        // (旧实现走 pendingP2PRoom 间接层,但此处无房间号,
        //  大厅判断 pending 为假不弹窗 → 表现为"跳回主界面")
        this.dialog.open(P2PDialogComponent, {
            width: '600px',
            disableClose: false
        });
    }

    public pendingP2PRoom: string | undefined;

}
