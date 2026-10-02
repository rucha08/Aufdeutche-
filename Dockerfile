FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY static ./static
ENV AD_DB_PATH=/data/auf_deutsch.db
VOLUME /data
EXPOSE 8000
# Hosts like Render pass the port in $PORT; locally it falls back to 8000.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips="*"
