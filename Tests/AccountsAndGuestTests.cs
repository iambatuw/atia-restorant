using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using AtiaRestorant.API.Data;
using AtiaRestorant.API.Models;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace AtiaRestorant.API.Tests;

public sealed class AccountsAndGuestTests
{
    private static readonly StaffActor Admin = new(1, "Demo Yönetici", "Admin");
    private static readonly StaffActor Waiter = new(2, "Demo Garson", "Garson");
    private static readonly StaffActor Cook = new(3, "Demo Mutfak", "Mutfak");
    private static RestaurantRepository Repository(string? statePath = null) => new(new BackendMode(true), TimeProvider.System,
        new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["Demo:StatePath"] = statePath }).Build());
    private static AdisyonBaslikDTO Order(RestaurantRepository repository, long table, long product = 4, decimal quantity = 1) =>
        repository.AddOrder(new() { MasaKayitNo = table, StokKayitNo = product, Miktar = quantity }, Waiter);

    [Fact]
    public void CariLimitCorrectionAndRefundKeepTheBalanceRight()
    {
        var repository = Repository();
        var big = Order(repository, 12, quantity: 7); // 2240 TL, above the 2000 TL limit of account 2
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, new() { BaslikKayitNo = big.KayitNo,
            CariTutar = 2240, CariHesapKayitNo = 2 }, Admin)).Status);
        Assert.Equal(0m, repository.Accounts(null, Admin).Single(a => a.KayitNo == 2).Bakiye); // Nothing was booked.
        var paid = repository.Pay(12, new() { BaslikKayitNo = big.KayitNo, CariTutar = 1240, NakitTutar = 1000, CariHesapKayitNo = 1 }, Admin);
        Assert.Equal("Demo Lojistik A.Ş.", paid.CariHesapAdi);
        Assert.Equal(1240m, repository.Accounts(null, Admin).Single(a => a.KayitNo == 1).Bakiye);

        repository.CorrectPayment(big.KayitNo, new() { Nakit = 1040, Cari = 1200, CariHesapKayitNo = 2, Gerekce = "Eczane hesabına yazılacaktı" }, Admin);
        Assert.Equal(0m, repository.Accounts(null, Admin).Single(a => a.KayitNo == 1).Bakiye);
        Assert.Equal(1200m, repository.Accounts(null, Admin).Single(a => a.KayitNo == 2).Bakiye);

        repository.Refund(big.KayitNo, new() { Cari = 200, Gerekce = "Bir porsiyon iade" }, Admin);
        var statement = repository.AccountStatement(2, Admin);
        Assert.Equal(1000m, statement.Hesap.Bakiye);
        Assert.Contains(statement.Hareketler, m => m.Tip == "İade" && m.Alacak == 200);

        var report = repository.DailyReport(repository.BusinessToday, Admin);
        repository.CollectAccount(2, new() { Nakit = 300, Banka = 100, Aciklama = "Ay sonu ödemesi" }, Admin);
        var after = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(600m, repository.Accounts(null, Admin).Single(a => a.KayitNo == 2).Bakiye);
        Assert.Equal(report.BeklenenKasaNakdi + 300, after.BeklenenKasaNakdi);
        Assert.Equal(100m, after.CariTahsilatBanka);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.CollectAccount(2, new() { Nakit = 1 }, Waiter)).Status);
    }

    [Fact]
    public void CashMovementsChangeTheExpectedTillCash()
    {
        var repository = Repository();
        var before = repository.DailyReport(repository.BusinessToday, Admin).BeklenenKasaNakdi;
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.AddCashMovement(new() { Giris = false, Kategori = "Kasa açılışı", Tutar = 10, Aciklama = "x" }, Admin)).Status);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.AddCashMovement(new() { Giris = false, Kategori = "Masraf", Tutar = 10, Aciklama = " " }, Admin)).Status);
        repository.AddCashMovement(new() { Giris = true, Kategori = "Kasa açılışı", Tutar = 500, Aciklama = "Sabah bozuk para" }, Admin);
        repository.AddCashMovement(new() { Giris = false, Kategori = "Masraf", Tutar = 120.5m, Aciklama = "Ekmek" }, Admin);
        var report = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(before + 500 - 120.5m, report.BeklenenKasaNakdi);
        Assert.Equal(2, report.KasaHareketleri.Count);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.AddCashMovement(new() { Giris = true, Kategori = "Bozuk para", Tutar = 1, Aciklama = "x" }, Waiter)).Status);
    }

    [Fact]
    public void QuickSaleIsPaidAtOnceAndStillReachesTheKitchen()
    {
        var repository = Repository();
        var key = Guid.NewGuid().ToString();
        var coffee = repository.ManageMenu(Admin).SelectMany(c => c.Urunler).Single(p => p.KayitNo == 10);
        var sugar = coffee.SecenekGruplari.Single().Secenekler[0].KayitNo;
        HizliSatisRequest Request(decimal cash) => new() { IdempotencyKey = key, MusteriAdi = "Ali",
            Satirlar = [new() { StokKayitNo = 9, Miktar = 2 }, new() { StokKayitNo = 10, Miktar = 1, SecenekKayitNolar = [sugar] }], NakitTutar = cash };
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.QuickSale(Request(100), Admin)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.QuickSale(Request(165), Waiter)).Status);
        var sale = repository.QuickSale(Request(165), Admin);
        Assert.True(sale.Kapali && sale.HizliSatis);
        Assert.Null(sale.MasaKayitNo);
        Assert.Equal(sale.KayitNo, repository.QuickSale(Request(165), Admin).KayitNo); // Same key, no second sale.
        var ticket = Assert.Single(repository.Kitchen(), t => t.BaslikKayitNo == sale.KayitNo);
        Assert.Equal("Hızlı satış", ticket.BolumAdi);
        foreach (var line in ticket.Satirlar) repository.MarkLineReady(line.DetayKayitNo, Cook);
        Assert.DoesNotContain(repository.Kitchen(), t => t.BaslikKayitNo == sale.KayitNo);
        Assert.Contains(repository.ReceiptHistory(repository.BusinessToday, false, Admin), r => r.KayitNo == sale.KayitNo);
        Assert.True(repository.LocateReceipt(sale.KayitNo, Waiter).Kapali);
    }

    [Fact]
    public void GuestCallsNeedTheTableCodeAndAreMerged()
    {
        var repository = Repository();
        var code = repository.TableQrCodes(Admin).Single(t => t.MasaKayitNo == 5).Kod;
        Assert.Equal(404, Assert.Throws<ApiException>(() => repository.CallStaff(new() { Kod = "0000000000000000" })).Status);
        Assert.Equal("Masa 5", repository.TableForGuest(code).MasaAdi);
        repository.CallStaff(new() { Kod = code, Tip = CagriTipi.Hesap });
        repository.CallStaff(new() { Kod = code, Tip = CagriTipi.Hesap });
        repository.CallStaff(new() { Kod = code, Tip = CagriTipi.Garson });
        var calls = repository.OpenCalls(Waiter);
        Assert.Equal(2, calls.Count);
        repository.CompleteCall(calls[0].KayitNo, Waiter);
        Assert.Single(repository.OpenCalls(Waiter));
        var renewed = repository.RenewTableQr(5, Admin);
        Assert.NotEqual(code, renewed.Kod);
        Assert.Equal(404, Assert.Throws<ApiException>(() => repository.TableForGuest(code)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.OpenCalls(Cook)).Status);
    }

    [Fact]
    public void InvoiceDetailsAllergensAndImagesAreValidated()
    {
        var repository = Repository();
        var receipt = Order(repository, 11);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.SetInvoiceDetails(receipt.KayitNo, new() { Unvan = "Firma", VergiNo = "123" }, Waiter)).Status);
        Assert.Equal("Firma Ltd.", repository.SetInvoiceDetails(receipt.KayitNo, new() { Unvan = "Firma Ltd.", VergiNo = "1234567890" }, Waiter).FaturaBilgisi!.Unvan);
        Assert.Null(repository.SetInvoiceDetails(receipt.KayitNo, null, Waiter).FaturaBilgisi);
        var product = repository.ManageMenu(Admin).SelectMany(c => c.Urunler).Single(p => p.KayitNo == 1);
        MenuUrunYazRequest Edit(List<string>? allergens) => new() { GrupKayitNo = product.GrupKayitNo!.Value, StokAdi = product.StokAdi!,
            SatisFiyati = product.SatisFiyati, Aktif = true, Alerjenler = allergens, Aciklama = "Günlük taze" };
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.SaveProduct(1, Edit(["Fıstık ezmesi"]), Admin)).Status);
        Assert.Equal(new[] { "Gluten", "Süt" }, repository.SaveProduct(1, Edit(["Süt", "Gluten"]), Admin).Alerjenler);
        Assert.Equal(new[] { "Gluten", "Süt" }, repository.SaveProduct(1, Edit(null), Admin).Alerjenler); // Null keeps the list.
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.SaveProductImage(1, "image/png", [1, 2, 3, 4], Admin)).Status);
        var png = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0 };
        Assert.Equal(1, repository.SaveProductImage(1, "image/png", png, Admin).GorselSurumu);
        Assert.Equal(png, repository.ProductImage(1)!.Value.Data);
        repository.DeleteProductImage(1, Admin);
        Assert.Null(repository.ProductImage(1));
    }

    [Fact]
    public void SavingCreatesADailyBackup()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"atia-backup-{Guid.NewGuid():N}");
        try
        {
            var repository = Repository(Path.Combine(directory, "demo-state.json"));
            Order(repository, 11);
            Order(repository, 11);
            Assert.Single(Directory.GetFiles(Path.Combine(directory, "yedekler"), "demo-state-*.json"));
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }

    [Fact]
    public async Task GuestEndpointsAreAnonymousAndRateLimited()
    {
        using var factory = new ApiFactory();
        using var admin = factory.CreateClient();
        var login = await (await admin.PostAsJsonAsync("/api/auth/login", new LoginRequest { KullaniciAdi = "admin", Sifre = "demo123" }))
            .Content.ReadFromJsonAsync<ApiResult<LoginResponse>>();
        admin.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login!.Data!.Token);
        var codes = await (await admin.GetAsync("/api/masalar/qr")).Content.ReadFromJsonAsync<ApiResult<List<MasaQrDTO>>>();
        var code = codes!.Data!.First().Kod;
        using var guest = factory.CreateClient();
        Assert.Equal(HttpStatusCode.OK, (await guest.GetAsync($"/api/qr/{code}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.GetAsync("/api/cagrilar")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await guest.PostAsJsonAsync("/api/hizli-satis", new HizliSatisRequest())).StatusCode);
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 7; i++) statuses.Add((await guest.PostAsJsonAsync("/api/cagri", new CagriRequest { Kod = code })).StatusCode);
        Assert.Equal(6, statuses.Count(s => s == HttpStatusCode.OK));
        Assert.Equal(HttpStatusCode.TooManyRequests, statuses[^1]);
        Assert.Single((await (await admin.GetAsync("/api/cagrilar")).Content.ReadFromJsonAsync<ApiResult<List<MasaCagrisiDTO>>>())!.Data!);
    }
}
