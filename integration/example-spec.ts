import {ExamplePo} from '../support/example.po';

describe('tests for registration',  () => {
    const examplePage = new ExamplePo();

    it('onboarding',  async () => {
        examplePage.safeClick(examplePage.startButton);
        examplePage.assertFirstElementVisible(examplePage.questionnaireItem);
        examplePage.safeClickByFirst(examplePage.questionnaireItem);
        examplePage.safeClick(examplePage.questionnaireFooterDone);
        examplePage.safeClick(examplePage.firstTrialClose);
        examplePage.assertElementVisible(examplePage.userImg);
        examplePage.safeClick(examplePage.myPlaceEdit);
        examplePage.scrollByDirection('down');
    });
});
