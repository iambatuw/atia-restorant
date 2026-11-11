using System.Security.Cryptography;
using System.Text;
using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>Staff accounts. Passwords are stored as salted PBKDF2-SHA256 digests, never in plain text.</summary>
public sealed partial class RestaurantRepository
{
    private const int PasswordIterations = 100_000;
    private static readonly string[] StaffRoles = ["Admin", "Garson", "Mutfak"];
    private List<PersonelHesabi> _staff = [];
    private int _nextStaff;

    private static (string Salt, string Digest) HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        return (Convert.ToBase64String(salt), Convert.ToBase64String(Digest(password, salt)));
    }
    private static byte[] Digest(string password, byte[] salt) =>
        Rfc2898DeriveBytes.Pbkdf2(Encoding.UTF8.GetBytes(password), salt, PasswordIterations, HashAlgorithmName.SHA256, 32);
    private static void PasswordRule(string? password) => Require(password is { Length: >= 6 and <= 128 },
        "Şifre 6–128 karakter olmalı.");
    private static PersonelHesabiDTO StaffView(PersonelHesabi account) => new()
    {
        KayitNo = account.KayitNo, KullaniciAdi = account.KullaniciAdi, AdSoyad = account.AdSoyad, Rol = account.Rol,
        Aktif = account.Aktif, OlusturmaTarihi = account.OlusturmaTarihi, SonGiris = account.SonGiris
    };

    /// <summary>Verifies a login. The same generic error is returned for unknown, inactive and wrong-password accounts.</summary>
    public DogrulanmisPersonel Authenticate(string username, string password)
    {
        EnsureAvailable();
        PersonelHesabi? account;
        lock (_gate) account = _staff.FirstOrDefault(s => s.KullaniciAdi == username.Trim().ToLowerInvariant()) is { } found ? Copy(found) : null;
        // Always run the digest so response time does not reveal whether the user exists.
        var salt = account is null ? new byte[16] : Convert.FromBase64String(account.SifreTuzu);
        var actual = Digest(password, salt);
        var expected = account is null ? new byte[32] : Convert.FromBase64String(account.SifreOzeti);
        if (account is null || !account.Aktif || !CryptographicOperations.FixedTimeEquals(actual, expected))
            throw new ApiException(401, "Kullanıcı adı veya şifre hatalı.");
        lock (_gate)
        {
            var current = _staff.First(s => s.KayitNo == account.KayitNo);
            current.SonGiris = Now;
            Persist();
            return new(current.KayitNo, current.KullaniciAdi, current.AdSoyad, current.Rol, current.GuvenlikSurumu);
        }
    }

    /// <summary>A token stays valid only while the account is active and its role and security version are unchanged.</summary>
    public bool IsStaffTokenValid(int id, string role, int version)
    {
        if (!_mode.IsDemo) return false;
        lock (_gate) return _staff.Any(s => s.KayitNo == id && s.Aktif && s.Rol == role && s.GuvenlikSurumu == version);
    }

    public List<PersonelHesabiDTO> StaffAccounts(StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _staff.OrderBy(s => s.AdSoyad, StringComparer.Create(new System.Globalization.CultureInfo("tr-TR"), true))
            .Select(StaffView).ToList();
    });

    public PersonelHesabiDTO SaveStaff(int? id, PersonelYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var username = (request.KullaniciAdi ?? "").Trim().ToLowerInvariant();
        Require(username.Length is >= 3 and <= 32 && username.All(c => char.IsAsciiLetterLower(c) || char.IsAsciiDigit(c) || c is '.' or '_' or '-'),
            "Kullanıcı adı 3–32 karakter olmalı; yalnızca küçük harf, rakam, nokta, tire ve alt çizgi içerebilir.");
        var name = Mandatory(request.AdSoyad, 80, "Ad soyad");
        Require(StaffRoles.Contains(request.Rol), "Rol geçersiz.");
        Require(!_staff.Any(s => s.KayitNo != id && s.KullaniciAdi == username), "Bu kullanıcı adı zaten kullanılıyor.", 409);
        var account = id.HasValue ? _staff.FirstOrDefault(s => s.KayitNo == id.Value) ?? throw new ApiException(404, "Personel bulunamadı.") : null;
        if (account is null) PasswordRule(request.Sifre);
        else if (!string.IsNullOrEmpty(request.Sifre)) PasswordRule(request.Sifre);
        if (account is not null && account.KayitNo == actor.Id)
            Require(request.Aktif && request.Rol == "Admin", "Kendi hesabınızı pasifleştiremez veya yöneticilikten çıkaramazsınız.", 409);
        var remainingAdmins = _staff.Count(s => s.Aktif && s.Rol == "Admin" && s.KayitNo != account?.KayitNo) + (request.Aktif && request.Rol == "Admin" ? 1 : 0);
        Require(remainingAdmins > 0, "En az bir aktif yönetici hesabı kalmalı.", 409);

        var created = account is null;
        account ??= new PersonelHesabi { KayitNo = ++_nextStaff, OlusturmaTarihi = Now };
        var securityChanged = !created && (account.Rol != request.Rol || account.Aktif != request.Aktif || !string.IsNullOrEmpty(request.Sifre));
        account.KullaniciAdi = username; account.AdSoyad = name; account.Rol = request.Rol; account.Aktif = request.Aktif;
        if (!string.IsNullOrEmpty(request.Sifre)) (account.SifreTuzu, account.SifreOzeti) = HashPassword(request.Sifre);
        // Changing role, status or password signs the account out of every device.
        if (securityChanged) account.GuvenlikSurumu++;
        if (created) _staff.Add(account);
        Log(actor, created ? "Personel eklendi" : "Personel düzenlendi",
            $"{name} ({username}, {request.Rol}{(request.Aktif ? "" : ", pasif")}){(securityChanged ? " · oturumlar kapatıldı" : "")}");
        return StaffView(account);
    });

    private void SeedStaff()
    {
        _staff = [];
        foreach (var (id, username, name, role) in new[] { (1, "admin", "Demo Yönetici", "Admin"), (2, "garson", "Demo Garson", "Garson"), (3, "mutfak", "Demo Mutfak", "Mutfak") })
        {
            var (salt, digest) = HashPassword("demo123");
            _staff.Add(new PersonelHesabi { KayitNo = id, KullaniciAdi = username, AdSoyad = name, Rol = role, Aktif = true,
                SifreTuzu = salt, SifreOzeti = digest, OlusturmaTarihi = Now });
        }
        _nextStaff = 3;
    }
}
