"use strict";

var _interopRequireWildcard = require("@babel/runtime/helpers/interopRequireWildcard");

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = exports.BaseDriver = void 0;

require("source-map-support/register");

var _protocol = require("../protocol");

var _os = _interopRequireDefault(require("os"));

var _commands = _interopRequireDefault(require("./commands"));

var helpers = _interopRequireWildcard(require("./helpers"));

var _logger = _interopRequireDefault(require("./logger"));

var _deviceSettings = _interopRequireDefault(require("./device-settings"));

var _desiredCaps = require("./desired-caps");

var _capabilities = require("./capabilities");

var _bluebird = _interopRequireDefault(require("bluebird"));

var _lodash = _interopRequireDefault(require("lodash"));

var _appiumSupport = require("appium-support");

var _imageElement = require("./image-element");

var _protocol2 = require("../protocol/protocol");

_bluebird.default.config({
  cancellation: true
});

const NEW_COMMAND_TIMEOUT_MS = 60 * 1000;
const EVENT_SESSION_INIT = 'newSessionRequested';
const EVENT_SESSION_START = 'newSessionStarted';
const EVENT_SESSION_QUIT_START = 'quitSessionRequested';
const EVENT_SESSION_QUIT_DONE = 'quitSessionFinished';

class BaseDriver extends _protocol.Protocol {
  constructor(opts = {}, shouldValidateCaps = true) {
    super();
    this.sessionId = null;
    this.opts = opts;
    this.caps = null;
    this.helpers = helpers;
    this.relaxedSecurityEnabled = false;
    this.allowInsecure = [];
    this.denyInsecure = [];
    this.newCommandTimeoutMs = NEW_COMMAND_TIMEOUT_MS;
    this.implicitWaitMs = 0;
    this._constraints = _lodash.default.cloneDeep(_desiredCaps.desiredCapabilityConstraints);
    this.locatorStrategies = [];
    this.webLocatorStrategies = [];
    this.opts.tmpDir = this.opts.tmpDir || process.env.APPIUM_TMP_DIR || _os.default.tmpdir();
    this.curCommand = _bluebird.default.resolve();
    this.curCommandCancellable = _bluebird.default.resolve();
    this.shutdownUnexpectedly = false;
    this.noCommandTimer = null;
    this.shouldValidateCaps = shouldValidateCaps;
    this.settings = new _deviceSettings.default({}, _lodash.default.noop);
    this.resetOnUnexpectedShutdown();
    this.initialOpts = _lodash.default.cloneDeep(this.opts);
    this.managedDrivers = [];
    this._eventHistory = {
      commands: []
    };
    this._imgElCache = (0, _imageElement.makeImageElementCache)();
    this.protocol = null;
  }

  get driverData() {
    return {};
  }

  get isCommandsQueueEnabled() {
    return true;
  }

  get eventHistory() {
    return _lodash.default.cloneDeep(this._eventHistory);
  }

  logEvent(eventName) {
    if (eventName === 'commands') {
      throw new Error('Cannot log commands directly');
    }

    if (typeof eventName !== 'string') {
      throw new Error(`Invalid eventName ${eventName}`);
    }

    if (!this._eventHistory[eventName]) {
      this._eventHistory[eventName] = [];
    }

    let ts = Date.now();
    let logTime = new Date(ts).toTimeString();

    this._eventHistory[eventName].push(ts);

    _logger.default.debug(`Event '${eventName}' logged at ${ts} (${logTime})`);
  }

  async getStatus() {
    return {};
  }

  resetOnUnexpectedShutdown() {
    if (this.onUnexpectedShutdown && !this.onUnexpectedShutdown.isFulfilled()) {
      this.onUnexpectedShutdown.cancel();
    }

    this.onUnexpectedShutdown = new _bluebird.default((resolve, reject, onCancel) => {
      onCancel(() => reject(new _bluebird.default.CancellationError()));
      this.unexpectedShutdownDeferred = {
        resolve,
        reject
      };
    });
    this.onUnexpectedShutdown.catch(() => {});
  }

  set desiredCapConstraints(constraints) {
    this._constraints = Object.assign(this._constraints, constraints);

    for (const [, value] of _lodash.default.toPairs(this._constraints)) {
      if (value && value.presence === true) {
        value.presence = {
          allowEmpty: false
        };
      }
    }
  }

  get desiredCapConstraints() {
    return this._constraints;
  }

  sessionExists(sessionId) {
    if (!sessionId) return false;
    return sessionId === this.sessionId;
  }

  driverForSession() {
    return this;
  }

  logExtraCaps(caps) {
    let extraCaps = _lodash.default.difference(_lodash.default.keys(caps), _lodash.default.keys(this._constraints));

    if (extraCaps.length) {
      _logger.default.warn(`The following capabilities were provided, but are not ` + `recognized by Appium:`);

      for (const cap of extraCaps) {
        _logger.default.warn(`  ${cap}`);
      }
    }
  }

  validateDesiredCaps(caps) {
    if (!this.shouldValidateCaps) {
      return true;
    }

    try {
      (0, _capabilities.validateCaps)(caps, this._constraints);
    } catch (e) {
      _logger.default.errorAndThrow(new _protocol.errors.SessionNotCreatedError(`The desiredCapabilities object was not valid for the ` + `following reason(s): ${e.message}`));
    }

    this.logExtraCaps(caps);
    return true;
  }

  isMjsonwpProtocol() {
    return this.protocol === BaseDriver.DRIVER_PROTOCOL.MJSONWP;
  }

  isW3CProtocol() {
    return this.protocol === BaseDriver.DRIVER_PROTOCOL.W3C;
  }

  setProtocolMJSONWP() {
    this.protocol = BaseDriver.DRIVER_PROTOCOL.MJSONWP;
  }

  setProtocolW3C() {
    this.protocol = BaseDriver.DRIVER_PROTOCOL.W3C;
  }

  static determineProtocol(desiredCapabilities, requiredCapabilities, capabilities) {
    return _lodash.default.isPlainObject(capabilities) ? BaseDriver.DRIVER_PROTOCOL.W3C : BaseDriver.DRIVER_PROTOCOL.MJSONWP;
  }

  isFeatureEnabled(name) {
    if (this.denyInsecure && _lodash.default.includes(this.denyInsecure, name)) {
      return false;
    }

    if (this.allowInsecure && _lodash.default.includes(this.allowInsecure, name)) {
      return true;
    }

    if (this.relaxedSecurityEnabled) {
      return true;
    }

    return false;
  }

  ensureFeatureEnabled(name) {
    if (!this.isFeatureEnabled(name)) {
      throw new Error(`Potentially insecure feature '${name}' has not been ` + `enabled. If you want to enable this feature and accept ` + `the security ramifications, please do so by following ` + `the documented instructions at https://github.com/appium` + `/appium/blob/master/docs/en/writing-running-appium/security.md`);
    }
  }

  async executeCommand(cmd, ...args) {
    let startTime = Date.now();

    if (cmd === 'createSession') {
      this.protocol = BaseDriver.determineProtocol(...args);
      this.logEvent(EVENT_SESSION_INIT);
    } else if (cmd === 'deleteSession') {
      this.logEvent(EVENT_SESSION_QUIT_START);
    }

    this.clearNewCommandTimeout();
    const imgElId = (0, _imageElement.getImgElFromArgs)(args);

    if (!this[cmd] && !imgElId) {
      throw new _protocol.errors.NotYetImplementedError();
    }

    let res;

    if (this.isCommandsQueueEnabled && cmd !== 'executeDriverScript') {
      const nextCommand = this.curCommand.then(() => {
        if (this.shutdownUnexpectedly) {
          return _bluebird.default.reject(new _protocol.errors.NoSuchDriverError('The driver was unexpectedly shut down!'));
        }

        let reject;
        this.curCommandCancellable = _bluebird.default.resolve().then(() => {
          const cancelPromise = new _bluebird.default(function (_, _reject) {
            reject = _reject;
          });
          return _bluebird.default.race([imgElId ? _imageElement.ImageElement.execute(this, cmd, imgElId, ...args) : this[cmd](...args), cancelPromise]);
        });

        this.curCommandCancellable.cancel = function cancel(err) {
          if (reject) {
            reject(err);
          }
        };

        return this.curCommandCancellable;
      });
      this.curCommand = nextCommand.catch(() => {});
      res = await nextCommand;
    } else {
      if (this.shutdownUnexpectedly) {
        throw new _protocol.errors.NoSuchDriverError('The driver was unexpectedly shut down!');
      }

      res = await this[cmd](...args);
    }

    if (this.isCommandsQueueEnabled && cmd !== 'deleteSession') {
      this.startNewCommandTimeout();
    }

    const endTime = Date.now();

    this._eventHistory.commands.push({
      cmd,
      startTime,
      endTime
    });

    if (cmd === 'createSession') {
      this.logEvent(EVENT_SESSION_START);
    } else if (cmd === 'deleteSession') {
      this.logEvent(EVENT_SESSION_QUIT_DONE);
    }

    return res;
  }

  async startUnexpectedShutdown(err = new _protocol.errors.NoSuchDriverError('The driver was unexpectedly shut down!')) {
    this.unexpectedShutdownDeferred.reject(err);
    this.shutdownUnexpectedly = true;
    await this.deleteSession(this.sessionId);
    this.shutdownUnexpectedly = false;
    this.curCommandCancellable.cancel(err);
  }

  validateLocatorStrategy(strategy, webContext = false) {
    let validStrategies = this.locatorStrategies;

    _logger.default.debug(`Valid locator strategies for this request: ${validStrategies.join(', ')}`);

    if (webContext) {
      validStrategies = validStrategies.concat(this.webLocatorStrategies);
    }

    if (!_lodash.default.includes(validStrategies, strategy)) {
      throw new _protocol.errors.InvalidSelectorError(`Locator Strategy '${strategy}' is not supported for this session`);
    }
  }

  async reset() {
    _logger.default.debug('Resetting app mid-session');

    _logger.default.debug('Running generic full reset');

    let currentConfig = {};

    for (let property of ['implicitWaitMs', 'newCommandTimeoutMs', 'sessionId', 'resetOnUnexpectedShutdown']) {
      currentConfig[property] = this[property];
    }

    this.resetOnUnexpectedShutdown = () => {};

    const args = this.protocol === BaseDriver.DRIVER_PROTOCOL.W3C ? [undefined, undefined, {
      alwaysMatch: this.caps,
      firstMatch: [{}]
    }] : [this.caps];

    try {
      await this.deleteSession(this.sessionId);

      _logger.default.debug('Restarting app');

      await this.createSession(...args);
    } finally {
      for (let [key, value] of _lodash.default.toPairs(currentConfig)) {
        this[key] = value;
      }
    }

    this.clearNewCommandTimeout();
  }

  async getSwipeOptions(gestures, touchCount = 1) {
    let startX = this.helpers.getCoordDefault(gestures[0].options.x),
        startY = this.helpers.getCoordDefault(gestures[0].options.y),
        endX = this.helpers.getCoordDefault(gestures[2].options.x),
        endY = this.helpers.getCoordDefault(gestures[2].options.y),
        duration = this.helpers.getSwipeTouchDuration(gestures[1]),
        element = gestures[0].options.element,
        destElement = gestures[2].options.element || gestures[0].options.element;

    if (_appiumSupport.util.hasValue(destElement)) {
      let locResult = await this.getLocationInView(destElement);
      let sizeResult = await this.getSize(destElement);
      let offsetX = Math.abs(endX) < 1 && Math.abs(endX) > 0 ? sizeResult.width * endX : endX;
      let offsetY = Math.abs(endY) < 1 && Math.abs(endY) > 0 ? sizeResult.height * endY : endY;
      endX = locResult.x + offsetX;
      endY = locResult.y + offsetY;

      if (_appiumSupport.util.hasValue(element)) {
        let firstElLocation = await this.getLocationInView(element);
        endX -= firstElLocation.x;
        endY -= firstElLocation.y;
      }
    }

    return {
      startX,
      startY,
      endX,
      endY,
      duration,
      touchCount,
      element
    };
  }

  proxyActive() {
    return false;
  }

  getProxyAvoidList() {
    return [];
  }

  canProxy() {
    return false;
  }

  proxyRouteIsAvoided(sessionId, method, url) {
    for (let avoidSchema of this.getProxyAvoidList(sessionId)) {
      if (!_lodash.default.isArray(avoidSchema) || avoidSchema.length !== 2) {
        throw new Error('Proxy avoidance must be a list of pairs');
      }

      let [avoidMethod, avoidPathRegex] = avoidSchema;

      if (!_lodash.default.includes(['GET', 'POST', 'DELETE'], avoidMethod)) {
        throw new Error(`Unrecognized proxy avoidance method '${avoidMethod}'`);
      }

      if (!_lodash.default.isRegExp(avoidPathRegex)) {
        throw new Error('Proxy avoidance path must be a regular expression');
      }

      let normalizedUrl = url.replace(/^\/wd\/hub/, '');

      if (avoidMethod === method && avoidPathRegex.test(normalizedUrl)) {
        return true;
      }
    }

    return false;
  }

  addManagedDriver(driver) {
    this.managedDrivers.push(driver);
  }

  getManagedDrivers() {
    return this.managedDrivers;
  }

  registerImageElement(imgEl) {
    this._imgElCache.set(imgEl.id, imgEl);

    const protoKey = this.isW3CProtocol() ? _protocol2.W3C_ELEMENT_KEY : _protocol2.MJSONWP_ELEMENT_KEY;
    return imgEl.asElement(protoKey);
  }

}

exports.BaseDriver = BaseDriver;
BaseDriver.DRIVER_PROTOCOL = {
  W3C: 'W3C',
  MJSONWP: 'MJSONWP'
};

for (let [cmd, fn] of _lodash.default.toPairs(_commands.default)) {
  BaseDriver.prototype[cmd] = fn;
}

var _default = BaseDriver;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9iYXNlZHJpdmVyL2RyaXZlci5qcyJdLCJuYW1lcyI6WyJCIiwiY29uZmlnIiwiY2FuY2VsbGF0aW9uIiwiTkVXX0NPTU1BTkRfVElNRU9VVF9NUyIsIkVWRU5UX1NFU1NJT05fSU5JVCIsIkVWRU5UX1NFU1NJT05fU1RBUlQiLCJFVkVOVF9TRVNTSU9OX1FVSVRfU1RBUlQiLCJFVkVOVF9TRVNTSU9OX1FVSVRfRE9ORSIsIkJhc2VEcml2ZXIiLCJQcm90b2NvbCIsImNvbnN0cnVjdG9yIiwib3B0cyIsInNob3VsZFZhbGlkYXRlQ2FwcyIsInNlc3Npb25JZCIsImNhcHMiLCJoZWxwZXJzIiwicmVsYXhlZFNlY3VyaXR5RW5hYmxlZCIsImFsbG93SW5zZWN1cmUiLCJkZW55SW5zZWN1cmUiLCJuZXdDb21tYW5kVGltZW91dE1zIiwiaW1wbGljaXRXYWl0TXMiLCJfY29uc3RyYWludHMiLCJfIiwiY2xvbmVEZWVwIiwiZGVzaXJlZENhcGFiaWxpdHlDb25zdHJhaW50cyIsImxvY2F0b3JTdHJhdGVnaWVzIiwid2ViTG9jYXRvclN0cmF0ZWdpZXMiLCJ0bXBEaXIiLCJwcm9jZXNzIiwiZW52IiwiQVBQSVVNX1RNUF9ESVIiLCJvcyIsInRtcGRpciIsImN1ckNvbW1hbmQiLCJyZXNvbHZlIiwiY3VyQ29tbWFuZENhbmNlbGxhYmxlIiwic2h1dGRvd25VbmV4cGVjdGVkbHkiLCJub0NvbW1hbmRUaW1lciIsInNldHRpbmdzIiwiRGV2aWNlU2V0dGluZ3MiLCJub29wIiwicmVzZXRPblVuZXhwZWN0ZWRTaHV0ZG93biIsImluaXRpYWxPcHRzIiwibWFuYWdlZERyaXZlcnMiLCJfZXZlbnRIaXN0b3J5IiwiY29tbWFuZHMiLCJfaW1nRWxDYWNoZSIsInByb3RvY29sIiwiZHJpdmVyRGF0YSIsImlzQ29tbWFuZHNRdWV1ZUVuYWJsZWQiLCJldmVudEhpc3RvcnkiLCJsb2dFdmVudCIsImV2ZW50TmFtZSIsIkVycm9yIiwidHMiLCJEYXRlIiwibm93IiwibG9nVGltZSIsInRvVGltZVN0cmluZyIsInB1c2giLCJsb2ciLCJkZWJ1ZyIsImdldFN0YXR1cyIsIm9uVW5leHBlY3RlZFNodXRkb3duIiwiaXNGdWxmaWxsZWQiLCJjYW5jZWwiLCJyZWplY3QiLCJvbkNhbmNlbCIsIkNhbmNlbGxhdGlvbkVycm9yIiwidW5leHBlY3RlZFNodXRkb3duRGVmZXJyZWQiLCJjYXRjaCIsImRlc2lyZWRDYXBDb25zdHJhaW50cyIsImNvbnN0cmFpbnRzIiwiT2JqZWN0IiwiYXNzaWduIiwidmFsdWUiLCJ0b1BhaXJzIiwicHJlc2VuY2UiLCJhbGxvd0VtcHR5Iiwic2Vzc2lvbkV4aXN0cyIsImRyaXZlckZvclNlc3Npb24iLCJsb2dFeHRyYUNhcHMiLCJleHRyYUNhcHMiLCJkaWZmZXJlbmNlIiwia2V5cyIsImxlbmd0aCIsIndhcm4iLCJjYXAiLCJ2YWxpZGF0ZURlc2lyZWRDYXBzIiwiZSIsImVycm9yQW5kVGhyb3ciLCJlcnJvcnMiLCJTZXNzaW9uTm90Q3JlYXRlZEVycm9yIiwibWVzc2FnZSIsImlzTWpzb253cFByb3RvY29sIiwiRFJJVkVSX1BST1RPQ09MIiwiTUpTT05XUCIsImlzVzNDUHJvdG9jb2wiLCJXM0MiLCJzZXRQcm90b2NvbE1KU09OV1AiLCJzZXRQcm90b2NvbFczQyIsImRldGVybWluZVByb3RvY29sIiwiZGVzaXJlZENhcGFiaWxpdGllcyIsInJlcXVpcmVkQ2FwYWJpbGl0aWVzIiwiY2FwYWJpbGl0aWVzIiwiaXNQbGFpbk9iamVjdCIsImlzRmVhdHVyZUVuYWJsZWQiLCJuYW1lIiwiaW5jbHVkZXMiLCJlbnN1cmVGZWF0dXJlRW5hYmxlZCIsImV4ZWN1dGVDb21tYW5kIiwiY21kIiwiYXJncyIsInN0YXJ0VGltZSIsImNsZWFyTmV3Q29tbWFuZFRpbWVvdXQiLCJpbWdFbElkIiwiTm90WWV0SW1wbGVtZW50ZWRFcnJvciIsInJlcyIsIm5leHRDb21tYW5kIiwidGhlbiIsIk5vU3VjaERyaXZlckVycm9yIiwiY2FuY2VsUHJvbWlzZSIsIl9yZWplY3QiLCJyYWNlIiwiSW1hZ2VFbGVtZW50IiwiZXhlY3V0ZSIsImVyciIsInN0YXJ0TmV3Q29tbWFuZFRpbWVvdXQiLCJlbmRUaW1lIiwic3RhcnRVbmV4cGVjdGVkU2h1dGRvd24iLCJkZWxldGVTZXNzaW9uIiwidmFsaWRhdGVMb2NhdG9yU3RyYXRlZ3kiLCJzdHJhdGVneSIsIndlYkNvbnRleHQiLCJ2YWxpZFN0cmF0ZWdpZXMiLCJqb2luIiwiY29uY2F0IiwiSW52YWxpZFNlbGVjdG9yRXJyb3IiLCJyZXNldCIsImN1cnJlbnRDb25maWciLCJwcm9wZXJ0eSIsInVuZGVmaW5lZCIsImFsd2F5c01hdGNoIiwiZmlyc3RNYXRjaCIsImNyZWF0ZVNlc3Npb24iLCJrZXkiLCJnZXRTd2lwZU9wdGlvbnMiLCJnZXN0dXJlcyIsInRvdWNoQ291bnQiLCJzdGFydFgiLCJnZXRDb29yZERlZmF1bHQiLCJvcHRpb25zIiwieCIsInN0YXJ0WSIsInkiLCJlbmRYIiwiZW5kWSIsImR1cmF0aW9uIiwiZ2V0U3dpcGVUb3VjaER1cmF0aW9uIiwiZWxlbWVudCIsImRlc3RFbGVtZW50IiwidXRpbCIsImhhc1ZhbHVlIiwibG9jUmVzdWx0IiwiZ2V0TG9jYXRpb25JblZpZXciLCJzaXplUmVzdWx0IiwiZ2V0U2l6ZSIsIm9mZnNldFgiLCJNYXRoIiwiYWJzIiwid2lkdGgiLCJvZmZzZXRZIiwiaGVpZ2h0IiwiZmlyc3RFbExvY2F0aW9uIiwicHJveHlBY3RpdmUiLCJnZXRQcm94eUF2b2lkTGlzdCIsImNhblByb3h5IiwicHJveHlSb3V0ZUlzQXZvaWRlZCIsIm1ldGhvZCIsInVybCIsImF2b2lkU2NoZW1hIiwiaXNBcnJheSIsImF2b2lkTWV0aG9kIiwiYXZvaWRQYXRoUmVnZXgiLCJpc1JlZ0V4cCIsIm5vcm1hbGl6ZWRVcmwiLCJyZXBsYWNlIiwidGVzdCIsImFkZE1hbmFnZWREcml2ZXIiLCJkcml2ZXIiLCJnZXRNYW5hZ2VkRHJpdmVycyIsInJlZ2lzdGVySW1hZ2VFbGVtZW50IiwiaW1nRWwiLCJzZXQiLCJpZCIsInByb3RvS2V5IiwiVzNDX0VMRU1FTlRfS0VZIiwiTUpTT05XUF9FTEVNRU5UX0tFWSIsImFzRWxlbWVudCIsImZuIiwicHJvdG90eXBlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7O0FBQUE7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBQ0E7O0FBR0FBLGtCQUFFQyxNQUFGLENBQVM7QUFDUEMsRUFBQUEsWUFBWSxFQUFFO0FBRFAsQ0FBVDs7QUFJQSxNQUFNQyxzQkFBc0IsR0FBRyxLQUFLLElBQXBDO0FBRUEsTUFBTUMsa0JBQWtCLEdBQUcscUJBQTNCO0FBQ0EsTUFBTUMsbUJBQW1CLEdBQUcsbUJBQTVCO0FBQ0EsTUFBTUMsd0JBQXdCLEdBQUcsc0JBQWpDO0FBQ0EsTUFBTUMsdUJBQXVCLEdBQUcscUJBQWhDOztBQUVBLE1BQU1DLFVBQU4sU0FBeUJDLGtCQUF6QixDQUFrQztBQUVoQ0MsRUFBQUEsV0FBVyxDQUFFQyxJQUFJLEdBQUcsRUFBVCxFQUFhQyxrQkFBa0IsR0FBRyxJQUFsQyxFQUF3QztBQUNqRDtBQUdBLFNBQUtDLFNBQUwsR0FBaUIsSUFBakI7QUFDQSxTQUFLRixJQUFMLEdBQVlBLElBQVo7QUFDQSxTQUFLRyxJQUFMLEdBQVksSUFBWjtBQUNBLFNBQUtDLE9BQUwsR0FBZUEsT0FBZjtBQUdBLFNBQUtDLHNCQUFMLEdBQThCLEtBQTlCO0FBQ0EsU0FBS0MsYUFBTCxHQUFxQixFQUFyQjtBQUNBLFNBQUtDLFlBQUwsR0FBb0IsRUFBcEI7QUFHQSxTQUFLQyxtQkFBTCxHQUEyQmhCLHNCQUEzQjtBQUNBLFNBQUtpQixjQUFMLEdBQXNCLENBQXRCO0FBRUEsU0FBS0MsWUFBTCxHQUFvQkMsZ0JBQUVDLFNBQUYsQ0FBWUMseUNBQVosQ0FBcEI7QUFDQSxTQUFLQyxpQkFBTCxHQUF5QixFQUF6QjtBQUNBLFNBQUtDLG9CQUFMLEdBQTRCLEVBQTVCO0FBSUEsU0FBS2YsSUFBTCxDQUFVZ0IsTUFB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LFVBQUlKLFdBQVcsS0FBS0osTUFBaEIsSUFBMEJLLGNBQWMsQ0FBQ0ksSUFBZixDQUFvQkYsYUFBcEIsQ0FBOUIsRUFBa0U7QUFDaEUsZUFBTyxJQUFQO0FBQ0Q7QUFDRjs7QUFDRCxXQUFPLEtBQVA7QUFDRDs7QUFFREcsRUFBQUEsZ0JBQWdCLENBQUVDLE1BQUYsRUFBVTtBQUN4QixTQUFLbEosY0FBTCxDQUFvQmdCLElBQXBCLENBQXlCa0ksTUFBekI7QUFDRDs7QUFFREMsRUFBQUEsaUJBQWlCLEdBQUk7QUFDbkIsV0FBTyxLQUFLbkosY0FBWjtBQUNEOztBQUVEb0osRUFBQUEsb0JBQW9CLENBQUVDLEtBQUYsRUFBUztBQUMzQixTQUFLbEosV0FBTCxDQUFpQm1KLEdBQWpCLENBQXFCRCxLQUFLLENBQUNFLEVBQTNCLEVBQStCRixLQUEvQjs7QUFDQSxVQUFNRyxRQUFRLEdBQUcsS0FBS2xHLGFBQUwsS0FBdUJtRywwQkFBdkIsR0FBeUNDLDhCQUExRDtBQUNBLFdBQU9MLEtBQUssQ0FBQ00sU0FBTixDQUFnQkgsUUFBaEIsQ0FBUDtBQUNEOztBQXBnQitCOzs7QUF1Z0JsQzNMLFVBQVUsQ0FBQ3VGLGVBQVgsR0FBNkI7QUFDM0JHLEVBQUFBLEdBQUcsRUFBRSxLQURzQjtBQUUzQkYsRUFBQUEsT0FBTyxFQUFFO0FBRmtCLENBQTdCOztBQUtBLEtBQUssSUFBSSxDQUFDZSxHQUFELEVBQU13RixFQUFOLENBQVQsSUFBc0JqTCxnQkFBRXNELE9BQUYsQ0FBVS9CLGlCQUFWLENBQXRCLEVBQTJDO0FBQ3pDckMsRUFBQUEsVUFBVSxDQUFDZ00sU0FBWCxDQUFxQnpGLEdBQXJCLElBQTRCd0YsRUFBNUI7QUFDRDs7ZUFHYy9MLFUiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBQcm90b2NvbCwgZXJyb3JzIH0gZnJvbSAnLi4vcHJvdG9jb2wnO1xuaW1wb3J0IG9zIGZyb20gJ29zJztcbmltcG9ydCBjb21tYW5kcyBmcm9tICcuL2NvbW1hbmRzJztcbmltcG9ydCAqIGFzIGhlbHBlcnMgZnJvbSAnLi9oZWxwZXJzJztcbmltcG9ydCBsb2cgZnJvbSAnLi9sb2dnZXInO1xuaW1wb3J0IERldmljZVNldHRpbmdzIGZyb20gJy4vZGV2aWNlLXNldHRpbmdzJztcbmltcG9ydCB7IGRlc2lyZWRDYXBhYmlsaXR5Q29uc3RyYWludHMgfSBmcm9tICcuL2Rlc2lyZWQtY2Fwcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZUNhcHMgfSBmcm9tICcuL2NhcGFiaWxpdGllcyc7XG5pbXBvcnQgQiBmcm9tICdibHVlYmlyZCc7XG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnO1xuaW1wb3J0IHsgdXRpbCB9IGZyb20gJ2FwcGl1bS1zdXBwb3J0JztcbmltcG9ydCB7IEltYWdlRWxlbWVudCwgbWFrZUltYWdlRWxlbWVudENhY2hlLCBnZXRJbWdFbEZyb21BcmdzIH0gZnJvbSAnLi9pbWFnZS1lbGVtZW50JztcbmltcG9ydCB7IFczQ19FTEVNRU5UX0tFWSwgTUpTT05XUF9FTEVNRU5UX0tFWSB9IGZyb20gJy4uL3Byb3RvY29sL3Byb3RvY29sJztcblxuXG5CLmNvbmZpZyh7XG4gIGNhbmNlbGxhdGlvbjogdHJ1ZSxcbn0pO1xuXG5jb25zdCBORVdfQ09NTUFORF9USU1FT1VUX01TID0gNjAgKiAxMDAwO1xuXG5jb25zdCBFVkVOVF9TRVNTSU9OX0lOSVQgPSAnbmV3U2Vzc2lvblJlcXVlc3RlZCc7XG5jb25zdCBFVkVOVF9TRVNTSU9OX1NUQVJUID0gJ25ld1Nlc3Npb25TdGFydGVkJztcbmNvbnN0IEVWRU5UX1NFU1NJT05fUVVJVF9TVEFSVCA9ICdxdWl0U2Vzc2lvblJlcXVlc3RlZCc7XG5jb25zdCBFVkVOVF9TRVNTSU9OX1FVSVRfRE9ORSA9ICdxdWl0U2Vzc2lvbkZpbmlzaGVkJztcblxuY2xhc3MgQmFzZURyaXZlciBleHRlbmRzIFByb3RvY29sIHtcblxuICBjb25zdHJ1Y3RvciAob3B0cyA9IHt9LCBzaG91bGRWYWxpZGF0ZUNhcHMgPSB0cnVlKSB7XG4gICAgc3VwZXIoKTtcblxuICAgIC8vIHNldHVwIHN0YXRlXG4gICAgdGhpcy5zZXNzaW9uSWQgPSBudWxsO1xuICAgIHRoaXMub3B0cyA9IG9wdHM7XG4gICAgdGhpcy5jYXBzID0gbnVsbDtcbiAgICB0aGlzLmhlbHBlcnMgPSBoZWxwZXJzO1xuXG4gICAgLy8gaW5pdGlhbGl6ZSBzZWN1cml0eSBtb2Rlc1xuICAgIHRoaXMucmVsYXhlZFNlY3VyaXR5RW5hYmxlZCA9IGZhbHNlO1xuICAgIHRoaXMuYWxsb3dJbnNlY3VyZSA9IFtdO1xuICAgIHRoaXMuZGVueUluc2VjdXJlID0gW107XG5cbiAgICAvLyB0aW1lb3V0IGluaXRpYWxpemF0aW9uXG4gICAgdGhpcy5uZXdDb21tYW5kVGltZW91dE1zID0gTkVXX0NPTU1BTkRfVElNRU9VVF9NUztcbiAgICB0aGlzLmltcGxpY2l0V2FpdE1zID0gMDtcblxuICAgIHRoaXMuX2NvbnN0cmFpbnRzID0gXy5jbG9uZURlZXAoZGVzaXJlZENhcGFiaWxpdHlDb25zdHJhaW50cyk7XG4gICAgdGhpcy5sb2NhdG9yU3RyYXRlZ2llcyA9IFtdO1xuICAgIHRoaXMud2ViTG9jYXRvclN0cmF0ZWdpZXMgPSBbXTtcblxuICAgIC8vIHVzZSBhIGN1c3RvbSB0bXAgZGlyIHRvIGF2b2lkIGxvc2luZyBkYXRhIGFuZCBhcHAgd2hlbiBjb21wdXRlciBpc1xuICAgIC8vIHJlc3RhcnRlZFxuICAgIHRoaXMub3B0cy50bXBEaXIgPSB0aGlzLm9wdHMudG1wRGlyIHx8XG4gICAgICAgICAgICAgICAgICAgICAgIHByb2Nlc3MuZW52LkFQUElVTV9UTVBfRElSIHx8XG4gICAgICAgICAgICAgICAgICAgICAgIG9zLnRtcGRpcigpO1xuXG4gICAgLy8gYmFzZS1kcml2ZXIgaW50ZXJuYWxzXG4gICAgdGhpcy5jdXJDb21tYW5kID0gQi5yZXNvbHZlKCk7IC8vIHNlZSBub3RlIGluIGV4ZWN1dGVcbiAgICB0aGlzLmN1ckNvbW1hbmRDYW5jZWxsYWJsZSA9IEIucmVzb2x2ZSgpOyAvLyBzZWUgbm90ZSBpbiBleGVjdXRlXG4gICAgdGhpcy5zaHV0ZG93blVuZXhwZWN0ZWRseSA9IGZhbHNlO1xuICAgIHRoaXMubm9Db21tYW5kVGltZXIgPSBudWxsO1xuICAgIHRoaXMuc2hvdWxkVmFsaWRhdGVDYXBzID0gc2hvdWxkVmFsaWRhdGVDYXBzO1xuXG4gICAgLy8gc2V0dGluZ3Mgc2hvdWxkIGJlIGluc3RhbnRpYXRlZCBieSBkcml2ZXJzIHdoaWNoIGV4dGVuZCBCYXNlRHJpdmVyLCBidXRcbiAgICAvLyB3ZSBzZXQgaXQgdG8gYW4gZW1wdHkgRGV2aWNlU2V0dGluZ3MgaW5zdGFuY2UgaGVyZSB0byBtYWtlIHN1cmUgdGhhdCB0aGVcbiAgICAvLyBkZWZhdWx0IHNldHRpbmdzIGFyZSBhcHBsaWVkIGV2ZW4gaWYgYW4gZXh0ZW5kaW5nIGRyaXZlciBkb2Vzbid0IHV0aWxpemVcbiAgICAvLyB0aGUgc2V0dGluZ3MgZnVuY3Rpb25hbGl0eSBpdHNlbGZcbiAgICB0aGlzLnNldHRpbmdzID0gbmV3IERldmljZVNldHRpbmdzKHt9LCBfLm5vb3ApO1xuXG4gICAgdGhpcy5yZXNldE9uVW5leHBlY3RlZFNodXRkb3duKCk7XG5cbiAgICAvLyBrZWVwaW5nIHRyYWNrIG9mIGluaXRpYWwgb3B0c1xuICAgIHRoaXMuaW5pdGlhbE9wdHMgPSBfLmNsb25lRGVlcCh0aGlzLm9wdHMpO1xuXG4gICAgLy8gYWxsb3cgc3ViY2xhc3NlcyB0byBoYXZlIGludGVybmFsIGRyaXZlcnNcbiAgICB0aGlzLm1hbmFnZWREcml2ZXJzID0gW107XG5cbiAgICAvLyBzdG9yZSBldmVudCB0aW1pbmdzXG4gICAgdGhpcy5fZXZlbnRIaXN0b3J5ID0ge1xuICAgICAgY29tbWFuZHM6IFtdIC8vIGNvbW1hbmRzIGdldCBhIHNwZWNpYWwgcGxhY2VcbiAgICB9O1xuXG4gICAgLy8gY2FjaGUgdGhlIGltYWdlIGVsZW1lbnRzXG4gICAgdGhpcy5faW1nRWxDYWNoZSA9IG1ha2VJbWFnZUVsZW1lbnRDYWNoZSgpO1xuXG4gICAgdGhpcy5wcm90b2NvbCA9IG51bGw7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBwcm9wZXJ0eSBpcyB1c2VkIGJ5IEFwcGl1bURyaXZlciB0byBzdG9yZSB0aGUgZGF0YSBvZiB0aGVcbiAgICogc3BlY2lmaWMgZHJpdmVyIHNlc3Npb25zLiBUaGlzIGRhdGEgY2FuIGJlIGxhdGVyIHVzZWQgdG8gYWRqdXN0XG4gICAqIHByb3BlcnRpZXMgZm9yIGRyaXZlciBpbnN0YW5jZXMgcnVubmluZyBpbiBwYXJhbGxlbC5cbiAgICogT3ZlcnJpZGUgaXQgaW4gaW5oZXJpdGVkIGRyaXZlciBjbGFzc2VzIGlmIG5lY2Vzc2FyeS5cbiAgICpcbiAgICogQHJldHVybiB7b2JqZWN0fSBEcml2ZXIgcHJvcGVydGllcyBtYXBwaW5nXG4gICAqL1xuICBnZXQgZHJpdmVyRGF0YSAoKSB7XG4gICAgcmV0dXJuIHt9O1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgcHJvcGVydHkgY29udHJvbHMgdGhlIHdheSB7I2V4ZWN1dGVDb21tYW5kfSBtZXRob2RcbiAgICogaGFuZGxlcyBuZXcgZHJpdmVyIGNvbW1hbmRzIHJlY2VpdmVkIGZyb20gdGhlIGNsaWVudC5cbiAgICogT3ZlcnJpZGUgaXQgZm9yIGluaGVyaXRlZCBjbGFzc2VzIG9ubHkgaW4gc3BlY2lhbCBjYXNlcy5cbiAgICpcbiAgICogQHJldHVybiB7Ym9vbGVhbn0gSWYgdGhlIHJldHVybmVkIHZhbHVlIGlzIHRydWUgKGRlZmF1bHQpIHRoZW4gYWxsIHRoZSBjb21tYW5kc1xuICAgKiAgIHJlY2VpdmVkIGJ5IHRoZSBwYXJ0aWN1bGFyIGRyaXZlciBpbnN0YW5jZSBhcmUgZ29pbmcgdG8gYmUgcHV0IGludG8gdGhlIHF1ZXVlLFxuICAgKiAgIHNvIGVhY2ggZm9sbG93aW5nIGNvbW1hbmQgd2lsbCBub3QgYmUgZXhlY3V0ZWQgdW50aWwgdGhlIHByZXZpb3VzIGNvbW1hbmRcbiAgICogICBleGVjdXRpb24gaXMgY29tcGxldGVkLiBGYWxzZSB2YWx1ZSBkaXNhYmxlcyB0aGF0IHF1ZXVlLCBzbyBlYWNoIGRyaXZlciBjb21tYW5kXG4gICAqICAgaXMgZXhlY3V0ZWQgaW5kZXBlbmRlbnRseSBhbmQgZG9lcyBub3Qgd2FpdCBmb3IgYW55dGhpbmcuXG4gICAqL1xuICBnZXQgaXNDb21tYW5kc1F1ZXVlRW5hYmxlZCAoKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICAvKlxuICAgKiBtYWtlIGV2ZW50SGlzdG9yeSBhIHByb3BlcnR5IGFuZCByZXR1cm4gYSBjbG9uZWQgb2JqZWN0IHNvIGEgY29uc3VtZXIgY2FuJ3RcbiAgICogaW5hZHZlcnRlbnRseSBjaGFuZ2UgZGF0YSBvdXRzaWRlIG9mIGxvZ0V2ZW50XG4gICAqL1xuICBnZXQgZXZlbnRIaXN0b3J5ICgpIHtcbiAgICByZXR1cm4gXy5jbG9uZURlZXAodGhpcy5fZXZlbnRIaXN0b3J5KTtcbiAgfVxuXG4gIC8qXG4gICAqIEFQSSBtZXRob2QgZm9yIGRyaXZlciBkZXZlbG9wZXJzIHRvIGxvZyB0aW1pbmdzIGZvciBpbXBvcnRhbnQgZXZlbnRzXG4gICAqL1xuICBsb2dFdmVudCAoZXZlbnROYW1lKSB7XG4gICAgaWYgKGV2ZW50TmFtZSA9PT0gJ2NvbW1hbmRzJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgbG9nIGNvbW1hbmRzIGRpcmVjdGx5Jyk7XG4gICAgfVxuICAgIGlmICh0eXBlb2YgZXZlbnROYW1lICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGV2ZW50TmFtZSAke2V2ZW50TmFtZX1gKTtcbiAgICB9XG4gICAgaWYgKCF0aGlzLl9ldmVudEhpc3RvcnlbZXZlbnROYW1lXSkge1xuICAgICAgdGhpcy5fZXZlbnRIaXN0b3J5W2V2ZW50TmFtZV0gPSBbXTtcbiAgICB9XG4gICAgbGV0IHRzID0gRGF0ZS5ub3coKTtcbiAgICBsZXQgbG9nVGltZSA9IChuZXcgRGF0ZSh0cykpLnRvVGltZVN0cmluZygpO1xuICAgIHRoaXMuX2V2ZW50SGlzdG9yeVtldmVudE5hbWVdLnB1c2godHMpO1xuICAgIGxvZy5kZWJ1ZyhgRXZlbnQgJyR7ZXZlbnROYW1lfScgbG9nZ2VkIGF0ICR7dHN9ICgke2xvZ1RpbWV9KWApO1xuICB9XG5cbiAgLypcbiAgICogT3ZlcnJpZGRlbiBpbiBhcHBpdW0gZHJpdmVyLCBidXQgaGVyZSBzbyB0aGF0IGluZGl2aWR1YWwgZHJpdmVycyBjYW4gYmVcbiAgICogdGVzdGVkIHdpdGggY2xpZW50cyB0aGF0IHBvbGxcbiAgICovXG4gIGFzeW5jIGdldFN0YXR1cyAoKSB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgcmVxdWlyZS1hd2FpdFxuICAgIHJldHVybiB7fTtcbiAgfVxuXG4gIC8qXG4gICAqIEluaXRpYWxpemUgYSBuZXcgb25VbmV4cGVjdGVkU2h1dGRvd24gcHJvbWlzZSwgY2FuY2VsbGluZyBleGlzdGluZyBvbmUuXG4gICAqL1xuICByZXNldE9uVW5leHBlY3RlZFNodXRkb3duICgpIHtcbiAgICBpZiAodGhpcy5vblVuZXhwZWN0ZWRTaHV0ZG93biAmJiAhdGhpcy5vblVuZXhwZWN0ZWRTaHV0ZG93bi5pc0Z1bGZpbGxlZCgpKSB7XG4gICAgICB0aGlzLm9uVW5leHBlY3RlZFNodXRkb3duLmNhbmNlbCgpO1xuICAgIH1cbiAgICB0aGlzLm9uVW5leHBlY3RlZFNodXRkb3duID0gbmV3IEIoKHJlc29sdmUsIHJlamVjdCwgb25DYW5jZWwpID0+IHtcbiAgICAgIG9uQ2FuY2VsKCgpID0+IHJlamVjdChuZXcgQi5DYW5jZWxsYXRpb25FcnJvcigpKSk7XG4gICAgICB0aGlzLnVuZXhwZWN0ZWRTaHV0ZG93bkRlZmVycmVkID0ge3Jlc29sdmUsIHJlamVjdH07XG4gICAgfSk7XG4gICAgLy8gbm9vcCBoYW5kbGVyIHRvIGF2b2lkIHdhcm5pbmcuXG4gICAgdGhpcy5vblVuZXhwZWN0ZWRTaHV0ZG93bi5jYXRjaCgoKSA9PiB7fSk7XG4gIH1cblxuICAvLyB3ZSBvbmx5IHdhbnQgc3ViY2xhc3NlcyB0byBldmVyIGV4dGVuZCB0aGUgY29udHJhaW50c1xuICBzZXQgZGVzaXJlZENhcENvbnN0cmFpbnRzIChjb25zdHJhaW50cykge1xuICAgIHRoaXMuX2NvbnN0cmFpbnRzID0gT2JqZWN0LmFzc2lnbih0aGlzLl9jb25zdHJhaW50cywgY29uc3RyYWludHMpO1xuICAgIC8vICdwcmVzZW5jZScgbWVhbnMgZGlmZmVyZW50IHRoaW5ncyBpbiBkaWZmZXJlbnQgdmVyc2lvbnMgb2YgdGhlIHZhbGlkYXRvcixcbiAgICAvLyB3aGVuIHdlIHNheSAndHJ1ZScgd2UgbWVhbiB0aGF0IGl0IHNob3VsZCBub3QgYmUgYWJsZSB0byBiZSBlbXB0eVxuICAgIGZvciAoY29uc3QgWywgdmFsdWVdIG9mIF8udG9QYWlycyh0aGlzLl9jb25zdHJhaW50cykpIHtcbiAgICAgIGlmICh2YWx1ZSAmJiB2YWx1ZS5wcmVzZW5jZSA9PT0gdHJ1ZSkge1xuICAgICAgICB2YWx1ZS5wcmVzZW5jZSA9IHtcbiAgICAgICAgICBhbGxvd0VtcHR5OiBmYWxzZSxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBnZXQgZGVzaXJlZENhcENvbnN0cmFpbnRzICgpIHtcbiAgICByZXR1cm4gdGhpcy5fY29uc3RyYWludHM7XG4gIH1cblxuICAvLyBtZXRob2QgcmVxdWlyZWQgYnkgTUpTT05XUCBpbiBvcmRlciB0byBkZXRlcm1pbmUgd2hldGhlciBpdCBzaG91bGRcbiAgLy8gcmVzcG9uZCB3aXRoIGFuIGludmFsaWQgc2Vzc2lvbiByZXNwb25zZVxuICBzZXNzaW9uRXhpc3RzIChzZXNzaW9uSWQpIHtcbiAgICBpZiAoIXNlc3Npb25JZCkgcmV0dXJuIGZhbHNlOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIGN1cmx5XG4gICAgcmV0dXJuIHNlc3Npb25JZCA9PT0gdGhpcy5zZXNzaW9uSWQ7XG4gIH1cblxuICAvLyBtZXRob2QgcmVxdWlyZWQgYnkgTUpTT05XUCBpbiBvcmRlciB0byBkZXRlcm1pbmUgaWYgdGhlIGNvbW1hbmQgc2hvdWxkXG4gIC8vIGJlIHByb3hpZWQgZGlyZWN0bHkgdG8gdGhlIGRyaXZlclxuICBkcml2ZXJGb3JTZXNzaW9uICgvKnNlc3Npb25JZCovKSB7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsb2dFeHRyYUNhcHMgKGNhcHMpIHtcbiAgICBsZXQgZXh0cmFDYXBzID0gXy5kaWZmZXJlbmNlKF8ua2V5cyhjYXBzKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIF8ua2V5cyh0aGlzLl9jb25zdHJhaW50cykpO1xuICAgIGlmIChleHRyYUNhcHMubGVuZ3RoKSB7XG4gICAgICBsb2cud2FybihgVGhlIGZvbGxvd2luZyBjYXBhYmlsaXRpZXMgd2VyZSBwcm92aWRlZCwgYnV0IGFyZSBub3QgYCArXG4gICAgICAgICAgICAgICBgcmVjb2duaXplZCBieSBBcHBpdW06YCk7XG4gICAgICBmb3IgKGNvbnN0IGNhcCBvZiBleHRyYUNhcHMpIHtcbiAgICAgICAgbG9nLndhcm4oYCAgJHtjYXB9YCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgdmFsaWRhdGVEZXNpcmVkQ2FwcyAoY2Fwcykge1xuICAgIGlmICghdGhpcy5zaG91bGRWYWxpZGF0ZUNhcHMpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHRyeSB7XG4gICAgICB2YWxpZGF0ZUNhcHMoY2FwcywgdGhpcy5fY29uc3RyYWludHMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGxvZy5lcnJvckFuZFRocm93KG5ldyBlcnJvcnMuU2Vzc2lvbk5vdENyZWF0ZWRFcnJvcihgVGhlIGRlc2lyZWRDYXBhYmlsaXRpZXMgb2JqZWN0IHdhcyBub3QgdmFsaWQgZm9yIHRoZSBgICtcbiAgICAgICAgICAgICAgICAgICAgYGZvbGxvd2luZyByZWFzb24ocyk6ICR7ZS5tZXNzYWdlfWApKTtcbiAgICB9XG5cbiAgICB0aGlzLmxvZ0V4dHJhQ2FwcyhjYXBzKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaXNNanNvbndwUHJvdG9jb2wgKCkge1xuICAgIHJldHVybiB0aGlzLnByb3RvY29sID09PSBCYXNlRHJpdmVyLkRSSVZFUl9QUk9UT0NPTC5NSlNPTldQO1xuICB9XG5cbiAgaXNXM0NQcm90b2NvbCAoKSB7XG4gICAgcmV0dXJuIHRoaXMucHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQztcbiAgfVxuXG4gIHNldFByb3RvY29sTUpTT05XUCAoKSB7XG4gICAgdGhpcy5wcm90b2NvbCA9IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLk1KU09OV1A7XG4gIH1cblxuICBzZXRQcm90b2NvbFczQyAoKSB7XG4gICAgdGhpcy5wcm90b2NvbCA9IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQztcbiAgfVxuXG4gIC8qKlxuICAgKiBUZXN0IGNyZWF0ZVNlc3Npb24gaW5wdXRzIHRvIHNlZSBpZiB0aGlzIGlzIGEgVzNDIFNlc3Npb24gb3IgYSBNSlNPTldQIFNlc3Npb25cbiAgICovXG4gIHN0YXRpYyBkZXRlcm1pbmVQcm90b2NvbCAoZGVzaXJlZENhcGFiaWxpdGllcywgcmVxdWlyZWRDYXBhYmlsaXRpZXMsIGNhcGFiaWxpdGllcykge1xuICAgIHJldHVybiBfLmlzUGxhaW5PYmplY3QoY2FwYWJpbGl0aWVzKSA/XG4gICAgICBCYXNlRHJpdmVyLkRSSVZFUl9QUk9UT0NPTC5XM0MgOlxuICAgICAgQmFzZURyaXZlci5EUklWRVJfUFJPVE9DT0wuTUpTT05XUDtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayB3aGV0aGVyIGEgZ2l2ZW4gZmVhdHVyZSBpcyBlbmFibGVkIHZpYSBpdHMgbmFtZVxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbmFtZSAtIG5hbWUgb2YgZmVhdHVyZS9jb21tYW5kXG4gICAqXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNGZWF0dXJlRW5hYmxlZCAobmFtZSkge1xuICAgIC8vIGlmIHdlIGhhdmUgZXhwbGljaXRseSBkZW5pZWQgdGhpcyBmZWF0dXJlLCByZXR1cm4gZmFsc2UgaW1tZWRpYXRlbHlcbiAgICBpZiAodGhpcy5kZW55SW5zZWN1cmUgJiYgXy5pbmNsdWRlcyh0aGlzLmRlbnlJbnNlY3VyZSwgbmFtZSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICAvLyBpZiB3ZSBzcGVjaWZpY2FsbHkgaGF2ZSBhbGxvd2VkIHRoZSBmZWF0dXJlLCByZXR1cm4gdHJ1ZVxuICAgIGlmICh0aGlzLmFsbG93SW5zZWN1cmUgJiYgXy5pbmNsdWRlcyh0aGlzLmFsbG93SW5zZWN1cmUsIG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBvdGhlcndpc2UsIGlmIHdlJ3ZlIGdsb2JhbGx5IGFsbG93ZWQgaW5zZWN1cmUgZmVhdHVyZXMgYW5kIG5vdCBkZW5pZWRcbiAgICAvLyB0aGlzIG9uZSwgcmV0dXJuIHRydWVcbiAgICBpZiAodGhpcy5yZWxheGVkU2VjdXJpdHlFbmFibGVkKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBpZiB3ZSBoYXZlbid0IGFsbG93ZWQgYW55dGhpbmcgaW5zZWN1cmUsIHRoZW4gcmVqZWN0XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIEFzc2VydCB0aGF0IGEgZ2l2ZW4gZmVhdHVyZSBpcyBlbmFibGVkIGFuZCB0aHJvdyBhIGhlbHBmdWwgZXJyb3IgaWYgaXQnc1xuICAgKiBub3RcbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IG5hbWUgLSBuYW1lIG9mIGZlYXR1cmUvY29tbWFuZFxuICAgKi9cbiAgZW5zdXJlRmVhdHVyZUVuYWJsZWQgKG5hbWUpIHtcbiAgICBpZiAoIXRoaXMuaXNGZWF0dXJlRW5hYmxlZChuYW1lKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb3RlbnRpYWxseSBpbnNlY3VyZSBmZWF0dXJlICcke25hbWV9JyBoYXMgbm90IGJlZW4gYCArXG4gICAgICAgICAgICAgICAgICAgICAgYGVuYWJsZWQuIElmIHlvdSB3YW50IHRvIGVuYWJsZSB0aGlzIGZlYXR1cmUgYW5kIGFjY2VwdCBgICtcbiAgICAgICAgICAgICAgICAgICAgICBgdGhlIHNlY3VyaXR5IHJhbWlmaWNhdGlvbnMsIHBsZWFzZSBkbyBzbyBieSBmb2xsb3dpbmcgYCArXG4gICAgICAgICAgICAgICAgICAgICAgYHRoZSBkb2N1bWVudGVkIGluc3RydWN0aW9ucyBhdCBodHRwczovL2dpdGh1Yi5jb20vYXBwaXVtYCArXG4gICAgICAgICAgICAgICAgICAgICAgYC9hcHBpdW0vYmxvYi9tYXN0ZXIvZG9jcy9lbi93cml0aW5nLXJ1bm5pbmctYXBwaXVtL3NlY3VyaXR5Lm1kYCk7XG4gICAgfVxuICB9XG5cbiAgLy8gVGhpcyBpcyB0aGUgbWFpbiBjb21tYW5kIGhhbmRsZXIgZm9yIHRoZSBkcml2ZXIuIEl0IHdyYXBzIGNvbW1hbmRcbiAgLy8gZXhlY3V0aW9uIHdpdGggdGltZW91dCBsb2dpYywgY2hlY2tpbmcgdGhhdCB3ZSBoYXZlIGEgdmFsaWQgc2Vzc2lvbixcbiAgLy8gYW5kIGVuc3VyaW5nIHRoYXQgd2UgZXhlY3V0ZSBjb21tYW5kcyBvbmUgYXQgYSB0aW1lLiBUaGlzIG1ldGhvZCBpcyBjYWxsZWRcbiAgLy8gYnkgTUpTT05XUCdzIGV4cHJlc3Mgcm91dGVyLlxuICBhc3luYyBleGVjdXRlQ29tbWFuZCAoY21kLCAuLi5hcmdzKSB7XG4gICAgLy8gZ2V0IHN0YXJ0IHRpbWUgZm9yIHRoaXMgY29tbWFuZCwgYW5kIGxvZyBpbiBzcGVjaWFsIGNhc2VzXG4gICAgbGV0IHN0YXJ0VGltZSA9IERhdGUubm93KCk7XG4gICAgaWYgKGNtZCA9PT0gJ2NyZWF0ZVNlc3Npb24nKSB7XG4gICAgICAvLyBJZiBjcmVhdGluZyBhIHNlc3Npb24gZGV0ZXJtaW5lIGlmIFczQyBvciBNSlNPTldQIHByb3RvY29sIHdhcyByZXF1ZXN0ZWQgYW5kIHJlbWVtYmVyIHRoZSBjaG9pY2VcbiAgICAgIHRoaXMucHJvdG9jb2wgPSBCYXNlRHJpdmVyLmRldGVybWluZVByb3RvY29sKC4uLmFyZ3MpO1xuICAgICAgdGhpcy5sb2dFdmVudChFVkVOVF9TRVNTSU9OX0lOSVQpO1xuICAgIH0gZWxzZSBpZiAoY21kID09PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICAgIHRoaXMubG9nRXZlbnQoRVZFTlRfU0VTU0lPTl9RVUlUX1NUQVJUKTtcbiAgICB9XG5cbiAgICAvLyBpZiB3ZSBoYWQgYSBjb21tYW5kIHRpbWVyIHJ1bm5pbmcsIGNsZWFyIGl0IG5vdyB0aGF0IHdlJ3JlIHN0YXJ0aW5nXG4gICAgLy8gYSBuZXcgY29tbWFuZCBhbmQgc28gZG9uJ3Qgd2FudCB0byB0aW1lIG91dFxuICAgIHRoaXMuY2xlYXJOZXdDb21tYW5kVGltZW91dCgpO1xuXG4gICAgLy8gSWYgd2UgZG9uJ3QgaGF2ZSB0aGlzIGNvbW1hbmQsIGl0IG11c3Qgbm90IGJlIGltcGxlbWVudGVkXG4gICAgLy8gSWYgdGhlIHRhcmdldCBlbGVtZW50IGlzIEltYWdlRWxlbWVudCwgd2UgbXVzdCB0cnkgdG8gY2FsbCBgSW1hZ2VFbGVtZW50LmV4ZWN1dGVgIHdoaWNoIGV4aXN0IGZvbGxvd2luZyBsaW5lc1xuICAgIC8vIHNpbmNlIEltYWdlRWxlbWVudCBzdXBwb3J0cyBmZXcgY29tbWFuZHMgYnkgaXRzZWxmXG4gICAgY29uc3QgaW1nRWxJZCA9IGdldEltZ0VsRnJvbUFyZ3MoYXJncyk7XG4gICAgaWYgKCF0aGlzW2NtZF0gJiYgIWltZ0VsSWQpIHtcbiAgICAgIHRocm93IG5ldyBlcnJvcnMuTm90WWV0SW1wbGVtZW50ZWRFcnJvcigpO1xuICAgIH1cblxuICAgIGxldCByZXM7XG4gICAgaWYgKHRoaXMuaXNDb21tYW5kc1F1ZXVlRW5hYmxlZCAmJiBjbWQgIT09ICdleGVjdXRlRHJpdmVyU2NyaXB0Jykge1xuICAgICAgLy8gV2hhdCB3ZSdyZSBkb2luZyBoZXJlIGlzIHByZXR0eSBjbGV2ZXIuIHRoaXMuY3VyQ29tbWFuZCBpcyBhbHdheXNcbiAgICAgIC8vIGEgcHJvbWlzZSByZXByZXNlbnRpbmcgdGhlIGNvbW1hbmQgY3VycmVudGx5IGJlaW5nIGV4ZWN1dGVkIGJ5IHRoZVxuICAgICAgLy8gZHJpdmVyLCBvciB0aGUgbGFzdCBjb21tYW5kIGV4ZWN1dGVkIGJ5IHRoZSBkcml2ZXIgKGl0IHN0YXJ0cyBvZmYgYXNcbiAgICAgIC8vIGVzc2VudGlhbGx5IGEgcHJlLXJlc29sdmVkIHByb21pc2UpLiBXaGVuIGEgY29tbWFuZCBjb21lcyBpbiwgd2UgdGFjayBpdFxuICAgICAgLy8gdG8gdGhlIGVuZCBvZiB0aGlzLmN1ckNvbW1hbmQsIGVzc2VudGlhbGx5IHNheWluZyB3ZSB3YW50IHRvIGV4ZWN1dGUgaXRcbiAgICAgIC8vIHdoZW5ldmVyIHRoaXMuY3VyQ29tbWFuZCBpcyBkb25lLiBXZSBjYWxsIHRoaXMgbmV3IHByb21pc2UgbmV4dENvbW1hbmQsXG4gICAgICAvLyBhbmQgaXRzIHJlc29sdXRpb24gaXMgd2hhdCB3ZSB1bHRpbWF0ZWx5IHdpbGwgcmV0dXJuIHRvIHdob21ldmVyIGNhbGxlZFxuICAgICAgLy8gdXMuIE1lYW53aGlsZSwgd2UgcmVzZXQgdGhpcy5jdXJDb21tYW5kIHRvIF9iZV8gbmV4dENvbW1hbmQgKGJ1dFxuICAgICAgLy8gaWdub3JpbmcgYW55IHJlamVjdGlvbnMpLCBzbyB0aGF0IGlmIGFub3RoZXIgY29tbWFuZCBjb21lcyBpbnRvIHRoZVxuICAgICAgLy8gc2VydmVyLCBpdCBnZXRzIHRhY2tlZCBvbiB0byB0aGUgZW5kIG9mIG5leHRDb21tYW5kLiBUaHVzIHdlIGNyZWF0ZVxuICAgICAgLy8gYSBjaGFpbiBvZiBwcm9taXNlcyB0aGF0IGFjdHMgYXMgYSBxdWV1ZSB3aXRoIHNpbmdsZSBjb25jdXJyZW5jeS5cbiAgICAgIGNvbnN0IG5leHRDb21tYW5kID0gdGhpcy5jdXJDb21tYW5kLnRoZW4oKCkgPT4geyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIHByb21pc2UvcHJlZmVyLWF3YWl0LXRvLXRoZW5cbiAgICAgICAgLy8gaWYgd2UgdW5leHBlY3RlZGx5IHNodXQgZG93biwgd2UgbmVlZCB0byByZWplY3QgZXZlcnkgY29tbWFuZCBpblxuICAgICAgICAvLyB0aGUgcXVldWUgYmVmb3JlIHdlIGFjdHVhbGx5IHRyeSB0byBydW4gaXRcbiAgICAgICAgaWYgKHRoaXMuc2h1dGRvd25VbmV4cGVjdGVkbHkpIHtcbiAgICAgICAgICByZXR1cm4gQi5yZWplY3QobmV3IGVycm9ycy5Ob1N1Y2hEcml2ZXJFcnJvcignVGhlIGRyaXZlciB3YXMgdW5leHBlY3RlZGx5IHNodXQgZG93biEnKSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gV2UgYWxzbyBuZWVkIHRvIHR1cm4gdGhlIGNvbW1hbmQgaW50byBhIGNhbmNlbGxhYmxlIHByb21pc2Ugc28gaWYgd2VcbiAgICAgICAgLy8gaGF2ZSBhbiB1bmV4cGVjdGVkIHNodXRkb3duIGV2ZW50LCBmb3IgZXhhbXBsZSwgd2UgY2FuIGNhbmNlbCBpdCBmcm9tXG4gICAgICAgIC8vIG91dHNpZGUsIHJlamVjdGluZyB0aGUgY3VycmVudCBjb21tYW5kIGltbWVkaWF0ZWx5XG4gICAgICAgIGxldCByZWplY3Q7XG4gICAgICAgIHRoaXMuY3VyQ29tbWFuZENhbmNlbGxhYmxlID0gQi5yZXNvbHZlKCkudGhlbigoKSA9PiB7IC8vIGVzbGludC1kaXNhYmxlLWxpbmUgcHJvbWlzZS9wcmVmZXItYXdhaXQtdG8tdGhlblxuICAgICAgICAgIC8vIGluIG9yZGVyIHRvIGFib3J0IHRoZSBwcm9taXNlLCB3ZSBuZWVkIHRvIGhhdmUgaXQgaW4gYSByYWNlXG4gICAgICAgICAgLy8gd2l0aCBvbmUgd2UgY2FuIHJlamVjdCBmcm9tIG91dHNpZGVcbiAgICAgICAgICBjb25zdCBjYW5jZWxQcm9taXNlID0gbmV3IEIoZnVuY3Rpb24gKF8sIF9yZWplY3QpIHsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bnVzZWQtdmFyc1xuICAgICAgICAgICAgcmVqZWN0ID0gX3JlamVjdDtcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIC8vIGlmIG9uZSBvZiB0aGUgYXJncyBpcyBhbiBpbWFnZSBlbGVtZW50LCBoYW5kbGUgaXQgc2VwYXJhdGVseVxuICAgICAgICAgIHJldHVybiBCLnJhY2UoW1xuICAgICAgICAgICAgaW1nRWxJZCA/IEltYWdlRWxlbWVudC5leGVjdXRlKHRoaXMsIGNtZCwgaW1nRWxJZCwgLi4uYXJncykgOiB0aGlzW2NtZF0oLi4uYXJncyksXG4gICAgICAgICAgICBjYW5jZWxQcm9taXNlLFxuICAgICAgICAgIF0pO1xuICAgICAgICB9KTtcbiAgICAgICAgLy8gb3ZlcnJpZGUgdGhlIEIjY2FuY2VsIGZ1bmN0aW9uLCB3aGljaCBqdXN0IHR1cm5zIG9mZiBsaXN0ZW5lcnNcbiAgICAgICAgdGhpcy5jdXJDb21tYW5kQ2FuY2VsbGFibGUuY2FuY2VsID0gZnVuY3Rpb24gY2FuY2VsIChlcnIpIHtcbiAgICAgICAgICBpZiAocmVqZWN0KSB7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzLmN1ckNvbW1hbmRDYW5jZWxsYWJsZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5jdXJDb21tYW5kID0gbmV4dENvbW1hbmQuY2F0Y2goKCkgPT4ge30pO1xuICAgICAgcmVzID0gYXdhaXQgbmV4dENvbW1hbmQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIHdlJ3ZlIGdvdHRlbiBoZXJlIGJlY2F1c2Ugd2UncmUgcnVubmluZyBleGVjdXRlRHJpdmVyU2NyaXB0LCB3ZVxuICAgICAgLy8gbmV2ZXIgd2FudCB0byBhZGQgdGhlIGNvbW1hbmQgdG8gdGhlIHF1ZXVlLiBUaGlzIGlzIGJlY2F1c2UgaXQgcnVuc1xuICAgICAgLy8gb3RoZXIgY29tbWFuZHMgX2luc2lkZV8gaXQsIHNvIHRob3NlIGNvbW1hbmRzIHdvdWxkIG5ldmVyIHN0YXJ0IGlmIHdlXG4gICAgICAvLyB3ZXJlIHdhaXRpbmcgZm9yIGV4ZWN1dGVEcml2ZXJTY3JpcHQgdG8gZmluaXNoLiBTbyBpdCBpcyBhIHNwZWNpYWxcbiAgICAgIC8vIGNhc2UuXG4gICAgICBpZiAodGhpcy5zaHV0ZG93blVuZXhwZWN0ZWRseSkge1xuICAgICAgICB0aHJvdyBuZXcgZXJyb3JzLk5vU3VjaERyaXZlckVycm9yKCdUaGUgZHJpdmVyIHdhcyB1bmV4cGVjdGVkbHkgc2h1dCBkb3duIScpO1xuICAgICAgfVxuICAgICAgcmVzID0gYXdhaXQgdGhpc1tjbWRdKC4uLmFyZ3MpO1xuICAgIH1cblxuICAgIC8vIGlmIHdlIGhhdmUgc2V0IGEgbmV3IGNvbW1hbmQgdGltZW91dCAod2hpY2ggaXMgdGhlIGRlZmF1bHQpLCBzdGFydCBhXG4gICAgLy8gdGltZXIgb25jZSB3ZSd2ZSBmaW5pc2hlZCBleGVjdXRpbmcgdGhpcyBjb21tYW5kLiBJZiB3ZSBkb24ndCBjbGVhclxuICAgIC8vIHRoZSB0aW1lciAod2hpY2ggaXMgZG9uZSB3aGVuIGEgbmV3IGNvbW1hbmQgY29tZXMgaW4pLCB3ZSB3aWxsIHRyaWdnZXJcbiAgICAvLyBhdXRvbWF0aWMgc2Vzc2lvbiBkZWxldGlvbiBpbiB0aGlzLm9uQ29tbWFuZFRpbWVvdXQuIE9mIGNvdXJzZSB3ZSBkb24ndFxuICAgIC8vIHdhbnQgdG8gdHJpZ2dlciB0aGUgdGltZXIgd2hlbiB0aGUgdXNlciBpcyBzaHV0dGluZyBkb3duIHRoZSBzZXNzaW9uXG4gICAgLy8gaW50ZW50aW9uYWxseVxuICAgIGlmICh0aGlzLmlzQ29tbWFuZHNRdWV1ZUVuYWJsZWQgJiYgY21kICE9PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICAgIC8vIHJlc2V0aW5nIGV4aXN0aW5nIHRpbWVvdXRcbiAgICAgIHRoaXMuc3RhcnROZXdDb21tYW5kVGltZW91dCgpO1xuICAgIH1cblxuICAgIC8vIGxvZyB0aW1pbmcgaW5mb3JtYXRpb24gYWJvdXQgdGhpcyBjb21tYW5kXG4gICAgY29uc3QgZW5kVGltZSA9IERhdGUubm93KCk7XG4gICAgdGhpcy5fZXZlbnRIaXN0b3J5LmNvbW1hbmRzLnB1c2goe2NtZCwgc3RhcnRUaW1lLCBlbmRUaW1lfSk7XG4gICAgaWYgKGNtZCA9PT0gJ2NyZWF0ZVNlc3Npb24nKSB7XG4gICAgICB0aGlzLmxvZ0V2ZW50KEVWRU5UX1NFU1NJT05fU1RBUlQpO1xuICAgIH0gZWxzZSBpZiAoY21kID09PSAnZGVsZXRlU2Vzc2lvbicpIHtcbiAgICAgIHRoaXMubG9nRXZlbnQoRVZFTlRfU0VTU0lPTl9RVUlUX0RPTkUpO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG4gIH1cblxuICBhc3luYyBzdGFydFVuZXhwZWN0ZWRTaHV0ZG93biAoZXJyID0gbmV3IGVycm9ycy5Ob1N1Y2hEcml2ZXJFcnJvcignVGhlIGRyaXZlciB3YXMgdW5leHBlY3RlZGx5IHNodXQgZG93biEnKSkge1xuICAgIHRoaXMudW5leHBlY3RlZFNodXRkb3duRGVmZXJyZWQucmVqZWN0KGVycik7IC8vIGFsbG93IG90aGVycyB0byBsaXN0ZW4gZm9yIHRoaXNcbiAgICB0aGlzLnNodXRkb3duVW5leHBlY3RlZGx5ID0gdHJ1ZTtcbiAgICBhd2FpdCB0aGlzLmRlbGV0ZVNlc3Npb24odGhpcy5zZXNzaW9uSWQpO1xuICAgIHRoaXMuc2h1dGRvd25VbmV4cGVjdGVkbHkgPSBmYWxzZTtcbiAgICB0aGlzLmN1ckNvbW1hbmRDYW5jZWxsYWJsZS5jYW5jZWwoZXJyKTtcbiAgfVxuXG4gIHZhbGlkYXRlTG9jYXRvclN0cmF0ZWd5IChzdHJhdGVneSwgd2ViQ29udGV4dCA9IGZhbHNlKSB7XG4gICAgbGV0IHZhbGlkU3RyYXRlZ2llcyA9IHRoaXMubG9jYXRvclN0cmF0ZWdpZXM7XG4gICAgbG9nLmRlYnVnKGBWYWxpZCBsb2NhdG9yIHN0cmF0ZWdpZXMgZm9yIHRoaXMgcmVxdWVzdDogJHt2YWxpZFN0cmF0ZWdpZXMuam9pbignLCAnKX1gKTtcblxuICAgIGlmICh3ZWJDb250ZXh0KSB7XG4gICAgICB2YWxpZFN0cmF0ZWdpZXMgPSB2YWxpZFN0cmF0ZWdpZXMuY29uY2F0KHRoaXMud2ViTG9jYXRvclN0cmF0ZWdpZXMpO1xuICAgIH1cblxuICAgIGlmICghXy5pbmNsdWRlcyh2YWxpZFN0cmF0ZWdpZXMsIHN0cmF0ZWd5KSkge1xuICAgICAgdGhyb3cgbmV3IGVycm9ycy5JbnZhbGlkU2VsZWN0b3JFcnJvcihgTG9jYXRvciBTdHJhdGVneSAnJHtzdHJhdGVneX0nIGlzIG5vdCBzdXBwb3J0ZWQgZm9yIHRoaXMgc2Vzc2lvbmApO1xuICAgIH1cbiAgfVxuXG4gIC8qXG4gICAqIFJlc3RhcnQgdGhlIHNlc3Npb24gd2l0aCB0aGUgb3JpZ2luYWwgY2FwcyxcbiAgICogcHJlc2VydmluZyB0aGUgdGltZW91dCBjb25maWcuXG4gICAqL1xuICBhc3luYyByZXNldCAoKSB7XG4gICAgbG9nLmRlYnVnKCdSZXNldHRpbmcgYXBwIG1pZC1zZXNzaW9uJyk7XG4gICAgbG9nLmRlYnVnKCdSdW5uaW5nIGdlbmVyaWMgZnVsbCByZXNldCcpO1xuXG4gICAgLy8gcHJlc2VydmluZyBzdGF0ZVxuICAgIGxldCBjdXJyZW50Q29uZmlnID0ge307XG4gICAgZm9yIChsZXQgcHJvcGVydHkgb2YgWydpbXBsaWNpdFdhaXRNcycsICduZXdDb21tYW5kVGltZW91dE1zJywgJ3Nlc3Npb25JZCcsICdyZXNldE9uVW5leHBlY3RlZFNodXRkb3duJ10pIHtcbiAgICAgIGN1cnJlbnRDb25maWdbcHJvcGVydHldID0gdGhpc1twcm9wZXJ0eV07XG4gICAgfVxuXG4gICAgLy8gV2UgYWxzbyBuZWVkIHRvIHByZXNlcnZlIHRoZSB1bmV4cGVjdGVkIHNodXRkb3duLCBhbmQgbWFrZSBzdXJlIGl0IGlzIG5vdCBjYW5jZWxsZWQgZHVyaW5nIHJlc2V0LlxuICAgIHRoaXMucmVzZXRPblVuZXhwZWN0ZWRTaHV0ZG93biA9ICgpID0+IHt9O1xuXG4gICAgLy8gQ29uc3RydWN0IHRoZSBhcmd1bWVudHMgZm9yIGNyZWF0ZVNlc3Npb24gZGVwZW5kaW5nIG9uIHRoZSBwcm90b2NvbCB0eXBlXG4gICAgY29uc3QgYXJncyA9IHRoaXMucHJvdG9jb2wgPT09IEJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MLlczQyA/XG4gICAgICBbdW5kZWZpbmVkLCB1bmRlZmluZWQsIHthbHdheXNNYXRjaDogdGhpcy5jYXBzLCBmaXJzdE1hdGNoOiBbe31dfV0gOlxuICAgICAgW3RoaXMuY2Fwc107XG5cbiAgICB0cnkge1xuICAgICAgYXdhaXQgdGhpcy5kZWxldGVTZXNzaW9uKHRoaXMuc2Vzc2lvbklkKTtcbiAgICAgIGxvZy5kZWJ1ZygnUmVzdGFydGluZyBhcHAnKTtcbiAgICAgIGF3YWl0IHRoaXMuY3JlYXRlU2Vzc2lvbiguLi5hcmdzKTtcbiAgICB9IGZpbmFsbHkge1xuICAgICAgLy8gYWx3YXlzIHJlc3RvcmUgc3RhdGUuXG4gICAgICBmb3IgKGxldCBba2V5LCB2YWx1ZV0gb2YgXy50b1BhaXJzKGN1cnJlbnRDb25maWcpKSB7XG4gICAgICAgIHRoaXNba2V5XSA9IHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLmNsZWFyTmV3Q29tbWFuZFRpbWVvdXQoKTtcbiAgfVxuXG4gIGFzeW5jIGdldFN3aXBlT3B0aW9ucyAoZ2VzdHVyZXMsIHRvdWNoQ291bnQgPSAxKSB7XG4gICAgbGV0IHN0YXJ0WCA9IHRoaXMuaGVscGVycy5nZXRDb29yZERlZmF1bHQoZ2VzdHVyZXNbMF0ub3B0aW9ucy54KSxcbiAgICAgICAgc3RhcnRZID0gdGhpcy5oZWxwZXJzLmdldENvb3JkRGVmYXVsdChnZXN0dXJlc1swXS5vcHRpb25zLnkpLFxuICAgICAgICBlbmRYID0gdGhpcy5oZWxwZXJzLmdldENvb3JkRGVmYXVsdChnZXN0dXJlc1syXS5vcHRpb25zLngpLFxuICAgICAgICBlbmRZID0gdGhpcy5oZWxwZXJzLmdldENvb3JkRGVmYXVsdChnZXN0dXJlc1syXS5vcHRpb25zLnkpLFxuICAgICAgICBkdXJhdGlvbiA9IHRoaXMuaGVscGVycy5nZXRTd2lwZVRvdWNoRHVyYXRpb24oZ2VzdHVyZXNbMV0pLFxuICAgICAgICBlbGVtZW50ID0gZ2VzdHVyZXNbMF0ub3B0aW9ucy5lbGVtZW50LFxuICAgICAgICBkZXN0RWxlbWVudCA9IGdlc3R1cmVzWzJdLm9wdGlvbnMuZWxlbWVudCB8fCBnZXN0dXJlc1swXS5vcHRpb25zLmVsZW1lbnQ7XG5cbiAgICAvLyB0aGVyZSdzIG5vIGRlc3RpbmF0aW9uIGVsZW1lbnQgaGFuZGxpbmcgaW4gYm9vdHN0cmFwIGFuZCBzaW5jZSBpdCBhcHBsaWVzIHRvIGFsbCBwbGF0Zm9ybXMsIHdlIGhhbmRsZSBpdCBoZXJlXG4gICAgaWYgKHV0aWwuaGFzVmFsdWUoZGVzdEVsZW1lbnQpKSB7XG4gICAgICBsZXQgbG9jUmVzdWx0ID0gYXdhaXQgdGhpcy5nZXRMb2NhdGlvbkluVmlldyhkZXN0RWxlbWVudCk7XG4gICAgICBsZXQgc2l6ZVJlc3VsdCA9IGF3YWl0IHRoaXMuZ2V0U2l6ZShkZXN0RWxlbWVudCk7XG4gICAgICBsZXQgb2Zmc2V0WCA9IChNYXRoLmFicyhlbmRYKSA8IDEgJiYgTWF0aC5hYnMoZW5kWCkgPiAwKSA/IHNpemVSZXN1bHQud2lkdGggKiBlbmRYIDogZW5kWDtcbiAgICAgIGxldCBvZmZzZXRZID0gKE1hdGguYWJzKGVuZFkpIDwgMSAmJiBNYXRoLmFicyhlbmRZKSA+IDApID8gc2l6ZVJlc3VsdC5oZWlnaHQgKiBlbmRZIDogZW5kWTtcbiAgICAgIGVuZFggPSBsb2NSZXN1bHQueCArIG9mZnNldFg7XG4gICAgICBlbmRZID0gbG9jUmVzdWx0LnkgKyBvZmZzZXRZO1xuICAgICAgLy8gaWYgdGhlIHRhcmdldCBlbGVtZW50IHdhcyBwcm92aWRlZCwgdGhlIGNvb3JkaW5hdGVzIGZvciB0aGUgZGVzdGluYXRpb24gbmVlZCB0byBiZSByZWxhdGl2ZSB0byBpdC5cbiAgICAgIGlmICh1dGlsLmhhc1ZhbHVlKGVsZW1lbnQpKSB7XG4gICAgICAgIGxldCBmaXJzdEVsTG9jYXRpb24gPSBhd2FpdCB0aGlzLmdldExvY2F0aW9uSW5WaWV3KGVsZW1lbnQpO1xuICAgICAgICBlbmRYIC09IGZpcnN0RWxMb2NhdGlvbi54O1xuICAgICAgICBlbmRZIC09IGZpcnN0RWxMb2NhdGlvbi55O1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBjbGllbnRzIGFyZSByZXNwb25zaWJsZSB0byB1c2UgdGhlc2Ugb3B0aW9ucyBjb3JyZWN0bHlcbiAgICByZXR1cm4ge3N0YXJ0WCwgc3RhcnRZLCBlbmRYLCBlbmRZLCBkdXJhdGlvbiwgdG91Y2hDb3VudCwgZWxlbWVudH07XG4gIH1cblxuICBwcm94eUFjdGl2ZSAoLyogc2Vzc2lvbklkICovKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZ2V0UHJveHlBdm9pZExpc3QgKC8qIHNlc3Npb25JZCAqLykge1xuICAgIHJldHVybiBbXTtcbiAgfVxuXG4gIGNhblByb3h5ICgvKiBzZXNzaW9uSWQgKi8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogV2hldGhlciBhIGdpdmVuIGNvbW1hbmQgcm91dGUgKGV4cHJlc3NlZCBhcyBtZXRob2QgYW5kIHVybCkgc2hvdWxkIG5vdCBiZVxuICAgKiBwcm94aWVkIGFjY29yZGluZyB0byB0aGlzIGRyaXZlclxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gc2Vzc2lvbklkIC0gdGhlIGN1cnJlbnQgc2Vzc2lvbklkIChpbiBjYXNlIHRoZSBkcml2ZXIgcnVuc1xuICAgKiBtdWx0aXBsZSBzZXNzaW9uIGlkcyBhbmQgcmVxdWlyZXMgaXQpLiBUaGlzIGlzIG5vdCB1c2VkIGluIHRoaXMgbWV0aG9kIGJ1dFxuICAgKiBzaG91bGQgYmUgbWFkZSBhdmFpbGFibGUgdG8gb3ZlcnJpZGRlbiBtZXRob2RzLlxuICAgKiBAcGFyYW0ge3N0cmluZ30gbWV0aG9kIC0gSFRUUCBtZXRob2Qgb2YgdGhlIHJvdXRlXG4gICAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgLSB1cmwgb2YgdGhlIHJvdXRlXG4gICAqXG4gICAqIEByZXR1cm5zIHtib29sZWFufSAtIHdoZXRoZXIgdGhlIHJvdXRlIHNob3VsZCBiZSBhdm9pZGVkXG4gICAqL1xuICBwcm94eVJvdXRlSXNBdm9pZGVkIChzZXNzaW9uSWQsIG1ldGhvZCwgdXJsKSB7XG4gICAgZm9yIChsZXQgYXZvaWRTY2hlbWEgb2YgdGhpcy5nZXRQcm94eUF2b2lkTGlzdChzZXNzaW9uSWQpKSB7XG4gICAgICBpZiAoIV8uaXNBcnJheShhdm9pZFNjaGVtYSkgfHwgYXZvaWRTY2hlbWEubGVuZ3RoICE9PSAyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUHJveHkgYXZvaWRhbmNlIG11c3QgYmUgYSBsaXN0IG9mIHBhaXJzJyk7XG4gICAgICB9XG4gICAgICBsZXQgW2F2b2lkTWV0aG9kLCBhdm9pZFBhdGhSZWdleF0gPSBhdm9pZFNjaGVtYTtcbiAgICAgIGlmICghXy5pbmNsdWRlcyhbJ0dFVCcsICdQT1NUJywgJ0RFTEVURSddLCBhdm9pZE1ldGhvZCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnJlY29nbml6ZWQgcHJveHkgYXZvaWRhbmNlIG1ldGhvZCAnJHthdm9pZE1ldGhvZH0nYCk7XG4gICAgICB9XG4gICAgICBpZiAoIV8uaXNSZWdFeHAoYXZvaWRQYXRoUmVnZXgpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignUHJveHkgYXZvaWRhbmNlIHBhdGggbXVzdCBiZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbicpO1xuICAgICAgfVxuICAgICAgbGV0IG5vcm1hbGl6ZWRVcmwgPSB1cmwucmVwbGFjZSgvXlxcL3dkXFwvaHViLywgJycpO1xuICAgICAgaWYgKGF2b2lkTWV0aG9kID09PSBtZXRob2QgJiYgYXZvaWRQYXRoUmVnZXgudGVzdChub3JtYWxpemVkVXJsKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgYWRkTWFuYWdlZERyaXZlciAoZHJpdmVyKSB7XG4gICAgdGhpcy5tYW5hZ2VkRHJpdmVycy5wdXNoKGRyaXZlcik7XG4gIH1cblxuICBnZXRNYW5hZ2VkRHJpdmVycyAoKSB7XG4gICAgcmV0dXJuIHRoaXMubWFuYWdlZERyaXZlcnM7XG4gIH1cblxuICByZWdpc3RlckltYWdlRWxlbWVudCAoaW1nRWwpIHtcbiAgICB0aGlzLl9pbWdFbENhY2hlLnNldChpbWdFbC5pZCwgaW1nRWwpO1xuICAgIGNvbnN0IHByb3RvS2V5ID0gdGhpcy5pc1czQ1Byb3RvY29sKCkgPyBXM0NfRUxFTUVOVF9LRVkgOiBNSlNPTldQX0VMRU1FTlRfS0VZO1xuICAgIHJldHVybiBpbWdFbC5hc0VsZW1lbnQocHJvdG9LZXkpO1xuICB9XG59XG5cbkJhc2VEcml2ZXIuRFJJVkVSX1BST1RPQ09MID0ge1xuICBXM0M6ICdXM0MnLFxuICBNSlNPTldQOiAnTUpTT05XUCcsXG59O1xuXG5mb3IgKGxldCBbY21kLCBmbl0gb2YgXy50b1BhaXJzKGNvbW1hbmRzKSkge1xuICBCYXNlRHJpdmVyLnByb3RvdHlwZVtjbWRdID0gZm47XG59XG5cbmV4cG9ydCB7IEJhc2VEcml2ZXIgfTtcbmV4cG9ydCBkZWZhdWx0IEJhc2VEcml2ZXI7XG4iXSwiZmlsZSI6ImxpYi9iYXNlZHJpdmVyL2RyaXZlci5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLiJ9
