using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>Store profile, quick notes, printer routing, meal cards, sections and tables.</summary>
public sealed partial class RestaurantRepository
{
    private IsletmeBilgisiDTO _isletme = new();
    private List<string> _quickNotes = [];
    private List<YaziciDTO> _printers = [];
    private List<YemekKartiDTO> _mealCards = [];
    private List<BolumTanimi> _sections = [];
    private long _nextSection, _nextTable, _nextPrinter, _nextMealCard;

    private static string? Optional(string? value, int max, string label)
    {
        var trimmed = value?.Trim();
        Require(trimmed is null || trimmed.Length <= max, $"{label} en fazla {max} karakter olabilir.");
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }
    private static string Mandatory(string? value, int max, string label)
    {
        Require(!string.IsNullOrWhiteSpace(value) && value.Trim().Length <= max, $"{label} 1–{max} karakter olmalı.");
        return value!.Trim();
    }

    private RestoranAyarlariDTO SettingsView() => new()
    {
        ZayiAktif = _wasteEnabled, Isletme = _isletme, HazirNotlar = _quickNotes,
        Yazicilar = _printers, YemekKartlari = _mealCards
    };

    public IsletmeBilgisiDTO SaveStoreProfile(IsletmeBilgisiYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        _isletme.Unvan = Mandatory(request.Unvan, 120, "İşletme unvanı");
        _isletme.Adres = Optional(request.Adres, 300, "Adres");
        _isletme.Telefon = Optional(request.Telefon, 30, "Telefon");
        _isletme.VergiDairesi = Optional(request.VergiDairesi, 80, "Vergi dairesi");
        var taxNo = Optional(request.VergiNo, 11, "Vergi numarası");
        Require(taxNo is null || (taxNo.Length is 10 or 11 && taxNo.All(char.IsAsciiDigit)), "Vergi numarası 10 veya 11 haneli olmalı.");
        _isletme.VergiNo = taxNo;
        _isletme.FisAltYazisi = Optional(request.FisAltYazisi, 200, "Fiş alt yazısı");
        Log(actor, "İşletme bilgisi güncellendi", _isletme.Unvan);
        return _isletme;
    });

    public List<string> SaveQuickNotes(HazirNotlarRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var notes = (request.Notlar ?? throw new ApiException(400, "Not listesi geçersiz."))
            .Select(note => Mandatory(note, 40, "Hazır not")).ToList();
        Require(notes.Count <= 30, "En fazla 30 hazır not tanımlanabilir.");
        Require(notes.Distinct(StringComparer.OrdinalIgnoreCase).Count() == notes.Count, "Hazır notlar birbirinden farklı olmalı.");
        _quickNotes = notes;
        foreach (var product in _menu.SelectMany(category => category.Urunler))
            product.HazirNotlar = (product.HazirNotlar ?? []).Where(note => notes.Contains(note, StringComparer.OrdinalIgnoreCase)).ToList();
        Log(actor, "Hazır notlar güncellendi", $"{notes.Count} not");
        return _quickNotes;
    });

    public List<YaziciDTO> SavePrinters(YazicilarRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var list = request.Yazicilar ?? throw new ApiException(400, "Yazıcı listesi geçersiz.");
        Require(list.Count <= 10 && list.All(p => p is not null), "En fazla 10 yazıcı tanımlanabilir.");
        var categoryIds = _menu.Select(c => c.KayitNo).ToHashSet();
        var assigned = new HashSet<long>();
        var result = new List<YaziciDTO>();
        foreach (var printer in list)
        {
            var name = Mandatory(printer.Ad, 40, "Yazıcı adı");
            var categories = (printer.Kategoriler ?? []).Distinct().ToList();
            Require(categories.All(categoryIds.Contains), "Yazıcıya atanan kategori bulunamadı.", 404);
            Require(categories.All(assigned.Add), "Bir kategori yalnızca bir yazıcıya atanabilir.");
            var id = printer.KayitNo > 0 && _printers.Any(p => p.KayitNo == printer.KayitNo) ? printer.KayitNo : ++_nextPrinter;
            result.Add(new YaziciDTO { KayitNo = id, Ad = name, Kategoriler = categories });
        }
        Require(result.Select(p => p.Ad).Distinct(StringComparer.OrdinalIgnoreCase).Count() == result.Count, "Yazıcı adları farklı olmalı.");
        _printers = result;
        Log(actor, "Yazıcı yönlendirmesi güncellendi", string.Join(", ", result.Select(p => p.Ad)));
        return _printers;
    });

    public List<YemekKartiDTO> SaveMealCards(YemekKartlariRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var list = request.Kartlar ?? throw new ApiException(400, "Yemek kartı listesi geçersiz.");
        Require(list.Count <= 20 && list.All(c => c is not null), "En fazla 20 yemek kartı tanımlanabilir.");
        var result = new List<YemekKartiDTO>();
        foreach (var card in list)
        {
            Require(card.KomisyonOrani >= 0 && card.KomisyonOrani <= 30 && decimal.Round(card.KomisyonOrani, 2) == card.KomisyonOrani,
                "Komisyon oranı %0–30 aralığında ve en fazla iki ondalıklı olmalı.");
            var id = card.KayitNo > 0 && _mealCards.Any(c => c.KayitNo == card.KayitNo) ? card.KayitNo : ++_nextMealCard;
            result.Add(new YemekKartiDTO { KayitNo = id, Ad = Mandatory(card.Ad, 40, "Yemek kartı adı"), KomisyonOrani = card.KomisyonOrani, Aktif = card.Aktif });
        }
        Require(result.Select(c => c.Ad).Distinct(StringComparer.OrdinalIgnoreCase).Count() == result.Count, "Yemek kartı adları farklı olmalı.");
        _mealCards = result;
        Log(actor, "Yemek kartları güncellendi", $"{result.Count(c => c.Aktif)} aktif kart");
        return _mealCards;
    });

    /// <summary>The printer station for a product: the printer that owns its category, otherwise the first printer.</summary>
    private YaziciDTO? PrinterFor(long? productId)
    {
        var categoryId = _menu.FirstOrDefault(c => c.Urunler.Any(p => p.KayitNo == productId))?.KayitNo;
        return _printers.FirstOrDefault(p => categoryId.HasValue && p.Kategoriler.Contains(categoryId.Value)) ?? _printers.FirstOrDefault();
    }

    private YemekKartiDTO? MealCard(decimal amount, long? cardId)
    {
        if (amount <= 0) { Require(cardId is null, "Yemek kartı tutarı olmadan kart türü seçilemez."); return null; }
        // The card type is optional for older clients; reports then show it as "türü seçilmemiş".
        if (cardId is null) return null;
        return _mealCards.FirstOrDefault(c => c.KayitNo == cardId && c.Aktif) ?? throw new ApiException(404, "Yemek kartı bulunamadı.");
    }

    // ───── BÖLÜMLER VE MASALAR ─────
    private BolumTanimi Section(long id) => _sections.FirstOrDefault(s => s.KayitNo == id)
        ?? throw new ApiException(404, "Bölüm bulunamadı.");

    public RestorantBolumDTO SaveSection(long? id, BolumYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var name = Mandatory(request.BolumAdi, 40, "Bölüm adı");
        Require(!_sections.Any(s => s.KayitNo != id && string.Equals(s.BolumAdi, name, StringComparison.OrdinalIgnoreCase)),
            "Bu bölüm adı zaten kullanılıyor.", 409);
        var section = id.HasValue ? Section(id.Value) : new BolumTanimi { KayitNo = ++_nextSection, SiraNo = _sections.Count };
        if (!id.HasValue) { section.BolumKodu = $"B{section.KayitNo}"; _sections.Add(section); }
        section.BolumAdi = name;
        foreach (var table in _tables.Where(t => t.RestorantBolumuKayitNo == section.KayitNo)) table.RestorantBolumAdi = name;
        Log(actor, id.HasValue ? "Bölüm düzenlendi" : "Bölüm eklendi", name);
        return SectionView(section);
    });

    public RestorantBolumDTO DeleteSection(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var section = Section(id);
        Require(_tables.All(t => t.RestorantBolumuKayitNo != id), "Masası olan bölüm silinemez; önce masaları taşıyın veya silin.", 409);
        _sections.Remove(section);
        Log(actor, "Bölüm silindi", section.BolumAdi);
        return SectionView(section);
    });

    private RestorantBolumDTO SectionView(BolumTanimi section) => new()
    {
        KayitNo = section.KayitNo, BolumKodu = section.BolumKodu, BolumAdi = section.BolumAdi,
        ToplamMasa = _tables.Count(t => t.RestorantBolumuKayitNo == section.KayitNo),
        DoluMasa = _tables.Count(t => t.RestorantBolumuKayitNo == section.KayitNo && Open(t.MasaId) is not null)
    };

    public RestorantMasaDTO SaveTable(long? id, MasaYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var name = Mandatory(request.MasaAdi, 40, "Masa adı");
        var section = Section(request.BolumKayitNo);
        Require(!_tables.Any(t => t.MasaId != id && string.Equals(t.MasaAdi, name, StringComparison.OrdinalIgnoreCase)),
            "Bu masa adı zaten kullanılıyor.", 409);
        Require(id.HasValue || _tables.Count < 300, "En fazla 300 masa tanımlanabilir.");
        var table = id.HasValue ? Table(id.Value) : new RestorantMasaDTO { MasaId = ++_nextTable, MasaKodu = $"M{_nextTable:00}" };
        var previousName = table.MasaAdi;
        table.MasaAdi = name;
        table.RestorantBolumuKayitNo = section.KayitNo;
        table.RestorantBolumKodu = section.BolumKodu;
        table.RestorantBolumAdi = section.BolumAdi;
        if (!id.HasValue) _tables.Add(table);
        // Open documents carry the table name for kitchen and print views.
        if (Open(table.MasaId) is { } receipt) receipt.MasaAdi = name;
        foreach (var reservation in _reservations.Where(r => r.MasaKayitNo == table.MasaId)) reservation.MasaAdi = name;
        Log(actor, id.HasValue ? "Masa düzenlendi" : "Masa eklendi",
            id.HasValue && previousName != name ? $"{previousName} → {name}" : $"{name} ({section.BolumAdi})");
        return TableView(table);
    });

    public RestorantMasaDTO DeleteTable(long id, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var table = Table(id);
        Require(Open(id) is null, "Açık adisyonu olan masa silinemez.", 409);
        Require(!_reservations.Any(r => r.MasaKayitNo == id && r.RezervasyonTarihi > Now.AddHours(-2)),
            "Yaklaşan rezervasyonu olan masa silinemez.", 409);
        _tables.Remove(table);
        Log(actor, "Masa silindi", table.MasaAdi ?? "");
        return table;
    });

    private void SeedSetup()
    {
        _isletme = new IsletmeBilgisiDTO { MagazaKayitNo = _cfgStoreId, MagazaKodu = $"M{_cfgStoreId:000}", Unvan = "ATIA Demo Restoran",
            Adres = "Demo adresi", FisAltYazisi = "Bizi tercih ettiğiniz için teşekkür ederiz." };
        _quickNotes = ["Soğansız", "Az pişmiş", "İyi pişmiş", "Acısız", "Az tuzlu", "Sossuz", "Ayrı tabakta", "Paket yapılacak"];
        _sections = [new() { KayitNo = 1, BolumKodu = "SALON", BolumAdi = "Salon", SiraNo = 0 },
            new() { KayitNo = 2, BolumKodu = "BAHCE", BolumAdi = "Bahçe", SiraNo = 1 }];
        _nextSection = 2;
        _nextTable = 12;
        _printers = [new() { KayitNo = 1, Ad = "Mutfak", Kategoriler = [1, 2, 3] }, new() { KayitNo = 2, Ad = "Bar", Kategoriler = [4] }];
        _nextPrinter = 2;
        _mealCards = [new() { KayitNo = 1, Ad = "Pluxee (Sodexo)" }, new() { KayitNo = 2, Ad = "Multinet" },
            new() { KayitNo = 3, Ad = "Ticket Restaurant" }, new() { KayitNo = 4, Ad = "Setcard" }, new() { KayitNo = 5, Ad = "Metropol" }];
        _nextMealCard = 5;
    }

    private static List<string> DefaultQuickNotes(string? name) => name switch
    {
        "Mercimek Çorbası" => ["Acısız", "Az tuzlu", "Paket yapılacak"],
        "Çoban Salata" => ["Soğansız", "Az tuzlu", "Sossuz", "Ayrı tabakta", "Paket yapılacak"],
        "Humus" => ["Acısız", "Az tuzlu", "Ayrı tabakta", "Paket yapılacak"],
        "Izgara Köfte" => ["Az pişmiş", "İyi pişmiş", "Az tuzlu", "Sossuz", "Paket yapılacak"],
        "Tavuk Şiş" => ["İyi pişmiş", "Az tuzlu", "Sossuz", "Paket yapılacak"],
        "Sebzeli Makarna" => ["Acısız", "Az tuzlu", "Sossuz", "Paket yapılacak"],
        "Künefe" or "Sütlaç" => ["Ayrı tabakta", "Paket yapılacak"],
        "Türk Kahvesi" => ["Paket yapılacak"],
        _ => []
    };
}
