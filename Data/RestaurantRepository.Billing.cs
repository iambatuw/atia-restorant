using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>Product options, VAT, item-based payment, receipt history, payment correction, refunds and printing.</summary>
public sealed partial class RestaurantRepository
{
    private const string PaymentAction = "Ödeme alındı";
    private const string PaymentCorrectionAction = "Ödeme düzeltildi";
    private const string RefundAction = "İade yapıldı";
    private static readonly int[] VatRates = [0, 1, 10, 20];
    private long _nextRefund;
    private int _nextOption = 5000;

    private static bool IsTablePaymentEntry(IslemKaydiDTO entry) =>
        entry.Islem is PaymentAction or PaymentCorrectionAction or RefundAction;
    private static decimal Paid(AdisyonBaslikDTO receipt) => (receipt.NakitToplam ?? 0) + (receipt.BankaToplam ?? 0) +
        (receipt.CariToplam ?? 0) + (receipt.YemekKartiToplam ?? 0) + (receipt.IndirimToplam ?? 0);
    private static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    private static void Amount(decimal value, string label) => Require(value >= 0 && value <= 10000000m &&
        decimal.Round(value, 2) == value, $"{label} negatif olamaz ve en fazla iki ondalıklı olmalı.");

    // ───── SEÇENEKLER ─────
    /// <summary>Validates selected option ids against the product's groups and returns the price supplement.</summary>
    private static (decimal Extra, List<SatirSecimDTO> Choices) ResolveOptions(MenuUrunDTO product, IReadOnlyCollection<int>? selected)
    {
        var ids = selected ?? [];
        Require(ids.Count <= 20 && ids.Distinct().Count() == ids.Count, "Seçenekler yinelenemez; en fazla 20 seçenek seçilebilir.");
        var choices = new List<SatirSecimDTO>();
        foreach (var id in ids)
        {
            var group = product.SecenekGruplari.FirstOrDefault(g => g.Secenekler.Any(o => o.KayitNo == id))
                ?? throw new ApiException(400, $"{product.StokAdi} için seçilen seçenek bulunamadı; menü güncellenmiş olabilir.");
            var option = group.Secenekler.Single(o => o.KayitNo == id);
            choices.Add(new SatirSecimDTO { SecenekKayitNo = id, GrupAdi = group.Ad, SecenekAdi = option.Ad, EkFiyat = option.EkFiyat });
        }
        foreach (var group in product.SecenekGruplari)
        {
            var count = choices.Count(c => group.Secenekler.Any(o => o.KayitNo == c.SecenekKayitNo));
            Require(!group.Zorunlu || count > 0, $"{product.StokAdi} için “{group.Ad}” seçimi zorunlu.");
            Require(group.CokluSecim || count <= 1, $"{product.StokAdi} için “{group.Ad}” grubundan yalnızca bir seçenek seçilebilir.");
        }
        // Keep the menu's group and option order regardless of tap order.
        var order = product.SecenekGruplari.SelectMany(g => g.Secenekler).Select((o, i) => (o.KayitNo, i)).ToDictionary(x => x.KayitNo, x => x.i);
        return (choices.Sum(c => c.EkFiyat), choices.OrderBy(c => order[c.SecenekKayitNo]).ToList());
    }

    private List<SecenekGrubuDTO> NormalizeOptionGroups(List<SecenekGrubuDTO>? groups)
    {
        var list = groups ?? [];
        Require(list.Count <= 8 && list.All(g => g is not null && g.Secenekler is not null), "En fazla 8 seçenek grubu tanımlanabilir.");
        var result = new List<SecenekGrubuDTO>();
        foreach (var group in list)
        {
            var name = Mandatory(group.Ad, 40, "Seçenek grubu adı");
            Require(group.Secenekler.Count is >= 1 and <= 20 && group.Secenekler.All(o => o is not null), $"“{name}” grubunda 1–20 seçenek olmalı.");
            var options = group.Secenekler.Select(option =>
            {
                Require(option.EkFiyat >= 0 && option.EkFiyat <= 100000 && decimal.Round(option.EkFiyat, 2) == option.EkFiyat, "Seçenek ek fiyatı geçersiz.");
                return new SecenekDTO { KayitNo = ++_nextOption, Ad = Mandatory(option.Ad, 40, "Seçenek adı"), EkFiyat = option.EkFiyat };
            }).ToList();
            Require(options.Select(o => o.Ad).Distinct(StringComparer.OrdinalIgnoreCase).Count() == options.Count, $"“{name}” grubundaki seçenek adları farklı olmalı.");
            result.Add(new SecenekGrubuDTO { KayitNo = ++_nextOption, Ad = name, Zorunlu = group.Zorunlu, CokluSecim = group.CokluSecim, Secenekler = options });
        }
        Require(result.Select(g => g.Ad).Distinct(StringComparer.OrdinalIgnoreCase).Count() == result.Count, "Seçenek grubu adları farklı olmalı.");
        return result;
    }

    private static string? NoteWithChoices(string? note, IEnumerable<SatirSecimDTO> choices)
    {
        var text = string.Join(", ", choices.Select(c => c.SecenekAdi));
        return string.IsNullOrEmpty(text) ? note : string.IsNullOrWhiteSpace(note) ? text : $"{text} · {note}";
    }

    private void SeedOptions()
    {
        var products = _menu.SelectMany(c => c.Urunler).ToDictionary(p => p.KayitNo);
        products[4].SecenekGruplari = NormalizeOptionGroups([
            new() { Ad = "Ekstralar", CokluSecim = true, Secenekler = [new() { Ad = "Ekstra kaşar", EkFiyat = 30 },
                new() { Ad = "Acılı sos", EkFiyat = 10 }, new() { Ad = "Közlenmiş biber" }] }]);
        products[5].SecenekGruplari = NormalizeOptionGroups([
            new() { Ad = "Yanında", Secenekler = [new() { Ad = "Pilav" }, new() { Ad = "Patates", EkFiyat = 15 }, new() { Ad = "Bulgur" }] }]);
        products[10].SecenekGruplari = NormalizeOptionGroups([
            new() { Ad = "Şeker", Zorunlu = true, Secenekler = [new() { Ad = "Sade" }, new() { Ad = "Az şekerli" },
                new() { Ad = "Orta" }, new() { Ad = "Şekerli" }] }]);
        products[4].Barkod = "8690000000041";
        products[9].Barkod = "8690000000096";
    }

    // ───── KDV ─────
    /// <summary>VAT-inclusive totals split by rate. A receipt discount is spread over the rates by their share.</summary>
    public static List<KdvSatiriDTO> Vat(IEnumerable<(int Rate, decimal Amount)> lines, decimal discount = 0)
    {
        var groups = lines.GroupBy(l => l.Rate).Select(g => (Rate: g.Key, Gross: g.Sum(l => l.Amount))).Where(g => g.Gross != 0)
            .OrderBy(g => g.Rate).ToList();
        var total = groups.Sum(g => g.Gross);
        var remaining = Math.Min(Math.Max(discount, 0), Math.Max(total, 0));
        var result = new List<KdvSatiriDTO>();
        for (var i = 0; i < groups.Count; i++)
        {
            var share = i == groups.Count - 1 || total == 0 ? remaining : Money(discount * groups[i].Gross / total);
            share = Math.Min(share, remaining);
            remaining -= share;
            var net = groups[i].Gross - share;
            var baseAmount = Money(net / (1 + groups[i].Rate / 100m));
            result.Add(new KdvSatiriDTO { Oran = groups[i].Rate, Toplam = net, Matrah = baseAmount, Kdv = net - baseAmount });
        }
        return result;
    }
    private static List<KdvSatiriDTO> SumVat(IEnumerable<KdvSatiriDTO> rows) => rows.GroupBy(r => r.Oran).OrderBy(g => g.Key)
        .Select(g => new KdvSatiriDTO { Oran = g.Key, Matrah = g.Sum(r => r.Matrah), Kdv = g.Sum(r => r.Kdv), Toplam = g.Sum(r => r.Toplam) }).ToList();

    // ───── KİŞİ SAYISI ─────
    public AdisyonBaslikDTO SetGuestCount(long tableId, KisiSayisiRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Order);
        Table(tableId);
        Require(request.KisiSayisi is >= 1 and <= 50, "Kişi sayısı 1–50 olmalı.");
        var receipt = Open(tableId) ?? throw new ApiException(409, "Kişi sayısı için önce masaya sipariş ekleyin.");
        receipt.KisiSayisi = request.KisiSayisi;
        Log(actor, "Kişi sayısı değişti", $"{receipt.MasaAdi}: {request.KisiSayisi} kişi", receipt.KayitNo);
        return receipt;
    });

    // ───── ÜRÜN BAZLI ÖDEME ─────
    private static decimal ItemPaymentAmount(AdisyonBaslikDTO receipt, List<AyrilanSatir> items)
    {
        Require(items.Count <= 100 && items.All(i => i is not null), "Ödenecek ürün listesi geçersiz.");
        Require(items.Select(i => i.DetayKayitNo).Distinct().Count() == items.Count, "Aynı ürün satırı birden fazla kez seçilemez.");
        decimal total = 0;
        foreach (var item in items)
        {
            Quantity(item.Miktar);
            var line = receipt.Detaylar.FirstOrDefault(d => d.KayitNo == item.DetayKayitNo)
                ?? throw new ApiException(404, "Ödenecek ürün adisyonda bulunamadı; adisyonu yenileyin.");
            var open = line.Miktar - line.OdenenMiktar;
            Require(item.Miktar <= open, $"{line.StokAdi} için ödenmemiş miktar {open:0.###}.", 409);
            // The last open unit takes the rounding remainder so line payments add up to the line total.
            total += item.Miktar == open ? line.SatirTutari - line.OdenenTutar : line.Ikram ? 0 : Money(item.Miktar * line.BirimFiyat);
        }
        return total;
    }
    private static void ApplyItemPayment(AdisyonBaslikDTO receipt, List<AyrilanSatir> items)
    {
        foreach (var item in items)
        {
            var line = receipt.Detaylar.Single(d => d.KayitNo == item.DetayKayitNo);
            var open = line.Miktar - line.OdenenMiktar;
            line.OdenenTutar += item.Miktar == open ? line.SatirTutari - line.OdenenTutar : line.Ikram ? 0 : Money(item.Miktar * line.BirimFiyat);
            line.OdenenMiktar += item.Miktar;
        }
    }

    // ───── ADİSYON GEÇMİŞİ ─────
    private AdisyonBaslikDTO ReceiptByNumber(long id) => _receipts.FirstOrDefault(r => r.KayitNo == id)
        ?? throw new ApiException(404, "Adisyon bulunamadı.");
    private AdisyonOzetDTO Summary(AdisyonBaslikDTO r) => new()
    {
        KayitNo = r.KayitNo, MasaKayitNo = r.MasaKayitNo, MasaAdi = r.MasaAdi, PersonelAdi = r.PersonelAdi,
        AcilisTarihi = r.KayitTarihi, KapanisTarihi = _closedAt.TryGetValue(r.KayitNo, out var closed) ? closed : null,
        Kapali = r.Kapali, Birlesti = _mergedReceipts.Contains(r.KayitNo), GenelToplam = r.GenelToplam,
        Indirim = r.IndirimToplam ?? 0, Nakit = r.NakitToplam ?? 0, Banka = r.BankaToplam ?? 0,
        YemekKarti = r.YemekKartiToplam ?? 0, Cari = r.CariToplam ?? 0, Iade = r.IadeToplam,
        UrunSayisi = (int)Math.Ceiling(r.Detaylar.Sum(d => d.Miktar))
    };
    private bool Correctable(AdisyonBaslikDTO r) => r.Kapali && !_mergedReceipts.Contains(r.KayitNo) && r.Iadeler.Count == 0 &&
        _closedAt.TryGetValue(r.KayitNo, out var closed) && BusinessDate(closed) == BusinessToday;
    private bool Refundable(AdisyonBaslikDTO r) => r.Kapali && !_mergedReceipts.Contains(r.KayitNo) &&
        _closedAt.TryGetValue(r.KayitNo, out var closed) && closed >= Now.AddDays(-30) &&
        r.IadeToplam < (r.NakitToplam ?? 0) + (r.BankaToplam ?? 0) + (r.YemekKartiToplam ?? 0) + (r.CariToplam ?? 0);

    /// <summary>Receipts closed on a business day; open receipts are listed regardless of date.</summary>
    public List<AdisyonOzetDTO> ReceiptHistory(DateOnly date, bool includeOpen, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _receipts.Where(r => r.Kapali ? _closedAt.TryGetValue(r.KayitNo, out var closed) && BusinessDate(closed) == date : includeOpen)
            .OrderByDescending(r => _closedAt.GetValueOrDefault(r.KayitNo, r.KayitTarihi ?? DateTime.MinValue)).Select(Summary).ToList();
    });

    public AdisyonGecmisDTO ReceiptDetail(long id, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        var receipt = ReceiptByNumber(id);
        return new AdisyonGecmisDTO { Adisyon = receipt, KapanisTarihi = _closedAt.TryGetValue(id, out var closed) ? closed : null,
            Birlesti = _mergedReceipts.Contains(id), Duzeltilebilir = Correctable(receipt), IadeEdilebilir = Refundable(receipt),
            Islemler = _audit.Where(a => a.AdisyonNo == id).OrderBy(a => a.KayitNo).ToList() };
    });

    public AdisyonKonumDTO LocateReceipt(long id, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin", "Garson");
        var receipt = ReceiptByNumber(id);
        return new AdisyonKonumDTO { KayitNo = receipt.KayitNo, MasaKayitNo = receipt.MasaKayitNo, MasaAdi = receipt.MasaAdi, Kapali = receipt.Kapali };
    });

    public AdisyonBaslikDTO MarkReceiptPrinted(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin", "Garson");
        var receipt = ReceiptByNumber(id);
        receipt.YazdirmaSayisi++;
        Log(actor, "Adisyon yazdırıldı", $"{receipt.MasaAdi}: {receipt.YazdirmaSayisi}. çıktı", receipt.KayitNo);
        return receipt;
    });

    // ───── ÖDEME DÜZELTME VE İADE ─────
    public AdisyonBaslikDTO CorrectPayment(long id, OdemeDuzeltRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment);
        var receipt = ReceiptByNumber(id);
        Require(receipt.Kapali, "Açık adisyonda ödeme düzeltilmez; ödeme penceresini kullanın.", 409);
        Require(Correctable(receipt), "Yalnızca bugünkü işletme gününde kapanmış, iade görmemiş ve birleştirilmemiş adisyonun ödemesi düzeltilebilir.", 409);
        Amount(request.Nakit, "Nakit"); Amount(request.Banka, "Banka"); Amount(request.YemekKarti, "Yemek kartı"); Amount(request.Cari, "Cari");
        var reason = Mandatory(request.Gerekce, 200, "Gerekçe");
        var oldNakit = receipt.NakitToplam ?? 0; var oldBanka = receipt.BankaToplam ?? 0;
        var oldYemek = receipt.YemekKartiToplam ?? 0; var oldCari = receipt.CariToplam ?? 0;
        Require(request.Nakit + request.Banka + request.YemekKarti + request.Cari == oldNakit + oldBanka + oldYemek + oldCari,
            "Düzeltilen ödemelerin toplamı alınan tahsilatla aynı olmalı.");
        Require(request.Nakit != oldNakit || request.Banka != oldBanka || request.YemekKarti != oldYemek || request.Cari != oldCari ||
            request.YemekKartiKayitNo != receipt.YemekKartiKayitNo, "Ödeme dağılımı değişmedi.");
        var card = MealCard(request.YemekKarti, request.YemekKartiKayitNo);
        receipt.NakitToplam = request.Nakit; receipt.BankaToplam = request.Banka;
        receipt.YemekKartiToplam = request.YemekKarti; receipt.CariToplam = request.Cari;
        receipt.YemekKartiKayitNo = card?.KayitNo; receipt.YemekKartiAdi = card?.Ad;
        _audit.Add(new IslemKaydiDTO { KayitNo = ++_nextAudit, Tarih = Now, Islem = PaymentCorrectionAction,
            Aciklama = $"{receipt.MasaAdi}: {reason}", AdisyonNo = receipt.KayitNo, PersonelId = actor.Id, PersonelAdi = actor.Name,
            Nakit = request.Nakit - oldNakit, Banka = request.Banka - oldBanka, YemekKarti = request.YemekKarti - oldYemek,
            Cari = request.Cari - oldCari, YemekKartiKayitNo = card?.KayitNo, YemekKartiAdi = card?.Ad });
        return receipt;
    });

    public AdisyonBaslikDTO Refund(long id, IadeRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment);
        var receipt = ReceiptByNumber(id);
        Require(receipt.Kapali, "Açık adisyon iade edilemez; ürünü iptal edin.", 409);
        Require(Refundable(receipt), "İade yalnızca son 30 günde kapanmış, birleştirilmemiş ve tamamı iade edilmemiş adisyonlarda yapılabilir.", 409);
        Amount(request.Nakit, "Nakit iade"); Amount(request.Banka, "Banka iade"); Amount(request.YemekKarti, "Yemek kartı iade"); Amount(request.Cari, "Cari iade");
        var reason = Mandatory(request.Gerekce, 200, "Gerekçe");
        var total = request.Nakit + request.Banka + request.YemekKarti + request.Cari;
        Require(total > 0, "İade tutarı sıfırdan büyük olmalı.");
        Require(request.Nakit <= (receipt.NakitToplam ?? 0) - receipt.Iadeler.Sum(i => i.Nakit), "Nakit iade, nakit tahsilattan büyük olamaz.", 409);
        Require(request.Banka <= (receipt.BankaToplam ?? 0) - receipt.Iadeler.Sum(i => i.Banka), "Banka iadesi, banka tahsilatından büyük olamaz.", 409);
        Require(request.YemekKarti <= (receipt.YemekKartiToplam ?? 0) - receipt.Iadeler.Sum(i => i.YemekKarti), "Yemek kartı iadesi, yemek kartı tahsilatından büyük olamaz.", 409);
        Require(request.Cari <= (receipt.CariToplam ?? 0) - receipt.Iadeler.Sum(i => i.Cari), "Cari iade, cari tahsilattan büyük olamaz.", 409);
        receipt.Iadeler.Add(new IadeKaydiDTO { KayitNo = ++_nextRefund, Tarih = Now, Nakit = request.Nakit, Banka = request.Banka,
            YemekKarti = request.YemekKarti, Cari = request.Cari, Gerekce = reason, PersonelId = actor.Id, PersonelAdi = actor.Name });
        _audit.Add(new IslemKaydiDTO { KayitNo = ++_nextAudit, Tarih = Now, Islem = RefundAction, Aciklama = $"{receipt.MasaAdi}: {reason}",
            AdisyonNo = receipt.KayitNo, PersonelId = actor.Id, PersonelAdi = actor.Name, Tutar = -total,
            Nakit = -request.Nakit, Banka = -request.Banka, YemekKarti = -request.YemekKarti, Cari = -request.Cari,
            YemekKartiKayitNo = request.YemekKarti > 0 ? receipt.YemekKartiKayitNo : null, YemekKartiAdi = request.YemekKarti > 0 ? receipt.YemekKartiAdi : null });
        return receipt;
    });
}
