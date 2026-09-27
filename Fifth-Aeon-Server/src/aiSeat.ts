/**
 * 服务端 AI 坐席驱动(A3/A5):
 * 把原本只存在于浏览器单机局的 AI 装配模式
 * (ClientGame 镜像 + AI 决策 + 动作回流权威端)搬到服务器:
 *  - AI 持有一个 ClientGame 镜像,由 GameServer 喂事件保持同步;
 *  - AI 的动作经 dispatch 回调进入 GameServer.handleAction(与真人同一校验管线);
 *  - 动作以固定间隔逐个执行(延时模式),避免在事件调用栈里同步递归。
 * 用途:①「对战服务器 AI」的 AI 座位;②真人断线后的托管(A5/C7)。
 */
import { Animator } from './game_model/animator';
import { AI } from './game_model/ai/ai';
import { AIConstructor } from './game_model/ai/aiList';
import { ClientGame } from './game_model/clientGame';
import { DeckList } from './game_model/deckList';
import { GameAction } from './game_model/events/gameAction';
import { GameSyncEvent } from './game_model/events/syncEvent';

export class AiSeatDriver {
    private mirror: ClientGame | null = null;
    private ai: AI | null = null;
    private stopped = false;

    constructor(
        private playerNo: number,
        /** AI 动作出口:交回 GameServer 走与真人相同的校验/广播管线 */
        private dispatch: (action: GameAction) => void,
        /** 动作节奏(ms),与客户端 aiTick 类似;太快会加重服务器负载 */
        private tickMs = 400
    ) {}

    /**
     * 启动 AI 坐席。
     * fresh=true:全新对局,从 0 号事件开始同步;
     * fresh=false:中途接管(断线托管),按日志首个事件号对齐后补放全部历史。
     */
    public start(aiCtor: AIConstructor, deck: DeckList, events: GameSyncEvent[], fresh = true) {
        if (this.stopped) {
            return;
        }
        const animator = new Animator(0);
        this.mirror = new ClientGame(
            'ai-seat-' + this.playerNo,
            (_, action) => this.dispatch(action),
            animator
        );
        this.mirror.setOwningPlayer(this.playerNo);
        this.ai = new aiCtor(this.playerNo, this.mirror, deck);
        this.ai.startActingDelayMode(this.tickMs, animator);
        if (!fresh && events.length > 0) {
            this.mirror.primeEventStream(events[0].number || 0);
        }
        this.feed(events);
    }

    /** 喂入新事件;若此刻轮到 AI 行动则触发其思考(异步,避免递归) */
    public feed(events: GameSyncEvent[]) {
        if (this.stopped || !this.ai || !this.mirror) {
            return;
        }
        for (const event of events) {
            this.ai.handleGameEvent(event);
        }
        if (
            this.mirror.canTakeAction() &&
            this.mirror.isActivePlayer(this.playerNo)
        ) {
            // 脱离当前调用栈再思考:think() 里的动作会再次触发 handleAction→feed
            setImmediate(() => {
                if (!this.stopped && this.ai) {
                    this.ai.onGainPriority();
                }
            });
        }
    }

    public stop() {
        this.stopped = true;
        if (this.ai) {
            this.ai.stopActing();
        }
    }

    public isStopped() {
        return this.stopped;
    }
}
