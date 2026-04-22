FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Music.API.csproj", "./"]
RUN dotnet restore "Music.API.csproj"

COPY . .
RUN dotnet build "Music.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Music.API.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

RUN apt-get update && apt-get install -y ffmpeg

# Финальный образ
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Music.API.dll"]