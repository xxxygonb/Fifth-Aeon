import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { MaterialModule } from '../material.module';
import { CardComponent } from '../game/card/card.component';

/**
 * 卡牌渲染组件的共享模块。CardComponent 被急加载页面（卡组编辑器、开包、
 * 轮抽、每日奖励弹窗）和懒加载模块（Game/Editor）共同使用，因此独立成
 * 急加载的共享模块，让 GameModule 等可以安全地懒加载。
 */
@NgModule({
    imports: [CommonModule, MaterialModule],
    declarations: [CardComponent],
    exports: [CardComponent]
})
export class CardSharedModule {}
