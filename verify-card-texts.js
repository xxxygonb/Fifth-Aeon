/**
 * 卡牌文本汉化验证脚本（用 Server 编译产物直接验证）
 * 用法: node verify-card-texts.js
 */
const { setLocale } = require('./Fifth-Aeon-Server/dist/game_model/i18n/index.js');
setLocale('zh-CN');

const growth = require('./Fifth-Aeon-Server/dist/game_model/cards/growthCards.js');
const renewal = require('./Fifth-Aeon-Server/dist/game_model/cards/renewalCards.js');
const decay = require('./Fifth-Aeon-Server/dist/game_model/cards/decayCards.js');

const cases = [
    ['进化跃迁', growth.evolutionaryLeap()],
    ['自然馈赠', growth.bounty()],
    ['治疗', renewal.heal()],
    ['破晓', renewal.Dawnbreak()],
    ['死灵法师之杖(装备)', decay.NecromancerStaff()],
    ['苦痛之鞭(装备)', decay.whip()]
];

for (const [label, card] of cases) {
    console.log('【' + label + '】' + card.getName());
    console.log('  ' + card.getText().replace(/\n/g, ' '));
}
