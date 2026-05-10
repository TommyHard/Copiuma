FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["src/api-gateway/Gateway.API/Gateway.API.csproj", "src/api-gateway/Gateway.API/"]
RUN dotnet restore "src/api-gateway/Gateway.API/Gateway.API.csproj"

COPY . .
WORKDIR "/src/src/api-gateway/Gateway.API"
RUN dotnet build "Gateway.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Gateway.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "Gateway.API.dll"]