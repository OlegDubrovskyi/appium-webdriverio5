"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

require("source-map-support/register");

var _session = _interopRequireDefault(require("./session"));

var _settings = _interopRequireDefault(require("./settings"));

var _timeout = _interopRequireDefault(require("./timeout"));

var _find = _interopRequireDefault(require("./find"));

var _log = _interopRequireDefault(require("./log"));

var _images = _interopRequireDefault(require("./images"));

var _execute = _interopRequireDefault(require("./execute"));

let commands = {};
Object.assign(commands, _session.default, _settings.default, _timeout.default, _find.default, _log.default, _images.default, _execute.default);
var _default = commands;
exports.default = _default;require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi9iYXNlZHJpdmVyL2NvbW1hbmRzL2luZGV4LmpzIl0sIm5hbWVzIjpbImNvbW1hbmRzIiwiT2JqZWN0IiwiYXNzaWduIiwic2Vzc2lvbkNtZHMiLCJzZXR0aW5nc0NtZHMiLCJ0aW1lb3V0Q21kcyIsImZpbmRDbWRzIiwibG9nQ21kcyIsImltYWdlc0NtZHMiLCJleGVjdXRlQ21kcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFHQSxJQUFJQSxRQUFRLEdBQUcsRUFBZjtBQUVBQyxNQUFNLENBQUNDLE1BQVAsQ0FDRUYsUUFERixFQUVFRyxnQkFGRixFQUdFQyxpQkFIRixFQUlFQyxnQkFKRixFQUtFQyxhQUxGLEVBTUVDLFlBTkYsRUFPRUMsZUFQRixFQVFFQyxnQkFSRjtlQVllVCxRIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHNlc3Npb25DbWRzIGZyb20gJy4vc2Vzc2lvbic7XG5pbXBvcnQgc2V0dGluZ3NDbWRzIGZyb20gJy4vc2V0dGluZ3MnO1xuaW1wb3J0IHRpbWVvdXRDbWRzIGZyb20gJy4vdGltZW91dCc7XG5pbXBvcnQgZmluZENtZHMgZnJvbSAnLi9maW5kJztcbmltcG9ydCBsb2dDbWRzIGZyb20gJy4vbG9nJztcbmltcG9ydCBpbWFnZXNDbWRzIGZyb20gJy4vaW1hZ2VzJztcbmltcG9ydCBleGVjdXRlQ21kcyBmcm9tICcuL2V4ZWN1dGUnO1xuXG5cbmxldCBjb21tYW5kcyA9IHt9O1xuXG5PYmplY3QuYXNzaWduKFxuICBjb21tYW5kcyxcbiAgc2Vzc2lvbkNtZHMsXG4gIHNldHRpbmdzQ21kcyxcbiAgdGltZW91dENtZHMsXG4gIGZpbmRDbWRzLFxuICBsb2dDbWRzLFxuICBpbWFnZXNDbWRzLFxuICBleGVjdXRlQ21kcyxcbiAgLy8gYWRkIG90aGVyIGNvbW1hbmQgdHlwZXMgaGVyZVxuKTtcblxuZXhwb3J0IGRlZmF1bHQgY29tbWFuZHM7XG4iXSwiZmlsZSI6ImxpYi9iYXNlZHJpdmVyL2NvbW1hbmRzL2luZGV4LmpzIiwic291cmNlUm9vdCI6Ii4uLy4uLy4uLy4uIn0=
