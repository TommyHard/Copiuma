FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["shared/Music.Shared.Contracts/Music.Shared.Contracts.csproj", "shared/Music.Shared.Contracts/"]
COPY ["services/Music.API/Music.API.csproj", "services/Music.API/"]

RUN dotnet restore "services/Music.API/Music.API.csproj"

COPY shared/Music.Shared.Contracts/ shared/Music.Shared.Contracts/
COPY services/Music.API/ services/Music.API/

WORKDIR /src/services/Music.API
RUN dotnet publish "Music.API.csproj" -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "Music.API.dll"]