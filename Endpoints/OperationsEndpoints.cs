using System.Globalization;
using System.Security.Claims;
using AtiaRestorant.API.Data;
using AtiaRestorant.API.Hubs;
using AtiaRestorant.API.Models;
using Microsoft.AspNetCore.SignalR;

namespace AtiaRestorant.API.Endpoints;

/// <summary>
/// Staff, setup, receipt history, delivery customer, report and stock endpoints. Kept apart from Program.cs so
/// the original routes stay easy to compare. Every route inherits the "Staff" policy of the /api group.
/// </summary>
public static class OperationsEndpoints
{
    public static RouteGroupBuilder MapOperationsEndpoints(this RouteGroupBuilder api)
    {
        // ── Personel ──
        api.MapGet("/personel", (ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.StaffAccounts(Actor(user)))).RequireAuthorization("Admin");
        api.MapPost("/personel", (PersonelYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveStaff(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/personel/{id:int}", (int id, PersonelYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveStaff(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");

        // ── Ayarlar ──
        api.MapPut("/ayarlar/isletme", (IsletmeBilgisiYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveStoreProfile(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/ayarlar/hazir-notlar", (HazirNotlarRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveQuickNotes(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPost("/ayarlar/hazir-notlar", (HazirNotEkleRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.AddQuickNote(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/ayarlar/yazicilar", (YazicilarRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SavePrinters(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/ayarlar/yemek-kartlari", (YemekKartlariRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveMealCards(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/demo/durum", (RestaurantRepository repository) => Ok(repository.DemoStatus())).RequireAuthorization("Admin");
        api.MapPost("/demo/sifirla", (ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.ResetDemo(Actor(user)), hub, logs)).RequireAuthorization("Admin");

        // ── Bölüm ve masa tanımları ──
        api.MapPost("/bolumler", (BolumYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveSection(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/bolumler/{id:long}", (long id, BolumYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveSection(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapDelete("/bolumler/{id:long}", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.DeleteSection(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPost("/masalar", (MasaYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveTable(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/masalar/{id:long}", (long id, MasaYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveTable(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapDelete("/masalar/{id:long}", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.DeleteTable(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPatch("/masalar/{id:long}/kisi-sayisi", (long id, KisiSayisiRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SetGuestCount(id, request, Actor(user)), hub, logs)).RequireAuthorization("Orders");

        // ── Adisyon geçmişi, düzeltme, iade, çıktı ──
        api.MapGet("/adisyonlar", (string? tarih, bool? acik, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.ReceiptHistory(ParseDate(tarih) ?? repository.BusinessToday, acik ?? false, Actor(user)))).RequireAuthorization("Admin");
        api.MapGet("/adisyonlar/{id:long}", (long id, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.ReceiptDetail(id, Actor(user)))).RequireAuthorization("Admin");
        api.MapGet("/adisyonlar/{id:long}/konum", (long id, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.LocateReceipt(id, Actor(user)))).RequireAuthorization("Orders");
        api.MapPost("/adisyonlar/{id:long}/yazdirildi", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.MarkReceiptPrinted(id, Actor(user)), hub, logs)).RequireAuthorization("Orders");
        api.MapPost("/adisyonlar/{id:long}/odeme-duzelt", (long id, OdemeDuzeltRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.CorrectPayment(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPost("/adisyonlar/{id:long}/iade", (long id, IadeRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.Refund(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");

        // ── Raporlar ──
        api.MapGet("/raporlar/donem", (string? baslangic, string? bitis, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.PeriodReport(Range(baslangic, bitis, repository).Start, Range(baslangic, bitis, repository).End, Actor(user)))).RequireAuthorization("Admin");
        api.MapGet("/raporlar/personel", (string? baslangic, string? bitis, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.StaffReport(Range(baslangic, bitis, repository).Start, Range(baslangic, bitis, repository).End, Actor(user)))).RequireAuthorization("Admin");

        // ── Paket servis: müşteri, kurye, tahsilat ──
        api.MapGet("/musteriler", (string? ara, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.Customers(ara, Actor(user)))).RequireAuthorization("Orders");
        api.MapGet("/musteriler/{id:long}", (long id, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.CustomerDetail(id, Actor(user)))).RequireAuthorization("Orders");
        api.MapPut("/musteriler/{id:long}", (long id, MusteriYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveCustomer(id, request, Actor(user)), hub, logs)).RequireAuthorization("Orders");
        api.MapDelete("/musteriler/{id:long}", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.DeleteCustomer(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/kuryeler", (ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.Couriers(Actor(user)))).RequireAuthorization("Orders");
        api.MapPut("/kuryeler", (KuryelerRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveCouriers(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPost("/paket-siparisler/{id:long}/tahsilat", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.CollectDelivery(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");

        // ── Stok, reçete, maliyet ──
        api.MapGet("/stok/hammaddeler", (ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.Ingredients(Actor(user)))).RequireAuthorization("Admin");
        api.MapPost("/stok/hammaddeler", (HammaddeYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveIngredient(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/stok/hammaddeler/{id:long}", (long id, HammaddeYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveIngredient(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/stok/receteler/{productId:long}", (long productId, ReceteYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveRecipe(productId, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPost("/stok/hareketler", (StokHareketRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.AddStockMovement(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/stok/hareketler", (long? hammadde, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.StockMovements(hammadde, Actor(user)))).RequireAuthorization("Admin");
        api.MapGet("/stok/maliyet", (ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.RecipeCosts(Actor(user)))).RequireAuthorization("Admin");
        // ── Cari hesap, kasa hareketi, fatura bilgisi ──
        api.MapGet("/cari", (string? ara, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.Accounts(ara, Actor(user)))).RequireAuthorization("Admin");
        api.MapPost("/cari", (CariHesapYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveAccount(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/cari/{id:long}", (long id, CariHesapYazRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SaveAccount(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/cari/{id:long}/ekstre", (long id, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.AccountStatement(id, Actor(user)))).RequireAuthorization("Admin");
        api.MapPost("/cari/{id:long}/tahsilat", (long id, CariTahsilatRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.CollectAccount(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/kasa/hareketler", (string? tarih, ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.CashMovements(ParseDate(tarih) ?? repository.BusinessToday, Actor(user)))).RequireAuthorization("Admin");
        api.MapPost("/kasa/hareketler", (KasaHareketiRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.AddCashMovement(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapPut("/adisyonlar/{id:long}/fatura-bilgisi", (long id, AdisyonFaturaBilgisiDTO? request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.SetInvoiceDetails(id, request, Actor(user)), hub, logs)).RequireAuthorization("Orders");

        // ── Hızlı satış ──
        api.MapPost("/hizli-satis", (HizliSatisRequest request, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.QuickSale(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");

        // ── QR menü ve garson çağırma ──
        api.MapGet("/masalar/qr", (ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.TableQrCodes(Actor(user)))).RequireAuthorization("Admin");
        api.MapPost("/masalar/{id:long}/qr-yenile", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.RenewTableQr(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/qr/{kod}", (string kod, RestaurantRepository repository) => Ok(repository.TableForGuest(kod))).AllowAnonymous();
        api.MapPost("/cagri", (CagriRequest request, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.CallStaff(request), hub, logs)).AllowAnonymous().RequireRateLimiting("guest");
        api.MapGet("/cagrilar", (ClaimsPrincipal user, RestaurantRepository repository) =>
            Ok(repository.OpenCalls(Actor(user)))).RequireAuthorization("Orders");
        api.MapPost("/cagrilar/{id:long}/tamam", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.CompleteCall(id, Actor(user)), hub, logs)).RequireAuthorization("Orders");

        // ── Ürün görseli ──
        api.MapPost("/menu/urunler/{id:long}/gorsel", async (long id, IFormFile? dosya, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
        {
            if (dosya is null || dosya.Length is 0 or > 2 * 1024 * 1024) throw new ApiException(400, "En fazla 2 MB bir görsel seçin.");
            using var buffer = new MemoryStream();
            await dosya.CopyToAsync(buffer);
            return await Mutate(() => repository.SaveProductImage(id, dosya.ContentType, buffer.ToArray(), Actor(user)), hub, logs);
        }).RequireAuthorization("Admin").DisableAntiforgery();
        api.MapDelete("/menu/urunler/{id:long}/gorsel", (long id, ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
            Mutate(() => repository.DeleteProductImage(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");
        api.MapGet("/menu/urunler/{id:long}/gorsel", (long id, RestaurantRepository repository, HttpContext context) =>
        {
            if (repository.ProductImage(id) is not { } image) return Results.NotFound();
            context.Response.Headers.CacheControl = "public, max-age=86400";
            context.Response.Headers["X-Content-Type-Options"] = "nosniff";
            return Results.File(image.Data, image.Type);
        }).AllowAnonymous();
        return api;
    }

    private static IResult Ok<T>(T value) => Results.Ok(ApiResult<T>.Ok(value));

    private static StaffActor Actor(ClaimsPrincipal user)
    {
        if (!int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || id <= 0)
            throw new ApiException(403, "Personel kimliği geçersiz.");
        var role = user.FindFirstValue(ClaimTypes.Role) ?? "";
        if (role is not ("Admin" or "Garson" or "Mutfak")) throw new ApiException(403, "Personel rolü geçersiz.");
        return new(id, user.Identity?.Name ?? "", role);
    }

    private static DateOnly? ParseDate(string? date)
    {
        if (date is null) return null;
        if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
            throw new ApiException(400, "Tarih YYYY-MM-DD biçiminde olmalı.");
        return parsed;
    }

    /// <summary>Defaults to the current month up to today's business date.</summary>
    private static (DateOnly Start, DateOnly End) Range(string? start, string? end, RestaurantRepository repository)
    {
        var today = repository.BusinessToday;
        var to = ParseDate(end) ?? today;
        return (ParseDate(start) ?? new DateOnly(to.Year, to.Month, 1), to);
    }

    private static async Task<IResult> Mutate<T>(Func<T> operation, IHubContext<RestorantHub> hub, ILoggerFactory logs)
    {
        var result = operation();
        try { await hub.Clients.All.SendAsync("Changes"); }
        catch (Exception exception) { logs.CreateLogger("Changes").LogWarning(exception, "Invalidation delivery failed."); }
        return Results.Ok(ApiResult<T>.Ok(result));
    }
}
