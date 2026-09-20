import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Card } from '../../game_model/card-types/card';
import { I18nService } from '../../i18n/i18n.service';

@Component({
    selector: 'ccg-card-chooser',
    templateUrl: './card-chooser.component.html'
})
export class CardChooserComponent {
    public cards: Array<Card> = [];
    public pageCards: Array<Card>;
    public min = 0;
    public max = 1;
    public skippable = false;
    public selected: Set<Card> = new Set();
    public pageNumber = 0;
    private pageSize = 5;
    public suffix = '';

    constructor(
        public dialogRef: MatDialogRef<CardChooserComponent>,
        private i18n: I18nService
    ) {
        this.pageCards = [];
    }

    getMessage() {
        if (this.max === 0) {
            return this.i18n.tr('View cards');
        }
        const cards =
            this.max === 1
                ? this.i18n.tr('a card')
                : `${this.max} ${this.i18n.tr('cards')}`;
        if (this.max === this.min) {
            return this.i18n.tr('Choose {cards} {suffix}.', {
                cards: cards,
                suffix: this.suffix
            });
        }
        if (this.min === 0) {
            return this.i18n.tr('Choose up to {cards} {suffix}.', {
                cards: cards,
                suffix: this.suffix
            });
        }
        const min =
            this.min === 1
                ? this.i18n.tr('a card')
                : `${this.min} ${this.i18n.tr('cards')}`;
        return this.i18n.tr('Choose between {min} and {cards} {suffix}.', {
            min: min,
            cards: cards,
            suffix: this.suffix
        });
    }

    public select(card: Card) {
        if (this.selected.has(card)) {
            this.selected.delete(card);
        } else if (this.selected.size < this.max) {
            this.selected.add(card);
        }
    }

    public onResize(rect: ClientRect) {
        const width = rect.right - rect.left;
        this.pageSize = Math.floor(width / 175) * 2;
        this.setPage();
    }

    public canNext() {
        return this.pageNumber + 1 < this.cards.length / this.pageSize;
    }

    public next() {
        this.pageNumber++;
        this.setPage();
    }

    public canPrev() {
        return this.pageNumber !== 0;
    }

    public prev() {
        this.pageNumber--;
        this.setPage();
    }

    public setPage() {
        this.pageCards = this.cards.slice(
            this.pageNumber * this.pageSize,
            this.pageNumber * this.pageSize + this.pageSize
        );
    }

    public canFinish(): boolean {
        return (
            this.selected.size >= this.min ||
            this.selected.size === this.cards.length
        );
    }

    public finish() {
        this.dialogRef.close(Array.from(this.selected.values()));
    }

    public skip() {
        this.dialogRef.close([]);
    }
}
