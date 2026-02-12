'use strict';
// Назначение: точка входа общего пакета.
// Модули: constants, taskFields, mapUtils, types, taskFormSchema
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __exportStar =
  (this && this.__exportStar) ||
  function (m, exports) {
    for (var p in m)
      if (p !== 'default' && !Object.prototype.hasOwnProperty.call(exports, p))
        __createBinding(exports, m, p);
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.taskFormSchema =
  exports.roundCoord =
  exports.precheckLocations =
  exports.parsePointInput =
  exports.normalizePointsString =
  exports.latLngToLonLat =
  exports.isValidLon =
  exports.isValidLat =
  exports.haversineDistanceMeters =
  exports.DEFAULT_PRECISION_DECIMALS =
  exports.DEFAULT_MAX_SEGMENT_M =
  exports.QueueJobName =
  exports.QueueName =
  exports.generateMultiRouteLink =
  exports.generateRouteLink =
  exports.extractCoords =
  exports.taskFields =
    void 0;
__exportStar(require('./constants'), exports);
var taskFields_1 = require('./taskFields');
Object.defineProperty(exports, 'taskFields', {
  enumerable: true,
  get: function () {
    return taskFields_1.taskFields;
  },
});
var mapUtils_1 = require('./mapUtils');
Object.defineProperty(exports, 'extractCoords', {
  enumerable: true,
  get: function () {
    return mapUtils_1.extractCoords;
  },
});
Object.defineProperty(exports, 'generateRouteLink', {
  enumerable: true,
  get: function () {
    return mapUtils_1.generateRouteLink;
  },
});
Object.defineProperty(exports, 'generateMultiRouteLink', {
  enumerable: true,
  get: function () {
    return mapUtils_1.generateMultiRouteLink;
  },
});
var queues_1 = require('./queues');
Object.defineProperty(exports, 'QueueName', {
  enumerable: true,
  get: function () {
    return queues_1.QueueName;
  },
});
Object.defineProperty(exports, 'QueueJobName', {
  enumerable: true,
  get: function () {
    return queues_1.QueueJobName;
  },
});
var geo_1 = require('./geo');
Object.defineProperty(exports, 'DEFAULT_MAX_SEGMENT_M', {
  enumerable: true,
  get: function () {
    return geo_1.DEFAULT_MAX_SEGMENT_M;
  },
});
Object.defineProperty(exports, 'DEFAULT_PRECISION_DECIMALS', {
  enumerable: true,
  get: function () {
    return geo_1.DEFAULT_PRECISION_DECIMALS;
  },
});
Object.defineProperty(exports, 'haversineDistanceMeters', {
  enumerable: true,
  get: function () {
    return geo_1.haversineDistanceMeters;
  },
});
Object.defineProperty(exports, 'isValidLat', {
  enumerable: true,
  get: function () {
    return geo_1.isValidLat;
  },
});
Object.defineProperty(exports, 'isValidLon', {
  enumerable: true,
  get: function () {
    return geo_1.isValidLon;
  },
});
Object.defineProperty(exports, 'latLngToLonLat', {
  enumerable: true,
  get: function () {
    return geo_1.latLngToLonLat;
  },
});
Object.defineProperty(exports, 'normalizePointsString', {
  enumerable: true,
  get: function () {
    return geo_1.normalizePointsString;
  },
});
Object.defineProperty(exports, 'parsePointInput', {
  enumerable: true,
  get: function () {
    return geo_1.parsePointInput;
  },
});
Object.defineProperty(exports, 'precheckLocations', {
  enumerable: true,
  get: function () {
    return geo_1.precheckLocations;
  },
});
Object.defineProperty(exports, 'roundCoord', {
  enumerable: true,
  get: function () {
    return geo_1.roundCoord;
  },
});
var taskForm_schema_json_1 = require('./taskForm.schema.json');
Object.defineProperty(exports, 'taskFormSchema', {
  enumerable: true,
  get: function () {
    return __importDefault(taskForm_schema_json_1).default;
  },
});
