import { BaseComponent } from './base.component';

export class QuestionnairePo extends BaseComponent {
    get questionnaireItem() { return $$('~questionnaireItem'); }
    get questionnaireSkipButton() { return $('~questionnaireFooterSkip'); }
}
