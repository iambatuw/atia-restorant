using System.Globalization;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using AtiaRestorant.API.Data;
using AtiaRestorant.API.Endpoints;
using AtiaRestorant.API.Hubs;
using AtiaRestorant.API.Models;
using AtiaRestorant.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.SignalR;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
var mode = new BackendMode(builder.Configuration.GetValue<bool>("Demo:Enabled"));
var jwt = JwtConfiguration.Load(builder.Configuration, builder.Environment, mode);
builder.Services.AddSingleton(mode);
builder.Services.AddSingleton(jwt);
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddSingleton<RestaurantRepository>();
builder.Services.AddSingleton<AuthService>();
builder.Services.Configure<JsonOptions>(o => o.SerializerOptions.PropertyNamingPolicy = null);
builder.Services.AddSignalR().AddJsonProtocol(o => o.PayloadSerializerOptions.PropertyNamingPolicy = null);
builder.Services.AddProblemDetails(o => o.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new()
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer, ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
        NameClaimType = ClaimTypes.Name, RoleClaimType = ClaimTypes.Role,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256], ClockSkew = TimeSpan.FromSeconds(30)
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            if (context.Request.Path.StartsWithSegments("/hubs/restorant") &&
                context.Request.Query.TryGetValue("access_token", out var token)) context.Token = token;
            return Task.CompletedTask;
        },
        // A signed token is not enough: the account must still be active, keep the same role and
        // security version (password/role changes sign out), and belong to this store.
        OnTokenValidated = context =>
        {
            var principal = context.Principal!;
            var repository = context.HttpContext.RequestServices.GetRequiredService<RestaurantRepository>();
            if (!int.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ||
                !int.TryParse(principal.FindFirstValue(AuthService.VersionClaim), out var version) ||
                principal.FindFirstValue(AuthService.StoreClaim) != repository.StoreId.ToString(CultureInfo.InvariantCulture) ||
                !repository.IsStaffTokenValid(id, principal.FindFirstValue(ClaimTypes.Role) ?? "", version))
                context.Fail("Oturum artık geçerli değil.");
            return Task.CompletedTask;
        }
    };
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Staff", policy => policy.RequireAuthenticatedUser().RequireRole("Admin", "Garson", "Mutfak"));
    options.AddPolicy("Orders", policy => policy.RequireAuthenticatedUser().RequireRole("Admin", "Garson"));
    options.AddPolicy("Kitchen", policy => policy.RequireAuthenticatedUser().RequireRole("Admin", "Mutfak"));
    options.AddPolicy("Admin", policy => policy.RequireAuthenticatedUser().RequireRole("Admin"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    // Anonymous QR-menu calls ("garson çağır") are limited per address to stop flooding the staff screens.
    options.AddPolicy("guest", context => RateLimitPartition.GetFixedWindowLimiter(
        "guest:" + (context.Connection.RemoteIpAddress?.ToString() ?? "unknown"), _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 6, Window = TimeSpan.FromMinutes(1), QueueLimit = 0, AutoReplenishment = true }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        var guest = context.HttpContext.Request.Path.StartsWithSegments("/api/cagri");
        await Results.Problem(statusCode: 429, title: guest ? "Çok fazla istek gönderildi; lütfen biraz bekleyin." : "Çok fazla oturum açma denemesi.")
            .ExecuteAsync(context.HttpContext);
    };
});
if (builder.Environment.IsDevelopment()) builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins("http://localhost:5173").AllowAnyMethod().AllowAnyHeader().AllowCredentials()));

var app = builder.Build();
// Deliberately do not enable DeveloperExceptionPage: API errors must never disclose internals.
app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (ApiException exception) when (!context.Response.HasStarted)
    {
        context.Response.Clear();
        await Results.Problem(statusCode: exception.Status, title: exception.Message).ExecuteAsync(context);
    }
    catch (BadHttpRequestException) when (!context.Response.HasStarted)
    {
        context.Response.Clear();
        await Results.Problem(statusCode: 400, title: "İstek gövdesi veya parametreleri geçersiz.").ExecuteAsync(context);
    }
    catch (Exception exception) when (!context.Response.HasStarted)
    {
        app.Logger.LogError(exception, "Request failed. Trace {TraceId}", context.TraceIdentifier);
        context.Response.Clear();
        await Results.Problem(statusCode: 500, title: "İşlem tamamlanamadı.").ExecuteAsync(context);
    }
});
app.UseStatusCodePages(async statusContext =>
{
    var response = statusContext.HttpContext.Response;
    await Results.Problem(statusCode: response.StatusCode, title: response.StatusCode switch
    { 401 => "Oturum açmanız gerekiyor.", 403 => "Bu işlem için yetkiniz yok.", 404 => "Kaynak bulunamadı.",
        400 => "İstek geçersiz.", _ => "İstek tamamlanamadı." }).ExecuteAsync(statusContext.HttpContext);
});
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRouting();
if (app.Environment.IsDevelopment()) app.UseCors();
app.Use(async (context, next) =>
{
    if (!mode.IsDemo && !context.Request.Path.Equals("/api/health", StringComparison.OrdinalIgnoreCase))
    {
        await Results.Problem(statusCode: 503, title: "ERP şeması doğrulanmadı; SQL erişimi kapalı.").ExecuteAsync(context);
        return;
    }
    await next(context);
});
// Health remains an HTTP-accessible liveness probe; all SQL requests above fail closed,
// including HTTP requests in Production, rather than redirecting to an inactive adapter.
if (!app.Environment.IsDevelopment()) app.UseWhen(
    context => !context.Request.Path.Equals("/api/health", StringComparison.OrdinalIgnoreCase),
    branch => branch.UseHttpsRedirection());
app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

var api = app.MapGroup("/api").RequireAuthorization("Staff");
api.MapGet("/health", (RestaurantRepository repository) => Results.Ok(ApiResult.Ok(new { Mode = mode.Name, DatabaseReady = false,
    KaliciDemo = mode.IsDemo && repository.IsPersistent }))).AllowAnonymous();
api.MapPost("/auth/login", (LoginRequest request, AuthService auth) => Results.Ok(ApiResult<LoginResponse>.Ok(auth.Login(request))))
    .AllowAnonymous().RequireRateLimiting("login");
api.MapGet("/auth/session", (ClaimsPrincipal user, RestaurantRepository repository) => Results.Ok(ApiResult.Ok(new {
    KullaniciId = int.Parse(user.FindFirstValue(ClaimTypes.NameIdentifier)!),
    TamAd = user.FindFirstValue(ClaimTypes.Name)!,
    Rol = user.FindFirstValue(ClaimTypes.Role)!,
    MagazaKayitNo = repository.StoreId,
    MagazaAdi = repository.Settings().Isletme.Unvan
})));
api.MapGet("/menu", (RestaurantRepository repository) => Results.Ok(ApiResult<List<MenuKategoriDTO>>.Ok(repository.Menu()))).AllowAnonymous();
api.MapGet("/menu/yonetim", (ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<MenuKategoriDTO>>.Ok(repository.ManageMenu(Actor(user))))).RequireAuthorization("Admin");
api.MapPost("/menu/kategoriler", (MenuKategoriYazRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.SaveCategory(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPut("/menu/kategoriler/{id:long}", (long id, MenuKategoriYazRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.SaveCategory(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPost("/menu/urunler", (MenuUrunYazRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.SaveProduct(null, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPut("/menu/urunler/{id:long}", (long id, MenuUrunYazRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.SaveProduct(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapGet("/paket-siparisler", (ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<PaketSiparisDTO>>.Ok(repository.Deliveries(Actor(user)))))
    .RequireAuthorization("Orders");
api.MapPost("/paket-siparisler", (PaketSiparisEkleRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.CreateDelivery(request, Actor(user)), hub, logs))
    .RequireAuthorization("Orders");
api.MapPatch("/paket-siparisler/{id:long}/durum", (long id, PaketDurumRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.UpdateDelivery(id, request, Actor(user)), hub, logs))
    .RequireAuthorization("Orders");
api.MapGet("/entegrasyonlar/gelen", (ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<GelenSiparisDTO>>.Ok(repository.IncomingOrders(Actor(user))))).RequireAuthorization("Admin");
api.MapPost("/entegrasyonlar/gelen", (GelenSiparisEkleRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.StageIncomingOrder(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPut("/entegrasyonlar/gelen/{id:long}/eslestir", (long id, GelenSiparisEslemeRequest request,
    ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.MapIncomingOrder(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPost("/entegrasyonlar/gelen/{id:long}/aktar", (long id, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.TransferIncomingOrder(id, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapGet("/bolumler", (RestaurantRepository repository) => Results.Ok(ApiResult<List<RestorantBolumDTO>>.Ok(repository.Sections())));
api.MapGet("/masalar", (long? bolumId, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<RestorantMasaDTO>>.Ok(repository.Tables(bolumId))));
api.MapGet("/masalar/{id:long}/adisyon", (long id, RestaurantRepository repository) =>
    Results.Ok(ApiResult<AdisyonBaslikDTO?>.Ok(repository.Receipt(id))));
api.MapGet("/ayarlar", (RestaurantRepository repository) =>
    Results.Ok(ApiResult<RestoranAyarlariDTO>.Ok(repository.Settings())));
api.MapPut("/ayarlar/zayi", (ZayiAyariRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.SetWasteEnabled(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPost("/siparisler", (SiparisEkleRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.AddOrder(request, Actor(user)), hub, logs))
    .RequireAuthorization("Orders");
api.MapPost("/siparisler/toplu", (TopluSiparisEkleRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.AddOrders(request, Actor(user)), hub, logs))
    .RequireAuthorization("Orders");
api.MapPatch("/siparisler/{id:long}", (long id, SiparisGuncelleRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.UpdateOrder(id, request, Actor(user)), hub, logs)).RequireAuthorization("Orders");
api.MapPost("/siparisler/{id:long}/cikar", (long id, SiparisCikarmaRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.RemoveOrder(id, request, Actor(user)), hub, logs))
    .RequireAuthorization("Orders");
api.MapPost("/masalar/{id:long}/odeme", (long id, OdemeRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.Pay(id, request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapPost("/masalar/tasi", (MasaTasiRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.Move(request, Actor(user)), hub, logs))
    .RequireAuthorization("Admin");
api.MapPost("/masalar/ayir", (MasaAyirRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.Split(request, Actor(user)), hub, logs))
    .RequireAuthorization("Admin");
api.MapPost("/masalar/birlestir", (MasaBirlestirRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.Merge(request, Actor(user)), hub, logs))
    .RequireAuthorization("Admin");
api.MapPost("/pos/islem", (PosIslemIstek request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.PosIslemBaslat(request, Actor(user)), hub, logs))
    .RequireAuthorization("Orders");
api.MapGet("/pos/islem/{islemId}", (string islemId, RestaurantRepository repository) =>
    Results.Ok(ApiResult<PosIslemKayitDTO>.Ok(repository.PosIslemSorgula(islemId))))
    .RequireAuthorization("Orders");
api.MapPost("/pos/islem/{islemId}/simule-onay", (string islemId, bool? basarili, string? hataMesaji, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.PosIslemSimuleSonuc(islemId, basarili ?? true, hataMesaji), hub, logs))
    .RequireAuthorization("Orders");
api.MapGet("/mutfak", (RestaurantRepository repository) => Results.Ok(ApiResult<List<MutfakSiparisDTO>>.Ok(repository.Kitchen())))
    .RequireAuthorization("Kitchen");
api.MapGet("/mutfak/bildirimler", (ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<MutfakBildirimDTO>>.Ok(repository.KitchenEvents(Actor(user)))))
    .RequireAuthorization("Kitchen");
api.MapPost("/mutfak/bildirimler/{id:long}/yazdir", (long id, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.RequestKitchenPrint(id, Actor(user)), hub, logs)).RequireAuthorization("Kitchen");
api.MapPost("/mutfak/bildirimler/{id:long}/yazdirma-sonucu", (long id, MutfakYazdirmaSonucRequest request,
    ClaimsPrincipal user, RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.FinishKitchenPrint(id, request, Actor(user)), hub, logs)).RequireAuthorization("Kitchen");
api.MapPost("/mutfak/bildirimler/{id:long}/goruldu", (long id, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.AcknowledgeKitchenEvent(id, Actor(user)), hub, logs)).RequireAuthorization("Kitchen");
api.MapPost("/mutfak/satirlar/{id:long}/hazir", (long id, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.MarkLineReady(id, Actor(user)), hub, logs)).RequireAuthorization("Kitchen");
api.MapPost("/mutfak/{baslikId:long}/hazir", (long baslikId, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.MarkReady(baslikId, Actor(user)), hub, logs))
    .RequireAuthorization("Kitchen");
api.MapGet("/raporlar/gunluk", (string? tarih, ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<GunlukRaporDTO>.Ok(repository.DailyReport(ParseDate(tarih) ?? repository.BusinessToday, Actor(user)))))
    .RequireAuthorization("Admin");
api.MapGet("/raporlar/islemler", (string? tarih, ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<IslemKaydiDTO>>.Ok(repository.Audit(ParseDate(tarih) ?? repository.BusinessToday, Actor(user)))))
    .RequireAuthorization("Admin");
api.MapPost("/raporlar/vardiya-kapat", (VardiyaKapanisRequest request, ClaimsPrincipal user,
    RestaurantRepository repository, IHubContext<RestorantHub> hub, ILoggerFactory logs) =>
    Mutate(() => repository.CloseShift(request, Actor(user)), hub, logs)).RequireAuthorization("Admin");
api.MapGet("/rezervasyonlar", (string? tarih, ClaimsPrincipal user, RestaurantRepository repository) =>
    Results.Ok(ApiResult<List<RezervasyonDTO>>.Ok(repository.Reservations(ParseDate(tarih), Actor(user)))))
    .RequireAuthorization("Admin");
api.MapPost("/rezervasyonlar", (RezervasyonEkleRequest request, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.Reserve(request, Actor(user)), hub, logs))
    .RequireAuthorization("Admin");
api.MapDelete("/rezervasyonlar/{id:long}", (long id, ClaimsPrincipal user, RestaurantRepository repository,
    IHubContext<RestorantHub> hub, ILoggerFactory logs) => Mutate(() => repository.DeleteReservation(id, Actor(user)), hub, logs))
    .RequireAuthorization("Admin");
api.MapOperationsEndpoints();
app.MapHub<RestorantHub>("/hubs/restorant").RequireAuthorization("Staff");
app.MapFallbackToFile("{*path:regex(^(?!api|hubs).*$)}", "index.html");
app.Run();

static StaffActor Actor(ClaimsPrincipal user)
{
    if (!int.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || id <= 0)
        throw new ApiException(403, "Personel kimliği geçersiz.");
    var role = user.FindFirstValue(ClaimTypes.Role) ?? "";
    if (role is not ("Admin" or "Garson" or "Mutfak")) throw new ApiException(403, "Personel rolü geçersiz.");
    return new(id, user.Identity?.Name ?? "", role);
}
static DateOnly? ParseDate(string? date)
{
    if (date is null) return null;
    if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        throw new ApiException(400, "Tarih YYYY-MM-DD biçiminde olmalı.");
    return parsed;
}
static async Task<IResult> Mutate<T>(Func<T> operation, IHubContext<RestorantHub> hub, ILoggerFactory logs)
{
    var result = operation();
    // A transport outage must not report an already-committed mutation as failed.
    try { await hub.Clients.All.SendAsync("Changes"); }
    catch (Exception exception) { logs.CreateLogger("Changes").LogWarning(exception, "Invalidation delivery failed."); }
    return Results.Ok(ApiResult<T>.Ok(result));
}

public partial class Program { }
