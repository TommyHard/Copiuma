using System.Diagnostics;

namespace Music.API.Services;

public class HlsConverterService
{
    public async Task<bool> ConvertToHlsAsync(string inputFilePath, string outputDirectory)
    {
        if (!Directory.Exists(outputDirectory))
        {
            Directory.CreateDirectory(outputDirectory);
        }

        string m3u8OutputPath = Path.Combine(outputDirectory, "playlist.m3u8");

        // -i (входной файл)
        // -c:a aac (формат aac, лучше для веба?)
        // -b:a 128k (битрейт)
        // -f hls (формат на выходе HLS)
        // -hls_time 10 (по 10 секунд)
        // -hls_list_size 0 (сохраняем чанки, не удаляем старые)
        string arguments = $"-i \"{inputFilePath}\" -c:a aac -b:a 128k -f hls -hls_time 10 -hls_list_size 0 \"{m3u8OutputPath}\"";

        var processInfo = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process();
        process.StartInfo = processInfo;

        process.Start();

        string errorOutput = await process.StandardError.ReadToEndAsync();

        await process.WaitForExitAsync();

        if (process.ExitCode != 0)
        {
            Console.WriteLine($"[FFMPEG ERROR] Ошибка конвертации: {errorOutput}");
            return false;
        }

        Console.WriteLine($"[HLS SUCCESS] Трек успешно нарезан в папку: {outputDirectory}");
        return true;
    }
}