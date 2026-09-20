/**
 * 全量卡牌文本扫描：输出仍含英文句子的卡牌描述。
 * 用法: node scan-all-cards.js
 */
const { setLocale } = require('./Fifth-Aeon-Server/dist/game_model/i18n/index.js');
setLocale('zh-CN');

const { cardList } = require('./Fifth-Aeon-Server/dist/game_model/cards/cardList.js');

let issues = 0;
for (const card of cardList.getCards()) {
    let text;
    try {
        text = card.getText();
    } catch (e) {
        console.log('[需要 game 参数] ' + card.getName() + ' (' + e.message.slice(0, 60) + ')');
        continue;
    }
    // 判定"残留英文"：含至少 3 个连续英文字母组成的单词，且不是允许的符号/标记
    const words = (text.match(/[A-Za-z]{3,}/g) || []).filter(
        w => !/^(X|hp)$/i.test(w)
    );
    if (words.length > 0) {
        issues++;
        console.log('[' + card.getName() + '] ' + text.replace(/\n/g, ' '));
        console.log('   英文词: ' + words.join(', '));
    }
}
console.log('---\n残留: ' + issues + ' 张卡');
