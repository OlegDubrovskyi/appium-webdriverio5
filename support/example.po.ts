import {BaseComponent} from './base.component';

export class ExamplePo extends BaseComponent{

    get startButton(): WebdriverIO.Element { return $('~walkthroughStartBtn');}
    get questionnaireItem(): WebdriverIO.Element[] { return $$('~questionnaireItem');}
    get firstTrialClose(): WebdriverIO.Element { return $('~firstTrialClose');}
    get userImg(): WebdriverIO.Element { return $('~userImg');}
    get questionnaireFooterDone(): WebdriverIO.Element { return $('~questionnaireFooterDone');}
    get separator(): WebdriverIO.Element { return $('~separator');}
    get myPlaceEdit(): WebdriverIO.Element { return $('~myPlaceEdit');}
}
