import { Component, OnInit } from '@angular/core';
import { SoundManager, VolumeType } from 'app/sound';
import { TipService } from 'app/tips';
import { I18nService } from 'app/i18n/i18n.service';

@Component({
    selector: 'ccg-inital-setup',
    templateUrl: './inital-setup.component.html',
    styleUrls: ['./inital-setup.component.scss']
})
export class InitialSetupComponent implements OnInit {
  public narratorEnabled = true;


    constructor(
        public sound: SoundManager,
        public tips: TipService,
        private i18n: I18nService
    ) {}

    ngOnInit() {}

    public toggleNarrator() {
      this.narratorEnabled = !this.narratorEnabled;
      this.sound.changeVolume(VolumeType.Narrator, this.narratorEnabled ? 0.5 : 0.0);
    }

    public exampleTip() {
      this.tips.announce(this.i18n.tr('This is an example of a tip. If you disable text to speech narration, tips won’t be read out loud. If you disable tips entirely, you won’t even see them.'), true);
    }
}
