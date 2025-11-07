"use strict";
// Назначение: агрегирование метрик маршрутных планов для аналитики.
// Основные модули: mongoose, shared, db/models/routePlan
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRoutePlanAnalytics = fetchRoutePlanAnalytics;
const shared_1 = require("shared");
const routePlan_1 = require("../db/models/routePlan");
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;
const dateFormatter = new Intl.DateTimeFormat('ru-UA', {
    timeZone: shared_1.PROJECT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
});
const extractParts = (date) => {
    const parts = dateFormatter.formatToParts(date);
    const year = Number(parts.find((part) => part.type === 'year')?.value ?? 0);
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? 1);
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? 1);
    return { year, month, day };
};
const toDateKey = (date) => {
    const { year, month, day } = extractParts(date);
    const m = month.toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${year}-${m}-${d}`;
};
const fromDateKey = (key) => {
    const [yearStr, monthStr, dayStr] = key.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr) - 1;
    const day = Number(dayStr);
    return new Date(Date.UTC(year, month, day));
};
const roundKm = (value) => Number(value.toFixed(1));
const roundLoad = (value) => Number(value.toFixed(2));
const roundRate = (value) => Number(value.toFixed(4));
async function fetchRoutePlanAnalytics(filters) {
    const now = new Date();
    const safeTo = filters.to && Number.isFinite(filters.to.getTime()) ? filters.to : now;
    const startCandidate = filters.from && Number.isFinite(filters.from.getTime())
        ? filters.from
        : new Date(safeTo.getTime() - (DEFAULT_RANGE_DAYS - 1) * DAY_MS);
    const periodFrom = startCandidate;
    const periodTo = safeTo;
    const startKey = toDateKey(periodFrom);
    const endKey = toDateKey(periodTo);
    const rangeFrom = fromDateKey(startKey);
    const rangeTo = new Date(fromDateKey(endKey).getTime() + DAY_MS - 1);
    const pipeline = [
        {
            $addFields: {
                effectiveDate: {
                    $ifNull: ['$completedAt', { $ifNull: ['$approvedAt', '$createdAt'] }],
                },
            },
        },
    ];
    const match = {};
    const dateRange = {};
    if (filters.status) {
        match.status = filters.status;
    }
    if (rangeFrom) {
        dateRange.$gte = rangeFrom;
    }
    if (rangeTo) {
        dateRange.$lte = rangeTo;
    }
    if (Object.keys(dateRange).length) {
        match.effectiveDate = dateRange;
    }
    if (Object.keys(match).length) {
        pipeline.push({ $match: match });
    }
    pipeline.push({
        $project: {
            _id: 0,
            effectiveDate: 1,
            status: 1,
            metrics: 1,
            'routes.metrics.load': 1,
            'routes.stops.kind': 1,
            'routes.stops.delayMinutes': 1,
        },
    }, { $sort: { effectiveDate: 1 } });
    const plans = await routePlan_1.RoutePlan.aggregate(pipeline).allowDiskUse(true);
    const mileageByDay = new Map();
    const loadByDay = new Map();
    const slaByDay = new Map();
    let totalMileage = 0;
    let totalLoad = 0;
    let totalLoadCount = 0;
    let totalOnTimeStops = 0;
    let totalStops = 0;
    for (const plan of plans) {
        const date = plan.effectiveDate ? new Date(plan.effectiveDate) : null;
        if (!date)
            continue;
        const key = toDateKey(date);
        const distance = Number(plan.metrics?.totalDistanceKm ?? 0);
        if (Number.isFinite(distance) && distance > 0) {
            totalMileage += distance;
            mileageByDay.set(key, (mileageByDay.get(key) ?? 0) + distance);
        }
        const routes = Array.isArray(plan.routes) ? plan.routes : [];
        for (const route of routes) {
            const load = Number(route.metrics?.load ?? Number.NaN);
            if (Number.isFinite(load) && load > 0) {
                const entry = loadByDay.get(key) ?? { sum: 0, count: 0 };
                entry.sum += load;
                entry.count += 1;
                loadByDay.set(key, entry);
                totalLoad += load;
                totalLoadCount += 1;
            }
        }
        const stops = routes.flatMap((route) => Array.isArray(route.stops) ? route.stops : []);
        const dropoffs = stops.filter((stop) => stop.kind === 'finish');
        if (dropoffs.length) {
            let onTime = 0;
            for (const stop of dropoffs) {
                const delay = Number(stop.delayMinutes ?? 0);
                if (!Number.isFinite(delay) || delay <= 0) {
                    onTime += 1;
                }
            }
            const entry = slaByDay.get(key) ?? { onTime: 0, total: 0 };
            entry.onTime += onTime;
            entry.total += dropoffs.length;
            slaByDay.set(key, entry);
            totalOnTimeStops += onTime;
            totalStops += dropoffs.length;
        }
    }
    const resultKeys = [];
    const visited = new Set();
    const startDateUtc = fromDateKey(startKey);
    const endDateUtc = fromDateKey(endKey);
    for (let time = startDateUtc.getTime(); time <= endDateUtc.getTime(); time += DAY_MS) {
        const key = toDateKey(new Date(time));
        if (!visited.has(key)) {
            resultKeys.push(key);
            visited.add(key);
        }
    }
    for (const key of mileageByDay.keys()) {
        if (!visited.has(key)) {
            resultKeys.push(key);
            visited.add(key);
        }
    }
    resultKeys.sort();
    const mileageSeries = resultKeys.map((key) => {
        const value = mileageByDay.get(key) ?? 0;
        return { date: key, value: value ? roundKm(value) : 0 };
    });
    const loadSeries = resultKeys.map((key) => {
        const entry = loadByDay.get(key);
        if (!entry || entry.count === 0) {
            return { date: key, value: null };
        }
        return { date: key, value: roundLoad(entry.sum / entry.count) };
    });
    const slaSeries = resultKeys.map((key) => {
        const entry = slaByDay.get(key);
        if (!entry || entry.total === 0) {
            return { date: key, onTime: 0, total: 0, rate: null };
        }
        const rate = entry.onTime / entry.total;
        return { date: key, onTime: entry.onTime, total: entry.total, rate: roundRate(rate) };
    });
    const summary = {
        period: {
            from: startKey,
            to: endKey,
        },
        mileage: {
            total: totalMileage ? roundKm(totalMileage) : 0,
            byPeriod: mileageSeries,
        },
        load: {
            average: totalLoadCount > 0 ? roundLoad(totalLoad / totalLoadCount) : null,
            byPeriod: loadSeries,
        },
        sla: {
            average: totalStops > 0 ? roundRate(totalOnTimeStops / totalStops) : null,
            byPeriod: slaSeries,
        },
    };
    return summary;
}
