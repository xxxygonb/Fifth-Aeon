import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthenticationService } from '../authentication.service';
import { FormControl, Validators } from '@angular/forms';
import { I18nService } from 'app/i18n/i18n.service';

@Component({
    selector: 'ccg-reset-password',
    templateUrl: './reset-password.component.html',
    styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
    public message = '';
    public password = '';
    private token: string;
    public hide = true;

    public passwordControl = new FormControl('', [
        Validators.required,
        Validators.minLength(8),
        Validators.maxLength(256)
    ]);

    constructor(
        private route: ActivatedRoute,
        private auth: AuthenticationService,
        public i18n: I18nService
    ) {
        this.token = this.route.snapshot.paramMap.get('token') as string;
    }

    passwordError() {
        return this.passwordControl.hasError('required')
            ? this.i18n.tr('You must enter a value')
            : this.passwordControl.hasError('minlength')
            ? this.i18n.tr('Must be at least 8 characters long.')
            : this.passwordControl.hasError('maxlength')
            ? this.i18n.tr('Cannot be longer than 256 characters.')
            : '';
    }

    ok() {
        return this.passwordControl.valid;
    }

    submit() {
        this.message = this.i18n.tr('Password reset in process.');
        this.auth
            .resetPassword(this.token, this.password)
            .then(() => {
                this.message = this.i18n.tr(
                    'Your Password has been changed and you have been logged in.'
                );
            })
            .catch(() => {
                this.message = this.i18n.tr(
                    'There was a problem reseting your password. Your token may have expired.'
                );
            });
    }

    ngOnInit() {}
}
