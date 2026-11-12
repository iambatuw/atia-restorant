using System.Security.Cryptography;
using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>
/// Table QR codes for the customer menu and guest calls ("garson çağır", "hesap iste").
/// Each table has a random code, so a guest can only call the table whose QR they scanned.
/// Product photos and allergen information for the menu are also kept here.
/// </summary>
public sealed partial class RestaurantRepository
{
    public static readonly string[] AllergenNames = ["Gluten", "Kabuklu deniz ürünleri", "Yumurta", "Balık", "Yer fıstığı", "Soya", "Süt",
        "Sert kabuklu yemişler", "Kereviz", "Hardal", "Susam", "Sülfit", "Acı bakla", "Yumuşakçalar"];
    private static readonly Dictionary<string, (string Type, byte[] Magic)> ImageTypes = new()
    {
        ["image/jpeg"] = ("image/jpeg", [0xFF, 0xD8, 0xFF]),
        ["image/png"] = ("image/png", [0x89, 0x50, 0x4E, 0x47]),
        ["image/webp"] = ("image/webp", [0x52, 0x49, 0x46, 0x46])
    };
    private const int MaxImageBytes = 2 * 1024 * 1024;
    private Dictionary<long, string> _tableCodes = [];
    private List<MasaCagrisiDTO> _guestCalls = [];
    private long _nextGuestCall;
    private string? _cfgMediaPath;

    private static string NewTableCode() => Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant();
    private string TableCode(long tableId)
    {
        if (!_tableCodes.TryGetValue(tableId, out var code)) _tableCodes[tableId] = code = NewTableCode();
        return code;
    }
    private RestorantMasaDTO TableByCode(string? code)
    {
        Require(code is { Length: 16 } && code.All(char.IsAsciiHexDigitLower), "QR kodu geçersiz.", 404);
        var id = _tableCodes.FirstOrDefault(entry => entry.Value == code).Key;
        return _tables.FirstOrDefault(t => t.MasaId == id) ?? throw new ApiException(404, "QR kodu geçersiz veya masa kaldırılmış.");
    }

    public List<MasaQrDTO> TableQrCodes(StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        return _tables.Select(t => new MasaQrDTO { MasaKayitNo = t.MasaId, MasaAdi = t.MasaAdi ?? "", BolumAdi = t.RestorantBolumAdi ?? "",
            Kod = TableCode(t.MasaId) }).ToList();
    });

    public MasaQrDTO RenewTableQr(long tableId, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var table = Table(tableId);
        _tableCodes[tableId] = NewTableCode();
        Log(actor, "Masa QR kodu yenilendi", table.MasaAdi ?? "");
        return new MasaQrDTO { MasaKayitNo = table.MasaId, MasaAdi = table.MasaAdi ?? "", BolumAdi = table.RestorantBolumAdi ?? "", Kod = _tableCodes[tableId] };
    });

    public QrMasaBilgisiDTO TableForGuest(string code) => Read(() =>
        new QrMasaBilgisiDTO { MasaAdi = TableByCode(code).MasaAdi ?? "", IsletmeAdi = _isletme.Unvan });

    /// <summary>Anonymous guest call. A repeated call of the same type is merged while the first is still open.</summary>
    public CagriSonucDTO CallStaff(CagriRequest request) => Change(() =>
    {
        Require(Enum.IsDefined(request.Tip), "Çağrı türü geçersiz.");
        var table = TableByCode(request.Kod);
        var open = _guestCalls.FirstOrDefault(c => c.MasaKayitNo == table.MasaId && c.Tip == request.Tip && !c.Tamamlandi);
        if (open is null)
        {
            open = new MasaCagrisiDTO { KayitNo = ++_nextGuestCall, MasaKayitNo = table.MasaId, MasaAdi = table.MasaAdi ?? "", Tip = request.Tip, Tarih = Now };
            _guestCalls.Add(open);
            if (_guestCalls.Count > 300) _guestCalls.RemoveRange(0, _guestCalls.Count - 300);
        }
        return new CagriSonucDTO { MasaAdi = open.MasaAdi, Tip = open.Tip, Tarih = open.Tarih };
    });

    public List<MasaCagrisiDTO> OpenCalls(StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin", "Garson");
        return _guestCalls.Where(c => !c.Tamamlandi).OrderBy(c => c.Tarih).ToList();
    });

    public MasaCagrisiDTO CompleteCall(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin", "Garson");
        var call = _guestCalls.FirstOrDefault(c => c.KayitNo == id) ?? throw new ApiException(404, "Çağrı bulunamadı.");
        if (call.Tamamlandi) return call;
        call.Tamamlandi = true; call.TamamlanmaTarihi = Now; call.TamamlayanPersonel = actor.Name;
        return call;
    });

    // ───── ÜRÜN GÖRSELİ VE ALERJEN ─────
    private static List<string> NormalizeAllergens(List<string>? allergens)
    {
        var list = (allergens ?? []).Select(a => a?.Trim() ?? "").Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        Require(list.All(a => AllergenNames.Contains(a)), "Alerjen listesi geçersiz.");
        return AllergenNames.Where(list.Contains).ToList();
    }

    private string MediaDirectory()
    {
        _cfgMediaPath ??= _cfgStatePath is not null
            ? Path.Combine(Path.GetDirectoryName(_cfgStatePath)!, "gorseller")
            : Path.Combine(Path.GetTempPath(), "atia-gorseller", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_cfgMediaPath);
        return _cfgMediaPath;
    }
    private string ImagePath(long productId) => Path.Combine(MediaDirectory(), $"{productId}.img");

    public MenuUrunDTO SaveProductImage(long productId, string? contentType, byte[] data, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var product = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == productId) ?? throw new ApiException(404, "Ürün bulunamadı.");
        Require(data.Length is > 0 and <= MaxImageBytes, "Görsel en fazla 2 MB olabilir.");
        Require(contentType is not null && ImageTypes.TryGetValue(contentType, out var kind) && data.AsSpan().StartsWith(kind.Magic),
            "Yalnızca JPEG, PNG veya WEBP görsel yüklenebilir.");
        File.WriteAllBytes(ImagePath(productId), data);
        product.GorselTuru = ImageTypes[contentType!].Type;
        product.GorselSurumu++;
        Log(actor, "Ürün görseli yüklendi", product.StokAdi ?? "");
        return product;
    });

    public MenuUrunDTO DeleteProductImage(long productId, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var product = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == productId) ?? throw new ApiException(404, "Ürün bulunamadı.");
        var path = ImagePath(productId);
        if (File.Exists(path)) File.Delete(path);
        product.GorselTuru = null;
        product.GorselSurumu = 0;
        Log(actor, "Ürün görseli kaldırıldı", product.StokAdi ?? "");
        return product;
    });

    public (byte[] Data, string Type)? ProductImage(long productId)
    {
        EnsureAvailable();
        string? type;
        lock (_gate) type = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == productId && p.Aktif && p.GorselSurumu > 0)?.GorselTuru;
        var path = ImagePath(productId);
        return type is null || !File.Exists(path) ? null : (File.ReadAllBytes(path), type);
    }

    private void SeedGuest()
    {
        _tableCodes = _tables.ToDictionary(t => t.MasaId, _ => NewTableCode());
        var allergens = new Dictionary<long, string[]> { [1] = ["Kereviz"], [3] = ["Susam"], [6] = ["Gluten", "Yumurta"],
            [7] = ["Gluten", "Süt", "Sert kabuklu yemişler"], [8] = ["Süt"], [9] = ["Süt"] };
        foreach (var product in _menu.SelectMany(c => c.Urunler))
            if (allergens.TryGetValue(product.KayitNo, out var list)) product.Alerjenler = [.. list];
    }
}
