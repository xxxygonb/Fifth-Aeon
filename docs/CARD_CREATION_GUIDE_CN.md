# 卡牌添加教程（Card Creation Guide）

> 面向**第一次接触 Fifth Aeon** 的开发者与想做自制卡牌的玩家。
>
> 读完本教程，你能做到三件事：
> 1. **不写代码**，用游戏内的卡牌编辑器拼出一张新卡（第 2 章）；
> 2. **写代码**把一张新卡加进游戏（第 3 章）；
> 3. 现有效果不够用时，**从零实现一个全新的效果器**——以「狂怒：每次受到伤害获得 +1/+1」为例完整走一遍（第 6 章）。
>
> 预备知识：TypeScript 基础语法。不需要了解本项目。

---

## 这份教程怎么读

按你的目的选路径，不必从头读到尾：

| 你的目的 | 阅读路径 |
|---|---|
| 快速做一张「用现有效果」的卡 | 第 1 章 → 第 2 章（编辑器路线） |
| 把卡牌写进代码库、随版本发布给所有玩家 | 第 1 章 → 第 3 章，卡牌构成细节不懂时查第 4 章 |
| 现有效果不够用，要写一个新效果 | 上面全部 → 第 5 章（效果器原理）→ 第 6 章（实战） |

**术语对照**（全文统一使用左列；旧文档与代码注释里的「机制」是同一个意思）：

| 本教程 | 代码里 | 一句话解释 |
|---|---|---|
| **效果器** | `Mechanic` | 「这张卡做什么」的最小实现单元，卡牌编辑器 UI 使用此名 |
| **目标器** | `Targeter` | 「对谁做」 |
| **触发器** | `Trigger` | 「什么时候做」 |

---

## 第 1 章 五分钟看懂卡牌系统

### 1.1 一张卡 = 静态数据 + 效果器组合

先看一张**真实存在**的卡——生长阵营的「狼崽」，代码在 `Fifth-Aeon-Model/cards/growthCards.ts`：

```ts
export function wolfPup() {
    return new Unit(
        'WolfPup',            // ① dataId：全局唯一 ID，定稿后永不更改
        'Wolf Pup',           // ② 卡名（英文原文，同时是翻译 key）
        'wolf-head.png',      // ③ 卡面图片文件名
        UnitType.Wolf,        // ④ 种族
        new Resource(1, 0, {  // ⑤ 费用：1 点能量 + 1 点生长需求
            Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0
        }),
        new SelfTarget(),     // ⑥ 卡牌目标器：效果指向自身
        2,                    // ⑦ 攻击力
        1,                    // ⑧ 生命值
        [                     // ⑨ 效果器列表：这张卡的全部"效果"
            new BuffTarget(0, 1).setTrigger(new Affinity())
        ]
    );
}
```

⑨ 是这张卡的灵魂：`BuffTarget(0, 1)` 是一个效果器（给目标 +0/+1），`.setTrigger(new Affinity())` 给它换上触发器（默认是「打出时」，这里换成「共鸣：首次召唤同种族单位时」）。连起来读就是卡面文字：

> **共鸣**：令此单位获得 0/+1。

**这就是本项目的核心设计：卡牌系统是纯数据驱动的组合式系统。** 绝大多数新卡不需要写任何新逻辑，用现有效果器「拼装」即可；只有当现有效果器真的表达不了你的设计时，才需要写新效果器（第 5、6 章）。

### 1.2 代码放在哪里：一源两副本

仓库是同一根目录下的三个工程：

```
Fifth-Aeon\
├── Fifth-Aeon-Model\                  ← ★ 唯一权威源：卡牌、效果器、规则全在这里写
│   ├── cards\
│   │   ├── growthCards.ts             ← 生长阵营卡牌（狼崽在此）
│   │   ├── decayCards.ts / renewalCards.ts / synthCards.ts
│   │   ├── cardList.ts                ← 卡牌注册表
│   │   ├── mechanicList.ts            ← 效果器注册表
│   │   ├── targeterList.ts / triggerList.ts
│   │   ├── mechanics\                 ← 全部效果器实现
│   │   ├── targeters\                 ← 全部目标器实现
│   │   └── triggers\                  ← 全部触发器实现
│   ├── card-types\                    ← Card/Unit/Spell/Item/Enchantment 基类
│   ├── mechanic.ts                    ← Mechanic 基类体系
│   ├── resource.ts                    ← 费用系统
│   └── i18n\                          ← 文案翻译字典
├── Fifth-Aeon-Server\src\game_model\  ← 生成的副本（禁止手改）
├── Fifth-Aeon-Web-Client\src\app\game_model\ ← 生成的副本（禁止手改）
└── docs\
```

> **黄金规则**：游戏逻辑只写在 `Fifth-Aeon-Model`，改完运行 `node model-sync.js`，两个副本自动刷新（第 10 章）。直接手改副本会被下次同步覆盖。

### 1.3 四张自动注册表：为什么你不用「登记」

`Fifth-Aeon-Model/cards/` 下有四张注册表，全部**自动收集**：

| 注册表 | 文件 | 收集方式 | 作用 |
|---|---|---|---|
| 卡牌 | `cardList.ts` | 按文件收集各阵营 `export function` 工厂 | 游戏内可用卡牌 |
| 效果器 | `mechanicList.ts` | 枚举 `mechanics/*.ts` 模块的**所有导出类** | 效果实现 + 编辑器下拉 |
| 目标器 | `targeterList.ts` | 枚举 `targeters/*.ts` | 目标选择方式 + 编辑器下拉 |
| 触发器 | `triggerList.ts` | 枚举 `triggers/*.ts` | 触发时机 + 编辑器下拉 |

只要你的类/工厂函数在已注册文件里 `export`，它就自动出现在编辑器下拉、能被存档与网络协议序列化重建。

> ⚠️ 这也是一条铁律的来源：**注册表会枚举模块里的每一个导出**。所以效果器文件里只应放「具体效果器类」；抽象基类必须放独立文件（如 `mechanics/skill.ts`），否则基类自己也会被注册成一个空白条目（2026-09 真实修过的 bug，见第 11 章坑 11）。

---

## 第 2 章 不写代码：用卡牌编辑器拼一张卡

编辑器的定位：**用已实现的效果器快速拼出新卡**，全程可视化，适合玩家与快速原型。

### 2.1 打开编辑器

启动游戏（`start.ps1` / `start.sh`）→ 注册/登录账号 → 大厅 → **模组** → **卡牌编辑器**。

> 卡牌保存在服务器上与你账号绑定，所以必须登录。新手第一次进入建议先看编辑器内置的「编辑教程」页。

### 2.2 界面与基本流程

1. **新建卡牌**：左侧列表 ➕ 新建，起个名字。
2. **填静态数据**：卡名、上传图片、费用（能量 + 四阵营需求）、卡牌类型（单位/法术/附魔/物品）、种族、攻血。
3. **拼效果**：在「**效果器**」区点 ➕，从下拉选择效果器。下拉每一项都带规则说明，格式为「名称 · 说明」，例如「狂怒 · 每次受到伤害后获得 +1/+1」。
4. **配置每条效果器**（按需出现）：
   - **触发器**：触发型效果器可选择何时执行（打出/亡语/黎明/黄昏/共鸣……）；
   - **目标器**：指向型效果器可选择作用对象（默认「使用卡牌目标」）；
   - **参数**：按参数类型给出对应控件——数字输入、枚举下拉、**能力下拉**（同样带说明）、**资源**（能量 + 能量上限 + 四阵营需求的小表格）、**卡牌搜索**（按卡名搜索选择）。
5. **排序与删除**：右上箭头调整效果器顺序——**效果从上到下依次结算**；🗑 删除该条。
6. **预览**：右侧卡面实时刷新（每次编辑后约 0.15 秒自动更新），所见即所得。
7. **保存**：点「保存卡片」立即保存；编辑后 10 秒也会自动保存（有改动才上传）。

### 2.3 让卡牌在对局中可用

自制卡通过「系列（Set）」组织：创建系列 → 把卡加入系列 → 公开/私有 → 在**其他**菜单里**激活**该系列。激活后系列里的卡会加入你的收藏，编辑卡组时即可使用。

---

## 第 3 章 写代码：五步添加一张新卡

以给生长阵营添加一张简单单位「苔藓守卫」（3 费 2/5，护盾）为例。

### 第 1 步：选阵营文件

新卡写在对应阵营文件里：生长 → `Fifth-Aeon-Model/cards/growthCards.ts`。（技术上写在任何已注册文件都行，按阵营组织便于维护。）

### 第 2 步：写工厂函数

在该文件末尾追加（文件顶部已 import 绝大多数常用项）：

```ts
export function mossGuardian() {
    return new Unit(
        'MossGuardian',        // dataId：唯一 ID，用大驼峰英文，定稿后永不更改
        'Moss Guardian',       // 卡名英文原文（同时是翻译 key）
        'moss-guardian.png',   // 图片文件名（见第 9 章）
        UnitType.Elemental,    // 种族
        new Resource(3, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0 }),
        new Untargeted(),      // 单位卡通常无指向
        2, 5,                  // 攻击力 / 生命值
        [new Shielded()]       // 效果器：护盾被动
    );
}
```

### 第 3 步：确认 import

用到文件顶部没有的类时补一行（`Shielded` 在 `growthCards.ts` 里通常已引入）：

```ts
import { Shielded } from './mechanics/skills';
```

### 第 4 步：加卡名翻译

`Fifth-Aeon-Model/i18n/zh-CN-cards.ts` 追加：

```ts
'Moss Guardian': '苔藓守卫',
```

> 效果器列表非空时**卡面描述自动生成**（跟随翻译），无需手写；只有效果无法自动表达时才用可选的 `text` 参数完全自定义（见第 7 章）。

### 第 5 步：同步 + 验证（第 10 章有完整清单）

```powershell
node model-sync.js                          # 同步两副本（改完 Model 必做）
cd Fifth-Aeon-Server
npx gulp scripts                            # 编译服务端
npx mocha -r ts-node/register "src/tests/**/*.spec.ts"   # 回归测试
cd ..
node scan-all-cards.js                      # 全卡实例化验证，期望 残留: 0
node check-i18n.js                          # 翻译缺失检查，期望 双 0
```

> 本机若提示找不到 `node`/`npx`：仓库自带了独立 Node，位于 `logs\node\node.exe`，把上面命令里的 `node` 换成它的完整路径即可。

完成后启动游戏，卡牌编辑器能搜到新卡，开一局 AI 对局打出它。

---

## 第 4 章 卡牌构成参考

写卡时按需查阅。每节开头一句话说明这个部件是干什么的。

### 4.1 费用 Resource——打出这张卡要付出什么

```ts
new Resource(energy, maxEnergy = 0, types?: { Growth, Decay, Renewal, Synthesis })
```

- `energy`：基础能量费用（卡面左上角数字）；
- `types`：**阵营需求**——本游戏特色。打出这张卡，除了付能量，还要求你已拥有对应阵营的资源。例：

```ts
new Resource(3, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0 })  // 3费 + 1生长
new Resource(4, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 1 })  // 双阵营混合
```

设计参照现有 138 张卡：同阵营同费用档位的卡保持一致的需求风格（如 5 费普遍带 2 点阵营需求）。阵营对应：Growth 生长（自然/野兽）、Decay 凋零（亡灵/毒）、Renewal 新生（治疗/飞行）、Synthesis 合成（机械/间谍）。

### 4.2 四种卡牌类型

| 类型 | 构造参数（`cardList.ts` 的 build 方法） | 说明 |
|---|---|---|
| **Unit** | `(dataId, name, imageUrl, type: UnitType, cost, targeter, damage, life, mechanics, text?)` | 最常用 |
| **Spell** | `(dataId, name, imageUrl, cost, targeter, mechanics, text?)` | 无攻血种族；打出即结算（默认触发器就是 Play） |
| **Enchantment** | `(dataId, name, imageUrl, cost, targeter, empowerCost, power, mechanics)` | 多两个参数：`empowerCost` 充能费用（双方博弈点）、`power` 初始力量 |
| **Item** | `(dataId, name, imageUrl, cost, targeter, hostTargeter, damage, life, mechanics)` | `hostTargeter` 决定装备到谁身上（如 `new FriendlyUnit()`） |

所有类型都支持最后一个可选参数 `text?: string`——**覆盖自动生成的效果文本**，仅当效果器自动文本无法表达时使用，且必须配 i18n 词条（第 7 章）。

### 4.3 种族 UnitType（21 种）

| 分组 | 枚举值 |
|---|---|
| 特殊 | `Player`（玩家头像，勿用于新卡） |
| 人形 | `Human` `Cleric` 牧师 `Soldier` 士兵 `Cultist` 邪教徒 `Agent` 密探 `Vampire` 吸血鬼 |
| 自然 | `Wolf` 狼 `Spider` 蜘蛛 `Snake` 蛇 `Mammal` 猛兽 `Insect` 昆虫 `Bird` 飞鸟 `Dragon` 巨龙 |
| 异类 | `Monster` 怪物 `Demon` 恶魔 `Elemental` 元素 `Undead` 亡灵 |
| 机械 | `Automaton` 机械偶 `Structure` 建筑 `Vehicle` 载具 |

种族不只是标签：`UnitsOfType` 按种族选目标、`UnitTypeLordship*` 种族领主光环、生物/机械入场触发都依赖它。机械三件套（Automaton/Structure/Vehicle）判定为**非生物**（免疫中毒等）。新种族需改 `card-types/unit.ts` 并同步三副本，`i18n/zh-CN.ts` 加翻译。

### 4.4 目标器 Targeter——「对谁做」

全部在 `cards/targeters/`，除 `SingleUnit` 族外均无参构造。

**基础目标器**（basicTargeter.ts）：

| 类 | 选择对象 |
|---|---|
| `Untargeted` | 无目标（法术/被动的默认） |
| `SelfTarget` | 卡牌自身（「令此单位…」） |
| `SingleUnit(optional=false)` | 单个单位；`optional=true` 可不指定目标打出 |
| `FriendlyUnit` / `EnemyUnit` | 一个友方 / 敌方单位 |
| `AllUnits` / `AllOtherUnits` | 全部单位 / 除自身外 |
| `FriendlyUnits` / `EnemyUnits` | 全部友方 / 敌方 |
| `AllPlayers` / `Everyone` | 双方玩家（生命/资源类效果） |
| `OwningPlayer` / `EnemyPlayer` | 卡牌拥有者 / 对手玩家 |
| `TriggeringUnit` | 触发事件的单位（配合特定触发器） |

**条件目标器**：`BiologicalUnit`（生物）、`SleepableUnit`（可施毒）、`LifeLessUnits`（攻击力 0）、`UnitsOfType(type)`（指定种族，如 `new UnitsOfType(UnitType.Wolf)`）、`UnitWithAbility(id)`（有指定效果器）、`WeakenedUnits`（被削弱）。附魔类见 `enchantmentTargeters.ts`。

**文本联动**：效果器文本里的 `{target}` 占位符由目标器自动填充（`SelfTarget` → 「此单位」，`EnemyUnit` → 「一个敌方单位」）。**你不需要在效果器里写目标名**。

### 4.5 触发器 Trigger——「什么时候做」

全部在 `cards/triggers/`，无参构造，用 `.setTrigger(new Xxx())` 挂到效果器上（默认 Play）。

| 触发器 | 触发时机 | 典型搭配 |
|---|---|---|
| `Play` | 打出卡牌时 | **默认**，法术效果 |
| `DeathTrigger` | 该单位死亡时 | 亡语 |
| `SoulReap` | 任意单位死亡时 | 收割类 |
| `Dawn` / `Dusk` | 你的回合开始 / 结束 | 回合联动 |
| `Cycle` | 每个回合结束时 | 周期效果 |
| `Affinity` | 首次召唤同种族单位时（一次性，触发后变灰） | 种族协同（狼崽） |
| `Serenity` | 回合结束且你未攻击时 | 宁静奖励 |
| `LethalStrike` | 该单位造成致命一击时 | 斩杀奖励 |
| `OwnerAttacked` | 你被攻击时 | 防御反击 |
| `OwnerDrawsUnit` | 你抽到单位牌时 | 抽牌协同 |
| `UnitEntersPlay` / `FriendlyUnitEntersPlay` 等 | 入场联动 | 阵营协同 |

触发器前缀翻译已内置（`zh-CN.ts` 模板：`'Dawn: {text}' → '黎明：{text}'`），你只需关心效果器文本本身。

### 4.6 现有效果器速查

按用途分组（完整清单以 `cards/mechanics/` 源码为准——每个类的 `getText()` 就是它的中文描述）：

- **数值增减益**：`BuffTarget(damage, life)` 加益、`DealDamage(amount)` 伤害、`BiteDamage(amount)` 撕咬（伤害+自愈）、`GainLife(amount)` 回血、`GainResource(resource)` 获得资源、`GrantAbility(ability)` 授予能力；
- **场面控制**：`KillTarget` 消灭、`Annihilate` 湮灭（无视亡语）、`MindControl` 夺取控制权、`SleepTarget` 催眠、`ImprisonTarget` 囚禁、`ReturnFromCrypt` 墓地复活、`ShuffleIntoDeck` 洗回卡组、`SummonUnits(factory, count)` 召唤衍生体；
- **关键词被动（Skill，无参）**：飞行、远程、水栖、突进、致命、生命窃取、护盾、无情、不死、不朽、剧毒、机械体、不可阻挡、不能攻击/阻挡；
- **特殊体系**：施毒/驱毒/免疫中毒、附魔充能（Recharge/Discharge/ChangePower）、护盾附魔（PreventAllDamage/ForceField/DeathCounter）、手牌操作（Discard/Peek/DrawCard）、领主光环（UnitTypeLordship*）等。

---

## 第 5 章 效果器深入：原理与写法

现有效果器不够用时才需要本章。先理解结构，再读三个真实案例，最后是事件系统参考。

### 5.1 效果器的四要素

每个效果器 = `cards/mechanics/` 下的一个导出类，由四个方法组成：

| 方法 | 职责 | 必须实现 |
|---|---|---|
| `enter(card, game)` | 上场时挂事件钩子 / 施加一次性效果 | 是 |
| `remove(card, game)` | 离场时**成对清理**事件（漏写 = 事件泄漏） | 是 |
| `getText(card)` | 卡面文本（走 i18n，第 7 章） | 是 |
| `evaluate(card, game?, ctx?)` | AI 价值评估（第 8 章） | 是 |
| `onTrigger(card, game)` | 触发型的执行体 | 仅触发型 |
| `evaluateUnitTarget(...)` | 触发型的目标评估 | 仅指向型 |

### 5.2 继承树与选型

```
Mechanic（抽象基类）              ← 被动/常驻效果，实现 enter/remove
 └── TriggeredMechanic           ← 有触发时机（默认 Play），实现 onTrigger()
      └── TargetedMechanic       ← 有目标器（默认沿用卡牌的）
           └── UnitTargetedMechanic ← 目标必为单位，实现 evaluateUnitTarget()

Skill（继承 Mechanic）            ← 关键词类：grantable=true 可被授予能力转移，
                                    validCardTypes 限单位/物品
```

**选型经验**：

- 被动光环 / 常驻效果 → 继承 `Mechanic` 或 `Skill`（参照护盾、狂怒）；
- 打出/触发的一次性效果 → 继承 `UnitTargetedMechanic`（参照 `DealDamage`）；
- 想在卡面上**加粗显示并带 tooltip** 的关键词 → 继承 `Skill`（基类在独立的 `mechanics/skill.ts`，不要把基类和具体效果器放同一文件，原因见 1.3）；
- 只是参数不同 → 继承现有效果器改默认值（如 `BiteDamage extends DealDamage`），不要复制粘贴。

### 5.3 案例精讲：三个真实效果器

#### 案例 A：`Shielded`（护盾）——事件拦截 + 动态文本

> `cards/mechanics/skills.ts`。效果：「首次受到的伤害改为 0」。

```ts
export class Shielded extends Skill {
    protected static id = 'Shielded';
    private depleted = false;                        // 实例状态：护盾是否已消耗

    public enter(card: Card, game: Game) {           // 入场注册事件
        this.depleted = false;
        (card as Unit).getEvents().takeDamage.addEvent(this, params => {
            if (this.depleted || params.amount === 0) {
                return params;                       // 已消耗：放行原伤害
            }
            params.amount = 0;                       // 拦截：把伤害改为 0
            this.depleted = true;
        });
    }

    public remove(card: Card, game: Game) {          // 离场必须成对清理
        this.depleted = false;
        (card as Unit).getEvents().removeEvents(this);
    }

    public getText(card: Card) {
        if (this.depleted) {
            // 触发后文本套 [depleted] 标记 → 前端渲染为灰色
            return '[depleted]' + t('Shielded.') + '[/depleted]';
        }
        return t('Shielded.');
    }

    public stack() { this.depleted = false; }        // 同名叠加时重置状态

    public evaluate(card: Card) {
        return this.depleted ? 0 : { addend: 0, multiplier: 1.25 };
    }
}
```

三个要点：

1. **事件改写模式**：回调收到 `params`，直接改字段并 `return params` 即可拦截/改写引擎行为；
2. **`enter`/`remove` 成对**：`addEvent(this, ...)` 的事件一律在 `remove` 里 `removeEvents(this)` 注销；
3. **`stack()`**：同名效果器叠加时引擎调用它合并状态。

#### 案例 B：`ForceField`（力场附魔）——玩家级事件 + 状态消耗

> `cards/mechanics/shieldEnchantments.ts`。效果：「你受到的伤害由附魔力量承担，并扣除等量力量」。

```ts
abstract class ShieldEnchantment extends Mechanic {
    protected static validCardTypes = new Set([CardType.Enchantment]);  // 只能挂附魔

    public enter(card: Card, game: Game) {
        const enchantment = card as Enchantment;
        // 注意：事件注册在【玩家】的事件系统上，不是卡牌上
        game.getPlayer(enchantment.getOwner()).getEvents()
            .takeDamage.addEvent(this, params => {
                params.amount = this.effect(
                    enchantment, params.target as Player,
                    params.amount as number, params.source as Card);
                return params;
            });
    }
    // remove 同理从玩家事件系统注销
}

export class ForceField extends ShieldEnchantment {
    protected static id = 'ForceField';
    protected effect(enchantment, owner, amount) {
        const power = enchantment.getPower();
        enchantment.changePower(-amount);            // 消耗附魔力量（跨回合状态）
        return Math.max(0, amount - power);
    }
    // getText / evaluate：evaluate 返回剩余力量——力量越多越值钱
}
```

要点：**事件系统有三个层级**，按效果作用范围选择——

| 层级 | 获取方式 | 监听范围 |
|---|---|---|
| 卡牌级 | `card.getEvents()` | 这张卡的受击/造成伤害/死亡等 |
| 玩家级 | `game.getPlayer(owner).getEvents()` | 该玩家受到伤害等 |
| 全局级 | `game.getEvents()` | 单位入场/回合开始结束/任意单位死亡等 |

抽象基类抽取共性（三种护盾附魔共享框架，只实现 `effect()` 差异）是写「效果器族」的推荐姿势。

#### 案例 C：`DealDamage`——可覆写钩子 + `[dynamic]` 动态文本

> `cards/mechanics/dealDamage.ts`。这是触发型效果器的标准范本。

```ts
export class DealDamage extends UnitTargetedMechanic {
    protected static id = 'DealDamage';
    protected static ParameterTypes = [              // 参数声明：编辑器据此渲染输入框
        { name: 'damage', type: ParameterType.Integer }
    ];

    constructor(protected amount: number = 1) { super(); }

    public getDamage(card: Card, game: Game) {       // 数值计算抽成钩子
        return this.amount;                          // 子类只覆写这个方法即可变体
    }

    public onTrigger(card: Card, game: Game) {
        const dmg = this.getDamage(card, game);
        for (const target of this.targeter.getUnitTargets(card, game, this)) {
            card.dealDamageInstant(target, dmg);     // 走引擎统一伤害入口（触发事件）
            target.checkDeath();                     // 手动结算死亡
        }
    }

    public getText(card: Card) {
        return tf('Deal {n} damage to {target}.', {
            n: this.amount,
            target: this.targeter.getTextOrPronoun()
        });
    }
    // evaluateUnitTarget 见第 8 章
}
```

要点：

- **造成伤害的固定姿势**：`card.dealDamageInstant(target, dmg)` + `target.checkDeath()`。前者会触发 `dealDamage` 事件（生命窃取、致命等关键词全靠它联动），后者结算死亡。**不要直接调 `target.takeDamage` 绕过事件系统**；
- **`[dynamic](n)[/dynamic]` 标记**：数值随局面变化（墓地数量、最高攻击力…）时，文本模板里用它包裹，前端渲染为高亮数字并随状态刷新。

### 5.4 事件系统参考

`enter`/`remove` 里可挂靠的事件（回调姿势：`(params) => { ...改写 params...; return params; }`）。

**卡牌级** `card.getEvents()`：

| 事件 | 触发时机 | 可改写 | 典型用途 |
|---|---|---|---|
| `play` / `death` / `leavesPlay` / `annihilate` | 区域与生死变化 | — | 亡语、离场清理 |
| `attack` / `block` | 攻击 / 宣告阻挡 | — | 反击、阻碍 |
| `takeDamage` | 此卡受到伤害 | `amount` | 护盾、狂怒、荆棘 |
| `dealDamage` | 此卡造成伤害 | `amount` | 生命窃取、致命 |
| `checkBlockable` | 判断能否被它阻挡 | `canBlock` | 飞行、水栖、不可阻挡 |
| `checkCanBlock` | 判断它能否阻挡别人 | `canBlock` | 水栖 |

**全局级** `game.getEvents()`：`unitEntersPlay`、`startOfTurn`、`endOfTurn`、`playerAttacked`、`unitDies`。
**玩家级** `game.getPlayer(owner).getEvents()`：`takeDamage`（护盾附魔用）。

> 仅当现有事件确实无法表达时，才在 `events/eventSystems.ts` 与 `events/cardEventTypes.ts` 新增事件类型。

---

## 第 6 章 实战：从零实现效果器「狂怒」

本章完整演示**新增一个自定义关键词效果器**的全流程。「狂怒」的效果：

> **狂怒**：每当此单位受到伤害，它获得 +1/+1。

做完后它在游戏里的样子：卡面出现加粗的「狂怒」二字（鼠标悬停显示定义），编辑器效果器下拉可以选到它，AI 会正确评估它的价值，对局中受伤后 +1/+1 生效。

**先看全景——全部改动一览**（后面每节展开）：

| 步骤 | 文件 | 做什么 |
|---|---|---|
| 1 | `Fifth-Aeon-Model/cards/mechanics/fury.ts` | 新建效果器类 |
| 2 | `Fifth-Aeon-Model/cards/mechanicList.ts` | 注册进效果器注册表 |
| 3 | `Fifth-Aeon-Model/i18n/zh-CN.ts` | 卡面文本翻译 |
| 4 | Web-Client `src/app/game/card/card.component.ts` | 卡面 tooltip 定义 |
| 5 | Web-Client `src/app/i18n/zh-CN-2.ts` | 关键词标签 + 定义翻译 |
| 6 | Web-Client `card.component.ts` + `editor/mechanic-labels.ts` | 中文别名 + 编辑器显示名 |
| 7 | `Fifth-Aeon-Server/src/tests/engine.spec.ts` | 回归测试 |

全部真实代码在仓库中可对照：[fury.ts](../Fifth-Aeon-Model/cards/mechanics/fury.ts)、[engine.spec.ts](../Fifth-Aeon-Server/src/tests/engine.spec.ts)。

### 第 1 步：新建效果器文件

创建 `Fifth-Aeon-Model/cards/mechanics/fury.ts`：

```ts
import { Card } from '../../card-types/card';
import { Unit } from '../../card-types/unit';
import { Game } from '../../game';
import { t } from '../../i18n';
import { Skill } from './skill';          // ← 注意：基类在独立的 skill.ts

export class Fury extends Skill {
    protected static id = 'Fury';         // ① 唯一 ID：编辑器/存档/协议/tooltip 都用它

    public enter(card: Card, game: Game) {
        // ② 挂事件钩子：单位每次受到伤害(takeDamage)时执行回调
        (card as Unit).getEvents().takeDamage.addEvent(this, params => {
            (card as Unit).buff(1, 1);    // +1/+1：攻击力、生命上限与当前生命同步 +1
            return params;                // 惯例：返回 params（本例不改写）
        });
    }

    public remove(card: Card, game: Game) {
        // ③ 离场/被移除时注销本效果器挂的所有事件（必须成对，否则事件泄漏）
        (card as Unit).getEvents().removeEvents(this);
    }

    public getText(card: Card) {
        return t('Fury.');                // ④ 卡面文本（第 3 步翻译）
    }

    public evaluate(card: Card) {
        return { addend: 0, multiplier: 1.3 };  // ⑤ AI 价值评估（第 8 章）
    }
}
```

两个实现细节：

- **为什么继承 `Skill` 而不是 `Mechanic`**：自动获得两个特性——只能挂在单位/物品上（`validCardTypes`），以及 `grantable = true`（能被「授予能力」效果器转移给其他单位）。
- **为什么基类在 `skill.ts`**：注册表会枚举模块的**每一个导出**（1.3 节）。如果把抽象基类放进 `skills.ts`，基类自己也会被注册成一个没有名字的空白条目出现在编辑器下拉里。所以基类独立成文件，`skills.ts` 与你的新效果器文件都从它 import。
- **`buff(atk, hp)`** 是单位的标准增益 API（`card-types/unit.ts`）：同时加攻击力、生命上限与当前生命。

### 第 2 步：注册进效果器注册表

`Fifth-Aeon-Model/cards/mechanicList.ts`：

```ts
import * as fury from './mechanics/fury';   // ① 顶部加 import
// ...
const sources = [
    skills,
    fury,          // ② 加入 sources 数组
    poison,
    // ...
];
```

注册完成后：卡牌编辑器的「效果器」下拉立刻出现「狂怒 · 每次受到伤害后获得 +1/+1」，存档与网络协议也能序列化重建它。

> 捷径：如果直接把类**追加到 `skills.ts` 等已有文件里**（而不是新建文件），`skills` 已在 sources 中，本步可跳过。

### 第 3 步：翻译卡面文本

`Fifth-Aeon-Model/i18n/zh-CN.ts` 追加：

```ts
'Fury.': '狂怒。',
```

> 关键词类效果器的 `getText` 通常整句一个词条（`t()`）；带数值模板的效果器用 `tf()` 插值（第 7 章）。**key 必须与代码里的英文原文逐字符一致（含标点）**。

### 第 4 步：注册卡面 tooltip 定义

Web-Client `src/app/game/card/card.component.ts`，在 `keywordsDefs` 里（Rush 之后）追加：

```ts
keywordsDefs.set(
    'Fury',
    'Whenever this unit takes damage, it gains +1/+1.'
);
```

- key 是**规范英文关键词名**（与 `static id` 一致）——它决定卡面上哪个词被加粗；
- value 是英文定义文本，**value 本身会作为 i18n key** 查中文翻译，所以下一步要用 value 原文作 key。

### 第 5 步：翻译定义 + 加关键词标签

Web-Client `src/app/i18n/zh-CN-2.ts`：

```ts
// Labels 区块（关键词短名，卡面加粗用）：
Fury: '狂怒',

// 定义文本区块（tooltip 内容）：
'Whenever this unit takes damage, it gains +1/+1.':
    '每当此单位受到伤害，它获得 +1/+1。',
```

### 第 6 步：中文别名 + 编辑器显示名

```ts
// ① card.component.ts 的 zhKeywordAliases——让中文卡面也能识别"狂怒"二字
//    （加粗 + 触发 tooltip），加在生命窃取之后：
['狂怒', 'Fury'],

// ② Web-Client src/app/editor/mechanic-labels.ts 的 MECHANIC_LABELS
//    （编辑器下拉与 Ability 参数共用的显示名映射）：
Fury: {
    zh: '狂怒 · 每次受到伤害后获得 +1/+1',
    en: 'Gains +1/+1 whenever it takes damage'
},
```

### 第 7 步：写回归测试

`Fifth-Aeon-Server/src/tests/engine.spec.ts` 追加（顶部 `import { Fury } from '../game_model/cards/mechanics/fury'`）：

```ts
it('狂怒(Fury): 每次受到伤害后获得 +1/+1(教程示例效果器)', () => {
    const game = startWithMulligans();
    // 用 cardList.getCard(dataId) 取新实例——不要复用 getCards() 原型，会互相污染 id
    const unitCard = cardList.getCards()
        .find(c => c.getCardType() === CardType.Unit)!;
    const unit = game.playGeneratedUnit(0, cardList.getCard(unitCard.getDataId()));
    unit.addMechanic(new Fury(), game);            // 挂上狂怒
    const beforeDamage = unit.getDamage();
    const beforeMaxLife = unit.getMaxLife();

    unit.takeDamage(2, unit);                      // 受 2 点伤害 → 狂怒触发一次

    expect(unit.getDamage()).to.equal(beforeDamage + 1);
    expect(unit.getMaxLife()).to.equal(beforeMaxLife + 1);
});
```

### 验证

```powershell
node model-sync.js                                        # ① 同步副本
cd Fifth-Aeon-Server
npx tsc -p tsconfig.json --noEmit                         # ② 严格类型检查，期望无输出
npx gulp scripts                                          # ③ 编译服务端
npx mocha -r ts-node/register "src/tests/**/*.spec.ts"    # ④ 全部用例通过
cd ..
node check-i18n.js                                        # ⑤ 翻译缺失 双 0
cd Fifth-Aeon-Web-Client; npx ng build                    # ⑥ 客户端构建通过
```

最后浏览器实测：编辑器给任意单位挂「狂怒」→ 卡面「狂怒」加粗 + tooltip → 开一局 AI 对局打出去，受伤后观察 +1/+1。

### 进阶：带参数的变体

想让「+1/+1」可调（例如狂怒 +2/+2）？加参数声明并用构造函数接收：

```ts
export class FuryN extends Skill {
    protected static id = 'FuryN';
    protected static ParameterTypes = [
        { name: 'amount', type: ParameterType.Integer }   // 编辑器自动渲染数字输入框
    ];
    constructor(private amount: number = 1) { super(); }
    // enter 里改用 (card as Unit).buff(this.amount, this.amount)
    // getText 里用 tf('Fury ({n}).', { n: this.amount }) 并翻译模板
}
```

### 附：自定义触发器

`Play`、`Dawn` 等触发器同样是 `cards/triggers/` 下的类（继承 `Trigger`，实现 `register`/`unregister`/`getText`/`evaluate` 四个方法），同样要在 `keywordsDefs` 注册才能在卡面 tooltip 显示。流程与本章相同，把「效果器」换成「触发器」即可。

---

## 第 7 章 卡面文本与翻译（i18n）

设计原则：**英文原文即字典 key**，缺失时优雅回退英文——所以没翻译不会崩，但中文界面会露出英文。

### 7.1 三层字典

| 层 | 位置 | 放什么 | 示例 |
|---|---|---|---|
| 卡名 | `Fifth-Aeon-Model/i18n/zh-CN-cards.ts` | 每张卡的名字 | `'Wolf Pup': '狼崽'` |
| 效果文本模板 | `Fifth-Aeon-Model/i18n/zh-CN.ts` | 效果器 `t()`/`tf()` 模板 + 触发器前缀 | `'Fury.': '狂怒。'` |
| UI 文案 | Web-Client `src/app/i18n/`（`zh-CN.ts` + `zh-CN-2.ts`） | 界面文字、关键词标签与定义 | `Fury: '狂怒'` |

**添加卡牌时的检查单**：

1. 卡名 → `zh-CN-cards.ts`（必须）；
2. 新效果器的文本模板 → `zh-CN.ts`（必须，仅新效果器需要；用现有效果器拼的卡不用动）；
3. 自定义关键词 → `zh-CN-2.ts` 的 Labels + 定义（第 6 章第 5 步）。

### 7.2 文本模板里的特殊标记

| 标记 | 用途 | 渲染效果 |
|---|---|---|
| `{placeholder}` | `tf()` 插值：`{target}`、`{n}`、`{name}` | 替换为实际值 |
| `[dynamic](n)[/dynamic]` | 随游戏状态变化的数值 | 高亮数字，随状态刷新 |
| `[depleted]X[/depleted]` | 触发后失效的效果段落（如共鸣用完） | 灰色文字 |

> ⚠️ 改动 `card.component.ts` 的 `htmlText()` 时，替换顺序永远是：**标记转换 → 关键词加粗**。顺序颠倒会把 `[...]` 标记切碎，卡面上出现 `[deleted]` 这类残片（2026-09 修过的线上问题）。

---

## 第 8 章 让 AI 读懂你的卡（evaluate）

游戏内置 AI 通过 `evaluate*` 方法给每个可选动作打分。**新效果器不实现 `evaluate`，AI 就「看不懂」这张卡**（默认 0 分，不会主动使用）。

规则（参照 `DealDamage.evaluateUnitTarget`）：

- 返回值 = 这个效果对局面的贡献度，**正数对我方有利、负数不利**（同一效果作用于敌我单位时符号相反）；
- 数量级参照现有效果器：+1/+1 增益约 `2.2`（`(life+damage)*1.1`）；关键词类 Skill 常返回 `{ addend: 0, multiplier: X }` 的倍率（狂怒 1.3、护盾 1.25、飞行 1.3，强关键词更高）；
- 指向型效果器用 `evaluateUnitTarget`，用符号区分敌我：

```ts
public evaluateUnitTarget(source: Card, target: Unit, game: Game, evaluated: EvalMap) {
    const isEnemy = target.getOwner() === source.getOwner() ? -1 : 1;
    return target.getLife() < this.amount
        ? maybeEvaluate(game, EvalContext.LethalRemoval, target, evaluated) * isEnemy
        : 0;
}
```

`maybeEvaluate` 处理「评估互相影响」的循环引用，照抄现有效果器的用法即可。

> **兼容性承诺**：AI 只通过 `evaluate()` 系列接口读卡牌。新卡按本章规范实现后自动接入 AI 全部决策（出牌/宣攻/阻挡），无需改 AI 代码。

---

## 第 9 章 图片资源

- 卡面图片放 **Web-Client** 的 `src/assets/png/`（黑白剪影风格，配合阵营底色）；
- 工厂函数的 `imageUrl` 只写文件名，如 `'moss-guardian.png'`；
- 只需放 Client 的 assets（Model/Server 不需要，assets 也不参与 model-sync）；
- 忘放图片不会崩溃，卡面显示空白图，但仍请补齐；
- 编辑器路线可直接上传本地图片（转 base64 存储）。

---

## 第 10 章 改完之后：同步与验证

### 10.1 一张新卡通常动了哪些文件

| 文件 | 位置 |
|---|---|
| `cards/<阵营>Cards.ts` | 只改 Model，`node model-sync.js` 自动同步 |
| `cards/mechanics/xxx.ts`（仅新效果器） | 同上 |
| `i18n/zh-CN-cards.ts`（卡名） | 同上 |
| `i18n/zh-CN.ts`（仅新效果器文本） | 同上 |
| `Web-Client/src/assets/png/xxx.png` | 仅 Client |
| `Web-Client` 的 `card.component.ts` / `mechanic-labels.ts` / `zh-CN-2.ts` | 仅自定义关键词时（第 6 章） |

### 10.2 同步命令（仓库根目录）

```powershell
node model-sync.js           # 同步 Model → Server/Client 两副本
node model-sync.js --check   # 只校验（漂移时退出码 1）
```

> ⚠️ `Server/src/game_model` 与 `Client/src/app/game_model` 是**生成产物，禁止手改**。唯一白名单差异是 Server 端 `serverGame.ts`（服务端回放扩展），已登记在 model-sync.js 的 `OVERRIDE_WHITELIST`。

### 10.3 验证清单（按顺序）

```powershell
# 1. 同步副本
node model-sync.js

# 2. Server 严格类型检查（gulp 宽松模式会掩盖类型错误）
cd Fifth-Aeon-Server
npx tsc -p tsconfig.json --noEmit        # 期望：无输出

# 3. Server 编译
npx gulp scripts

# 4. 回归测试
npx mocha -r ts-node/register "src/tests/**/*.spec.ts"

# 5. 全卡实例化 + 文案检查
cd ..
node scan-all-cards.js                   # 期望：残留 0 张卡
node check-i18n.js                       # 期望：字典缺失 双 0

# 6. Client 构建
cd Fifth-Aeon-Web-Client
npx ng build                             # 期望：编译成功

# 7. 浏览器实测
# start.ps1 启动 → 编辑器搜新卡名确认文本/图片/效果器下拉
# → 开一局 AI 对局打出新卡，观察效果与控制台报错
```

---

## 第 11 章 常见坑（每条都是真实踩过的）

1. **忘记同步副本**：Model 改完直接测试，Server 用的还是旧副本——新卡不生效或行为不一致。改完即 `node model-sync.js`，再跑 `scan-all-cards.js` 验证。
2. **dataId 不唯一**：`cardList.addFactory` 按 dataId 去重，重复 ID 会**静默覆盖**已有卡。ID 用大驼峰英文（`MossGuardian`），定稿后永不更改（存档与协议引用它）。
3. **卡名忘加翻译**：中文界面显示英文卡名。`check-i18n.js` 能查出。
4. **文本模板 key 与英文原文不一致**：`tf()` 的 key 必须与 `zh-CN.ts` 词条**逐字符一致**（含标点空格），否则回退英文。
5. **效果器选错基类**：需要触发时机的效果继承了 `Mechanic`（没有 `setTrigger`）；指向型效果继承了 `TriggeredMechanic`（`targeter` 不会自动就位）。对照 5.2 的继承树选。
6. **AI 不用新卡**：没实现 `evaluate*` 或评估值恒 0。见第 8 章。
7. **`htmlText()` 替换顺序颠倒**：先加粗后转标记会切碎 `[...]` 标记。顺序永远是**标记转换 → 关键词加粗**。
8. **在效果器里写 UI/动画代码**：Model 是 Server/Client 共用的纯规则库，任何 DOM 引用都会导致 Server 编译失败。动画属于 Client 的 `animator.ts` 体系。
9. **费用忘写阵营需求**：`new Resource(3)` 和 `new Resource(3, 0, {Growth:1,...})` 是完全不同的卡。保持与同阵营卡一致。
10. **误改副本目录**：副本是生成产物，手改会被下次同步覆盖。只改 Model。
11. **把抽象基类和具体效果器放在同一个模块文件**：注册表会枚举每个导出，基类也被注册成编辑器下拉里的**空白条目**（2026-09-27 修过：`Skill` 曾因此出现在下拉里）。基类放独立文件（`mechanics/skill.ts` 模式）。
12. **测试里复用 `getCards()` 原型卡**：`playGeneratedUnit` 不克隆原型，多张卡共用同一实例会互相污染 id。测试要用 `cardList.getCard(dataId)` 取新实例。

---

## 附录：一张新卡的完整出生证明

以第 3 章的「苔藓守卫」为例，全部改动汇总——

```ts
// ① Fifth-Aeon-Model/cards/growthCards.ts（追加）
export function mossGuardian() {
    return new Unit(
        'MossGuardian', 'Moss Guardian', 'moss-guardian.png',
        UnitType.Elemental,
        new Resource(3, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0 }),
        new Untargeted(), 2, 5,
        [new Shielded()]
    );
}

// ② Fifth-Aeon-Model/i18n/zh-CN-cards.ts（追加）
'Moss Guardian': '苔藓守卫',
```

```text
③ 图片：Web-Client/src/assets/png/moss-guardian.png
④ 同步：node model-sync.js
⑤ 验证：tsc --noEmit → gulp scripts → mocha → scan-all-cards.js → check-i18n.js → ng build → 浏览器实测
```

---

愉快造卡！遇到教程未覆盖的效果类型，最可靠的学习方式是：**在 `cards/` 里全局搜索类似的现有卡牌，读它的工厂函数与效果器实现**——这套系统里几乎每一种效果都已经有先例。
