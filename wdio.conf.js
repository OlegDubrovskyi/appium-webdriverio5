const waitforTimeout = 30 * 60000;
const commandTimeout = 30 * 60000;

exports.config = {
    deprecationWarnings: false,
    debug: true,

    specs: ['./integration/*.ts'],
    
    maxInstances: 1,

    capabilities: [
        {
            automationName: 'UiAutomator2',
            appiumVersion: '1.14.1',
            platformName: 'Android',
            platformVersion: '9',
            app: '/bitrise/src/app-debug.apk',
            deviceName: 'emulator-5554',
            waitforTimeout: waitforTimeout,
            commandTimeout: commandTimeout,
            appWaitDuration: 30 * 60000,
            dbExecTimeout: 30 * 60000,
            androidInstallTimeout: 30 * 60000,
            newCommandTimeout: 60000,
            noReset: false,
            fullReset: false,
            appWaitActivity: "com.tns.NativeScriptActivity",
            appActivity: 'com.tns.NativeScriptActivity',
            appPackage: 'com.Meditation.app',
            adbExecTimeout: 120000,
            avdLaunchTimeout: 30*300000,
            disableWindowAnimation: true
        },
    ],

    reporters: ['spec'],

    logLevel: 'silent',
    coloredLogs: true,
    allScriptsTimeout: 140000,
    getPageTimeout: 140000,


    framework: 'jasmine',
    jasmineNodeOpts: {
        showColors: true,
        defaultTimeoutInterval: 60000,
    },

    before: function() {
        require('ts-node').register({ files: true });
    },

    onPrepare: function () {
        console.log('<<< NATIVE APP TESTS STARTED >>>');
    },

    onComplete: function () {
        console.log('<<< TESTING FINISHED >>>');
    }
};
