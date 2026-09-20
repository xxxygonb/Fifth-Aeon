# 修复说明文档（2026-09-20）

本批次修复分析报告中的中危问题 #6 ~ #15。每个问题按「问题 / 原因 / 影响 / 是否修复 / 修复方式」记录。所有修复均不改动游戏规则与数值，只涉及服务端健壮性、数据一致性与前端体验。

**验证状态**：Server `npx tsc --noEmit` 类型检查全绿；Client `npx ng build` 构建通过；一键启动实测通过（Server/Client 双端存活，API 正常响应）；新迁移机制在现有库上实测成功（`CCG.SchemaVersion` 自动创建并记录基线版本 0，schema 共 12 张表）。

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

高危问题 #1 ~ #5（admin 鉴权、轮抽奖励服务端校验、WS 冒名、非 JSON 消息防崩、JWT 默认密钥）与低危 #16 ~ #36 仍未处理，清单见会话报告或后续补充。
