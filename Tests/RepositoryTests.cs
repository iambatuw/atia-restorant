using AtiaRestorant.API.Data;
using AtiaRestorant.API.Models;
using Xunit;

namespace AtiaRestorant.API.Tests;

public sealed class RepositoryTests
{
    private static readonly StaffActor Admin = new(1, "Admin", "Admin");
    private static readonly StaffActor Waiter = new(2, "Waiter", "Garson");
    private static readonly StaffActor Cook = new(3, "Cook", "Mutfak");
    private static RestaurantRepository Repository() => new(new BackendMode(true), TimeProvider.System);
    private static SiparisEkleRequest Order(long table = 12, decimal quantity = 1) =>
        new() { MasaKayitNo = table, StokKayitNo = 4, Miktar = quantity, BirimFiyat = 0.01m, PersonelKayitNo = 999 };

    [Fact]
    public void AuditUsesVerifiedActorAndReconciliationCountsOnlySuccessfulOperations()
    {
        var repository = Repository();
        var date = repository.BusinessToday;
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.Audit(date, Waiter)).Status);
        var receipt = repository.AddOrder(Order(), Waiter);
        var line = Assert.Single(receipt.Detaylar);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.UpdateOrder(line.KayitNo,
            new() { Miktar = 1, Ikram = true }, Waiter)).Status);
        Assert.DoesNotContain(repository.Audit(date, Admin), entry => entry.Islem == "İkram verildi");
        repository.RemoveOrder(line.KayitNo, new() { Tip = SiparisCikarmaTipi.Iptal, Gerekce = "Müşteri vazgeçti" }, Waiter);
        var replacement = repository.AddOrder(Order(), Waiter);
        repository.Pay(12, new() { BaslikKayitNo = replacement.KayitNo, NakitTutar = 100, KismiOdeme = true }, Admin);
        repository.Pay(12, new() { BaslikKayitNo = replacement.KayitNo, BankaTutar = 220 }, Admin);
        var history = repository.Audit(date, Admin);
        Assert.Contains(history, entry => entry.Islem == "Ürün iptal edildi" && entry.PersonelId == Waiter.Id && entry.Tutar == 320m);
        Assert.Equal(2, history.Count(entry => entry.Islem == "Ödeme alındı" &&
            entry.PersonelId == Admin.Id && entry.AdisyonNo == replacement.KayitNo));
        var total = repository.DailyReport(date, Admin).Mutabakat;
        Assert.Equal(100m, total.Nakit);
        Assert.Equal(700m, total.Banka); // Seeded closed adisyon: 480 TL.
        Assert.Equal(320m, total.IptalTutari);
        Assert.Equal(3, total.OdemeSayisi);
        Assert.Equal(800m, total.Tahsilat);
        Assert.Equal(0m, total.Fark);
    }

    [Fact]
    public void MergedSourceReceiptIsNotCountedAsAnotherSale()
    {
        var repository = Repository();
        var before = repository.DailyReport(repository.BusinessToday, Admin);
        repository.Merge(new() { AnaMasaKayitNo = 1, BirlestirilecekMasaKayitNolar = [3] }, Admin);
        var after = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(before.ToplamCiro, after.ToplamCiro);
        Assert.Equal(before.ToplamAdisyon, after.ToplamAdisyon);
        Assert.Contains(repository.Audit(repository.BusinessToday, Admin), entry => entry.Islem == "Masalar birleştirildi");
    }

    [Fact]
    public void FailedMergeLeavesBothReceiptsAndAuditUntouched()
    {
        var repository = Repository();
        var before = repository.Receipt(1)!;
        var auditCount = repository.Audit(repository.BusinessToday, Admin).Count;
        Assert.Equal(404, Assert.Throws<ApiException>(() => repository.Merge(new()
        { AnaMasaKayitNo = 1, BirlestirilecekMasaKayitNolar = [3, 999] }, Admin)).Status);
        Assert.Equal(before.GenelToplam, repository.Receipt(1)!.GenelToplam);
        Assert.NotNull(repository.Receipt(3));
        Assert.Equal(auditCount, repository.Audit(repository.BusinessToday, Admin).Count);
    }

    [Fact]
    public void CancellationWasteAndKitchenReadinessAreSeparateAuthorizedOperations()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(), Waiter);
        var line = Assert.Single(receipt.Detaylar);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.RemoveOrder(line.KayitNo,
            new() { Gerekce = " " }, Waiter)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.RemoveOrder(line.KayitNo,
            new() { Tip = SiparisCikarmaTipi.Zayi, Gerekce = "Döküldü" }, Waiter)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.MarkLineReady(line.KayitNo, Waiter)).Status);
        repository.MarkLineReady(line.KayitNo, Cook);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.MarkLineReady(line.KayitNo, Cook)).Status);
        var eventItem = repository.KitchenEvents(Cook).Single(e => e.AdisyonNo == receipt.KayitNo);
        repository.AcknowledgeKitchenEvent(eventItem.KayitNo, Cook);
        Assert.DoesNotContain(repository.KitchenEvents(Cook), e => e.KayitNo == eventItem.KayitNo);
        repository.RemoveOrder(line.KayitNo, new() { Tip = SiparisCikarmaTipi.Zayi,
            Gerekce = "Döküldü" }, Admin);
        Assert.Contains(repository.KitchenEvents(Cook), e => e.Islem == "Zayi" && e.AdisyonNo == receipt.KayitNo);
        Assert.Equal(320m, repository.DailyReport(repository.BusinessToday, Admin).Mutabakat.ZayiTutari);
    }

    [Fact]
    public void DeliveryUsesMenuPricesAndRejectsDuplicateOrInvalidStatusChanges()
    {
        var repository = Repository();
        var request = new PaketSiparisEkleRequest
        {
            IdempotencyKey = Guid.NewGuid().ToString(), MusteriAdi = "Ayşe", Telefon = "05550000000",
            Adres = "Merkez Mahallesi", OdemeSekli = "Nakit",
            Satirlar = [new() { StokKayitNo = 4, Miktar = 2 }]
        };
        var delivery = repository.CreateDelivery(request, Waiter);
        Assert.Equal(640m, delivery.GenelToplam);
        Assert.Equal(delivery.KayitNo, repository.CreateDelivery(request, Waiter).KayitNo);
        Assert.Single(repository.Deliveries(Admin));
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.Deliveries(Cook)).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.UpdateDelivery(delivery.KayitNo,
            new() { Durum = PaketDurum.TeslimEdildi }, Waiter)).Status);
        repository.UpdateDelivery(delivery.KayitNo, new() { Durum = PaketDurum.Hazirlaniyor }, Waiter);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.UpdateDelivery(delivery.KayitNo,
            new() { Durum = PaketDurum.Yolda }, Waiter)).Status);
        repository.UpdateDelivery(delivery.KayitNo, new() { Durum = PaketDurum.Yolda, Kurye = "Mehmet" }, Waiter);
        var done = repository.UpdateDelivery(delivery.KayitNo, new() { Durum = PaketDurum.TeslimEdildi }, Waiter);
        Assert.Equal("Mehmet", done.Kurye);
        Assert.Equal(PaketDurum.TeslimEdildi, done.Durum);
    }

    [Fact]
    public async Task ConcurrentOrdersCreateExactlyOneReceiptWithNoLostLines()
    {
        var repository = Repository();
        await Task.WhenAll(Enumerable.Range(0, 100).Select(_ => Task.Run(() => repository.AddOrder(Order(), Waiter))));
        var receipt = repository.Receipt(12)!;
        Assert.Equal(100, receipt.Detaylar.Count);
        Assert.Equal(100, receipt.Detaylar.Select(d => d.KayitNo).Distinct().Count());
        Assert.Equal(32000m, receipt.GenelToplam);
        // A caller cannot mutate repository state through returned DTOs.
        receipt.Detaylar.Clear();
        Assert.Equal(100, repository.Receipt(12)!.Detaylar.Count);
    }

    [Fact]
    public void PricesAndPersonnelAreServerAuthoritativeIncludingPortions()
    {
        var repository = Repository();
        var request = Order();
        request.PorsiyonKayitNo = 41;
        var line = Assert.Single(repository.AddOrder(request, Waiter).Detaylar);
        Assert.Equal(192m, line.BirimFiyat);
        Assert.Equal(192m, line.SatirTutari);
        Assert.Equal(Waiter.Id, line.PersonelKayitNo);
        Assert.Equal(Waiter.Name, line.PersonelAdi);
        request.PorsiyonKayitNo = 999;
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.AddOrder(request, Waiter)).Status);
        request.PorsiyonKayitNo = null;
        request.Ikram = true;
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.AddOrder(request, Waiter)).Status);
    }

    [Fact]
    public void ComplimentaryQuantityRequiresAdminAndPaidReceiptsCannotFallBelowPayments()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(), Waiter);
        var line = Assert.Single(receipt.Detaylar);
        repository.UpdateOrder(line.KayitNo, new() { Miktar = 1, Ikram = true }, Admin);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.UpdateOrder(line.KayitNo, new() { Miktar = 2, Ikram = true }, Waiter)).Status);
        repository.UpdateOrder(line.KayitNo, new() { Miktar = 1, Ikram = false }, Admin);
        repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 100, KismiOdeme = true }, Admin);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.UpdateOrder(line.KayitNo, new() { Miktar = 1, Ikram = true }, Admin)).Status);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.RemoveOrder(line.KayitNo,
            new() { Tip = SiparisCikarmaTipi.Iptal, Gerekce = "Hatalı giriş" }, Admin)).Status);
        Assert.Equal(320m, repository.Receipt(12)!.GenelToplam);
        repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 220 }, Admin);
        Assert.Null(repository.Receipt(12));
    }

    [Fact]
    public async Task PaymentRejectsMismatchNegativeStaleAndConcurrentDuplicates()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(), Waiter);
        var payment = new OdemeRequest { BaslikKayitNo = receipt.KayitNo, NakitTutar = 319.99m };
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, payment, Admin)).Status);
        payment.NakitTutar = -1;
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Pay(12, payment, Admin)).Status);
        payment.NakitTutar = 320;
        payment.BaslikKayitNo++;
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, payment, Admin)).Status);
        payment.BaslikKayitNo = receipt.KayitNo;
        var results = await Task.WhenAll(Enumerable.Range(0, 20).Select(_ => Task.Run(() =>
        {
            try { repository.Pay(12, payment, Admin); return 200; }
            catch (ApiException exception) { return exception.Status; }
        })));
        Assert.Single(results, status => status == 200);
        Assert.Equal(19, results.Count(status => status == 409));
        Assert.Null(repository.Receipt(12));
        // Even after a new receipt opens, the old header cannot pay for it.
        repository.AddOrder(Order(), Waiter);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, payment, Admin)).Status);
    }

    [Fact]
    public void KitchenReadinessNeverUsesPrintCountAndIncreasesReturnTicket()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(quantity: 2), Waiter);
        var line = Assert.Single(receipt.Detaylar);
        repository.MarkReady(receipt.KayitNo, Cook);
        Assert.DoesNotContain(repository.Kitchen(), k => k.BaslikKayitNo == receipt.KayitNo);
        Assert.Null(repository.Receipt(12)!.Detaylar[0].YazdirilanMiktar);
        repository.UpdateOrder(line.KayitNo, new() { Miktar = 3 }, Waiter);
        var row = Assert.Single(repository.Kitchen().Single(k => k.BaslikKayitNo == receipt.KayitNo).Satirlar);
        Assert.Equal(2m, row.HazirMiktar); Assert.Equal(1m, row.KalanMiktar); Assert.False(row.Hazir);
        Assert.Equal(0m, row.YazdirilanMiktar);
        repository.UpdateOrder(line.KayitNo, new() { Miktar = 1 }, Waiter);
        repository.UpdateOrder(line.KayitNo, new() { Miktar = 2 }, Waiter);
        row = Assert.Single(repository.Kitchen().Single(k => k.BaslikKayitNo == receipt.KayitNo).Satirlar);
        Assert.Equal(1m, row.HazirMiktar); Assert.Equal(1m, row.KalanMiktar);
        repository.MarkReady(receipt.KayitNo, Cook);
        repository.AddOrder(Order(), Waiter);
        Assert.Contains(repository.Kitchen(), k => k.BaslikKayitNo == receipt.KayitNo);
    }

    [Fact]
    public void ReservationValidationRejectsMissingPastInvalidAndOverlappingRequests()
    {
        var repository = Repository();
        var request = new RezervasyonEkleRequest { MasaKayitNo = 12, MusteriAdi = "Ada Yılmaz", KisiSayisi = 4,
            Telefon = "+90 555 123 45 67", RezervasyonTarihi = DateTime.UtcNow.AddDays(1) };
        request.KisiSayisi = 0;
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Reserve(request, Admin)).Status);
        request.KisiSayisi = 4; request.MusteriAdi = " ";
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Reserve(request, Admin)).Status);
        request.MusteriAdi = "Ada"; request.RezervasyonTarihi = DateTime.UtcNow.AddMinutes(-1);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Reserve(request, Admin)).Status);
        request.RezervasyonTarihi = DateTime.SpecifyKind(DateTime.UtcNow.AddDays(1), DateTimeKind.Unspecified);
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Reserve(request, Admin)).Status);
        request.RezervasyonTarihi = DateTime.UtcNow.AddDays(1); request.Telefon = "bad phone";
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Reserve(request, Admin)).Status);
        request.Telefon = null;
        var saved = repository.Reserve(request, Admin);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Reserve(request, Admin)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.Reserve(request, Waiter)).Status);
        Assert.Equal(saved.KayitNo, repository.DeleteReservation(saved.KayitNo, Admin).KayitNo);
        Assert.Empty(repository.Reservations(null, Admin));
    }

    [Fact]
    public void ReportExcludesOpenReceiptsAndUsesClosedNetRevenue()
    {
        var repository = Repository();
        var before = repository.DailyReport(repository.BusinessToday, Admin);
        var receipt = repository.AddOrder(Order(), Waiter);
        var open = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(before.ToplamCiro, open.ToplamCiro);
        Assert.Equal(before.AcikAdisyon + 1, open.AcikAdisyon);
        repository.Pay(12, new() { BaslikKayitNo = receipt.KayitNo, NakitTutar = 300, IndirimTutar = 20 }, Admin);
        var closed = repository.DailyReport(repository.BusinessToday, Admin);
        Assert.Equal(before.ToplamCiro + 300, closed.ToplamCiro);
        Assert.Equal(closed.ToplamCiro, closed.SaatlikCiro.Sum(h => h.Ciro));
        Assert.Equal(before.ToplamAdisyon + 1, closed.ToplamAdisyon);
    }

    [Fact]
    public void RoleChecksApplyInsideRepositoryAndSqlFailsClosed()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(), Waiter);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.AddOrder(Order(), Cook)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.Pay(12, new(), Waiter)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.UpdateOrder(receipt.Detaylar[0].KayitNo,
            new() { Miktar = 1, Ikram = true }, Waiter)).Status);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.MarkReady(receipt.KayitNo, Waiter)).Status);
        var inactive = new RestaurantRepository(new(false), TimeProvider.System);
        Assert.Equal(503, Assert.Throws<ApiException>(() => inactive.Menu()).Status);
    }

    [Fact]
    public void ReportUsesBusinessDayAndReservationUsesCalendarDay()
    {
        // 21:30 UTC on Nov 5 is 00:30 Istanbul on Nov 6.
        var clock = new FixedClock(new DateTimeOffset(2026, 11, 5, 21, 30, 0, TimeSpan.Zero));
        var repository = new RestaurantRepository(new(true), clock);
        var localDay = new DateOnly(2026, 11, 6);
        var businessDay = localDay.AddDays(-1);
        Assert.Equal(businessDay, repository.BusinessToday);
        var report = repository.DailyReport(businessDay, Admin);
        Assert.Equal(480m, report.ToplamCiro); // Closed demo receipt.
        Assert.Equal(0, Assert.Single(report.SaatlikCiro).Saat);
        Assert.Equal(0m, repository.DailyReport(localDay, Admin).ToplamCiro);
        var reservation = repository.Reserve(new() { MasaKayitNo = 12, MusteriAdi = "Ada", KisiSayisi = 2,
            RezervasyonTarihi = new DateTime(2026, 11, 6, 22, 0, 0, DateTimeKind.Utc) }, Admin);
        Assert.Empty(repository.Reservations(localDay, Admin));
        Assert.Equal(reservation.KayitNo, Assert.Single(repository.Reservations(localDay.AddDays(1), Admin)).KayitNo);
        Assert.Equal(DateTimeKind.Utc, reservation.RezervasyonTarihi.Kind);
    }

    [Fact]
    public void ShiftCloseRequiresCompletedDayAndRecordsCashDifferenceOnce()
    {
        var clock = new FixedClock(new DateTimeOffset(2026, 11, 5, 21, 30, 0, TimeSpan.Zero));
        var repository = new RestaurantRepository(new(true), clock);
        var request = new VardiyaKapanisRequest { IsletmeTarihi = repository.BusinessToday, SayilanNakit = 15m };
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.CloseShift(request, Admin)).Status);
        clock.Current = new DateTimeOffset(2026, 11, 6, 1, 30, 0, TimeSpan.Zero);
        Assert.Equal(403, Assert.Throws<ApiException>(() => repository.CloseShift(request, Waiter)).Status);
        var close = repository.CloseShift(request, Admin);
        Assert.Equal(15m, close.NakitFarki);
        Assert.Equal(close.KapanisZamani,
            repository.DailyReport(request.IsletmeTarihi, Admin).VardiyaKapanisi!.KapanisZamani);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.CloseShift(request, Admin)).Status);
    }

    private sealed class FixedClock(DateTimeOffset now) : TimeProvider
    {
        public DateTimeOffset Current { get; set; } = now;
        public override DateTimeOffset GetUtcNow() => Current;
    }

    [Fact]
    public void MoveRequiresEmptyTargetAndKeepsReceiptIdentity()
    {
        var repository = Repository();
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Move(new() { KaynakMasaKayitNo = 1, HedefMasaKayitNo = 3 }, Admin)).Status);
        var original = repository.Receipt(1)!;
        var moved = repository.Move(new() { KaynakMasaKayitNo = 1, HedefMasaKayitNo = 12 }, Admin);
        Assert.Null(repository.Receipt(1));
        Assert.Equal(original.KayitNo, moved.KayitNo);
        Assert.Equal(12L, moved.MasaKayitNo);
        Assert.Equal(original.GenelToplam, moved.GenelToplam);
    }

    [Fact]
    public void SplitSeparatesLinesWithoutMutatingOpenStatusAndCalculatesTotalsCorrectly()
    {
        var repository = Repository();
        // Add two different items to Table 12
        var order1 = repository.AddOrder(new() { MasaKayitNo = 12, StokKayitNo = 1, Miktar = 2 }, Waiter); // Mercimek Çorbası 2 x 95 = 190
        var order2 = repository.AddOrder(new() { MasaKayitNo = 12, StokKayitNo = 4, Miktar = 1 }, Waiter); // Izgara Köfte 1 x 320 = 320
        var sourceReceipt = repository.Receipt(12)!;
        Assert.Equal(510m, sourceReceipt.GenelToplam);
        Assert.Equal(2, sourceReceipt.Detaylar.Count);

        var corbaLine = sourceReceipt.Detaylar.First(d => d.StokKayitNo == 1);
        var kofteLine = sourceReceipt.Detaylar.First(d => d.StokKayitNo == 4);

        // Split 1 çorba to empty Table 11
        var splitRequest = new MasaAyirRequest
        {
            MasaKayitNo = 12,
            HedefMasaKayitNo = 11,
            AyrilanSatirlar = [new() { DetayKayitNo = corbaLine.KayitNo, Miktar = 1 }]
        };

        var result = repository.Split(splitRequest, Admin);
        Assert.NotNull(result.KaynakAdisyon);
        Assert.NotNull(result.HedefAdisyon);

        // Source table (12) now has: 1 çorba (95) + 1 köfte (320) = 415
        var updatedSource = repository.Receipt(12)!;
        Assert.Equal(415m, updatedSource.GenelToplam);
        Assert.False(updatedSource.Kapali);
        var remainingCorba = Assert.Single(updatedSource.Detaylar, d => d.StokKayitNo == 1);
        Assert.Equal(1m, remainingCorba.Miktar);

        // Target table (11) now has: 1 çorba (95)
        var targetReceipt = repository.Receipt(11)!;
        Assert.Equal(95m, targetReceipt.GenelToplam);
        Assert.False(targetReceipt.Kapali);
        var splitCorba = Assert.Single(targetReceipt.Detaylar, d => d.StokKayitNo == 1);
        Assert.Equal(1m, splitCorba.Miktar);

        // Validations: cannot split to occupied table (Table 1 is occupied)
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Split(new()
        {
            MasaKayitNo = 12,
            HedefMasaKayitNo = 1,
            AyrilanSatirlar = [new() { DetayKayitNo = kofteLine.KayitNo, Miktar = 1 }]
        }, Admin)).Status);

        // Validations: cannot split all remaining lines (must use Table Move instead)
        Assert.Equal(400, Assert.Throws<ApiException>(() => repository.Split(new()
        {
            MasaKayitNo = 12,
            HedefMasaKayitNo = 10,
            AyrilanSatirlar =
            [
                new() { DetayKayitNo = remainingCorba.KayitNo, Miktar = 1 },
                new() { DetayKayitNo = kofteLine.KayitNo, Miktar = 1 }
            ]
        }, Admin)).Status);
    }

    [Fact]
    public void RejectedSplitLeavesSourceAndTargetUnchanged()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(quantity: 2), Waiter);
        var line = Assert.Single(receipt.Detaylar);
        Assert.Throws<ApiException>(() => repository.Split(new()
        {
            MasaKayitNo = 12, HedefMasaKayitNo = 11,
            AyrilanSatirlar = [new() { DetayKayitNo = line.KayitNo, Miktar = 1 }, new() { DetayKayitNo = 999999, Miktar = 1 }]
        }, Admin));
        Assert.Equal(2m, Assert.Single(repository.Receipt(12)!.Detaylar).Miktar);
        Assert.Equal(receipt.GenelToplam, repository.Receipt(12)!.GenelToplam);
        Assert.Null(repository.Receipt(11));
        Assert.Throws<ApiException>(() => repository.Split(new()
        {
            MasaKayitNo = 12, HedefMasaKayitNo = 11,
            AyrilanSatirlar = [new() { DetayKayitNo = line.KayitNo, Miktar = 2 }]
        }, Admin));
        Assert.Equal(2m, Assert.Single(repository.Receipt(12)!.Detaylar).Miktar);
    }

    [Fact]
    public void MergeCombinesReceiptsFixingLegacyNakitToplamBugAndAccumulatingAllPayments()
    {
        var repository = Repository();
        // Setup: Table 11 has an order (95 TL) with partial cash (50 TL) payment
        var r11 = repository.AddOrder(new() { MasaKayitNo = 11, StokKayitNo = 1, Miktar = 1 }, Waiter); // 95 TL
        repository.Pay(11, new() { BaslikKayitNo = r11.KayitNo, NakitTutar = 50m, KismiOdeme = true }, Admin);
        var r11State = repository.Receipt(11)!;
        Assert.Equal(50m, r11State.NakitToplam);
        Assert.False(r11State.Kapali);

        // Setup: Table 12 has an order (320 TL) with partial card (100 TL), meal card (30 TL) and discount (20 TL) payment
        var r12 = repository.AddOrder(new() { MasaKayitNo = 12, StokKayitNo = 4, Miktar = 1 }, Waiter); // 320 TL
        repository.Pay(12, new() { BaslikKayitNo = r12.KayitNo, BankaTutar = 100m, YemekKartiTutar = 30m, IndirimTutar = 20m, KismiOdeme = true }, Admin);
        var r12State = repository.Receipt(12)!;
        Assert.Equal(100m, r12State.BankaToplam);
        Assert.Equal(30m, r12State.YemekKartiToplam);
        Assert.Equal(20m, r12State.IndirimToplam);
        Assert.False(r12State.Kapali);

        // Merge Table 11 into Table 12
        var merged = repository.Merge(new()
        {
            AnaMasaKayitNo = 12,
            BirlestirilecekMasaKayitNolar = [11]
        }, Admin);

        // Verify Legacy Bug Fix:
        // In legacy code, NakitToplam was sequentially overwritten by BankaToplam, CariToplam, and IndirimToplam!
        // In modernized system, each payment type accumulates independently:
        Assert.Equal(50m, merged.NakitToplam);
        Assert.Equal(100m, merged.BankaToplam);
        Assert.Equal(30m, merged.YemekKartiToplam);
        Assert.Equal(20m, merged.IndirimToplam);
        Assert.Equal(0m, merged.CariToplam ?? 0);

        // Child table 11 receipt is closed and cleared
        Assert.Null(repository.Receipt(11));

        // Master receipt has items from both tables: 95 + 320 = 415
        Assert.Equal(415m, merged.GenelToplam);
        Assert.Equal(2, merged.Detaylar.Count);
    }

    [Fact]
    public void PartialPaymentAllowsIncrementalSettlementAndClosesOnlyWhenFullyPaid()
    {
        var repository = Repository();
        var order = repository.AddOrder(Order(table: 12, quantity: 1), Waiter); // 320 TL
        var receipt = repository.Receipt(12)!;

        // Pay 120 TL partially with cash
        var step1 = repository.Pay(12, new()
        {
            BaslikKayitNo = receipt.KayitNo,
            NakitTutar = 120m,
            KismiOdeme = true
        }, Admin);
        Assert.False(step1.Kapali);
        Assert.Equal(120m, step1.NakitToplam);

        // Attempting to pay more than remaining balance (remaining = 200 TL) fails
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, new()
        {
            BaslikKayitNo = receipt.KayitNo,
            BankaTutar = 201m,
            KismiOdeme = true
        }, Admin)).Status);

        // Pay remaining 200 TL with card (KismiOdeme: false or true both close it if balance reaches total)
        var step2 = repository.Pay(12, new()
        {
            BaslikKayitNo = receipt.KayitNo,
            BankaTutar = 200m,
            KismiOdeme = false
        }, Admin);
        Assert.True(step2.Kapali);
        Assert.Equal(120m, step2.NakitToplam);
        Assert.Equal(200m, step2.BankaToplam);
        Assert.Null(repository.Receipt(12));
    }

    [Fact]
    public void PosStateMachineManagesTerminalLifecycleAndEnforcesIdempotency()
    {
        var repository = Repository();
        var order = repository.AddOrder(Order(table: 12, quantity: 1), Waiter); // 320 TL
        var idempotencyKey = "pos-test-key-12345";

        // Initiate POS transaction for Hugin S1
        var tx = repository.PosIslemBaslat(new()
        {
            MasaKayitNo = 12,
            BaslikKayitNo = order.KayitNo,
            Tutar = 150m,
            CihazTipi = PosCihazTipi.HuginS1,
            IdempotencyKey = idempotencyKey
        }, Waiter);

        Assert.Equal(PosDurum.CihazaGonderildi, tx.Durum);
        Assert.Equal(150m, tx.Tutar);
        Assert.False(tx.Basarili);

        // Re-sending with same IdempotencyKey returns identical transaction
        var idempotentTx = repository.PosIslemBaslat(new()
        {
            MasaKayitNo = 12,
            BaslikKayitNo = order.KayitNo,
            Tutar = 150m,
            CihazTipi = PosCihazTipi.HuginS1,
            IdempotencyKey = idempotencyKey
        }, Waiter);
        Assert.Equal(tx.IslemId, idempotentTx.IslemId);

        // Query status
        var queried = repository.PosIslemSorgula(tx.IslemId);
        Assert.Equal(tx.IslemId, queried.IslemId);

        // Simulate terminal approval
        var approved = repository.PosIslemSimuleSonuc(tx.IslemId, basarili: true);
        Assert.Equal(PosDurum.Onaylandi, approved.Durum);
        Assert.True(approved.Basarili);
        Assert.NotNull(approved.AuthCode);
        Assert.NotNull(approved.Rrn);
        Assert.NotNull(approved.MaskedPan);

        // Complete partial payment referencing this approved POS transaction
        var paidReceipt = repository.Pay(12, new()
        {
            BaslikKayitNo = order.KayitNo,
            BankaTutar = 150m,
            KismiOdeme = true,
            PosIslemId = tx.IslemId
        }, Admin);

        Assert.Equal(150m, paidReceipt.BankaToplam);
        // Pos transaction is marked as recorded in ERP
        var recordedPos = repository.PosIslemSorgula(tx.IslemId);
        Assert.Equal(PosDurum.ErpKaydedildi, recordedPos.Durum);
    }

    [Fact]
    public void PosApprovalCannotBeReusedOrAppliedToAnotherAmount()
    {
        var repository = Repository();
        var receipt = repository.AddOrder(Order(), Waiter);
        var tx = repository.PosIslemBaslat(new() { MasaKayitNo = 12, BaslikKayitNo = receipt.KayitNo,
            Tutar = 100m, CihazTipi = PosCihazTipi.HariciManuelPos }, Admin);
        var wrongAmount = new OdemeRequest { BaslikKayitNo = receipt.KayitNo, BankaTutar = 90m,
            KismiOdeme = true, PosIslemId = tx.IslemId };
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, wrongAmount, Admin)).Status);
        Assert.Equal(0m, repository.Receipt(12)!.BankaToplam ?? 0m);
        Assert.DoesNotContain(repository.Audit(repository.BusinessToday, Admin), item =>
            item.Islem == "Ödeme alındı" && item.AdisyonNo == receipt.KayitNo);
        var payment = new OdemeRequest { BaslikKayitNo = receipt.KayitNo, BankaTutar = 100m,
            KismiOdeme = true, PosIslemId = tx.IslemId };
        repository.Pay(12, payment, Admin);
        Assert.Equal(409, Assert.Throws<ApiException>(() => repository.Pay(12, payment, Admin)).Status);
        Assert.Equal(100m, repository.Receipt(12)!.BankaToplam);
    }
}
