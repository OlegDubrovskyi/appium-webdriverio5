import { AndroidAlertPo} from '../support/android-alert.po';
import { MyPlacePo} from '../support/myPlace.po';
import { SignUpPo} from '../support/signUp.po';
import { LogInPo} from '../support/logIn.po';
import { ProfilePo } from '../support/profile.po';
import allureReporter from '@wdio/allure-reporter'

fdescribe('tests for login',  () => {
    const myPlacePage = new MyPlacePo();
    const signUpPage = new SignUpPo();
    const alertPage = new AndroidAlertPo();
    const logInPage = new LogInPo();
    const profilePage = new ProfilePo();

    beforeAll(() => {
        myPlacePage.openMyPlace();
    });

    afterEach(() => {
        profilePage.safeClick(profilePage.accountLogout);
        myPlacePage.safeClick(myPlacePage.userImg);
    });

    it('Verify that user can login successfully from logIn form',  () => {
        allureReporter.addFeature('Feature');
        //logInPage.scrollToElement(signUpPage.goToLogInLink, 'down');
        logInPage.safeClick(signUpPage.goToLogInLink);
        logInPage.fillLogInpInputs('oleg.dubrovsky@valor-software.com', '1234');
        myPlacePage.safeClick(myPlacePage.userImg);
        profilePage.safeClick(profilePage.accountPage);
        profilePage.assertElementContainsText(profilePage.accountUserEmail, 'oleg.dubrovsky@valor-software.com');
    });

    it('Verify that user can login successfully from signIn form',   () => {
        allureReporter.addFeature('Feature');
        signUpPage.fillSignUpInputs('oleg.dubrovsky@valor-software.com', '1234');
        alertPage.assertAlertText('Account already exists', 'Looks like you already have an account with this email address! Do you want to log in with this account?');
        alertPage.safeClick(alertPage.alertOk);
        myPlacePage.safeClick(myPlacePage.userImg);
        profilePage.safeClick(profilePage.accountPage);
        profilePage.assertElementContainsText(profilePage.accountUserEmail, 'oleg.dubrovsky@valor-software.com');
    });
});
