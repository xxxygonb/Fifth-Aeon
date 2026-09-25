import { Component, Input } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { Card } from '../../game_model/card-types/card';
import { cardList, SpellData, defaultDataObj } from '../../game_model/cards/cardList';
import {
    MechanicData,
    mechanicList
} from '../../game_model/cards/mechanicList';
import { buildParameters } from '../../game_model/cards/parameters';
import { targeterList } from '../../game_model/cards/targeterList';
import { triggerList } from '../../game_model/cards/triggerList';
import { I18nService } from '../../i18n/i18n.service';

/** 编辑器专用的触发器显示名（带说明）。
 *  Play/Affinity/Serenity/Dawn/Dusk/Cycle 在全局字典中已有简短的
 *  关键词翻译（卡面加粗与 tooltip 用），因此编辑器下拉在这里独立映射，
 *  并按当前语言输出，避免切换语言后仍显示中文。 */
interface BilingualLabel {
    zh: string;
    en: string;
}

const TRIGGER_LABELS: Record<string, BilingualLabel> = {
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

/** 关键词类机制（Skill）的编辑器显示名（带说明）。
 *  全局字典里这些 ID 只有短翻译（供卡面加粗与 tooltip 标题使用），
 *  编辑器下拉需要完整说明，因此在此覆盖，并按当前语言输出。 */
const MECHANIC_LABELS: Record<string, BilingualLabel> = {
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

@Component({
    selector: 'ccg-mechanic-editor',
    templateUrl: './mechanic-editor.component.html',
    styleUrls: ['./mechanic-editor.component.scss']
})
export class MechanicEditorComponent {
    public mechanicList = mechanicList;
    @Input() public card: SpellData = defaultDataObj;

    constructor(private i18n: I18nService) {}

    public changeMechanic(data: MechanicData, event: MatSelectChange) {
        const paramTypes = mechanicList
            .getParameters(data)
            .map(param => param.type);
        data.parameters = buildParameters(paramTypes, [], cardList, new Map()).map(
            param => {
                if (typeof param !== 'function') {
                    return param;
                }
                const card = param() as Card;
                // 卡牌列表未加载完成时默认卡可能不存在，用空串占位避免崩溃
                return card ? card.getDataId() : '';
            }
        );
    }

    public add() {
        const validMechanics = mechanicList.getConstructors(this.card.cardType);
        if (validMechanics.length === 0) {
            return;
        }
        this.card.mechanics.push({
            id: validMechanics[0].getId(),
            parameters: [],
            trigger: { id: 'Play' },
            targeter: { id: 'Host', optional: false }
        });
    }

    public delete(index: number) {
        this.card.mechanics.splice(index, 1);
    }

    public setParam(mechanic: MechanicData, i: number, event: any) {
        if (typeof event === 'object' && event.target) {
            mechanic.parameters[i] = event.target.value;
        } else {
            mechanic.parameters[i] = event;
        }
    }

    public isTriggered(mechanic: MechanicData) {
        return mechanicList.isTriggered(mechanic);
    }

    public isTargeted(mechanic: MechanicData) {
        return mechanicList.isTargeted(mechanic);
    }

    public getTriggerIds() {
        return triggerList.getIds();
    }

    public getTargeterIds() {
        return targeterList.getIds(true);
    }

    /** 触发器显示名（带说明；按当前语言输出） */
    public triggerLabel(id: string) {
        const label = TRIGGER_LABELS[id];
        if (!label) {
            return this.i18n.tr(id);
        }
        return this.i18n.getLang() === 'en-US' ? label.en : label.zh;
    }

    /** 机制显示名（关键词类机制用编辑器映射补说明，按当前语言输出） */
    public mechanicLabel(id: string) {
        const label = MECHANIC_LABELS[id];
        if (!label) {
            return this.i18n.tr(id);
        }
        return this.i18n.getLang() === 'en-US' ? label.en : label.zh;
    }

    /** 目标器显示名（带说明） */
    public targeterLabel(id: string) {
        return this.i18n.tr(id);
    }

    public moveUp(index: number) {
        this.swap(index, index - 1);
    }

    public moveDown(index: number) {
        this.swap(index, index + 1);
    }

    private swap(i: number, j: number) {
        const temp = this.card.mechanics[i];
        this.card.mechanics[i] = this.card.mechanics[j];
        this.card.mechanics[j] = temp;
    }
}
