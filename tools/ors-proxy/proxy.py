# tools/ors-proxy/proxy.py
"""Прокси OpenRouteService с кешированием в Redis и проверкой токена.
Добавлена поддержка OSRM-style endpoint /route/v1/<profile>/<coords>
(например: /route/v1/driving/30.708021,46.3939888;30.7124526,46.4206201)
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import redis
import requests
from flask import Flask, Response, jsonify, request

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

ORS_API_KEY = os.getenv("ORS_API_KEY")
REDIS_URL = os.getenv("REDIS_URL")
CACHE_TTL_SEC = int(os.getenv("CACHE_TTL_SEC", "86400"))
PROXY_TOKEN = os.getenv("PROXY_TOKEN")

if not ORS_API_KEY:
    raise RuntimeError("Требуется переменная окружения ORS_API_KEY")
if not REDIS_URL:
    raise RuntimeError("Требуется переменная окружения REDIS_URL")
if not PROXY_TOKEN:
    raise RuntimeError("Требуется переменная окружения PROXY_TOKEN")

app = Flask(__name__)

redis_client = redis.from_url(REDIS_URL, decode_responses=True)
requests_session = requests.Session()
ORS_BASE_URL = os.getenv("ORS_BASE_URL", "https://api.openrouteservice.org")
LOCK_TTL_SEC = 30
LOCK_SLEEP_SEC = 0.25
LOCK_MAX_WAIT_SEC = 5

# Маппинг OSRM профилей в ORS профили
OSRM_TO_ORS_PROFILE = {
    "driving": "driving-car",
    "driving-car": "driving-car",
    "cycling": "cycling-regular",
    "cycling-regular": "cycling-regular",
    "walking": "foot-walking",
    "foot": "foot-walking",
    "foot-walking": "foot-walking",
}


def _error(message: str, status: int = 400) -> Response:
    payload = {"error": message}
    return Response(json.dumps(payload), status=status, mimetype="application/json")


def _parse_point(raw: str) -> Optional[List[float]]:
    parts = [chunk.strip() for chunk in raw.split(",")]
    if len(parts) != 2:
        return None
    try:
        lon = float(parts[0])
        lat = float(parts[1])
    except ValueError:
        return None
    return [lon, lat]


def _parse_locations(raw: str) -> Optional[List[List[float]]]:
    separator = ";" if ";" in raw else "|" if "|" in raw else None
    coordinates = raw.split(separator) if separator else [raw]
    result: List[List[float]] = []
    for item in coordinates:
        point = _parse_point(item)
        if not point:
            return None
        result.append(point)
    return result if len(result) >= 2 else None


def _cache_key(name: str, payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha1(serialized.encode("utf-8")).hexdigest()
    return f"{name}:{digest}"


def _get_cached(key: str) -> Optional[str]:
    try:
        return redis_client.get(f"cache:{key}")
    except redis.RedisError:
        logger.warning("Не удалось прочитать кеш Redis", exc_info=True)
        return None


def _store_cache(key: str, value: str) -> None:
    try:
        redis_client.setex(f"cache:{key}", CACHE_TTL_SEC, value)
    except redis.RedisError:
        logger.warning("Не удалось сохранить ответ в кеш Redis", exc_info=True)


def _release_lock(lock_key: str) -> None:
    try:
        redis_client.delete(lock_key)
    except redis.RedisError:
        logger.warning("Не удалось снять блокировку в Redis", exc_info=True)


def _acquire_lock(cache_key: str) -> bool:
    lock_key = f"lock:{cache_key}"
    try:
        acquired = redis_client.set(lock_key, "1", nx=True, ex=LOCK_TTL_SEC)
        return bool(acquired)
    except redis.RedisError:
        logger.warning("Не удалось установить блокировку в Redis", exc_info=True)
        return True


def _wait_for_cache(cache_key: str) -> Optional[str]:
    deadline = time.time() + LOCK_MAX_WAIT_SEC
    while time.time() < deadline:
        cached = _get_cached(cache_key)
        if cached:
            return cached
        time.sleep(LOCK_SLEEP_SEC)
    return None


def _require_token() -> Optional[Response]:
    token = request.headers.get("X-Proxy-Token")
    if token != PROXY_TOKEN:
        return _error("Требуется корректный токен", status=401)
    return None


def _forward_response(resp: requests.Response) -> Response:
    content_type = resp.headers.get("Content-Type", "application/json")
    return Response(resp.content, status=resp.status_code, mimetype=content_type)


@app.route("/health", methods=["GET"])
def health() -> Response:
    return jsonify({"status": "ok"})


@app.route("/route", methods=["GET"])
def route() -> Response:
    auth_error = _require_token()
    if auth_error:
        return auth_error

    start_raw = request.args.get("start")
    end_raw = request.args.get("end")
    profile = request.args.get("profile", "driving-car")

    if not start_raw or not end_raw:
        return _error("Параметры start и end обязательны", status=400)

    start_point = _parse_point(start_raw)
    end_point = _parse_point(end_raw)
    if not start_point or not end_point:
        return _error("Координаты должны быть в формате lon,lat", status=400)

    cache_key = _cache_key(
        "route", {"profile": profile, "start": start_point, "end": end_point}
    )

    cached = _get_cached(cache_key)
    if cached:
        return Response(cached, mimetype="application/json")

    lock_key = f"lock:{cache_key}"
    lock_acquired = _acquire_lock(cache_key)
    if not lock_acquired:
        waited = _wait_for_cache(cache_key)
        if waited:
            return Response(waited, mimetype="application/json")

    url = f"{ORS_BASE_URL}/v2/directions/{profile}"
    try:
        resp = requests_session.get(
            url,
            params={"start": start_raw, "end": end_raw},
            headers={"Authorization": ORS_API_KEY},
            timeout=30,
        )
    except requests.RequestException:
        _release_lock(lock_key)
        logger.exception("Ошибка запроса к OpenRouteService")
        return _error("Сервис маршрутизации недоступен", status=502)

    if resp.ok:
        _store_cache(cache_key, resp.text)
    _release_lock(lock_key)
    return _forward_response(resp)


@app.route("/route/v1/<profile>/<coords>", methods=["GET"])
def route_osrm_style(profile: str, coords: str) -> Response:
    """
    Поддержка OSRM-style пути:
    /route/v1/<profile>/<lon,lat;lon2,lat2;...>
    Преобразует в вызов ORS /v2/directions/{ors_profile} и возвращает OSRM-like ответ.
    """
    auth_error = _require_token()
    if auth_error:
        return auth_error

    # парсим координаты в формате lon,lat;lon2,lat2;...
    locations = _parse_locations(coords)
    if not locations:
        return _error("Координаты должны быть в формате lon,lat;lon2,lat2;...", status=400)

    # сопоставляем профиль
    ors_profile = OSRM_TO_ORS_PROFILE.get(profile, None)
    if not ors_profile:
        # если неизвестен профиль, пробуем использовать как есть
        ors_profile = profile

    # кешируем запрос по профилю и координатам
    cache_key = _cache_key("route_v1", {"profile": ors_profile, "locations": locations})
    cached = _get_cached(cache_key)
    if cached:
        return Response(cached, mimetype="application/json")

    lock_key = f"lock:{cache_key}"
    lock_acquired = _acquire_lock(cache_key)
    if not lock_acquired:
        waited = _wait_for_cache(cache_key)
        if waited:
            return Response(waited, mimetype="application/json")

    # Постим запрос в ORS (POST /v2/directions/{profile})
    url = f"{ORS_BASE_URL}/v2/directions/{ors_profile}"
    payload = {
        "coordinates": locations,
        # включаем инструкции и просим geometry (подберите geometry_format по желанию)
        "instructions": True,
        "units": "m",
        # При желании можно явно указать format геометрии,
        # ORS поддерживает geometry_format: "polyline" / "encodedpolyline" в зависимости от версии.
        # Оставим дефолт, и вернём geometry как оно есть.
    }
    headers = {"Authorization": ORS_API_KEY, "Content-Type": "application/json"}

    try:
        resp = requests_session.post(url, json=payload, headers=headers, timeout=60)
    except requests.RequestException:
        _release_lock(lock_key)
        logger.exception("Ошибка запроса к OpenRouteService (directions)")
        return _error("Сервис маршрутизации недоступен", status=502)

    if not resp.ok:
        _release_lock(lock_key)
        # пробрасываем ошибку ORS дальше (меняя формат)
        return _forward_response(resp)

    try:
        ors_json = resp.json()
    except Exception:
        _release_lock(lock_key)
        logger.exception("Не удалось распарсить ответ от ORS")
        return _error("Не удалось распарсить ответ от OpenRouteService", status=502)

    # Берём основной маршрут
    route = None
    if "routes" in ors_json and isinstance(ors_json["routes"], list) and len(ors_json["routes"]) > 0:
        route = ors_json["routes"][0]

    if not route:
        _release_lock(lock_key)
        # кешируем пустой ответ
        result_body = json.dumps({"code": "NoRoute", "routes": []})
        _store_cache(cache_key, result_body)
        return Response(result_body, mimetype="application/json")

    # Попробуем извлечь distance и duration
    # В ORS v2 обычно summary есть в route['summary'] либо суммируем по segments
    distance = None
    duration = None
    try:
        summary = route.get("summary", {})
        distance = summary.get("distance")
        duration = summary.get("duration")
        # Если summary пуст, суммируем сегменты
        if distance is None or duration is None:
            segments = route.get("segments", []) or []
            if segments:
                distance = sum(seg.get("distance", 0) for seg in segments)
                duration = sum(seg.get("duration", 0) for seg in segments)
    except Exception:
        distance = None
        duration = None

    geometry = route.get("geometry")

    # Формируем waypoints (минимально)
    waypoints = []
    for idx, loc in enumerate(locations):
        # loc = [lon, lat]
        waypoints.append({"location": loc, "name": ""})

    # Строим минимально OSRM-like ответ
    osrm_like: Dict[str, Any] = {
        "code": "Ok",
        "routes": [
            {
                "distance": distance,
                "duration": duration,
                "geometry": geometry,
                # при необходимости можно вложить legs/steps, но для большинства клиентов
                # достаточно distance/duration/geometry
            }
        ],
        "waypoints": waypoints,
    }

    result_body = json.dumps(osrm_like)
    if resp.ok:
        _store_cache(cache_key, result_body)
    _release_lock(lock_key)
    return Response(result_body, mimetype="application/json")


@app.route("/table", methods=["GET", "POST"])
def table() -> Response:
    auth_error = _require_token()
    if auth_error:
        return auth_error

    profile = request.args.get("profile", "driving-car")
    metrics_raw = request.args.get("metrics", "distance,duration")
    metrics = [metric.strip() for metric in metrics_raw.split(",") if metric.strip()]

    if request.method == "POST":
        body = request.get_json(silent=True) or {}
        locations = body.get("locations")
    else:
        locations_raw = request.args.get("locations")
        if not locations_raw:
            return _error("Параметр locations обязателен", status=400)
        locations = _parse_locations(locations_raw)

    if not locations or not isinstance(locations, list):
        return _error("Не удалось разобрать список координат", status=400)

    cache_key = _cache_key(
        "table", {"profile": profile, "metrics": metrics, "locations": locations}
    )

    cached = _get_cached(cache_key)
    if cached:
        return Response(cached, mimetype="application/json")

    lock_key = f"lock:{cache_key}"
    lock_acquired = _acquire_lock(cache_key)
    if not lock_acquired:
        waited = _wait_for_cache(cache_key)
        if waited:
            return Response(waited, mimetype="application/json")

    url = f"{ORS_BASE_URL}/v2/matrix/{profile}"
    payload = {"locations": locations, "metrics": metrics}
    try:
        resp = requests_session.post(
            url,
            json=payload,
            headers={"Authorization": ORS_API_KEY},
            timeout=60,
        )
    except requests.RequestException:
        _release_lock(lock_key)
        logger.exception("Ошибка запроса матрицы в OpenRouteService")
        return _error("Сервис построения матрицы недоступен", status=502)

    if resp.ok:
        _store_cache(cache_key, resp.text)
    _release_lock(lock_key)
    return _forward_response(resp)


@app.route("/search", methods=["GET"])
def search() -> Response:
    """
    Проксирование геокодирования через OpenRouteService.
    Требует заголовок X-Proxy-Token (проверяется _require_token).
    Кеширует ответ в Redis и возвращает Nominatim-подобный массив,
    содержащий lat/lon/display_name в случае успешного парсинга.
    """
    auth_error = _require_token()
    if auth_error:
        return auth_error

    q = request.args.get("q") or request.args.get("text")
    if not q:
        return _error("Параметр q (или text) обязателен", status=400)

    cache_key = _cache_key("geocode", {"q": q})
    cached = _get_cached(cache_key)
    if cached:
        return Response(cached, mimetype="application/json")

    lock_acquired = _acquire_lock(cache_key)
    if not lock_acquired:
        waited = _wait_for_cache(cache_key)
        if waited:
            return Response(waited, mimetype="application/json")

    url = f"{ORS_BASE_URL}/geocode/search"
    try:
        resp = requests_session.get(
            url,
            params={"text": q, "size": 1},
            headers={"Authorization": ORS_API_KEY},
            timeout=30,
        )
    except requests.RequestException:
        logger.exception("Ошибка запроса к OpenRouteService (geocode)")
        _release_lock(cache_key)
        return _error("Сервис геокодирования недоступен", status=502)

    result_body = None
    if resp.ok:
        try:
            payload = resp.json()
            features = payload.get("features") or []
            if features and isinstance(features, list):
                feat = features[0]
                coords = feat.get("geometry", {}).get("coordinates", [])
                props = feat.get("properties", {}) or {}
                if coords and len(coords) >= 2:
                    lon = coords[0]
                    lat = coords[1]
                    display = props.get("label") or props.get("name") or props.get("locality") or props.get("region") or ""
                    nominatim_like = [{
                        "lat": str(lat),
                        "lon": str(lon),
                        "display_name": display,
                        "properties": props
                    }]
                    result_body = json.dumps(nominatim_like)
            # Если не удалось сделать Nominatim-like ответ, отдадим оригинальный ORS-ответ
            if result_body is None:
                result_body = resp.text
            _store_cache(cache_key, result_body)
        except Exception:
            logger.exception("Не удалось распарсить ответ геокодера")
            result_body = resp.text
            _store_cache(cache_key, result_body)
    _release_lock(cache_key)
    return Response(result_body or json.dumps([]), mimetype="application/json")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
