namespace Music.API.Dtos;

public record PlaybackStateRequest(Guid TrackId, double PositionSeconds);

public record PlaybackStateResponse(Guid TrackId, double PositionSeconds, DateTime LastUpdated);