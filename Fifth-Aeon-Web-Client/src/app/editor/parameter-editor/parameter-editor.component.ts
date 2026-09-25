import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CardType } from '../../game_model/card-types/card';
import { cardList } from '../../game_model/cards/cardList';
import {
    ParameterData,
    ParameterType,
} from '../../game_model/cards/parameters';
import { ResourceType } from '../../game_model/resource';
import { UnitType } from 'app/game_model/card-types/unit';
import { mechanicList } from 'app/game_model/cards/mechanicList';

enum EditorType {
    Numeric,
    Enumerable,
    Resource,
    CardSearch,
}

interface EnumValue {
    id: string;
    name: string;
}

@Component({
    selector: 'ccg-parameter-editor',
    templateUrl: './parameter-editor.component.html',
    styleUrls: ['./parameter-editor.component.scss'],
})
export class ParameterEditorComponent implements OnInit {
    @Input() name = '';
    @Input() type: ParameterType = ParameterType.Integer;
    @Input() data: ParameterData = 0;
    @Output() change: EventEmitter<ParameterData> = new EventEmitter<
        ParameterData
    >();
    public EditorType = EditorType;

    /** 卡牌搜索关键字（Card/Spell/Unit/Item/Enchantment 参数） */
    public searchKeyword = '';
    /** 搜索结果缓存：只在输入时更新（避免变更检测循环） */
    public searchResults: { id: string; name: string }[] = [];

    public trackOption(index: number, option: { id: string }) {
        return option.id;
    }

    private cardTypeValues = new Map<CardType | undefined, EnumValue[]>();
    private resourceEnumValues = this.getEnumValues(ResourceType);
    private cardEnumValues = this.getEnumValues(CardType);
    private unitEnumValues = this.getEnumValues(UnitType);
    private abilityValues = this.getAbilityValues();


    public getEditorType() {
        if (
            this.type === ParameterType.Integer ||
            this.type === ParameterType.NaturalNumber
        ) {
            return EditorType.Numeric;
        } else if (this.type === ParameterType.Resource) {
            return EditorType.Resource;
        } else if (this.isCardSearch()) {
            return EditorType.CardSearch;
        } else {
            return EditorType.Enumerable;
        }
    }

    /** 卡牌类参数（可能随卡牌总量增长）一律走搜索式选择 */
    public isCardSearch(): boolean {
        return (
            this.type === ParameterType.Card ||
            this.type === ParameterType.Spell ||
            this.type === ParameterType.Unit ||
            this.type === ParameterType.Item ||
            this.type === ParameterType.Enchantment
        );
    }

    public getMin() {
        return this.type === ParameterType.Integer ? -99 : 1;
    }

    public getValues(): EnumValue[] {
        switch (this.type) {
            case ParameterType.ResourceType:
                return this.resourceEnumValues;
            case ParameterType.CardType:
                return this.cardEnumValues;
            case ParameterType.UnitType:
                return this.unitEnumValues;
            case ParameterType.Ability:
                return this.abilityValues;
        }
        return [];
    }

    private getEnumValues(enumeration: any): EnumValue[] {
        const results = [];
        for (const key in enumeration) {
            if (typeof enumeration[key] !== 'number') {
                results.push({
                    id: key,
                    name: enumeration[key],
                });
            }
        }
        return results;
    }

    public onChange() {
        this.change.emit(this.data);
    }

    public ngOnInit() {
        this.searchResults = [];
    }

    /** data 输入变化（新参数控件/换机制）时重置搜索状态 */
    public ngOnChanges() {
        this.searchKeyword = '';
        this.searchResults = [];
    }

    // ---- 卡牌搜索选择 ----

    /**
     * 搜索匹配：按本地化卡名或 ID 过滤该类型的全部卡牌
     */
    public getCardOptions(): { id: string; name: string }[] {
        const keyword = this.searchKeyword.trim().toLowerCase();
        const expected = this.expectedCardType();
        return cardList
            .getCards()
            .filter(card => !expected || card.getCardType() === expected)
            .filter(
                card =>
                    !keyword ||
                    card.getName().toLowerCase().includes(keyword) ||
                    card.getDataId().toLowerCase().includes(keyword)
            )
            .map(card => ({
                id: card.getDataId(),
                name: card.getName()
            }));
    }

    private expectedCardType(): CardType | undefined {
        switch (this.type) {
            case ParameterType.Spell:
                return CardType.Spell;
            case ParameterType.Unit:
                return CardType.Unit;
            case ParameterType.Item:
                return CardType.Item;
            case ParameterType.Enchantment:
                return CardType.Enchantment;
            default:
                return undefined;
        }
    }

    /** 搜索输入：更新匹配结果缓存（不走变更检测自动重算） */
    public onSearchChange(keyword: string) {
        this.searchKeyword = keyword;
        this.searchResults = this.getCardOptions();
    }

    /** 当前已选卡牌的显示名 */
    public selectedCardName(): string {
        if (typeof this.data !== 'string' || this.data === '') {
            return '';
        }
        const card = cardList.getCard(this.data);
        if (!card || card.getDataId() !== this.data) {
            return '';
        }
        return card.getName();
    }

    /** 点击搜索结果选中卡牌 */
    public selectCard(id: string) {
        this.data = id;
        this.searchKeyword = '';
        this.searchResults = [];
        this.onChange();
    }

    private getAbilityValues(): EnumValue[] {
        const abilityIds = mechanicList.getAbilityIds();
        return abilityIds.map((id) => {
            return { id, name: id };
        });
    }
}
