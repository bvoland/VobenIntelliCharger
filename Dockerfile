FROM node:24-bookworm-slim
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY dist ./dist
COPY src/web ./src/web
COPY embedded ./embedded
COPY config.example ./config.example

RUN pip3 install --break-system-packages --no-cache-dir \
  -r /app/embedded/growatt-reader/requirements.txt \
  -r /app/embedded/mg-reader/requirements.txt

EXPOSE 8098

ENV PORT=8098
ENV HOST=0.0.0.0
ENV PYTHON_BIN=python3

CMD ["node", "dist/index.js"]
