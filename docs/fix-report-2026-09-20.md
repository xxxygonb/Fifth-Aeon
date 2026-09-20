# 修复说明文档（2026-09-20）

本批次包含两轮修复：中危问题 #6 ~ #15，以及低危问题 #16 ~ #36。每个问题按「问题 / 原因 / 影响 / 是否修复 / 修复方式」记录。所有修复均不改动游戏规则与数值，只涉及服务端健壮性、数据一致性、前端体验与部署卫生。

**验证状态**：
- Server `npx tsc --noEmit` 类型检查全绿；Client `npx ng build` 构建通过
- 一键启动实测通过（Server/Client 双端存活，API 正常响应）
- 数据库迁移机制在现有库上实测成功（`CCG.SchemaVersion` 自动创建并记录基线版本 0，schema 共 12 张表）
- 138 张卡牌用新 dist 实例化验证通过（卡名/描述汉化 0 残留）
- i18n 字典覆盖检查双 0 缺失

---

## Server 端

### #6 向已断线玩家发消息导致进程崩溃

- **问题**：`sendMessageTo()` 从连接表取出的 `ws` 可能为 `undefined`，直接访问 `ws.readyState` 抛 TypeError；`checkQueue()` 存在同类隐患。
- **原因**：[messenger.ts](../Fifth-Aeon-Server/src/messenger.ts) 的 `connections.get(target)` 返回值未判空。连接断开与发消息之间存在竞态窗口。
- **影响**：对局中一方被清理（prune）或刚断线时，向其发送对局事件会使整条消息链抛未捕获异常，甚至拖垮服务进程。
- **是否修复**：已修复。
- **修复方式**：两处均改为先判 `ws` 与 `ws.readyState === OPEN`，不满足时走离线队列分支；`checkQueue()` 在连接无效时直接返回。

### #7 未 await 的 Promise + make-promises-safe 导致进程意外退出

- **问题**：项目入口启用了 `make-promises-safe`（任何未处理的 Promise rejection 直接终止进程），而代码中存在多处「发完就忘」的 Promise 调用。
- **原因**：三处调用既无 `await` 也无 `catch`：
  1. [authentication.routes.ts:95](../Fifth-Aeon-Server/src/routes/authentication.routes.ts) 邮箱验证奖励发放；
  2. [collection.model.ts:22](../Fifth-Aeon-Server/src/models/collection.model.ts) 每日奖励时间戳更新；
  3. 旧版 db.ts 建表脚本读文件回调内 `throw err` + 未 await 的 `db.query(sql)`（该处随 #14 重写一并消除）。
- **影响**：任意一次奖励发放/建表失败都会产生 unhandled rejection，直接杀死整个服务进程，全服掉线。
- **是否修复**：已修复（入口 `make-promises-safe` 作为最后防线保留）。
- **修复方式**：前两处补 `await`，由路由层既有的 `try/catch → next(e)` 统一兜底；第三处随 #14 的 db.ts 重写改为 `await fs.promises.readFile` + `await db.query`。

### #8 轮抽开局无事务保护，可双花金币

- **问题**：`startDraft` 的「查金币 → 建轮抽 → 扣款存档」三步独立执行，无事务。
- **原因**：并发两个请求都能通过金币与重复检查（先查后写，检查与写入之间存在竞态窗口）；INSERT 成功后存档失败则金币未扣（白嫖）。
- **影响**：并发双击/脚本并发可重复扣费或免费开局，经济数据不一致。
- **是否修复**：已修复。
- **修复方式**：[draft.model.ts](../Fifth-Aeon-Server/src/models/draft.model.ts) 的 `startDraft` 重写为单事务：`BEGIN` → `SELECT ... FOR UPDATE` 锁定账户行（串行化并发请求）→ 事务内复查「已有轮抽」与金币余额 → 扣款 → INSERT 轮抽 → UPDATE 收藏 → `COMMIT`；任何一步失败统一 `ROLLBACK` 并在 `finally` 中归还连接。对外行为与返回值语义不变。

### #9 对局无断线/超时处理，可被永久挂起（含三副本笔误）

- **问题**：玩家断开后没有任何检测与处置机制，对局与其对象永久滞留；`getResponsiblePlayer()` 中 `currentChoices[0]` 抄写两遍（第二处应为 `[1]`）。
- **原因**：服务端从未监听 WebSocket `close` 事件；笔误系原代码抄写错误，且该函数从未被调用所以从未暴露。
- **影响**：一方掉线或关游戏后，对手只能手动退出自认输；`games` Map 与双方 `inGame` 状态滞留，无法开启新对局，内存缓释极慢（清理周期本身长达 60 小时）。
- **是否修复**：已修复（断线超时结算 + 笔误；回合内主动超时判负不在本批次范围）。
- **修复方式**：
  1. [messenger.ts](../Fifth-Aeon-Server/src/messenger.ts) 新增 `close` 事件监听与 `onDisconnect(token)` 钩子、`isConnected(token)` 查询；`deleteUser` 改为幂等实现；
  2. [server.ts](../Fifth-Aeon-Server/src/server.ts) 注册 `onDisconnect`：断线玩家若在对局中，给予 60 秒重连窗口，到期仍未重连（且未进入其他对局）则调用 `game.end()` 结算清理对局并释放双方的 `inGame` 状态；
  3. `getResponsiblePlayer()` 笔误在 Model 主副本、Server 副本、Client 副本三处同步修正为 `currentChoices[1]`；
  4. [gameServer.ts](../Fifth-Aeon-Server/src/gameServer.ts) 的 `playerNum` 判定补充 `=== -1`（`findIndex` 未命中的真实返回值），拒绝非玩家 token 的操作。

### #14 数据库无迁移机制，建表流程存在竞态

- **问题**：仅当 `ccg` schema 无任何表时执行一次 `makeDB.sql`；读文件回调中 `throw err` 且 `db.query(sql)` 未 await；建表中途失败会留下「半成品库」被判为已存在，运行时报缺表；已有库的 schema 变更（加列/新表）没有任何升级通道。
- **原因**：初始实现把建表当一次性动作，且混用回调与 Promise。
- **影响**：首次启动断电/失败后需手工清库；后续任何 schema 演进都必须手工改库。
- **是否修复**：已修复。
- **修复方式**：
  1. [db.ts](../Fifth-Aeon-Server/src/db.ts) 重写：建表改为 `await fs.promises.readFile` + `await db.query`，失败会被 startDB 的 catch 捕获并正常报错退出；
  2. [makeDB.sql](../Fifth-Aeon-Server/sql/makeDB.sql) 全部语句幂等化（`CREATE SCHEMA IF NOT EXISTS`、全部 `CREATE TABLE IF NOT EXISTS`、索引 `IF NOT EXISTS`、枚举类型用 `DO $$ ... EXCEPTION WHEN duplicate_object` 幂等创建）——半成品库重启即可自动补齐；
  3. 新增版本化迁移机制：`CCG.SchemaVersion` 表记录已应用版本，启动时按序执行 `sql/migrations/NNNN_描述.sql` 中编号更大的脚本（单事务 + 版本回写）。以后加列/新表只需新增一个迁移文件，旧库自动升级。

### #15 config.json 无模板文件，首次部署无从下手

- **问题**：`config.json` 被 gitignore（含连接串与 jwtSecret，正确），但仓库没有模板；start.ps1 的报错提示还指引用户去编辑一个不存在的文件。
- **原因**：配置文件未随仓库分发示例。
- **影响**：新环境克隆后服务端因缺配置无法启动，且缺乏指引。
- **是否修复**：已修复。
- **修复方式**：新增 [config.example.json](../Fifth-Aeon-Server/config.example.json)（含占位连接串、jwtSecret 提示、sendgridAPIKey）；start.ps1 新增步骤：启动时检测 `config.json` 缺失则自动从模板复制，并提示修改口令。

---

## Web Client 端

### #10 断线重连后本地排队的消息全部丢失

- **问题**：`Messenger.onConnect()` 中补发离线队列被 `if (this.loggedIn)` 拦截，而 `loggedIn` 全文件从未赋值为 `true`，是死标志。
- **原因**：历史遗留条件，重构后赋值代码被删，判断恒假。
- **影响**：断线期间 `sendMessageToServer` 压入 `messageQueue` 的所有消息（SetDeck、JoinQueue、对局操作等）在重连后永不发送，玩家操作静默丢失。
- **是否修复**：已修复。
- **修复方式**：[messenger.ts](../Fifth-Aeon-Web-Client/src/app/messenger.ts) 删除 `loggedIn` 字段，连接建立（`onConnect`）后无条件执行 `emptyMessageQueue()` 补发积压消息（先发 Connect 再冲队列，服务端顺序正确）。

### #11 对局结束后向服务器发送两次「幽灵 Quit」

- **问题**：正常结算流程会发出两次 Quit：结算弹窗关闭 → `returnToLobby()` 发第一次 → 导航销毁 GameComponent → `ngOnDestroy` 调 `client.exitGame(false)` 发第二次。
- **原因**：`exitGame` 无「游戏是否仍在进行」的判断，`ngOnDestroy` 的兜底调用无法区分「中途退出」与「结算后路过」。
- **影响**：多人对局中服务器在游戏已结束后收到重复 Quit，状态易错乱；AI 对局每次结算都触发 `Sent action to empty game model` 告警。
- **是否修复**：已修复。
- **修复方式**：[client.ts](../Fifth-Aeon-Web-Client/src/app/client.ts) 的 `exitGame()` 增加 `state === ClientState.InGame` 守卫，仅在对局进行中才调用 `gameManager.exitGame()`（发送 Quit）；结算导航时 state 已转为 InLobby，`ngOnDestroy` 的调用自然跳过 Quit，而中途退出的首次调用不受影响。

### #12 localStorage 数据损坏导致应用启动即白屏

- **问题**：`SoundManager.loadSettings()` 与 `TipService` 构造函数中的 `JSON.parse` 均无异常保护，且都在根服务初始化阶段执行。
- **原因**：历史版本格式变更、浏览器清理工具或手动修改都可能产生非法 JSON，解析异常在 DI 初始化时抛出。
- **影响**：白屏且无法自行恢复（每次启动都读同一份坏数据）。
- **是否修复**：已修复。
- **修复方式**：[sound.ts](../Fifth-Aeon-Web-Client/src/app/sound.ts) 与 [tips.ts](../Fifth-Aeon-Web-Client/src/app/tips.ts) 均以 try/catch 包裹解析，失败时 `console.warn` 记录、删除损坏的 key 并回退默认值。

### #13 生产构建被强制为离线模式

- **问题**：`environment.prod.ts` 中 `serverless: true`，而 `connect()`、认证等逻辑都以该标志为开关。
- **原因**：原始项目的生产占位配置从未随部署形态调整。
- **影响**：`ng build` 产物无法联机（无账号、无大厅、无对局），自建服务器部署不可用。
- **是否修复**：已修复。
- **修复方式**：[environment.prod.ts](../Fifth-Aeon-Web-Client/src/environments/environment.prod.ts) 改为 `serverless: false`（`production: true` 不变），生产构建与开发模式行为一致；`angular.json` 的 fileReplacements 无需改动。

---

## 附：修复涉及的文件清单

| 端 | 文件 | 对应问题 |
|---|---|---|
| Server | src/messenger.ts | #6、#9 |
| Server | src/server.ts | #9 |
| Server | src/gameServer.ts | #9 |
| Server | src/game_model/serverGame.ts | #9（笔误） |
| Server | src/routes/authentication.routes.ts | #7 |
| Server | src/models/collection.model.ts | #7 |
| Server | src/models/draft.model.ts | #8 |
| Server | src/db.ts | #7、#14 |
| Server | sql/makeDB.sql | #14 |
| Server | config.example.json（新增） | #15 |
| Model 主副本 | serverGame.ts | #9（笔误，与两副本同步） |
| Client | src/app/game_model/serverGame.ts | #9（笔误） |
| Client | src/app/messenger.ts | #10 |
| Client | src/app/client.ts | #11 |
| Client | src/app/sound.ts | #12 |
| Client | src/app/tips.ts | #12 |
| Client | src/environments/environment.prod.ts | #13 |
| 启动脚本 | start.ps1 | #15（自动建配置） |

## 遗留事项（未在本批次，等待确认）

高危问题 #1 ~ #5（admin 鉴权、轮抽奖励服务端校验、WS 冒名、非 JSON 消息防崩、JWT 默认密钥）仍未处理，等待确认。

---

# 低危问题修复批次（#16 ~ #36）

## A 组：对局与游戏数据正确性

### #16 阻挡宣告先改状态后校验

- **问题**：`declareBlockerAction` 先 `blocker.setBlocking(blocked.getId())` 再校验 `canBlockTarget`，校验失败也不回滚。
- **原因**：原始代码顺序错误。
- **影响**：被拒绝的阻挡请求已在棋盘上留下阻挡状态，后续战斗结算基于污染的棋盘，表现为"伤害算错"类难复现问题。
- **是否修复**：已修复。
- **修复方式**：三副本 [serverGame.ts](../Fifth-Aeon-Model/serverGame.ts) 调整为**先校验后变更**——`canBlockTarget` 通过后才 `setBlocking`。

### #17 非法卡牌/单位 id 使动作处理链崩溃

- **问题**：`cardChoiceAction`、`playCardAction` 对未知 id 调用 `getCardById`/`getUnitById` 直接 throw，`handleAction` 无顶层保护。
- **原因**：个别动作处理器有防御，顶层没有兜底。
- **影响**：客户端状态不同步或恶意发包会让该玩家的对局事件流中断，双方卡死。
- **是否修复**：已修复。
- **修复方式**：三副本 `handleAction` 增加**顶层 try/catch**——任何动作处理异常都记日志、返回 null（服务端回复 GameActionError），对局继续。

### #18 被拒绝的动作也写入回放日志

- **问题**：`handleAction` 中 `actionLog.push(action)` 在成败判定之前执行。
- **原因**：push 位置错误。
- **影响**：回放重演与真实对局漂移，回放作为仲裁依据失效。
- **是否修复**：已修复。
- **修复方式**：三副本将 push 移到 `sig === true` 之后，仅成功动作入回放。

### #19 静态共享 RNG 破坏回放确定性

- **问题**：`ServerGame.rng` 是 static，所有并发对局共享同一条随机流。
- **原因**：原始设计把 RNG 挂在类上，`setSeed` 每局重置同一流。
- **影响**：并发对局交错消费随机数，`getReplay()` 记录的 seed+actions 无法复现任何一局。
- **是否修复**：已修复。
- **修复方式**：三副本将 RNG 改为**实例成员**——`setSeed` 只记录静态 seed，构造函数中 `this.rng = new Prando(this.seed)`，`shuffle`/`getResponsiblePlayer` 改用 `this.rng`。调用方（gameServer/gameManager 的 `setSeed(...)`）无需改动。

### #20 轮抽满编卡仍被选中，白耗一次选择

- **问题**：`deckList.addCard` 超过同名上限时静默忽略，`draft.pickCard` 无条件推进选择轮。
- **原因**：addCard 无返回值，draft 无法感知拒绝。
- **影响**：玩家第 5 张同名卡被"选走"却不入卡组，损失一次选择；极端情况卡数凑不齐下限。
- **是否修复**：已修复。
- **修复方式**：三副本 `addCard` 返回 `boolean`；[draft.ts](../Fifth-Aeon-Model/draft.ts) `pickCard` 在拒绝时把该卡从本轮选项中移除（玩家从剩余选项继续），选择不再被消耗。

### #21 手牌全弃时卡牌绕过坟场

- **问题**：`player.discard` 中 `count >= hand.length` 分支直接 `this.hand = []`，不入坟场、不触发回调。
- **原因**：快捷路径遗漏了与正常路径一致的入坟逻辑。
- **影响**：弃掉的卡凭空消失，坟场检索效果查不到、弃牌回调不执行——与卡牌文本描述的行为不符。
- **是否修复**：已修复。
- **修复方式**：三副本 [player.ts](../Fifth-Aeon-Model/player.ts) 全弃分支改为逐张 `removeCardFromHand` + `game.addToCrypt`，并照常触发回调。

## B 组：资源泄漏与稳定性

### #22 匹配队列幽灵玩家 + 私房游戏 Map 无限增长

- **问题**：①`onJoinQueue` 未登录分支缺 `return`，未认证 token 仍入队；②`privateGames` 只在加入/取消时删除，断线与遗忘的条目永不回收。
- **原因**：①漏写控制流；②私房条目无生命周期管理。
- **影响**：①队列污染、匹配空转；②反复创建私房使 Map 无限增长，长期运行服务器内存持续上涨。
- **是否修复**：已修复。
- **修复方式**：[matchmaking.ts](../Fifth-Aeon/Fifth-Aeon-Server/src/matchmaking.ts) ①补 `return`；②条目改为 `{host, created}` 结构——`newPrivateGame` 时惰性清理超过 1 小时的旧条目，并在玩家断线时由 server.ts 的 `onDisconnect` 钩子调用新增的 `removePrivateGamesFor(token)` 立即清理。

### #23 对局清理周期实为 60 小时

- **问题**：`cleaningTime = 1000*60*60*60`（60h），注释写 "1 hour"。
- **原因**：多打了一个 `*60`。
- **影响**：闲置账号、对局与连接对象滞留近三天才被清理，内存缓释极慢。
- **是否修复**：已修复。
- **修复方式**：[server.ts](../Fifth-Aeon/Fifth-Aeon-Server/src/server.ts) 常量修正为 `1000*60*60`（1 小时）。

### #24 P2P Firebase 信令监听器/会话随对局反复泄漏

- **问题**：`P2PClient` 订阅信令流不退订、`destroy()` 不调 `signaling.disconnect()`；`FirebaseSignalingService` 的 `onChildAdded` 句柄未保存、`disconnect` 不取消；`messenger.setP2PTransport` 对旧 `connected$`/`data$` 的订阅不退订。
- **原因**：P2P 生命周期管理不完整。
- **影响**：好友对局连打 N 局泄漏 N 份 Firebase 监听器，旧对局信令通道仍存活，可能截获新对局信令，表现为第二局之后连接异常。
- **是否修复**：已修复。
- **修复方式**：[firebase-signaling.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/p2p/signaling/firebase-signaling.ts) 保存退订句柄并在 `disconnect` 中调用（同时 complete 信号流）；[p2p-client.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/p2p/p2p-client.ts) 保存 `onSignal` 订阅并在 `destroy` 中退订 + 调用 `signaling.disconnect()`；[messenger.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/messenger.ts) 的 `setP2PTransport` 统一管理 P2P 订阅列表。

### #28 Messenger 定时器不清理、离线期间 Ping 积压

- **问题**：Ping/自动重连 `setInterval` 句柄未保存（重复调用 `startConnection` 会叠加定时器）；断线期间 Ping 持续入队。
- **原因**：定时器生命周期从未管理。
- **影响**：重连瞬间冲刷积压 Ping；定时器叠加放大问题。
- **是否修复**：已修复。
- **修复方式**：[messenger.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/messenger.ts) 保存两个定时器句柄；`startConnection` 加防重复守卫；Ping 定时器仅在连接存活时发送；新增 `destroy()` 提供永久停止入口。

## C 组：用户体验

### #25 结算奖励无 catch，退役后弹窗永久卡 Loading

- **问题**：`openEndDialog` 的 `rewardMessage` 无 `.catch`；`draft.retire()` 不清残留的 `getGameReward` 回调。
- **原因**：Promise 错误路径未处理；retire 与 playGame 的回调生命周期不对称。
- **影响**：复现序列「放弃轮抽 → 打普通对局 → 结算」必现弹窗永久卡 Loading，且产生 unhandled rejection；网络抖动时奖励加载失败同样卡死。
- **是否修复**：已修复。
- **修复方式**：[draft.service.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/draft.service.ts) 的 `retire()` 清空 `client.getGameReward`；[client.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/client.ts) 补 `.catch`，失败时在弹窗显示「奖励加载失败」（新增 zh-CN-2 词条）。顺带修复 `startDraft` 的 catch 在网络层错误时会二次抛 `resp.error` undefined 的问题。

### #26 开卡包失败反而扣减本地卡包

- **问题**：`openPack` 的 catch 分支调用 `this.collection.removePack()`。
- **原因**：错误处理写反——失败时误删本地库存。
- **影响**：服务器临时故障时卡包凭空少一个，且随下次 `save()` 持久化，玩家真实丢包。
- **是否修复**：已修复。
- **修复方式**：[collection.service.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/collection.service.ts) 错误分支不再触碰 collection 状态，仅返回错误信息。

### #27 checkDaily 无 catch

- **问题**：每次 `load()` 都触发的每日奖励检查无错误处理。
- **原因**：fire-and-forget 写法。
- **影响**：token 过期/服务器 5xx 时每次加载产生 unhandled rejection，污染控制台。
- **是否修复**：已修复。
- **修复方式**：[collection.service.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/collection.service.ts) 补 `.catch` 降级为 `console.warn`。

### #29 onAuth 回调只增不减

- **问题**：`afterLogin()` 每次调用都向全局回调数组追加一个永不移除的闭包。
- **原因**：无一次性 Promise 复用机制。
- **影响**：反复进出登录相关页面累积回调，登录时全部历史回调重放，闭包持有组件作用域造成泄漏。
- **是否修复**：已修复。
- **修复方式**：[authentication.service.ts](../Fifth-Aeon/Fifth-Aeon-Web-Client/src/app/user/authentication.service.ts) 引入共享 `afterLoginPromise`（首次等待登录时创建并复用），`logout()` 时重置。

## D 组：开发与部署卫生

### #30 `npm test` 必然失败

- **问题**：test 脚本依赖未声明的 ts-node，且项目无测试文件。
- **原因**：依赖清单与脚本不同步。
- **影响**：测试入口形同虚设，误导使用者。
- **是否修复**：已修复（移除 test 脚本；保留 mocha/chai devDependencies 以便将来补测试）。

### #31 engines 声明 node 8.9.4

- **问题**：与实际要求（Node 16+）矛盾。
- **影响**：部署时 EBADENGINE 告警，误导安装老版本。
- **是否修复**：已修复（改为 `>=16`）。

### #32 start.sh 与 start.ps1 逻辑分叉

- **问题**：sh 仍是旧行为——仅 dist 缺失才编译、只清 2222 端口、健康检查不等 Server。
- **影响**：Linux/macOS 路径可能跑陈旧产物、端口占用静默失败、就绪误报。
- **是否修复**：已修复。
- **修复方式**：[start.sh](../start.sh) 对齐 ps1：新增 config.json 模板自动创建、每次增量编译、双端口清理、双服务独立就绪校验（curl 加 --noproxy）。

### #33 start.ps1 硬编码默认数据库口令

- **问题**：未设 PGPASSWORD 时直接回退 `postgres`。
- **影响**：口令不同的机器上建库检查静默失败。
- **是否修复**：已修复。
- **修复方式**：[start.ps1](../start.ps1) 优先从 `config.json` 的连接串解析口令（正则提取），解析失败才回退默认值。

### #34 setLocale 无参数校验

- **问题**：传入非法 locale 后字典查找每次抛 TypeError。
- **影响**：一处坏配置导致全部文本渲染崩溃（含服务端协议文本）。
- **是否修复**：已修复。
- **修复方式**：三副本 [i18n/index.ts](../Fifth-Aeon/Model/i18n/index.ts) 的 `setLocale` 校验 locale 是否在字典表中，非法值保持原 locale 并告警。

### #35 三副本 7 个文件字节级格式漂移

- **问题**：log.ts 与 cards/triggers/ 下 6 个文件三副本 MD5 不一致（内容归一化后逐行相同，仅行尾/尾随空白差异）；resource.ts 三副本已一致，旧"4 差异文件"口径过时。
- **影响**：未来做哈希同步校验或覆盖式同步时会误报。
- **是否修复**：已修复。
- **修复方式**：归一化比对确认内容一致后，用 Model 主副本统一覆盖两副本，三副本哈希已完全一致；项目记忆中的差异文件口径更新为 animator.ts、card-types/item.ts、serverGame.ts。

### #36 gulp default 任务永不执行 assets

- **问题**：`gulp.series(watchSrc, assets)`——watch 永不结束，assets 排在其后永不运行。
- **影响**：`gulp`（default）产物缺 JSON 资源；未来往 src 放运行时 JSON 会部署即缺文件。
- **是否修复**：已修复。
- **修复方式**：[gulpfile.js](../Fifth-Aeon/Server/gulpfile.js) 改为 `series(scripts, assets, watchSrc)`——先完整构建再 watch。

## 低危批次涉及文件清单

| 端 | 文件 | 对应问题 |
|---|---|---|
| Model | serverGame.ts | #16、#17、#18、#19 |
| Model | draft.ts、deckList.ts、player.ts | #20、#21 |
| Model | i18n/index.ts | #34 |
| Server 副本 | game_model/{serverGame,draft,deckList,player}.ts、game_model/i18n/index.ts | 同步上述修改 |
| Server | src/matchmaking.ts | #22 |
| Server | src/server.ts | #22、#23 |
| Server | package.json | #30、#31 |
| Server | gulpfile.js | #36 |
| Client 副本 | game_model/{serverGame,draft,deckList,player}.ts、game_model/i18n/index.ts | 同步上述修改 |
| Client | src/app/p2p/{p2p-client.ts,signaling/firebase-signaling.ts} | #24 |
| Client | src/app/messenger.ts | #24、#28 |
| Client | src/app/draft.service.ts、client.ts | #25 |
| Client | src/app/collection.service.ts | #26、#27 |
| Client | src/app/user/authentication.service.ts | #29 |
| Client | src/app/i18n/zh-CN-2.ts | #25 词条 |
| 部署 | start.sh、start.ps1 | #32、#33 |

## 遗留事项（更新后）

仅剩高危问题 #1 ~ #5（admin 鉴权、轮抽奖励服务端校验、WS 冒名、非 JSON 消息防崩、JWT 默认密钥）等待确认处理。
