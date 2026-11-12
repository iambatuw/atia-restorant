using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>
/// Demo state persistence. Every mutable instance field is written to one JSON file after each
/// successful change, so fields added later are persisted without extra code. Fields prefixed with
/// <c>_cfg</c> and the infrastructure fields listed below are configuration and are never stored.
/// </summary>
public sealed partial class RestaurantRepository
{
    private const int SnapshotFormat = 1;
    private static readonly HashSet<string> NonStateFields = ["_gate", "_mode", "_clock", "_businessDayStartHour"];
    private static readonly JsonSerializerOptions SnapshotJson = new() { WriteIndented = false };
    private string? _cfgStatePath;
    private bool _cfgSuspendPersist;
    private long _cfgStoreId = 1;
    private DateTime? _cfgLastSave;
    private string? _cfgLastError;
    private DateOnly? _cfgLastBackupDay;
    private const int BackupDays = 14;

    private static IEnumerable<FieldInfo> StateFields() => typeof(RestaurantRepository)
        .GetFields(BindingFlags.Instance | BindingFlags.NonPublic)
        .Where(field => !NonStateFields.Contains(field.Name) && !field.Name.StartsWith("_cfg", StringComparison.Ordinal)
            && !field.Name.Contains("k__BackingField", StringComparison.Ordinal))
        .OrderBy(field => field.Name, StringComparer.Ordinal);

    public long StoreId => _cfgStoreId;
    public bool IsPersistent => _cfgStatePath is not null;

    private void ConfigureStorage(IConfiguration? configuration, IHostEnvironment? environment)
    {
        _cfgStoreId = configuration?.GetValue<long?>("Restaurant:StoreId") ?? 1;
        if (_cfgStoreId <= 0) throw new InvalidOperationException("Restaurant:StoreId must be positive.");
        var path = configuration?["Demo:StatePath"];
        if (string.IsNullOrWhiteSpace(path)) return;
        _cfgStatePath = Path.IsPathRooted(path) ? path
            : Path.Combine(environment?.ContentRootPath ?? AppContext.BaseDirectory, path);
    }

    /// <summary>Loads a saved snapshot over the freshly seeded state. A corrupt or incompatible file is ignored.</summary>
    private void LoadSnapshot()
    {
        if (_cfgStatePath is null || !File.Exists(_cfgStatePath)) return;
        try
        {
            var root = JsonNode.Parse(File.ReadAllText(_cfgStatePath))?.AsObject()
                ?? throw new InvalidDataException("Boş kayıt dosyası.");
            if (root["Format"]?.GetValue<int>() != SnapshotFormat || root["StoreId"]?.GetValue<long>() != _cfgStoreId)
                throw new InvalidDataException("Kayıt dosyası bu sürüm veya mağaza ile uyumsuz.");
            var fields = root["Fields"]?.AsObject() ?? throw new InvalidDataException("Alanlar eksik.");
            // Deserialize everything first so a single bad field leaves the seeded state untouched.
            var values = new List<(FieldInfo Field, object? Value)>();
            foreach (var field in StateFields())
                if (fields[field.Name] is { } node) values.Add((field, node.Deserialize(field.FieldType, SnapshotJson)));
            foreach (var (field, value) in values) field.SetValue(this, value);
            // Older saved menus have no per-product note list. Preserve configured products and
            // populate only the original demo items, identified by their unchanged stock names.
            foreach (var product in _menu.SelectMany(category => category.Urunler))
                product.HazirNotlar ??= DefaultQuickNotes(product.StokAdi)
                    .Where(note => _quickNotes.Contains(note, StringComparer.OrdinalIgnoreCase)).ToList();
        }
        catch (Exception exception) when (exception is JsonException or InvalidDataException or IOException
            or InvalidOperationException or NotSupportedException or FormatException)
        {
            _cfgLastError = $"Kayıtlı demo verisi okunamadı, başlangıç verisi kullanılıyor: {exception.Message}";
        }
    }

    /// <summary>Writes the snapshot atomically. Called while holding the repository lock.</summary>
    private void Persist()
    {
        if (_cfgStatePath is null || _cfgSuspendPersist) return;
        try
        {
            var fields = new JsonObject();
            foreach (var field in StateFields())
                fields[field.Name] = JsonSerializer.SerializeToNode(field.GetValue(this), field.FieldType, SnapshotJson);
            var root = new JsonObject { ["Format"] = SnapshotFormat, ["StoreId"] = _cfgStoreId, ["SavedAt"] = Now, ["Fields"] = fields };
            Directory.CreateDirectory(Path.GetDirectoryName(_cfgStatePath)!);
            var temporary = _cfgStatePath + ".tmp";
            File.WriteAllText(temporary, root.ToJsonString(SnapshotJson));
            File.Move(temporary, _cfgStatePath, overwrite: true);
            BackupDaily();
            _cfgLastSave = Now;
            _cfgLastError = null;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            // The in-memory change already happened; surface the failure instead of hiding it.
            _cfgLastError = $"Demo verisi diske yazılamadı: {exception.Message}";
        }
    }

    /// <summary>Keeps one copy per business day in App_Data/yedekler for the last 14 days.</summary>
    private void BackupDaily()
    {
        var day = BusinessToday;
        if (_cfgLastBackupDay == day) return;
        var directory = Path.Combine(Path.GetDirectoryName(_cfgStatePath!)!, "yedekler");
        Directory.CreateDirectory(directory);
        var target = Path.Combine(directory, $"demo-state-{day:yyyyMMdd}.json");
        if (!File.Exists(target)) File.Copy(_cfgStatePath!, target);
        foreach (var old in Directory.GetFiles(directory, "demo-state-*.json").OrderByDescending(f => f, StringComparer.Ordinal).Skip(BackupDays))
            File.Delete(old);
        _cfgLastBackupDay = day;
    }

    public DemoDurumDTO DemoStatus() { lock (_gate) return new() { Kalici = IsPersistent, SonKayit = _cfgLastSave, SonHata = _cfgLastError }; }

    /// <summary>Restores the seeded demo data for this store. Configuration and store identity are kept.</summary>
    public DemoDurumDTO ResetDemo(StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var fresh = new RestaurantRepository(_mode, _clock);
        foreach (var field in StateFields()) field.SetValue(this, field.GetValue(fresh));
        _isletme.MagazaKayitNo = _cfgStoreId;
        Log(actor, "Demo verisi sıfırlandı", "Başlangıç verisi yüklendi");
        return new DemoDurumDTO { Kalici = IsPersistent, SonKayit = _cfgLastSave, SonHata = _cfgLastError };
    });
}
