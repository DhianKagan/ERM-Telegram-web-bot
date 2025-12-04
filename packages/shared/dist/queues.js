'use strict';
// Назначение: общие типы и имена очередей BullMQ для фоновых задач
// Основные модули: BullMQ
Object.defineProperty(exports, '__esModule', { value: true });
exports.QueueJobName = exports.QueueName = void 0;
var QueueName;
(function (QueueName) {
  QueueName['LogisticsGeocoding'] = 'logistics:geocoding';
  QueueName['LogisticsRouting'] = 'logistics:routing';
  QueueName['DeadLetter'] = 'logistics:dead-letter';
})(QueueName || (exports.QueueName = QueueName = {}));
var QueueJobName;
(function (QueueJobName) {
  QueueJobName['GeocodeAddress'] = 'geocode-address';
  QueueJobName['RouteDistance'] = 'route-distance';
  QueueJobName['DeadLetter'] = 'dead-letter';
})(QueueJobName || (exports.QueueJobName = QueueJobName = {}));
