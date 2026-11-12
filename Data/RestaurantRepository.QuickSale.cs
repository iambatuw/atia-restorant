using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>
/// Counter / takeaway sale without a table: the receipt is created and paid in one step and still goes to
/// the kitchen. It stays on the kitchen screen until its lines are marked ready.
/// </summary>
public sealed partial class RestaurantRepository
{
    private Dictionary<string, long> _quickSaleIdempotency = [];
    private int _quickSaleCount;

    public AdisyonBaslikDTO QuickSale(HizliSatisRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment);
        Require(Guid.TryParse(request.IdempotencyKey, out _), "İşlem anahtarı geçersiz.");
        if (_quickSaleIdempotency.TryGetValue(request.IdempotencyKey, out var existing)) return ReceiptByNumber(existing);
        Require(request.Satirlar is { Count: > 0 and <= 50 } && request.Satirlar.All(r => r is not null), "En az bir, en fazla 50 ürün seçilmeli.");
        var customer = Optional(request.MusteriAdi, 60, "Müşteri adı");
        decimal[] values = [request.NakitTutar, request.BankaTutar, request.YemekKartiTutar, request.CariTutar, request.IndirimTutar];
        Require(values.All(v => v >= 0 && v <= 10000000m && decimal.Round(v, 2) == v), "Ödemeler negatif olamaz ve en fazla iki ondalıklı olmalı.");

        var receipt = new AdisyonBaslikDTO { KayitNo = ++_nextReceipt, MasaKayitNo = null, HizliSatis = true,
            MasaAdi = customer is null ? $"Hızlı satış {++_quickSaleCount}" : $"Hızlı satış · {customer}",
            PersonelKayitNo = actor.Id, PersonelAdi = actor.Name, Tarih = Now, KayitTarihi = Now, KisiSayisi = 1 };
        foreach (var row in request.Satirlar)
        {
            Quantity(row.Miktar); Note(row.SatirAciklama);
            var product = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == row.StokKayitNo && p.Aktif)
                ?? throw new ApiException(404, "Aktif ürün bulunamadı.");
            var portion = row.PorsiyonKayitNo.HasValue ? product.Porsiyonlar.FirstOrDefault(p => p.KayitNo == row.PorsiyonKayitNo) : null;
            Require(!row.PorsiyonKayitNo.HasValue || portion is not null, "Ürüne ait porsiyon bulunamadı.");
            var (extra, choices) = ResolveOptions(product, row.SecenekKayitNolar);
            receipt.Detaylar.Add(new AdisyonDetayDTO { KayitNo = ++_nextLine, StokKayitNo = product.KayitNo, StokKodu = product.StokKodu,
                StokAdi = product.StokAdi, Miktar = row.Miktar, BirimFiyat = (portion?.Fiyat ?? product.SatisFiyati) + extra,
                PorsiyonKayitNo = portion?.KayitNo, PorsiyonAdi = portion?.PorsiyonAdi, SatirAciklama = row.SatirAciklama?.Trim(),
                PersonelKayitNo = actor.Id, PersonelAdi = actor.Name, KdvOrani = product.KdvOrani, Secimler = choices });
        }
        Recalculate(receipt);
        Require(request.IndirimTutar <= receipt.GenelToplam, "İndirim satış tutarından büyük olamaz.");
        Require(values.Sum() == receipt.GenelToplam,
            $"Ödeme ve indirim toplamı satış tutarıyla ({receipt.GenelToplam:n2} TL) tam eşleşmeli.", 409);
        var card = MealCard(request.YemekKartiTutar, request.YemekKartiKayitNo);
        var account = ChargeAccount(request.CariTutar, request.CariHesapKayitNo, receipt.KayitNo, receipt.MasaAdi, actor.Name);

        _receipts.Add(receipt);
        foreach (var line in receipt.Detaylar)
        {
            _ready[line.KayitNo] = 0;
            line.OdenenMiktar = line.Miktar; line.OdenenTutar = line.SatirTutari;
            ConsumeRecipe(line.StokKayitNo, line.PorsiyonKayitNo, line.Miktar, actor.Name, $"Hızlı satış #{receipt.KayitNo}");
            KitchenEvent(receipt, line, "Eklendi", line.Miktar);
        }
        receipt.NakitToplam = request.NakitTutar; receipt.BankaToplam = request.BankaTutar; receipt.YemekKartiToplam = request.YemekKartiTutar;
        receipt.CariToplam = request.CariTutar; receipt.IndirimToplam = request.IndirimTutar;
        receipt.YemekKartiKayitNo = card?.KayitNo; receipt.YemekKartiAdi = card?.Ad;
        receipt.CariHesapKayitNo = account?.KayitNo; receipt.CariHesapAdi = account?.Unvan;
        receipt.Kapali = true;
        _closedAt[receipt.KayitNo] = Now;
        Recalculate(receipt);
        _quickSaleIdempotency[request.IdempotencyKey] = receipt.KayitNo;
        Log(actor, PaymentAction, $"{receipt.MasaAdi}: hızlı satış", receipt.KayitNo,
            request.NakitTutar + request.BankaTutar + request.YemekKartiTutar + request.CariTutar,
            new OdemeRequest { NakitTutar = request.NakitTutar, BankaTutar = request.BankaTutar, YemekKartiTutar = request.YemekKartiTutar,
                CariTutar = request.CariTutar, IndirimTutar = request.IndirimTutar }, card);
        return receipt;
    });
}
