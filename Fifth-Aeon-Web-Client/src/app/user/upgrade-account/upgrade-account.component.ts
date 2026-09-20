import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthenticationService } from '../authentication.service';
import { Router } from '@angular/router';
import { existenceValidator } from 'app/existence.validator';
import { I18nService } from 'app/i18n/i18n.service';

@Component({
    selector: 'ccg-upgrade-account',
    templateUrl: './upgrade-account.component.html',
    styleUrls: ['./upgrade-account.component.scss']
})
export class UpgradeAccountComponent implements OnInit {
    nameControl: FormControl;
    emailControl: FormControl;
    passwordControl: FormControl;
    hide = true;

    username = '';
    email = '';
    password = '';
    message = '';
    working = false;

    constructor(
        private http: HttpClient,
        private auth: AuthenticationService,
        private router: Router,
        public i18n: I18nService
    ) {
        const user = auth.getUser() || '';
        const username = user ? user.username : '';
        this.username = username;

        this.nameControl = new FormControl(
            '',
            [
                Validators.required,
                Validators.maxLength(30),
                Validators.pattern(/^[a-zA-Z0-9]+( [a-zA-Z0-9]+)*$/)
            ],
            [existenceValidator(http, 'username', false, false, username)]
        );
        this.emailControl = new FormControl(
            '',
            [Validators.required, Validators.email],
            [existenceValidator(http, 'email', true)]
        );
        this.passwordControl = new FormControl('', [
            Validators.required,
            Validators.minLength(8),
            Validators.maxLength(256)
        ]);
    }

    startRequest() {
        this.working = true;
        this.message = this.i18n.tr('Working...');
        this.nameControl.disable();
        this.emailControl.disable();
        this.passwordControl.disable();
    }

    endRequest() {
        this.working = false;
        this.nameControl.disable();
        this.emailControl.disable();
        this.passwordControl.disable();
    }

    handleError(err: any) {
        console.error(err, err.error);
        this.message = err.error || err.status;
        this.endRequest();
    }

    submit() {
        this.startRequest();
        this.auth
            .upgradeAccount(this.username, this.email, this.password)
            .then(() => {
                this.router.navigate([`/lobby`]);
            })
            .catch(this.handleError.bind(this));
    }

    nameError() {
        return this.nameControl.hasError('required')
            ? this.i18n.tr('You must enter a value')
            : this.nameControl.hasError('pattern')
            ? this.i18n.tr(
                  'Only lower case letters, numbers, and single spaces between words be used.'
              )
            : this.nameControl.hasError('availability')
            ? this.i18n.tr('That username is already in use.')
            : '';
    }

    emailError() {
        return this.emailControl.hasError('required')
            ? this.i18n.tr('You must enter a value')
            : this.emailControl.hasError('email')
            ? this.i18n.tr('Must be a valid email address.')
            : this.emailControl.hasError('availability')
            ? this.i18n.tr('That email is already in use.')
            : '';
    }

    passwordError() {
        return this.passwordControl.hasError('required')
            ? this.i18n.tr('You must enter a value')
            : this.passwordControl.hasError('minlength')
            ? this.i18n.tr('Must be at least 8 characters long.')
            : '';
    }

    ok() {
        return (
            this.nameControl.valid &&
            this.emailControl.valid &&
            this.passwordControl.valid
        );
    }

    ngOnInit() {}
}
