import { Component, OnInit } from '@angular/core';
import { DecksService } from 'app/decks.service';
import { Collection } from 'app/game_model/collection';
import { Card } from 'app/game_model/card-types/card';
import { CollectionService } from 'app/collection.service';
import { I18nService } from 'app/i18n/i18n.service';

@Component({
    selector: 'ccg-open-pack',
    templateUrl: './open-pack.component.html',
    styleUrls: ['./open-pack.component.scss']
})
export class OpenPackComponent implements OnInit {
    collection: Collection;
    cards: Card[] = [];
    working = false;
    message = '';

    constructor(
        decks: DecksService,
        private collectionService: CollectionService,
        private i18n: I18nService
    ) {
        this.collection = collectionService.getCollection();
        this.defaultMessage();
    }

    defaultMessage() {
        this.message = this.i18n.tr('You have {packs} pack(s) and {gold} gold.', {
            packs: this.collection.getPackCount(),
            gold: this.collection.getGold()
        });
    }

    async open() {
        this.working = true;
        this.message = this.i18n.tr('Communicating with server.');
        const result = await this.collectionService.openPack();
        if (typeof result === 'string') { this.message = result; } else {
            this.cards = result;
            this.defaultMessage();
        }
        this.working = false;
    }

    async buy() {
        this.working = true;
        this.message = this.i18n.tr('Communicating with server.');
        const result = await this.collectionService.buyPack();
        if (result) {
            this.defaultMessage();
        } else {
            this.message = this.i18n.tr('You can\'t afford a pack');
        }
        this.working = false;
    }

    done() {}

    ngOnInit() {}
}
