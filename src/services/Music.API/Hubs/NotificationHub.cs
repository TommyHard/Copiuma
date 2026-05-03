using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Music.API.Services;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace Music.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly RoomStore _rooms;
    private readonly ILogger<NotificationHub> _log;

    /// <summary>
    /// connectionId -> roomId. Нужен для быстрого LeaveRoom при disconnect
    /// </summary>
    private static readonly ConcurrentDictionary<string, string> _connectionRooms = new();

    /// <summary>
    /// roomId -> (connectionId -> ParticipantInfo). Полный учёт участников комнаты,
    /// чтобы новый joiner получил уже существующий список и чтобы при множественных
    /// соединениях одного юзера ParticipantLeft не дублировал-дёргал список
    /// </summary>
    private static readonly ConcurrentDictionary<string, ConcurrentDictionary<string, ParticipantInfo>> _roomParticipants = new();

    private record ParticipantInfo(string UserId, string UserName, bool IsDj);

    public NotificationHub(RoomStore rooms, ILogger<NotificationHub> log)
    {
        _rooms = rooms;
        _log = log;
    }

    private string UserId =>
        Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ??
        throw new HubException("userId отсутствует в токене.");

    private string UserName =>
        Context.User?.FindFirstValue("DisplayName") ??
        Context.User?.FindFirstValue(ClaimTypes.Email) ??
        "anonymous";

    public override async Task OnConnectedAsync()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{UserId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await HandleLeaveRoom();
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinRoom(string roomId, bool requestDj)
    {
        await HandleLeaveRoom();

        var state = await _rooms.GetOrCreateAsync(roomId);

        var isDj = false;
        if (requestDj && (string.IsNullOrEmpty(state.DjUserId) || state.DjUserId == UserId))
        {
            state = state with { DjUserId = UserId, DjName = UserName };
            isDj = true;
            await _rooms.SetAsync(state);
        }
        else if (requestDj)
        {
            await Clients.Caller.SendAsync("DjRejected", state.DjName);
        }

        var participants = _roomParticipants.GetOrAdd(roomId,
            _ => new ConcurrentDictionary<string, ParticipantInfo>());

        // Снимок текущих участников ДО добавления нового
        // Дедупим по userId — у одного юзера может быть несколько вкладок
        var existing = participants.Values
            .GroupBy(p => p.UserId)
            .Select(g => g.FirstOrDefault(x => x.IsDj) ?? g.First())
            .Select(p => new { userId = p.UserId, userName = p.UserName, isDj = p.IsDj })
            .ToList();

        _connectionRooms[Context.ConnectionId] = roomId;
        participants[Context.ConnectionId] = new ParticipantInfo(UserId, UserName, isDj);
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(roomId));

        await Clients.Caller.SendAsync("RoomJoined", isDj);
        await Clients.Caller.SendAsync("ParticipantList", existing);

        if (!isDj && state.CurrentTrackId.HasValue)
        {
            var pos = state.CurrentPosition;
            if (state.IsPlaying) pos += (DateTime.UtcNow - state.LastUpdatedAt).TotalSeconds;

            await Clients.Caller.SendAsync("SyncCurrentTrack",
                state.CurrentTrackId.Value, state.CurrentTitle, state.CurrentArtist, pos, state.IsPlaying);
        }

        // Шлём ParticipantJoined только если у этого юзера это первое соединение в комнате
        // (иначе F5 / вторая вкладка одного и того же юзера дёргает других участников)
        var alreadyHere = existing.Any(p => p.userId == UserId);
        if (!alreadyHere)
        {
            await BroadcastParticipant(roomId, "ParticipantJoined", isDj);
        }
    }

    public Task LeaveRoom() => HandleLeaveRoom();

    private async Task HandleLeaveRoom()
    {
        if (!_connectionRooms.TryRemove(Context.ConnectionId, out var roomId)) return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomId));

        ParticipantInfo? leaver = null;
        if (_roomParticipants.TryGetValue(roomId, out var participants))
        {
            participants.TryRemove(Context.ConnectionId, out leaver);
            if (participants.IsEmpty)
            {
                _roomParticipants.TryRemove(roomId, out _);
            }
        }

        var state = await _rooms.GetAsync(roomId);
        if (state is null) return;

        if (state.DjUserId == UserId)
        {
            state = state with { DjUserId = null, DjName = null };
            await _rooms.SetAsync(state);
        }

        // Только если у юзера не осталось других соединений в этой комнате
        var leaverUserId = leaver?.UserId ?? UserId;
        var stillHere = participants is not null
            && participants.Values.Any(p => p.UserId == leaverUserId);

        if (!stillHere)
        {
            await Clients.Group(RoomGroup(roomId))
                .SendAsync("ParticipantLeft", new { userId = leaverUserId });
        }
    }

    private Task BroadcastParticipant(string roomId, string eventName, bool isDj)
    {
        return Clients.Group(RoomGroup(roomId))
            .SendAsync(eventName, new { userId = UserId, userName = UserName, isDj });
    }

    public async Task SendPlay(string roomId, Guid trackId, string title, string artist, double position)
    {
        if (!await IsCallerDj(roomId)) return;

        var state = await _rooms.GetAsync(roomId);
        if (state is null) return;

        state = state with
        {
            CurrentTrackId = trackId,
            CurrentTitle = title,
            CurrentArtist = artist,
            CurrentPosition = position,
            IsPlaying = true,
            LastUpdatedAt = DateTime.UtcNow
        };
        await _rooms.SetAsync(state);

        await Clients.OthersInGroup(RoomGroup(roomId)).SendAsync("ReceivePlay", trackId, title, artist, position);
    }

    public async Task SendPause(string roomId, double position)
    {
        if (!await IsCallerDj(roomId)) return;

        var state = await _rooms.GetAsync(roomId);
        if (state is null) return;

        state = state with { CurrentPosition = position, IsPlaying = false, LastUpdatedAt = DateTime.UtcNow };
        await _rooms.SetAsync(state);

        await Clients.OthersInGroup(RoomGroup(roomId)).SendAsync("ReceivePause", position);
    }

    public async Task SendSeek(string roomId, double position)
    {
        if (!await IsCallerDj(roomId)) return;

        var state = await _rooms.GetAsync(roomId);
        if (state is null) return;

        state = state with { CurrentPosition = position, LastUpdatedAt = DateTime.UtcNow };
        await _rooms.SetAsync(state);

        await Clients.OthersInGroup(RoomGroup(roomId)).SendAsync("ReceiveSeek", position);
    }

    public async Task SendHeartbeat(string roomId, double position, bool isPlaying)
    {
        if (!await IsCallerDj(roomId)) return;

        var state = await _rooms.GetAsync(roomId);
        if (state is null) return;

        state = state with { CurrentPosition = position, IsPlaying = isPlaying, LastUpdatedAt = DateTime.UtcNow };
        await _rooms.SetAsync(state);

        await Clients.OthersInGroup(RoomGroup(roomId)).SendAsync("ReceiveHeartbeat", position, isPlaying);
    }

    private async Task<bool> IsCallerDj(string roomId)
    {
        var state = await _rooms.GetAsync(roomId);
        return state?.DjUserId == UserId;
    }

    private static string RoomGroup(string roomId) => $"room:{roomId}";
}