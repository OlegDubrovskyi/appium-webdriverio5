import { BaseComponent } from './base.component';

export class AndroidAlertPo extends BaseComponent{
    get alertTitle(): WebdriverIO.Element { return $('//*[@resource-id="android:id/alertTitle"]'); }
    get alertMessage(): WebdriverIO.Element { return $('//*[@resource-id="android:id/message"]'); }
    get alertOk(): WebdriverIO.Element { return $('//*[@resource-id="android:id/button1"]'); }
    get alertCancel(): WebdriverIO.Element { return $('//*[@resource-id="android:id/button2"]'); }

    assertAlertText(title: string, message: string) {
        this.assertElementContainsText(this.alertTitle, title);
        this.assertElementContainsText(this.alertMessage, message)
    }
}
