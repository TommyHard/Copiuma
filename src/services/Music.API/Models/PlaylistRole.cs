namespace Music.API.Models;

public enum PlaylistRole
{
    Owner,   // Владелец: полный доступ, удаление плейлиста
    Editor,  // Редактор: может добавлять/удалять треки
    Viewer   // Слушатель: только просмотр и прослушивание
}