import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InitialSetupComponent } from './inital-setup/inital-setup.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from 'app/material.module';
import { RouterModule } from '@angular/router';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog.component';
import { I18nModule } from '../i18n/i18n.module';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MaterialModule,
        RouterModule,
        I18nModule
    ],
    entryComponents: [SettingsDialogComponent],
    exports: [SettingsDialogComponent, InitialSetupComponent],
    declarations: [SettingsDialogComponent, InitialSetupComponent]
})
export class SettingsModule {}
