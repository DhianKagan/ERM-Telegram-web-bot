FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends build-essential \
    && rm -rf /var/lib/apt/lists/*
COPY tools/ors-proxy/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY tools/ors-proxy/ .
ENV PYTHONUNBUFFERED=1
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "proxy:app"]
