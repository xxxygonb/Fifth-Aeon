import { Account } from "./account";
import { ErrorType } from "./errors";
import { tsrvf } from "./i18n-messages";
import { GameAction, GameActionType } from "./game_model/events/gameAction";
import { GameSyncEvent } from "./game_model/events/syncEvent";
import { standardFormat } from "./game_model/gameFormat";
import { ServerGame } from "./game_model/serverGame";
import { Message, MessageType } from "./message";
import { ServerMessenger } from "./messenger";
import { Server } from "./server";


export class GameServer {
    private playerAccounts: Account[] = [];
    private game: ServerGame;
    private id: string;
    // 全部已发生事件的日志：玩家刷新/断线重连后据此整局重放恢复状态
    private eventLog: GameSyncEvent[] = [];

    constructor(private messenger: ServerMessenger, private server: Server, id: string, player1: Account, player2: Account) {
        ServerGame.setSeed(Math.random());
        this.game = new ServerGame("server", standardFormat, [player1.deck, player2.deck]);
        this.id = id;
        this.playerAccounts.push(player1);
        this.playerAccounts.push(player2);
    }

    private playerNum(playerToken: string) {
        return this.playerAccounts.findIndex((acc) => acc.token === playerToken);
    }

    public handleAction(msg: Message) {
        const action: GameAction = msg.data;
        action.player = this.playerNum(msg.source);
        if (action.player === undefined || action.player === -1) {
            console.error("Action without player", msg);
            return;
        }
        const events = this.game.handleAction(action);
        if (events === null) {
            this.server.getErrorHandler().clientError(msg.source, ErrorType.GameActionError,
                tsrvf("Cannot take action {action}", { action: GameActionType[action.type] }));
            return;
        }
        this.eventLog.push(...events);
        for (const account of this.playerAccounts) {
            for (const event of events) {
                this.messenger.sendMessageTo(MessageType.GameEvent, event, account.token);
            }
        }
        if (this.game.getWinner() !== -1) {
            this.end();
        }
    }

    public end() {
        this.server.endGame(this.id);
        this.playerAccounts.forEach(acc => {
            acc.setInGame(null);
        });
    }

    public start() {
        for (let i = 0; i < this.playerAccounts.length; i++) {
            this.messenger.sendMessageTo(MessageType.StartGame, {
                playerNumber: i,
                gameId: this.id,
                opponent: this.playerAccounts[1 - i].username,
            }, this.playerAccounts[i].token);
        }

        const events = this.game.startGame();
        this.eventLog.push(...events);
        this.playerAccounts.forEach(acc => {
            events.forEach(event => {
                this.messenger.sendMessageTo(MessageType.GameEvent, event, acc.token);
            });
        });
    }

    /**
     * 向一名玩家重发对局状态。
     * from > 0:增量模式——客户端已有对局镜像(如 WS 重连),仅补发
     * 缺失的事件尾巴,不重建镜像;
     * from = 0:全量模式——StartGame(replay) + 全部历史事件整局重放。
     */
    public resendState(token: string, from = 0) {
        const idx = this.playerNum(token);
        if (idx === -1) {
            return;
        }
        if (from > 0 && from <= this.eventLog.length) {
            const tail = this.eventLog.slice(from);
            console.log(
                "Resending incremental events to",
                this.playerAccounts[idx].username,
                "from",
                from,
                "count",
                tail.length
            );
            if (tail.length > 0) {
                this.messenger.sendMessageTo(
                    MessageType.GameEvents,
                    tail,
                    token
                );
            }
            this.messenger.sendMessageTo(
                MessageType.ResendGame,
                { done: true, incremental: true },
                token
            );
            return;
        }
        console.log("Resending game state to", this.playerAccounts[idx].username);
        this.messenger.sendMessageTo(MessageType.StartGame, {
            playerNumber: idx,
            gameId: this.id,
            opponent: this.playerAccounts[1 - idx].username,
            replay: true,
        }, token);
        if (this.eventLog.length > 0) {
            this.messenger.sendMessageTo(MessageType.GameEvents, this.eventLog, token);
        }
        // 回发确认:客户端收到后退出重放模式(恢复提示/音效/动画副作用)
        this.messenger.sendMessageTo(MessageType.ResendGame, { done: true }, token);
    }

    public getName() {
        return this.playerAccounts[0].username + " vs " + this.playerAccounts[1].username;
    }
}
