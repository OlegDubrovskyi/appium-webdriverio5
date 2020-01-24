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
            platformName: 'Android',
            platformVersion: '8.0',
            appiumVersion: '1.15.1',
            app: '/work/Projects/app-debug.apk',
            deviceName: 'emulator-5554',
            waitforTimeout: waitforTimeout,
            commandTimeout: commandTimeout,
            appWaitDuration: 30 * 60000,
            newCommandTimeout: 60000,
            noReset: false,
            fullReset: true,
            appWaitActivity: "com.tns.NativeScriptActivity",
            appActivity: 'com.tns.NativeScriptActivity',
            appPackage: 'com.Meditation.app',
            adbExecTimeout: 120000,
            avdLaunchTimeout: 30*300000,
            disableWindowAnimation: true
        }
    ],


    sync: true,

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
        isVerbose: true,
        showColors: true,
        defaultTimeoutInterval: 700000,
        expectationResultHandler: function(passed, assertion) {
            if(passed) {
                return;
            }
        },
        grep: null,
        invertGrep: null
    },

    before: function() {
        require('ts-node').register({
            project: require('path').join(__dirname, './tsconfig.json')
        });
    },

    onPrepare: function () {
        console.log('<<< NATIVE APP TESTS STARTED >>>');
    },

    onComplete: function () {
        console.log('<<< TESTING FINISHED >>>');
    }
};
