FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/services/Music.API/Music.API.csproj", "src/services/Music.API/"]
COPY ["src/shared/Music.Shared.Contracts/Music.Shared.Contracts.csproj", "src/shared/Music.Shared.Contracts/"]

RUN dotnet restore "src/services/Music.API/Music.API.csproj"

COPY . .

WORKDIR "/src/src/services/Music.API"
RUN dotnet build "Music.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Music.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Music.API.dll"]