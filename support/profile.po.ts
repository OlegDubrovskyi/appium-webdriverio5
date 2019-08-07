import { BaseComponent } from './base.component';

export class ProfilePo extends BaseComponent{
    get accountPage(): WebdriverIO.Element { return $('//*[contains(@text, "Account")]'); }
    get accountUserEmail(): WebdriverIO.Element { return $('~userEmail'); }
    get accountLogout(): WebdriverIO.Element { return $('~accountLogout'); }
}
