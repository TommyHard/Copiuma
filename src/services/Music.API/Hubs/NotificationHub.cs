using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Hubs;

[Authorize]
public class NotificationHub : Hub
{
    private readonly RoomStore _rooms;
    private readonly ILogger<NotificationHub> _log;

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> _connectionRooms = new();

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

        _connectionRooms[Context.ConnectionId] = roomId;
        await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroup(roomId));

        await Clients.Caller.SendAsync("RoomJoined", isDj);

        if (!isDj && state.CurrentTrackId.HasValue)
        {
            var pos = state.CurrentPosition;
            if (state.IsPlaying) pos += (DateTime.UtcNow - state.LastUpdatedAt).TotalSeconds;

            await Clients.Caller.SendAsync("SyncCurrentTrack",
                state.CurrentTrackId.Value, state.CurrentTitle, state.CurrentArtist, pos, state.IsPlaying);
        }

        await BroadcastParticipant(roomId, "ParticipantJoined", isDj);
    }

    public Task LeaveRoom() => HandleLeaveRoom();

    private async Task HandleLeaveRoom()
    {
        if (!_connectionRooms.TryRemove(Context.ConnectionId, out var roomId)) return;

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroup(roomId));

        var state = await _rooms.GetAsync(roomId);
        if (state is null) return;

        if (state.DjUserId == UserId)
        {
            state = state with { DjUserId = null, DjName = null };
            await _rooms.SetAsync(state);
        }

        await BroadcastParticipant(roomId, "ParticipantLeft", false);
    }

    private Task BroadcastParticipant(string roomId, string eventName, bool isDj)
    {
        return Clients.Group(RoomGroup(roomId)).SendAsync(eventName, new { UserId, UserName, IsDj = isDj });
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
