import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DeckChooserComponent } from './deck-chooser/deck-chooser.component';
import { DeckEditorComponent } from './deck-editor/deck-editor.component';
import { DraftComponent } from './draft/draft.component';
import { InPlayGuard } from './in-play.guard';
import { LandingComponent } from './landing/landing.component';
import { LobbyComponent } from './lobby/lobby.component';
import { LoggedInGuard } from './login.guard';
import { OpenPackComponent } from './open-pack/open-pack.component';
import { QueueComponent } from './queue/queue.component';
import { LoginComponent } from './user/login/login.component';
import { RegisterComponent } from './user/register/register.component';
import { ResetPasswordComponent } from './user/reset-password/reset-password.component';
import { VerifyEmailComponent } from './user/verify-email/verify-email.component';
import { UpgradeAccountComponent } from './user/upgrade-account/upgrade-account.component';
import { InitialSetupComponent } from './settings/inital-setup/inital-setup.component';

const routes: Routes = [
    { path: '', component: LandingComponent },
    // 懒加载模块：对局 / 卡牌编辑器 / 锦标赛 / 管理面板
    {
        path: 'game',
        canActivate: [InPlayGuard],
        loadChildren: () => import('./game/game.module').then(m => m.GameModule)
    },
    {
        path: 'editor',
        loadChildren: () => import('./editor/editor.module').then(m => m.EditorModule)
    },
    {
        path: 'tournament',
        loadChildren: () => import('./tournament/tournament.module').then(m => m.TournamentModule)
    },
    {
        path: 'admin',
        loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
    },
    {
        path: 'deck',
        component: DeckEditorComponent,
        canActivate: [LoggedInGuard]
    },
    {
        path: 'select',
        component: DeckChooserComponent,
        canActivate: [LoggedInGuard]
    },
    {
        path: 'packs',
        component: OpenPackComponent,
        canActivate: [LoggedInGuard]
    },
    { path: 'lobby', component: LobbyComponent, canActivate: [LoggedInGuard] },
    { path: 'queue', component: QueueComponent, canActivate: [LoggedInGuard] },
    { path: 'draft', component: DraftComponent, canActivate: [LoggedInGuard] },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'upgradeAccount', component: UpgradeAccountComponent, canActivate: [LoggedInGuard] },
    { path: 'initialSetup', component: InitialSetupComponent, canActivate: [LoggedInGuard] },
    { path: 'reset/:token', component: ResetPasswordComponent },
    { path: 'verify/:token', component: VerifyEmailComponent },
    { path: '**', component: LobbyComponent, canActivate: [LoggedInGuard] }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {}
