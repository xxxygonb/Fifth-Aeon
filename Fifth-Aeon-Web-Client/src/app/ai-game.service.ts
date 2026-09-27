import { Injectable } from '@angular/core';
import { AI } from './game_model/ai/ai';
import { AIConstructor } from './game_model/ai/aiList';
import { aiManager, AiData } from './game_model/aiManager';
import { DeckList } from './game_model/deckList';
import { ClientGame } from './game_model/clientGame';
import { ServerGame } from './game_model/serverGame';
import { ReplayDuplicator } from './game_model/gameDuplicator';
import { GameSyncEvent, SyncEventType } from './game_model/events/syncEvent';
import { Animator } from './game_model/animator';

/**
 * AI 对局服务(B2 自 gameManager 拆出):
 * 职责——AI 实例持有、难度数据持久化、AI 出招节奏、
 * 对局事件喂养与优先权通知、(A4)推演克隆器注入。
 * GameManager 保留对局镜像/网络/表现层职责,AI 相关全部委托本服务。
 */
@Injectable({ providedIn: 'root' })
export class AiGameService {
    private ais: Array<AI> = [];
    private aisByPlayerNumber: Array<AI | null> = [];

    /** AI 难度/战绩持久化(原 gameManager.setupAiManager) */
    public setupPersistence() {
        const localStorageKey = 'ai-data';
        aiManager.save = data =>
            localStorage.setItem(localStorageKey, JSON.stringify(data));

        const json = localStorage.getItem(localStorageKey);
        if (json) {
            aiManager.load(JSON.parse(json));
        }
    }

    /** 停止所有 AI 并清空(新对局/回大厅) */
    public reset() {
        this.stop();
        this.ais = [];
        this.aisByPlayerNumber = [];
    }

    /** 停止所有 AI 出招(对局结束/退出) */
    public stop() {
        for (const ai of this.ais) {
            ai.stopActing();
        }
    }

    /** 按节奏启动所有 AI(延时出招模式) */
    public startWithSpeed(ms: number, animator: Animator) {
        for (const ai of this.ais) {
            ai.startActingDelayMode(ms, animator);
        }
    }

    /** 将权威端产生的事件喂给所有 AI 镜像 */
    public feedEvents(events: GameSyncEvent[]) {
        for (const event of events) {
            for (const ai of this.ais) {
                ai.handleGameEvent(event);
            }
        }
    }

    /** 回合/阶段/选择事件后:若轮到某 AI 行动则触发其思考 */
    public notifyPriority(event: GameSyncEvent, authoritative: ServerGame | null) {
        if (!authoritative || !authoritative.canTakeAction()) {
            return;
        }
        if (
            event.type === SyncEventType.TurnStart ||
            event.type === SyncEventType.PhaseChange ||
            event.type === SyncEventType.ChoiceMade
        ) {
            const aiToSend = this.aisByPlayerNumber[
                authoritative.getActivePlayer()
            ];
            if (aiToSend) {
                aiToSend.onGainPriority();
            }
        }
    }

    /** 当前 AI 数量(双 AI 局=2 时玩家输入被锁定) */
    public count(): number {
        return this.ais.length;
    }

    /** 记录单机对局结果(动态难度调档) */
    public recordResult(playerWon: boolean) {
        aiManager.recordGameResult(playerWon);
    }

    /**
     * 组装一个 AI 实例(镜像由 GameManager 创建并传入;
     * A4:同时注入对局克隆器供 Expert 推演)。
     */
    public assembleAI(opts: {
        aiCtor: AIConstructor;
        aiDeck: DeckList;
        opponentNumber: number;
        mirror: ClientGame;
        authoritative: ServerGame | null;
    }): AI {
        const newAI = new opts.aiCtor(
            opts.opponentNumber,
            opts.mirror,
            opts.aiDeck
        );
        if (opts.authoritative) {
            const authoritative = opts.authoritative;
            newAI.setSimulator(() =>
                ReplayDuplicator.duplicate(authoritative)
            );
        }
        this.ais.push(newAI);
        this.aisByPlayerNumber[opts.opponentNumber] = newAI;
        return newAI;
    }
}
