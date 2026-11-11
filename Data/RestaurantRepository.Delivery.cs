using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>Delivery customers (looked up by phone), couriers and confirmation of delivery payments.</summary>
public sealed partial class RestaurantRepository
{
    private const string DeliveryCollectionAction = "Paket tahsilatı";
    private List<MusteriDTO> _customers = [];
    private List<KuryeDTO> _couriers = [];
    private long _nextCustomer, _nextCourier;

    /// <summary>Turkish phone numbers are compared as their last ten digits (5XX XXX XX XX).</summary>
    internal static string NormalizePhone(string? phone)
    {
        var digits = new string((phone ?? "").Where(char.IsAsciiDigit).ToArray());
        if (digits.Length == 12 && digits.StartsWith("90", StringComparison.Ordinal)) digits = digits[2..];
        if (digits.Length == 11 && digits.StartsWith('0')) digits = digits[1..];
        return digits;
    }

    private static List<string> NormalizeAddresses(IEnumerable<string>? addresses)
    {
        var list = (addresses ?? []).Select(a => Mandatory(a, 300, "Adres")).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        Require(list.Count <= 5, "Bir müşteri için en fazla 5 adres kaydedilebilir.");
        return list;
    }

    /// <summary>Creates or updates the customer card for a new delivery order and links the order to it.</summary>
    private void RememberCustomer(PaketSiparisDTO delivery)
    {
        var phone = NormalizePhone(delivery.Telefon);
        if (phone.Length < 7) return; // Not a usable phone number; the order still keeps its own copy.
        var customer = _customers.FirstOrDefault(c => c.Telefon == phone);
        if (customer is null)
        {
            customer = new MusteriDTO { KayitNo = ++_nextCustomer, Telefon = phone, AdSoyad = delivery.MusteriAdi };
            _customers.Add(customer);
        }
        if (!customer.Adresler.Contains(delivery.Adres, StringComparer.OrdinalIgnoreCase))
        {
            customer.Adresler.Insert(0, delivery.Adres);
            if (customer.Adresler.Count > 5) customer.Adresler.RemoveAt(customer.Adresler.Count - 1);
        }
        customer.SiparisSayisi++;
        customer.ToplamTutar += delivery.GenelToplam;
        customer.SonSiparisTarihi = delivery.KayitTarihi;
        delivery.MusteriKayitNo = customer.KayitNo;
    }

    private void ForgetCancelledOrder(PaketSiparisDTO delivery)
    {
        if (_customers.FirstOrDefault(c => c.KayitNo == delivery.MusteriKayitNo) is not { } customer) return;
        customer.SiparisSayisi = Math.Max(0, customer.SiparisSayisi - 1);
        customer.ToplamTutar = Math.Max(0, customer.ToplamTutar - delivery.GenelToplam);
    }

    public List<MusteriDTO> Customers(string? search, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin", "Garson");
        var text = search?.Trim() ?? "";
        Require(text.Length <= 60, "Arama en fazla 60 karakter olabilir.");
        var digits = NormalizePhone(text);
        var query = _customers.AsEnumerable();
        if (text.Length > 0)
            query = query.Where(c => (digits.Length >= 3 && c.Telefon.Contains(digits, StringComparison.Ordinal)) ||
                c.AdSoyad.Contains(text, StringComparison.CurrentCultureIgnoreCase));
        return query.OrderByDescending(c => c.Telefon == digits).ThenByDescending(c => c.SonSiparisTarihi).Take(text.Length > 0 ? 20 : 200).ToList();
    });

    public MusteriDetayDTO CustomerDetail(long id, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin", "Garson");
        var customer = _customers.FirstOrDefault(c => c.KayitNo == id) ?? throw new ApiException(404, "Müşteri bulunamadı.");
        return new MusteriDetayDTO { Musteri = customer,
            SonSiparisler = _deliveries.Where(d => d.MusteriKayitNo == id).OrderByDescending(d => d.KayitTarihi).Take(10).ToList() };
    });

    public MusteriDTO SaveCustomer(long id, MusteriYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin", "Garson");
        var customer = _customers.FirstOrDefault(c => c.KayitNo == id) ?? throw new ApiException(404, "Müşteri bulunamadı.");
        customer.AdSoyad = Mandatory(request.AdSoyad, 100, "Müşteri adı");
        customer.Adresler = NormalizeAddresses(request.Adresler);
        customer.Not = Optional(request.Not, 300, "Müşteri notu");
        Log(actor, "Müşteri kartı düzenlendi", customer.AdSoyad);
        return customer;
    });

    /// <summary>Deletes the customer card (for example on a personal-data erasure request). Orders keep their own delivery copy.</summary>
    public MusteriDTO DeleteCustomer(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var customer = _customers.FirstOrDefault(c => c.KayitNo == id) ?? throw new ApiException(404, "Müşteri bulunamadı.");
        _customers.Remove(customer);
        foreach (var delivery in _deliveries.Where(d => d.MusteriKayitNo == id)) delivery.MusteriKayitNo = null;
        Log(actor, "Müşteri kartı silindi", $"#{customer.KayitNo}");
        return customer;
    });

    public List<KuryeDTO> Couriers(StaffActor actor) => Read(() => { Staff(actor, "Admin", "Garson"); return _couriers; });

    public List<KuryeDTO> SaveCouriers(KuryelerRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var list = request.Kuryeler ?? throw new ApiException(400, "Kurye listesi geçersiz.");
        Require(list.Count <= 50 && list.All(c => c is not null), "En fazla 50 kurye tanımlanabilir.");
        var result = list.Select(c => new KuryeDTO
        {
            KayitNo = c.KayitNo > 0 && _couriers.Any(x => x.KayitNo == c.KayitNo) ? c.KayitNo : ++_nextCourier,
            AdSoyad = Mandatory(c.AdSoyad, 100, "Kurye adı"), Telefon = Optional(c.Telefon, 30, "Kurye telefonu"), Aktif = c.Aktif
        }).ToList();
        Require(result.Select(c => c.AdSoyad).Distinct(StringComparer.OrdinalIgnoreCase).Count() == result.Count, "Kurye adları farklı olmalı.");
        _couriers = result;
        Log(actor, "Kuryeler güncellendi", $"{result.Count(c => c.Aktif)} aktif kurye");
        return _couriers;
    });

    /// <summary>Resolves the courier for "on the way": a defined courier by id, or a free-text name.</summary>
    private (long? Id, string Name) ResolveCourier(PaketDurumRequest request)
    {
        if (request.KuryeKayitNo.HasValue)
        {
            var courier = _couriers.FirstOrDefault(c => c.KayitNo == request.KuryeKayitNo && c.Aktif)
                ?? throw new ApiException(404, "Aktif kurye bulunamadı.");
            return (courier.KayitNo, courier.AdSoyad);
        }
        Require(!string.IsNullOrWhiteSpace(request.Kurye) && request.Kurye.Trim().Length <= 100, "Kurye adı 1–100 karakter olmalı.");
        return (null, request.Kurye!.Trim());
    }

    /// <summary>Confirms that the payment of a delivered order reached the till (cash/card) or the platform (online).</summary>
    public PaketSiparisDTO CollectDelivery(long id, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment);
        var delivery = _deliveries.FirstOrDefault(d => d.KayitNo == id) ?? throw new ApiException(404, "Paket siparişi bulunamadı.");
        Require(delivery.Durum == PaketDurum.TeslimEdildi, "Yalnızca teslim edilmiş siparişin tahsilatı doğrulanabilir.", 409);
        Require(!delivery.TahsilEdildi, "Bu siparişin tahsilatı zaten doğrulandı.", 409);
        delivery.TahsilEdildi = true;
        delivery.TahsilatTarihi = Now;
        delivery.TahsilEden = actor.Name;
        _audit.Add(new IslemKaydiDTO { KayitNo = ++_nextAudit, Tarih = Now, Islem = DeliveryCollectionAction,
            Aciklama = $"Paket #{delivery.KayitNo}, {delivery.OdemeSekli}{(delivery.Kurye is null ? "" : $", kurye {delivery.Kurye}")}",
            PersonelId = actor.Id, PersonelAdi = actor.Name, Tutar = delivery.GenelToplam,
            Nakit = delivery.OdemeSekli == "Nakit" ? delivery.GenelToplam : 0, Banka = delivery.OdemeSekli == "Kart" ? delivery.GenelToplam : 0 });
        return delivery;
    });

    private PaketTahsilatDTO DeliveryCollections(DateOnly date)
    {
        var collected = _deliveries.Where(d => d.TahsilatTarihi.HasValue && BusinessDate(d.TahsilatTarihi.Value) == date).ToList();
        var waiting = _deliveries.Where(d => d.Durum == PaketDurum.TeslimEdildi && !d.TahsilEdildi).ToList();
        return new PaketTahsilatDTO
        {
            Nakit = collected.Where(d => d.OdemeSekli == "Nakit").Sum(d => d.GenelToplam),
            Kart = collected.Where(d => d.OdemeSekli == "Kart").Sum(d => d.GenelToplam),
            Online = collected.Where(d => d.OdemeSekli == "Online").Sum(d => d.GenelToplam),
            Bekleyen = waiting.Sum(d => d.GenelToplam), BekleyenSayisi = waiting.Count
        };
    }

    private List<KuryeOzetDTO> CourierSummary(DateOnly date) => _deliveries
        .Where(d => d.Durum == PaketDurum.TeslimEdildi && d.TamamlanmaTarihi.HasValue && BusinessDate(d.TamamlanmaTarihi.Value) == date)
        .GroupBy(d => (d.KuryeKayitNo, Name: d.Kurye ?? "Kurye girilmedi"))
        .Select(g => new KuryeOzetDTO { KuryeKayitNo = g.Key.KuryeKayitNo, Kurye = g.Key.Name, TeslimSayisi = g.Count(),
            TeslimTutari = g.Sum(d => d.GenelToplam), TahsilEdilen = g.Where(d => d.TahsilEdildi).Sum(d => d.GenelToplam),
            Bekleyen = g.Where(d => !d.TahsilEdildi).Sum(d => d.GenelToplam) })
        .OrderByDescending(c => c.TeslimTutari).ToList();

    private void SeedDelivery()
    {
        _couriers = [new() { KayitNo = 1, AdSoyad = "Demo Kurye 1" }, new() { KayitNo = 2, AdSoyad = "Demo Kurye 2" }];
        _nextCourier = 2;
    }
}
