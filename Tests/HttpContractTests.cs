using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using AtiaRestorant.API.Data;
using AtiaRestorant.API.Models;
using AtiaRestorant.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace AtiaRestorant.API.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Demo:Enabled"] = "true", ["JwtSettings:SecretKey"] = "test-only-generated-config-key-32-bytes-minimum"
        }));
    }
}

public sealed class HttpContractTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = false };
    private static async Task Login(HttpClient client, string username)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { KullaniciAdi = username, Sifre = "demo123" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<ApiResult<LoginResponse>>(Json);
        Assert.NotNull(result?.Data);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", result.Data.Token);
    }

    [Theory]
    [InlineData("admin", "Admin")]
    [InlineData("garson", "Garson")]
    [InlineData("mutfak", "Mutfak")]
    public async Task SessionIdentityRequiresAuthenticationAndReturnsVerifiedRole(string username, string role)
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/session")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/raporlar/islemler")).StatusCode);
        await Login(client, username);
        var result = await client.GetFromJsonAsync<JsonElement>("/api/auth/session");
        Assert.Equal(role, result.GetProperty("Data").GetProperty("Rol").GetString());
        Assert.True(result.GetProperty("Data").GetProperty("KullaniciId").GetInt32() > 0);
    }

    [Fact]
    public async Task HealthMenuPascalCaseAndAuthenticatedRolesMatchContract()
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        var health = await client.GetFromJsonAsync<JsonElement>("/api/health");
        Assert.True(health.GetProperty("Success").GetBoolean());
        Assert.Equal("Demo", health.GetProperty("Data").GetProperty("Mode").GetString());
        Assert.False(health.GetProperty("Data").GetProperty("DatabaseReady").GetBoolean());
        Assert.False(health.TryGetProperty("data", out _));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/menu")).StatusCode);
        var unauthorized = await client.GetAsync("/api/masalar");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
        Assert.Equal("application/problem+json", unauthorized.Content.Headers.ContentType?.MediaType);
        await Login(client, "garson");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/masalar")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/raporlar/gunluk")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/raporlar/islemler")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/masalar/1/odeme", new OdemeRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/mutfak")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/mutfak/bildirimler")).StatusCode);
        await Login(client, "mutfak");
        var kitchen = await client.GetAsync("/api/mutfak");
        Assert.Equal(HttpStatusCode.OK, kitchen.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/mutfak/bildirimler")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/raporlar/islemler")).StatusCode);
        var tickets = (await kitchen.Content.ReadFromJsonAsync<ApiResult<List<MutfakSiparisDTO>>>(Json))!.Data!;
        Assert.Equal(2, tickets.Count);
        Assert.All(tickets.SelectMany(t => t.Satirlar), row => Assert.False(row.Hazir));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/siparisler", new SiparisEkleRequest())).StatusCode);
    }

    [Fact]
    public async Task HttpOrderAndPaymentUseServerAuthorityAndNonSuccessProblems()
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        await Login(client, "admin");
        var response = await client.PostAsJsonAsync("/api/siparisler", new SiparisEkleRequest { MasaKayitNo = 12,
            StokKayitNo = 4, Miktar = 1, BirimFiyat = 1, PersonelKayitNo = 999 });
        var receipt = (await response.Content.ReadFromJsonAsync<ApiResult<AdisyonBaslikDTO>>(Json))!.Data!;
        Assert.Equal(320m, receipt.GenelToplam);
        Assert.Equal(1, receipt.PersonelKayitNo);
        var payment = new OdemeRequest { BaslikKayitNo = receipt.KayitNo, NakitTutar = 1 };
        response = await client.PostAsJsonAsync("/api/masalar/12/odeme", payment);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        payment.NakitTutar = 320;
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/masalar/12/odeme", payment)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/masalar/12/odeme", payment)).StatusCode);
        var empty = await client.GetFromJsonAsync<JsonElement>("/api/masalar/12/adisyon");
        Assert.Equal(JsonValueKind.Null, empty.GetProperty("Data").ValueKind);
        response = await client.PostAsync("/api/siparisler", new StringContent("{bad json", Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain("Exception", await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/raporlar/gunluk?tarih=wrong")).StatusCode);
    }

    [Fact]
    public async Task HttpCancellationRequiresReasonAndWasteNeedsAdmin()
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        await Login(client, "garson");
        var created = await client.PostAsJsonAsync("/api/siparisler", new SiparisEkleRequest
            { MasaKayitNo = 12, StokKayitNo = 4, Miktar = 1 });
        var receipt = (await created.Content.ReadFromJsonAsync<ApiResult<AdisyonBaslikDTO>>(Json))!.Data!;
        var lineId = Assert.Single(receipt.Detaylar).KayitNo;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/siparisler/{lineId}/cikar",
            new SiparisCikarmaRequest())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync($"/api/siparisler/{lineId}/cikar",
            new SiparisCikarmaRequest { Tip = SiparisCikarmaTipi.Zayi, Gerekce = "Döküldü" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"/api/siparisler/{lineId}/cikar",
            new SiparisCikarmaRequest { Tip = SiparisCikarmaTipi.Iptal, Gerekce = "Müşteri vazgeçti" })).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.DeleteAsync($"/api/siparisler/{lineId}")).StatusCode);
    }

    [Fact]
    public async Task HttpTableSplitMergeAndPosEndpointsExecuteCorrectly()
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        await Login(client, "admin");

        // Create orders on table 12: 2 soups (190) and 1 meatball (320)
        var order1 = await client.PostAsJsonAsync("/api/siparisler", new SiparisEkleRequest
        {
            MasaKayitNo = 12,
            StokKayitNo = 1,
            Miktar = 2,
            BirimFiyat = 1
        });
        var r1 = (await order1.Content.ReadFromJsonAsync<ApiResult<AdisyonBaslikDTO>>(Json))!.Data!;
        var corbaLine = r1.Detaylar.First(d => d.StokKayitNo == 1);

        var order2 = await client.PostAsJsonAsync("/api/siparisler", new SiparisEkleRequest
        {
            MasaKayitNo = 12,
            StokKayitNo = 4,
            Miktar = 1,
            BirimFiyat = 1
        });
        Assert.Equal(HttpStatusCode.OK, order2.StatusCode);

        // Split 1 soup to table 11 via HTTP POST /api/masalar/ayir
        var splitResponse = await client.PostAsJsonAsync("/api/masalar/ayir", new MasaAyirRequest
        {
            MasaKayitNo = 12,
            HedefMasaKayitNo = 11,
            AyrilanSatirlar = [new() { DetayKayitNo = corbaLine.KayitNo, Miktar = 1 }]
        });
        Assert.Equal(HttpStatusCode.OK, splitResponse.StatusCode);
        var splitResult = (await splitResponse.Content.ReadFromJsonAsync<ApiResult<MasaAyirSonucDTO>>(Json))!.Data!;
        Assert.Equal(95m, splitResult.HedefAdisyon.GenelToplam);

        // POS integration: start POS transaction on table 11
        var posInit = await client.PostAsJsonAsync("/api/pos/islem", new PosIslemIstek
        {
            MasaKayitNo = 11,
            BaslikKayitNo = splitResult.HedefAdisyon.KayitNo,
            Tutar = 95m,
            CihazTipi = PosCihazTipi.HuginS1,
            IdempotencyKey = "http-pos-test-11"
        });
        Assert.Equal(HttpStatusCode.OK, posInit.StatusCode);
        var posTx = (await posInit.Content.ReadFromJsonAsync<ApiResult<PosIslemKayitDTO>>(Json))!.Data!;
        Assert.Equal(PosDurum.CihazaGonderildi, posTx.Durum);

        // Simulate terminal approval
        var approveResponse = await client.PostAsJsonAsync($"/api/pos/islem/{posTx.IslemId}/simule-onay", new { });
        Assert.Equal(HttpStatusCode.OK, approveResponse.StatusCode);

        // Pay table 11 with card linked to POS transaction
        var payResponse = await client.PostAsJsonAsync("/api/masalar/11/odeme", new OdemeRequest
        {
            BaslikKayitNo = splitResult.HedefAdisyon.KayitNo,
            BankaTutar = 95m,
            PosIslemId = posTx.IslemId
        });
        Assert.Equal(HttpStatusCode.OK, payResponse.StatusCode);

        // Verify table 11 is now closed and free
        var table11Receipt = await client.GetFromJsonAsync<JsonElement>("/api/masalar/11/adisyon");
        Assert.Equal(JsonValueKind.Null, table11Receipt.GetProperty("Data").ValueKind);
    }

    [Fact]
    public async Task LoginIsRateLimitedAndHubRequiresAuthentication()
    {
        using var factory = new ApiFactory();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync("/hubs/restorant/negotiate?negotiateVersion=1", null)).StatusCode);
        for (var i = 0; i < 10; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login",
                new LoginRequest { KullaniciAdi = "admin", Sifre = "wrong" })).StatusCode);
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest { KullaniciAdi = "admin", Sifre = "demo123" });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public void ProductionDisallowsDemoAndRequiresStrongExternalKey()
    {
        var production = new FakeEnvironment { EnvironmentName = Environments.Production };
        var empty = new ConfigurationBuilder().Build();
        Assert.Throws<InvalidOperationException>(() => JwtConfiguration.Load(empty, production, new(true)));
        Assert.Throws<InvalidOperationException>(() => JwtConfiguration.Load(empty, production, new(false)));
        var weak = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["JwtSettings:SecretKey"] = "weak" }).Build();
        Assert.Throws<InvalidOperationException>(() => JwtConfiguration.Load(weak, production, new(false)));
        var valid = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> {
            ["JwtSettings:SecretKey"] = "production-test-configuration-at-least-32-bytes" }).Build();
        var config = JwtConfiguration.Load(valid, production, new(false));
        var auth = new AuthService(new(false), production, config, TimeProvider.System);
        Assert.Equal(503, Assert.Throws<ApiException>(() => auth.Login(new() { KullaniciAdi = "admin", Sifre = "demo123" })).Status);
        var dev = new FakeEnvironment { EnvironmentName = Environments.Development };
        Assert.NotEqual(JwtConfiguration.Load(empty, dev, new(true)).Key, JwtConfiguration.Load(empty, dev, new(true)).Key);
    }

    [Fact]
    public async Task SqlModeHealthIsHonestAndEveryOtherRouteFailsClosed()
    {
        using var factory = new SqlFactory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var healthResponse = await client.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, healthResponse.StatusCode);
        var health = await healthResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("SqlServer", health.GetProperty("Data").GetProperty("Mode").GetString());
        Assert.False(health.GetProperty("Data").GetProperty("DatabaseReady").GetBoolean());
        foreach (var path in new[] { "/api/menu", "/api/masalar", "/api/bolumler", "/api/mutfak", "/api/raporlar/gunluk", "/api/rezervasyonlar" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        }
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
            { KullaniciAdi = "admin", Sifre = "demo123" })).StatusCode);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.PostAsync("/hubs/restorant/negotiate?negotiateVersion=1", null)).StatusCode);
    }

    private sealed class SqlFactory : WebApplicationFactory<Program>
    {
        // Startup intentionally validates mode/key before the deferred web-host callbacks.
        // This class's HTTP tests execute serially; restore process configuration immediately.
        protected override IHost CreateHost(IHostBuilder builder)
        {
            var previousDemo = Environment.GetEnvironmentVariable("Demo__Enabled");
            var previousKey = Environment.GetEnvironmentVariable("JwtSettings__SecretKey");
            try
            {
                Environment.SetEnvironmentVariable("Demo__Enabled", "false");
                Environment.SetEnvironmentVariable("JwtSettings__SecretKey", "sql-mode-test-only-key-with-at-least-32-bytes");
                return base.CreateHost(builder);
            }
            finally
            {
                Environment.SetEnvironmentVariable("Demo__Enabled", previousDemo);
                Environment.SetEnvironmentVariable("JwtSettings__SecretKey", previousKey);
            }
        }
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Production");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Demo:Enabled"] = "false", ["JwtSettings:SecretKey"] = "sql-mode-test-only-key-with-at-least-32-bytes"
            }));
        }
    }

    private sealed class FakeEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = "";
        public string ApplicationName { get; set; } = "Tests";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
