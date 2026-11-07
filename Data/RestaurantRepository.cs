using System.Text.Json;
using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

public sealed record StaffActor(int Id, string Name, string Role)
{
    public bool IsAdmin => Role == "Admin";
}

public sealed class ApiException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed record BackendMode(bool IsDemo)
{
    public string Name => IsDemo ? "Demo" : "SqlServer";
}

/// <summary>Process-local demonstration only. Every operation and snapshot shares one lock.</summary>
public sealed class RestaurantRepository
{
    private readonly object _gate = new();
    private readonly BackendMode _mode;
    private readonly TimeProvider _clock;
    private readonly List<RestorantMasaDTO> _tables = [];
    private readonly List<MenuKategoriDTO> _menu = [];
    private readonly List<AdisyonBaslikDTO> _receipts = [];
    private readonly List<RezervasyonDTO> _reservations = [];
    private readonly List<PaketSiparisDTO> _deliveries = [];
    private readonly Dictionary<string, long> _deliveryIdempotency = [];
    private readonly Dictionary<long, decimal> _ready = [];
    private readonly Dictionary<long, DateTime> _closedAt = [];
    private readonly Dictionary<string, PosIslemKayitDTO> _posTransactions = [];
    private readonly Dictionary<string, string> _posIdempotency = [];
    private readonly List<IslemKaydiDTO> _audit = [];
    private readonly List<MutfakBildirimDTO> _kitchenEvents = [];
    private readonly Dictionary<DateOnly, VardiyaKapanisDTO> _shiftClosings = [];
    private readonly HashSet<long> _mergedReceipts = [];
    private long _nextAudit, _nextKitchenEvent;
    private readonly int _businessDayStartHour;
    private long _nextReceipt = 1000, _nextLine = 10000, _nextReservation = 100, _nextDelivery = 3000;
    private DateTime Now => _clock.GetUtcNow().UtcDateTime;
    private static readonly TimeZoneInfo RestaurantTimeZone = FindRestaurantTimeZone();
    private static TimeZoneInfo FindRestaurantTimeZone()
    {
        try { return TimeZoneInfo.FindSystemTimeZoneById("Europe/Istanbul"); }
        catch (TimeZoneNotFoundException) { return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time"); }
        catch (InvalidTimeZoneException) { return TimeZoneInfo.FindSystemTimeZoneById("Turkey Standard Time"); }
    }
    private static DateTime RestaurantTime(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(
        DateTime.SpecifyKind(utc, DateTimeKind.Utc), RestaurantTimeZone);
    private DateOnly BusinessDate(DateTime utc) => DateOnly.FromDateTime(RestaurantTime(utc).AddHours(-_businessDayStartHour));
    public DateOnly BusinessToday => BusinessDate(Now);
    public int BusinessDayStartHour => _businessDayStartHour;

    public RestaurantRepository(BackendMode mode, TimeProvider clock, IConfiguration? configuration = null)
    {
        _mode = mode;
        _clock = clock;
        var hour = configuration?.GetValue<int?>("Restaurant:BusinessDayStartHour") ?? 4;
        if (hour is < 0 or > 23) throw new InvalidOperationException("BusinessDayStartHour must be 0-23.");
        _businessDayStartHour = hour;
        if (mode.IsDemo) Seed();
    }

    public void EnsureAvailable()
    {
        if (!_mode.IsDemo) throw new ApiException(503, "ERP şeması doğrulanmadı; SQL erişimi kapalı.");
    }

    private static T Copy<T>(T value) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value))!;
    private T Read<T>(Func<T> action)
    {
        EnsureAvailable();
        lock (_gate) return Copy(action());
    }
    private T Change<T>(Func<T> action)
    {
        EnsureAvailable();
        lock (_gate) return Copy(action());
    }
    private static void Require(bool valid, string message, int status = 400)
    {
        if (!valid) throw new ApiException(status, message);
    }
    private static void Staff(StaffActor actor, params string[] roles) =>
        Require(actor.Id > 0 && roles.Contains(actor.Role), "Bu işlem için yetkiniz yok.", 403);
    private enum StaffOperation { Order, Cancel, Waste, Gift, Payment, Kitchen }
    private static void Permission(StaffActor actor, StaffOperation action)
    {
        var allowed = action switch
        {
            StaffOperation.Order or StaffOperation.Cancel => actor.Role is "Admin" or "Garson",
            StaffOperation.Waste or StaffOperation.Gift or StaffOperation.Payment => actor.Role == "Admin",
            StaffOperation.Kitchen => actor.Role is "Admin" or "Mutfak",
            _ => false
        };
        Require(actor.Id > 0 && allowed, "Bu işlem için yetkiniz yok.", 403);
    }
    private void KitchenEvent(AdisyonBaslikDTO receipt, AdisyonDetayDTO line, string action, decimal quantity,
        string? note = null) => _kitchenEvents.Add(new MutfakBildirimDTO
    {
        KayitNo = ++_nextKitchenEvent, AdisyonNo = receipt.KayitNo, MasaAdi = receipt.MasaAdi ?? "",
        UrunAdi = line.StokAdi ?? "", Islem = action, Miktar = quantity,
        Not = note ?? line.SatirAciklama, Tarih = Now
    });
    private void Log(StaffActor actor, string action, string detail, long? receiptId = null, decimal amount = 0,
        OdemeRequest? payment = null) => _audit.Add(new IslemKaydiDTO
    {
        KayitNo = ++_nextAudit, Tarih = Now, Islem = action, Aciklama = detail,
        AdisyonNo = receiptId, PersonelId = actor.Id, PersonelAdi = actor.Name, Tutar = amount,
        Nakit = payment?.NakitTutar ?? 0, Banka = payment?.BankaTutar ?? 0,
        YemekKarti = payment?.YemekKartiTutar ?? 0, Cari = payment?.CariTutar ?? 0,
        Indirim = payment?.IndirimTutar ?? 0
    });
    public List<IslemKaydiDTO> Audit(DateOnly date, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _audit.Where(item => BusinessDate(item.Tarih) == date)
            .OrderByDescending(item => item.KayitNo).ToList();
    });
    private static void Quantity(decimal quantity) => Require(quantity > 0 && quantity <= 100 &&
        decimal.Round(quantity, 3) == quantity, "Miktar 0'dan büyük, en fazla 100 ve üç ondalıklı olmalı.");
    private static void Note(string? note) => Require(note is null || note.Length <= 500, "Açıklama en fazla 500 karakter olabilir.");
    private RestorantMasaDTO Table(long id) => _tables.FirstOrDefault(t => t.MasaId == id)
        ?? throw new ApiException(404, "Masa bulunamadı.");
    private AdisyonBaslikDTO? Open(long tableId) => _receipts.FirstOrDefault(r => r.MasaKayitNo == tableId && !r.Kapali);
    private (AdisyonBaslikDTO Receipt, AdisyonDetayDTO Line) Line(long id)
    {
        var receipt = _receipts.FirstOrDefault(r => r.Detaylar.Any(d => d.KayitNo == id))
            ?? throw new ApiException(404, "Sipariş bulunamadı.");
        Require(!receipt.Kapali, "Kapalı adisyon değiştirilemez.", 409);
        return (receipt, receipt.Detaylar.Single(d => d.KayitNo == id));
    }
    private static void Recalculate(AdisyonBaslikDTO receipt)
    {
        foreach (var row in receipt.Detaylar)
            row.SatirTutari = row.Ikram ? 0 : decimal.Round(row.Miktar * row.BirimFiyat, 2, MidpointRounding.AwayFromZero);
        receipt.GenelToplam = receipt.Detaylar.Sum(d => d.SatirTutari);
    }
    private bool Reserved(long tableId) => _reservations.Any(r => r.MasaKayitNo == tableId &&
        r.RezervasyonTarihi > Now.AddHours(-2) && r.RezervasyonTarihi <= Now.AddHours(2));
    private RestorantMasaDTO TableView(RestorantMasaDTO source)
    {
        var table = Copy(source);
        var receipt = Open(table.MasaId);
        table.Rezerve = Reserved(table.MasaId);
        table.Durumu = receipt is not null ? 1 : table.Rezerve ? 2 : 0;
        table.BaslikKayitNo = receipt?.KayitNo;
        table.Tutar = receipt?.GenelToplam;
        table.KisiSayisi = receipt?.KisiSayisi ?? 0;
        table.AcilisTarihi = receipt?.KayitTarihi;
        table.Detaylar = receipt?.Detaylar ?? [];
        return table;
    }

    public List<RestorantMasaDTO> Tables(long? sectionId) => Read(() =>
    {
        Require(sectionId is null || sectionId is 1 or 2, "Bölüm bulunamadı.", 404);
        return _tables.Where(t => sectionId is null || t.RestorantBolumuKayitNo == sectionId).Select(TableView).ToList();
    });
    public List<RestorantBolumDTO> Sections() => Read(() => _tables.GroupBy(t => t.RestorantBolumuKayitNo).Select(g =>
        new RestorantBolumDTO { KayitNo = g.Key!.Value, BolumKodu = g.First().RestorantBolumKodu,
            BolumAdi = g.First().RestorantBolumAdi, ToplamMasa = g.Count(), DoluMasa = g.Count(t => Open(t.MasaId) is not null) }).ToList());
    public List<MenuKategoriDTO> Menu() => Read(() => _menu);
    public List<PaketSiparisDTO> Deliveries(StaffActor actor) => Read(() =>
    {
        Staff(actor, "Garson", "Admin");
        return _deliveries.OrderByDescending(d => d.KayitTarihi).ToList();
    });

    public PaketSiparisDTO CreateDelivery(PaketSiparisEkleRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Garson", "Admin");
        Require(Guid.TryParse(request.IdempotencyKey, out _), "İşlem anahtarı geçersiz.");
        if (_deliveryIdempotency.TryGetValue(request.IdempotencyKey, out var existingId))
            return _deliveries.Single(d => d.KayitNo == existingId);
        Require(!string.IsNullOrWhiteSpace(request.MusteriAdi) && request.MusteriAdi.Trim().Length <= 100,
            "Müşteri adı 1–100 karakter olmalı.");
        Require(!string.IsNullOrWhiteSpace(request.Telefon) && request.Telefon.Trim().Length <= 30,
            "Telefon 1–30 karakter olmalı.");
        Require(!string.IsNullOrWhiteSpace(request.Adres) && request.Adres.Trim().Length <= 300,
            "Adres 1–300 karakter olmalı.");
        Note(request.Aciklama);
        Require(request.OdemeSekli is "Nakit" or "Kart" or "Online", "Ödeme şekli geçersiz.");
        Require(request.Satirlar is { Count: > 0 and <= 50 }, "En az bir, en fazla 50 ürün seçilmeli.");

        var lines = new List<PaketSiparisSatirDTO>();
        foreach (var row in request.Satirlar)
        {
            Require(row.Miktar is >= 1 and <= 50, "Ürün miktarı 1–50 arasında olmalı.");
            var product = _menu.SelectMany(c => c.Urunler)
                .FirstOrDefault(p => p.KayitNo == row.StokKayitNo && p.Aktif)
                ?? throw new ApiException(404, "Aktif ürün bulunamadı.");
            var portion = row.PorsiyonKayitNo.HasValue
                ? product.Porsiyonlar.FirstOrDefault(p => p.KayitNo == row.PorsiyonKayitNo) : null;
            Require(!row.PorsiyonKayitNo.HasValue || portion is not null, "Ürüne ait porsiyon bulunamadı.");
            var price = portion?.Fiyat ?? product.SatisFiyati;
            lines.Add(new PaketSiparisSatirDTO { StokKayitNo = product.KayitNo, StokAdi = product.StokAdi ?? "",
                PorsiyonKayitNo = portion?.KayitNo, PorsiyonAdi = portion?.PorsiyonAdi, Miktar = row.Miktar,
                BirimFiyat = price, SatirTutari = decimal.Round(price * row.Miktar, 2, MidpointRounding.AwayFromZero) });
        }
        var delivery = new PaketSiparisDTO { KayitNo = ++_nextDelivery, KayitTarihi = Now,
            MusteriAdi = request.MusteriAdi.Trim(), Telefon = request.Telefon.Trim(), Adres = request.Adres.Trim(),
            Aciklama = request.Aciklama?.Trim(), OdemeSekli = request.OdemeSekli, Durum = PaketDurum.Yeni,
            GenelToplam = lines.Sum(l => l.SatirTutari), Satirlar = lines };
        _deliveries.Add(delivery);
        _deliveryIdempotency[request.IdempotencyKey] = delivery.KayitNo;
        return delivery;
    });

    public PaketSiparisDTO UpdateDelivery(long id, PaketDurumRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Garson", "Admin");
        var delivery = _deliveries.FirstOrDefault(d => d.KayitNo == id)
            ?? throw new ApiException(404, "Paket siparişi bulunamadı.");
        var allowed = delivery.Durum switch
        {
            PaketDurum.Yeni => request.Durum is PaketDurum.Hazirlaniyor or PaketDurum.Iptal,
            PaketDurum.Hazirlaniyor => request.Durum is PaketDurum.Yolda or PaketDurum.Iptal,
            PaketDurum.Yolda => request.Durum == PaketDurum.TeslimEdildi,
            _ => false
        };
        Require(allowed, "Bu durum geçişi yapılamaz.", 409);
        if (request.Durum == PaketDurum.Yolda)
            Require(!string.IsNullOrWhiteSpace(request.Kurye) && request.Kurye.Trim().Length <= 100,
                "Kurye adı 1–100 karakter olmalı.");
        delivery.Durum = request.Durum;
        if (request.Durum == PaketDurum.Yolda) delivery.Kurye = request.Kurye!.Trim();
        return delivery;
    });
    public AdisyonBaslikDTO? Receipt(long tableId) => Read(() => { Table(tableId); return Open(tableId); });

    public AdisyonBaslikDTO AddOrder(SiparisEkleRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Order);
        Quantity(request.Miktar); Note(request.SatirAciklama);
        if (request.Ikram) Permission(actor, StaffOperation.Gift);
        Require(!request.StokEkstra && string.IsNullOrWhiteSpace(request.StokEkstraAdi), "Serbest fiyatlı/ekstra ürünler desteklenmiyor.");
        var table = Table(request.MasaKayitNo);
        Require(!table.BirlesmisMasa && !table.AnaMasa, "Birleşmiş masa desteklenmiyor.", 409);
        var product = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == request.StokKayitNo && p.Aktif)
            ?? throw new ApiException(404, "Aktif ürün bulunamadı.");
        var portion = request.PorsiyonKayitNo.HasValue
            ? product.Porsiyonlar.FirstOrDefault(p => p.KayitNo == request.PorsiyonKayitNo) : null;
        Require(!request.PorsiyonKayitNo.HasValue || portion is not null, "Ürüne ait porsiyon bulunamadı.");
        var receipt = Open(table.MasaId);
        if (receipt is null)
        {
            receipt = new AdisyonBaslikDTO { KayitNo = ++_nextReceipt, MasaKayitNo = table.MasaId,
                MasaAdi = table.MasaAdi, PersonelKayitNo = actor.Id, PersonelAdi = actor.Name,
                Tarih = Now, KayitTarihi = Now, KisiSayisi = 2 };
            _receipts.Add(receipt);
        }
        var line = new AdisyonDetayDTO { KayitNo = ++_nextLine, StokKayitNo = product.KayitNo,
            StokKodu = product.StokKodu, StokAdi = product.StokAdi, Miktar = request.Miktar,
            BirimFiyat = portion?.Fiyat ?? product.SatisFiyati, PorsiyonKayitNo = portion?.KayitNo,
            PorsiyonAdi = portion?.PorsiyonAdi, Ikram = request.Ikram, SatirAciklama = request.SatirAciklama?.Trim(),
            PersonelKayitNo = actor.Id, PersonelAdi = actor.Name };
        receipt.Detaylar.Add(line);
        _ready[line.KayitNo] = 0;
        Recalculate(receipt);
        Log(actor, "Ürün eklendi", $"{receipt.MasaAdi}: {line.Miktar} × {line.StokAdi}", receipt.KayitNo, line.SatirTutari);
        KitchenEvent(receipt, line, "Eklendi", line.Miktar);
        return receipt;
    });

    public AdisyonBaslikDTO UpdateOrder(long id, SiparisGuncelleRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Order);
        Require(request.DetayKayitNo == 0 || request.DetayKayitNo == id, "URL ve sipariş kimliği uyuşmuyor.");
        Quantity(request.Miktar); Note(request.SatirAciklama);
        var (receipt, line) = Line(id);
        if (request.Ikram != line.Ikram || (line.Ikram && request.Miktar > line.Miktar)) Permission(actor, StaffOperation.Gift);
        var paid = (receipt.NakitToplam ?? 0) + (receipt.BankaToplam ?? 0) + (receipt.CariToplam ?? 0) + (receipt.YemekKartiToplam ?? 0) + (receipt.IndirimToplam ?? 0);
        var newLineTotal = request.Ikram ? 0 : decimal.Round(request.Miktar * line.BirimFiyat, 2, MidpointRounding.AwayFromZero);
        Require(receipt.GenelToplam - line.SatirTutari + newLineTotal >= paid, "Sipariş toplamı alınmış ödemeden düşük olamaz.", 409);
        // Clamp on reduction so decreasing then increasing never resurrects readiness.
        _ready[id] = Math.Min(_ready.GetValueOrDefault(id), request.Miktar);
        var previousAmount = line.SatirTutari;
        var previousQuantity = line.Miktar;
        var previousNote = line.SatirAciklama;
        var wasGift = line.Ikram;
        line.Miktar = request.Miktar;
        line.SatirAciklama = request.SatirAciklama?.Trim();
        line.Ikram = request.Ikram;
        Recalculate(receipt);
        if (wasGift != line.Ikram)
            Log(actor, line.Ikram ? "İkram verildi" : "İkram kaldırıldı",
                $"{receipt.MasaAdi}: {line.StokAdi}", receipt.KayitNo, line.Ikram ? previousAmount : line.SatirTutari);
        else Log(actor, "Ürün değiştirildi", $"{receipt.MasaAdi}: {line.StokAdi}, adet {line.Miktar}", receipt.KayitNo);
        if (previousQuantity != line.Miktar || previousNote != line.SatirAciklama)
            KitchenEvent(receipt, line, previousQuantity == line.Miktar ? "Not değişti" :
                line.Miktar < previousQuantity ? "Azaltıldı" : "Artırıldı",
                previousQuantity == line.Miktar ? line.Miktar : Math.Abs(line.Miktar - previousQuantity),
                line.SatirAciklama);
        return receipt;
    });

    public AdisyonBaslikDTO RemoveOrder(long id, SiparisCikarmaRequest request, StaffActor actor) => Change(() =>
    {
        Require(Enum.IsDefined(request.Tip), "İşlem türü geçersiz.");
        Permission(actor, request.Tip == SiparisCikarmaTipi.Zayi ? StaffOperation.Waste : StaffOperation.Cancel);
        Require(!string.IsNullOrWhiteSpace(request.Gerekce) && request.Gerekce.Trim().Length is <= 200,
            "Gerekçe 1–200 karakter olmalı.");
        var (receipt, line) = Line(id);
        var paid = (receipt.NakitToplam ?? 0) + (receipt.BankaToplam ?? 0) +
            (receipt.CariToplam ?? 0) + (receipt.YemekKartiToplam ?? 0) + (receipt.IndirimToplam ?? 0);
        Require(receipt.GenelToplam - line.SatirTutari >= paid,
            "İşlem sonrası adisyon toplamı alınmış ödemeden düşük olamaz.", 409);
        var action = request.Tip == SiparisCikarmaTipi.Zayi ? "Zayi kaydedildi" : "Ürün iptal edildi";
        KitchenEvent(receipt, line, request.Tip == SiparisCikarmaTipi.Zayi ? "Zayi" : "İptal", line.Miktar,
            request.Gerekce.Trim());
        Log(actor, action, $"{receipt.MasaAdi}: {line.Miktar} × {line.StokAdi} · {request.Gerekce.Trim()}",
            receipt.KayitNo, line.SatirTutari);
        receipt.Detaylar.Remove(line);
        _ready.Remove(id);
        Recalculate(receipt);
        return receipt;
    });

    public AdisyonBaslikDTO Pay(long tableId, OdemeRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment); Table(tableId);
        var receipt = Open(tableId) ?? throw new ApiException(409, "Masada açık adisyon yok; ödeme yinelenmiş olabilir.");
        Require(receipt.KayitNo == request.BaslikKayitNo, "Adisyon değişti; güncel adisyonu yükleyin.", 409);
        decimal[] values = [request.NakitTutar, request.BankaTutar, request.CariTutar, request.YemekKartiTutar, request.IndirimTutar];
        Require(values.All(v => v >= 0 && v <= 10000000m && decimal.Round(v, 2) == v), "Ödemeler negatif olamaz ve en fazla iki ondalıklı olmalı.");

        decimal oncekiNakit = receipt.NakitToplam ?? 0;
        decimal oncekiBanka = receipt.BankaToplam ?? 0;
        decimal oncekiCari = receipt.CariToplam ?? 0;
        decimal oncekiYemek = receipt.YemekKartiToplam ?? 0;
        decimal oncekiIndirim = receipt.IndirimToplam ?? 0;
        decimal oncekiOdenen = oncekiNakit + oncekiBanka + oncekiCari + oncekiYemek + oncekiIndirim;
        decimal kalanTutar = receipt.GenelToplam - oncekiOdenen;
        decimal buOdemeToplami = values.Sum();
        PosIslemKayitDTO? posTx = null;
        if (!string.IsNullOrWhiteSpace(request.PosIslemId))
        {
            Require(_posTransactions.TryGetValue(request.PosIslemId, out posTx), "POS işlemi bulunamadı.", 404);
            Require(posTx!.Durum == PosDurum.Onaylandi && posTx.BaslikKayitNo == receipt.KayitNo &&
                posTx.MasaKayitNo == tableId && posTx.Tutar == request.BankaTutar,
                "POS onayı bu adisyon ve banka ödemesiyle eşleşmiyor.", 409);
        }

        if (request.KismiOdeme)
        {
            Require(buOdemeToplami > 0, "Kısmi ödeme tutarı sıfırdan büyük olmalı.");
            Require(buOdemeToplami <= kalanTutar, "Ödeme tutarı kalan adisyon tutarından büyük olamaz.", 409);
            receipt.NakitToplam = oncekiNakit + request.NakitTutar;
            receipt.BankaToplam = oncekiBanka + request.BankaTutar;
            receipt.CariToplam = oncekiCari + request.CariTutar;
            receipt.YemekKartiToplam = oncekiYemek + request.YemekKartiTutar;
            receipt.IndirimToplam = oncekiIndirim + request.IndirimTutar;

            if ((oncekiOdenen + buOdemeToplami) >= receipt.GenelToplam)
            {
                receipt.Kapali = true;
                _closedAt[receipt.KayitNo] = Now;
            }
        }
        else
        {
            Require(buOdemeToplami == kalanTutar, "Ödeme ve indirim toplamı kalan adisyon tutarıyla tam eşleşmeli.", 409);
            receipt.NakitToplam = oncekiNakit + request.NakitTutar;
            receipt.BankaToplam = oncekiBanka + request.BankaTutar;
            receipt.CariToplam = oncekiCari + request.CariTutar;
            receipt.YemekKartiToplam = oncekiYemek + request.YemekKartiTutar;
            receipt.IndirimToplam = oncekiIndirim + request.IndirimTutar;
            receipt.Kapali = true;
            _closedAt[receipt.KayitNo] = Now;
        }

        if (posTx is not null)
            posTx.Durum = PosDurum.ErpKaydedildi;

        Log(actor, "Ödeme alındı", $"{receipt.MasaAdi}: {(request.KismiOdeme ? "kısmi" : "tam")} ödeme",
            receipt.KayitNo, request.NakitTutar + request.BankaTutar + request.YemekKartiTutar + request.CariTutar,
            request);

        return receipt;
    });

    public AdisyonBaslikDTO Move(MasaTasiRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        Require(request.KaynakMasaKayitNo != request.HedefMasaKayitNo, "Kaynak ve hedef farklı olmalı.");
        var source = Table(request.KaynakMasaKayitNo); var target = Table(request.HedefMasaKayitNo);
        Require(!source.BirlesmisMasa && !source.AnaMasa && !target.BirlesmisMasa && !target.AnaMasa,
            "Birleşmiş masalar taşınamaz.", 409);
        var receipt = Open(source.MasaId) ?? throw new ApiException(409, "Kaynak masa boş.");
        Require(Open(target.MasaId) is null && !Reserved(target.MasaId), "Hedef masa boş ve rezervasyonsuz olmalı.", 409);
        receipt.MasaKayitNo = target.MasaId; receipt.MasaAdi = target.MasaAdi;
        Log(actor, "Masa taşındı", $"{source.MasaAdi} → {target.MasaAdi}", receipt.KayitNo);
        return receipt;
    });

    public MasaAyirSonucDTO Split(MasaAyirRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        Require(request.MasaKayitNo != request.HedefMasaKayitNo, "Kaynak ve hedef masa farklı olmalı.");
        var sourceTable = Table(request.MasaKayitNo);
        var targetTable = Table(request.HedefMasaKayitNo);
        Require(!sourceTable.BirlesmisMasa && !sourceTable.AnaMasa && !targetTable.BirlesmisMasa && !targetTable.AnaMasa,
            "Birleşmiş masalarda ayırma işlemi yapılamaz.", 409);

        var sourceReceipt = Open(sourceTable.MasaId) ?? throw new ApiException(409, "Kaynak masada açık adisyon yok.");
        Require((sourceReceipt.NakitToplam ?? 0) + (sourceReceipt.BankaToplam ?? 0) + (sourceReceipt.CariToplam ?? 0) + (sourceReceipt.YemekKartiToplam ?? 0) + (sourceReceipt.IndirimToplam ?? 0) == 0, "Kısmi ödeme alınmış adisyon ayrılamaz.", 409);
        Require(Open(targetTable.MasaId) is null && !Reserved(targetTable.MasaId),
            "Hedef masa boş ve rezervasyonsuz olmalı.", 409);
        Require(request.AyrilanSatirlar is { Count: > 0 }, "Ayrılacak en az bir sipariş satırı seçilmelidir.");

        Require(request.AyrilanSatirlar.Select(item => item.DetayKayitNo).Distinct().Count() == request.AyrilanSatirlar.Count,
            "Aynı sipariş satırı birden fazla kez seçilemez.");
        foreach (var item in request.AyrilanSatirlar)
        {
            Quantity(item.Miktar);
            var line = sourceReceipt.Detaylar.FirstOrDefault(d => d.KayitNo == item.DetayKayitNo)
                ?? throw new ApiException(404, $"Satır bulunamadı (No: {item.DetayKayitNo}).");
            Require(item.Miktar <= line.Miktar, $"{line.StokAdi} için ayrılacak miktar mevcut miktardan fazla olamaz.");
        }
        Require(request.AyrilanSatirlar.Sum(item => item.Miktar) < sourceReceipt.Detaylar.Sum(line => line.Miktar),
            "Tüm siparişler ayrılamaz; bunun yerine masa taşıma işlemini kullanın.", 400);

        var targetReceipt = new AdisyonBaslikDTO
        {
            KayitNo = ++_nextReceipt,
            MasaKayitNo = targetTable.MasaId,
            MasaAdi = targetTable.MasaAdi,
            PersonelKayitNo = actor.Id,
            PersonelAdi = actor.Name,
            Tarih = Now,
            KayitTarihi = Now,
            KisiSayisi = 1,
            Kapali = false,
            Detaylar = []
        };

        foreach (var splitItem in request.AyrilanSatirlar)
        {
            Quantity(splitItem.Miktar);
            var sourceLine = sourceReceipt.Detaylar.FirstOrDefault(d => d.KayitNo == splitItem.DetayKayitNo)
                ?? throw new ApiException(404, $"Satır bulunamadı (No: {splitItem.DetayKayitNo}).");
            Require(splitItem.Miktar <= sourceLine.Miktar,
                $"{sourceLine.StokAdi} için ayrılacak miktar ({splitItem.Miktar}) mevcut miktardan ({sourceLine.Miktar}) fazla olamaz.");

            var targetLine = Copy(sourceLine);
            targetLine.KayitNo = ++_nextLine;
            targetLine.Miktar = splitItem.Miktar;
            targetLine.SatirTutari = targetLine.Ikram ? 0 : decimal.Round(targetLine.Miktar * targetLine.BirimFiyat, 2, MidpointRounding.AwayFromZero);
            targetReceipt.Detaylar.Add(targetLine);

            if (_ready.TryGetValue(sourceLine.KayitNo, out var readyQty))
            {
                var movedReady = Math.Min(readyQty, splitItem.Miktar);
                _ready[targetLine.KayitNo] = movedReady;
                _ready[sourceLine.KayitNo] = Math.Max(0, readyQty - movedReady);
            }

            if (splitItem.Miktar == sourceLine.Miktar)
            {
                sourceReceipt.Detaylar.Remove(sourceLine);
            }
            else
            {
                sourceLine.Miktar -= splitItem.Miktar;
                sourceLine.SatirTutari = sourceLine.Ikram ? 0 : decimal.Round(sourceLine.Miktar * sourceLine.BirimFiyat, 2, MidpointRounding.AwayFromZero);
            }
        }

        Require(sourceReceipt.Detaylar.Count > 0,
            "Tüm siparişler ayrılamaz; bunun yerine masa taşıma işlemini kullanın.", 400);

        Recalculate(sourceReceipt);
        Recalculate(targetReceipt);
        _receipts.Add(targetReceipt);
        Log(actor, "Masa ayrıldı", $"{sourceTable.MasaAdi} → {targetTable.MasaAdi}", sourceReceipt.KayitNo);

        return new MasaAyirSonucDTO
        {
            KaynakAdisyon = sourceReceipt,
            HedefAdisyon = targetReceipt
        };
    });

    public AdisyonBaslikDTO Merge(MasaBirlestirRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        Require(request.BirlestirilecekMasaKayitNolar is { Count: > 0 }, "Birleştirilecek en az bir masa seçilmelidir.");
        Require(!request.BirlestirilecekMasaKayitNolar.Contains(request.AnaMasaKayitNo), "Ana masa birleştirilecek masalar listesinde olamaz.");
        Require(request.BirlestirilecekMasaKayitNolar.Distinct().Count() == request.BirlestirilecekMasaKayitNolar.Count, "Birleştirilecek masalar yinelenemez.");

        var masterTable = Table(request.AnaMasaKayitNo);
        var masterReceipt = Open(masterTable.MasaId) ?? throw new ApiException(409, "Ana masada açık adisyon bulunamadı.");
        var children = request.BirlestirilecekMasaKayitNolar.Select(childTableId =>
        {
            var childTable = Table(childTableId);
            var childReceipt = Open(childTable.MasaId) ?? throw new ApiException(409, $"Masa {childTable.MasaAdi} üzerinde açık adisyon bulunamadı.");
            Require(childReceipt.KayitNo != masterReceipt.KayitNo, "Birleştirilecek adisyon ana adisyon ile aynı olamaz.");
            return childReceipt;
        }).ToList();
        foreach (var childReceipt in children)
        {
            foreach (var line in childReceipt.Detaylar)
            {
                var newLine = Copy(line);
                newLine.KayitNo = ++_nextLine;
                masterReceipt.Detaylar.Add(newLine);
                if (_ready.TryGetValue(line.KayitNo, out var readyQty))
                {
                    _ready[newLine.KayitNo] = readyQty;
                }
            }

            // DÜZELTME: Eski RestorantService.cs:1006-1009'daki NakitToplam ezilme hatası düzeltildi:
            // Nakit, Banka, Cari, Yemek Kartı ve İndirim toplamları her biri kendi alanında toplanır.
            masterReceipt.NakitToplam = (masterReceipt.NakitToplam ?? 0) + (childReceipt.NakitToplam ?? 0);
            masterReceipt.BankaToplam = (masterReceipt.BankaToplam ?? 0) + (childReceipt.BankaToplam ?? 0);
            masterReceipt.CariToplam = (masterReceipt.CariToplam ?? 0) + (childReceipt.CariToplam ?? 0);
            masterReceipt.YemekKartiToplam = (masterReceipt.YemekKartiToplam ?? 0) + (childReceipt.YemekKartiToplam ?? 0);
            masterReceipt.IndirimToplam = (masterReceipt.IndirimToplam ?? 0) + (childReceipt.IndirimToplam ?? 0);
            masterReceipt.KisiSayisi += childReceipt.KisiSayisi;

            childReceipt.Kapali = true;
            _closedAt[childReceipt.KayitNo] = Now;
            _mergedReceipts.Add(childReceipt.KayitNo);
        }

        Recalculate(masterReceipt);
        Log(actor, "Masalar birleştirildi", $"{masterTable.MasaAdi}: {request.BirlestirilecekMasaKayitNolar.Count} masa", masterReceipt.KayitNo);
        return masterReceipt;
    });

    public PosIslemKayitDTO PosIslemBaslat(PosIslemIstek istek, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin", "Garson");
        Require(!string.IsNullOrWhiteSpace(istek.IdempotencyKey), "Idempotency anahtarı zorunlu.");
        if (_posIdempotency.TryGetValue(istek.IdempotencyKey, out var existingId) &&
            _posTransactions.TryGetValue(existingId, out var existingTx))
        {
            return existingTx;
        }

        Table(istek.MasaKayitNo);
        var receipt = Open(istek.MasaKayitNo) ?? throw new ApiException(409, "Masada açık adisyon yok.");
        Require(receipt.KayitNo == istek.BaslikKayitNo, "Adisyon değişmiş; lütfen güncel adisyonu yükleyin.", 409);
        Require(istek.Tutar > 0 && istek.Tutar <= 10000000m && decimal.Round(istek.Tutar, 2) == istek.Tutar,
            "Tutar 0'dan büyük ve en fazla iki ondalıklı olmalıdır.");

        decimal oncekiOdenen = (receipt.NakitToplam ?? 0) + (receipt.BankaToplam ?? 0) +
                               (receipt.CariToplam ?? 0) + (receipt.YemekKartiToplam ?? 0) +
                               (receipt.IndirimToplam ?? 0);
        decimal kalan = receipt.GenelToplam - oncekiOdenen;
        Require(istek.Tutar <= kalan, "POS işlem tutarı kalan adisyon tutarından büyük olamaz.", 409);

        var islemId = Guid.NewGuid().ToString("N");
        var tx = new PosIslemKayitDTO
        {
            IslemId = islemId,
            IdempotencyKey = istek.IdempotencyKey,
            BaslikKayitNo = receipt.KayitNo,
            MasaKayitNo = istek.MasaKayitNo,
            Tutar = istek.Tutar,
            CihazTipi = istek.CihazTipi,
            Durum = istek.CihazTipi == PosCihazTipi.HariciManuelPos ? PosDurum.Onaylandi : PosDurum.CihazaGonderildi,
            AuthCode = istek.CihazTipi == PosCihazTipi.HariciManuelPos ? "MANUAL" : null,
            MaskedPan = istek.CihazTipi == PosCihazTipi.HariciManuelPos ? "************0000" : null,
            BaslangicZamani = Now,
            BitisZamani = istek.CihazTipi == PosCihazTipi.HariciManuelPos ? Now : null
        };

        _posTransactions[islemId] = tx;
        _posIdempotency[istek.IdempotencyKey] = islemId;
        return tx;
    });

    public PosIslemKayitDTO PosIslemSorgula(string islemId) => Read(() =>
    {
        return _posTransactions.TryGetValue(islemId, out var tx)
            ? tx
            : throw new ApiException(404, "POS işlem kaydı bulunamadı.");
    });

    public PosIslemKayitDTO PosIslemSimuleSonuc(string islemId, bool basarili, string? hataMesaji = null) => Change(() =>
    {
        if (!_posTransactions.TryGetValue(islemId, out var tx))
            throw new ApiException(404, "POS işlem kaydı bulunamadı.");

        Require(tx.Durum is PosDurum.CihazaGonderildi or PosDurum.Baslatildi,
            "İşlem zaten sonuçlandırılmış.", 409);

        if (basarili)
        {
            tx.Durum = PosDurum.Onaylandi;
            tx.AuthCode = "APP" + Random.Shared.Next(100000, 999999);
            tx.Rrn = "RRN" + Random.Shared.Next(10000000, 99999999);
            tx.MaskedPan = "************4582";
            tx.BitisZamani = Now;
        }
        else
        {
            tx.Durum = PosDurum.Reddedildi;
            tx.HataMesaji = hataMesaji ?? "Cihaz işlemi banka veya kullanıcı tarafından iptal edildi.";
            tx.BitisZamani = Now;
        }

        return tx;
    });

    public List<MutfakSiparisDTO> Kitchen() => Read(() => _receipts.Where(r => !r.Kapali &&
        r.Detaylar.Any(d => d.Miktar > _ready.GetValueOrDefault(d.KayitNo))).Select(r =>
        new MutfakSiparisDTO { BaslikKayitNo = r.KayitNo, MasaAdi = r.MasaAdi,
            BolumAdi = Table(r.MasaKayitNo!.Value).RestorantBolumAdi, SiparisZamani = r.KayitTarihi,
            BeklemeSuresi = (int)Math.Max(0, (Now - r.KayitTarihi!.Value).TotalMinutes),
            Satirlar = r.Detaylar.Select(d => new MutfakSatirDTO { DetayKayitNo = d.KayitNo,
                StokAdi = d.StokAdi, PorsiyonAdi = d.PorsiyonAdi, Miktar = d.Miktar,
                YazdirilanMiktar = d.YazdirilanMiktar ?? 0, HazirMiktar = _ready.GetValueOrDefault(d.KayitNo),
                SatirAciklama = d.SatirAciklama, PersonelAdi = d.PersonelAdi }).ToList() }).ToList());

    public List<MutfakBildirimDTO> KitchenEvents(StaffActor actor) => Read(() =>
    {
        Permission(actor, StaffOperation.Kitchen);
        return _kitchenEvents.Where(item => !item.Goruldu).OrderBy(item => item.KayitNo).ToList();
    });

    public MutfakBildirimDTO AcknowledgeKitchenEvent(long id, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Kitchen);
        var item = _kitchenEvents.FirstOrDefault(e => e.KayitNo == id)
            ?? throw new ApiException(404, "Mutfak bildirimi bulunamadı.");
        Require(!item.Goruldu, "Bildirim zaten görüldü.", 409);
        item.Goruldu = true;
        return item;
    });

    public AdisyonBaslikDTO MarkLineReady(long id, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Kitchen);
        var (receipt, line) = Line(id);
        Require(_ready.GetValueOrDefault(id) < line.Miktar, "Ürün zaten hazır.", 409);
        _ready[id] = line.Miktar;
        return receipt;
    });

    public AdisyonBaslikDTO MarkReady(long receiptId, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Kitchen);
        var receipt = _receipts.FirstOrDefault(r => r.KayitNo == receiptId)
            ?? throw new ApiException(404, "Adisyon bulunamadı.");
        Require(!receipt.Kapali, "Kapalı adisyon hazırlanamaz.", 409);
        foreach (var row in receipt.Detaylar) _ready[row.KayitNo] = row.Miktar;
        return receipt;
    });

    public GunlukRaporDTO DailyReport(DateOnly date, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        var closed = _receipts.Where(r => r.Kapali && !_mergedReceipts.Contains(r.KayitNo) &&
            BusinessDate(_closedAt[r.KayitNo]) == date).ToList();
        var entries = _audit.Where(item => BusinessDate(item.Tarih) == date).ToList();
        var payments = entries.Where(item => item.Islem == "Ödeme alındı").ToList();
        var cash = payments.Sum(item => item.Nakit);
        var bank = payments.Sum(item => item.Banka);
        var meal = payments.Sum(item => item.YemekKarti);
        var account = payments.Sum(item => item.Cari);
        var sales = closed.Sum(r => r.GenelToplam - (r.IndirimToplam ?? 0));
        return new GunlukRaporDTO {
            IsletmeTarihi = date, Bugun = BusinessToday, BaslangicSaati = _businessDayStartHour,
            VardiyaKapanisi = _shiftClosings.GetValueOrDefault(date),
            ToplamCiro = closed.Sum(r => r.GenelToplam - (r.IndirimToplam ?? 0)), ToplamAdisyon = closed.Count,
            AcikAdisyon = _receipts.Count(r => !r.Kapali && BusinessDate(r.KayitTarihi!.Value) == date),
            NakitToplam = closed.Sum(r => r.NakitToplam ?? 0), BankaToplam = closed.Sum(r => r.BankaToplam ?? 0),
            CariToplam = closed.Sum(r => r.CariToplam ?? 0), YemekKartiToplam = closed.Sum(r => r.YemekKartiToplam ?? 0),
            IndirimToplam = closed.Sum(r => r.IndirimToplam ?? 0),
            SaatlikCiro = closed.GroupBy(r => RestaurantTime(_closedAt[r.KayitNo]).Hour).OrderBy(g => g.Key).Select(g =>
                new SaatlikCiroDTO { Saat = g.Key, Ciro = g.Sum(r => r.GenelToplam - (r.IndirimToplam ?? 0)), AdisyonSayisi = g.Count() }).ToList(),
            EnCokSatan = closed.SelectMany(r => r.Detaylar).GroupBy(d => d.StokKayitNo).Select(g => new UrunSatisDTO {
                StokAdi = g.First().StokAdi, ToplamMiktar = g.Sum(d => d.Miktar), ToplamTutar = g.Sum(d => d.SatirTutari)
            }).OrderByDescending(p => p.ToplamMiktar).Take(10).ToList(),
            Mutabakat = new GunlukMutabakatDTO {
                KapananSatis = sales, Tahsilat = cash + bank + meal + account,
                Fark = sales - cash - bank - meal - account,
                Nakit = cash, Banka = bank, YemekKarti = meal, Cari = account,
                Indirim = payments.Sum(item => item.Indirim), OdemeSayisi = payments.Count,
                SilinenUrunTutari = entries.Where(item => item.Islem == "Ürün silindi").Sum(item => item.Tutar),
                IptalTutari = entries.Where(item => item.Islem == "Ürün iptal edildi").Sum(item => item.Tutar),
                ZayiTutari = entries.Where(item => item.Islem == "Zayi kaydedildi").Sum(item => item.Tutar),
                IkramTutari = entries.Where(item => item.Islem == "İkram verildi").Sum(item => item.Tutar)
            }
        };
    });

    public VardiyaKapanisDTO CloseShift(VardiyaKapanisRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        Require(request.IsletmeTarihi != default && request.IsletmeTarihi < BusinessToday,
            "Yalnızca tamamlanmış işletme günü kapatılabilir.");
        Require(!_shiftClosings.ContainsKey(request.IsletmeTarihi), "Bu işletme günü zaten kapatıldı.", 409);
        Require(request.SayilanNakit >= 0 && request.SayilanNakit <= 10000000m &&
            decimal.Round(request.SayilanNakit, 2) == request.SayilanNakit, "Sayılan nakit geçersiz.");
        Note(request.Aciklama);
        var expected = _audit.Where(item => BusinessDate(item.Tarih) == request.IsletmeTarihi &&
            item.Islem == "Ödeme alındı").Sum(item => item.Nakit);
        var close = new VardiyaKapanisDTO { IsletmeTarihi = request.IsletmeTarihi,
            KapanisZamani = Now, PersonelId = actor.Id, PersonelAdi = actor.Name,
            BeklenenNakit = expected, SayilanNakit = request.SayilanNakit,
            NakitFarki = request.SayilanNakit - expected, Aciklama = request.Aciklama?.Trim() };
        _shiftClosings.Add(request.IsletmeTarihi, close);
        Log(actor, "Vardiya kapatıldı", $"{request.IsletmeTarihi}: sayılan nakit {request.SayilanNakit:n2}");
        return close;
    });

    public List<RezervasyonDTO> Reservations(DateOnly? date, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _reservations.Where(r => date is null || DateOnly.FromDateTime(RestaurantTime(r.RezervasyonTarihi)) == date)
            .OrderBy(r => r.RezervasyonTarihi).ToList();
    });
    public RezervasyonDTO Reserve(RezervasyonEkleRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var table = Table(request.MasaKayitNo);
        Require(!table.BirlesmisMasa && !table.AnaMasa, "Birleşmiş masa rezerve edilemez.", 409);
        Require(!string.IsNullOrWhiteSpace(request.MusteriAdi) && request.MusteriAdi.Length <= 100, "Müşteri adı zorunlu ve en fazla 100 karakter olmalı.");
        Require(request.Telefon is null || (request.Telefon.Length <= 30 && request.Telefon.All(c => char.IsAsciiDigit(c) || " +-()".Contains(c))), "Telefon geçersiz.");
        Note(request.Aciklama);
        Require(request.KisiSayisi is >= 1 and <= 20, "Kişi sayısı 1–20 olmalı.");
        Require(request.RezervasyonTarihi != default && request.RezervasyonTarihi.Kind != DateTimeKind.Unspecified,
            "Rezervasyon tarihi saat dilimi veya Z içermeli.");
        var date = request.RezervasyonTarihi.ToUniversalTime();
        Require(date > Now && date <= Now.AddYears(1), "Rezervasyon gelecek bir yıl içinde olmalı.");
        Require(!_reservations.Any(r => r.MasaKayitNo == table.MasaId && Math.Abs((r.RezervasyonTarihi - date).TotalHours) < 2),
            "Bu masa için iki saatlik aralıkta rezervasyon var.", 409);
        Require(date > Now.AddHours(2) || Open(table.MasaId) is null, "Yakın rezervasyon için masa dolu.", 409);
        var reservation = new RezervasyonDTO { KayitNo = ++_nextReservation, MasaKayitNo = table.MasaId,
            MasaAdi = table.MasaAdi, MusteriAdi = request.MusteriAdi.Trim(), Telefon = request.Telefon?.Trim(),
            RezervasyonTarihi = date, KisiSayisi = request.KisiSayisi, Aciklama = request.Aciklama?.Trim() };
        _reservations.Add(reservation); return reservation;
    });
    public RezervasyonDTO DeleteReservation(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var reservation = _reservations.FirstOrDefault(r => r.KayitNo == id)
            ?? throw new ApiException(404, "Rezervasyon bulunamadı.");
        _reservations.Remove(reservation); return reservation;
    });

    private void Seed()
    {
        string[][] names = [["Mercimek Çorbası", "Çoban Salata", "Humus"], ["Izgara Köfte", "Tavuk Şiş", "Sebzeli Makarna"], ["Künefe", "Sütlaç"], ["Ayran", "Türk Kahvesi", "Su"]];
        string[] categories = ["Başlangıçlar", "Ana Yemekler", "Tatlılar", "İçecekler"];
        decimal[][] prices = [[95m, 120m, 135m], [320m, 290m, 240m], [180m, 110m], [45m, 75m, 25m]];
        long productId = 0;
        for (var c = 0; c < categories.Length; c++)
        {
            var category = new MenuKategoriDTO { KayitNo = c + 1, GrupKodu = $"G{c + 1}", GrupAdi = categories[c], SiraNo = c };
            for (var p = 0; p < names[c].Length; p++)
            {
                var product = new MenuUrunDTO { KayitNo = ++productId, StokKodu = $"U{productId:000}", StokAdi = names[c][p],
                    SatisFiyati = prices[c][p], Birimi = "Adet", GrupKayitNo = category.KayitNo, GrupAdi = category.GrupAdi, Aktif = true };
                if (c == 1) product.Porsiyonlar = [new() { KayitNo = (int)productId * 10, PorsiyonAdi = "Tam", Fiyat = product.SatisFiyati },
                    new() { KayitNo = (int)productId * 10 + 1, PorsiyonAdi = "Yarım", Fiyat = product.SatisFiyati * 0.6m }];
                category.Urunler.Add(product);
            }
            _menu.Add(category);
        }
        for (var i = 1; i <= 12; i++) _tables.Add(new RestorantMasaDTO { MasaId = i, MasaKodu = $"M{i:00}", MasaAdi = $"Masa {i}",
            RestorantBolumuKayitNo = i <= 8 ? 1 : 2, RestorantBolumKodu = i <= 8 ? "SALON" : "BAHCE",
            RestorantBolumAdi = i <= 8 ? "Salon" : "Bahçe", LocationX = ((i - 1) % 4) * 180, LocationY = ((i - 1) / 4) * 160 });
        var waiter = new StaffActor(2, "Demo Garson", "Garson");
        AddOrder(new() { MasaKayitNo = 1, StokKayitNo = 4, Miktar = 2, SatirAciklama = "Az pişmiş" }, waiter);
        AddOrder(new() { MasaKayitNo = 1, StokKayitNo = 9, Miktar = 2 }, waiter);
        AddOrder(new() { MasaKayitNo = 3, StokKayitNo = 5, Miktar = 1, SatirAciklama = "Soğansız" }, waiter);
        var closed = AddOrder(new() { MasaKayitNo = 10, StokKayitNo = 6, Miktar = 2 }, waiter);
        Pay(10, new() { BaslikKayitNo = closed.KayitNo, BankaTutar = closed.GenelToplam }, new(1, "Demo Yönetici", "Admin"));
    }
}
