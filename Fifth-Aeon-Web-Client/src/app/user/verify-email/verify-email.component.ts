import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthenticationService } from '../authentication.service';
import { I18nService } from 'app/i18n/i18n.service';

@Component({
    selector: 'ccg-verify-email',
    templateUrl: './verify-email.component.html',
    styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent implements OnInit {
    public message: string;

    constructor(
        private route: ActivatedRoute,
        private auth: AuthenticationService,
        private i18n: I18nService
    ) {
        const token = this.route.snapshot.paramMap.get('token') as string;
        this.message = i18n.tr('Verification in process');
        auth.verifyEmail(token)
            .then(() => {
                this.message = i18n.tr('Your email has been verifed');
            })
            .catch(err => {
                this.message = i18n.tr(
                    'Their was a problem verifying your email address.'
                );
                console.error(err);
            });
    }

    ngOnInit() {}
}
