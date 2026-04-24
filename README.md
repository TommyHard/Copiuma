<div align="left">
  <kbd> 🇺🇸 <font color="#8A2BE2">English</font> </kbd> • <a href="README.ru.md"><kbd> 🇷🇺 Русский </kbd></a>
</div>

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
