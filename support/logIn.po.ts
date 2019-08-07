import { BaseComponent } from './base.component';

export class LogInPo extends BaseComponent{
    get emailInput(): WebdriverIO.Element { return $('~loginEmail'); }
    get passwordInput(): WebdriverIO.Element { return $('~loginPassword'); }
    get logInButton(): WebdriverIO.Element { return $('~LogInButton'); }
    get goToSignUpLink(): WebdriverIO.Element { return $('~openSignUp'); }

    fillLogInpInputs(email: string, password: string) {
        this.sendKeys(this.emailInput, email);
        this.sendKeys(this.passwordInput, password);
        this.safeClick(this.logInButton);
    }
}
