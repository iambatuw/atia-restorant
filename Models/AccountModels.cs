namespace AtiaRestorant.API.Models;

// ───── CARİ HESAP ─────
public class CariHesapDTO
{
    public long KayitNo { get; set; }
    public string Unvan { get; set; } = "";
    public string? Telefon { get; set; }
    public string? VergiDairesi { get; set; }
    public string? VergiNo { get; set; }
    public string? Adres { get; set; }
    /// <summary>0 means no limit.</summary>
    public decimal KrediLimiti { get; set; }
    public bool Aktif { get; set; } = true;
    /// <summary>Positive: the customer owes the restaurant.</summary>
    public decimal Bakiye { get; set; }
}

public class CariHesapYazRequest
{
    public string Unvan { get; set; } = "";
    public string? Telefon { get; set; }
    public string? VergiDairesi { get; set; }
    public string? VergiNo { get; set; }
    public string? Adres { get; set; }
    public decimal KrediLimiti { get; set; }
    public bool Aktif { get; set; } = true;
}

public class CariHareketDTO
{
    public long KayitNo { get; set; }
    public long CariKayitNo { get; set; }
    public DateTime Tarih { get; set; }
    public string Tip { get; set; } = "";
    public decimal Borc { get; set; }
    public decimal Alacak { get; set; }
    public decimal BakiyeSonrasi { get; set; }
    public long? AdisyonNo { get; set; }
    public string? Aciklama { get; set; }
    public string PersonelAdi { get; set; } = "";
}

public class CariEkstreDTO
{
    public CariHesapDTO Hesap { get; set; } = new();
    public List<CariHareketDTO> Hareketler { get; set; } = new();
}

public class CariTahsilatRequest
{
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public string? Aciklama { get; set; }
}

// ───── KASA HAREKETİ ─────
public class KasaHareketiDTO
{
    public long KayitNo { get; set; }
    public DateTime Tarih { get; set; }
    public bool Giris { get; set; }
    public string Kategori { get; set; } = "";
    public decimal Tutar { get; set; }
    public string Aciklama { get; set; } = "";
    public string PersonelAdi { get; set; } = "";
}

public class KasaHareketiRequest
{
    public bool Giris { get; set; }
    public string Kategori { get; set; } = "";
    public decimal Tutar { get; set; }
    public string Aciklama { get; set; } = "";
}

// ───── ADİSYON FATURA BİLGİSİ ─────
public class AdisyonFaturaBilgisiDTO
{
    public string Unvan { get; set; } = "";
    public string? VergiDairesi { get; set; }
    public string? VergiNo { get; set; }
    public string? Adres { get; set; }
}

// ───── HIZLI SATIŞ ─────
public class HizliSatisSatirIstek
{
    public long StokKayitNo { get; set; }
    public int? PorsiyonKayitNo { get; set; }
    public decimal Miktar { get; set; }
    public List<int> SecenekKayitNolar { get; set; } = [];
    public string? SatirAciklama { get; set; }
}

public class HizliSatisRequest
{
    public string IdempotencyKey { get; set; } = "";
    public string? MusteriAdi { get; set; }
    public List<HizliSatisSatirIstek> Satirlar { get; set; } = [];
    public decimal NakitTutar { get; set; }
    public decimal BankaTutar { get; set; }
    public decimal YemekKartiTutar { get; set; }
    public decimal CariTutar { get; set; }
    public decimal IndirimTutar { get; set; }
    public long? YemekKartiKayitNo { get; set; }
    public long? CariHesapKayitNo { get; set; }
}

// ───── QR MENÜ VE GARSON ÇAĞIRMA ─────
public class MasaQrDTO
{
    public long MasaKayitNo { get; set; }
    public string MasaAdi { get; set; } = "";
    public string BolumAdi { get; set; } = "";
    public string Kod { get; set; } = "";
}

public class QrMasaBilgisiDTO
{
    public string MasaAdi { get; set; } = "";
    public string IsletmeAdi { get; set; } = "";
}

public enum CagriTipi { Garson, Hesap }

public class CagriRequest
{
    public string Kod { get; set; } = "";
    public CagriTipi Tip { get; set; }
}

public class MasaCagrisiDTO
{
    public long KayitNo { get; set; }
    public long MasaKayitNo { get; set; }
    public string MasaAdi { get; set; } = "";
    public CagriTipi Tip { get; set; }
    public DateTime Tarih { get; set; }
    public bool Tamamlandi { get; set; }
    public DateTime? TamamlanmaTarihi { get; set; }
    public string? TamamlayanPersonel { get; set; }
}

public class CagriSonucDTO
{
    public string MasaAdi { get; set; } = "";
    public CagriTipi Tip { get; set; }
    public DateTime Tarih { get; set; }
}
