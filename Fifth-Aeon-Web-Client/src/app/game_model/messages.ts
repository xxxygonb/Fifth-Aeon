/**
 * 全局消息协议（B4 单一来源）。
 * 此文件是服务器与客户端共享的消息类型定义，经 model-sync.js 同步到两端。
 *
 * 注意: WebSocket 线上协议传输的是枚举【名字符串】(见 client messenger.makeMessage
 * 与 server messenger)，因此新增消息只需在对应区块追加成员即可，不会错位；
 * 但不要在区块中间插入或重排成员——本地总线(P2P/单机 AI)仍可能使用数值。
 */
export enum MessageType {
    // General
    Info,
    ClientError,
    Connect,
    Ping,

    // Accounts
    AnonymousLogin,
    LoginResponce,
    SetDeck,

    // Queuing
    JoinQueue,
    ExitQueue,
    QueueJoined,
    StartGame,
    NewPrivateGame,
    JoinPrivateGame,
    CancelPrivateGame,
    PrivateGameReady,
    /** 请求与服务器 AI 对战(data: {difficulty}),服务端为玩家配一个 AI 坐席 */
    PlayWithAI,
    /** 仅本地消息总线使用（单机 AI 对局传卡牌场景），不经过 WebSocket */
    TransferScenario,

    // In Game
    GameEvent,
    GameEvents,
    GameAction,
    ResendGame
}

export interface Message {
    source: string;
    type: MessageType;
    data: any;
}

export interface LoginResponceData {
    username: string;
    token: string;
}
