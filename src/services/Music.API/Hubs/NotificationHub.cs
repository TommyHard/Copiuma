using Microsoft.AspNetCore.SignalR;

namespace Music.API.Hubs;

public class NotificationHub : Hub
{
    public override Task OnConnectedAsync()
    {
        Console.WriteLine($"--> [SignalR] Новый клиент подключился, ID: {Context.ConnectionId}");
        return base.OnConnectedAsync();
    }
}