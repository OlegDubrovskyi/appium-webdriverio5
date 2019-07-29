"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _lodash = _interopRequireDefault(require("lodash"));

var _2 = require("../..");

var _protocol = require("../../lib/protocol/protocol");

var _requestPromise = _interopRequireDefault(require("request-promise"));

var _chai = _interopRequireDefault(require("chai"));

var _chaiAsPromised = _interopRequireDefault(require("chai-as-promised"));

var _bluebird = _interopRequireDefault(require("bluebird"));

const should = _chai.default.should();

const DEFAULT_ARGS = {
  address: 'localhost',
  port: 8181
};

_chai.default.use(_chaiAsPromised.default);

function baseDriverE2ETests(DriverClass, defaultCaps = {}) {
  describe('BaseDriver (e2e)', function () {
    let baseServer,
        d = new DriverClass(DEFAULT_ARGS);
    before(async function () {
      baseServer = await (0, _2.server)((0, _2.routeConfiguringFunction)(d), DEFAULT_ARGS.port);
    });
    after(async function () {
      await baseServer.close();
    });

    function startSession(caps) {
      return (0, _requestPromise.default)({
        url: 'http://localhost:8181/wd/hub/session',
        method: 'POST',
        json: {
          desiredCapabilities: caps,
          requiredCapabilities: {}
        }
      });
    }

    function endSession(id) {
      return (0, _requestPromise.default)({
        url: `http://localhost:8181/wd/hub/session/${id}`,
        method: 'DELETE',
        json: true,
        simple: false
      });
    }

    function getSession(id) {
      return (0, _requestPromise.default)({
        url: `http://localhost:8181/wd/hub/session/${id}`,
        method: 'GET',
        json: true,
        simple: false
      });
    }

    describe('session handling', function () {
      it('should create session and retrieve a session id, then delete it', async function () {
        let res = await (0, _requestPromise.default)({
          url: 'http://localhost:8181/wd/hub/session',
          method: 'POST',
          json: {
            desiredCapabilities: defaultCaps,
            requiredCapabilities: {}
          },
          simple: false,
          resolveWithFullResponse: true
        });
        res.statusCode.should.equal(200);
        res.body.status.should.equal(0);
        should.exist(res.body.sessionId);
        res.body.value.should.eql(defaultCaps);
        res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          method: 'DELETE',
          json: true,
          simple: false,
          resolveWithFullResponse: true
        });
        res.statusCode.should.equal(200);
        res.body.status.should.equal(0);
        should.equal(d.sessionId, null);
      });
    });
    it.skip('should throw NYI for commands not implemented', async function () {});
    describe('command timeouts', function () {
      let originalFindElement, originalFindElements;

      function startTimeoutSession(timeout) {
        let caps = _lodash.default.clone(defaultCaps);

        caps.newCommandTimeout = timeout;
        return startSession(caps);
      }

      before(function () {
        originalFindElement = d.findElement;

        d.findElement = function () {
          return 'foo';
        }.bind(d);

        originalFindElements = d.findElements;

        d.findElements = async function () {
          await _bluebird.default.delay(200);
          return ['foo'];
        }.bind(d);
      });
      after(function () {
        d.findElement = originalFindElement;
        d.findElements = originalFindElements;
      });
      it('should set a default commandTimeout', async function () {
        let newSession = await startTimeoutSession();
        d.newCommandTimeoutMs.should.be.above(0);
        await endSession(newSession.sessionId);
      });
      it('should timeout on commands using commandTimeout cap', async function () {
        let newSession = await startTimeoutSession(0.25);
        await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/element`,
          method: 'POST',
          json: {
            using: 'name',
            value: 'foo'
          }
        });
        await _bluebird.default.delay(400);
        let res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          method: 'GET',
          json: true,
          simple: false
        });
        res.status.should.equal(6);
        should.equal(d.sessionId, null);
        res = await endSession(newSession.sessionId);
        res.status.should.equal(6);
      });
      it('should not timeout with commandTimeout of false', async function () {
        let newSession = await startTimeoutSession(0.1);
        let start = Date.now();
        let res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/elements`,
          method: 'POST',
          json: {
            using: 'name',
            value: 'foo'
          }
        });
        (Date.now() - start).should.be.above(150);
        res.value.should.eql(['foo']);
        await endSession(newSession.sessionId);
      });
      it('should not timeout with commandTimeout of 0', async function () {
        d.newCommandTimeoutMs = 2;
        let newSession = await startTimeoutSession(0);
        await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/element`,
          method: 'POST',
          json: {
            using: 'name',
            value: 'foo'
          }
        });
        await _bluebird.default.delay(400);
        let res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          method: 'GET',
          json: true,
          simple: false
        });
        res.status.should.equal(0);
        res = await endSession(newSession.sessionId);
        res.status.should.equal(0);
        d.newCommandTimeoutMs = 60 * 1000;
      });
      it('should not timeout if its just the command taking awhile', async function () {
        let newSession = await startTimeoutSession(0.25);
        await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}/element`,
          method: 'POST',
          json: {
            using: 'name',
            value: 'foo'
          }
        });
        await _bluebird.default.delay(400);
        let res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${d.sessionId}`,
          method: 'GET',
          json: true,
          simple: false
        });
        res.status.should.equal(6);
        should.equal(d.sessionId, null);
        res = await endSession(newSession.sessionId);
        res.status.should.equal(6);
      });
      it('should not have a timer running before or after a session', async function () {
        should.not.exist(d.noCommandTimer);
        let newSession = await startTimeoutSession(0.25);
        newSession.sessionId.should.equal(d.sessionId);
        should.exist(d.noCommandTimer);
        await endSession(newSession.sessionId);
        should.not.exist(d.noCommandTimer);
      });
    });
    describe('settings api', function () {
      before(function () {
        d.settings = new _2.DeviceSettings({
          ignoreUnimportantViews: false
        });
      });
      it('should be able to get settings object', function () {
        d.settings.getSettings().ignoreUnimportantViews.should.be.false;
      });
      it('should throw error when updateSettings method is not defined', async function () {
        await d.settings.update({
          ignoreUnimportantViews: true
        }).should.eventually.be.rejectedWith('onSettingsUpdate');
      });
      it('should throw error for invalid update object', async function () {
        await d.settings.update('invalid json').should.eventually.be.rejectedWith('JSON');
      });
    });
    describe('unexpected exits', function () {
      it('should reject a current command when the driver crashes', async function () {
        d._oldGetStatus = d.getStatus;

        d.getStatus = async function () {
          await _bluebird.default.delay(5000);
        }.bind(d);

        let p = (0, _requestPromise.default)({
          url: 'http://localhost:8181/wd/hub/status',
          method: 'GET',
          json: true,
          simple: false
        });
        await _bluebird.default.delay(100);
        d.startUnexpectedShutdown(new Error('Crashytimes'));
        let res = await p;
        res.status.should.equal(13);
        res.value.message.should.contain('Crashytimes');
        await d.onUnexpectedShutdown.should.be.rejectedWith('Crashytimes');
        d.getStatus = d._oldGetStatus;
      });
    });
    describe('event timings', function () {
      it('should not add timings if not using opt-in cap', async function () {
        let session = await startSession(defaultCaps);
        let res = await getSession(session.sessionId);
        should.not.exist(res.events);
        await endSession(session.sessionId);
      });
      it('should add start session timings', async function () {
        let caps = Object.assign({}, defaultCaps, {
          eventTimings: true
        });
        let session = await startSession(caps);
        let res = (await getSession(session.sessionId)).value;
        should.exist(res.events);
        should.exist(res.events.newSessionRequested);
        should.exist(res.events.newSessionStarted);
        res.events.newSessionRequested[0].should.be.a('number');
        res.events.newSessionStarted[0].should.be.a('number');
        await endSession(session.sessionId);
      });
    });
    describe('execute driver script', function () {
      let originalFindElement, sessionId;
      before(function () {
        d.allowInsecure = ['execute_driver_script'];
        originalFindElement = d.findElement;

        d.findElement = function (strategy, selector) {
          if (strategy === 'accessibility id' && selector === 'amazing') {
            return {
              [_protocol.W3C_ELEMENT_KEY]: 'element-id-1'
            };
          }

          throw new _2.errors.NoSuchElementError('not found');
        }.bind(d);
      });
      beforeEach(async function () {
        ({
          sessionId
        } = await startSession(defaultCaps));
      });
      after(function () {
        d.findElement = originalFindElement;
      });
      afterEach(async function () {
        await endSession(sessionId);
      });
      it('should not work unless the allowInsecure feature flag is set', async function () {
        d._allowInsecure = d.allowInsecure;
        d.allowInsecure = [];
        const script = `return 'foo'`;
        await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script,
            type: 'wd'
          }
        }).should.eventually.be.rejectedWith(/allow-insecure/);
        await endSession(sessionId);
        d.allowInsecure = d._allowInsecure;
      });
      it('should execute a webdriverio script in the context of session', async function () {
        const script = `
          const timeouts = await driver.getTimeouts();
          const status = await driver.status();
          return [timeouts, status];
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script,
            type: 'webdriverio'
          }
        });
        const expectedTimeouts = {
          command: 250,
          implicit: 0
        };
        const expectedStatus = {};
        res.value.result.should.eql([expectedTimeouts, expectedStatus]);
      });
      it('should fail with any script type other than webdriverio currently', async function () {
        const script = `return 'foo'`;
        await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script,
            type: 'wd'
          }
        }).should.eventually.be.rejectedWith(/script type/);
      });
      it('should execute a webdriverio script that returns elements correctly', async function () {
        const script = `
          return await driver.$("~amazing");
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script
          }
        });
        res.value.result.should.eql({
          [_protocol.W3C_ELEMENT_KEY]: 'element-id-1',
          [_protocol.MJSONWP_ELEMENT_KEY]: 'element-id-1'
        });
      });
      it('should execute a webdriverio script that returns elements in deep structure', async function () {
        const script = `
          const el = await driver.$("~amazing");
          return {element: el, elements: [el, el]};
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script
          }
        });
        const elObj = {
          [_protocol.W3C_ELEMENT_KEY]: 'element-id-1',
          [_protocol.MJSONWP_ELEMENT_KEY]: 'element-id-1'
        };
        res.value.result.should.eql({
          element: elObj,
          elements: [elObj, elObj]
        });
      });
      it('should store and return logs to the user', async function () {
        const script = `
          console.log("foo");
          console.log("foo2");
          console.warn("bar");
          console.error("baz");
          return null;
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script
          }
        });
        res.value.logs.should.eql({
          log: ['foo', 'foo2'],
          warn: ['bar'],
          error: ['baz']
        });
      });
      it('should have appium specific commands available', async function () {
        const script = `
          return typeof driver.lock;
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script
          }
        });
        res.value.result.should.eql('function');
      });
      it('should correctly handle errors that happen in a webdriverio script', async function () {
        const script = `
          return await driver.$("~notfound");
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script
          },
          simple: false
        });
        res.should.eql({
          sessionId,
          status: 13,
          value: {
            message: 'An unknown server-side error occurred while processing the command. Original error: Could not execute driver script. Original error was: Error: not found'
          }
        });
      });
      it('should correctly handle errors that happen when a script cannot be compiled', async function () {
        const script = `
          return {;
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script
          },
          simple: false
        });
        res.should.eql({
          sessionId,
          status: 13,
          value: {
            message: 'An unknown server-side error occurred while processing the command. Original error: Could not execute driver script. Original error was: Error: Unexpected token ;'
          }
        });
      });
      it('should be able to set a timeout on a driver script', async function () {
        const script = `
          await Promise.delay(1000);
          return true;
        `;
        const res = await (0, _requestPromise.default)({
          url: `http://localhost:8181/wd/hub/session/${sessionId}/appium/execute_driver`,
          method: 'POST',
          json: {
            script,
            timeout: 50
          },
          simple: false
        });
        res.value.message.should.match(/.+50.+timeout.+/);
      });
    });
  });
}

var _default = baseDriverE2ETests;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvYmFzZWRyaXZlci9kcml2ZXItZTJlLXRlc3RzLmpzIl0sIm5hbWVzIjpbInNob3VsZCIsImNoYWkiLCJERUZBVUxUX0FSR1MiLCJhZGRyZXNzIiwicG9ydCIsInVzZSIsImNoYWlBc1Byb21pc2VkIiwiYmFzZURyaXZlckUyRVRlc3RzIiwiRHJpdmVyQ2xhc3MiLCJkZWZhdWx0Q2FwcyIsImRlc2NyaWJlIiwiYmFzZVNlcnZlciIsImQiLCJiZWZvcmUiLCJhZnRlciIsImNsb3NlIiwic3RhcnRTZXNzaW9uIiwiY2FwcyIsInVybCIsIm1ldGhvZCIsImpzb24iLCJkZXNpcmVkQ2FwYWJpbGl0aWVzIiwicmVxdWlyZWRDYXBhYmlsaXRpZXMiLCJlbmRTZXNzaW9uIiwiaWQiLCJzaW1wbGUiLCJnZXRTZXNzaW9uIiwiaXQiLCJyZXMiLCJyZXNvbHZlV2l0aEZ1bGxSZXNwb25zZSIsInN0YXR1c0NvZGUiLCJlcXVhbCIsImJvZHkiLCJzdGF0dXMiLCJleGlzdCIsInNlc3Npb25JZCIsInZhbHVlIiwiZXFsIiwic2tpcCIsIm9yaWdpbmFsRmluZEVsZW1lbnQiLCJvcmlnaW5hbEZpbmRFbGVtZW50cyIsInN0YXJ0VGltZW91dFNlc3Npb24iLCJ0aW1lb3V0IiwiXyIsImNsb25lIiwibmV3Q29tbWFuZFRpbWVvdXQiLCJmaW5kRWxlbWVudCIsImJpbmQiLCJmaW5kRWxlbWVudHMiLCJCIiwiZGVsYXkiLCJuZXdTZXNzaW9uIiwibmV3Q29tbWFuZFRpbWVvdXRNcyIsImJlIiwiYWJvdmUiLCJ1c2luZyIsInN0YXJ0IiwiRGF0ZSIsIm5vdyIsIm5vdCIsIm5vQ29tbWFuZFRpbWVyIiwic2V0dGluZ3MiLCJEZXZpY2VTZXR0aW5ncyIsImlnbm9yZVVuaW1wb3J0YW50Vmlld3MiLCJnZXRTZXR0aW5ncyIsImZhbHNlIiwidXBkYXRlIiwiZXZlbnR1YWxseSIsInJlamVjdGVkV2l0aCIsIl9vbGRHZXRTdGF0dXMiLCJnZXRTdGF0dXMiLCJwIiwic3RhcnRVbmV4cGVjdGVkU2h1dGRvd24iLCJFcnJvciIsIm1lc3NhZ2UiLCJjb250YWluIiwib25VbmV4cGVjdGVkU2h1dGRvd24iLCJzZXNzaW9uIiwiZXZlbnRzIiwiT2JqZWN0IiwiYXNzaWduIiwiZXZlbnRUaW1pbmdzIiwibmV3U2Vzc2lvblJlcXVlc3RlZCIsIm5ld1Nlc3Npb25TdGFydGVkIiwiYSIsImFsbG93SW5zZWN1cmUiLCJzdHJhdGVneSIsInNlbGVjdG9yIiwiVzNDX0VMRU1FTlRfS0VZIiwiZXJyb3JzIiwiTm9TdWNoRWxlbWVudEVycm9yIiwiYmVmb3JlRWFjaCIsImFmdGVyRWFjaCIsIl9hbGxvd0luc2VjdXJlIiwic2NyaXB0IiwidHlwZSIsImV4cGVjdGVkVGltZW91dHMiLCJjb21tYW5kIiwiaW1wbGljaXQiLCJleHBlY3RlZFN0YXR1cyIsInJlc3VsdCIsIk1KU09OV1BfRUxFTUVOVF9LRVkiLCJlbE9iaiIsImVsZW1lbnQiLCJlbGVtZW50cyIsImxvZ3MiLCJsb2ciLCJ3YXJuIiwiZXJyb3IiLCJtYXRjaCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFFQSxNQUFNQSxNQUFNLEdBQUdDLGNBQUtELE1BQUwsRUFBZjs7QUFDQSxNQUFNRSxZQUFZLEdBQUc7QUFDbkJDLEVBQUFBLE9BQU8sRUFBRSxXQURVO0FBRW5CQyxFQUFBQSxJQUFJLEVBQUU7QUFGYSxDQUFyQjs7QUFJQUgsY0FBS0ksR0FBTCxDQUFTQyx1QkFBVDs7QUFFQSxTQUFTQyxrQkFBVCxDQUE2QkMsV0FBN0IsRUFBMENDLFdBQVcsR0FBRyxFQUF4RCxFQUE0RDtBQUMxREMsRUFBQUEsUUFBUSxDQUFDLGtCQUFELEVBQXFCLFlBQVk7QUFDdkMsUUFBSUMsVUFBSjtBQUFBLFFBQWdCQyxDQUFDLEdBQUcsSUFBSUosV0FBSixDQUFnQk4sWUFBaEIsQ0FBcEI7QUFDQVcsSUFBQUEsTUFBTSxDQUFDLGtCQUFrQjtBQUN2QkYsTUFBQUEsVUFBVSxHQUFH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QUUsRUFGSztBQUdiRyxVQUFBQSxLQUFLLEVBQUU7QUFBQ3NDLFlBQUFBLE9BQU8sRUFBRTtBQUFWO0FBSE0sU0FBZjtBQUtELE9BZkMsQ0FBRjtBQWlCQS9DLE1BQUFBLEVBQUUsQ0FBQyxvREFBRCxFQUF1RCxrQkFBa0I7QUFDekUsY0FBTW1FLE1BQU0sR0FBSTs7O1NBQWhCO0FBSUEsY0FBTWxFLEdBQUcsR0FBRyxNQUFNLDZCQUFRO0FBQ3hCVixVQUFBQSxHQUFHLEVBQUcsd0NBQXVDaUIsU0FBVSx3QkFEL0I7QUFFeEJoQixVQUFBQSxNQUFNLEVBQUUsTUFGZ0I7QUFHeEJDLFVBQUFBLElBQUksRUFBRTtBQUFDMEUsWUFBQUEsTUFBRDtBQUFTcEQsWUFBQUEsT0FBTyxFQUFFO0FBQWxCLFdBSGtCO0FBSXhCakIsVUFBQUEsTUFBTSxFQUFFO0FBSmdCLFNBQVIsQ0FBbEI7QUFNQUcsUUFBQUEsR0FBRyxDQUFDUSxLQUFKLENBQVVzQyxPQUFWLENBQWtCMUUsTUFBbEIsQ0FBeUI2RyxLQUF6QixDQUErQixpQkFBL0I7QUFDRCxPQVpDLENBQUY7QUFhRCxLQTdLTyxDQUFSO0FBOEtELEdBdGFPLENBQVI7QUF1YUQ7O2VBRWN0RyxrQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBfIGZyb20gJ2xvZGFzaCc7XG5pbXBvcnQgeyBzZXJ2ZXIsIHJvdXRlQ29uZmlndXJpbmdGdW5jdGlvbiwgRGV2aWNlU2V0dGluZ3MsIGVycm9ycyB9IGZyb20gJy4uLy4uJztcbmltcG9ydCB7IFczQ19FTEVNRU5UX0tFWSwgTUpTT05XUF9FTEVNRU5UX0tFWSB9IGZyb20gJy4uLy4uL2xpYi9wcm90b2NvbC9wcm90b2NvbCc7XG5pbXBvcnQgcmVxdWVzdCBmcm9tICdyZXF1ZXN0LXByb21pc2UnO1xuaW1wb3J0IGNoYWkgZnJvbSAnY2hhaSc7XG5pbXBvcnQgY2hhaUFzUHJvbWlzZWQgZnJvbSAnY2hhaS1hcy1wcm9taXNlZCc7XG5pbXBvcnQgQiBmcm9tICdibHVlYmlyZCc7XG5cbmNvbnN0IHNob3VsZCA9IGNoYWkuc2hvdWxkKCk7XG5jb25zdCBERUZBVUxUX0FSR1MgPSB7XG4gIGFkZHJlc3M6ICdsb2NhbGhvc3QnLFxuICBwb3J0OiA4MTgxXG59O1xuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQpO1xuXG5mdW5jdGlvbiBiYXNlRHJpdmVyRTJFVGVzdHMgKERyaXZlckNsYXNzLCBkZWZhdWx0Q2FwcyA9IHt9KSB7XG4gIGRlc2NyaWJlKCdCYXNlRHJpdmVyIChlMmUpJywgZnVuY3Rpb24gKCkge1xuICAgIGxldCBiYXNlU2VydmVyLCBkID0gbmV3IERyaXZlckNsYXNzKERFRkFVTFRfQVJHUyk7XG4gICAgYmVmb3JlKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGJhc2VTZXJ2ZXIgPSBhd2FpdCBzZXJ2ZXIocm91dGVDb25maWd1cmluZ0Z1bmN0aW9uKGQpLCBERUZBVUxUX0FSR1MucG9ydCk7XG4gICAgfSk7XG4gICAgYWZ0ZXIoYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgYXdhaXQgYmFzZVNlcnZlci5jbG9zZSgpO1xuICAgIH0pO1xuXG4gICAgZnVuY3Rpb24gc3RhcnRTZXNzaW9uIChjYXBzKSB7XG4gICAgICByZXR1cm4gcmVxdWVzdCh7XG4gICAgICAgIHVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbicsXG4gICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICBqc29uOiB7ZGVzaXJlZENhcGFiaWxpdGllczogY2FwcywgcmVxdWlyZWRDYXBhYmlsaXRpZXM6IHt9fSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuZFNlc3Npb24gKGlkKSB7XG4gICAgICByZXR1cm4gcmVxdWVzdCh7XG4gICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke2lkfWAsXG4gICAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgICAgIGpzb246IHRydWUsXG4gICAgICAgIHNpbXBsZTogZmFsc2VcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldFNlc3Npb24gKGlkKSB7XG4gICAgICByZXR1cm4gcmVxdWVzdCh7XG4gICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke2lkfWAsXG4gICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgIGpzb246IHRydWUsXG4gICAgICAgIHNpbXBsZTogZmFsc2VcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGRlc2NyaWJlKCdzZXNzaW9uIGhhbmRsaW5nJywgZnVuY3Rpb24gKCkge1xuICAgICAgaXQoJ3Nob3VsZCBjcmVhdGUgc2Vzc2lvbiBhbmQgcmV0cmlldmUgYSBzZXNzaW9uIGlkLCB0aGVuIGRlbGV0ZSBpdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV0IHJlcyA9IGF3YWl0IHJlcXVlc3Qoe1xuICAgICAgICAgIHVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbicsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAganNvbjoge2Rlc2lyZWRDYXBhYmlsaXRpZXM6IGRlZmF1bHRDYXBzLCByZXF1aXJlZENhcGFiaWxpdGllczoge319LFxuICAgICAgICAgIHNpbXBsZTogZmFsc2UsXG4gICAgICAgICAgcmVzb2x2ZVdpdGhGdWxsUmVzcG9uc2U6IHRydWVcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmVzLnN0YXR1c0NvZGUuc2hvdWxkLmVxdWFsKDIwMCk7XG4gICAgICAgIHJlcy5ib2R5LnN0YXR1cy5zaG91bGQuZXF1YWwoMCk7XG4gICAgICAgIHNob3VsZC5leGlzdChyZXMuYm9keS5zZXNzaW9uSWQpO1xuICAgICAgICByZXMuYm9keS52YWx1ZS5zaG91bGQuZXFsKGRlZmF1bHRDYXBzKTtcblxuICAgICAgICByZXMgPSBhd2FpdCByZXF1ZXN0KHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtkLnNlc3Npb25JZH1gLFxuICAgICAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgICAgICAganNvbjogdHJ1ZSxcbiAgICAgICAgICBzaW1wbGU6IGZhbHNlLFxuICAgICAgICAgIHJlc29sdmVXaXRoRnVsbFJlc3BvbnNlOiB0cnVlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJlcy5zdGF0dXNDb2RlLnNob3VsZC5lcXVhbCgyMDApO1xuICAgICAgICByZXMuYm9keS5zdGF0dXMuc2hvdWxkLmVxdWFsKDApO1xuICAgICAgICBzaG91bGQuZXF1YWwoZC5zZXNzaW9uSWQsIG51bGwpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpdC5za2lwKCdzaG91bGQgdGhyb3cgTllJIGZvciBjb21tYW5kcyBub3QgaW1wbGVtZW50ZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnY29tbWFuZCB0aW1lb3V0cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGxldCBvcmlnaW5hbEZpbmRFbGVtZW50LCBvcmlnaW5hbEZpbmRFbGVtZW50cztcbiAgICAgIGZ1bmN0aW9uIHN0YXJ0VGltZW91dFNlc3Npb24gKHRpbWVvdXQpIHtcbiAgICAgICAgbGV0IGNhcHMgPSBfLmNsb25lKGRlZmF1bHRDYXBzKTtcbiAgICAgICAgY2Fwcy5uZXdDb21tYW5kVGltZW91dCA9IHRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzdGFydFNlc3Npb24oY2Fwcyk7XG4gICAgICB9XG5cbiAgICAgIGJlZm9yZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIG9yaWdpbmFsRmluZEVsZW1lbnQgPSBkLmZpbmRFbGVtZW50O1xuICAgICAgICBkLmZpbmRFbGVtZW50ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAnZm9vJztcbiAgICAgICAgfS5iaW5kKGQpO1xuXG4gICAgICAgIG9yaWdpbmFsRmluZEVsZW1lbnRzID0gZC5maW5kRWxlbWVudHM7XG4gICAgICAgIGQuZmluZEVsZW1lbnRzID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGF3YWl0IEIuZGVsYXkoMjAwKTtcbiAgICAgICAgICByZXR1cm4gWydmb28nXTtcbiAgICAgICAgfS5iaW5kKGQpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZC5maW5kRWxlbWVudCA9IG9yaWdpbmFsRmluZEVsZW1lbnQ7XG4gICAgICAgIGQuZmluZEVsZW1lbnRzID0gb3JpZ2luYWxGaW5kRWxlbWVudHM7XG4gICAgICB9KTtcblxuXG4gICAgICBpdCgnc2hvdWxkIHNldCBhIGRlZmF1bHQgY29tbWFuZFRpbWVvdXQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBuZXdTZXNzaW9uID0gYXdhaXQgc3RhcnRUaW1lb3V0U2Vzc2lvbigpO1xuICAgICAgICBkLm5ld0NvbW1hbmRUaW1lb3V0TXMuc2hvdWxkLmJlLmFib3ZlKDApO1xuICAgICAgICBhd2FpdCBlbmRTZXNzaW9uKG5ld1Nlc3Npb24uc2Vzc2lvbklkKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIHRpbWVvdXQgb24gY29tbWFuZHMgdXNpbmcgY29tbWFuZFRpbWVvdXQgY2FwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgbmV3U2Vzc2lvbiA9IGF3YWl0IHN0YXJ0VGltZW91dFNlc3Npb24oMC4yNSk7XG5cbiAgICAgICAgYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9L2VsZW1lbnRgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHt1c2luZzogJ25hbWUnLCB2YWx1ZTogJ2Zvbyd9LFxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgQi5kZWxheSg0MDApO1xuICAgICAgICBsZXQgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9YCxcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGpzb246IHRydWUsXG4gICAgICAgICAgc2ltcGxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmVzLnN0YXR1cy5zaG91bGQuZXF1YWwoNik7XG4gICAgICAgIHNob3VsZC5lcXVhbChkLnNlc3Npb25JZCwgbnVsbCk7XG4gICAgICAgIHJlcyA9IGF3YWl0IGVuZFNlc3Npb24obmV3U2Vzc2lvbi5zZXNzaW9uSWQpO1xuICAgICAgICByZXMuc3RhdHVzLnNob3VsZC5lcXVhbCg2KTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG5vdCB0aW1lb3V0IHdpdGggY29tbWFuZFRpbWVvdXQgb2YgZmFsc2UnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBuZXdTZXNzaW9uID0gYXdhaXQgc3RhcnRUaW1lb3V0U2Vzc2lvbigwLjEpO1xuICAgICAgICBsZXQgc3RhcnQgPSBEYXRlLm5vdygpO1xuICAgICAgICBsZXQgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9L2VsZW1lbnRzYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBqc29uOiB7dXNpbmc6ICduYW1lJywgdmFsdWU6ICdmb28nfSxcbiAgICAgICAgfSk7XG4gICAgICAgIChEYXRlLm5vdygpIC0gc3RhcnQpLnNob3VsZC5iZS5hYm92ZSgxNTApO1xuICAgICAgICByZXMudmFsdWUuc2hvdWxkLmVxbChbJ2ZvbyddKTtcbiAgICAgICAgYXdhaXQgZW5kU2Vzc2lvbihuZXdTZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBub3QgdGltZW91dCB3aXRoIGNvbW1hbmRUaW1lb3V0IG9mIDAnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGQubmV3Q29tbWFuZFRpbWVvdXRNcyA9IDI7XG4gICAgICAgIGxldCBuZXdTZXNzaW9uID0gYXdhaXQgc3RhcnRUaW1lb3V0U2Vzc2lvbigwKTtcblxuICAgICAgICBhd2FpdCByZXF1ZXN0KHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtkLnNlc3Npb25JZH0vZWxlbWVudGAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAganNvbjoge3VzaW5nOiAnbmFtZScsIHZhbHVlOiAnZm9vJ30sXG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBCLmRlbGF5KDQwMCk7XG4gICAgICAgIGxldCByZXMgPSBhd2FpdCByZXF1ZXN0KHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtkLnNlc3Npb25JZH1gLFxuICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICAgICAganNvbjogdHJ1ZSxcbiAgICAgICAgICBzaW1wbGU6IGZhbHNlXG4gICAgICAgIH0pO1xuICAgICAgICByZXMuc3RhdHVzLnNob3VsZC5lcXVhbCgwKTtcbiAgICAgICAgcmVzID0gYXdhaXQgZW5kU2Vzc2lvbihuZXdTZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICAgIHJlcy5zdGF0dXMuc2hvdWxkLmVxdWFsKDApO1xuXG4gICAgICAgIGQubmV3Q29tbWFuZFRpbWVvdXRNcyA9IDYwICogMTAwMDtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG5vdCB0aW1lb3V0IGlmIGl0cyBqdXN0IHRoZSBjb21tYW5kIHRha2luZyBhd2hpbGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGxldCBuZXdTZXNzaW9uID0gYXdhaXQgc3RhcnRUaW1lb3V0U2Vzc2lvbigwLjI1KTtcbiAgICAgICAgYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9L2VsZW1lbnRgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHt1c2luZzogJ25hbWUnLCB2YWx1ZTogJ2Zvbyd9LFxuICAgICAgICB9KTtcbiAgICAgICAgYXdhaXQgQi5kZWxheSg0MDApO1xuICAgICAgICBsZXQgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7ZC5zZXNzaW9uSWR9YCxcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGpzb246IHRydWUsXG4gICAgICAgICAgc2ltcGxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgcmVzLnN0YXR1cy5zaG91bGQuZXF1YWwoNik7XG4gICAgICAgIHNob3VsZC5lcXVhbChkLnNlc3Npb25JZCwgbnVsbCk7XG4gICAgICAgIHJlcyA9IGF3YWl0IGVuZFNlc3Npb24obmV3U2Vzc2lvbi5zZXNzaW9uSWQpO1xuICAgICAgICByZXMuc3RhdHVzLnNob3VsZC5lcXVhbCg2KTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIG5vdCBoYXZlIGEgdGltZXIgcnVubmluZyBiZWZvcmUgb3IgYWZ0ZXIgYSBzZXNzaW9uJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBzaG91bGQubm90LmV4aXN0KGQubm9Db21tYW5kVGltZXIpO1xuICAgICAgICBsZXQgbmV3U2Vzc2lvbiA9IGF3YWl0IHN0YXJ0VGltZW91dFNlc3Npb24oMC4yNSk7XG4gICAgICAgIG5ld1Nlc3Npb24uc2Vzc2lvbklkLnNob3VsZC5lcXVhbChkLnNlc3Npb25JZCk7XG4gICAgICAgIHNob3VsZC5leGlzdChkLm5vQ29tbWFuZFRpbWVyKTtcbiAgICAgICAgYXdhaXQgZW5kU2Vzc2lvbihuZXdTZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICAgIHNob3VsZC5ub3QuZXhpc3QoZC5ub0NvbW1hbmRUaW1lcik7XG4gICAgICB9KTtcblxuICAgIH0pO1xuXG4gICAgZGVzY3JpYmUoJ3NldHRpbmdzIGFwaScsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGJlZm9yZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGQuc2V0dGluZ3MgPSBuZXcgRGV2aWNlU2V0dGluZ3Moe2lnbm9yZVVuaW1wb3J0YW50Vmlld3M6IGZhbHNlfSk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgYmUgYWJsZSB0byBnZXQgc2V0dGluZ3Mgb2JqZWN0JywgZnVuY3Rpb24gKCkge1xuICAgICAgICBkLnNldHRpbmdzLmdldFNldHRpbmdzKCkuaWdub3JlVW5pbXBvcnRhbnRWaWV3cy5zaG91bGQuYmUuZmFsc2U7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgdGhyb3cgZXJyb3Igd2hlbiB1cGRhdGVTZXR0aW5ncyBtZXRob2QgaXMgbm90IGRlZmluZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IGQuc2V0dGluZ3MudXBkYXRlKHtpZ25vcmVVbmltcG9ydGFudFZpZXdzOiB0cnVlfSkuc2hvdWxkLmV2ZW50dWFsbHlcbiAgICAgICAgICAgICAgICAuYmUucmVqZWN0ZWRXaXRoKCdvblNldHRpbmdzVXBkYXRlJyk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgdGhyb3cgZXJyb3IgZm9yIGludmFsaWQgdXBkYXRlIG9iamVjdCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYXdhaXQgZC5zZXR0aW5ncy51cGRhdGUoJ2ludmFsaWQganNvbicpLnNob3VsZC5ldmVudHVhbGx5XG4gICAgICAgICAgICAgICAgLmJlLnJlamVjdGVkV2l0aCgnSlNPTicpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgndW5leHBlY3RlZCBleGl0cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGl0KCdzaG91bGQgcmVqZWN0IGEgY3VycmVudCBjb21tYW5kIHdoZW4gdGhlIGRyaXZlciBjcmFzaGVzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBkLl9vbGRHZXRTdGF0dXMgPSBkLmdldFN0YXR1cztcbiAgICAgICAgZC5nZXRTdGF0dXMgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgYXdhaXQgQi5kZWxheSg1MDAwKTtcbiAgICAgICAgfS5iaW5kKGQpO1xuICAgICAgICBsZXQgcCA9IHJlcXVlc3Qoe1xuICAgICAgICAgIHVybDogJ2h0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc3RhdHVzJyxcbiAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgICAgIGpzb246IHRydWUsXG4gICAgICAgICAgc2ltcGxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgdGhlIHJlcXVlc3QgZ2V0cyB0byB0aGUgc2VydmVyIGJlZm9yZSBvdXIgc2h1dGRvd25cbiAgICAgICAgYXdhaXQgQi5kZWxheSgxMDApO1xuICAgICAgICBkLnN0YXJ0VW5leHBlY3RlZFNodXRkb3duKG5ldyBFcnJvcignQ3Jhc2h5dGltZXMnKSk7XG4gICAgICAgIGxldCByZXMgPSBhd2FpdCBwO1xuICAgICAgICByZXMuc3RhdHVzLnNob3VsZC5lcXVhbCgxMyk7XG4gICAgICAgIHJlcy52YWx1ZS5tZXNzYWdlLnNob3VsZC5jb250YWluKCdDcmFzaHl0aW1lcycpO1xuICAgICAgICBhd2FpdCBkLm9uVW5leHBlY3RlZFNodXRkb3duLnNob3VsZC5iZS5yZWplY3RlZFdpdGgoJ0NyYXNoeXRpbWVzJyk7XG4gICAgICAgIGQuZ2V0U3RhdHVzID0gZC5fb2xkR2V0U3RhdHVzO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnZXZlbnQgdGltaW5ncycsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGl0KCdzaG91bGQgbm90IGFkZCB0aW1pbmdzIGlmIG5vdCB1c2luZyBvcHQtaW4gY2FwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBsZXQgc2Vzc2lvbiA9IGF3YWl0IHN0YXJ0U2Vzc2lvbihkZWZhdWx0Q2Fwcyk7XG4gICAgICAgIGxldCByZXMgPSBhd2FpdCBnZXRTZXNzaW9uKHNlc3Npb24uc2Vzc2lvbklkKTtcbiAgICAgICAgc2hvdWxkLm5vdC5leGlzdChyZXMuZXZlbnRzKTtcbiAgICAgICAgYXdhaXQgZW5kU2Vzc2lvbihzZXNzaW9uLnNlc3Npb25JZCk7XG4gICAgICB9KTtcbiAgICAgIGl0KCdzaG91bGQgYWRkIHN0YXJ0IHNlc3Npb24gdGltaW5ncycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbGV0IGNhcHMgPSBPYmplY3QuYXNzaWduKHt9LCBkZWZhdWx0Q2Fwcywge2V2ZW50VGltaW5nczogdHJ1ZX0pO1xuICAgICAgICBsZXQgc2Vzc2lvbiA9IGF3YWl0IHN0YXJ0U2Vzc2lvbihjYXBzKTtcbiAgICAgICAgbGV0IHJlcyA9IChhd2FpdCBnZXRTZXNzaW9uKHNlc3Npb24uc2Vzc2lvbklkKSkudmFsdWU7XG4gICAgICAgIHNob3VsZC5leGlzdChyZXMuZXZlbnRzKTtcbiAgICAgICAgc2hvdWxkLmV4aXN0KHJlcy5ldmVudHMubmV3U2Vzc2lvblJlcXVlc3RlZCk7XG4gICAgICAgIHNob3VsZC5leGlzdChyZXMuZXZlbnRzLm5ld1Nlc3Npb25TdGFydGVkKTtcbiAgICAgICAgcmVzLmV2ZW50cy5uZXdTZXNzaW9uUmVxdWVzdGVkWzBdLnNob3VsZC5iZS5hKCdudW1iZXInKTtcbiAgICAgICAgcmVzLmV2ZW50cy5uZXdTZXNzaW9uU3RhcnRlZFswXS5zaG91bGQuYmUuYSgnbnVtYmVyJyk7XG4gICAgICAgIGF3YWl0IGVuZFNlc3Npb24oc2Vzc2lvbi5zZXNzaW9uSWQpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBkZXNjcmliZSgnZXhlY3V0ZSBkcml2ZXIgc2NyaXB0JywgZnVuY3Rpb24gKCkge1xuICAgICAgLy8gbW9jayBzb21lIG1ldGhvZHMgb24gQmFzZURyaXZlciB0aGF0IGFyZW4ndCBub3JtYWxseSB0aGVyZSBleGNlcHQgaW5cbiAgICAgIC8vIGEgZnVsbHkgYmxvd24gZHJpdmVyXG4gICAgICBsZXQgb3JpZ2luYWxGaW5kRWxlbWVudCwgc2Vzc2lvbklkO1xuICAgICAgYmVmb3JlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZC5hbGxvd0luc2VjdXJlID0gWydleGVjdXRlX2RyaXZlcl9zY3JpcHQnXTtcbiAgICAgICAgb3JpZ2luYWxGaW5kRWxlbWVudCA9IGQuZmluZEVsZW1lbnQ7XG4gICAgICAgIGQuZmluZEVsZW1lbnQgPSAoZnVuY3Rpb24gKHN0cmF0ZWd5LCBzZWxlY3Rvcikge1xuICAgICAgICAgIGlmIChzdHJhdGVneSA9PT0gJ2FjY2Vzc2liaWxpdHkgaWQnICYmIHNlbGVjdG9yID09PSAnYW1hemluZycpIHtcbiAgICAgICAgICAgIHJldHVybiB7W1czQ19FTEVNRU5UX0tFWV06ICdlbGVtZW50LWlkLTEnfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLk5vU3VjaEVsZW1lbnRFcnJvcignbm90IGZvdW5kJyk7XG4gICAgICAgIH0pLmJpbmQoZCk7XG4gICAgICB9KTtcblxuICAgICAgYmVmb3JlRWFjaChhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgICh7c2Vzc2lvbklkfSA9IGF3YWl0IHN0YXJ0U2Vzc2lvbihkZWZhdWx0Q2FwcykpO1xuICAgICAgfSk7XG5cbiAgICAgIGFmdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZC5maW5kRWxlbWVudCA9IG9yaWdpbmFsRmluZEVsZW1lbnQ7XG4gICAgICB9KTtcblxuICAgICAgYWZ0ZXJFYWNoKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgYXdhaXQgZW5kU2Vzc2lvbihzZXNzaW9uSWQpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgbm90IHdvcmsgdW5sZXNzIHRoZSBhbGxvd0luc2VjdXJlIGZlYXR1cmUgZmxhZyBpcyBzZXQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGQuX2FsbG93SW5zZWN1cmUgPSBkLmFsbG93SW5zZWN1cmU7XG4gICAgICAgIGQuYWxsb3dJbnNlY3VyZSA9IFtdO1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgcmV0dXJuICdmb28nYDtcbiAgICAgICAgYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7c2Vzc2lvbklkfS9hcHBpdW0vZXhlY3V0ZV9kcml2ZXJgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHtzY3JpcHQsIHR5cGU6ICd3ZCd9LFxuICAgICAgICB9KS5zaG91bGQuZXZlbnR1YWxseS5iZS5yZWplY3RlZFdpdGgoL2FsbG93LWluc2VjdXJlLyk7XG4gICAgICAgIGF3YWl0IGVuZFNlc3Npb24oc2Vzc2lvbklkKTtcbiAgICAgICAgZC5hbGxvd0luc2VjdXJlID0gZC5fYWxsb3dJbnNlY3VyZTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGV4ZWN1dGUgYSB3ZWJkcml2ZXJpbyBzY3JpcHQgaW4gdGhlIGNvbnRleHQgb2Ygc2Vzc2lvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0ID0gYFxuICAgICAgICAgIGNvbnN0IHRpbWVvdXRzID0gYXdhaXQgZHJpdmVyLmdldFRpbWVvdXRzKCk7XG4gICAgICAgICAgY29uc3Qgc3RhdHVzID0gYXdhaXQgZHJpdmVyLnN0YXR1cygpO1xuICAgICAgICAgIHJldHVybiBbdGltZW91dHMsIHN0YXR1c107XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHJlcXVlc3Qoe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBqc29uOiB7c2NyaXB0LCB0eXBlOiAnd2ViZHJpdmVyaW8nfSxcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkVGltZW91dHMgPSB7Y29tbWFuZDogMjUwLCBpbXBsaWNpdDogMH07XG4gICAgICAgIGNvbnN0IGV4cGVjdGVkU3RhdHVzID0ge307XG4gICAgICAgIHJlcy52YWx1ZS5yZXN1bHQuc2hvdWxkLmVxbChbZXhwZWN0ZWRUaW1lb3V0cywgZXhwZWN0ZWRTdGF0dXNdKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGZhaWwgd2l0aCBhbnkgc2NyaXB0IHR5cGUgb3RoZXIgdGhhbiB3ZWJkcml2ZXJpbyBjdXJyZW50bHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGByZXR1cm4gJ2ZvbydgO1xuICAgICAgICBhd2FpdCByZXF1ZXN0KHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWR9L2FwcGl1bS9leGVjdXRlX2RyaXZlcmAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAganNvbjoge3NjcmlwdCwgdHlwZTogJ3dkJ30sXG4gICAgICAgIH0pLnNob3VsZC5ldmVudHVhbGx5LmJlLnJlamVjdGVkV2l0aCgvc2NyaXB0IHR5cGUvKTtcbiAgICAgIH0pO1xuXG4gICAgICBpdCgnc2hvdWxkIGV4ZWN1dGUgYSB3ZWJkcml2ZXJpbyBzY3JpcHQgdGhhdCByZXR1cm5zIGVsZW1lbnRzIGNvcnJlY3RseScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29uc3Qgc2NyaXB0ID0gYFxuICAgICAgICAgIHJldHVybiBhd2FpdCBkcml2ZXIuJChcIn5hbWF6aW5nXCIpO1xuICAgICAgICBgO1xuICAgICAgICBjb25zdCByZXMgPSBhd2FpdCByZXF1ZXN0KHtcbiAgICAgICAgICB1cmw6IGBodHRwOi8vbG9jYWxob3N0OjgxODEvd2QvaHViL3Nlc3Npb24vJHtzZXNzaW9uSWR9L2FwcGl1bS9leGVjdXRlX2RyaXZlcmAsXG4gICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgICAganNvbjoge3NjcmlwdH0sXG4gICAgICAgIH0pO1xuICAgICAgICByZXMudmFsdWUucmVzdWx0LnNob3VsZC5lcWwoe1xuICAgICAgICAgIFtXM0NfRUxFTUVOVF9LRVldOiAnZWxlbWVudC1pZC0xJyxcbiAgICAgICAgICBbTUpTT05XUF9FTEVNRU5UX0tFWV06ICdlbGVtZW50LWlkLTEnXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgZXhlY3V0ZSBhIHdlYmRyaXZlcmlvIHNjcmlwdCB0aGF0IHJldHVybnMgZWxlbWVudHMgaW4gZGVlcCBzdHJ1Y3R1cmUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICBjb25zdCBlbCA9IGF3YWl0IGRyaXZlci4kKFwifmFtYXppbmdcIik7XG4gICAgICAgICAgcmV0dXJuIHtlbGVtZW50OiBlbCwgZWxlbWVudHM6IFtlbCwgZWxdfTtcbiAgICAgICAgYDtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7c2Vzc2lvbklkfS9hcHBpdW0vZXhlY3V0ZV9kcml2ZXJgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHtzY3JpcHR9LFxuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgZWxPYmogPSB7XG4gICAgICAgICAgW1czQ19FTEVNRU5UX0tFWV06ICdlbGVtZW50LWlkLTEnLFxuICAgICAgICAgIFtNSlNPTldQX0VMRU1FTlRfS0VZXTogJ2VsZW1lbnQtaWQtMSdcbiAgICAgICAgfTtcbiAgICAgICAgcmVzLnZhbHVlLnJlc3VsdC5zaG91bGQuZXFsKHtlbGVtZW50OiBlbE9iaiwgZWxlbWVudHM6IFtlbE9iaiwgZWxPYmpdfSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBzdG9yZSBhbmQgcmV0dXJuIGxvZ3MgdG8gdGhlIHVzZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImZvb1wiKTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcImZvbzJcIik7XG4gICAgICAgICAgY29uc29sZS53YXJuKFwiYmFyXCIpO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJiYXpcIik7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHJlcXVlc3Qoe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBqc29uOiB7c2NyaXB0fSxcbiAgICAgICAgfSk7XG4gICAgICAgIHJlcy52YWx1ZS5sb2dzLnNob3VsZC5lcWwoe2xvZzogWydmb28nLCAnZm9vMiddLCB3YXJuOiBbJ2JhciddLCBlcnJvcjogWydiYXonXX0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgaGF2ZSBhcHBpdW0gc3BlY2lmaWMgY29tbWFuZHMgYXZhaWxhYmxlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgXG4gICAgICAgICAgcmV0dXJuIHR5cGVvZiBkcml2ZXIubG9jaztcbiAgICAgICAgYDtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7c2Vzc2lvbklkfS9hcHBpdW0vZXhlY3V0ZV9kcml2ZXJgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHtzY3JpcHR9LFxuICAgICAgICB9KTtcbiAgICAgICAgcmVzLnZhbHVlLnJlc3VsdC5zaG91bGQuZXFsKCdmdW5jdGlvbicpO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgY29ycmVjdGx5IGhhbmRsZSBlcnJvcnMgdGhhdCBoYXBwZW4gaW4gYSB3ZWJkcml2ZXJpbyBzY3JpcHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICByZXR1cm4gYXdhaXQgZHJpdmVyLiQoXCJ+bm90Zm91bmRcIik7XG4gICAgICAgIGA7XG4gICAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IHJlcXVlc3Qoe1xuICAgICAgICAgIHVybDogYGh0dHA6Ly9sb2NhbGhvc3Q6ODE4MS93ZC9odWIvc2Vzc2lvbi8ke3Nlc3Npb25JZH0vYXBwaXVtL2V4ZWN1dGVfZHJpdmVyYCxcbiAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgICAgICBqc29uOiB7c2NyaXB0fSxcbiAgICAgICAgICBzaW1wbGU6IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgICAgcmVzLnNob3VsZC5lcWwoe1xuICAgICAgICAgIHNlc3Npb25JZCxcbiAgICAgICAgICBzdGF0dXM6IDEzLFxuICAgICAgICAgIHZhbHVlOiB7bWVzc2FnZTogJ0FuIHVua25vd24gc2VydmVyLXNpZGUgZXJyb3Igb2NjdXJyZWQgd2hpbGUgcHJvY2Vzc2luZyB0aGUgY29tbWFuZC4gT3JpZ2luYWwgZXJyb3I6IENvdWxkIG5vdCBleGVjdXRlIGRyaXZlciBzY3JpcHQuIE9yaWdpbmFsIGVycm9yIHdhczogRXJyb3I6IG5vdCBmb3VuZCd9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAgIGl0KCdzaG91bGQgY29ycmVjdGx5IGhhbmRsZSBlcnJvcnMgdGhhdCBoYXBwZW4gd2hlbiBhIHNjcmlwdCBjYW5ub3QgYmUgY29tcGlsZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnN0IHNjcmlwdCA9IGBcbiAgICAgICAgICByZXR1cm4geztcbiAgICAgICAgYDtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7c2Vzc2lvbklkfS9hcHBpdW0vZXhlY3V0ZV9kcml2ZXJgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHtzY3JpcHR9LFxuICAgICAgICAgIHNpbXBsZTogZmFsc2UsXG4gICAgICAgIH0pO1xuICAgICAgICByZXMuc2hvdWxkLmVxbCh7XG4gICAgICAgICAgc2Vzc2lvbklkLFxuICAgICAgICAgIHN0YXR1czogMTMsXG4gICAgICAgICAgdmFsdWU6IHttZXNzYWdlOiAnQW4gdW5rbm93biBzZXJ2ZXItc2lkZSBlcnJvciBvY2N1cnJlZCB3aGlsZSBwcm9jZXNzaW5nIHRoZSBjb21tYW5kLiBPcmlnaW5hbCBlcnJvcjogQ291bGQgbm90IGV4ZWN1dGUgZHJpdmVyIHNjcmlwdC4gT3JpZ2luYWwgZXJyb3Igd2FzOiBFcnJvcjogVW5leHBlY3RlZCB0b2tlbiA7J31cbiAgICAgICAgfSk7XG4gICAgICB9KTtcblxuICAgICAgaXQoJ3Nob3VsZCBiZSBhYmxlIHRvIHNldCBhIHRpbWVvdXQgb24gYSBkcml2ZXIgc2NyaXB0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBjb25zdCBzY3JpcHQgPSBgXG4gICAgICAgICAgYXdhaXQgUHJvbWlzZS5kZWxheSgxMDAwKTtcbiAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgYDtcbiAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgcmVxdWVzdCh7XG4gICAgICAgICAgdXJsOiBgaHR0cDovL2xvY2FsaG9zdDo4MTgxL3dkL2h1Yi9zZXNzaW9uLyR7c2Vzc2lvbklkfS9hcHBpdW0vZXhlY3V0ZV9kcml2ZXJgLFxuICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgICAgIGpzb246IHtzY3JpcHQsIHRpbWVvdXQ6IDUwfSxcbiAgICAgICAgICBzaW1wbGU6IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgICAgcmVzLnZhbHVlLm1lc3NhZ2Uuc2hvdWxkLm1hdGNoKC8uKzUwLit0aW1lb3V0LisvKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgYmFzZURyaXZlckUyRVRlc3RzO1xuIl0sImZpbGUiOiJ0ZXN0L2Jhc2Vkcml2ZXIvZHJpdmVyLWUyZS10ZXN0cy5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLiJ9
