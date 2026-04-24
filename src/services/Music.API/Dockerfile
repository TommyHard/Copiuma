FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Music.API.csproj", "./"]
RUN dotnet restore "Music.API.csproj"

COPY . .
RUN dotnet build "Music.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Music.API.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        libchromaprint-tools && \
    rm -rf /var/lib/apt/lists/*

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Music.API.dll"]