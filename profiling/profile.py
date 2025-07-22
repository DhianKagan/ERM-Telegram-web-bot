# Назначение файла: профилирование API запросов через cProfile.
# Модули: requests, cProfile, pstats
import cProfile
import pstats
import requests

def run():
    for _ in range(10):
        requests.get("http://localhost:3000/api/v1/tasks")

if __name__ == "__main__":
    profiler = cProfile.Profile()
    profiler.enable()
    run()
    profiler.disable()
    stats = pstats.Stats(profiler)
    stats.sort_stats("cumtime").print_stats(10)
