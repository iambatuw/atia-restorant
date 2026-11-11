using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>Period (month-end) and per-staff reports built from the same business-day rules as the daily report.</summary>
public sealed partial class RestaurantRepository
{
    private const int MaxReportDays = 62;

    private void ReportRange(DateOnly start, DateOnly end)
    {
        Require(start <= end, "Başlangıç tarihi bitiş tarihinden sonra olamaz.");
        Require(end.DayNumber - start.DayNumber < MaxReportDays, $"Rapor aralığı en fazla {MaxReportDays} gün olabilir.");
    }

    private List<YemekKartiOzetDTO> MealCardSummary(IEnumerable<IslemKaydiDTO> entries) => entries
        .Where(e => IsTablePaymentEntry(e) && e.YemekKarti != 0)
        .GroupBy(e => (e.YemekKartiKayitNo, Name: e.YemekKartiAdi ?? "Türü seçilmemiş"))
        .Select(g =>
        {
            var rate = _mealCards.FirstOrDefault(c => c.KayitNo == g.Key.YemekKartiKayitNo)?.KomisyonOrani ?? 0;
            var amount = g.Sum(e => e.YemekKarti);
            return new YemekKartiOzetDTO { KayitNo = g.Key.YemekKartiKayitNo, Ad = g.Key.Name, Tutar = amount, TahminiKomisyon = Money(amount * rate / 100) };
        })
        .Where(c => c.Tutar != 0).OrderByDescending(c => c.Tutar).ToList();

    public DonemRaporDTO PeriodReport(DateOnly start, DateOnly end, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        ReportRange(start, end);
        var days = new List<DonemGunuDTO>();
        var vat = new List<KdvSatiriDTO>();
        var products = new List<UrunSatisDTO>();
        for (var date = start; date <= end; date = date.AddDays(1))
        {
            var day = DailyCore(date);
            vat.AddRange(day.Rapor.KdvDokumu);
            products.AddRange(day.EnCokSatanTumu);
            days.Add(new DonemGunuDTO { Tarih = date, AdisyonSayisi = day.Rapor.ToplamAdisyon, MasaSatis = day.Rapor.ToplamCiro,
                PaketSatis = day.Rapor.PaketCiro, Iade = day.Rapor.Mutabakat.IadeTutari, ToplamSatis = day.Rapor.GenelSatis,
                Nakit = day.Rapor.Mutabakat.Nakit, Banka = day.Rapor.Mutabakat.Banka, YemekKarti = day.Rapor.Mutabakat.YemekKarti,
                Cari = day.Rapor.Mutabakat.Cari, Indirim = day.Rapor.Mutabakat.Indirim, Iptal = day.Rapor.Mutabakat.IptalTutari,
                Zayi = day.Rapor.Mutabakat.ZayiTutari, Ikram = day.Rapor.Mutabakat.IkramTutari, VardiyaKapali = day.Rapor.VardiyaKapanisi is not null });
        }
        var entries = _audit.Where(e => BusinessDate(e.Tarih) >= start && BusinessDate(e.Tarih) <= end);
        return new DonemRaporDTO
        {
            Baslangic = start, Bitis = end, Gunler = days,
            Toplam = new DonemGunuDTO { AdisyonSayisi = days.Sum(d => d.AdisyonSayisi), MasaSatis = days.Sum(d => d.MasaSatis),
                PaketSatis = days.Sum(d => d.PaketSatis), Iade = days.Sum(d => d.Iade), ToplamSatis = days.Sum(d => d.ToplamSatis),
                Nakit = days.Sum(d => d.Nakit), Banka = days.Sum(d => d.Banka), YemekKarti = days.Sum(d => d.YemekKarti),
                Cari = days.Sum(d => d.Cari), Indirim = days.Sum(d => d.Indirim), Iptal = days.Sum(d => d.Iptal),
                Zayi = days.Sum(d => d.Zayi), Ikram = days.Sum(d => d.Ikram) },
            KdvDokumu = SumVat(vat),
            EnCokSatan = products.GroupBy(p => p.StokAdi).Select(g => new UrunSatisDTO { StokAdi = g.Key,
                ToplamMiktar = g.Sum(p => p.ToplamMiktar), ToplamTutar = g.Sum(p => p.ToplamTutar) })
                .OrderByDescending(p => p.ToplamTutar).Take(15).ToList(),
            YemekKartiDagilimi = MealCardSummary(entries)
        };
    });

    public PersonelRaporDTO StaffReport(DateOnly start, DateOnly end, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        ReportRange(start, end);
        bool InRange(DateTime value) => BusinessDate(value) >= start && BusinessDate(value) <= end;
        var rows = new Dictionary<int, PersonelRaporSatiriDTO>();
        PersonelRaporSatiriDTO Row(int id, string? name)
        {
            if (rows.TryGetValue(id, out var row)) return row;
            var account = _staff.FirstOrDefault(s => s.KayitNo == id);
            return rows[id] = new PersonelRaporSatiriDTO { PersonelId = id, PersonelAdi = account?.AdSoyad ?? name ?? $"Personel #{id}", Rol = account?.Rol };
        }
        foreach (var receipt in _receipts.Where(r => r.KayitTarihi.HasValue && InRange(r.KayitTarihi.Value) && !_mergedReceipts.Contains(r.KayitNo)))
            if (receipt.PersonelKayitNo is { } opener) Row(opener, receipt.PersonelAdi).AcilanAdisyon++;
        foreach (var receipt in _receipts.Where(r => r.Kapali && !_mergedReceipts.Contains(r.KayitNo) &&
            _closedAt.TryGetValue(r.KayitNo, out var closed) && InRange(closed)))
            foreach (var line in receipt.Detaylar.Where(d => d.PersonelKayitNo.HasValue))
            {
                var row = Row(line.PersonelKayitNo!.Value, line.PersonelAdi);
                row.UrunAdedi += line.Miktar;
                row.SatisTutari += line.SatirTutari;
            }
        foreach (var entry in _audit.Where(e => InRange(e.Tarih)))
        {
            var row = Row(entry.PersonelId, entry.PersonelAdi);
            switch (entry.Islem)
            {
                case "Ürün iptal edildi": row.IptalSayisi++; row.IptalTutari += entry.Tutar; break;
                case "Zayi kaydedildi": row.ZayiTutari += entry.Tutar; break;
                case "İkram verildi": row.IkramTutari += entry.Tutar; break;
                case PaymentAction: row.TahsilatTutari += entry.Tutar; break;
                case DeliveryCollectionAction: row.TahsilatTutari += entry.Tutar; break;
                case RefundAction: row.IadeTutari += -entry.Tutar; break;
            }
        }
        return new PersonelRaporDTO { Baslangic = start, Bitis = end, Satirlar = rows.Values
            .Where(r => r.AcilanAdisyon > 0 || r.SatisTutari != 0 || r.IptalSayisi > 0 || r.ZayiTutari != 0 || r.IkramTutari != 0 || r.TahsilatTutari != 0 || r.IadeTutari != 0)
            .OrderByDescending(r => r.SatisTutari).ToList() };
    });
}
