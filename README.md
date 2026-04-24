[English](#english) | [Русский](#русский)

<a id="english"></a>
# Copiuma

Copiuma is a full-featured streaming audio service designed for music playback, playlist management, and high-quality audio delivery. Alongside classic streaming capabilities, the platform features a specialized social listening module for real-time synchronized playback.

## Architecture & Core Features

The system is built on a client-server model that handles both standard media delivery and complex real-time state synchronization.

* **Core Streaming Engine:** Manages standard audio consumption, handling high-quality stream delivery, audio buffering, offline mode support, and personalized playlist generation.
* **Media Catalog & Persistence:** Track metadata, playlist structures, and audio file URLs are mapped and managed through a relational database model using code-first migrations.
* **Live Synchronized Sessions (Rooms):** An advanced feature module that splits users into specific roles — **DJ** (broadcast controller) and **Listener** (consumer) — for shared listening experiences.
* **Real-Time State Resolution:** For live sessions, the server acts as the strict source of truth. The system handles complex asynchronous events to maintain audio sync, including custom logic to resolve conflicts (e.g., handling a Listener's local pause event concurrently with a DJ's global `seek` command).

## Technology Stack

### Backend & Core
* **C# / .NET:** The primary language and framework for the backend application.
* **ASP.NET Core:** Used for building the API endpoints, handling HTTP requests, and routing.
* **Entity Framework Core (EF Core):** The chosen ORM for database interactions, entity mapping, and managing schema changes via `dotnet ef` migrations.

### Real-Time Communication
* **SignalR / WebSockets:** Powers the low-latency, bidirectional communication required for broadcasting playback events (Play, Pause, Sync, Seek) during live sessions.

### Database
* **PostgreSQL:** The primary relational database used to store user profiles, room configurations, track metadata, and playlist links.

### Infrastructure & DevOps
* **Docker:** Containerizes the application to ensure a consistent runtime environment.
* **Docker Compose:** Orchestrates the multi-container setup, linking the .NET application container with the isolated `postgres-data` container.

### Frontend
* **HTML5 / Web Audio API:** Handles the native browser media playback, audio buffering, and integration with the backend synchronization events.

---

<a id="русский"></a>
# Copiuma

Copiuma — это полнофункциональный стриминговый аудиосервис, предназначенный для прослушивания музыки, управления плейлистами и обеспечения высокого качества звука. Помимо классических возможностей стриминга, платформа включает продвинутый модуль социального прослушивания для синхронизации воспроизведения в реальном времени.

## Архитектура и основные функции

Система построена на клиент-серверной модели, которая обрабатывает как стандартную доставку медиаконтента, так и сложную синхронизацию состояний в реальном времени.

* **Ядро стриминга:** Отвечает за стандартное потребление аудио, обеспечивая доставку потока в высоком качестве, буферизацию, поддержку офлайн-режима и работу с персонализированными плейлистами.
* **Управление каталогом и хранение данных:** Метаданные треков, структуры плейлистов и URL-адреса аудиофайлов управляются в реляционной базе данных с использованием подхода code-first и миграций.
* **Синхронные live-сессии (Комнаты):** Продвинутая функция совместного прослушивания, разделяющая пользователей на роли — **DJ** (управление вещанием) и **Слушатель**.
* **Разрешение состояний в реальном времени:** В live-сессиях бэкенд выступает строгим источником истины. Система обрабатывает сложные асинхронные события для поддержания синхронизации звука, включая логику разрешения конфликтов (например, обработка локальной паузы слушателя параллельно с глобальной командой `seek` (перемотка) от диджея).

## Технологический стек

### Бэкенд и ядро
* **C# / .NET:** Основной язык и фреймворк для бэкенд-части приложения.
* **ASP.NET Core:** Используется для создания API-эндпоинтов, обработки HTTP-запросов и маршрутизации.
* **Entity Framework Core (EF Core):** Выбранная ORM для взаимодействия с базой данных, маппинга сущностей и управления изменениями схемы через миграции `dotnet ef`.

### Связь в реальном времени
* **SignalR / WebSockets:** Обеспечивает двунаправленную связь с низкой задержкой, необходимую для трансляции событий воспроизведения (Play, Pause, Sync, Seek) во время live-сессий.

### База данных
* **PostgreSQL:** Основная реляционная база данных для хранения профилей пользователей, конфигураций комнат, метаданных треков и связей плейлистов.

### Инфраструктура и DevOps
* **Docker:** Контейнеризация приложения для обеспечения консистентной среды выполнения.
* **Docker Compose:** Оркестрация мультиконтейнерной сборки, связывающая контейнер .NET-приложения с изолированным контейнером `postgres-data`.

### Фронтенд
* **HTML5 / Web Audio API:** Отвечает за нативное воспроизведение медиа в браузере, буферизацию звука и интеграцию с бэкенд-событиями синхронизации.
