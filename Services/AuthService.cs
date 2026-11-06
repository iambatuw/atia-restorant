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

public sealed class AuthService(BackendMode mode, IHostEnvironment environment, JwtConfiguration jwt, TimeProvider clock)
{
    public LoginResponse Login(LoginRequest request)
    {
        if (!mode.IsDemo) throw new ApiException(503, "ERP kimlik doğrulaması henüz etkin değil.");
        if (!environment.IsDevelopment()) throw new ApiException(503, "Demo oturum açma kapalı.");
        if (request.KullaniciAdi is null || request.Sifre is null || request.KullaniciAdi.Length > 64 || request.Sifre.Length > 128)
            throw new ApiException(400, "Oturum açma bilgileri geçersiz.");
        var account = request.KullaniciAdi.Trim().ToLowerInvariant() switch
        {
            "admin" => (Id: 1, Role: "Admin", Name: "Demo Yönetici"),
            "garson" => (Id: 2, Role: "Garson", Name: "Demo Garson"),
            "mutfak" => (Id: 3, Role: "Mutfak", Name: "Demo Mutfak"),
            _ => (Id: 0, Role: "", Name: "")
        };
        var actual = SHA256.HashData(Encoding.UTF8.GetBytes(request.Sifre));
        var expected = SHA256.HashData(Encoding.UTF8.GetBytes("demo123"));
        if (!CryptographicOperations.FixedTimeEquals(actual, expected) || account.Id == 0)
            throw new ApiException(401, "Kullanıcı adı veya şifre hatalı.");
        var now = clock.GetUtcNow().UtcDateTime;
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()),
            new Claim(ClaimTypes.Name, account.Name), new Claim(ClaimTypes.Role, account.Role),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) };
        var token = new JwtSecurityToken(jwt.Issuer, jwt.Audience, claims, now, now.AddHours(8),
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)), SecurityAlgorithms.HmacSha256));
        return new() { Token = new JwtSecurityTokenHandler().WriteToken(token), KullaniciAdi = request.KullaniciAdi.Trim().ToLowerInvariant(),
            Rol = account.Role, KullaniciId = account.Id, TamAd = account.Name };
    }
}
