# INK HOUSE — Telegram Mini App для записи в тату-салон

Стек: React + TypeScript + Vite, FastAPI, SQLAlchemy async, SQLite для локальной разработки, aiogram 3.

## Что реализовано
- Каталог мастеров и услуг.
- Свободные слоты с учётом длительности услуги и рабочего расписания.
- Создание заявки с серверной проверкой пересечений.
- Загрузка референса (JPG/PNG/WebP, до 8 МБ).
- «Мои записи», отмена записи; API для переноса.
- Проверка Telegram WebApp `initData` на backend.
- Локальный режим тестирования в браузере.
- Telegram-уведомления клиенту и администраторам при заявке и смене статуса.
- Админ-панель: подтверждение/отмена заявок, добавление/скрытие мастеров и услуг, редактирование расписания.

## Важное: почему приложение открывается в браузере
Это не отдельный обычный сайт вместо Telegram Mini App. Mini App технически является веб-приложением: Telegram открывает его страницу во встроенном браузере (WebView). Поэтому во время разработки мы запускаем фронтенд локально и проверяем его в обычном браузере — так проще видеть ошибки и отлаживать интерфейс.

Для реального запуска внутри Telegram нужен публичный HTTPS-адрес фронтенда, привязанный к боту через BotFather/настройки Mini App. `http://localhost:5173` доступен только на твоём компьютере и не подходит как адрес для пользователей Telegram. Бэкенд при этом отдельно обслуживает API-запросы.

## Подготовка
1. Распакуй архив и открой папку `ink-house` в PyCharm.
2. Скопируй `.env.example` в `.env` в корне проекта.
3. Для локального запуска оставь `DATABASE_URL=sqlite+aiosqlite:///./ink_house.db`.
4. Установи Python 3.11+ и Node.js LTS.

## Backend — терминал PyCharm №1 (PowerShell)
```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
Проверка: http://localhost:8000/api/health и http://localhost:8000/docs

## Демо-данные — терминал №2
```powershell
cd backend
.venv\Scripts\activate
python seed.py
```
Скрипт добавляет 2 демо-мастеров, 2 демо-услуги и расписание. Повторный запуск теперь не добавит дубликаты, если мастера уже есть в базе. Демо-цены нужно заменить на реальные.

## Frontend — терминал №3
```powershell
cd frontend
npm install
npm run dev
```
Открой URL Vite, обычно http://localhost:5173. Локальный browser mode использует test ID `100001`, поэтому `.env` должен содержать `ADMIN_TELEGRAM_IDS=100001` и `ALLOW_DEV_AUTH=true`.

## Telegram bot
Создай бота через @BotFather, вставь токен в `BOT_TOKEN` в корневом `.env`. В отдельном терминале:
```powershell
cd bot
pip install -r requirements.txt
python main.py
```
Чтобы открыть Mini App в Telegram, `MINI_APP_URL` должен быть публичным HTTPS URL. Для локального тестирования используй HTTPS-туннель или разверни приложение на сервере. Пользователь должен начать чат с ботом, иначе бот не сможет первым отправить уведомление.

## Перед публикацией — обязательно
- Установи `ALLOW_DEV_AUTH=false`; локальный `X-Dev-Telegram-User-ID` — только для тестов.
- Укажи настоящий `BOT_TOKEN`, HTTPS `MINI_APP_URL`, точный `CORS_ORIGINS`, `STUDIO_TIMEZONE` и реальные `ADMIN_TELEGRAM_IDS`.
- Не публикуй `.env` и токен.
- SQLite подходит для локального MVP. Для реальных одновременных бронирований используй PostgreSQL и транзакционную блокировку/ограничение пересечения интервалов: обычная проверка до вставки сама по себе не исключает гонку при одновременных запросах.
- Файлы сейчас хранятся на локальном диске; для продакшена перенеси их в S3-совместимое хранилище и добавь политику удаления/доступа.
- Добавь политику обработки персональных данных, резервные копии, rate limiting, журнал действий администратора и миграции Alembic.
- Это MVP для разработки и демонстрации, а не независимый аудит безопасности.


## Demo catalog and local connection troubleshooting

Run `python seed.py` from the `backend` directory after the backend dependencies are installed. The command is safe to rerun and prepares three demo masters (Анна Морозова, Максим Волков, Елизавета Соколова), six demo services and their weekly working hours. Demo prices and profiles are placeholders to replace with the studio's real data.

For local development, Vite proxies `/api` and `/uploads` to `http://127.0.0.1:8000`, so frontend and backend can run in separate terminals without CORS configuration mismatches. Keep both terminals running. The backend terminal must show `Application startup complete`; test it at `http://127.0.0.1:8000/docs`. If the UI says the server cannot be reached, first fix any backend traceback before troubleshooting the frontend.
