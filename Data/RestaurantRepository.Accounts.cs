using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>
/// Customer credit accounts (cari), till cash movements and invoice details on a receipt.
/// A cari payment debits the account; collections credit it and reach the till like any other payment.
/// </summary>
public sealed partial class RestaurantRepository
{
    private const string AccountCollectionAction = "Cari tahsilatı";
    private const string CashMovementAction = "Kasa hareketi";
    private static readonly string[] CashInCategories = ["Kasa açılışı", "Bozuk para", "Diğer giriş"];
    private static readonly string[] CashOutCategories = ["Masraf", "Tedarikçi ödemesi", "Bankaya yatırılan", "Personel avansı", "Diğer çıkış"];
    private List<CariHesapDTO> _accounts = [];
    private List<CariHareketDTO> _accountMovements = [];
    private List<KasaHareketiDTO> _cashMovements = [];
    private long _nextAccount, _nextAccountMovement, _nextCashMovement;

    private CariHesapDTO Account(long id) => _accounts.FirstOrDefault(a => a.KayitNo == id)
        ?? throw new ApiException(404, "Cari hesap bulunamadı.");

    private void AccountEntry(CariHesapDTO account, string type, decimal debit, decimal credit, long? receiptId, string? note, string actor)
    {
        account.Bakiye += debit - credit;
        _accountMovements.Add(new CariHareketDTO { KayitNo = ++_nextAccountMovement, CariKayitNo = account.KayitNo, Tarih = Now, Tip = type,
            Borc = debit, Alacak = credit, BakiyeSonrasi = account.Bakiye, AdisyonNo = receiptId, Aciklama = note, PersonelAdi = actor });
    }

    /// <summary>Debits a cari account for a receipt payment. Inactive accounts and exceeded limits are refused.</summary>
    private CariHesapDTO? ChargeAccount(decimal amount, long? accountId, long receiptId, string? note, string actor)
    {
        var account = CheckAccountCharge(amount, accountId);
        if (account is not null) AccountEntry(account, "Adisyon", amount, 0, receiptId, note, actor);
        return account;
    }

    /// <summary>Validates a cari charge without changing anything, so callers can fail before mutating.</summary>
    private CariHesapDTO? CheckAccountCharge(decimal amount, long? accountId, decimal alreadyCharged = 0)
    {
        if (amount <= 0) { Require(accountId is null, "Cari tutarı olmadan cari hesap seçilemez."); return null; }
        // Older clients may send a cari amount without an account; it is then reported as unassigned.
        if (accountId is null) return null;
        var account = Account(accountId.Value);
        Require(account.Aktif, "Cari hesap pasif.", 409);
        Require(account.KrediLimiti == 0 || account.Bakiye - alreadyCharged + amount <= account.KrediLimiti,
            $"{account.Unvan} için kredi limiti aşılıyor (bakiye {account.Bakiye:n2} TL, limit {account.KrediLimiti:n2} TL).", 409);
        return account;
    }

    public List<CariHesapDTO> Accounts(string? search, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        var text = search?.Trim() ?? "";
        return _accounts.Where(a => text.Length == 0 || a.Unvan.Contains(text, StringComparison.CurrentCultureIgnoreCase) ||
                (a.Telefon ?? "").Contains(text, StringComparison.Ordinal) || (a.VergiNo ?? "").Contains(text, StringComparison.Ordinal))
            .OrderByDescending(a => a.Bakiye).ThenBy(a => a.Unvan).ToList();
    });

    public CariHesapDTO SaveAccount(long? id, CariHesapYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var name = Mandatory(request.Unvan, 120, "Cari unvanı");
        var taxNo = Optional(request.VergiNo, 11, "Vergi numarası");
        Require(taxNo is null || (taxNo.Length is 10 or 11 && taxNo.All(char.IsAsciiDigit)), "Vergi numarası 10, TC kimlik numarası 11 haneli olmalı.");
        Amount(request.KrediLimiti, "Kredi limiti");
        Require(!_accounts.Any(a => a.KayitNo != id && string.Equals(a.Unvan, name, StringComparison.OrdinalIgnoreCase)), "Bu unvanla cari hesap var.", 409);
        var account = id.HasValue ? Account(id.Value) : new CariHesapDTO { KayitNo = ++_nextAccount };
        account.Unvan = name; account.Telefon = Optional(request.Telefon, 30, "Telefon");
        account.VergiDairesi = Optional(request.VergiDairesi, 80, "Vergi dairesi"); account.VergiNo = taxNo;
        account.Adres = Optional(request.Adres, 300, "Adres"); account.KrediLimiti = request.KrediLimiti; account.Aktif = request.Aktif;
        if (!id.HasValue) _accounts.Add(account);
        Log(actor, id.HasValue ? "Cari hesap düzenlendi" : "Cari hesap açıldı", name);
        return account;
    });

    public CariEkstreDTO AccountStatement(long id, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return new CariEkstreDTO { Hesap = Account(id), Hareketler = _accountMovements.Where(m => m.CariKayitNo == id).OrderByDescending(m => m.KayitNo).Take(500).ToList() };
    });

    public CariHesapDTO CollectAccount(long id, CariTahsilatRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment);
        var account = Account(id);
        Amount(request.Nakit, "Nakit"); Amount(request.Banka, "Banka");
        var total = request.Nakit + request.Banka;
        Require(total > 0, "Tahsilat tutarı sıfırdan büyük olmalı.");
        var note = Optional(request.Aciklama, 200, "Açıklama");
        AccountEntry(account, "Tahsilat", 0, total, null, note, actor.Name);
        _audit.Add(new IslemKaydiDTO { KayitNo = ++_nextAudit, Tarih = Now, Islem = AccountCollectionAction,
            Aciklama = $"{account.Unvan}{(note is null ? "" : $": {note}")}", PersonelId = actor.Id, PersonelAdi = actor.Name,
            Tutar = total, Nakit = request.Nakit, Banka = request.Banka });
        return account;
    });

    // ───── KASA HAREKETİ ─────
    public KasaHareketiDTO AddCashMovement(KasaHareketiRequest request, StaffActor actor) => Change(() =>
    {
        Permission(actor, StaffOperation.Payment);
        Require((request.Giris ? CashInCategories : CashOutCategories).Contains(request.Kategori), "Kasa hareketi kategorisi geçersiz.");
        Amount(request.Tutar, "Tutar");
        Require(request.Tutar > 0, "Tutar sıfırdan büyük olmalı.");
        var note = Mandatory(request.Aciklama, 200, "Açıklama");
        Require(!_shiftClosings.ContainsKey(BusinessToday), "Bugünün vardiyası kapatılmış; kasa hareketi eklenemez.", 409);
        var movement = new KasaHareketiDTO { KayitNo = ++_nextCashMovement, Tarih = Now, Giris = request.Giris, Kategori = request.Kategori,
            Tutar = request.Tutar, Aciklama = note, PersonelAdi = actor.Name };
        _cashMovements.Add(movement);
        _audit.Add(new IslemKaydiDTO { KayitNo = ++_nextAudit, Tarih = Now, Islem = CashMovementAction,
            Aciklama = $"{(request.Giris ? "Giriş" : "Çıkış")} · {request.Kategori}: {note}", PersonelId = actor.Id, PersonelAdi = actor.Name,
            Tutar = request.Giris ? request.Tutar : -request.Tutar });
        return movement;
    });

    public List<KasaHareketiDTO> CashMovements(DateOnly date, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _cashMovements.Where(m => BusinessDate(m.Tarih) == date).OrderByDescending(m => m.KayitNo).ToList();
    });

    /// <summary>Till figures that are not table payments: cash movements and cari collections of a business day.</summary>
    private (decimal In, decimal Out, decimal AccountCash, decimal AccountBank, List<KasaHareketiDTO> Movements) TillExtras(DateOnly date)
    {
        var movements = _cashMovements.Where(m => BusinessDate(m.Tarih) == date).OrderBy(m => m.KayitNo).ToList();
        var collections = _audit.Where(e => e.Islem == AccountCollectionAction && BusinessDate(e.Tarih) == date).ToList();
        return (movements.Where(m => m.Giris).Sum(m => m.Tutar), movements.Where(m => !m.Giris).Sum(m => m.Tutar),
            collections.Sum(e => e.Nakit), collections.Sum(e => e.Banka), movements);
    }

    // ───── FATURA BİLGİSİ ─────
    public AdisyonBaslikDTO SetInvoiceDetails(long id, AdisyonFaturaBilgisiDTO? request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin", "Garson");
        var receipt = ReceiptByNumber(id);
        Require(!_mergedReceipts.Contains(id), "Birleştirilmiş adisyona fatura bilgisi yazılamaz.", 409);
        if (request is null || string.IsNullOrWhiteSpace(request.Unvan))
        {
            receipt.FaturaBilgisi = null;
            Log(actor, "Fatura bilgisi kaldırıldı", receipt.MasaAdi ?? "", receipt.KayitNo);
            return receipt;
        }
        var taxNo = Optional(request.VergiNo, 11, "Vergi numarası");
        Require(taxNo is null || (taxNo.Length is 10 or 11 && taxNo.All(char.IsAsciiDigit)), "Vergi numarası 10, TC kimlik numarası 11 haneli olmalı.");
        receipt.FaturaBilgisi = new AdisyonFaturaBilgisiDTO { Unvan = Mandatory(request.Unvan, 120, "Unvan"),
            VergiDairesi = Optional(request.VergiDairesi, 80, "Vergi dairesi"), VergiNo = taxNo, Adres = Optional(request.Adres, 300, "Adres") };
        Log(actor, "Fatura bilgisi yazıldı", $"{receipt.MasaAdi}: {receipt.FaturaBilgisi.Unvan}", receipt.KayitNo);
        return receipt;
    });

    private void SeedAccounts()
    {
        _accounts = [new() { KayitNo = 1, Unvan = "Demo Lojistik A.Ş.", Telefon = "02120000000", VergiDairesi = "Demo VD", VergiNo = "1234567890", KrediLimiti = 10000 },
            new() { KayitNo = 2, Unvan = "Komşu Eczane", KrediLimiti = 2000 }];
        _nextAccount = 2;
    }
}
