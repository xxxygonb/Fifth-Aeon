// Angular
import { HttpClientModule } from '@angular/common/http';
import { APP_INITIALIZER, NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HotkeyModule } from 'angular2-hotkeys';
import { Angulartics2Module } from 'angulartics2';
import { SpeedService } from 'app/speed.service';
import { UserModule } from 'app/user/user.module';
// Vendor Angular Modules
import { ClipboardModule } from 'ngx-clipboard';
import { AppRoutingModule } from './app-routing.module';
// App Angular Components
import { AppComponent } from './app.component';
import { WebClient } from './client';
import { CollectionService } from './collection.service';
import { DailyDialogComponent } from './daily-dialog/daily-dialog.component';
import { DeckChooserComponent } from './deck-chooser/deck-chooser.component';
import { DeckEditorComponent } from './deck-editor/deck-editor.component';
import { DeckImportDialogComponent } from './deck-editor/deck-import-dialog/deck-import-dialog.component';
import { DeckMetadataDialogComponent } from './deck-metadata-dialog/deck-metadata-dialog.component';
import { DecksService } from './decks.service';
import { DraftService } from './draft.service';
import { DraftComponent } from './draft/draft.component';
import { EndDialogComponent } from './end-dialog/end-dialog.component';
import { GameManager } from './gameManager';
import { InPlayGuard } from './in-play.guard';
import { I18nService } from './i18n/i18n.service';
import { I18nModule } from './i18n/i18n.module';
import { LandingComponent } from './landing/landing.component';
import { LobbyComponent } from './lobby/lobby.component';
import { LoggedInGuard } from './login.guard';
import { MaterialModule } from './material.module';
import { MessengerService } from './messenger.service';
import { OpenPackComponent } from './open-pack/open-pack.component';
import { PlayerAvatarComponent } from './player-avatar/player-avatar.component';
import { Preloader } from './preloader';
import { QueueComponent } from './queue/queue.component';
// App Angular Services
import { SoundManager } from './sound';
import { TipService } from './tips';
import { SettingsModule } from './settings/settings.module';
import { CardSharedModule } from './shared/card.module';
import { LocalDataProvider } from './data/local-data-provider';
import { ServerDataProvider } from './data/server-data-provider';
import { P2PDialogComponent } from './lobby/p2p-dialog/p2p-dialog.component';

// 读取持久化语言，为 angular2-hotkeys 库的内置文案选择语言
const storedLang = localStorage.getItem('fa.locale');
const hotkeyCheatSheetDescription =
    storedLang === 'en-US'
        ? 'Show / hide this help menu'
        : '显示 / 隐藏此帮助菜单';

export function initI18n(i18n: I18nService) {
    return () => i18n;
}

@NgModule({
    declarations: [
        AppComponent,
        LobbyComponent,
        QueueComponent,
        EndDialogComponent,
        DeckEditorComponent,
        DeckChooserComponent,
        DeckImportDialogComponent,
        DeckMetadataDialogComponent,
        OpenPackComponent,
        DraftComponent,
        LandingComponent,
        PlayerAvatarComponent,
        PlayerAvatarComponent,
        DailyDialogComponent,
        P2PDialogComponent
    ],
    entryComponents: [
        EndDialogComponent,
        DeckImportDialogComponent,
        DeckMetadataDialogComponent,
        DailyDialogComponent,
        P2PDialogComponent
    ],
    imports: [
        BrowserModule,
        CardSharedModule,
        UserModule,
        FormsModule,
        HttpClientModule,
        BrowserAnimationsModule,
        ClipboardModule,
        HotkeyModule.forRoot({
            cheatSheetDescription: hotkeyCheatSheetDescription
        }),
        MaterialModule,
        Angulartics2Module.forRoot(),
        I18nModule,
        SettingsModule,
        AppRoutingModule
    ],
    providers: [
        SoundManager,
        WebClient,
        GameManager,
        DecksService,
        SpeedService,
        TipService,
        Preloader,
        InPlayGuard,
        LoggedInGuard,
        CollectionService,
        DraftService,
        MessengerService,
        LocalDataProvider,
        ServerDataProvider,
        I18nService,
        {
            provide: APP_INITIALIZER,
            useFactory: initI18n,
            deps: [I18nService],
            multi: true
        }
    ],
    bootstrap: [AppComponent]
})
export class AppModule { }
