/** 编辑器专用的效果器/触发器显示名（带说明，双语）。
 *  独立成文件的原因:
 *  1. mechanic-editor 与 parameter-editor(Ability 参数下拉)共用,
 *     避免在两个组件里维护两份映射;
 *  2. 全局字典(zh-CN-2.ts)里这些 ID 只有卡面用的短翻译,
 *     编辑器下拉需要「名称 · 规则说明」的完整展示。
 *  新增效果器时若此处没有条目,将退回 i18n.tr(id) 显示。 */

import { I18nService } from '../i18n/i18n.service';

export interface BilingualLabel {
    zh: string;
    en: string;
}

export const TRIGGER_LABELS: Record<string, BilingualLabel> = {
    Play: { zh: '打出 · 这张牌被打出时', en: 'When played' },
    Death: { zh: '亡语 · 此单位死亡时', en: 'When this dies' },
    UnitEntersPlay: {
        zh: '单位入场 · 任意单位进场时',
        en: 'When any unit enters play'
    },
    FriendlyUnitEntersPlay: {
        zh: '友方单位入场时',
        en: 'When a friendly unit enters play'
    },
    FriendlyBioUnitEntersPlay: {
        zh: '友方生物入场时',
        en: 'When a friendly biological unit enters play'
    },
    FriendlyMechUnitEntersPlay: {
        zh: '友方机械入场时',
        en: 'When a friendly mechanical unit enters play'
    },
    Affinity: {
        zh: '共鸣 · 首次召唤同种族单位时',
        en: 'When you first summon a unit of the same type'
    },
    Serenity: {
        zh: '宁静 · 回合结束且未攻击时',
        en: 'At end of turn if you did not attack'
    },
    Dawn: { zh: '黎明 · 你的回合开始时', en: 'At the start of your turn' },
    Dusk: { zh: '黄昏 · 你的回合结束时', en: 'At the end of your turn' },
    Cycle: { zh: '循环 · 每个回合结束时', en: 'At the end of every turn' },
    LethalStrike: {
        zh: '致命一击 · 造成致命伤害后',
        en: 'After dealing lethal damage'
    },
    SoulReap: {
        zh: '亡魂收割 · 任意其他单位死亡时',
        en: 'Whenever another unit dies'
    },
    OwnerAttacked: { zh: '你被攻击时', en: 'When you are attacked' },
    OwnerDrawsUnit: {
        zh: '你抽到单位牌时',
        en: 'When you draw a unit card'
    }
};

export const MECHANIC_LABELS: Record<string, BilingualLabel> = {
    Flying: {
        zh: '飞行 · 只能被飞行或远程单位阻挡',
        en: 'Can only be blocked by flying or ranged units'
    },
    Ranged: {
        zh: '远程 · 可以阻挡飞行单位',
        en: 'Can block units with flying'
    },
    Aquatic: {
        zh: '水栖 · 只能被飞行/水栖阻挡，也只能阻挡水栖',
        en: 'Blockable only by flying or aquatic; blocks only aquatic'
    },
    Unblockable: {
        zh: '不可阻挡 · 无法被任何单位阻挡',
        en: 'Cannot be blocked'
    },
    Rush: {
        zh: '突进 · 打出的当回合即可攻击',
        en: 'Can attack the turn it is played'
    },
    Lifesteal: {
        zh: '生命窃取 · 造成伤害时回复等量生命',
        en: 'Gains life equal to damage dealt'
    },
    Fury: {
        zh: '狂怒 · 每次受到伤害后获得 +1/+1',
        en: 'Gains +1/+1 whenever it takes damage'
    },
    Lethal: {
        zh: '致命 · 受到此单位伤害的单位直接死亡',
        en: 'Any unit it damages dies'
    },
    Shielded: {
        zh: '护盾 · 首次受到的伤害改为 0',
        en: 'Negates the first damage taken'
    },
    Relentless: {
        zh: '无情 · 每回合结束时重新就绪',
        en: 'Refreshes at the end of each turn'
    },
    Deathless: {
        zh: '不死 · 死亡后在回合末复活一次并失去此能力',
        en: 'Revives once at end of turn after dying, losing this ability'
    },
    Immortal: {
        zh: '不朽 · 死亡后在回合末从墓地复活（保留能力）',
        en: 'Revives from the crypt at end of turn after dying'
    },
    Venomous: {
        zh: '剧毒 · 被此单位伤害的单位中毒',
        en: 'Poisons units it damages'
    },
    Poisoned: {
        zh: '中毒 · 每回合开始时 -1/-1',
        en: '-1/-1 at the start of its owner turn'
    },
    Sleeping: {
        zh: '沉睡 · 无法就绪，睡眠计数逐回合递减',
        en: 'Cannot ready; sleep counter decreases each turn'
    },
    CannotAttack: {
        zh: '不能攻击 · 此单位无法发起攻击',
        en: 'This unit cannot attack'
    },
    Robotic: {
        zh: '机械体 · 免疫催眠与中毒',
        en: 'Immune to sleep and poison'
    }
};

/** 按当前语言取显示名；无条目时退回全局字典翻译 */
export function formatMechanicLabel(
    id: string,
    i18n: I18nService
): string {
    const label = MECHANIC_LABELS[id];
    if (!label) {
        return i18n.tr(id);
    }
    return i18n.getLang() === 'en-US' ? label.en : label.zh;
}

/** 按当前语言取触发器显示名；无条目时退回全局字典翻译 */
export function formatTriggerLabel(
    id: string,
    i18n: I18nService
): string {
    const label = TRIGGER_LABELS[id];
    if (!label) {
        return i18n.tr(id);
    }
    return i18n.getLang() === 'en-US' ? label.en : label.zh;
}
