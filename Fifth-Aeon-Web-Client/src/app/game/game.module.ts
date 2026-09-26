import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CardSharedModule } from '../shared/card.module';
import { MaterialModule } from '../material.module';
import { I18nModule } from '../i18n/i18n.module';
import { CardChooserComponent } from './card-chooser/card-chooser.component';
import { DamageDistributionDialogComponent } from './damage-distribution-dialog/damage-distribution-dialog.component';
import { GameRoutingModule } from './game-routing.module';
import { GameComponent } from './game.component';
import { OverlayComponent } from './overlay/overlay.component';
import { RecordBarComponent } from './record-bar/record-bar.component';
import { ResourceDisplayComponent } from './resource-display/resource-display.component';
import { ResourceSelectorComponent } from './resource-selector/resource-selector.component';
import { DragDropModule } from '@angular/cdk/drag-drop';

// 懒加载模块：对局界面。CardComponent 已提取到急加载的 CardSharedModule,
// OverlayService 改为 providedIn: 'root'（GameManager 等急加载服务依赖它）。
@NgModule({
    imports: [
        CommonModule,
        MaterialModule,
        DragDropModule,
        I18nModule,
        CardSharedModule,
        GameRoutingModule
    ],
    declarations: [
        GameComponent,
        ResourceSelectorComponent,
        ResourceDisplayComponent,
        CardChooserComponent,
        RecordBarComponent,
        DamageDistributionDialogComponent,
        OverlayComponent
    ],
    entryComponents: [DamageDistributionDialogComponent, CardChooserComponent]
})
export class GameModule {}
