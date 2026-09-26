import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CardSharedModule } from '../shared/card.module';
import { I18nModule } from '../i18n/i18n.module';
import { MaterialModule } from '../material.module';
import { CardEditorComponent } from './card-editor/card-editor.component';
import { EditorListComponent } from './editor-list/editor-list.component';
import { EditorRoutingModule } from './editor-routing.module';
import { EditorComponent } from './editor.component';
import { EditorTutorialComponent } from './editor-tutorial/editor-tutorial.component';
import { MechanicEditorComponent } from './mechanic-editor/mechanic-editor.component';
import { ParameterEditorComponent } from './parameter-editor/parameter-editor.component';
import { TargeterEditorComponent } from './targeter-editor/targeter-editor.component';
import { SetEditorComponent } from './set-editor/set-editor.component';
import { SetCardsEditorComponent } from './set-cards-editor/set-cards-editor.component';
import { SetSelectorComponent } from './set-selector/set-selector.component';

// 懒加载模块：卡牌编辑器。EditorDataService 改为 providedIn: 'root'
// （DecksService 等急加载服务也依赖它）。
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        EditorRoutingModule,
        CardSharedModule,
        I18nModule
    ],
    declarations: [
        CardEditorComponent,
        EditorComponent,
        EditorTutorialComponent,
        TargeterEditorComponent,
        MechanicEditorComponent,
        EditorListComponent,
        ParameterEditorComponent,
        SetEditorComponent,
        SetCardsEditorComponent,
        SetSelectorComponent
    ],
    exports: []
})
export class EditorModule {}
