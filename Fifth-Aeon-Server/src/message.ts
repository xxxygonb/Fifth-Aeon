/**
 * 消息协议定义已统一到共享模型(见 game_model/messages.ts, 源: Fifth-Aeon-Model/messages.ts)。
 * 本文件仅做兼容性再导出, 服务器代码仍可 `import { MessageType } from './message'`。
 */
export * from './game_model/messages';
