import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CardEditorComponent } from './card-editor/card-editor.component';
import { EditorComponent } from './editor.component';
import { EditorListComponent } from './editor-list/editor-list.component';
import { EditorTutorialComponent } from './editor-tutorial/editor-tutorial.component';
import { SetEditorComponent } from './set-editor/set-editor.component';
import { SetCardsEditorComponent } from './set-cards-editor/set-cards-editor.component';
import { SetSelectorComponent } from './set-selector/set-selector.component';
import { LoggedInGuard } from 'app/login.guard';

const routes: Routes = [
    {
        // 懒加载入口由 AppRoutingModule 提供 'editor' 前缀，这里用相对路径
        path: '',
        component: EditorComponent,
        children: [
            {
                path: '',
                component: EditorListComponent,
                canActivate: [LoggedInGuard]
            },
            {
                path: 'card/:id',
                component: CardEditorComponent,
                canActivate: [LoggedInGuard]
            },
            {
                path: 'sets',
                component: SetEditorComponent,
                canActivate: [LoggedInGuard]
            },
            {
                path: 'sets/:id',
                component: SetCardsEditorComponent,
                canActivate: [LoggedInGuard]
            },
            {
                path: 'selectMods',
                component: SetSelectorComponent,
                canActivate: [LoggedInGuard]
            },
            {
                path: 'tutorial',
                component: EditorTutorialComponent
            }
        ]
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class EditorRoutingModule {}
