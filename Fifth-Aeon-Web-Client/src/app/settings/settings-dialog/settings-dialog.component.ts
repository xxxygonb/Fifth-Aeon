import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { SpeedService } from 'app/speed.service';
import { toPairs } from 'lodash';
import { CollectionService } from '../../collection.service';
import { SoundManager, VolumeType } from '../../sound';
import { TipService } from '../../tips';
import { Router } from '@angular/router';
import { aiManager } from 'app/game_model/aiManager';
import { DifficultyLevel } from 'app/game_model/scenarios/decks';
import { I18nService, Lang } from 'app/i18n/i18n.service';


export enum SpeedSetting {
    Turtle = 0.5,
    Slow = 0.66,
    Normal = 1.0,
    Fast = 1.5,
    Ninja = 2
}

const getNames = (en: any) => {
    const names = [];
    for (const item in en) {
        if (typeof en[item] === 'number') {
            names.push(item);
        }
    }
    return names as string[];
};


import { SettingsService } from '../settings.service';

@Component({
    selector: 'ccg-settings-dialog',
    templateUrl: './settings-dialog.component.html',
    styleUrls: ['./settings-dialog.component.scss']
})
export class SettingsDialogComponent implements OnInit {
    public volumes: [number, number][] = [];
    public volumeNames = VolumeType;
    public speedNames = getNames(SpeedSetting);
    public speedSettings = SpeedSetting;
    public difficultyNames = getNames(DifficultyLevel);
    public difficultyLevels = DifficultyLevel;
    public ai = aiManager;

    constructor(
        public dialogRef: MatDialogRef<SettingsDialogComponent>,
        public sound: SoundManager,
        public tips: TipService,
        public speed: SpeedService,
        public collection: CollectionService,
        private router: Router,
        public settings: SettingsService,
        public i18n: I18nService
    ) { }

    public isInGame() {
        return this.router.url.includes('game');
    }

    public concede() {
        this.router.navigateByUrl('/lobby');
    }

    public changeLanguage(lang: Lang) {
        if (lang === this.i18n.getLang()) {
            return;
        }
        this.i18n.setLang(lang);
        window.location.reload();
    }

    ngOnInit() {
        this.volumes = toPairs(this.sound.getVolumes()).map(pair => [
            parseInt(pair[0], 10),
            pair[1]
        ]) as [number, number][];
    }

    public toggleTips() {
        this.tips.toggleDisable();
    }

    public tipMessage() {
        if (this.tips.isDisabled()) {
            return this.i18n.tr('Tips are disabled.');
        }
        return this.i18n.tr('Tips are enabled.');
    }
}
