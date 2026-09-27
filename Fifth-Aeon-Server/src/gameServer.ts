import { Account } from "./account";
import { ErrorType } from "./errors";
import { tsrvf } from "./i18n-messages";
import { AIConstructor } from "./game_model/ai/aiList";
import { GameAction, GameActionType } from "./game_model/events/gameAction";
import { GameSyncEvent } from "./game_model/events/syncEvent";
import { standardFormat } from "./game_model/gameFormat";
import { ServerGame } from "./game_model/serverGame";
import { Message, MessageType } from "./message";
import { ServerMessenger } from "./messenger";
import { Server } from "./server";
import { AiSeatDriver } from "./aiSeat";

export interface AISeatConfig {
    /** 座位号(0/1) */
    seat: number;
    /** AI 构造器(难度) */
    ctor: AIConstructor;
    /** AI 卡组 */
    deck: import("./game_model/deckList").DeckList;
}

export class GameServer {
    /** eventLog 内存上限(C8):超过后裁剪头部,靠 logStartOffset 维持绝对事件号 */
    private static readonly MAX_EVENT_LOG = 4000;
    /**
     * 回合计时器(A5/C7):任何一方(含待应答选择)超过该时限未行动,
     * 服务端代打一步中性动作推进对局,防止挂机/断线拖死对局。
     * 可用环境变量 FA_TURN_TIMEOUT_MS 覆盖(测试可调小)。
     */
    private static readonly TURN_TIMEOUT_MS =
        Number(process.env.FA_TURN_TIMEOUT_MS) > 0
            ? Number(process.env.FA_TURN_TIMEOUT_MS)
            : 1000 * 75;

    private playerAccounts: Account[] = [];
    private game: ServerGame;
    private id: string;
    // 全部已发生事件的日志：玩家刷新/断线重连后据此整局重放恢复状态。
    // 超过 MAX_EVENT_LOG 后裁剪头部,logStartOffset 记录已被裁掉的事件数,
    // 事件对象自身的 number 字段(绝对编号)不受影响。
    private eventLog: GameSyncEvent[] = [];
    private logStartOffset = 0;
    // 已向各玩家发送到的事件总数(绝对)。重放起点以服务端记录为准(C8),
    // 客户端自报的 from 超过该值视为伪造,回退全量重放。
    private sentCount: number[] = [0, 0];
    // AI 坐席(A3/A5):seat → 驱动器
    private aiDrivers: Map<number, AiSeatDriver> = new Map<number, AiSeatDriver>();
    private ended = false;
    private watchdog: any = null;

    constructor(
        private messenger: ServerMessenger,
        private server: Server,
        id: string,
        player1: Account,
        player2: Account,
        aiSeats: AISeatConfig[] = []
    ) {
        // 先装配 AI 坐席账号(替换占位账号并写入卡组),
        // 再用最终的两个卡组创建权威对局 —— 否则 AI 会以
        // 占位账号的空卡组开局(空牌库直接判负/疲劳)。
        const accounts = [player1, player2];
        for (const ai of aiSeats) {
            if (ai.seat !== 0 && ai.seat !== 1) {
                continue;
            }
            // AI 坐席使用独立 token 的虚拟账号(不注册进 accounts 表,
            // 不参与 WS 通信与账号清理),动作经内部通道走同一校验管线
            const aiAccount = new Account(this.randomToken(), "Server AI");
            aiAccount.deck = ai.deck;
            accounts[ai.seat] = aiAccount;
            this.aiCtors.set(ai.seat, ai.ctor);
        }
        ServerGame.setSeed(Math.random());
        this.game = new ServerGame("server", standardFormat, [accounts[0].deck, accounts[1].deck]);
        this.id = id;
        this.playerAccounts = accounts;
        for (const seat of this.aiCtors.keys()) {
            this.aiDrivers.set(
                seat,
                new AiSeatDriver(seat, action =>
                    this.handleAiAction(seat, action)
                )
            );
        }
    }

    private randomToken() {
        return "ai-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    private playerNum(playerToken: string) {
        return this.playerAccounts.findIndex((acc) => acc.token === playerToken);
    }

    private pushEvents(events: GameSyncEvent[]) {
        this.eventLog.push(...events);
        if (this.eventLog.length > GameServer.MAX_EVENT_LOG) {
            const cut = this.eventLog.length - GameServer.MAX_EVENT_LOG;
            this.eventLog.splice(0, cut);
            this.logStartOffset += cut;
        }
    }

    private absoluteLogEnd() {
        return this.logStartOffset + this.eventLog.length;
    }

    private handleAiAction(seat: number, action: GameAction) {
        if (this.ended) {
            return;
        }
        const aiAccount = this.playerAccounts[seat];
        this.handleAction({
            source: aiAccount.token,
            type: MessageType.GameAction,
            data: action
        } as Message);
    }

    private broadcast(events: GameSyncEvent[]) {
        for (const account of this.playerAccounts) {
            for (const event of events) {
                this.messenger.sendMessageTo(MessageType.GameEvent, event, account.token);
            }
        }
    }

    private feedAi(events: GameSyncEvent[]) {
        for (const driver of this.aiDrivers.values()) {
            driver.feed(events);
        }
    }

    /** 回合计时器(A5/C7):到点后代打一步中性动作并继续排程 */
    private scheduleWatchdog() {
        if (this.watchdog) {
            clearTimeout(this.watchdog);
        }
        if (this.ended || this.game.getWinner() !== -1) {
            return;
        }
        this.watchdog = setTimeout(() => {
            this.watchdog = null;
            if (this.ended || this.game.getWinner() !== -1) {
                return;
            }
            console.log("Turn timeout, auto-acting for", this.game.getName());
            const events = this.game.autoAct();
            if (events && events.length > 0) {
                this.pushEvents(events);
                this.broadcast(events);
                this.feedAi(events);
                const end = this.absoluteLogEnd();
                this.sentCount[0] = end;
                this.sentCount[1] = end;
            }
            this.scheduleWatchdog();
        }, GameServer.TURN_TIMEOUT_MS);
    }

    public handleAction(msg: Message) {
        if (this.ended) {
            return;
        }
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
        this.pushEvents(events);
        this.broadcast(events);
        const end = this.absoluteLogEnd();
        this.sentCount[0] = end;
        this.sentCount[1] = end;
        this.feedAi(events);
        if (this.game.getWinner() !== -1) {
            this.end();
            return;
        }
        this.scheduleWatchdog();
    }

    public end() {
        if (this.ended) {
            return;
        }
        this.ended = true;
        if (this.watchdog) {
            clearTimeout(this.watchdog);
            this.watchdog = null;
        }
        for (const driver of this.aiDrivers.values()) {
            driver.stop();
        }
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
        this.pushEvents(events);
        this.broadcast(events);
        const end = this.absoluteLogEnd();
        this.sentCount[0] = end;
        this.sentCount[1] = end;

        // 启动 AI 坐席(全新对局,从开局事件同步)
        for (const [seat, driver] of this.aiDrivers) {
            driver.start(
                this.aiCtors.get(seat) as AIConstructor,
                this.game.getDeckList(seat),
                events,
                true
            );
        }

        this.scheduleWatchdog();
    }

    private aiCtors: Map<number, AIConstructor> = new Map<number, AIConstructor>();

    /**
     * 真人断线托管(A5/C7):由该座位的 AI 接管对局。
     * 镜像从现有事件日志对齐补放(日志可能被裁剪,故按首事件号对齐)。
     */
    public disconnectTakeover(token: string, ctor: AIConstructor) {
        if (this.ended) {
            return;
        }
        const idx = this.playerNum(token);
        if (idx === -1 || this.aiDrivers.has(idx)) {
            return;
        }
        console.log(
            "Player disconnected too long, AI taking over seat",
            idx,
            "in",
            this.getName()
        );
        const driver = new AiSeatDriver(idx, action =>
            this.handleAiAction(idx, action)
        );
        this.aiDrivers.set(idx, driver);
        this.aiCtors.set(idx, ctor);
        driver.start(ctor, this.game.getDeckList(idx), this.eventLog, false);
    }

    /** 玩家重连:若该座位已被 AI 托管,停掉 AI(玩家重新接管) */
    public reconnectHuman(token: string) {
        const idx = this.playerNum(token);
        if (idx !== -1 && this.aiDrivers.has(idx)) {
            console.log("Human reconnected, stopping AI takeover for seat", idx);
            this.aiDrivers.get(idx)?.stop();
            this.aiDrivers.delete(idx);
        }
    }

    /**
     * 向一名玩家重发对局状态。
     * from > 0:增量模式——客户端已有对局镜像(如 WS 重连),仅补发
     * 缺失的事件尾巴,不重建镜像;
     * from = 0:全量模式——StartGame(replay) + 全部历史事件整局重放。
     *
     * C8 安全规则:起点以服务端记录的已发送数为准——
     *  - from > sentCount(客户端虚报领先) → 回退全量重放;
     *  - from 落在已被裁剪的区间(logStartOffset 之前) → 回退全量重放。
     */
    public resendState(token: string, from = 0) {
        const idx = this.playerNum(token);
        if (idx === -1) {
            return;
        }
        this.reconnectHuman(token);
        const sent = this.sentCount[idx];
        const localFrom = from - this.logStartOffset;
        if (
            from > 0 &&
            from <= sent &&
            localFrom < this.eventLog.length
        ) {
            const tail = this.eventLog.slice(Math.max(0, localFrom));
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
            this.sentCount[idx] = Math.max(this.sentCount[idx], this.absoluteLogEnd());
            this.messenger.sendMessageTo(
                MessageType.ResendGame,
                { done: true, incremental: true },
                token
            );
            return;
        }
        if (from > sent) {
            console.warn(
                "Client claimed replay origin beyond server record, falling back to full resend:",
                this.playerAccounts[idx].username,
                "claimed",
                from,
                "sent",
                sent
            );
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
        this.sentCount[idx] = this.absoluteLogEnd();
        // 回发确认:客户端收到后退出重放模式(恢复提示/音效/动画副作用)
        this.messenger.sendMessageTo(MessageType.ResendGame, { done: true }, token);
    }

    public getName() {
        return this.playerAccounts[0].username + " vs " + this.playerAccounts[1].username;
    }
}
