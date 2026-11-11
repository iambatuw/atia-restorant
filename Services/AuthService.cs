using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using AtiaRestorant.API.Data;
using AtiaRestorant.API.Models;
using Microsoft.IdentityModel.Tokens;

namespace AtiaRestorant.API.Services;

public sealed record JwtConfiguration(string Key, string Issuer, string Audience)
{
    public static JwtConfiguration Load(IConfiguration configuration, IHostEnvironment environment, BackendMode mode)
    {
        if (mode.IsDemo && !environment.IsDevelopment())
            throw new InvalidOperationException("Demo mode is permitted only in Development.");
        var key = configuration["JwtSettings:SecretKey"];
        if (string.IsNullOrEmpty(key) && environment.IsDevelopment())
            key = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
        if (string.IsNullOrWhiteSpace(key) || Encoding.UTF8.GetByteCount(key) < 32)
            throw new InvalidOperationException("Set JwtSettings__SecretKey to at least 32 UTF-8 bytes.");
        return new(key, configuration["JwtSettings:Issuer"] ?? "AtiaRestorant",
            configuration["JwtSettings:Audience"] ?? "AtiaRestorantClient");
    }
}

public sealed class AuthService(BackendMode mode, IHostEnvironment environment, JwtConfiguration jwt,
    TimeProvider clock, RestaurantRepository repository)
{
    public const string StoreClaim = "magaza";
    public const string VersionClaim = "surum";

    public LoginResponse Login(LoginRequest request)
    {
        if (!mode.IsDemo) throw new ApiException(503, "ERP kimlik doğrulaması henüz etkin değil.");
        if (!environment.IsDevelopment()) throw new ApiException(503, "Demo oturum açma kapalı.");
        if (request.KullaniciAdi is null || request.Sifre is null || request.KullaniciAdi.Length > 64 || request.Sifre.Length > 128)
            throw new ApiException(400, "Oturum açma bilgileri geçersiz.");
        // Accounts and salted password digests are managed on the staff screen (demo seeds admin/garson/mutfak).
        var account = repository.Authenticate(request.KullaniciAdi, request.Sifre);
        var now = clock.GetUtcNow().UtcDateTime;
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, account.Id.ToString(CultureInfo.InvariantCulture)),
            new Claim(ClaimTypes.Name, account.AdSoyad), new Claim(ClaimTypes.Role, account.Rol),
            new Claim(StoreClaim, repository.StoreId.ToString(CultureInfo.InvariantCulture)),
            new Claim(VersionClaim, account.GuvenlikSurumu.ToString(CultureInfo.InvariantCulture)),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) };
        var token = new JwtSecurityToken(jwt.Issuer, jwt.Audience, claims, now, now.AddHours(8),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)), SecurityAlgorithms.HmacSha256));
        return new() { Token = new JwtSecurityTokenHandler().WriteToken(token), KullaniciAdi = account.KullaniciAdi,
            Rol = account.Rol, KullaniciId = account.Id, TamAd = account.AdSoyad, MagazaKayitNo = repository.StoreId,
            MagazaAdi = repository.Settings().Isletme.Unvan };
    }
}
