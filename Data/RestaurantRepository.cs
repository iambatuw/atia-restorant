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
    private readonly Dictionary<long, decimal> _ready = [];
    private readonly Dictionary<long, DateTime> _closedAt = [];
    private readonly Dictionary<string, PosIslemKayitDTO> _posTransactions = [];
    private readonly Dictionary<string, string> _posIdempotency = [];
    private long _nextReceipt = 1000, _nextLine = 10000, _nextReservation = 100;
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
    private static DateOnly BusinessDate(DateTime utc) => DateOnly.FromDateTime(RestaurantTime(utc));
    public DateOnly BusinessToday => BusinessDate(Now);

    public RestaurantRepository(BackendMode mode, TimeProvider clock)
    {
        _mode = mode;
        _clock = clock;
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
    public AdisyonBaslikDTO? Receipt(long tableId) => Read(() => { Table(tableId); return Open(tableId); });

    public AdisyonBaslikDTO AddOrder(SiparisEkleRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Garson", "Admin");
        Quantity(request.Miktar); Note(request.SatirAciklama);
        Require(!request.Ikram || actor.IsAdmin, "İkram yalnızca yönetici tarafından verilebilir.", 403);
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
        return receipt;
    });

    public AdisyonBaslikDTO UpdateOrder(long id, SiparisGuncelleRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Garson", "Admin");
        Require(request.DetayKayitNo == 0 || request.DetayKayitNo == id, "URL ve sipariş kimliği uyuşmuyor.");
        Quantity(request.Miktar); Note(request.SatirAciklama);
        var (receipt, line) = Line(id);
        Require(actor.IsAdmin || request.Ikram == line.Ikram, "İkram yalnızca yönetici tarafından değiştirilebilir.", 403);
        // Clamp on reduction so decreasing then increasing never resurrects readiness.
        _ready[id] = Math.Min(_ready.GetValueOrDefault(id), request.Miktar);
        line.Miktar = request.Miktar;
        line.SatirAciklama = request.SatirAciklama?.Trim();
        line.Ikram = request.Ikram;
        Recalculate(receipt);
        return receipt;
    });

    public AdisyonBaslikDTO DeleteOrder(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Garson", "Admin");
        var (receipt, line) = Line(id);
        receipt.Detaylar.Remove(line); _ready.Remove(id);
        Recalculate(receipt);
        // Keep even an empty receipt open until an administrator explicitly closes it.
        return receipt;
    });

    public AdisyonBaslikDTO Pay(long tableId, OdemeRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin"); Table(tableId);
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

        if (!string.IsNullOrWhiteSpace(request.PosIslemId) && _posTransactions.TryGetValue(request.PosIslemId, out var posTx))
        {
            Require(posTx.Basarili, "POS işlemi onaylanmamış veya belirsiz durumda.");
            posTx.Durum = PosDurum.ErpKaydedildi;
        }

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
        Require(Open(targetTable.MasaId) is null && !Reserved(targetTable.MasaId),
            "Hedef masa boş ve rezervasyonsuz olmalı.", 409);
        Require(request.AyrilanSatirlar is { Count: > 0 }, "Ayrılacak en az bir sipariş satırı seçilmelidir.");

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

        foreach (var childTableId in request.BirlestirilecekMasaKayitNolar)
        {
            var childTable = Table(childTableId);
            var childReceipt = Open(childTable.MasaId) ?? throw new ApiException(409, $"Masa {childTable.MasaAdi} üzerinde açık adisyon bulunamadı.");
            Require(childReceipt.KayitNo != masterReceipt.KayitNo, "Birleştirilecek adisyon ana adisyon ile aynı olamaz.");

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
        }

        Recalculate(masterReceipt);
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

    public AdisyonBaslikDTO MarkReady(long receiptId, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Mutfak", "Admin");
        var receipt = _receipts.FirstOrDefault(r => r.KayitNo == receiptId)
            ?? throw new ApiException(404, "Adisyon bulunamadı.");
        Require(!receipt.Kapali, "Kapalı adisyon hazırlanamaz.", 409);
        foreach (var row in receipt.Detaylar) _ready[row.KayitNo] = row.Miktar;
        return receipt;
    });

    public GunlukRaporDTO DailyReport(DateOnly date, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        var closed = _receipts.Where(r => r.Kapali && BusinessDate(_closedAt[r.KayitNo]) == date).ToList();
        return new GunlukRaporDTO {
            ToplamCiro = closed.Sum(r => r.GenelToplam - (r.IndirimToplam ?? 0)), ToplamAdisyon = closed.Count,
            AcikAdisyon = _receipts.Count(r => !r.Kapali && BusinessDate(r.KayitTarihi!.Value) == date),
            NakitToplam = closed.Sum(r => r.NakitToplam ?? 0), BankaToplam = closed.Sum(r => r.BankaToplam ?? 0),
            CariToplam = closed.Sum(r => r.CariToplam ?? 0), YemekKartiToplam = closed.Sum(r => r.YemekKartiToplam ?? 0),
            IndirimToplam = closed.Sum(r => r.IndirimToplam ?? 0),
            SaatlikCiro = closed.GroupBy(r => RestaurantTime(_closedAt[r.KayitNo]).Hour).OrderBy(g => g.Key).Select(g =>
                new SaatlikCiroDTO { Saat = g.Key, Ciro = g.Sum(r => r.GenelToplam - (r.IndirimToplam ?? 0)), AdisyonSayisi = g.Count() }).ToList(),
            EnCokSatan = closed.SelectMany(r => r.Detaylar).GroupBy(d => d.StokKayitNo).Select(g => new UrunSatisDTO {
                StokAdi = g.First().StokAdi, ToplamMiktar = g.Sum(d => d.Miktar), ToplamTutar = g.Sum(d => d.SatirTutari)
            }).OrderByDescending(p => p.ToplamMiktar).Take(10).ToList()
        };
    });

    public List<RezervasyonDTO> Reservations(DateOnly? date, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _reservations.Where(r => date is null || BusinessDate(r.RezervasyonTarihi) == date)
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
