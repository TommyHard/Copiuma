using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace Music.API.Hubs;

public class NotificationHub : Hub
{
    private static readonly ConcurrentDictionary<string, Room> _rooms = new();
    private static readonly ConcurrentDictionary<string, string> _userRooms = new();

    public class Room
    {
        public string RoomId { get; set; } = string.Empty;
        public string? DjUserId { get; set; }
        public string? DjName { get; set; }
        public ConcurrentDictionary<string, Participant> Participants { get; set; } = new();

        public Guid? CurrentTrackId { get; set; }
        public string? CurrentTitle { get; set; }
        public string? CurrentArtist { get; set; }
        public double CurrentPosition { get; set; }
        public bool IsPlaying { get; set; }
        public DateTime LastUpdatedAt { get; set; } = DateTime.UtcNow;
    }

    public class Participant
    {
        public string UserId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsDj { get; set; }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await HandleLeaveRoom();
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinRoom(string roomId, bool requestDj, string userId, string userName)
    {
        await HandleLeaveRoom();

        var room = _rooms.GetOrAdd(roomId, new Room { RoomId = roomId });

        var oldConnections = room.Participants.Where(p => p.Value.UserId == userId).Select(p => p.Key).ToList();
        foreach (var conn in oldConnections)
        {
            room.Participants.TryRemove(conn, out _);
            await Clients.Client(conn).SendAsync("ForceLeave", "Сессия отключена: вход с другого устройства.");
        }

        bool isDj = false;

        if (requestDj)
        {
            if (string.IsNullOrEmpty(room.DjUserId) || room.DjUserId == userId)
            {
                room.DjUserId = userId;
                room.DjName = userName;
                isDj = true;
            }
            else
            {
                await Clients.Caller.SendAsync("DjRejected", room.DjName);
                isDj = false;
            }
        }

        room.Participants.TryAdd(Context.ConnectionId, new Participant { UserId = userId, Name = userName, IsDj = isDj });
        _userRooms.TryAdd(Context.ConnectionId, roomId);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomId);

        await Clients.Caller.SendAsync("RoomJoined", isDj);
        await BroadcastRoomState(roomId);

        if (!isDj && room.CurrentTrackId.HasValue)
        {
            double position = room.CurrentPosition;
            if (room.IsPlaying)
            {
                position += (DateTime.UtcNow - room.LastUpdatedAt).TotalSeconds;
            }
            await Clients.Caller.SendAsync("SyncCurrentTrack", room.CurrentTrackId.Value, room.CurrentTitle, room.CurrentArtist, position, room.IsPlaying);
        }
    }

    public async Task LeaveRoom()
    {
        await HandleLeaveRoom();
    }

    private async Task HandleLeaveRoom()
    {
        if (_userRooms.TryRemove(Context.ConnectionId, out var roomId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, roomId);
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.Participants.TryRemove(Context.ConnectionId, out var p);

                if (p != null && p.IsDj) room.DjUserId = null;

                if (room.Participants.IsEmpty) _rooms.TryRemove(roomId, out _);
                else await BroadcastRoomState(roomId);
            }
        }
    }

    private async Task BroadcastRoomState(string roomId)
    {
        if (_rooms.TryGetValue(roomId, out var room))
        {
            var participants = room.Participants.Values.Select(p => new { p.Name, p.IsDj }).ToList();
            await Clients.Group(roomId).SendAsync("UpdateParticipants", participants);
        }
    }

    public async Task SendPlay(string roomId, Guid trackId, string title, string artist, double position)
    {
        if (IsCallerDj(roomId))
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.CurrentTrackId = trackId;
                room.CurrentTitle = title;
                room.CurrentArtist = artist;
                room.CurrentPosition = position;
                room.IsPlaying = true;
                room.LastUpdatedAt = DateTime.UtcNow;
            }
            await Clients.OthersInGroup(roomId).SendAsync("ReceivePlay", trackId, title, artist, position);
        }
    }

    public async Task SendPause(string roomId, double position)
    {
        if (IsCallerDj(roomId))
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.CurrentPosition = position;
                room.IsPlaying = false;
                room.LastUpdatedAt = DateTime.UtcNow;
            }
            await Clients.OthersInGroup(roomId).SendAsync("ReceivePause", position);
        }
    }

    public async Task SendSeek(string roomId, double position)
    {
        if (IsCallerDj(roomId))
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.CurrentPosition = position;
                room.LastUpdatedAt = DateTime.UtcNow;
            }
            await Clients.OthersInGroup(roomId).SendAsync("ReceiveSeek", position);
        }
    }

    public async Task SendHeartbeat(string roomId, double position, bool isPlaying)
    {
        if (IsCallerDj(roomId))
        {
            if (_rooms.TryGetValue(roomId, out var room))
            {
                room.CurrentPosition = position;
                room.IsPlaying = isPlaying;
                room.LastUpdatedAt = DateTime.UtcNow;
            }
            await Clients.OthersInGroup(roomId).SendAsync("ReceiveHeartbeat", position, isPlaying);
        }
    }

    private bool IsCallerDj(string roomId)
    {
        if (_rooms.TryGetValue(roomId, out var room) && room.Participants.TryGetValue(Context.ConnectionId, out var p))
            return p.IsDj;
        return false;
    }
}