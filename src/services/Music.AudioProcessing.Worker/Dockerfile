FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/shared/Music.Shared.Contracts/Music.Shared.Contracts.csproj", "src/shared/Music.Shared.Contracts/"]
COPY ["src/services/Music.AudioProcessing.Worker/Music.AudioProcessing.Worker.csproj", "src/services/Music.AudioProcessing.Worker/"]

RUN dotnet restore "src/services/Music.AudioProcessing.Worker/Music.AudioProcessing.Worker.csproj"

COPY src/shared/Music.Shared.Contracts/ src/shared/Music.Shared.Contracts/
COPY src/services/Music.AudioProcessing.Worker/ src/services/Music.AudioProcessing.Worker/

WORKDIR "/src/src/services/Music.AudioProcessing.Worker"
RUN dotnet publish "Music.AudioProcessing.Worker.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        libchromaprint-tools && \
    rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .
EXPOSE 8080

ENTRYPOINT ["dotnet", "Music.AudioProcessing.Worker.dll"]