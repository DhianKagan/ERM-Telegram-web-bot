#!/usr/bin/env python3
"""
Назначение: прототип решения VRP через OR-Tools для интеграции с Node.js адаптером.
Модули: json, sys
"""
import json
import sys
try:
    from ortools.constraint_solver import pywrapcp, routing_enums_pb2  # type: ignore
except ImportError:  # pragma: no cover
    pywrapcp = None
    routing_enums_pb2 = None


def _fallback_solution(tasks):
    route = [task["id"] for task in tasks]
    return {
        "routes": [route],
        "total_distance_km": 0,
        "total_duration_minutes": sum(task.get("service_minutes", 0) for task in tasks),
        "warnings": [
            "OR-Tools недоступен, возвращаем маршрут в порядке ввода.",
        ],
    }


def solve(payload):
    tasks = payload.get("tasks", [])
    if not tasks:
        return {
            "routes": [],
            "total_distance_km": 0,
            "total_duration_minutes": 0,
            "warnings": ["Список задач пустой"],
        }

    if pywrapcp is None or routing_enums_pb2 is None:
        return _fallback_solution(tasks)

    distance_matrix = payload["distance_matrix"]
    service_minutes = [task.get("service_minutes", 0) for task in tasks]
    time_windows = payload.get("time_windows")
    vehicle_count = payload.get("vehicle_count", 1)
    depot_index = payload.get("depot_index", 0)
    average_speed_kmph = payload.get("average_speed_kmph", 30)
    try:
        average_speed_kmph = float(average_speed_kmph)
    except (TypeError, ValueError):
        average_speed_kmph = 30.0
    if average_speed_kmph <= 0:
        average_speed_kmph = 30.0

    def distance_to_minutes(distance_meters: float) -> int:
        minutes = (distance_meters * 60.0) / (1000.0 * average_speed_kmph)
        return int(round(minutes))

    manager = pywrapcp.RoutingIndexManager(len(distance_matrix), vehicle_count, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int(distance_matrix[from_node][to_node])

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    demand = [task.get("demand", 0) for task in tasks]
    vehicle_capacity = payload.get("vehicle_capacity")
    if vehicle_capacity is not None:
        def demand_callback(from_index):
            node = manager.IndexToNode(from_index)
            return demand[node]
        demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
        routing.AddDimensionWithVehicleCapacity(
            demand_callback_index,
            0,
            [vehicle_capacity] * vehicle_count,
            True,
            "Capacity",
        )

    time_dimension = None
    if time_windows:
        def time_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel_minutes = distance_to_minutes(distance_matrix[from_node][to_node])
            return int(travel_minutes + service_minutes[from_node])
        time_callback_index = routing.RegisterTransitCallback(time_callback)
        routing.AddDimension(
            time_callback_index,
            60,
            24 * 60,
            False,
            "Time",
        )
        time_dimension = routing.GetDimensionOrDie("Time")
        for node, window in enumerate(time_windows):
            index = manager.NodeToIndex(node)
            time_dimension.CumulVar(index).SetRange(window[0], window[1])

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_parameters.time_limit.FromSeconds(payload.get("time_limit_seconds", 5))

    solution = routing.SolveWithParameters(search_parameters)
    if not solution:
        return {
            "routes": [],
            "total_distance_km": 0,
            "total_duration_minutes": 0,
            "warnings": ["OR-Tools не нашёл решение"],
        }

    routes = []
    total_distance = 0
    total_duration = 0
    for vehicle_id in range(vehicle_count):
        index = routing.Start(vehicle_id)
        vehicle_route = []
        route_duration = 0
        while not routing.IsEnd(index):
            node_index = manager.IndexToNode(index)
            vehicle_route.append(tasks[node_index]["id"])
            next_index = solution.Value(routing.NextVar(index))
            total_distance += routing.GetArcCostForVehicle(index, next_index, vehicle_id)
            if time_dimension is not None:
                total_duration = max(total_duration, solution.Value(time_dimension.CumulVar(index)))
            else:
                route_duration += service_minutes[node_index]
                next_node_index = manager.IndexToNode(next_index) if not routing.IsEnd(next_index) else depot_index
                route_duration += distance_to_minutes(distance_matrix[node_index][next_node_index])
            index = next_index
        routes.append(vehicle_route)
        if time_dimension is None:
            total_duration = max(total_duration, route_duration)

    return {
        "routes": routes,
        "total_distance_km": round(total_distance / 1000, 3),
        "total_duration_minutes": total_duration,
        "warnings": [],
    }


def main() -> int:
    payload = json.loads(sys.stdin.read() or "{}")
    result = solve(payload)
    sys.stdout.write(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
