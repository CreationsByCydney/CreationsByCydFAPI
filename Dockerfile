FROM python:3.10-slim

WORKDIR /app

COPY pyproject.toml README.md .
COPY pfm/ pfm/
RUN pip install --no-cache-dir .

COPY frontend/ frontend/
COPY config.toml .

EXPOSE 8000

CMD ["pfm", "serve"]
