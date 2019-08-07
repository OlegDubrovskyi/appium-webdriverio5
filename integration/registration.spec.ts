import { AndroidAlertPo} from '../support/android-alert.po';
import { MyPlacePo} from '../support/myPlace.po';
import { SignUpPo} from '../support/signUp.po';
import { LogInPo} from '../support/logIn.po';
import { ProfilePo } from '../support/profile.po';

fdescribe('Tests for registration',  () => {
    const myPlacePage = new MyPlacePo();
    const signUpPage = new SignUpPo();
    const alertPage = new AndroidAlertPo();
    const logInPage = new LogInPo();
    const profilePage = new ProfilePo();
    let randomEmail;

    describe('Registration with incorrect values',  () => {

        beforeAll(() => {
            myPlacePage.openMyPlace();
        });

        afterEach(() => {
            alertPage.safeClick(alertPage.alertOk);
        });

        it('Verify registration with empty password',  async () => {
            signUpPage.fillSignUpInputs('test@test.com', '');
            alertPage.assertAlertText('Password is required', 'Password cannot be set empty');
        });

        it('Verify registration short password',  async () => {
            signUpPage.fillSignUpInputs('test@test.com', 't');
            alertPage.assertAlertText('Invalid format', 'Your password must have from 4 to 15 characters');
        });

        it('Verify registration long password',  async () => {
            signUpPage.fillSignUpInputs('test@test.com', 'ttttttttttttttttt');
            alertPage.assertAlertText('Invalid format', 'Your password must have from 4 to 15 characters');
        });

        it('Verify registration with incorrect email',  async () => {
            signUpPage.fillSignUpInputs('-', 'tttt');
            alertPage.assertAlertText('Invalid email address', 'Please enter a valid email address format.');
        });
    });

    describe('Registration with correct values',  () => {

        beforeAll(() => {
            myPlacePage.openMyPlace();
        });

        afterEach(() => {
            profilePage.safeClick(profilePage.accountLogout);
            myPlacePage.safeClick(myPlacePage.userImg);
        });

        it('Verify registration from SignUp page',  async () => {
            randomEmail = signUpPage.getRandomEmail('autotest@test.net');
            signUpPage.fillSignUpInputs(randomEmail, '1234');
            alertPage.assertAlertText('Account created', 'Your account has been created.');
            alertPage.safeClick(alertPage.alertOk);
            myPlacePage.safeClick(myPlacePage.userImg);
            profilePage.safeClick(profilePage.accountPage);
            profilePage.assertElementContainsText(profilePage.accountUserEmail, randomEmail)
        });

        it('Verify registration from LogIn page',  async () => {
            randomEmail = signUpPage.getRandomEmail('autotest@test.net');
            signUpPage.safeClick(signUpPage.goToLogInLink);
            logInPage.fillLogInpInputs(randomEmail, '1234');
            alertPage.assertAlertText('Account not recognized', 'Sorry! It looks like we don’t have an account with this email address. Please try again or create a new user account.');
            alertPage.safeClick(alertPage.alertOk);
            alertPage.safeClick(alertPage.alertOk);
            myPlacePage.safeClick(myPlacePage.userImg);
            profilePage.safeClick(profilePage.accountPage);
            profilePage.assertElementContainsText(profilePage.accountUserEmail, randomEmail)
        });
    });
});
