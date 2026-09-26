# Fifth Aeon 项目中文文档

> 集换式卡牌游戏（CCG）完整工程：游戏模型 + 服务器 + Web 客户端，已完成简体中文汉化与国际化改造。

## 目录

- [项目架构](#项目架构)
- [三仓库关系](#三仓库关系)
- [启动方法](#启动方法)
- [开发方法](#开发方法)
- [国际化与汉化说明](#国际化与汉化说明)
- [常见问题](#常见问题)

---

## 项目架构

```
Fifth-Aeon/
├── start.bat                    # Windows 一键启动
├── start.sh                     # Linux/macOS 一键启动
├── docs/PROJECT_CN.md           # 本文档
│
├── Fifth-Aeon-Model/            # 共享游戏核心（纯 TypeScript 库，无 npm 依赖）
│   ├── cards/                   # 137 张卡牌定义（4 阵营 × 卡牌工厂函数）
│   │   ├── mechanics/           # 卡牌效果机制（getText 生成卡牌描述）
│   │   ├── targeters/           # 目标选择器（"一个友方单位"等片段）
│   │   └── triggers/            # 触发时机（打出/亡语/黄昏…前缀）
│   ├── card-types/              # 单位/法术/装备/附魔基类
│   ├── game.ts                  # 规则引擎核心
│   ├── serverGame.ts            # 服务端权威规则执行器
│   ├── clientGame.ts            # 客户端预测渲染用规则执行器
│   ├── log.ts                   # 游戏日志生成（已模板化）
│   ├── i18n/                    # ★ 共享模型字典（卡名/描述/日志）
│   └── ai/、scenarios/           # AI 与场景
│
├── Fifth-Aeon-Server/           # 游戏服务器（Express + ws + PostgreSQL）
│   ├── src/
│   │   ├── index.ts             # 入口，端口 2222
│   │   ├── server.ts            # HTTP 路由 + WebSocket 装配
│   │   ├── matchmaking.ts       # 匹配队列 / 私密房（内存实现）
│   │   ├── gameServer.ts        # 单局对战仲裁
│   │   ├── db.ts                # PostgreSQL 连接（本地免 SSL）
│   │   ├── i18n-messages.ts     # ★ 服务端消息字典
│   │   ├── routes/、models/      # REST API（账号/卡组/收藏/轮抽…）
│   │   └── game_model/          # Model 子模块副本
│   ├── sql/makeDB.sql           # 建库脚本（首次启动自动执行）
│   ├── config.json              # 本地数据库连接配置（含密钥，勿提交）
│   └── dist/                    # gulp 编译产物
│
└── Fifth-Aeon-Web-Client/       # Web 客户端（Angular 14 + Angular Material）
    ├── src/app/
    │   ├── i18n/                # ★ 客户端 UI 字典 + I18nService + tr 管道
    │   ├── game_model/          # Model 子模块副本
    │   ├── landing/ lobby/      # 登录落地页 / 大厅
    │   ├── game/                # 对局界面（手牌/棋盘/日志/资源）
    │   └── …                    # 卡组编辑器、开包、轮抽、P2P 等
    ├── src/environments/        # serverless 开关
    └── angular.json
```

### 运行时架构

```
浏览器 (localhost:4200, Angular)
   │  REST  http://localhost:2222  → 账号/卡组/收藏/轮抽
   │  WS    ws://localhost:2222    → 匹配、私密房、对局实时消息
   ▼
Node 服务器 (localhost:2222)
   │  对局/匹配：纯内存（不依赖 DB）
   │  账号/收藏：PostgreSQL (localhost:5432, 库名 ccg)
   ▼
PostgreSQL 16
```

三种对战模式：

| 模式 | 依赖服务器 | 说明 |
|------|-----------|------|
| 单人 vs AI | 否 | `ServerGame` 直接跑在浏览器内 |
| P2P 对战 | 仅信令 | simple-peer DataChannel，Firebase 信令或手动复制码 |
| 联机对战 | 是 | 匹配队列 / 私密房邀请，服务器权威仲裁 |

## 三仓库关系

- **Fifth-Aeon-Model** 是规则核心，被 Server 与 Client 通过 **git submodule** 引用：
  - Server：`src/game_model`（旧版本 7c40138，含 4 个文件的差异：animator.ts / card-types/item.ts / resource.ts / serverGame.ts）
  - Client：`src/app/game_model`（5759634，与独立 Model 目录一致）
- **修改 Model 时必须同步三处副本**（本工程已完成一次全量同步；差异文件除外）。可用以下命令同步（示例：同步 i18n 目录）：

  ```powershell
  Copy-Item Fifth-Aeon-Model\i18n\* Fifth-Aeon-Web-Client\src\app\game_model\i18n\ -Force
  Copy-Item Fifth-Aeon-Model\i18n\* Fifth-Aeon-Server\src\game_model\i18n\ -Force
  ```

- 两份子模块的 4 个差异文件**不要互相覆盖**（Server 版含本地修复）。

## 启动方法

### 一键启动（推荐）

```powershell
# Windows
.\start.bat
# Linux / macOS
./start.sh
```

脚本自动完成：Node/PostgreSQL 检查 → 缺库自动建库（默认密码 postgres）→ 依赖安装 → 服务器编译 → 启动两端 → 健康检查 → 打开浏览器。
日志输出到 `logs/server.log`、`logs/client.log`。

### 手动启动

```powershell
# 0) 前置：PostgreSQL 运行中；创建数据库（首次）
psql -U postgres -c "CREATE DATABASE ccg;"

# 1) 服务器
cd Fifth-Aeon-Server
npm install
npx gulp scripts          # 编译 TS → dist/
node dist/index.js        # 端口 2222；首次启动自动建表

# 2) 客户端
cd Fifth-Aeon-Web-Client
npm install --legacy-peer-deps
npx ng serve              # http://localhost:4200
```

### 数据库配置

`Fifth-Aeon-Server/config.json`（已被 .gitignore 忽略）：

```json
{
    "connectionString": "postgres://postgres:postgres@localhost:5432/ccg",
    "jwtSecret": "local-dev-secret",
    "sendgridAPIKey": null
}
```

- 密码不同请改 connectionString；也可用环境变量 `DATABASE_URL`
- 连接串包含 `sslmode=require` 时才启用 SSL（云端库），本地库自动免 SSL

### 游戏流程

1. 打开 http://localhost:4200 → **New Player → Play as Guest**（游客账号自动创建）或注册账号
2. 初始设置 → **Continue To Lobby**
3. 大厅选模式：**Singleplayer → Play vs A.I**（最快验证）或 **Multiplayer → Public Game / P2P Game**
4. 选卡组（游客自带 4 副起始套牌）→ 开打

## 开发方法

| 任务 | 命令 |
|------|------|
| 服务器编译 | `cd Fifth-Aeon-Server && npx gulp scripts` |
| 服务器类型检查 | `cd Fifth-Aeon-Server && npx tsc -p tsconfig.json --noEmit` |
| 服务器监听改动 | `npx gulp watch`（自动重编译） |
| 客户端开发服务 | `cd Fifth-Aeon-Web-Client && npx ng serve`（热重载） |
| 客户端生产构建 | `npx ng build` |
| 全卡文案验证 | `cd g:\Fifth-Aeon && node scan-all-cards.js`（期望残留 0） |
| i18n 覆盖检查 | `cd g:\Fifth-Aeon && node check-i18n.js`（期望双 0 缺失） |
| 三副本同步检查 | `cd g:\Fifth-Aeon && node check-model-sync.js`（期望 OK；不一致时退出码 1） |

> 旧版 `npm test`（mocha + ts-node）因依赖缺失且无测试文件已移除。

- 前端改 TS/HTML/CSS 会热重载；改 `game_model` 同样热重载（它在 src 内）
- 改服务器 TS 后需重新 `gulp scripts` 并重启 `node dist/index.js`

### 卡牌开发

**添加新卡牌请阅读 [CARD_CREATION_GUIDE_CN.md](./CARD_CREATION_GUIDE_CN.md)**——包含架构总览、费用/种族/目标器/触发器/机制参考手册、自定义机制开发模板、三副本同步与验证清单、常见坑。

### 关键代码路径

- 出牌流程：`game.component.ts select()` → `ClientGame.playCardExtern` → WS `GameAction` → `ServerGame` 仲裁 → `GameEvent` 广播 → 双端 `ClientGame` 渲染
- 卡牌描述：`cards/mechanics/*.ts getText()` → `Permanent.getText()` 组装（句号/前缀 locale 感知）
- 对局日志：`log.ts`（模板字典化）

## 国际化与汉化说明

### 架构

```
共享模型字典（卡名/描述/日志）          客户端 UI 字典                服务端消息字典
game_model/i18n/                       src/app/i18n/                Server/src/i18n-messages.ts
├── index.ts   t() / tf() / setLocale  ├── i18n.service.ts (tr)     └── tsrv()
├── zh-CN.ts（触发器/日志/类型/机制）   ├── tr.pipe.ts ('| tr')
├── zh-CN-cards.ts（137 卡名）          ├── zh-CN.ts / zh-CN-2.ts
└── en-US.ts                           └── en-US.ts
```

- **设计原则：英文原文即字典 key**，查不到时优雅降级为英文——规则引擎/网络协议永不因缺翻译而出错
- `t('Flying')` 静态文本；`tf('Deal {n} damage to {target}.', {n, target})` 动态模板
- 默认语言 **zh-CN**（客户端 `I18nService`，localStorage 键 `fa.locale`；服务端默认 zh-CN，可用环境变量 `FA_LOCALE=en-US` 切换）
- 设置界面可切换 中文/English（切换后自动刷新页面）
- 客户端启动时通过 `APP_INITIALIZER` 调用 `setLocale()`，卡牌名/描述/日志即时切换

### 如何新增/修正翻译

1. 卡牌名 → `game_model/i18n/zh-CN-cards.ts`（三副本同步）
2. 卡牌描述/关键词 → `game_model/i18n/zh-CN.ts` 的 Mechanic 区块（三副本同步）
3. 界面文本 → `src/app/i18n/zh-CN.ts` 或 `zh-CN-2.ts`，代码里对应 `| tr` / `i18n.tr()`
4. 服务器消息 → `Server/src/i18n-messages.ts`

### 汉化覆盖范围

| 类别 | 状态 |
|------|------|
| 登录/注册/大厅/设置/初始引导 | ✔ |
| 对局界面（回合按钮/提示/菜单） | ✔ |
| 137 张卡牌名称与描述 | ✔（缺条目自动回退英文） |
| 游戏日志（攻击/出牌/阻挡） | ✔ |
| 规则关键词（打出/亡语/飞行/亡语等 tooltip） | ✔ |
| 教学提示（tips） | ✔ |
| 服务器错误消息 | ✔ |
| 锦标赛页面长文 | 部分回退英文，可按字典补齐 |

## 常见问题

**Q: 服务器启动报 "Could not connect to postgres database"**
PostgreSQL 未启动或密码不对。启动服务 `postgresql-x64-16`，核对 `config.json`。

**Q: /report 返回 Cannot GET /report**
路由注册被 `startDB()` 异常中断，即数据库连不上，同上。

**Q: 客户端显示 Server Unavailable**
服务器没起来。先确认 `http://localhost:2222/report` 有响应。仍可点 "Play Offline" 离线玩（AI/本地模式）。

**Q: 端口被占用**
一键脚本会自动清理 2222/4200；手动方式可 `netstat -ano | findstr :2222` 找到 PID 后 `taskkill /PID <pid> /F`。

**Q: 部分卡牌/文本仍是英文**
字典缺条目时自动回退英文（设计如此）。按上文"如何新增/修正翻译"补充即可，不影响运行。

**Q: 卡组/收藏数据保存在哪？**
PostgreSQL `ccg` 库。游客账号数据也在库里（账号角色 guest）。

**Q: 如何切换语言？**
游戏内 设置 → Language；或清除 localStorage 的 `fa.locale` 后刷新（默认中文）。

**Q: node 版本要求？**
推荐 Node 18+（已在 22 验证）。服务器依赖已升级 pg@8 以兼容新 Node。

---

*文档生成于 2026-09-20，对应工程本地化改造完成版。*
