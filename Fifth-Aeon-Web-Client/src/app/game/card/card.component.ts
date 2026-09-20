import { Component, OnInit, Input } from '@angular/core';
import { Card, GameZone, CardType } from '../../game_model/card-types/card';
import { Unit, UnitType } from '../../game_model/card-types/unit';
import { Enchantment } from '../../game_model/card-types/enchantment';
import { Item } from '../../game_model/card-types/item';
import { Game } from '../../game_model/game';
import { cardList } from '../../game_model/cards/cardList';
import { Resource } from 'app/game_model/resource';
import { Untargeted } from 'app/game_model/cards/targeters/basicTargeter';
import { Spell } from 'app/game_model/card-types/spell';
import { I18nService } from 'app/i18n/i18n.service';
import { t, getLocale } from '../../game_model/i18n';

enum GlowType {
    None,
    Select,
    Attack,
    Defense,
    Targeted
}

const keywordsDefs = new Map<string, string>();

// Game mechanics
keywordsDefs.set(
    'Refresh',
    'Refreshing restores a unit’s health and removes exhaustion. Units normally refresh at the start of their owners turn.'
);

// Evasion
keywordsDefs.set(
    'Flying',
    'Can only be blocked by units with flying or ranged.'
);
keywordsDefs.set('Ranged', 'Can block units with flying.');
keywordsDefs.set(
    'Aquatic',
    'Can only be blocked by units with aquatic or flying and can only block other aquatic units.'
);
keywordsDefs.set('Unblockable', 'Can not be blocked.');

// Enchantments
keywordsDefs.set('Discharge', 'Loses power at the start of its owner’s turn.');
keywordsDefs.set('Recharge', 'Gains power at the start of its owner’s turn.');

// Triggers
keywordsDefs.set('Play', 'Triggers when this is played.');
keywordsDefs.set('Death:', 'Triggers when this is killed.');
keywordsDefs.set(
    'Affinity',
    'Triggers the first time you summon a unit of the same type.'
);
keywordsDefs.set(
    'Serenity',
    'Triggers at the end of your turn if you did not attack that turn.'
);
keywordsDefs.set(
    'Lethal Strike',
    'Triggers whenever this unit deals lethal damage to another unit.'
);
keywordsDefs.set('Soul Reap', 'Triggers whenever another unit dies.');
keywordsDefs.set('Dawn', 'Triggers at the start of it’s owners turn.');
keywordsDefs.set('Dusk', 'Triggers at the end of it’s owners turn.');
keywordsDefs.set('Cycle', 'Triggers at the end of every turn.');

// Powers
keywordsDefs.set('Rush', 'Can attack the turn it is played.');
keywordsDefs.set(
    'Lifesteal',
    'When this unit deals damage its owner gains that much life.'
);
keywordsDefs.set(
    'Poisoned',
    'This unit gets -1/-1 at the start of its owner\'s turn.'
);
keywordsDefs.set(
    'Poison',
    'Causes a unit to become poisoned. Poisoned units get -1/-1 at the start of their owner\'s turn.'
);
keywordsDefs.set(
    'Venomous',
    'Poisons any unit it damages. Poisoned units get -1/-1 at the start of their owner\'s turn.'
);
keywordsDefs.set(
    'Mechanical',
    'A unit of the Automaton, Structure or Vehicle types.'
);
keywordsDefs.set(
    'Biological',
    'A unit of not of the Automaton, Structure or Vehicle types.'
);
keywordsDefs.set('Lethal', 'Kill any unit damaged by this unit.');
keywordsDefs.set(
    'Shielded',
    'The first time this takes damage, negate that damage.'
);
keywordsDefs.set('Relentless', 'Refreshes at the end of each turn.');
keywordsDefs.set(
    'Deathless',
    'When this dies, play it again at the end of the turn. It loses this ability.'
);
keywordsDefs.set(
    'Sleeping',
    'This unit does not ready at the start of its owners turn. Instead its sleep counter decreases by 1.'
);
keywordsDefs.set('Sleep', 'Exhausts a unit and prevents it from readying.');
keywordsDefs.set('Robotic', 'Immune to sleep and poison.');
keywordsDefs.set(
    'Immortal',
    'Whenever this unit dies, play it from the crypt at the end of the turn (it keeps this ability).'
);

// Tokens
keywordsDefs.set('Statue', 'A 0/1 structure that cannot attack.');

/**
 * 中文卡牌文本 → 规范英文关键词名（keywordsDefs 的 key）。
 * 卡牌文本汉化后，英文关键词正则无法再扫描中文描述，因此中文语境下
 * 改用本映射构建扫描正则，并把匹配结果归一化回英文规范名。
 * 注意：数组顺序即正则优先级，长词必须排在对应短词之前
 * （如 '致命一击' 先于 '致命'）。
 */
const zhKeywordAliases: Array<[string, string]> = [
    ['打出：', 'Play'],
    ['亡语：', 'Death:'],
    ['致命一击', 'Lethal Strike'],
    ['亡魂收割', 'Soul Reap'],
    ['生命窃取', 'Lifesteal'],
    ['机械造物', 'Mechanical'],
    ['生物单位', 'Biological'],
    ['不可阻挡', 'Unblockable'],
    ['(?<!免疫)中毒', 'Poisoned'],
    ['重置', 'Refresh'],
    ['飞行', 'Flying'],
    ['远程', 'Ranged'],
    ['水栖', 'Aquatic'],
    ['耗能', 'Discharge'],
    ['充能', 'Recharge'],
    ['共鸣', 'Affinity'],
    ['宁静', 'Serenity'],
    ['黎明', 'Dawn'],
    ['黄昏', 'Dusk'],
    ['循环', 'Cycle'],
    ['突进', 'Rush'],
    ['施毒', 'Poison'],
    ['剧毒', 'Venomous'],
    ['致命', 'Lethal'],
    ['护盾', 'Shielded'],
    ['无情', 'Relentless'],
    ['不死', 'Deathless'],
    ['沉睡', 'Sleeping'],
    ['催眠', 'Sleep'],
    ['机械体', 'Robotic'],
    ['不朽', 'Immortal'],
    ['石像', 'Statue']
];

/**
 * 衍生单位（Token）登记表，key 为当前语言的卡名。
 * 惰性构建：模块加载时游戏语言尚未设置（getName() 会返回英文），
 * 必须延迟到首次扫描时再按当前 locale 构建。
 */
let tokenUnitsCache: { locale: string; map: Map<string, Unit> } | null = null;
function getTokenUnits(): Map<string, Unit> {
    const locale = getLocale();
    if (!tokenUnitsCache || tokenUnitsCache.locale !== locale) {
        const map = new Map<string, Unit>();
        cardList
            .getCards()
            .filter(card => card instanceof Unit)
            .forEach(card => {
                map.set(card.getName(), card as Unit);
            });
        tokenUnitsCache = { locale, map };
    }
    return tokenUnitsCache.map;
}

const depletedRegex = /\[depleted\](.*?)\[\/depleted\]/gi;
const dynamicRegex = /\[dynamic\](.*?)\[\/dynamic\]/gi;

interface KeywordScan {
    locale: string;
    /** 用于从文本中提取关键词（无边界要求） */
    extractRegex: RegExp;
    /** 用于给文本中的关键词加粗（带词边界） */
    wordRegex: RegExp;
    /** 匹配文本 → 规范英文关键词名 */
    alias: Map<string, string>;
}

function buildKeywordScan(locale: string): KeywordScan {
    const alias = new Map<string, string>();
    let tokens: string[];
    if (locale === 'zh-CN') {
        tokens = [];
        for (const [pattern, en] of zhKeywordAliases) {
            tokens.push(pattern);
            // 别名表允许携带 lookbehind 等正则修饰（如 '(?<!免疫)中毒'），
            // 归一化映射必须使用剥离修饰后的纯文本键。
            const plain = pattern.replace(/^\(\?<[=!][^)]*\)/, '');
            alias.set(plain, en);
        }
    } else {
        tokens = Array.from(keywordsDefs.keys());
        tokens.forEach(key => alias.set(key, key));
    }
    const tokenNames = Array.from(getTokenUnits().keys());
    tokenNames.forEach(name => alias.set(name, name));
    return {
        locale,
        extractRegex: new RegExp(tokens.concat(tokenNames).join('|'), 'gi'),
        wordRegex: new RegExp(
            tokens
                .concat(tokenNames)
                .map(token => `(?<![\\w\\u4e00-\\u9fa5])${token}(?![\\w\\u4e00-\\u9fa5])`)
                .join('|'),
            'gi'
        ),
        alias
    };
}

function toProperCase(str: string) {
    return str.replace(/\b\w/g, l => l.toUpperCase());
}

const dummyCard = new Spell('', '', '', new Resource(1), new Untargeted(), []);

@Component({
    selector: 'ccg-card',
    templateUrl: './card.component.html',
    styleUrls: ['./card.component.scss']
})
export class CardComponent implements OnInit {
    @Input() card: Card = dummyCard;
    @Input() game?: Game;
    @Input() scale = 1.0;
    @Input() distFromMid = 0;
    @Input() darkened = false;
    @Input() selected = false;
    @Input() target = false;
    @Input() overlap = false;
    @Input() noTranslate = false;

    public padding = 30;
    public hovered = false;
    private scanCache: KeywordScan | null = null;

    public tooltipClass = {
        multiline: true
    };
    public glowTypes = GlowType;

    constructor(private i18n: I18nService) {}

    public get itemLabel() {
        return this.i18n.tr('Item');
    }

    public get enchantmentLabel() {
        return this.i18n.tr('Enchantment');
    }

    public costTooltip() {
        return this.i18n.tr('{name} {cost}', {
            name: this.card.getName(),
            cost: this.card.getCost().asSentence()
        });
    }

    public attackTooltip() {
        if (!(this.card instanceof Unit)) {
            return '';
        }
        return this.i18n.tr('{name} deals {n} damage.', {
            name: this.card.getName(),
            n: this.card.getDamage()
        });
    }

    public lifeTooltip() {
        if (!(this.card instanceof Unit)) {
            return '';
        }
        return this.i18n.tr('{name} has {n} out of {max} life.', {
            name: this.card.getName(),
            n: this.card.getLife(),
            max: this.card.getMaxLife()
        });
    }

    public itemDamageTooltip() {
        if (!(this.card instanceof Item)) {
            return '';
        }
        return this.i18n.tr('{name} gives its host a {n} damage bonus.', {
            name: this.card.getName(),
            n: this.card.getDamage()
        });
    }

    public itemLifeTooltip() {
        if (!(this.card instanceof Item)) {
            return '';
        }
        return this.i18n.tr('{name} gives its host a {n} life bonus.', {
            name: this.card.getName(),
            n: this.card.getLife()
        });
    }

    public enchantmentCostTooltip() {
        if (!(this.card instanceof Enchantment)) {
            return '';
        }
        return this.i18n.tr('It costs {n} energy to empower or diminish {name}.', {
            n: this.card.getModifyCost().getMaxNumeric(),
            name: this.card.getName()
        });
    }

    public powerTooltip() {
        if (!(this.card instanceof Enchantment)) {
            return '';
        }
        return this.i18n.tr('{name} has {n} power.', {
            name: this.card.getName(),
            n: this.card.getPower()
        });
    }

    public getResUrl(type: string) {
        switch (type) {
            case 'G':
                return 'assets/png/growth-small.png';
            case 'S':
                return 'assets/png/synthesis-small.png';
            case 'D':
                return 'assets/png/decay-small.png';
            case 'R':
                return 'assets/png/renewal-small.png';
        }
    }

    public isUnit(card: Card) {
        return card instanceof Unit ;
    }

    public getSymbolSize() {
        return this.y() * 0.1 - 3;
    }

    public getSymbolPadding() {
        // Area - symbol size / max symbols
        return (this.x() - 27.5 - this.getSymbolSize() * 6) / 12;
    }

    public isItem(card: Card) {
        return card.getCardType() === CardType.Item;
    }

    public isEnchantment(card: Card) {
        return card.getCardType() === CardType.Enchantment;
    }

    public getType(type: UnitType) {
        return t(UnitType[type]);
    }

    public getMargins() {
        let marginLeft = -9;
        let marginRight = -9;
        if (this.overlap) {
            if (this.hovered) {
                marginRight = 41;
                marginLeft = -9;
            } else {
                marginLeft = -50;
            }
        }
        const rotation = this.hovered ? 0 : 3 * this.distFromMid;
        let dispY = this.overlap
            ? Math.abs(this.distFromMid === 0 ? 0.5 : this.distFromMid) * 4
            : 0;
        marginRight -= Math.abs(this.distFromMid) * 5;
        marginLeft -= Math.abs(this.distFromMid) * 5;
        if (this.hovered && this.overlap) {
            dispY = -15;
        }
        const css = {
            'margin-left': marginLeft + 'px',
            'margin-right': marginRight + 'px',
            transform: !this.noTranslate
                ? `translateY(-${50 - dispY}%) rotate(${rotation}deg)`
                : 'none'
        };
        return css;
    }

    public htmlText(text: string) {
        const { wordRegex } = this.getKeywordScan();
        return text
            .replace(wordRegex, sub => `<b>${sub}</b>`)
            .replace(
                depletedRegex,
                (_, content) => `<span class="depleted">${content}</span>`
            )
            .replace(
                dynamicRegex,
                (_, content) => `<span class="dynamic">${content}</span>`
            );
    }

    private getKeywordScan(): KeywordScan {
        const locale = getLocale();
        if (!this.scanCache || this.scanCache.locale !== locale) {
            this.scanCache = buildKeywordScan(locale);
        }
        return this.scanCache;
    }

    private getKeywords() {
        if (!this.card) {
            throw new Error('Card lacks required inputs');
        }
        const { extractRegex, alias } = this.getKeywordScan();
        const matches = this.card.getText(this.game).match(extractRegex) || [];
        return Array.from(
            new Set(matches.map(match => alias.get(match) ?? match))
        );
    }

    public keywords() {
        return this.getKeywords()
            .map(key => {
                const name = toProperCase(key);
                // 关键词名去掉尾部冒号（如 'Death:' → '亡语'），避免与
                // 后面的分隔符 ' - ' 叠加出 '亡语： - ' 的观感问题。
                const label = this.i18n
                    .tr(name)
                    .replace(/[：:]$/, '');
                return label + ' - ' + this.keywordDef(name);
            })
            .join(' \n\n ');
    }

    private keywordDef(name: string) {
        const unit = getTokenUnits().get(name);
        if (unit) {
            let base = `${unit.getDamage()}/${unit.getLife()} ${t(
                UnitType[unit.getUnitType()]
            )}`;
            const text = unit.getText();
            if (text.length > 0) {
                // zh 的 'with' 译值自带前导标点，en 需要 ASCII 空格分隔
                const glue = getLocale() === 'zh-CN' ? '' : ' ';
                base += `${glue}${this.i18n.tr('with')} "${text}"`;
            }
            return base;
        }
        return this.i18n.tr(keywordsDefs.get(name) ?? '');
    }

    public getImage() {
        if (!this.card) {
            throw new Error('Card lacks required inputs');
        }
        const url = this.card.getImage();
        const prefix = url.includes('data:image/png;base64')
            ? ''
            : 'assets/png/';
        return prefix + this.card.getImage();
    }

    public glowType() {
        if (this.selected) {
            return GlowType.Select;
        }
        if (this.target) {
            return GlowType.Targeted;
        }
        if (!this.card) {
            throw new Error('Card lacks required inputs');
        }
        if (this.card.isAttacking()) {
            return GlowType.Attack;
        }
        if (this.card.isBlocking()) {
            return GlowType.Defense;
        }
        return GlowType.None;
    }

    public x() {
        return (this.hovered ? 1.9 : this.scale) * 100;
    }

    public y() {
        return (this.hovered ? 1.9 : this.scale) * 140;
    }

    ngOnInit() {
        if (!this.scale) {
            this.scale = 1.25;
        }
        this.distFromMid = this.distFromMid || 0;
    }
}
