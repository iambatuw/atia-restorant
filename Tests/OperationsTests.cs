using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AtiaRestorant.API.Data;
using AtiaRestorant.API.Models;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AtiaRestorant.API.Tests;

public sealed class OperationsTests
{
    private static readonly StaffActor Admin = new(1, "Demo Yönetici", "Admin");
    private static readonly StaffActor Waiter = new(2, "Demo Garson", "Garson");
    private static RestaurantRepository Repository(string? statePath = null) => new(new BackendMode(true), TimeProvider.System,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Demo:StatePath"] = statePath }).Build());
    private static SiparisEkleRequest Order(long product, decimal quantity = 1, long table = 12, params int[] options) =>
        new() { MasaKayitNo = table, StokKayitNo = product, Miktar = quantity, SecenekKayitNolar = [.. options] };
    private static MenuUrunDTO Product(RestaurantRepository repository, long id) =>
        repository.ManageMenu(Admin).SelectMany(c => c.Urunler).Single(p => p.KayitNo == id);

    [Fact]
    public void OptionsAreValidatedPricedAndSentToTheRightKitchenStation()
    {
        var repository = Repository();
        var coffee = Product(repository, 10);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.AddOrder(Order(10), Waiter)).Status);
        var sugar = coffee.SecenekGruplari.Single().Secenekler;
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.AddOrder(Order(10, 1, 12, sugar[0].KayitNo, sugar[1].KayitNo), Waiter)).Status);
        var meatball = Product(repository, 4);
        var extras = meatball.SecenekGruplari.Single().Secenekler;
        var receipt = repository.AddOrder(Order(4, 2, 12, extras[1].KayitNo, extras[0].KayitNo), Waiter);
        var line = Assert.Single(receipt.Detaylar);
        Assert.Equal(320m + 30m + 10m, line.BirimFiyat);
        Assert.Equal(720m, line.SatirTutari);
        Assert.Equal("Ekstra kaşar, Acılı sos", line.SecimMetni); // Menu order, not tap order.
        repository.AddOrder(Order(10, 1, 12, sugar[0].KayitNo), Waiter);
        var events = repository.KitchenEvents(Admin).Where(e => e.AdisyonNo == receipt.KayitNo).ToList();
        Assert.Contains(events, e => e.UrunAdi == "Izgara Köfte" && e.YaziciAdi == "Mutfak" && e.Not == "Ekstra kaşar, Acılı sos");
        Assert.Contains(events, e => e.UrunAdi == "Türk Kahvesi" && e.YaziciAdi == "Bar" && e.Not == "Sade");
        Assert.DoesNotContain(repository.Menu().SelectMany(c => c.Urunler), p => p.Recete.Count > 0);
    }

    [Fact]
    public void ItemPaymentsTrackPaidLinesAndCloseTheReceipt()
    {
        var repository = Repository();
        repository.AddOrder(Order(4, 2), Waiter);
        var receipt = repository.AddOrder(Order(9, 3), Waiter);
        var meatball = receipt.Detaylar.Single(d => d.StokKayitNo == 4);
        var ayran = receipt.Detaylar.Single(d => d.StokKayitNo == 9);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 100,
            OdenenSatirlar = [new() { DetayKayitNo = meatball.KayitNo, Miktar = 1 }] }, Admin)).Status);
        var partial = repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 365,
            OdenenSatirlar = [new() { DetayKayitNo = meatball.KayitNo, Miktar = 1 }, new() { DetayKayitNo = ayran.KayitNo, Miktar = 1 }] }, Admin);
        Assert.False(partial.Kapali);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.RemoveOrder(meatball.KayitNo,
            new() { Tip = SiparisCikarmaTipi.Iptal, Gerekce = "Vazgeçti" }, Waiter)).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.UpdateOrder(ayran.KayitNo, new() { Miktar = 0.5m }, Waiter)).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 640,
            OdenenSatirlar = [new() { DetayKayitNo = meatball.KayitNo, Miktar = 2 }] }, Admin)).Status);
        var closed = repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, BankaTutar = 410,
            OdenenSatirlar = [new() { DetayKayitNo = meatball.KayitNo, Miktar = 1 }, new() { DetayKayitNo = ayran.KayitNo, Miktar = 2 }] }, Admin);
        Assert.True(closed.Kapali);
        Assert.All(closed.Detaylar, line => Assert.Equal(line.Miktar, line.OdenenMiktar));
        Assert.Equal(775m, closed.NakitToplam + closed.BankaToplam);
    }

    [Fact]
    public void CorrectionsMovePaymentTypesAndRefundsReduceSalesAndCash()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(4, 1), Waiter);
        repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 320 }, Admin);
        var before = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.CorrectPayment(receipt.KayitNo,
            new() { Nakit = 100, Banka = 100, Gerekce = "Yanlış giriş" }, Admin)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.CorrectPayment(receipt.KayitNo,
            new() { Banka = 320, Gerekce = "Yanlış giriş" }, Waiter)).Status);
        repository.CorrectPayment(receipt.KayitNo, new() { Banka = 320, Gerekce = "Kartla ödemişti" }, Admin);
        var corrected = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(before.Mutabakat.Nakit - 320, corrected.Mutabakat.Nakit);
        Assert.Equal(before.Mutabakat.Banka + 320, corrected.Mutabakat.Banka);
        Assert.Equal(before.Mutabakat.Fark, corrected.Mutabakat.Fark);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Refund(receipt.KayitNo,
            new() { Nakit = 50, Gerekce = "Soğuk geldi" }, Admin)).Status);
        var refunded = repository.Refund(receipt.KayitNo, new() { Banka = 120, Gerekce = "Soğuk geldi" }, Admin);
        Assert.Equal(120m, refunded.IadeToplam);
        var after = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(120m, after.Mutabakat.IadeTutari);
        Assert.Equal(corrected.GenelSatis - 120, after.GenelSatis);
        Assert.Equal(corrected.Mutabakat.Banka - 120, after.Mutabakat.Banka);
        Assert.Equal(corrected.Mutabakat.Fark, after.Mutabakat.Fark);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.CorrectPayment(receipt.KayitNo,
            new() { Nakit = 320, Gerekce = "Tekrar" }, Admin)).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Refund(receipt.KayitNo,
            new() { Banka = 201, Gerekce = "Fazla" }, Admin)).Status);
        var detail = repository.ReceiptDetail(receipt.KayitNo, Admin);
        Assert.Contains(detail.Islemler, e => e.Islem == "İade yapıldı" && e.Tutar == -120);
        Assert.Contains(repository.ReceiptHistory(repository.BusinessToday, false, Admin), r => r.KayitNo == receipt.KayitNo && r.Iade == 120);
    }

    [Fact]
    public void VatIsSplitByRateAfterDiscount()
    {
        var rows = RestaurantRepository.Vat([(10, 110m), (20, 120m), (10, 0m)], 23m);
        Assert.Equal(2, rows.Count);
        Assert.Equal(207m, rows.Sum(r => r.Toplam));
        Assert.All(rows, r => Assert.Equal(r.Toplam, r.Matrah + r.Kdv));
        Assert.Equal(99m, rows.Single(r => r.Oran == 10).Toplam);
        Assert.Equal(90m, rows.Single(r => r.Oran == 10).Matrah);
    }

    [Fact]
    public void StateSurvivesRestartAndCorruptFilesFallBackToSeedData()
    {
        var path = Path.Combine(Path.GetTempPath(), $"atia-state-{Guid.NewGuid():N}.json");
        try
        {
            var first = Repository(path);
            var receipt = first.AddOrder(Order(4, 3, 11), Waiter);
            first.SaveSection(null, new() { BolumAdi = "Teras" }, Admin);
            Assert.True(File.Exists(path));
            var second = Repository(path);
            Assert.Equal(receipt.GenelToplam, second.Receipt(11)!.GenelToplam);
            Assert.Contains(second.Sections(), s => s.BolumAdi == "Teras");
            var next = second.AddOrder(Order(1, 1, 12), Waiter);
            Assert.True(next.KayitNo > receipt.KayitNo); // Counters were restored too.
            File.WriteAllText(path, "{ bozuk");
            var third = Repository(path);
            Assert.Null(third.Receipt(11));
            Assert.Contains("okunamadı", third.DemoStatus().SonHata);
            second.ResetDemo(Admin);
            Assert.Null(second.Receipt(11));
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void NewQuickNoteCanBeReusedAcrossProductsAfterRestart()
    {
        var path = Path.Combine(Path.GetTempPath(), $"atia-notes-{Guid.NewGuid():N}.json");
        try
        {
            var first = Repository(path);
            Assert.Equal(403, Assert.Throws<ApiException>(() => first.AddQuickNote(
                new() { Ad = "Turşusuz", Grup = "Malzeme" }, Waiter)).Status);
            var settings = first.AddQuickNote(new() { Ad = "Turşusuz", Grup = "Malzeme" }, Admin);
            Assert.Contains(settings.HazirNotTanimlari, note => note.Ad == "Turşusuz" && note.Grup == "Malzeme");
            Assert.Equal(409, Assert.Throws<ApiException>(() => first.AddQuickNote(
                new() { Ad = "turşusuz", Grup = "Servis" }, Admin)).Status);

            var second = Repository(path);
            Assert.Contains(second.Settings().HazirNotTanimlari, note => note.Ad == "Turşusuz" && note.Grup == "Malzeme");
            var category = second.Menu().Single(item => item.GrupAdi == "Başlangıçlar");
            var created = second.SaveProduct(null, new() { GrupKayitNo = category.KayitNo, StokAdi = "Çiğ köfte",
                SatisFiyati = 150m, HazirNotlar = ["Turşusuz"] }, Admin);
            var salad = second.Menu().SelectMany(item => item.Urunler).Single(item => item.StokAdi == "Çoban Salata");
            second.SaveProduct(salad.KayitNo, new() { GrupKayitNo = salad.GrupKayitNo!.Value,
                StokAdi = salad.StokAdi!, SatisFiyati = salad.SatisFiyati, KdvOrani = salad.KdvOrani,
                Porsiyonlar = salad.Porsiyonlar, HazirNotlar = [.. salad.HazirNotlar!, "Turşusuz"] }, Admin);

            var third = Repository(path);
            Assert.Contains("Turşusuz", third.Menu().SelectMany(item => item.Urunler)
                .Single(item => item.KayitNo == created.KayitNo).HazirNotlar!);
            Assert.Contains("Turşusuz", third.Menu().SelectMany(item => item.Urunler)
                .Single(item => item.KayitNo == salad.KayitNo).HazirNotlar!);
            Assert.Contains(third.Settings().HazirNotTanimlari, note => note.Ad == "Turşusuz" && note.Grup == "Malzeme");
        }
        finally { File.Delete(path); }
    }

    [Fact]
    public void StaffAccountsProtectAdminsAndInvalidateChangedSessions()
    {
        var repository = Repository();
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.StaffAccounts(Waiter)).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.SaveStaff(null, new() { KullaniciAdi = "ali", AdSoyad = "Ali", Rol = "Garson", Sifre = "123" }, Admin)).Status);
        var created = repository.SaveStaff(null, new() { KullaniciAdi = "Ali.K", AdSoyad = "Ali Kaya", Rol = "Garson", Sifre = "garson-123" }, Admin);
        Assert.Equal("ali.k", created.KullaniciAdi);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.SaveStaff(null, new() { KullaniciAdi = "ali.k", AdSoyad = "İkinci", Rol = "Garson", Sifre = "garson-123" }, Admin)).Status);
        var login = repository.Authenticate("ali.k", "garson-123");
        Assert.True(repository.IsStaffTokenValid(login.Id, "Garson", login.GuvenlikSurumu));
        Assert.Equal(401, Assert.Throws<ApiException>(() => repository.Authenticate("ali.k", "yanlis-sifre")).Status);
        repository.SaveStaff(created.KayitNo, new() { KullaniciAdi = "ali.k", AdSoyad = "Ali Kaya", Rol = "Garson", Aktif = false }, Admin);
        Assert.False(repository.IsStaffTokenValid(login.Id, "Garson", login.GuvenlikSurumu));
        Assert.Equal(401, Assert.Throws<ApiException>(() => repository.Authenticate("ali.k", "garson-123")).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.SaveStaff(1, new() { KullaniciAdi = "admin", AdSoyad = "Demo Yönetici", Rol = "Garson", Aktif = true }, Admin)).Status);
        Assert.DoesNotContain("demo123", JsonSerializer.Serialize(repository.StaffAccounts(Admin)));
    }

    [Fact]
    public void SectionsAndTablesCanBeManagedWithoutBreakingOpenReceipts()
    {
        var repository = Repository();
        var terrace = repository.SaveSection(null, new() { BolumAdi = "Teras" }, Admin);
        var table = repository.SaveTable(null, new() { MasaAdi = "Teras 1", BolumKayitNo = terrace.KayitNo }, Admin);
        Assert.Equal("Teras", table.RestorantBolumAdi);
        Assert.Single(repository.Tables(terrace.KayitNo));
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.SaveTable(null, new() { MasaAdi = "masa 1", BolumKayitNo = 1 }, Admin)).Status);
        repository.AddOrder(Order(1, 1, table.MasaId), Waiter);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.DeleteTable(table.MasaId, Admin)).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.DeleteSection(terrace.KayitNo, Admin)).Status);
        repository.SaveTable(table.MasaId, new() { MasaAdi = "Teras A", BolumKayitNo = terrace.KayitNo }, Admin);
        Assert.Equal("Teras A", repository.Receipt(table.MasaId)!.MasaAdi);
        var guests = repository.SetGuestCount(table.MasaId, new() { KisiSayisi = 5 }, Waiter);
        Assert.Equal(5, guests.KisiSayisi);
    }

    [Fact]
    public void RecipesDeductStockAndCancellationReturnsItButWasteDoesNot()
    {
        var repository = Repository();
        decimal Mince() => repository.Ingredients(Admin).Single(i => i.Ad == "Dana kıyma").Stok;
        var start = Mince();
        var receipt = repository.AddOrder(Order(4, 2), Waiter);
        Assert.Equal(start - 0.36m, Mince());
        var line = Assert.Single(receipt.Detaylar);
        repository.RemoveOrder(line.KayitNo, new() { Tip = SiparisCikarmaTipi.Iptal, Gerekce = "Vazgeçti" }, Waiter);
        Assert.Equal(start, Mince());
        repository.SetWasteEnabled(new() { ZayiAktif = true }, Admin);
        var again = repository.AddOrder(Order(4, 1), Waiter);
        repository.RemoveOrder(again.Detaylar.Single().KayitNo, new() { Tip = SiparisCikarmaTipi.Zayi, Gerekce = "Yandı" }, Admin);
        Assert.Equal(start - 0.18m, Mince());
        var mince = repository.Ingredients(Admin).Single(i => i.Ad == "Dana kıyma");
        repository.AddStockMovement(new() { HammaddeKayitNo = mince.KayitNo, Tip = StokHareketTipi.Giris, Miktar = 10, BirimMaliyet = 800 }, Admin);
        Assert.True(repository.Ingredients(Admin).Single(i => i.KayitNo == mince.KayitNo).BirimMaliyet is > 720 and < 800);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.AddStockMovement(
            new() { HammaddeKayitNo = mince.KayitNo, Tip = StokHareketTipi.Cikis, Miktar = 1 }, Admin)).Status);
        repository.AddStockMovement(new() { HammaddeKayitNo = mince.KayitNo, Tip = StokHareketTipi.Sayim, Miktar = 7.5m }, Admin);
        Assert.Equal(7.5m, Mince());
        var cost = repository.RecipeCosts(Admin).First(c => c.UrunKayitNo == 4 && c.PorsiyonAdi == "Yarım");
        Assert.True(cost.ReceteVar && cost.ReceteMaliyeti > 0 && cost.MaliyetOrani > 0);
    }

    [Fact]
    public void DeliveryCustomersCouriersAndCollectionsReachTheTill()
    {
        var repository = Repository();
        PaketSiparisDTO Create(string phone) => repository.CreateDelivery(new() { IdempotencyKey = Guid.NewGuid().ToString(), MusteriAdi = "Ayşe",
            Telefon = phone, Adres = "Lale Sk. 3", OdemeSekli = "Nakit", Satirlar = [new() { StokKayitNo = 9, Miktar = 2 }] }, Waiter);
        var first = Create("0532 111 22 33");
        var second = Create("+90 532 111 2233");
        var customer = Assert.Single(repository.Customers("5321112233", Waiter));
        Assert.Equal(2, customer.SiparisSayisi);
        Assert.Equal(customer.KayitNo, second.MusteriKayitNo);
        Assert.Equal(2, repository.CustomerDetail(customer.KayitNo, Waiter).SonSiparisler.Count);
        repository.UpdateDelivery(first.KayitNo, new() { Durum = PaketDurum.Hazirlaniyor }, Waiter);
        Assert.Equal(404, Assert.Throws<ApiException>(() => repository.UpdateDelivery(first.KayitNo, new() { Durum = PaketDurum.Yolda, KuryeKayitNo = 99 }, Waiter)).Status);
        repository.UpdateDelivery(first.KayitNo, new() { Durum = PaketDurum.Yolda, KuryeKayitNo = 1 }, Waiter);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.CollectDelivery(first.KayitNo, Admin)).Status);
        repository.UpdateDelivery(first.KayitNo, new() { Durum = PaketDurum.TeslimEdildi }, Waiter);
        var before = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(90m, before.PaketTahsilat.Bekleyen);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.CollectDelivery(first.KayitNo, Waiter)).Status);
        repository.CollectDelivery(first.KayitNo, Admin);
        var after = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(90m, after.PaketTahsilat.Nakit);
        Assert.Equal(before.BeklenenKasaNakdi + 90, after.BeklenenKasaNakdi);
        var courier = Assert.Single(after.KuryeOzeti);
        Assert.Equal("Demo Kurye 1", courier.Kurye);
        Assert.Equal(90m, courier.TahsilEdilen);
        repository.UpdateDelivery(second.KayitNo, new() { Durum = PaketDurum.Iptal }, Waiter);
        Assert.Equal(1, repository.Customers("532111", Waiter).Single().SiparisSayisi);
    }

    [Fact]
    public void PeriodAndStaffReportsSummariseTheRange()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(4, 1), Waiter);
        repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, YemekKartiTutar = 320, YemekKartiKayitNo = 2 }, Admin);
        var today = repository.BusinessToday;
        var period = repository.PeriodReport(today.AddDays(-2), today, Admin);
        Assert.Equal(3, period.Gunler.Count);
        Assert.Equal(period.Gunler.Sum(d => d.ToplamSatis), period.Toplam.ToplamSatis);
        Assert.Contains(period.YemekKartiDagilimi, c => c.Ad == "Multinet" && c.Tutar == 320);
        Assert.Equal(period.Toplam.MasaSatis + period.Toplam.PaketSatis, period.KdvDokumu.Sum(k => k.Toplam));
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.PeriodReport(today.AddDays(-80), today, Admin)).Status);
        var staff = repository.StaffReport(today, today, Admin);
        Assert.Contains(staff.Satirlar, r => r.PersonelId == Waiter.Id && r.SatisTutari >= 320);
        Assert.Contains(staff.Satirlar, r => r.PersonelId == Admin.Id && r.TahsilatTutari >= 320);
    }

    [Fact]
    public async Task DeactivatedAccountsLoseAccessAndNewRoutesKeepRoles()
    {
        using var factory = new ApiFactory();
        using var admin = factory.CreateClient();
        await Login(admin, "admin", "demo123");
        using var waiter = factory.CreateClient();
        await Login(waiter, "garson", "demo123");
        Assert.Equal(HttpStatusCode.Forbidden, (await waiter.GetAsync("/api/personel")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await waiter.GetAsync("/api/stok/hammaddeler")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await waiter.GetAsync("/api/kuryeler")).StatusCode);
        var menu = await (await waiter.GetAsync("/api/menu")).Content.ReadAsStringAsync();
        Assert.DoesNotContain("\"HammaddeKayitNo\"", menu);
        Assert.Equal(HttpStatusCode.OK, (await admin.PutAsJsonAsync("/api/personel/2",
            new PersonelYazRequest { KullaniciAdi = "garson", AdSoyad = "Demo Garson", Rol = "Garson", Aktif = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await waiter.GetAsync("/api/masalar")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await factory.CreateClient().PostAsJsonAsync("/api/auth/login",
            new LoginRequest { KullaniciAdi = "garson", Sifre = "demo123" })).StatusCode);
        var session = await (await admin.GetAsync("/api/auth/session")).Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(1, session.GetProperty("Data").GetProperty("MagazaKayitNo").GetInt64());
    }

    private static async Task Login(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { KullaniciAdi = username, Sifre = password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ApiResult<LoginResponse>>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", result!.Data!.Token);
    }
}
