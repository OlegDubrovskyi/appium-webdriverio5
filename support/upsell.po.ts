import { BaseComponent } from './base.component';

export class UpsellPo extends BaseComponent {
    get firstTrialClose() { return $('~firstTrialClose'); }
}
