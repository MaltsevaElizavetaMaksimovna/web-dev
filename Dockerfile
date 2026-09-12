# Образ для запуска проекта «Поисковый каталог».
# Основной способ запуска — npm start; контейнер является дополнительной возможностью.

FROM node:20-alpine

# Пакеты, необходимые для сборки модуля better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Сначала копируются файлы зависимостей: слой кешируется между сборками
COPY package*.json ./
RUN npm install --omit=dev

# Затем исходный код приложения
COPY . .

# Папки для базы данных и журналов
RUN mkdir -p data logs

EXPOSE 3000

# Заполнение базы выполняется при первом запуске, затем стартует сервер
CMD ["sh", "-c", "npm run seed && npm start"]
