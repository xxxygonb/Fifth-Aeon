/**
 * zh-CN UI dictionary part 2 (tips, card keywords, secondary dialogs).
 * Keys are the English source strings. Missing keys fall back to English.
 */
export const zhCNUI2: Record<string, string> = {
    // ---- Misc ----------------------------------------------------------
    Dismiss: '关闭',
    and: '和',
    'with': '，具有',
    empower: '强化',
    diminish: '削弱',
    '{n} more {res}': '{n} 点{res}',

    // ---- Tips (TipService) ---------------------------------------------
    // Out of game
    'You must select a deck before you can play a game. From this menu you can pick a starter deck, edit a deck, or make a new deck.':
        '你必须先选择一套卡组才能开始游戏。在这个菜单中你可以选择一套初始卡组、编辑卡组或创建新卡组。',
    'From here you can edit your deck. Select a card to add it to your deck.\nThe cards currently in your deck are listed in the deck-list to the right.\nYou can also remove cards from your deck by selecting them from your deck-list.\nA legal deck must have at least 40 cards and no more than 4 of a single type of card.\nYou can earn new cards by opening packs to expand your options.':
        '在这里你可以编辑你的卡组。点击一张卡牌即可将其加入卡组。\n当前卡组中的卡牌列在右侧的卡组列表中。\n你也可以在卡组列表中选中卡牌，将其从卡组中移除。\n合法卡组必须至少包含 40 张牌，且每种牌最多不超过 4 张。\n你可以通过开启卡包获得新卡牌，扩展你的选择。',
    'In draft mode you build a deck by selecting one of four cards repeatedly.\nTry to pick cards that work well with each other, it is especially important to beware of resource costs.':
        '在轮抽模式中，你需要在每四张牌中反复选择一张来组建卡组。\n尽量挑选彼此配合良好的卡牌，尤其要注意资源费用。',
    'Many game functions may be controlled through hotkeys. Press ? to list out the available commands.':
        '许多游戏功能都可以通过快捷键操作。按 ? 查看可用命令列表。',
    // In game
    'At the start of the game you may replace any of the cards in your hand once.\nI recommend you replace cards with high energy costs (the number at the top left of the card).':
        '在游戏开始时，你可以将手牌中的任意卡牌替换一次。\n建议你替换能量费用较高（卡牌左上角的数字）的卡牌。',
    'Units can be used to attack your opponent, but not the turn they are played.\nAttacking allows you to damage your opponent. When they run out of life, you win.':
        '单位可以用来攻击对手，但不能在打出的当回合攻击。\n攻击可以让你对对手造成伤害。当对手生命耗尽时，你就获胜了。',
    'Enchantments are continuous effects that modify the game. All enchantments have a certain amount of power.\nWhen an enchantment runs of out of power, it is dispelled.\nYou may pay an enchantment’s empower cost to give it an extra point of power.\n Your opponent may also pay this cost to reduce your enchantments power by one.':
        '附魔是改变游戏局面的持续效果。所有附魔都拥有一定数量的力量。\n当附魔的力量耗尽时，它会被驱散。\n你可以支付附魔的强化费用，为其增加一点力量。\n你的对手也可以支付这个费用，使你的附魔力量减少一点。',
    'You have a hard hand size limit of twelve cards.\n If you would draw a card while you already have twelve cards in hand, it will be immediately discarded.':
        '你的手牌数上限为十二张（硬上限）。\n 如果你已经有十二张手牌，此时再抽牌将立即被弃置。',
    'Your maximum hand size is eight cards. If you have more than eight you will be forced to discard them at the end of your turn.':
        '你的手牌上限为八张。如果手牌超过八张，你将在回合结束时被迫弃掉超出的牌。',
    'It is your turn. You can play a resource by clicking one of the four icons on the left side of your information bar.\nTry to match the resource you play to the symbols on the cards in your hand.':
        '轮到你的回合。你可以点击信息栏左侧四个图标之一来打出一张资源。\n尽量让你打出的资源与手牌上的资源符号相匹配。',
    'After you play a resource you can end your turn by pressing the pass button on the right side of your information bar.':
        '打出资源后，你可以按信息栏右侧的让过按钮来结束回合。',
    'You have a playable card in your hand. Playable card are brighter and can be played by clicking them.':
        '你的手牌中有可以打出的牌。可打出的牌更明亮，点击即可打出。',
    'You can declare units as attackers by selecting them. All your units attack at once.\nAttackers that are not blocked will damage your opponent.':
        '你可以选中单位来宣告其为攻击者。你的所有单位会同时攻击。\n未被阻挡的攻击者将对你的对手造成伤害。',
    'You can block your opponent’s attackers by selecting one of your units then clicking the attacker you wish to block.\nThe attacker will then fight your blocker, rather than damaging you. You can block a single attacker with multiple units.':
        '你可以选中自己的一个单位，再点击想要阻挡的攻击者，来阻挡对手的攻击。\n攻击者将与你的阻挡者战斗，而不会对你造成伤害。你可以用多个单位阻挡同一个攻击者。',
    'This card has an optional targeted ability. Valid targets have a blue glow.\n Alternatively, you can click the card again to play it without a target.':
        '这张牌拥有可选目标的效果。有效目标会发出蓝光。\n 你也可以再次点击这张牌，以不指定目标的方式打出。',
    'This card requires a target. Valid targets have a blue glow.':
        '这张牌需要指定目标。有效目标会发出蓝光。',
    'If you would draw a card, but there are none left in your deck, you will take damage instead.\n        The amount of damage will double each draw.':
        '如果你需要抽牌但卡组中已经没有牌，你将改为受到伤害。\n该伤害会随每次抽牌翻倍。',
    // Welcome tip
    'Welcome {name}. I will provide tips to help you learn to play.\n            I suggest you start by playing a game against the computer.\n            If you don\'t want tips you can disable them in the settings menu or with the hot key shift t.':
        '欢迎你，{name}。我会提供一些提示，帮助你学习游戏。\n建议你先和电脑打一局。\n如果你不想看到提示，可以在设置菜单中关闭，或使用快捷键 Shift+T。',
    // Cannot block / attack / play announcements
    'You can only block units that are currently attacking you.':
        '你只能阻挡正在攻击你的单位。',
    '{name} is unblockable.': '{name} 无法被阻挡。',
    'Units with flying may only be blocked by other flying units or by ranged units.':
        '具有飞行的单位只能被其他具有飞行的单位或远程单位阻挡。',
    'Aquatic units may only be blocked by other aquatic units or by flying units.':
        '水栖单位只能被其他水栖单位或具有飞行的单位阻挡。',
    'Aquatic units may only block other aquatic units.':
        '水栖单位只能阻挡其他水栖单位。',
    '{blocker} cannot block {attacker} due to a special effect.':
        '由于特殊效果，{blocker} 无法阻挡 {attacker}。',
    'Exhausted units can not block.': '已疲惫的单位无法阻挡。',
    'That unit can not block due to a special effect.':
        '由于特殊效果，该单位无法阻挡。',
    'Units cannot attack the turn they are played.':
        '单位在打出的当回合无法攻击。',
    'Exhausted units cannot attack.': '已疲惫的单位无法攻击。',
    'You must wait for a choice to be made.': '你必须等待一个选择完成。',
    'That unit cannot attack due to a special effect':
        '由于特殊效果，该单位无法攻击',
    'You can only {verb} enchantments during your own turn.':
        '你只能在自己的回合{verb}附魔。',
    'You can not afford to {verb} that enchantment.\n                It would require {need} energy while you only have {have}.':
        '你的能量不足以{verb}该附魔。\n这需要 {need} 点能量，而你只有 {have} 点。',
    'You can only play cards on your own turn.':
        '你只能在自己的回合打出卡牌。',
    'You need {need} to play {card}.': '你还需要{need}才能打出{card}。',
    'Your board is too full to play a unit.':
        '你的场上已满，无法打出单位。',
    'Your board is too full to play an enchantment.':
        '你的场上已满，无法打出附魔。',
    'You don\'t have any units to attach that item to.':
        '你没有任何单位可以附着该物品。',
    'There are no valid targets for {name}.': '{name} 没有有效目标。',

    // ---- Card keywords (CardComponent) ---------------------------------
    // Labels
    Refresh: '重置',
    Flying: '飞行',
    Ranged: '远程',
    Aquatic: '水栖',
    Unblockable: '不可阻挡',
    Discharge: '耗能',
    Recharge: '充能',
    Play: '打出',
    'Death:': '亡语：',
    Affinity: '共鸣',
    Serenity: '宁静',
    'Lethal Strike': '致命一击',
    'Soul Reap': '亡魂收割',
    Dawn: '黎明',
    Dusk: '黄昏',
    Cycle: '循环',
    Rush: '突进',
    Lifesteal: '生命窃取',
    Poisoned: '中毒',
    Poison: '施毒',
    Venomous: '剧毒',
    Mechanical: '机械造物',
    Biological: '生物',
    Lethal: '致命',
    Shielded: '护盾',
    Relentless: '无情',
    Deathless: '不死',
    Sleeping: '沉睡',
    Sleep: '催眠',
    Robotic: '机械体',
    Immortal: '不朽',
    Statue: '石像',
    // Rules
    'Refreshing restores a unit’s health and removes exhaustion. Units normally refresh at the start of their owners turn.':
        '重置会恢复一个单位的生命值并移除疲惫状态。单位通常在其持有者的回合开始时重置。',
    'Can only be blocked by units with flying or ranged.':
        '只能被具有飞行或远程的单位阻挡。',
    'Can block units with flying.': '可以阻挡具有飞行的单位。',
    'Can only be blocked by units with aquatic or flying and can only block other aquatic units.':
        '只能被具有水栖或飞行的单位阻挡，且只能阻挡其他水栖单位。',
    'Can not be blocked.': '无法被阻挡。',
    'Loses power at the start of its owner’s turn.':
        '在其持有者回合开始时失去力量。',
    'Gains power at the start of its owner’s turn.':
        '在其持有者回合开始时获得力量。',
    'Triggers when this is played.': '此牌被打出时触发。',
    'Triggers when this is killed.': '此单位被消灭时触发。',
    'Triggers the first time you summon a unit of the same type.':
        '首次召唤同类型单位时触发。',
    'Triggers at the end of your turn if you did not attack that turn.':
        '若你该回合没有攻击，则在你回合结束时触发。',
    'Triggers whenever this unit deals lethal damage to another unit.':
        '每当此单位对另一个单位造成致命伤害时触发。',
    'Triggers whenever another unit dies.': '每当另一个单位死亡时触发。',
    'Triggers at the start of it’s owners turn.': '在其持有者回合开始时触发。',
    'Triggers at the end of it’s owners turn.': '在其持有者回合结束时触发。',
    'Triggers at the end of every turn.': '在每个回合结束时触发。',
    'Can attack the turn it is played.': '打出的当回合即可攻击。',
    'When this unit deals damage its owner gains that much life.':
        '此单位造成伤害时，其持有者获得等量生命。',
    'This unit gets -1/-1 at the start of its owner\'s turn.':
        '在其持有者回合开始时，此单位 -1/-1。',
    'Causes a unit to become poisoned. Poisoned units get -1/-1 at the start of their owner\'s turn.':
        '使一个单位中毒。中毒的单位在其持有者回合开始时 -1/-1。',
    'Poisons any unit it damages. Poisoned units get -1/-1 at the start of their owner\'s turn.':
        '使被它伤害的单位中毒。中毒的单位在其持有者回合开始时 -1/-1。',
    'A unit of the Automaton, Structure or Vehicle types.':
        '机械偶、建筑或载具类型的单位。',
    'A unit of not of the Automaton, Structure or Vehicle types.':
        '非机械偶、建筑或载具类型的单位。',
    'Kill any unit damaged by this unit.':
        '消灭任何受到此单位伤害的单位。',
    'The first time this takes damage, negate that damage.':
        '此单位首次受到伤害时，将该伤害抵消。',
    'Refreshes at the end of each turn.': '在每个回合结束时刷新。',
    'When this dies, play it again at the end of the turn. It loses this ability.':
        '此单位死亡时，在回合结束时将它再次打出。之后它失去此能力。',
    'This unit does not ready at the start of its owners turn. Instead its sleep counter decreases by 1.':
        '此单位在其持有者回合开始时不会重置，其睡眠计数改为减少 1。',
    'Exhausts a unit and prevents it from readying.':
        '使一个单位疲惫并阻止其重置。',
    'Immune to sleep and poison.': '免疫睡眠和中毒。',
    'Whenever this unit dies, play it from the crypt at the end of the turn (it keeps this ability).':
        '每当此单位死亡时，在回合结束时将它从墓地再次打出（它保留此能力）。',
    'A 0/1 structure that cannot attack.': '一个 0/1、无法攻击的建筑。',
    // Stat tooltips
    '{name} {cost}': '{name} {cost}',
    '{name} deals {n} damage.': '{name} 造成 {n} 点伤害。',
    '{name} has {n} out of {max} life.': '{name} 生命值为 {n}/{max}。',
    '{name} gives its host a {n} damage bonus.':
        '{name} 使其宿主获得 {n} 点伤害加成。',
    '{name} gives its host a {n} life bonus.':
        '{name} 使其宿主获得 {n} 点生命加成。',
    'It costs {n} energy to empower or diminish {name}.':
        '强化或削弱 {name} 需要 {n} 点能量。',
    '{name} has {n} power.': '{name} 拥有 {n} 点力量。',
    Item: '物品',
    Enchantment: '附魔',

    // ---- Deck editor ----------------------------------------------------
    'Copy paste the deck code here.': '请将卡组代码粘贴到此处。',
    'Import succeeded.': '导入成功。',
    'Import Failed.': '导入失败。',
    'Deck copied to clipboard.': '卡组已复制到剪贴板。',
    'Done editing deck.': '完成卡组编辑。',
    'Fill deck with random cards.': '用随机卡牌填满卡组。',
    'Clear all cards from deck.': '清空卡组中的所有卡牌。',
    'Export Deck': '导出卡组',
    'Import Deck': '导入卡组',

    // ---- Deck metadata dialog -------------------------------------------
    'Deck Name': '卡组名称',
    'Deck Avatar': '卡组头像',
    Done: '完成',

    // ---- User (login / register / reset / upgrade / verify) -------------
    Login: '登录',
    'Username or Email': '用户名或邮箱',
    Password: '密码',
    'Sign In': '登录',
    'Reset Password': '重置密码',
    'Register Account': '注册账号',
    Username: '用户名',
    Email: '邮箱',
    'Create Account': '创建账号',
    'Login To Existing Account': '登录已有账号',
    'New Password': '新密码',
    'Password Reset': '重置密码',
    'Upgrade Guest Account': '升级游客账号',
    'You will keep your collection and get two free packs':
        '你将保留自己的收藏，并获得两个免费卡包',
    'Upgrade Account': '升级账号',
    'Return to Lobby': '返回大厅',
    'Working...': '处理中...',
    'Working..': '处理中..',
    'You must enter a value': '必须输入内容',
    'You must enter a value.': '必须输入内容。',
    'Only lower case letters, numbers, and single spaces between words be used.':
        '只能使用小写字母、数字以及单词之间的单个空格。',
    'That username is already in use.': '该用户名已被使用。',
    'Must be a valid email address.': '必须是有效的邮箱地址。',
    'That email is already in use.': '该邮箱已被使用。',
    'Must be at least 8 characters long.': '长度至少为 8 个字符。',
    'Cannot be longer than 256 characters.': '长度不能超过 256 个字符。',
    'No account exists with that username or email.':
        '没有使用该用户名或邮箱的账号。',
    'A password reset link has been sent to your email.':
        '密码重置链接已发送到你的邮箱。',
    'Password reset in process.': '正在重置密码。',
    'Your Password has been changed and you have been logged in.':
        '你的密码已更改，并且你已登录。',
    'There was a problem reseting your password. Your token may have expired.':
        '重置密码时出现问题。你的令牌可能已过期。',
    'Verification in process': '正在验证',
    'Your email has been verifed': '你的邮箱已验证',
    'Their was a problem verifying your email address.':
        '验证你的邮箱地址时出现问题。',

    // ---- Open pack ------------------------------------------------------
    'You have {packs} pack(s) and {gold} gold.':
        '你有 {packs} 个卡包和 {gold} 金币。',
    'Communicating with server.': '正在与服务器通信。',
    'You can\'t afford a pack': '金币不足，无法购买卡包',
    'Open a pack.': '打开一个卡包。',
    'Return to lobby': '返回大厅',
    'Buy a pack for 100 gold.': '用 100 金币购买一个卡包。',

    // ---- Daily dialog ---------------------------------------------------
    'Daily Rewards': '每日奖励',
    'Enjoy this free daily card. You can get another one after 24 hours.':
        '享受这张免费每日卡牌。24 小时后你可以再获得一张。',
    'Check back in {n} hours for a new daily reward.':
        '请在 {n} 小时后回来领取新的每日奖励。',

    // ---- Tournament -----------------------------------------------------
    'Fifth Aeon: A.I Tournament': 'Fifth Aeon：AI 锦标赛',
    Help: '帮助',
    Rules: '规则',
    Prizes: '奖励',
    Team: '战队',
    'Main Game': '主游戏',

    // Help page
    'Welcome FDG 2019 participants': '欢迎 FDG 2019 参赛者',
    'Important:': '重要：',
    'There will be an online discord information session on April 11th at 9am and again at 9pm PST. Please get familiar with the game, and bring all your questions to the discord session!':
        '太平洋时间 4 月 11 日上午 9 点和晚上 9 点将各有一场在线 Discord 说明会。请提前熟悉游戏，并带着你的所有问题参加 Discord 说明会！',
    'The goal of this competition is to create the strongest possible A.I player (bot) for the collectible card game':
        '本次比赛的目标是为集换式卡牌游戏',
    '. Fifth Aeon is a CCG that resembles well known games such as Magic the Gathering.':
        '打造尽可能强的 AI 玩家（机器人）。Fifth Aeon 是一款类似《万智牌》等知名游戏的集换式卡牌游戏（CCG）。',
    'To compete in the tournament, contestants will form teams of 1-4 people and create a bot using a tool called the Bot Tool Kit (BTK). There is a prebuilt and fully functional bot called DefaultAI which contestants may use as a starting point, thereby allowing competitors of all skill levels to participate.':
        '参加锦标赛时，参赛者将组成 1-4 人的队伍，并使用名为 Bot Tool Kit（BTK）的工具创建机器人。这里有一个名为 DefaultAI 的预构建、功能完整的机器人，参赛者可以将其作为起点，从而让各种水平的选手都能参与。',
    'There is a pool of prizes available for the winning teams, which consists of Amazon gift cards and Steam keys.':
        '获胜队伍可以获得一份奖池，其中包含亚马逊礼品卡和 Steam 激活码。',
    'Getting Started': '快速上手',
    'The best place to get started is at the': '最佳入门途径是阅读文档网站上的',
    'getting started guide': '上手指南',
    'on the documentation website.': '。',
    'Additional Resources': '更多资源',
    'You can ask questions or get help getting started on our':
        '你可以在我们的',
    'server.': '服务器上提问或寻求入门帮助。',
    discord: 'Discord',
    People: '组织者',
    'The tournament is being organized by William Ritson and Foaad Khosmood of California Polytechnic State University.':
        '本次锦标赛由加州州立理工大学（California Polytechnic State University）的 William Ritson 和 Foaad Khosmood 组织。',

    // Rules page
    Participation: '参赛资格',
    'In order to participate, you will need to create a Fifth Aeon account and create or join a team.':
        '参赛需要创建 Fifth Aeon 账号，并创建或加入一支队伍。',
    'A team may have between 1 and 4 individuls.':
        '每支队伍可由 1 到 4 名成员组成。',
    'You may not participate in more than one team or use more than one account in a single tournament.':
        '在同一锦标赛中，你不能参加多支队伍或使用多个账号。',
    'In order to participate you will need to fill out a reaserch survey before and after the tournament.':
        '参赛需要在锦标赛开始前和结束后各填写一份研究问卷。',
    'If you win a prize you will be required to write a 2 page description of your bot.':
        '如果你赢得奖项，你需要撰写一份 2 页的机器人技术说明。',
    'Game Mechanics': '比赛机制',
    'An A.I will be given a single process on the competition server to run on':
        '每个 AI 将在比赛服务器上被分配一个单独的进程来运行',
    'Each time an A.I gains priority it will have 5 seconds to make computations and send actions. If it fails to pass priority in that time, it will lose the game':
        'AI 每次获得优先权时，有 5 秒时间进行计算并发送操作。如果未能在该时间内让过优先权，将判负',
    'If an A.I sends an illegal action to the server, or an action which causes the game process to throw an exception it will lose the game':
        '如果 AI 向服务器发送非法操作，或发送导致游戏进程抛出异常的操作，将判负',
    'Banned Behaviors': '禁止行为',
    'Bots may no deliberately lose games.': '机器人不得故意输掉比赛。',
    'Bots are not allowed to access external resources such as remote servers or create additional processes.':
        '机器人不得访问远程服务器等外部资源，也不得创建额外的进程。',
    'Bots may not access any information that would not be available to a human player of the game. However, they may remember previously seen information or make inferences.':
        '机器人不得访问人类玩家无法获取的信息。但它们可以记住之前见过的信息或进行推理。',
    'Any bugs in the game’s code must be reported to the tournament organisers and may not be used to give your bot an advantage.':
        '游戏代码中的任何漏洞都必须报告给锦标赛组织者，不得利用漏洞为你的机器人谋取优势。',
    'Tournament Formats': '锦标赛赛制',
    'Games will be run over these three formats with bots gaining a score in all three. The overall winner will depend on a combination of the three scores.':
        '比赛将以下述三种赛制进行，机器人在三种赛制中都会获得积分。总冠军将取决于三项积分的综合表现。',
    'Preconstructed Format': '预组赛制',
    'In this format bots will compete against each other using a set of 10 decks provided by the tournament organizers. Bots will play against each other using all combinations of these decks.':
        '在该赛制中，机器人将使用锦标赛组织者提供的 10 套卡组相互对战。机器人将以这些卡组的所有组合进行对局。',
    'Constructed Format': '构筑赛制',
    'In this format bots will compete against each other using two decks provided by their author. Bots will play with both their own decks and their opponents’ decks.':
        '在该赛制中，机器人将使用其作者提供的两套卡组相互对战。机器人既会使用自己的卡组，也会使用对手的卡组。',
    'Limited Format': '限制赛制',
    'In this format bots will be provided a pool of 100 random cards with which to create a new deck. Their opponents will get the same pool.':
        '在该赛制中，机器人将获得一个由 100 张随机卡牌组成的卡池来组建新卡组。其对手也将获得相同的卡池。',
    'Key Dates': '关键日期',
    '(These are still subject to change)': '（具体安排仍可能变动）',
    'May 10th: Practice Tournament': '5 月 10 日：练习赛',
    'May 24th: Final Tournament': '5 月 24 日：决赛',

    // Prizes page
    'To be eligible to win a prize, you must meet the following criteria. You must be a member of a registered team, have submitted a bot, and have completed all of the presented research surveys. Additionally, if you are one of the finalists, you will be asked to write a description of the techniques you utilized for your bot.':
        '要获得获奖资格，你必须满足以下条件：你必须是已注册队伍的成员、已提交机器人，并已完成所有提供的研究问卷。此外，如果你是决赛选手，你将被要求撰写一份说明，介绍你在机器人中使用的技术。',
    'Only one Amazon gift card will be awarded to each of the winning teams, and allocation of funds will be decided upon by the teams\' members.':
        '每支获胜队伍将获得一张亚马逊礼品卡，奖金分配由队伍成员自行决定。',
    'There is also a selection of Steam keys available for various games. These games will be awarded to contestants based on their team\'s position in the tournament, with pick priority being given to the higher placing teams. Unlike the Amazon gift cards, these keys will be awarded on an individual basis, with the pick order for each member within a given team being randomly selected. After every member of a team has selected a game, the remaining pool of keys will be made available to the next team.':
        '此外还有多款游戏的 Steam 激活码。这些游戏将根据队伍在锦标赛中的名次发放给参赛者，名次较高的队伍拥有优先挑选权。与亚马逊礼品卡不同，激活码将按个人发放，同一队伍内各成员的挑选顺序随机确定。当一支队伍的所有成员都选完游戏后，剩余的激活码将提供给下一支队伍。',
    'First Place': '第一名',
    'Second Place': '第二名',
    'Third Place': '第三名',
    '$100 Amazon gift card': '100 美元亚马逊礼品卡',
    '$50 Amazon gift card': '50 美元亚马逊礼品卡',
    '$25 Amazon gift card': '25 美元亚马逊礼品卡',
    'Game Key Prizes': '游戏激活码奖励',

    // Teams page
    'Team Mates': '队伍成员',
    'is the leader.': '是队长。',
    'is a member.': '是成员。',
    'You can invite more team members with the code':
        '你可以使用以下邀请码邀请更多队伍成员：',
    'click to the cody to copy it': '（点击复制）',
    Actions: '操作',
    'Submit Bot': '提交机器人',
    'You’re not on a team yet.': '你还没有加入队伍。',
    Or: '或者',
    'Join an existing Team': '加入已有队伍',
    'You need to': '你需要',
    'log in': '登录',
    'to manage your team.': '才能管理你的队伍。',
    'to manage submit.': '才能进行提交。',
    'Enter the teams join code': '请输入队伍邀请码',
    'Join code copied to clipboard.': '邀请码已复制到剪贴板。',
    'You are not in a team': '你还没有加入队伍',
    'You are the leader of team {team}.': '你是 {team} 队伍的队长。',
    'You are a member of team {team}.': '你是 {team} 队伍的成员。',
    'Dissolve your team': '解散你的队伍',
    'Quit your team': '退出你的队伍',
    'Are you sure you want to do that? It cannot be reversed.':
        '你确定要这样做吗？此操作无法撤销。',

    // Submit page
    'Past Submissions': '历史提交',
    On: '提交于',
    'submitted a version': '提交了一个版本',
    Instructions: '操作说明',
    'Within your bot tool kit installation, navigate to src/bots. Make a copy of the folder then remove all bots other than the one your team intends to submit. Compress the copied folder into an .zip archive and upload that archive here.':
        '在你的机器人工具包（Bot Tool Kit）安装目录中，进入 src/bots。复制该文件夹，然后删除除队伍要提交的机器人以外的所有机器人。将复制的文件夹压缩为 .zip 压缩包，并在此处上传。',
    'Submit your bot': '提交你的机器人',
    'Upload Bot Version': '上传机器人版本',

    // New team page
    'Form a new Team': '组建新队伍',
    'Team Name': '队伍名称',
    'Legal name of Team Contact': '队伍联系人的法定姓名',
    'Email of Team Contact': '队伍联系人的邮箱',
    'Affiliated school or organisation': '所属学校或机构',
    'Launch Team': '创建队伍',

    // ---- Card Editor (modding) 卡牌编辑器 --------------------------------
    'Fifth Aeon - Editor': 'Fifth Aeon - 编辑器',
    'Card List': '卡牌列表',
    'Set List': '系列列表',
    'Activate Sets': '启用系列',
    'Lobby': '返回大厅',
    'Basic Information': '基本信息',
    'Card Name': '卡牌名称',
    'Card Type': '卡牌类型',
    'Upload Image': '上传图片',
    'Resource Cost': '资源费用',
    'Energy Cost': '能量费用',
    'Synthesis Requirement': '合成需求',
    'Growth Requirement': '生长需求',
    'Decay Requirement': '凋零需求',
    'Renewal Requirement': '新生需求',
    'Unit Information': '单位信息',
    'Damage': '攻击力',
    'Maximum Life': '最大生命',
    'Unit Type': '单位类型',
    'Item Information': '物品信息',
    'Damage Bonus': '攻击力加成',
    'Life Bonus': '生命加成',
    'Enchantment Information': '附魔信息',
    'Empower/Disempower Cost': '强化/削弱费用',
    'Base Power': '基础力量',
    'Card Preview': '卡牌预览',
    'Refresh Preview': '刷新',
    'Click the button in the bottom right to get started.':
        '点击右下角的按钮开始创建卡牌。',
    'New Card': '新卡牌',
    'Mechanics': '机制',
    'Mechanic ID': '机制 ID',
    'Trigger ID': '触发 ID',
    'Targeter ID': '目标器 ID',
    'Use Host Targeter': '使用宿主目标器',
    'Move Up': '上移',
    'Move Down': '下移',
    'Delete Mechanic': '删除机制',
    'Add Mechanic': '添加机制',
    'Resource PLaceholder': '资源参数（暂不支持图形化编辑）',
    'Set Name': '系列名称',
    'Set Description': '系列描述',
    'Public': '公开',
    'Edit Cards': '编辑卡牌',
    'Delete': '删除',
    'New Set': '新系列',
    'Click the button in the bottom right to create a new set.':
        '点击右下角的按钮创建新系列。',
    'By': '作者：',
    'Active': '启用',
    'Select a set to see its contents.': '选择一个系列以查看其中的卡牌。',
    'This set is empty.': '该系列为空。',
    'Optional': '可选',

    // ---- 编辑器下拉的 ID 显示名（值仍传英文 ID，仅显示翻译）----
    // Mechanic IDs
    AbominationConsume: '憎恶吞噬',
    Annihilate: '湮灭',
    AugarCard: '占卜',
    BiteDamage: '撕咬伤害',
    BuffTarget: '属性增益',
    CannotBeDiminished: '不能被削弱',
    CannotBeEmpowered: '不能被强化',
    CannotBlock: '不能阻挡',
    ChangePower: '改变力量',
    CurePoison: '解除中毒',
    DamageOnBlock: '阻挡伤害',
    DamageSpawnOnKill: '击杀召唤',
    DealDamage: '造成伤害',
    DealResourceDamage: '资源伤害',
    DeathCounter: '死亡计数（护盾）',
    Discard: '弃牌',
    DiscardOnDamage: '伤害弃牌',
    DrainPower: '吸取力量',
    DrainPowerIntoStats: '力量转属性',
    DrawCard: '抽牌',
    DrawCardsFromUnit: '按单位抽牌',
    EnchantmentSummon: '附魔召唤',
    ForceField: '力场',
    FriendlyLordship: '友方统领',
    GainLife: '获得生命',
    GainResource: '获得资源',
    GrantAbility: '授予能力',
    ImprisonTarget: '囚禁目标',
    ImprisonTemporarily: '临时囚禁',
    KillTarget: '杀死目标',
    Lordship: '统领光环',
    MindControl: '心灵控制',
    NotUnitTypeLordship: '非该类型统领',
    Peek: '窥视手牌',
    PoisonImmune: '免疫中毒',
    PoisonTarget: '施毒',
    PreventAllDamage: '防止所有伤害',
    RefreshTarget: '重置目标',
    RemovePower: '移除力量',
    ReturnFromCrypt: '墓地回收',
    ShuffleIntoDeck: '洗入牌库',
    SleepTarget: '催眠目标',
    SpyPower: '间谍力量',
    SummonUnitForGrave: '按墓地召唤',
    SummonUnitOnDamage: '受伤召唤',
    SummonUnits: '召唤单位',
    TransformDamaged: '受伤变身',
    UnitTypeLordshipAll: '全体类型统领',
    UnitTypeLordshipExclusive: '同类统领（不含自身）',
    UnitTypeLordshipInclusive: '同类统领（含自身）',
    WebTarget: '蛛网缠身',
    WinIfHighLife: '高生命获胜',

    // Trigger IDs
    Death: '死亡',
    FriendlyBioUnitEntersPlay: '友方生物单位进场',
    FriendlyMechUnitEntersPlay: '友方机械单位进场',
    FriendlyUnitEntersPlay: '友方单位进场',
    LethalStrike: '致命一击',
    OwnerAttacked: '持有者被攻击',
    OwnerDrawsUnit: '持有者抽到单位',
    SoulReap: '亡魂收割',
    UnitEntersPlay: '单位进场',

    // Targeter IDs
    AllEnchantments: '所有附魔',
    AllOtherUnits: '其他所有单位',
    AllPermanents: '所有永久物',
    AllPlayers: '所有玩家',
    AllUnits: '所有单位',
    BiologicalUnit: '生物单位',
    CurePoisonTargeter: '可解毒单位',
    DamagedUnit: '受伤单位',
    Enemies: '敌方全体',
    EnemyPlayer: '敌方玩家',
    EnemyUnit: '敌方单位',
    EnemyUnits: '敌方单位全体',
    Everyone: '全体',
    FriendlyBiologicalUnits: '友方生物单位',
    FriendlyUnit: '友方单位',
    FriendlyUnits: '友方单位全体',
    FriendlyUnitsOfType: '友方同类型单位',
    FriendlyVehicleOrStructure: '友方载具或建筑',
    Friends: '友方全体',
    LifeLessUnit: '低生命单位',
    LifeLessUnits: '低生命单位全体',
    MechanicalUnit: '机械单位',
    OwningPlayer: '持有者',
    PoisonableUnit: '可中毒单位',
    PoisonableUnits: '可中毒单位全体',
    SelfTarget: '自身',
    SingleUnit: '单个单位',
    SleepableUnit: '可催眠单位',
    TriggeringUnit: '触发单位',
    UnitOfType: '指定类型单位',
    UnitsNotOfType: '非该类型单位',
    UnitsOfType: '该类型单位',
    UnitsOfTypeAsTarget: '该类型单位全体',
    UnitWithAbility: '具有能力的单位',
    Untargeted: '无目标'
};
