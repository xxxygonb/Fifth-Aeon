# 卡牌添加教程（Card Creation Guide）

> 面向新加入的开发者，讲解 Fifth Aeon 卡牌系统的完整结构，并手把手演示如何添加一张新卡牌——从最简单的白板单位，到带触发器、自定义机制的进阶卡牌。
>
> 阅读前提：了解 TypeScript 基础语法。不要求熟悉本项目。

---

## 目录

1. [架构总览](#1-架构总览)
2. [前置知识：代码放在哪里](#2-前置知识代码放在哪里)
3. [快速上手：五步添加一张单位卡](#3-快速上手五步添加一张单位卡)
4. [费用系统 Resource](#4-费用系统-resource)
5. [四种卡牌类型](#5-四种卡牌类型)
6. [种族 UnitType](#6-种族-unittype)
7. [目标器 Targeter 参考](#7-目标器-targeter-参考)
8. [触发器 Trigger 参考](#8-触发器-trigger-参考)
9. [机制 Mechanic 参考](#9-机制-mechanic-参考)
10. [机制继承体系与自定义机制开发](#10-机制继承体系与自定义机制开发)
    - 10.1 [进阶实例解析（护盾/力场附魔/动态伤害）](#101-进阶实例解析三个真实机制是怎么写的)
    - 10.2 [自定义关键词（Keyword）开发](#102-自定义关键词keyword开发)
    - 10.3 [事件系统参考](#103-事件系统参考)
11. [卡牌文本与 i18n](#11-卡牌文本与-i18n)
12. [AI 评估（evaluate）](#12-ai-评估evaluate)
13. [图片资源](#13-图片资源)
14. [同步三副本与验证清单](#14-同步三副本与验证清单)
15. [常见坑](#15-常见坑)

---

## 1. 架构总览

一张卡牌 = **静态数据**（名字/图片/费用/种族/攻血）+ **机制组合**（Mechanic 列表，决定这张卡"做什么"）+ **目标器**（Targeter，决定"对谁做"）+ **触发器**（Trigger，决定"什么时候做"）。

```
Card（卡牌）
 ├── cost: Resource        ← 费用与资源需求（第 4 节）
 ├── targeter: Targeter    ← 卡牌自身指向的目标器（第 7 节）
 └── mechanics: Mechanic[] ← 效果列表（第 9 节）
       ├── targeter  ← 每个机制可以有自己的目标器
       └── trigger   ← 每个触发型机制可以有自己的触发器
```

关键设计：**卡牌系统是纯数据驱动的组合式系统**。绝大多数新卡牌不需要写任何新逻辑，只需要在阵营卡牌文件里用现有机制"拼装"一个工厂函数。

四个核心注册表（全部位于 `Fifth-Aeon-Model/cards/`，自动收集，**无需手动登记**）：

| 注册表 | 文件 | 收集方式 | 用途 |
|---|---|---|---|
| 卡牌 | `cardList.ts` | `values(growthCards)` 等按文件收集 | 游戏内所有可用卡牌 |
| 机制 | `mechanicList.ts` | `values(mechanics/xxx.ts)` 按文件收集 | 效果实现 + 卡牌编辑器下拉 |
| 目标器 | `targeterList.ts` | 同上 | 目标选择方式 + 编辑器下拉 |
| 触发器 | `triggerList.ts` | 同上 | 触发时机 + 编辑器下拉 |

只要你的类是某个已注册文件里的 `export class`，它就自动出现在卡牌编辑器的下拉框里，也能被存档/网络协议序列化重建。

## 2. 前置知识：代码放在哪里

项目有三个仓库，**共享游戏规则库 Fifth-Aeon-Model 被复制到 Server 和 Web-Client 各一份**（`git submodule` 引用）：

```
g:\Fifth-Aeon\
├── Fifth-Aeon-Model\                  ← ★ 规范副本：卡牌在这里写
│   ├── cards\
│   │   ├── growthCards.ts             ← 生长阵营卡牌（也是本教程示例位置）
│   │   ├── decayCards.ts              ← 凋零阵营
│   │   ├── renewalCards.ts            ← 新生阵营
│   │   ├── synthCards.ts              ← 合成阵营
│   │   ├── cardList.ts                ← 卡牌注册表
│   │   ├── mechanicList.ts            ← 机制注册表
│   │   ├── targeterList.ts            ← 目标器注册表
│   │   ├── triggerList.ts             ← 触发器注册表
│   │   ├── mechanics\                 ← 全部机制实现（约 25 个文件）
│   │   ├── targeters\                 ← 全部目标器实现
│   │   └── triggers\                  ← 全部触发器实现
│   ├── card-types\                    ← Card/Unit/Spell/Item/Enchantment 基类
│   ├── mechanic.ts                    ← Mechanic 基类体系
│   ├── resource.ts                    ← 费用系统
│   └── i18n\                          ← 文案翻译字典
├── Fifth-Aeon-Server\src\game_model\  ← Model 的 Server 副本（改完同步）
├── Fifth-Aeon-Web-Client\src\app\game_model\ ← Model 的 Client 副本（改完同步）
└── docs\
```

**黄金规则**：卡牌逻辑只写在 `Fifth-Aeon-Model`，然后把改动**同步**到另外两个副本（见第 14 节）。三个副本中 `animator.ts`、`card-types/item.ts`、`serverGame.ts` 是历史遗留的有意差异文件，**不要互相覆盖**。

## 3. 快速上手：五步添加一张单位卡

以添加一张简单的生长阵营单位"苔藓守卫"为例（白板+一个被动技能）：

### 第 1 步：选好阵营文件

生长阵营 → `Fifth-Aeon-Model/cards/growthCards.ts`。卡牌文件按阵营划分，新卡写在对应阵营文件里（也可写在任何已注册文件里，但按阵营组织便于维护）。

### 第 2 步：编写卡牌工厂函数

在该文件末尾追加（文件顶部已有的 import 不用重复引入）：

```ts
export function mossGuardian() {
    return new Unit(
        'MossGuardian',          // ① dataId：全局唯一 ID，永不更改
        'Moss Guardian',         // ② name：英文原名（同时是翻译 key）
        'moss-guardian.png',     // ③ 图片文件名（见第 13 节）
        UnitType.Elemental,      // ④ 种族（见第 6 节）
        new Resource(3, 0, {     // ⑤ 费用：3 点能量 + 生长需求 1（见第 4 节）
            Growth: 1,
            Decay: 0,
            Renewal: 0,
            Synthesis: 0
        }),
        new Untargeted(),        // ⑥ 卡牌目标器（单位卡通常无指向）
        2,                       // ⑦ 攻击力
        5,                       // ⑧ 生命值
        [                        // ⑨ 机制列表（这张卡 = 护盾被动）
            new Shielded()
        ]
    );
}
```

### 第 3 步：确认 import 齐全

工厂用到的类必须在文件顶部 import。`growthCards.ts` 顶部已经引入了绝大多数常用项；用到新机制时补一行：

```ts
import { Shielded } from './mechanics/skills';
```

### 第 4 步：同步到另外两个副本

把修改的文件复制到 `Fifth-Aeon-Server\src\game_model\cards\` 和 `Fifth-Aeon-Web-Client\src\app\game_model\cards\`（见第 14 节的完整清单与验证方法）。

### 第 5 步：编译验证 + 浏览器确认

```powershell
# 1. 卡名加进中文卡名字典（i18n，见第 11 节）
#    Fifth-Aeon-Model\i18n\zh-CN-cards.ts 追加：
#    'Moss Guardian': '苔藓守卫',

# 2. Server 编译 + 全卡验证（见第 14 节工具）
cd g:\Fifth-Aeon\Fifth-Aeon-Server; npx gulp scripts
cd g:\Fifth-Aeon; node scan-all-cards.js     # 应输出 残留: 0 张卡

# 3. 浏览器实测
#    启动游戏（start.bat）→ 大厅 → 卡牌编辑器能搜到新卡 → 开一局 AI 对局打出它
```

完成。一张新卡上线不需要改动 `cardList.ts` —— `growthCards.ts` 里 `export` 的工厂函数会被自动收集。

### 实际参照：项目里最短的真实例子

`growthCards.ts` 中的"狼崽"（Wolf Pup），一张 2 费 2/1 狼，效果是"共鸣：令此单位获得 0/+1"：

```ts
export function wolfPup() {
    return new Unit(
        'WolfPup',
        'Wolf Pup',
        'wolf-head.png',
        UnitType.Wolf,
        new Resource(1, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0 }),
        new SelfTarget(),                              // 机制作用于自身
        2,
        1,
        [new BuffTarget(0, 1).setTrigger(new Affinity())]  // BuffTarget + 共鸣触发器
    );
}
```

注意 `new BuffTarget(0, 1).setTrigger(new Affinity())`：`BuffTarget` 是触发型机制（`TriggeredMechanic`），默认触发器是"打出"，用 `.setTrigger(...)` 换成共鸣。**链式调用是组合机制的标准写法**。

---

## 4. 费用系统 Resource

构造签名（[resource.ts](../Fifth-Aeon-Model/resource.ts)）：

```ts
new Resource(energy, maxEnergy = 0, types?: ResourceTypeGroup)
```

| 参数 | 含义 | 典型用法 |
|---|---|---|
| `energy` | 基础能量费用（卡面左上角数字） | 大多数卡牌 |
| `maxEnergy` | 附加能量上限（目前仅部分附魔使用） | 一般传 0 |
| `types` | 四阵营资源需求 | 见下 |

**资源需求**（types）是本游戏的特色机制：打出卡牌除了能量，还要求你已拥有对应阵营的资源。

```ts
// 常见模板——单阵营卡（只改阵营与数值）
new Resource(3, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0 })  // 3费+1生长
new Resource(5, 0, { Growth: 0, Decay: 2, Renewal: 0, Synthesis: 0 })  // 5费+2凋零
new Resource(2, 0, { Growth: 0, Decay: 0, Renewal: 0, Synthesis: 0 })  // 2费无需求（中立感）

// 双阵营混合卡（例如合成+生长）
new Resource(4, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 1 })
```

**设计参照**：现有 138 张卡的费用曲线可直接参考同阵营同费用档位的卡牌（例如 5 费卡普遍带 2 点阵营需求）。四阵营对应关系：Growth=生长（自然/野兽）、Decay=凋零（亡灵/毒）、Renewal=新生（治疗/飞行）、Synthesis=合成（机械/间谍）。

`Resource` 还会作为**资源奖励/费用**出现在机制参数里（如 `GainResource`、附魔的充能），构造方式相同。

## 5. 四种卡牌类型

构造签名来自 `cardList.ts` 的四个 build 方法，参数顺序如下：

### Unit（单位）—— 最常用

```ts
new Unit(dataId, name, imageUrl, type: UnitType, cost: Resource,
         targeter: Targeter, damage: number, life: number,
         mechanics: Mechanic[], text?: string)
```

### Spell（法术）

```ts
new Spell(dataId, name, imageUrl, cost: Resource,
          targeter: Targeter, mechanics: Mechanic[], text?: string)
```

法术没有攻血和种族；打出即结算（机制的触发器默认就是 `Play`）。

### Enchantment（附魔）

```ts
new Enchantment(dataId, name, imageUrl, cost: Resource,
                targeter: Targeter, empowerCost: number, power: number,
                mechanics: Mechanic[])
```

多两个参数：`empowerCost`（充能费用，玩家可付费增强/削弱的博弈点）、`power`（初始力量）。

### Item（物品/装备）

```ts
new Item(dataId, name, imageUrl, cost: Resource,
         targeter: Targeter, hostTargeter: Targeter,
         damage: number, life: number, mechanics: Mechanic[])
```

`hostTargeter` 决定物品**装备到谁身上**（如 `new FriendlyUnit()`）。注意：`card-types/item.ts` 是三副本差异文件，修改它需要按各副本现状分别改（见第 2 节黄金规则）。

### 可选的 text 参数

所有类型都支持最后一个可选参数 `text?: string`——**覆盖自动生成的效果文本**。机制列表为空、需要完全自定义描述时使用：

```ts
// 用法见 card-types/spell.ts 的 getText()：if (this.text) return t(this.text)
new Spell('MySpell', 'My Spell', 'img.png', cost, new Untargeted(), [], 'my.custom.text.key')
```

优先用机制自动生成文本（自动跟随翻译）；只有自动文本无法表达时才手写 text，且必须配合 i18n 词条（第 11 节）。

## 6. 种族 UnitType

完整枚举（[card-types/unit.ts](../Fifth-Aeon-Model/card-types/unit.ts)），共 21 种：

| 分组 | 枚举值 |
|---|---|
| 特殊 | `Player`（玩家头像，勿用于新卡） |
| 人形 | `Human`、`Cleric`（牧师）、`Soldier`（士兵）、`Cultist`（邪教徒）、`Agent`（密探）、`Vampire`（吸血鬼） |
| 自然 | `Wolf`（狼）、`Spider`（蜘蛛）、`Snake`（蛇）、`Mammal`（猛兽）、`Insect`（昆虫）、`Bird`（飞鸟）、`Dragon`（巨龙） |
| 异类 | `Monster`（怪物）、`Demon`（恶魔）、`Elemental`（元素）、`Undead`（亡灵） |
| 机械 | `Automaton`（机械偶）、`Structure`（建筑）、`Vehicle`（载具） |

种族不只是标签，会被这些机制引用：`UnitsOfType`（按种族选取目标）、`UnitTypeLordship*`（种族领主光环）、`FriendlyBiologicalUnitEntersPlay` / `FriendlyMechanicalUnitEntersPlay`（生物/机械入场触发）。机械类三兄弟（Automaton/Structure/Vehicle）会被判定为**非生物**（免疫中毒、不能被生物限定效果选中）。

**新种族**：如果必须新增枚举值，除了 unit.ts 还要同步三副本，并在 `i18n/zh-CN.ts` 的单位类型区块加翻译。

## 7. 目标器 Targeter 参考

目标器决定机制"选中谁"。全部位于 `cards/targeters/`。构造都无参数（除 `SingleUnit` 族），组合进机制即可。

### 基础目标器（basicTargeter.ts）

| 类 | 选择对象 | 备注 |
|---|---|---|
| `Untargeted` | 无目标 | 法术/被动的默认选择 |
| `SelfTarget` | 卡牌自身 | "令此单位获得…" |
| `SingleUnit(optional=false)` | 单个单位 | `optional=true` 时可以选择性打出（不指定目标） |
| `FriendlyUnit` | 一个友方单位 | = `SingleUnit` 的友方版 |
| `EnemyUnit` | 一个敌方单位 | |
| `AllUnits` | 全部单位 | 双方的 |
| `AllOtherUnits` | 除自身外全部单位 | |
| `FriendlyUnits` / `EnemyUnits` | 全部友方/敌方 | |
| `AllPlayers` / `Everyone` | 双方玩家 | 用于生命/资源类效果 |
| `Friends` / `Enemies` | 同 FriendlyUnits / EnemyUnits（含玩家语义区分） | |
| `OwningPlayer` / `EnemyPlayer` | 卡牌拥有者 / 对手玩家 | 玩家指向 |
| `TriggeringUnit` | 触发事件的单位 | 配合特定触发器 |

### 条件目标器（按条件筛选单位）

| 类（文件） | 选择对象 |
|---|---|
| `BiologicalUnit`（biotargeter.ts） | 全部生物单位（非机械） |
| `SleepableUnit`（poisonTargeter.ts） | 可被施毒的单位 |
| `LifeLessUnits`（powerTargeter.ts） | 攻击力为 0 的单位 |
| `UnitsOfType(type)` / `UnitsOfTypeAsTarget(type)`（unitTypeTargeter.ts） | 指定种族的单位，构造如 `new UnitsOfType(UnitType.Wolf)` |
| `UnitWithAbility(id)`（mechanicTargeter.ts） | 拥有指定机制的单位 |
| `WeakenedUnits`（weakenedUnits.ts） | 被削弱的单位 |

附魔目标器（enchantmentTargeters.ts）：`AllEnchantments` 等。

### 目标器与文本的联动

机制文本里的 `{target}` 占位符由 `this.targeter.getTextOrPronoun()` 填充：目标器为 `SelfTarget` 时输出"此单位"，连续同目标机制自动用代词，`EnemyUnit` 输出"一个敌方单位"。**你不需要在机制里写目标名，目标器会生成**。

## 8. 触发器 Trigger 参考

触发器决定触发型机制"何时执行 `onTrigger`"。全部位于 `cards/triggers/`，无参构造，通过 `.setTrigger(new Xxx())` 挂到机制上。

| 触发器 | 触发时机 | 典型搭配 |
|---|---|---|
| `Play` | 打出卡牌时 | **默认触发器**，法术效果 |
| `DeathTrigger` | 该单位死亡时（亡语） | "亡语：召唤…" |
| `SoulReap` | 单位死亡时（不限是谁） | 收割类效果 |
| `Dawn` | 你的回合开始时 | "黎明：抽一张牌" |
| `Dusk` | 你的回合结束时 | "黄昏：获得资源" |
| `Cycle` | 每当双方回合切换 | 周期效果 |
| `Affinity` | 同种族友方单位入场时（一次性，触发后该效果变灰） | 种族协同，见狼崽 |
| `Serenity` | 你没有任何手牌时 | 空手奖励 |
| `LethalStrike` | 该单位造成致命一击时 | 斩杀奖励 |
| `OwnerAttacked` | 你被攻击时 | 防御反击 |
| `OwnerDrawsUnit` | 你抽到单位牌时 | 抽牌协同 |
| `UnitEntersPlay` / `FriendlyUnitEntersPlay` | 任意/友方单位入场时 | 入场联动 |
| `FriendlyBiologicalUnitEntersPlay` / `FriendlyMechanicalUnitEntersPlay` | 友方生物/机械入场时 | 阵营协同 |

翻译已内置：触发器前缀由 `i18n/zh-CN.ts` 的模板统一翻译（如 `'Play: {text}' → '打出：{text}'`、`'Dawn: {text}' → '黎明：{text}'`、`'Affinity: [depleted]{text}[/depleted]' → '共鸣：[depleted]{text}[/depleted]'`），你只需关心 `{text}` 里的机制文本。

## 9. 机制 Mechanic 参考

机制是卡牌效果的原子实现，全部位于 `cards/mechanics/`。按功能分组列出常用构造签名（构造参数即效果数值）：

### 数值与增减益

| 机制 | 构造 | 效果 |
|---|---|---|
| `BuffTarget` | `(damage=1, life=1)` | 目标单位 +X/+Y（狼崽同款） |
| `GrantAbility` | `(ability)` | 赋予目标一个机制能力 |
| `DealDamage` | `(amount=1)` | 对目标造成 X 伤害 |
| `BiteDamage` | `(amount)` | 撕咬伤害（造成伤害+自愈同量） |
| `GainLife` | `(amount)` | 玩家回复 X 点生命 |
| `Heal`（heal.ts `RefreshTarget`） | — | 治疗单位 |
| `GainResource` | `(resource: Resource)` | 获得资源 |

### 场面控制

| 机制 | 构造 | 效果 |
|---|---|---|
| `KillTarget`（removal.ts） | — | 消灭目标 |
| `Annihilate`（removal.ts） | — | 湮灭（无视亡语） |
| `MindControl` | — | 夺取目标单位控制权 |
| `SleepTarget`（sleep.ts） | — | 使目标沉睡 |
| `ImprisonTarget` / `ImprisonTemporarily`（cantAttack.ts） | — | 囚禁/临时囚禁 |
| `ReturnFromCrypt` | — | 从墓地复活 |
| `ShuffleIntoDeck` | — | 把目标洗回卡组 |
| `SummonUnits` | `(cardFactory, count)` | 召唤单位（衍生体） |

### 被动技能（Skill，无参数）

`Flying`（飞行）、`Ranged`（远程）、`Aquatic`（水栖）、`Rush`（突进）、`Lethal`（致命）、`Lifesteal`（生命窃取）、`Shielded`（护盾）、`Deathless`（不死）、`Relentless`（无情）、`Unblockable`（不可阻挡）、`Immortal`（不朽）、`Venomous`（剧毒）、`Robotic`（机械体）、`CannotAttack` / `CannotBlock`（不能攻击/阻挡）。

### 特殊体系

`PoisonTarget`（施毒）、`CurePoison`（驱毒）、`PoisonImmune`（免疫中毒）、`Recharge` / `Discharge`（附魔充能/耗能）、`ChangePower`（附魔力量增减）、`PreventAllDamage` / `ForceField` / `DeathCounter`（护盾附魔）、`DrainPowerIntoStats`（汲取附魔力量）、`Discard` / `Peek` / `DrawCard` / `AugarCard`（手牌操作）、`TransformDamaged`（凋零变形）、`AbominationConsume`（吞噬）、`WinIfHighLife`（胜利条件）、`WebTarget` / `DrawCardsFromUnit`（生长限定）、`UnitTypeLordship*`（领主光环）、`SummonUnitOnDamage` / `SummonUnitForGrave` / `EnchantmentSummon`（召唤变体）。

> 完整清单以 `cards/mechanics/` 源码为准——每个类的 `getText()` 就是对效果的中文描述来源，读它就能准确理解机制行为。

## 10. 机制继承体系与自定义机制开发

当现有机制拼不出你想要的效果时，就需要写新机制。继承体系（[mechanic.ts](../Fifth-Aeon-Model/mechanic.ts)）：

```
Mechanic（抽象基类）
 └── TriggeredMechanic        ← 有触发时机（默认 Play），实现 onTrigger()
      └── TargetedMechanic    ← 有目标器（默认沿用卡牌的目标器）
           └── UnitTargetedMechanic ← 目标必为单位，需实现 evaluateUnitTarget()
```

选型经验：**被动光环/常驻效果继承 `Mechanic`**（实现 `enter`/`remove`/`getText`/`evaluate`，参照 `DamageOnBlock`）；**打出的/触发的一次性效果继承 `UnitTargetedMechanic`**（实现 `onTrigger` + `evaluateUnitTarget`，参照 `DealDamage`）。

### 新机制模板（带触发器与目标器的伤害类效果）

在 `cards/mechanics/` 新建或追加到相关文件：

```ts
import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { UnitTargetedMechanic, EvalMap } from '../../mechanic';
import { Unit } from '../../card-types/unit';
import { ParameterType } from '../parameters';
import { tf } from '../../i18n';

export class FreezeTarget extends UnitTargetedMechanic {
    protected static id = 'FreezeTarget';           // ① 唯一 ID：编辑器/存档/协议用
    protected static ParameterTypes = [              // ② 参数声明：编辑器据此渲染输入框
        { name: 'duration', type: ParameterType.Integer }
    ];

    constructor(protected duration: number = 1) {
        super();
    }

    public onTrigger(card: Card, game: Game) {       // ③ 效果实现
        for (const target of this.targeter.getUnitTargets(card, game, this)) {
            // ... 你的效果逻辑，注意只写规则、不写 UI
        }
    }

    public getText(card: Card) {                     // ④ 效果文本（i18n，见第 11 节）
        return tf('Freeze {target} for {n} turn(s).', {
            target: this.targeter.getTextOrPronoun(),
            n: this.duration
        });
    }

    public evaluateUnitTarget(source: Card, target: Unit,
                              game: Game, evaluated: EvalMap) {
        return target.getOwner() === source.getOwner() ? -2 : 2;  // ⑤ AI 评估
    }
}
```

五个要点：

1. `static id` 必须唯一——它是存档（JSON）、网络协议、卡牌编辑器下拉的标识。
2. `static ParameterTypes` 让机制出现在**卡牌编辑器**里并声明可调参数（`ParameterType.Integer/Ability/...`，见 `cards/parameters.ts`）。
3. `static validCardTypes` 可限制机制只能挂在某类卡上（默认全类型）。
4. 机制文件必须在 `cards/mechanicList.ts` 的 `sources` 数组里登记（新文件要加 import + 数组项；追加到已有文件则自动生效）。
5. 新机制的文本模板要加进 `i18n/zh-CN.ts`（第 11 节）。

**如果只是参数不同**，优先继承现有机制改默认值（如 `BiteDamage extends DealDamage`），不要复制粘贴。

### 10.1 进阶实例解析：三个真实机制是怎么写的

#### 实例 A：`Shielded`（护盾）——事件拦截 + 动态文本标记

> 位置：`cards/mechanics/skills.ts`。效果："第一次受到的伤害改为 0"。

```ts
export class Shielded extends Skill {
    protected static id = 'Shielded';
    private depleted = false;                          // ③ 实例状态：护盾是否已消耗

    public enter(card: Card, game: Game) {             // ① 入场时注册事件
        this.depleted = false;
        (card as Unit).getEvents().takeDamage.addEvent(this, params => {
            if (this.depleted || params.amount === 0) {
                return params;                         // 已消耗过：放行原伤害
            }
            params.amount = 0;                         // 拦截：把伤害改为 0
            this.depleted = true;                      // 记录护盾碎裂
        });
    }

    public remove(card: Card, game: Game) {            // ② 离场时必须清理事件
        this.depleted = false;
        (card as Unit).getEvents().removeEvents(this);
    }

    public getText(card: Card) {
        if (this.depleted) {
            // ④ 触发后文本套 [depleted] 标记 → 前端渲染为灰色
            return '[depleted]' + t('Shielded.') + '[/depleted]';
        }
        return t('Shielded.');
    }

    public stack() {                                   // ⑤ 同名机制叠加时重置状态
        this.depleted = false;
    }

    public evaluate(card: Card) {                      // ⑥ AI 评估：护盾未碎才有价值
        return this.depleted ? 0 : { addend: 0, multiplier: 1.25 };
    }
}
```

要点：
- **事件改写模式**：事件回调接收 `params`，直接修改字段并 `return params` 即可拦截/改写引擎行为（这里是把 `takeDamage` 的 `amount` 改成 0）。
- **`enter`/`remove` 必须成对**：`enter` 里 `addEvent(this, ...)` 的事件都在 `remove` 里用 `removeEvents(this)` 一次性注销——漏掉 remove 会造成事件泄漏，单位离场后效果仍然生效。
- **`[depleted]` 标记**：文本中的标记由前端转成灰色样式（见第 11 节），配合"共鸣"等触发器表示"该效果已失效"。
- **`stack()`**：同名机制叠加时引擎会调用它，用于合并状态（这里是恢复护盾）。

#### 实例 B：`ForceField`（力场附魔）——玩家级事件 + 跨卡状态消耗

> 位置：`cards/mechanics/shieldEnchantments.ts`。效果："你将受到的伤害由附魔力量承担，并扣除等量力量"。

```ts
abstract class ShieldEnchantment extends Mechanic {
    protected static validCardTypes = new Set([CardType.Enchantment]);  // 只能挂附魔

    public enter(card: Card, game: Game) {
        const enchantment = card as Enchantment;
        // 注意：事件注册在【玩家】的事件系统上，不是卡牌上
        game.getPlayer(enchantment.getOwner())
            .getEvents()
            .takeDamage.addEvent(this, params => {
                const player = params.target as Player;
                const amount = params.amount as number;
                const source = params.source as Card;
                params.amount = this.effect(enchantment, player, amount, source);
                return params;
            });
    }
    // remove 同理从玩家事件系统注销
}

export class ForceField extends ShieldEnchantment {
    protected static id = 'ForceField';

    protected effect(enchantment: Enchantment, owner: Player, amount: number) {
        const power = enchantment.getPower();          // 读取附魔当前力量
        const reduced = Math.max(0, amount - power);
        enchantment.changePower(-amount);              // 消耗附魔力量（跨卡状态）
        return reduced;
    }
    // getText 用 t('Whenever you would take damage prevent it and ...')
    // evaluate 返回 (card as Enchantment).getPower() —— 力量越多价值越高
}
```

要点：
- **三个事件系统层级**，按效果作用范围选择：
  | 层级 | 获取方式 | 监听范围 |
  |---|---|---|
  | 卡牌级 | `card.getEvents()` | 这张卡的攻击/受击/死亡等 |
  | 玩家级 | `game.getPlayer(owner).getEvents()` | 该玩家受到伤害等 |
  | 全局级 | `game.getEvents()` | 单位入场/回合开始结束/单位死亡等 |
- **抽象基类抽取共性**：三种护盾附魔（`PreventAllDamage`/`ForceField`/`DeathCounter`）共享"监听玩家受击"框架，只实现 `effect()` 差异——新机制族先抽抽象基类再写变体。
- **`evaluate` 可以读游戏状态**：护盾价值随剩余力量衰减，AI 因此会权衡。

#### 实例 C：`DealDamage` 的可覆写模式 + `[dynamic]` 动态文本

> 位置：`cards/mechanics/dealDamage.ts`。

```ts
export class DealDamage extends UnitTargetedMechanic {
    protected static id = 'DealDamage';
    protected static ParameterTypes = [{ name: 'damage', type: ParameterType.Integer }];

    constructor(protected amount: number = 1) { super(); }

    // ① 伤害单独抽成 getDamage() —— 子类覆写它即可改变伤害来源
    public getDamage(card: Card, game: Game) {
        return this.amount;
    }

    public onTrigger(card: Card, game: Game) {
        const dmg = this.getDamage(card, game);
        for (const target of this.targeter.getUnitTargets(card, game, this)) {
            card.dealDamageInstant(target, dmg);       // 走引擎统一伤害入口（触发事件）
            target.checkDeath();                       // 手动检查死亡
        }
    }

    public getText(card: Card, game: Game) {
        return tf('Deal {n} damage to {target}.', {
            n: this.amount,
            target: this.targeter.getTextOrPronoun()
        });
    }
    // evaluateUnitTarget 见第 12 节
}

// ② 子类只覆写 getDamage + getText：伤害 = 你最高攻击力单位的攻击力（动态值）
export class DealResourceDamage extends DealDamage {   // 实际为按资源数量，模式相同
    public getDamage(card: Card, game: Game) { /* 读取场上状态计算 */ }

    public getText(card: Card, game: Game) {
        // 动态数值用 [dynamic](n)[/dynamic] 标记 → 前端渲染为高亮数字
        return tf(
            'Deal damage to {target} equal to your {resource} [dynamic]({n})[/dynamic].',
            { target: this.targeter.getTextOrPronoun(), resource: ..., n: computed }
        );
    }
}
```

要点：
- **可覆写的计算钩子**：把数值计算抽成 `getXxx()`，子类只改计算逻辑，效果骨架复用。
- **造成伤害的固定姿势**：`card.dealDamageInstant(target, dmg)` + `target.checkDeath()`——前者会触发 `dealDamage` 事件（生命窃取、致命等关键词都靠它联动），后者结算死亡。**不要直接调用 `target.takeDamage`** 绕过事件系统。
- **`[dynamic]` 标记**：数值随局面变化时（墓地数量、最高攻击力…），模板里用 `[dynamic](n)[/dynamic]` 包裹，前端渲染为高亮数字并随状态刷新。

### 10.2 自定义关键词（Keyword）开发

"关键词"是卡面上**加粗显示、带 tooltip 定义**的规则术语（飞行、护盾、亡语……）。体系上就是 `cards/mechanics/skills.ts` 里的 `Skill` 类：

```ts
abstract class Skill extends Mechanic {
    public static readonly grantable = true;   // 可被 GrantAbility 机制赋予其他单位
    protected static validCardTypes = new Set([CardType.Unit, CardType.Item]);
}
```

自定义关键词共 **5 步**，下面以新增关键词 **狂怒（Enrage）——"每当此单位受到伤害，它获得 +1/+0"** 为例完整走一遍。

#### 第 1 步：Model 写 Skill 类（`cards/mechanics/skills.ts` 追加）

```ts
export class Enrage extends Skill {
    protected static id = 'Enrage';

    public enter(card: Card, game: Game) {
        (card as Unit).getEvents().takeDamage.addEvent(this, params => {
            (card as Unit).buff(1, 0);      // 每次受到伤害 +1/+0
            return params;
        });
    }

    public remove(card: Card, game: Game) {
        (card as Unit).getEvents().removeEvents(this);
    }

    public getText(card: Card) {
        return t('Enrage.');                // 文本模板（第 3 步翻译）
    }

    public evaluate(card: Card) {
        return { addend: 0, multiplier: 1.2 };
    }
}
```

- `skills.ts` 已在 `mechanicList.ts` 的 sources 中，**追加即自动注册**——卡牌编辑器的机制下拉会立刻出现 Enrage。
- 如果关键词带数值（如"+1/+0"可调），加 `static ParameterTypes` 并用构造参数。

#### 第 2 步：翻译效果文本（`Fifth-Aeon-Model/i18n/zh-CN.ts`）

```ts
'Enrage.': '狂怒。每当此单位受到伤害，它获得 +1/+0。',
```

> Skill 的 getText 通常整句放一个词条（不同于触发器前缀的模板化拆分）。

#### 第 3 步：注册 tooltip 定义（Web-Client `src/app/game/card/card.component.ts`）

```ts
// Powers 区块追加：
keywordsDefs.set(
    'Enrage',
    'Whenever this unit takes damage, it gains +1/+0.'
);
```

`keywordsDefs` 的 key 是**规范英文关键词名**（与 Skill 的 `static id` 一致），value 是**英文定义文本**——注意 value 本身会作为 i18n key 去查中文翻译，所以第 4 步要用 value 原文作为 key。

#### 第 4 步：翻译定义文本（Web-Client `src/app/i18n/zh-CN-2.ts`）

```ts
'Whenever this unit takes damage, it gains +1/+0.':
    '每当此单位受到伤害，它获得 +1/+0。',
```

悬浮卡牌时的关键词 tooltip（中文）就来自这里。

#### 第 5 步：加中文别名（同文件 `zhKeywordAliases`）

```ts
['狂怒', 'Enrage'],
```

这让中文卡牌文本里的"狂怒"二字被识别为关键词（卡面加粗 + tooltip 触发 + keywords() 提取）。**长词要排在对应短词之前**（数组顺序即正则优先级）。

#### 验证

```powershell
# 同步 skills.ts、zh-CN.ts、card.component.ts、zh-CN-2.ts 后：
cd g:\Fifth-Aeon\Fifth-Aeon-Server; npx tsc -p tsconfig.json --noEmit; npx gulp scripts
cd g:\Fifth-Aeon; node check-i18n.js          # 双 0 缺失
cd g:\Fifth-Aeon\Fifth-Aeon-Web-Client; npx ng build
# 浏览器：卡牌编辑器给任意单位挂 Enrage → 悬浮卡面看"狂怒"加粗与 tooltip → 对局实测
```

#### 触发器也是关键词

`Play`、`Dawn`、`Affinity` 等触发器同样出现在 tooltip 里。**自定义触发器**时（`cards/triggers/` 新建类继承 `Trigger`，实现四个抽象方法），同样要在 `keywordsDefs` 注册：

```ts
export abstract class Trigger {
    protected static id: string;
    abstract register(card: Card, game: Game): void;    // 挂事件（触发逻辑）
    abstract unregister(card: Card, game: Game): void;  // 注销事件
    abstract getText(mechanicText: string): string;     // '前缀: {text}' 形式
    abstract evaluate(host: Card, game: Game, context: EvalContext): number;
    public isHidden() { return false; }                 // true 则不显示在卡面文本
}
```

### 10.3 事件系统参考

`enter`/`remove` 里可挂靠的事件一览（事件回调：`(params) => { ...改写 params...; return params; }`）：

**卡牌级** `card.getEvents()`（events/eventSystems.ts）：

| 事件 | 触发时机 | 典型用途 |
|---|---|---|
| `play` / `death` / `unitDies` / `leavesPlay` / `annihilate` / `killUnit` | 区域与生死变化 | 亡语、离场清理 |
| `attack` / `block` | 攻击/宣告阻挡 | 反击、阻碍 |
| `takeDamage` | 此卡受到伤害（**可改写 amount**） | 护盾、狂怒、荆棘 |
| `dealDamage` | 此卡造成伤害（**可改写 amount**） | 生命窃取、致命 |
| `checkBlockable` | 判断能否被阻挡（**可改写 canBlock**） | 飞行、水栖、不可阻挡 |
| `checkCanBlock` | 判断能否阻挡他人（**可改写 canBlock**） | 水栖 |

**全局级** `game.getEvents()`：`unitEntersPlay`、`startOfTurn`、`endOfTurn`、`playerAttacked`、`unitDies`。
**玩家级** `game.getPlayer(owner).getEvents()`：`takeDamage`（护盾附魔用）。

> 新增事件类型：在 `events/eventSystems.ts` 与 `events/cardEventTypes.ts`（或 gameEventTypes.ts）补充 EventList 与事件参数接口——仅当现有事件确实无法表达时才做。

## 11. 卡牌文本与 i18n

文本系统设计：**英文原文即字典 key**，缺失时优雅回退英文。三层结构：

| 层 | 位置 | 内容 |
|---|---|---|
| 卡名 | `Fifth-Aeon-Model/i18n/zh-CN-cards.ts` | `'Wolf Pup': '狼崽'` |
| 效果文本模板 | `Fifth-Aeon-Model/i18n/zh-CN.ts` | 机制 `tf()` 的模板 + 触发器前缀 |
| UI 文案 | Web-Client `src/app/i18n/` | 与卡牌无关 |

**添加卡牌时的 i18n 检查单**：

1. 卡名 → `zh-CN-cards.ts` 加 `'Moss Guardian': '苔藓守卫'`（必须，否则卡名显示英文）。
2. 新机制的文本模板 → `zh-CN.ts` 加对应词条（必须，否则新机制的描述显示英文）。已有机制不用动——模板词条已存在。
3. 自定义 text 参数 → 同样在 `zh-CN.ts` 加词条。

### 标记语法（写进模板的特殊标签）

| 标记 | 用途 | 渲染效果 |
|---|---|---|
| `[dynamic](n)[/dynamic]` | 随游戏状态变化的数值（如墓地单位数） | 高亮样式的数值 |
| `[depleted]X[/depleted]` | 共鸣等触发后失效的效果段落 | 灰色文字 |
| `{placeholder}` | `tf()` 插值：`{target}`、`{n}`、`{name}` 等 | 替换为实际值 |

范例（真实代码）：`affinity.ts` 触发器把机制文本包进 depleted 标记：

```ts
tf('Affinity: [depleted]{text}[/depleted]', { text: mechanicText })
```

> 历史教训（2026-09 修复）：关键词加粗先于标记转换执行时，会把 `[...]` 标记切碎导致原样显示。修复后顺序已对调——**如果你改动 `card.component.ts` 的 `htmlText()`，务必保持"先标记转换、后关键词加粗"**。

## 12. AI 评估（evaluate）

项目内置 AI 通过 `evaluate*` 方法为每个可选动作打分。**新机制不实现 evaluate，AI 就"看不懂"这张卡**（默认 0 分，不会主动使用）。

规则（参照 `DealDamage.evaluateUnitTarget`）：

- 返回值是"这张牌打出/触发对局面的贡献度"，**正数 = 对我方有利，负数 = 不利**（同一机制作用于敌我单位时符号相反）。
- 数量级参照现有机制：+1/+1 增益约 `2.2`（`(life+damage)*1.1`），致命打击用 `EvalContext.LethalRemoval` 上下文取更大值。
- 目标选择的正负号模式：

```ts
public evaluateUnitTarget(source: Card, target: Unit, game: Game, evaluated: EvalMap) {
    const isEnemy = target.getOwner() === source.getOwner() ? -1 : 1;
    return target.getLife() < this.amount
        ? maybeEvaluate(game, EvalContext.LethalRemoval, target, evaluated) * isEnemy
        : 0;
}
```

`maybeEvaluate` 用于处理"评估中互相影响"的循环引用，照抄现有机制的用法即可。

## 13. 图片资源

- 卡面图片存放在 **Web-Client** 的 `src/assets/png/`（如 `wolf-head.png`、`beech.png`）。
- 工厂函数的 `imageUrl` 只写文件名，如 `'moss-guardian.png'`。
- 图片是黑白剪影风格（配合阵营底色）。新增图片记得**只在 Client 仓库放**（Server/Model 不需要），并同步两份子模块时不要覆盖 assets。
- 忘记放图片不会崩溃，卡面显示空白图——但仍请补齐。

## 14. 同步三副本与验证清单

### 修改文件清单（添加一张新卡通常涉及）

| 文件 | 副本 |
|---|---|
| `cards/<阵营>Cards.ts` | Model + Server 副本 + Client 副本（3 处） |
| `cards/mechanics/xxx.ts`（仅新增机制时） | 3 处 |
| `i18n/zh-CN-cards.ts`（卡名） | 3 处 |
| `i18n/zh-CN.ts`（仅新机制文本时） | 3 处 |
| `Web-Client/src/assets/png/xxx.png`（新图片） | 仅 Client |

### 同步命令（PowerShell 示例，单文件）

```powershell
$f = 'cards\growthCards.ts'
Copy-Item "Fifth-Aeon-Model\$f" "Fifth-Aeon-Server\src\game_model\$f" -Force
Copy-Item "Fifth-Aeon-Model\$f" "Fifth-Aeon-Web-Client\src\app\game_model\$f" -Force
```

> ⚠️ `animator.ts`、`card-types/item.ts`、`serverGame.ts` 是差异文件，**永远不要**用上面命令互相覆盖；改这三个文件时需分别阅读各副本现状。

### 验证清单（按顺序执行）

```powershell
# 1. Server 严格类型检查（gulp 宽松模式会掩盖类型错误）
cd g:\Fifth-Aeon\Fifth-Aeon-Server
npx tsc -p tsconfig.json --noEmit     # 期望：无输出

# 2. Server 编译产物
npx gulp scripts

# 3. 全卡实例化 + 文案残留验证（138+N 张卡）
cd g:\Fifth-Aeon
node scan-all-cards.js                # 期望：残留 0 张卡
node check-i18n.js                    # 期望：Model/Client 字典缺失 (0)

# 4. Client 构建
cd g:\Fifth-Aeon\Fifth-Aeon-Web-Client
npx ng build                          # 期望：Compiled successfully

# 5. 浏览器实测
# start.bat 启动 → 卡牌编辑器搜新卡名 → 确认文本/图片/机制下拉正常
# → 开一局 AI 对局打出新卡 → 观察效果与控制台报错
```

## 15. 常见坑

1. **忘记同步副本**：Model 改完直接测试，Server 用的是旧副本——联机对局里新卡不生效或行为不一致。养成"改完即同步"的习惯，并跑 `scan-all-cards.js` 验证。
2. **dataId 不唯一**：`cardList.addFactory` 用 dataId 去重，重复 ID 会**静默覆盖**已有卡。ID 用大驼峰英文（`MossGuardian`），定稿后永不更改（存档与协议引用它）。
3. **卡名忘加翻译**：`getName()` 走 `t(name)`，字典缺失回退英文。中文环境会显示英文卡名——`check-i18n.js` 能查出缺失。
4. **文本模板 key 与英文原文不一致**：`tf('Give {target} {buff}.', ...)` 的 key 必须与 `zh-CN.ts` 里的词条**逐字符一致**（含标点和空格），否则回退英文。
5. **机制写错基类**：需要触发时机的效果继承 `Mechanic` 而不是 `TriggeredMechanic`，`setTrigger` 不存在；一次性指向效果继承 `TriggeredMechanic` 而不是 `UnitTargetedMechanic`，`targeter` 不会自动就位。
6. **AI 不用新卡**：没实现 `evaluate*` 或评估值恒为 0。参照第 12 节补齐。
7. **修改 `htmlText()` 时打乱替换顺序**：先加粗后转标记会把 `[...]` 标记切碎成 `[deleted]`、`[/耗尽]` 这类残片显示在卡面上（2026-09 已修复的线上问题）。顺序永远是：**标记转换 → 关键词加粗**。
8. **在机制里写 UI/动画代码**：Model 是纯规则库（Server/Client 共用），任何 DOM/动画引用都会导致 Server 编译失败。动画属于 Client 的 `animator.ts` 体系。
9. **费用忘写阵营需求**：`new Resource(3)` 与 `new Resource(3, 0, {Growth:1,...})` 是不同的卡。阵营卡请保持与同阵营卡一致的需求风格。
10. **git 提交漏掉子模块**：三个仓库是独立 git 仓库（外加 Model 的 submodule 指针），提交时确认三处都提交，且 Client/Server 仓库的 submodule 指针更新。

---

## 附：一张新卡的完整出生证明（示例汇总）

以第 3 节的"苔藓守卫"为例，全部改动汇总：

```ts
// ① Fifth-Aeon-Model/cards/growthCards.ts（追加）
export function mossGuardian() {
    return new Unit(
        'MossGuardian',
        'Moss Guardian',
        'moss-guardian.png',
        UnitType.Elemental,
        new Resource(3, 0, { Growth: 1, Decay: 0, Renewal: 0, Synthesis: 0 }),
        new Untargeted(),
        2,
        5,
        [new Shielded()]
    );
}

// ② Fifth-Aeon-Model/i18n/zh-CN-cards.ts（追加）
'Moss Guardian': '苔藓守卫',
```

```text
③ 图片：Web-Client/src/assets/png/moss-guardian.png
④ 同步：growthCards.ts、zh-CN-cards.ts → 两份子模块
⑤ 验证：tsc --noEmit → gulp scripts → scan-all-cards.js（0 残留）→ check-i18n.js（0 缺失）→ ng build → 浏览器实测
```

愉快造卡！遇到教程未覆盖的效果类型，最可靠的学习方式是：**在 `cards/` 全局搜索类似的现有卡牌，读它的工厂函数与机制实现**——这套系统里几乎每一种效果都已经有先例。
