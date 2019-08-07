const host = '0.0.0.0';
const port = 4723;

const waitforTimeout = 30 * 60000;
const commandTimeout = 30 * 60000;

exports.config = {
    deprecationWarnings: false,
    debug: true,

    specs: ['./integration/*.ts'],

    host: host,
    port: port,

    maxInstances: 1,

    capabilities: [
        {
            automationName: 'UiAutomator2',
            appiumVersion: '1.14.1',
            platformName: 'Android',
            platformVersion: '8.0',
            app: '/bitrise/src/app-debug.apk',
            deviceName: 'emulator-5554',
            waitforTimeout: waitforTimeout,
            commandTimeout: commandTimeout,
            appWaitDuration: 30 * 60000,
            dbExecTimeout: 30 * 60000,
            androidInstallTimeout: 30 * 60000,
            newCommandTimeout: 60000,
            noReset: false,
            fullReset: true,
            appWaitActivity: "com.tns.NativeScriptActivity",
            appActivity: 'com.tns.NativeScriptActivity',
            appPackage: 'com.Meditation.app',
            adbExecTimeout: 80000,
            avdLaunchTimeout: 30*300000,
            disableWindowAnimation: true
        },
    ],

    reporters: ['spec'],

    services: ['appium'],

    appium: {
        waitStartTime: 6000,
        waitforTimeout: waitforTimeout,
        command: 'appium',
        logFileName: './appium.log',
        args: {
            address: host,
            port: port,
            commandTimeout: commandTimeout,
            sessionOverride: true,
            debugLogSpacing: true
        },
    },

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
