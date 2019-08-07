import { BaseComponent } from './base.component';

export class QuestionnairePo extends BaseComponent {
    get questionnaireItem(): WebdriverIO.Element[] { return $$('~questionnaireItem'); }
    get questionnaireSkipButton(): WebdriverIO.Element { return $('~questionnaireFooterSkip'); }
}
