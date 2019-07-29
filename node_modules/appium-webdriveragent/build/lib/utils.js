"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.fileCompare = fileCompare;

require("source-map-support/register");

var _streamEqual = _interopRequireDefault(require("stream-equal"));

var _appiumSupport = require("appium-support");

async function fileCompare(file1, file2) {
  try {
    return await (0, _streamEqual.default)(_appiumSupport.fs.createReadStream(file1), _appiumSupport.fs.createReadStream(file2));
  } catch (err) {
    if (err.code === 'ENOENT') {
      return false;
    }

    throw err;
  }
}require('source-map-support').install();


//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImxpYi91dGlscy5qcyJdLCJuYW1lcyI6WyJmaWxlQ29tcGFyZSIsImZpbGUxIiwiZmlsZTIiLCJmcyIsImNyZWF0ZVJlYWRTdHJlYW0iLCJlcnIiLCJjb2RlIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBOztBQUNBOztBQUdBLGVBQWVBLFdBQWYsQ0FBNEJDLEtBQTVCLEVBQW1DQyxLQUFuQyxFQUEwQztBQUN4QyxNQUFJO0FBQ0YsV0FBTyxNQUFNLDBCQUFZQyxrQkFBR0MsZ0JBQUgsQ0FBb0JILEtBQXBCLENBQVosRUFBd0NFLGtCQUFHQyxnQkFBSCxDQUFvQkYsS0FBcEIsQ0FBeEMsQ0FBYjtBQUNELEdBRkQsQ0FFRSxPQUFPRyxHQUFQLEVBQVk7QUFDWixRQUFJQSxHQUFHLENBQUNDLElBQUosS0FBYSxRQUFqQixFQUEyQjtBQUV6QixhQUFPLEtBQVA7QUFDRDs7QUFDRCxVQUFNRCxHQUFOO0FBQ0Q7QUFDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBzdHJlYW1FcXVhbCBmcm9tICdzdHJlYW0tZXF1YWwnO1xuaW1wb3J0IHsgZnMgfSBmcm9tICdhcHBpdW0tc3VwcG9ydCc7XG5cblxuYXN5bmMgZnVuY3Rpb24gZmlsZUNvbXBhcmUgKGZpbGUxLCBmaWxlMikge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCBzdHJlYW1FcXVhbChmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUxKSwgZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlMikpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBpZiAoZXJyLmNvZGUgPT09ICdFTk9FTlQnKSB7XG4gICAgICAvLyBvbmUgb2YgdGhlIGZpbGVzIGRvZXMgbm90IGV4aXN0LCBzbyB0aGV5IGNhbm5vdCBiZSB0aGUgc2FtZVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICB0aHJvdyBlcnI7XG4gIH1cbn1cblxuZXhwb3J0IHsgZmlsZUNvbXBhcmUgfTtcbiJdLCJmaWxlIjoibGliL3V0aWxzLmpzIiwic291cmNlUm9vdCI6Ii4uLy4uIn0=
