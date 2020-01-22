import { BaseComponent } from './base.component';
import { QuestionnairePo} from './questionnaire.po';
import { UpsellPo} from './upsell.po';
import { WalkthroughPo} from './walkthrough.po';

    const walkthroughPage = new WalkthroughPo();
    const questionnairePage = new QuestionnairePo();
    const upsellPage = new UpsellPo();

export class MyPlacePo extends BaseComponent{
    get userImg(): WebdriverIO.Element { return $('~userImg'); }

    openMyPlace() {
        walkthroughPage.startButton.waitForDisplayed(500000);
        walkthroughPage.safeClick(walkthroughPage.startButton);
        questionnairePage.safeClick(questionnairePage.questionnaireSkipButton);
        browser.pause(15000);
        try{$('//*[contains(@text, "Accept")]').click()} catch (e) {}
        try{$('//*[contains(@text, "accept")]').click()} catch (e) {}
        upsellPage.safeClick(upsellPage.firstTrialClose);
        this.safeClick(this.userImg);
    }
}
