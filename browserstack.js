
//var browserstack = require('browserstack-local');

exports.config = {

    deprecationWarnings: false,
    debug: true,
    specs: ['./integration/*.ts'],
    services: ['browserstack'],
    user: 'olegdubrovsky2',
    key: '2cPHQsyENNqQppbAWuFy',
    //browserstackLocal: true,

    maxInstances: 1,

    capabilities: [{
        'browserName' : 'android',
        name: 'Bstack-[WebdriverIO] Local Test',
        'browserstack.local': true,
        'device': 'Samsung Galaxy S9 Plus',
        'os_version': '9.0',
        'app' : 'olegdubrovsky2/new_9',
        'realMobile' : 'true',
        waitforTimeout: 30 * 60000,
        commandTimeout: 30 * 60000,
        appWaitDuration: 30 * 60000,
        androidInstallTimeout: 30 * 60000,
        newCommandTimeout: 60000,
        noReset: false,
        fullReset: true,
        appWaitActivity: "com.tns.NativeScriptActivity",
        appActivity: 'com.tns.NativeScriptActivity',
        appPackage: 'com.Meditation.app',
        adbExecTimeout: 120000,
        avdLaunchTimeout: 30*300000,
        disableWindowAnimation: true
    }],

    sync: true,

    reporters: [['allure', {
        outputDir: 'allure-results',
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: true,
    }],  "browserstack"],
    reporterOptions: {
        browserstack: {
            outputDir: './'
        }
    },

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

    // Code to start browserstack local before start of test
    onPrepare: function (config, capabilities) {
        console.log("Connecting local");
        return new Promise(function(resolve, reject){
            exports.bs_local = new browserstack.Local();
            exports.bs_local.start({'key': exports.config.key }, function(error) {
                if (error) return reject(error);
                console.log('Connected. Now testing...');

                resolve();
            });
        });
    },

    // Code to stop browserstack local after end of test
    // onComplete: function (capabilties, specs) {
    //     exports.bs_local.stop(function() {});
    // }
};
