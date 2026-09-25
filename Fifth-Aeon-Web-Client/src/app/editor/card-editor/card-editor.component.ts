import { Component, OnInit } from '@angular/core';
import {
    cardList,
    CardData,
    defaultDataObj
} from '../../game_model/cards/cardList';
import { UnitType } from '../../game_model/card-types/unit';
import { Card, CardType } from '../../game_model/card-types/card';
import { t } from '../../game_model/i18n';
import { Route, ActivatedRoute, Router } from '@angular/router';
import { EditorDataService } from '../editor-data.service';
import { MatSelectChange } from '@angular/material/select';
import { mechanicList } from '../../game_model/cards/mechanicList';

@Component({
    selector: 'ccg-card-editor',
    templateUrl: './card-editor.component.html',
    styleUrls: ['./card-editor.component.scss']
})
export class CardEditorComponent implements OnInit {
    private static MaxRequirementTotal = 6;

    public unitTypes = UnitType;
    public unitTypeKeys = this.getKeys(UnitType).filter(key => key !== 0);
    public cardTypes = CardType;
    public cardTypeKeys = this.getKeys(CardType);
    public previewCard: Card = cardList.buildInstance(defaultDataObj);
    public data: CardData = defaultDataObj;

    /** 枚举 key → 本地化显示名（Unit Type / Card Type 下拉） */
    public typeName(key: string | number, types: any): string {
        return t(types[key]);
    }

    /** 保存按钮状态：idle | saving | saved | error */
    public saveState: 'idle' | 'saving' | 'saved' | 'error' = 'idle';

    constructor(
        route: ActivatedRoute,
        router: Router,
        private editorData: EditorDataService
    ) {
        setInterval(() => this.refreshPreview(), 3000);
        route.paramMap.subscribe(params => {
            const id = params.get('id') as string;
            const card = editorData.getCard(id);
            if (card) {
                this.data = card;
                this.refreshPreview();
            } else {
                // 直达/刷新编辑页 URL 时卡牌列表可能尚未从服务器加载完，
                // 等待加载完成后再取卡，避免绑定到默认模板卡（法术）
                editorData.waitForCards().then(() => {
                    const loaded = editorData.getCard(id);
                    if (loaded) {
                        this.data = loaded;
                        this.refreshPreview();
                    } else {
                        console.error('No card with id', id);
                    }
                });
            }
        });
    }

    public changeType(event: MatSelectChange) {
        this.data.mechanics = this.data.mechanics.filter(mechanic =>
            mechanicList.isValid(this.data, mechanic)
        );
    }

    public fileChange(event: any): void {
        const files: FileList = event.target.files;
        const image = files.item(0);
        if (image === null) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e: any) => {
            this.data.imageUrl = e.target.result;
        };
        reader.readAsDataURL(image);
    }

    public refreshPreview() {
        this.previewCard = cardList.buildInstance(this.data);
    }

    /** 手动保存当前编辑的卡牌（含卡组集合），并给出保存结果反馈 */
    public saveCard() {
        if (this.saveState === 'saving') {
            return;
        }
        this.saveState = 'saving';
        this.editorData
            .saveData()
            .then(() => (this.saveState = 'saved'))
            .catch(() => (this.saveState = 'error'))
            .then(() => {
                setTimeout(() => (this.saveState = 'idle'), 2000);
            });
    }

    // Enforce resource requirements summing up to 6 (so it fits in UI)
    public getReqMax(
        resourceName: 'synthesis' | 'growth' | 'renewal' | 'decay'
    ) {
        const total =
            (this.data.cost.renewal || 0) +
            (this.data.cost.synthesis || 0) +
            (this.data.cost.growth || 0) +
            (this.data.cost.decay || 0);
        return (
            CardEditorComponent.MaxRequirementTotal -
            total +
            (this.data.cost[resourceName] as number)
        );
    }

    public getKeys(enumeration: any) {
        return Object.keys(enumeration)
            .filter(key => !isNaN(parseInt(key, 10)))
            .map(key => parseInt(key, 10));
    }

    ngOnInit() {}
}
