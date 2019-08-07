import { BaseComponent } from './base.component';

export class UpsellPo extends BaseComponent{
    get firstTrialClose(): WebdriverIO.Element { return $('~firstTrialClose'); }
}
