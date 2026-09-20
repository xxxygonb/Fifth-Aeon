/**
 * zh-CN dictionary for the shared game model.
 * Keys are the English source strings (mechanic texts, trigger templates, log
 * templates). Missing keys gracefully fall back to English.
 *
 * Sections:
 *  - Trigger templates
 *  - Game log templates
 *  - Pronouns / glue words
 *  - Unit types
 *  (Mechanic texts live with their mechanic definitions; card names are in
 *   zh-CN-cards.ts)
 */
export const zhCN: Record<string, string> = {
    // ---- Trigger templates -------------------------------------------
    'Play: {text}': '打出：{text}',
    'Death: {text}': '亡语：{text}',
    'When a unit is summoned {text}': '当一个单位被召唤时，{text}',
    'When you summon a unit {text}': '当你召唤一个单位时，{text}',
    'When you summon a biological unit {text}': '当你召唤一个生物单位时，{text}',
    'When you summon a mechanical unit {text}': '当你召唤一个机械单位时，{text}',
    'Whenever another unit dies {text}': '每当另一个单位死亡时，{text}',
    'When you draw a unit {text}': '当你抽到一个单位时，{text}',
    'Dusk: {text}': '黄昏：{text}',
    'Dawn: {text}': '黎明：{text}',
    'Cycle: {text}': '循环：{text}',
    'Serenity: {text}': '宁静：{text}',
    'Lethal Strike: {text}': '致命一击：{text}',
    'When this unit’s owner is attacked {text}': '当此单位的持有者被攻击时，{text}',
    'Affinity: {text}': '共鸣：{text}',
    'Affinity: [depleted]{text}[/depleted]': '共鸣：[depleted]{text}[/depleted]',

    // ---- Game log templates -------------------------------------------
    You: '你',
    'Your opponent': '你的对手',
    '{blocker} blocked {blocked}': '{blocker} 阻挡了 {blocked}',
    '{who} attacked with {units}.': '{who} 用 {units} 发起了攻击。',
    '{who} defended: {blocks}.': '{who} 进行了阻挡：{blocks}。',
    '{name} played {card}{targets}.': '{name} 打出了{card}{targets}。',
    ' targeting {targets}': '，指定 {targets} 为目标',
    'It has the effect "{text}"': '效果：“{text}”',

    // ---- Mechanic & targeter texts --------------------------------------
    // Keys are the exact English source strings passed to t()/tf() in
    // cards/mechanics/*, cards/targeters/*, targeter.ts and resource.ts.
    // Mechanic texts keep their trailing period: they are returned verbatim
    // by Spell.getText, while Permanent.getMechanicGroupText strips and
    // re-adds the locale-appropriate sentence end for triggered mechanics.

    // Skills & passive mechanics
    'Flying.': '飞行。',
    'Unblockable.': '不可阻挡。',
    'Rush.': '突进。',
    'Aquatic.': '水栖。',
    'Ranged.': '远程。',
    'Lifesteal.': '生命窃取。',
    'Lethal.': '致命。',
    'Shielded.': '护盾。',
    'Relentless.': '无情。',
    'Deathless.': '不死。',
    'Deathless ({n}).': '不死（{n}）。',
    'Immortal.': '不朽。',
    'Cannot attack.': '不能攻击。',
    'Cannot block.': '不能阻挡。',
    'Poisoned.': '中毒。',
    'Poisoned ({n}).': '中毒（{n}）。',
    'Venomous.': '剧毒。',
    'Immune to poison.': '免疫中毒。',
    'Sleeping.': '沉睡。',
    'Sleeping ({n}).': '沉睡（{n}）。',
    'Robotic.': '机械体。',
    'Whenever this damages a player, that player discards a card.':
        '每当此单位对一名玩家造成伤害时，该玩家弃一张牌。',
    'Whenever this damages your opponent draw a card.':
        '每当此单位对你的对手造成伤害时，抽一张牌。',
    'Whenever this damages your opponent summon a {name}.':
        '每当此单位对你的对手造成伤害时，召唤一个{name}。',
    'Prevent all damage that would be dealt to you.':
        '防止所有将对你造成的伤害。',
    'Whenever you would take damage prevent it and remove that much power from this enchantment.':
        '每当你将受到伤害时，防止该伤害并移除此附魔等量的力量。',
    'Whenever a unit damages you kill it and remove one power from this enchantment.':
        '每当一个单位对你造成伤害时，将其杀死并从此附魔移除一点力量。',
    'Recharge ({n}).': '充能（{n}）。',
    'Discharge ({n}).': '耗能（{n}）。',
    'Gain {n} power.': '获得 {n} 点力量。',
    'Lose {n} power.': '失去 {n} 点力量。',
    'Cannot be empowered.': '不能被强化。',
    'Cannot be diminished.': '不能被削弱。',
    'Whenever this blocks another unit deal {n} damage to that unit (before combat damage).':
        '每当此单位阻挡另一个单位时，对该单位造成 {n} 点伤害（在战斗伤害之前）。',
    'Transform any unit this damages into a {name}.':
        '将此单位所伤害的任意单位变身为{name}。',

    // Lordship auras
    'Other friendly units have {buff}.': '其他友方单位具有 {buff}。',
    '{unitType} have {buff}.': '{unitType}具有 {buff}。',
    'Other friendly {unitType} have {buff}.': '其他友方{unitType}具有 {buff}。',
    'Friendly {unitType} have {buff}.': '友方{unitType}具有 {buff}。',
    'Non-{unitType} have {buff}.': '非{unitType}单位具有 {buff}。',

    // Triggered / targeted mechanic effects
    'Deal {n} damage to {target}.': '对{target}造成 {n} 点伤害。',
    'Deal damage to target unit equal to your highest attack unit.':
        '对目标单位造成等同于你最高攻击力单位的伤害。',
    'Deal damage to target unit equal to your highest attack unit [dynamic]({n})[/dynamic].':
        '对目标单位造成等同于你最高攻击力单位的伤害 [dynamic]({n})[/dynamic]。',
    'Deal {n} damage to {target}. If it dies summon a {name}.':
        '对{target}造成 {n} 点伤害。若它死亡，则召唤一个{name}。',
    'Deal damage to {target} equal to your {resource}.':
        '对{target}造成等同于你的{resource}资源数量的伤害。',
    'Deal damage to {target} equal to your {resource} [dynamic]({n})[/dynamic].':
        '对{target}造成等同于你的{resource}资源数量的伤害 [dynamic]({n})[/dynamic]。',
    'Give {target} {buff}.': '令{target}获得 {buff}。',
    'Give {target} {ability}.': '令{target}获得 {ability}。',
    'Refresh {target}.': '重置{target}。',
    'Annihilate {target}.': '消灭{target}。',
    'Kill {target}.': '杀死{target}。',
    'Cause {target} to become unable to attack or block.':
        '令{target}不能攻击或阻挡。',
    '{target} is unable to attack or block until this dies.':
        '{target}不能攻击或阻挡，直到此单位死亡。',
    'Poison {target}.': '令{target}中毒。',
    'Cure {target}.': '治愈{target}。',
    'Put {target} to sleep for a turn.': '令{target}沉睡一回合。',
    'Put {target} to sleep for {n} turns.': '令{target}沉睡 {n} 回合。',
    'Take control of {target}.': '获得{target}的控制权。',
    "Shuffle {target} into their owner's deck.": '将{target}洗回其持有者的牌库。',
    'Draw a card.': '抽一张牌。',
    'Draw {n} cards.': '抽 {n} 张牌。',
    'Peek at your opponents hand.': '查看你对手的手牌。',
    'Your opponent discards a card.': '你的对手弃一张牌。',
    'Your opponent discards {n} cards.': '你的对手弃 {n} 张牌。',
    'If you have less than 4 synthesis, replace a card. If you have less than 8 draw one. Otherwise search for one.':
        '若你的合成资源少于 4，替换一张牌。若少于 8，抽一张牌。否则从牌库中检索一张牌。',
    'Choose a friendly unit. Draw cards equal to its stats divided by {n}.':
        '选择一个友方单位。抽等同于其属性值除以 {n} 的数量的牌。',
    'Exhaust {target}. It loses flying.': '使{target}疲惫。其失去飞行。',
    'Remove up to two units from your crypt. This unit gains their stats.':
        '从你的墓地中移除至多两个单位。此单位获得它们的属性值。',
    'You gain {n} life.': '你获得 {n} 点生命。',
    'Gain {res}.': '获得 {res}。',
    'Summon a {name}.': '召唤一个{name}。',
    'Summon {n} {name}.': '召唤 {n} 个{name}。',
    'Play a {name} for each {factor} units in any crypt [dynamic]({n})[/dynamic].':
        '从任意墓地中每有 {factor} 个单位，便打出一个{name} [dynamic]({n})[/dynamic]。',
    'Play a {name} for each {factor} units in any crypt (rounded down).':
        '从任意墓地中每有 {factor} 个单位，便打出一个{name}（向下取整）。',
    'Summon a {name}. It becomes an X/X where X is this enchantment’s power.':
        '召唤一个{name}。该单位变为 X/X，X 等于此附魔的力量。',
    'Summon {n} {name}. It becomes an X/X where X is this enchantment’s power.':
        '召唤 {n} 个{name}。该单位变为 X/X，X 等于此附魔的力量。',
    'Return {a} {type} from your crypt to your hand.':
        '将{type}从你的墓地移回你的手牌。',
    'If you have {n} or more life you win the game.':
        '若你的生命值达到 {n} 或更多，你赢得游戏。',
    'Remove {n} power from {target}.': '从{target}移除 {n} 点力量。',
    'Remove {n} power from {target} and gain that much attack and life.':
        '从{target}移除 {n} 点力量，并获得等量的攻击力和生命值。',

    // Targeter fragments & pronouns
    'it': '它',
    'them': '它们',
    'that unit': '该单位',
    'this card’s owner': '此卡的持有者',
    'your opponent': '你的对手',
    'this unit': '此单位',
    'target unit': '目标单位',
    'target friendly unit': '目标友方单位',
    'target enemy unit': '目标敌方单位',
    'target damaged unit': '目标受伤单位',
    'target poisoned unit': '目标中毒单位',
    'target biological unit': '目标生物单位',
    'friendly biological units': '友方生物单位',
    'target mechanical unit': '目标机械单位',
    'target friendly Vehicle or Structure': '目标友方载具或建筑',
    'target unit and all units of the same type': '目标单位及其所有同类型单位',
    'target unit with cost less than or equal to half your renewal':
        '目标费用不高于你一半新生资源的单位',
    'all units': '所有单位',
    'all other units': '其他所有单位',
    'friendly units': '友方单位',
    'all enemy units': '所有敌方单位',
    'all players': '所有玩家',
    'all units and players': '所有单位和玩家',
    'all friendly units and players': '所有友方单位和玩家',
    'all enemy units and players': '所有敌方单位和玩家',
    'all units and enchantments': '所有单位和附魔',
    'all enchantments': '所有附魔',
    'all {type} units': '所有{type}',
    'all friendly {type} units': '所有友方{type}',
    'all non-{type} units': '所有非{type}单位',
    'target {type}': '目标{type}',
    'target {desc} unit': '目标{desc}单位',
    'all units with {n} or less life': '所有生命值不高于 {n} 的单位',

    // Granted ability / keyword names (without trailing period)
    // （GrantAbility 等机制会以裸名引用，如"获得 Deathless"）
    'Flying': '飞行',
    'Relentless': '无情',
    'Aquatic': '水栖',
    'Deathless': '不死',
    'Shielded': '护盾',
    'Lifesteal': '生命窃取',
    'Lethal': '致命',
    'Rush': '突进',
    'Ranged': '远程',
    'Unblockable': '不可阻挡',
    'Poisoned': '中毒',
    'Venomous': '剧毒',
    'Sleeping': '沉睡',
    'Robotic': '机械体',
    'Immortal': '不朽',
    'CannotAttack': '不能攻击',
    'CantAttack': '不能攻击',

    // Card type names (ReturnFromCrypt)
    'Spell': '法术',
    'Unit': '单位',
    'Item': '物品',
    'Enchantment': '附魔',

    // Resource cost description (resource.ts asListDesc / asSentence)
    '{n} energy': '{n} 点能量',
    '{n} {type}': '{n} 点{type}',
    'costs {n} energy.': '费用为 {n} 点能量。',
    'costs {n} energy. It also requires {reqs}.': '费用为 {n} 点能量，另需 {reqs}。',

    // Misc player-facing fragments
    'to replace': '，用于替换',

    // ---- Card custom descriptions（卡牌工厂函数传入的静态描述文本）----
    'Give target unit and all units of the same type +4/+4, Relentless, Flying and Venomous.':
        '给目标单位及其所有同类型单位 +4/+4、无情、飞行和剧毒。',
    'You gain 1 growth, 1 energy and 2 life.': '你获得 1 点生长、1 点能量和 2 点生命。',
    'Refresh target unit. If that unit is poisoned, cure it.':
        '重置目标单位。若其已中毒，则解除中毒。',
    'Refresh all friendly units and give them +1/+3.':
        '重置所有友方单位，并使其 +1/+3。',
    'Attaches to {target}. ': '附加到{target}身上。',

    // ---- Unit types（与 card-types/unit.ts 的 UnitType 枚举一一对应）----
    Player: '玩家',
    Human: '人类',
    Cleric: '牧师',
    Wolf: '狼',
    Spider: '蜘蛛',
    Snake: '蛇',
    Automaton: '机械偶',
    Monster: '怪物',
    Mammal: '猛兽',
    Soldier: '士兵',
    Vampire: '吸血鬼',
    Cultist: '邪教徒',
    Agent: '密探',
    Undead: '亡灵',
    Structure: '建筑',
    Vehicle: '载具',
    Insect: '昆虫',
    Dragon: '巨龙',
    Elemental: '元素',
    Demon: '恶魔',
    Bird: '飞鸟',

    // 关键词标签（非 UnitType，卡牌关键词说明使用）
    Biological: '生物',
    Mechanical: '机械造物',

    // ---- Resource types (factions) --------------------------------------
    Growth: '生长',
    Decay: '凋零',
    Renewal: '新生',
    Synthesis: '合成'
};
