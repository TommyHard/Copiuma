FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["Music.API.csproj", "./"]
RUN dotnet restore "Music.API.csproj"

COPY . .
RUN dotnet build "Music.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Music.API.csproj" -c Release -o /app/publish

# Финальный образ
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Music.API.dll"]