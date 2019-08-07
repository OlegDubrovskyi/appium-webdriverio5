import { BaseComponent } from './base.component';

export class WalkthroughPo extends BaseComponent {
    get startButton(): WebdriverIO.Element { return $('~walkthroughStartBtn'); }
}
