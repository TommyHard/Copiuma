using RabbitMQ.Client;
using System.Text;
using System.Text.Json;

namespace Music.API.Services;

public class MessageBusClient
{
    private readonly IConfiguration _configuration;
    private readonly IConnection _connection;
    private readonly IModel _channel;

    public MessageBusClient(IConfiguration configuration)
    {
        _configuration = configuration;

        var factory = new ConnectionFactory()
        {
            HostName = _configuration["RabbitMQ:HostName"],
            Port = 5672
        };

        try
        {
            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            _channel.QueueDeclare(queue: "track_processing_queue",
                                 durable: true,
                                 exclusive: false,
                                 autoDelete: false,
                                 arguments: null);

            Console.WriteLine("--> Подключились к RabbitMQ");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"--> Ошибка подключения к RabbitMQ: {ex.Message}");
        }
    }

    public void PublishNewTrackEvent(Guid trackId)
    {
        if (_connection != null && _connection.IsOpen)
        {
            var message = JsonSerializer.Serialize(new { TrackId = trackId, Event = "TrackUploaded" });
            var body = Encoding.UTF8.GetBytes(message);

            _channel.BasicPublish(exchange: "",
                                 routingKey: "track_processing_queue",
                                 basicProperties: null,
                                 body: body);

            Console.WriteLine($"--> Сообщение отправлено в очередь: {message}");
        }
    }
}