namespace Identity.API.Models;

/// <summary>
/// Иерархия способностей:
///   User       — слушает, лайкает, фолловит, плейлисты — всё, кроме upload
///   Artist     — всё что User + загрузка треков, создание альбомов
///   Moderator  — read-only-доступ к администрированию (DMCA reports, shadowban статусы)
///   Admin      — полный доступ
/// </summary>
public enum UserRole
{
    User = 0,
    Artist = 1,
    Moderator = 2,
    Admin = 3
}