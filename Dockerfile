FROM python:3.10-slim

WORKDIR /app

COPY pyproject.toml README.md .
RUN pip install --no-cache-dir .

COPY frontend/ frontend/
COPY pfm/ pfm/

COPY config.toml .

EXPOSE 8000

CMD ["pfm", "serve"]
