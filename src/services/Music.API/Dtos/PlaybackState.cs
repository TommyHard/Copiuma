namespace Music.API.Dtos;

public record PlaybackStateRequest(Guid TrackId, double PositionSeconds, bool IsPlaying);

public record PlaybackStateResponse(Guid TrackId, double PositionSeconds, bool IsPlaying, DateTime LastUpdated);
