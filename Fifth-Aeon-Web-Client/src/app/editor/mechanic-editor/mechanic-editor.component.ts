import { Component, Input } from '@angular/core';
import { MatSelectChange } from '@angular/material/select';
import { Card } from '../../game_model/card-types/card';
import { cardList, SpellData, defaultDataObj } from '../../game_model/cards/cardList';
import {
    MechanicData,
    mechanicList
} from '../../game_model/cards/mechanicList';
import { ResourcePrototype, Resource } from '../../game_model/resource';
import { buildParameters } from '../../game_model/cards/parameters';
import { targeterList } from '../../game_model/cards/targeterList';
import { triggerList } from '../../game_model/cards/triggerList';
import { I18nService } from '../../i18n/i18n.service';
import {
    formatMechanicLabel,
    formatTriggerLabel
} from '../mechanic-labels';

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
                if (typeof param === 'function') {
                    const card = param() as Card;
                    // 卡牌列表未加载完成时默认卡可能不存在，用空串占位避免崩溃
                    return card ? card.getDataId() : '';
                }
                if (param instanceof Resource) {
                    // Resource 参数在存档中以 ResourcePrototype JSON 形状保存,
                    // 不能存类实例(私有字段序列化后服务端无法读回)
                    return resourceToPrototype(param);
                }
                return param;
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
        return formatTriggerLabel(id, this.i18n);
    }

    /** 效果器显示名（关键词类效果器用编辑器映射补说明，按当前语言输出） */
    public mechanicLabel(id: string) {
        return formatMechanicLabel(id, this.i18n);
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

/** Resource 类实例 → 可序列化的 ResourcePrototype JSON */
function resourceToPrototype(res: Resource): ResourcePrototype {
    return {
        energy: res.getNumeric(),
        maxEnergy: res.getMaxNumeric(),
        synthesis: res.getOfType('Synthesis'),
        growth: res.getOfType('Growth'),
        decay: res.getOfType('Decay'),
        renewal: res.getOfType('Renewal')
    };
}
