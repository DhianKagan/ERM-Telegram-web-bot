# Назначение файла: нагрузочное тестирование API через Locust.
# Модули: HttpUser, task
from locust import HttpUser, task, between

class QuickTest(HttpUser):
    wait_time = between(1, 2)

    @task
    def tasks(self):
        self.client.get("/api/v1/tasks")
