using AtiaRestorant.API.Models;

namespace AtiaRestorant.API.Data;

/// <summary>
/// Ingredients, recipes, stock movements and recipe cost. Sales deduct recipe quantities when an order
/// line is added; cancellation returns them, waste does not. Stock may go negative: a sale is never blocked.
/// </summary>
public sealed partial class RestaurantRepository
{
    private const int MaxStockMovements = 5000;
    private static readonly string[] StockUnits = ["kg", "g", "lt", "ml", "adet", "porsiyon"];
    private List<HammaddeDTO> _ingredients = [];
    private List<StokHareketiDTO> _stockMovements = [];
    private long _nextIngredient, _nextStockMovement;

    private static void StockQuantity(decimal value, string label) => Require(value >= 0 && value <= 1000000m &&
        decimal.Round(value, 3) == value, $"{label} 0–1.000.000 aralığında ve en fazla üç ondalıklı olmalı.");
    private HammaddeDTO Ingredient(long id) => _ingredients.FirstOrDefault(i => i.KayitNo == id)
        ?? throw new ApiException(404, "Hammadde bulunamadı.");

    private void Movement(HammaddeDTO ingredient, StokHareketTipi type, decimal signedQuantity, string actor, string? note, decimal? cost = null)
    {
        _stockMovements.Add(new StokHareketiDTO { KayitNo = ++_nextStockMovement, Tarih = Now, HammaddeKayitNo = ingredient.KayitNo,
            HammaddeAdi = ingredient.Ad, Tip = type, Miktar = signedQuantity, StokSonrasi = ingredient.Stok, BirimMaliyet = cost,
            Aciklama = note, PersonelAdi = actor });
        if (_stockMovements.Count > MaxStockMovements) _stockMovements.RemoveRange(0, _stockMovements.Count - MaxStockMovements);
    }

    /// <summary>Applies a product's recipe for a sold (positive) or returned (negative) quantity.</summary>
    private void ConsumeRecipe(long? productId, int? portionId, decimal quantity, string actor, string reference)
    {
        if (quantity == 0) return;
        var product = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == productId);
        if (product is null || product.Recete.Count == 0) return;
        var factor = product.Porsiyonlar.FirstOrDefault(p => p.KayitNo == portionId)?.Carpan ?? 1;
        foreach (var row in product.Recete)
        {
            var ingredient = _ingredients.FirstOrDefault(i => i.KayitNo == row.HammaddeKayitNo);
            if (ingredient is null) continue;
            var used = decimal.Round(row.Miktar * factor * quantity, 3, MidpointRounding.AwayFromZero);
            ingredient.Stok -= used;
            Movement(ingredient, quantity > 0 ? StokHareketTipi.Satis : StokHareketTipi.SatisIadesi, -used, actor,
                $"{reference}: {Math.Abs(quantity):0.###} × {product.StokAdi}");
        }
    }

    public List<HammaddeDTO> Ingredients(StaffActor actor) => Read(() => { Staff(actor, "Admin"); return _ingredients.OrderBy(i => i.Ad).ToList(); });

    public HammaddeDTO SaveIngredient(long? id, HammaddeYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var name = Mandatory(request.Ad, 80, "Hammadde adı");
        Require(StockUnits.Contains(request.Birim), "Birim geçersiz.");
        StockQuantity(request.KritikSeviye, "Kritik seviye");
        Require(request.BirimMaliyet >= 0 && request.BirimMaliyet <= 1000000m && decimal.Round(request.BirimMaliyet, 4) == request.BirimMaliyet,
            "Birim maliyet 0–1.000.000 aralığında ve en fazla dört ondalıklı olmalı.");
        Require(!_ingredients.Any(i => i.KayitNo != id && string.Equals(i.Ad, name, StringComparison.OrdinalIgnoreCase)), "Bu hammadde zaten tanımlı.", 409);
        var ingredient = id.HasValue ? Ingredient(id.Value) : new HammaddeDTO { KayitNo = ++_nextIngredient };
        Require(!id.HasValue || ingredient.Birim == request.Birim || ingredient.Stok == 0, "Stoğu olan hammaddenin birimi değiştirilemez.", 409);
        ingredient.Ad = name; ingredient.Birim = request.Birim; ingredient.KritikSeviye = request.KritikSeviye;
        ingredient.BirimMaliyet = request.BirimMaliyet; ingredient.Aktif = request.Aktif;
        if (!id.HasValue) _ingredients.Add(ingredient);
        Log(actor, id.HasValue ? "Hammadde düzenlendi" : "Hammadde eklendi", name);
        return ingredient;
    });

    public MenuUrunDTO SaveRecipe(long productId, ReceteYazRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        var product = _menu.SelectMany(c => c.Urunler).FirstOrDefault(p => p.KayitNo == productId) ?? throw new ApiException(404, "Ürün bulunamadı.");
        var rows = request.Satirlar ?? throw new ApiException(400, "Reçete geçersiz.");
        Require(rows.Count <= 30 && rows.All(r => r is not null), "Reçetede en fazla 30 satır olabilir.");
        Require(rows.Select(r => r.HammaddeKayitNo).Distinct().Count() == rows.Count, "Aynı hammadde reçetede bir kez yer alabilir.");
        foreach (var row in rows)
        {
            Ingredient(row.HammaddeKayitNo);
            Require(row.Miktar > 0 && row.Miktar <= 1000 && decimal.Round(row.Miktar, 3) == row.Miktar, "Reçete miktarı 0–1000 aralığında ve en fazla üç ondalıklı olmalı.");
        }
        product.Recete = rows.Select(r => new ReceteSatiriDTO { HammaddeKayitNo = r.HammaddeKayitNo, Miktar = r.Miktar }).ToList();
        Log(actor, "Reçete düzenlendi", $"{product.StokAdi}: {rows.Count} hammadde");
        return product;
    });

    public StokHareketiDTO AddStockMovement(StokHareketRequest request, StaffActor actor) => Change(() =>
    {
        Staff(actor, "Admin");
        Require(request.Tip is StokHareketTipi.Giris or StokHareketTipi.Cikis or StokHareketTipi.Sayim, "Hareket türü geçersiz.");
        var ingredient = Ingredient(request.HammaddeKayitNo);
        StockQuantity(request.Miktar, "Miktar");
        Require(request.Tip == StokHareketTipi.Sayim || request.Miktar > 0, "Miktar sıfırdan büyük olmalı.");
        var note = Optional(request.Aciklama, 200, "Açıklama");
        Require(request.Tip == StokHareketTipi.Cikis ? note is not null : true, "Stok çıkışı için açıklama yazın (ör. bozulma, personel yemeği).");
        decimal? cost = null;
        if (request.Tip == StokHareketTipi.Giris && request.BirimMaliyet.HasValue)
        {
            Require(request.BirimMaliyet >= 0 && request.BirimMaliyet <= 1000000m && decimal.Round(request.BirimMaliyet.Value, 4) == request.BirimMaliyet,
                "Birim maliyet geçersiz.");
            cost = request.BirimMaliyet;
            // Weighted average cost; negative stock does not weigh the average.
            var existing = Math.Max(ingredient.Stok, 0);
            ingredient.BirimMaliyet = decimal.Round((existing * ingredient.BirimMaliyet + request.Miktar * cost.Value) / (existing + request.Miktar), 4);
        }
        var delta = request.Tip switch
        {
            StokHareketTipi.Giris => request.Miktar,
            StokHareketTipi.Cikis => -request.Miktar,
            _ => request.Miktar - ingredient.Stok
        };
        ingredient.Stok += delta;
        Movement(ingredient, request.Tip, delta, actor.Name, note ?? (request.Tip == StokHareketTipi.Sayim ? "Sayım düzeltmesi" : null), cost);
        Log(actor, "Stok hareketi", $"{ingredient.Ad}: {request.Tip} {delta:+0.###;-0.###;0} {ingredient.Birim}");
        return _stockMovements[^1];
    });

    public List<StokHareketiDTO> StockMovements(long? ingredientId, StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        return _stockMovements.Where(m => ingredientId is null || m.HammaddeKayitNo == ingredientId)
            .OrderByDescending(m => m.KayitNo).Take(300).ToList();
    });

    public List<UrunMaliyetDTO> RecipeCosts(StaffActor actor) => Read(() =>
    {
        Staff(actor, "Admin");
        var result = new List<UrunMaliyetDTO>();
        foreach (var product in _menu.SelectMany(c => c.Urunler))
        {
            var baseCost = product.Recete.Sum(r => r.Miktar * (_ingredients.FirstOrDefault(i => i.KayitNo == r.HammaddeKayitNo)?.BirimMaliyet ?? 0));
            var variants = product.Porsiyonlar.Count == 0
                ? [(Name: (string?)null, Price: product.SatisFiyati, Factor: 1m)]
                : product.Porsiyonlar.Select(p => (Name: p.PorsiyonAdi, Price: p.Fiyat, Factor: p.Carpan)).ToList();
            foreach (var (name, price, factor) in variants)
            {
                var cost = Money(baseCost * factor);
                var net = Money(price / (1 + product.KdvOrani / 100m));
                result.Add(new UrunMaliyetDTO { UrunKayitNo = product.KayitNo, UrunAdi = product.StokAdi ?? "", PorsiyonAdi = name,
                    SatisFiyati = price, ReceteMaliyeti = cost, KdvHaricFiyat = net, BrutKar = net - cost,
                    MaliyetOrani = net > 0 && product.Recete.Count > 0 ? decimal.Round(cost / net * 100, 1) : null, ReceteVar = product.Recete.Count > 0 });
            }
        }
        return result;
    });

    private void SeedStock()
    {
        (string Name, string Unit, decimal Stock, decimal Critical, decimal Cost)[] items =
        [
            ("Kırmızı mercimek", "kg", 12, 3, 62), ("Domates", "kg", 18, 5, 35), ("Salatalık", "kg", 9, 3, 30),
            ("Nohut", "kg", 10, 2, 70), ("Dana kıyma", "kg", 14, 4, 720), ("Tavuk göğüs", "kg", 11, 3, 260),
            ("Makarna", "kg", 15, 4, 48), ("Kadayıf", "kg", 6, 2, 140), ("Künefe peyniri", "kg", 5, 2, 420),
            ("Süt", "lt", 20, 6, 38), ("Pirinç", "kg", 10, 3, 75), ("Ayran", "adet", 80, 20, 14),
            ("Türk kahvesi", "kg", 3, 1, 900), ("Su", "adet", 120, 30, 5)
        ];
        _ingredients = items.Select((item, index) => new HammaddeDTO { KayitNo = index + 1, Ad = item.Name, Birim = item.Unit,
            Stok = item.Stock, KritikSeviye = item.Critical, BirimMaliyet = item.Cost }).ToList();
        _nextIngredient = _ingredients.Count;
        Dictionary<long, (long Ingredient, decimal Quantity)[]> recipes = new()
        {
            [1] = [(1, 0.08m)], [2] = [(2, 0.15m), (3, 0.1m)], [3] = [(4, 0.12m)], [4] = [(5, 0.18m), (2, 0.05m)],
            [5] = [(6, 0.2m), (11, 0.08m)], [6] = [(7, 0.15m), (2, 0.08m)], [7] = [(8, 0.08m), (9, 0.06m)],
            [8] = [(10, 0.2m), (11, 0.03m)], [9] = [(12, 1m)], [10] = [(13, 0.007m)], [11] = [(14, 1m)]
        };
        foreach (var product in _menu.SelectMany(c => c.Urunler))
            if (recipes.TryGetValue(product.KayitNo, out var rows))
                product.Recete = rows.Select(r => new ReceteSatiriDTO { HammaddeKayitNo = r.Ingredient, Miktar = r.Quantity }).ToList();
    }
}
