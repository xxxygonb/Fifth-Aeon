import { Card } from '../../card-types/card';
import { Unit } from '../../card-types/unit';
import { Game } from '../../game';
import { t } from '../../i18n';
import { Skill } from './skill';

/**
 * 狂怒(Fury)——教程示例效果器(CARD_CREATION_GUIDE_CN.md 第 6 章)。
 *
 * 效果:此单位每次受到伤害后获得 +1/+1。
 *
 * 实现要点(与所有关键词类效果器一致的三段式):
 *  1. enter()  —— 挂事件钩子:订阅单位的 takeDamage 事件,
 *     每次触发调用 unit.buff(1, 1) 完成 +1/+1(攻击力与生命上限同步 +1);
 *  2. remove() —— 离场/被移除时清理钩子,防止内存泄漏与重复触发;
 *  3. getText()/evaluate() —— 卡面文本(走 i18n)与 AI 价值评估。
 *
 * 继承 Skill:自动获得「仅单位/物品可用」与「可被授予能力(GrantAbility)
 * 转移给其他单位」两个特性,无需额外代码。
 */
export class Fury extends Skill {
    protected static id = 'Fury';

    public enter(card: Card, game: Game) {
        (card as Unit).getEvents().takeDamage.addEvent(this, params => {
            (card as Unit).buff(1, 1);
            return params;
        });
    }

    public remove(card: Card, game: Game) {
        (card as Unit).getEvents().removeEvents(this);
    }

    public getText(card: Card) {
        return t('Fury.');
    }

    public evaluate(card: Card) {
        return { addend: 0, multiplier: 1.3 };
    }
}
