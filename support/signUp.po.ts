import { BaseComponent } from './base.component';
import { getRandomValue } from '../support/helpers/js-helper'

export class SignUpPo extends BaseComponent{
    get emailInput(): WebdriverIO.Element { return $('~emailInput'); }
    get passwordInput(): WebdriverIO.Element { return $('~passwordInput'); }
    get signUpButton(): WebdriverIO.Element { return $('~signUpButton'); }
    get goToLogInLink(): WebdriverIO.Element { return $('~openLogIn'); }

    fillSignUpInputs(email: string, password: string) {
        this.sendKeys(this.emailInput, email);
        this.sendKeys(this.passwordInput, password);
        this.safeClick(this.signUpButton);
    }

    getRandomEmail(value: string) {
        const emailSplit = value.split('@');
        return emailSplit[0] + getRandomValue(1, 900000) + '@' + emailSplit[1];
    }
}
