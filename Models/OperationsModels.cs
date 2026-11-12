namespace AtiaRestorant.API.Models;

// ───── İŞLETME / MAĞAZA ─────
public class IsletmeBilgisiDTO
{
    public long MagazaKayitNo { get; set; }
    public string MagazaKodu { get; set; } = "";
    public string Unvan { get; set; } = "";
    public string? Adres { get; set; }
    public string? Telefon { get; set; }
    public string? VergiDairesi { get; set; }
    public string? VergiNo { get; set; }
    public string? FisAltYazisi { get; set; }
}

public class IsletmeBilgisiYazRequest
{
    public string Unvan { get; set; } = "";
    public string? Adres { get; set; }
    public string? Telefon { get; set; }
    public string? VergiDairesi { get; set; }
    public string? VergiNo { get; set; }
    public string? FisAltYazisi { get; set; }
}

public class HazirNotlarRequest
{
    public List<string> Notlar { get; set; } = [];
}

public class HazirNotTanimiDTO
{
    public string Ad { get; set; } = "";
    public string Grup { get; set; } = "Genel";
}

public class HazirNotEkleRequest
{
    public string Ad { get; set; } = "";
    public string Grup { get; set; } = "Genel";
}

public class YaziciDTO
{
    public long KayitNo { get; set; }
    public string Ad { get; set; } = "";
    public List<long> Kategoriler { get; set; } = new();
}

public class YazicilarRequest
{
    public List<YaziciDTO> Yazicilar { get; set; } = [];
}

public class YemekKartiDTO
{
    public long KayitNo { get; set; }
    public string Ad { get; set; } = "";
    public decimal KomisyonOrani { get; set; }
    public bool Aktif { get; set; } = true;
}

public class YemekKartlariRequest
{
    public List<YemekKartiDTO> Kartlar { get; set; } = [];
}

public class DemoDurumDTO
{
    public bool Kalici { get; set; }
    public DateTime? SonKayit { get; set; }
    public string? SonHata { get; set; }
}

// ───── PERSONEL ─────
public class PersonelHesabi
{
    public int KayitNo { get; set; }
    public string KullaniciAdi { get; set; } = "";
    public string AdSoyad { get; set; } = "";
    public string Rol { get; set; } = "";
    public bool Aktif { get; set; } = true;
    public string SifreTuzu { get; set; } = "";
    public string SifreOzeti { get; set; } = "";
    public int GuvenlikSurumu { get; set; } = 1;
    public DateTime OlusturmaTarihi { get; set; }
    public DateTime? SonGiris { get; set; }
}

public class PersonelHesabiDTO
{
    public int KayitNo { get; set; }
    public string KullaniciAdi { get; set; } = "";
    public string AdSoyad { get; set; } = "";
    public string Rol { get; set; } = "";
    public bool Aktif { get; set; }
    public DateTime OlusturmaTarihi { get; set; }
    public DateTime? SonGiris { get; set; }
}

public class PersonelYazRequest
{
    public string KullaniciAdi { get; set; } = "";
    public string AdSoyad { get; set; } = "";
    public string Rol { get; set; } = "";
    public bool Aktif { get; set; } = true;
    /// <summary>Required for a new account; when set on an update it resets the password.</summary>
    public string? Sifre { get; set; }
}

public sealed record DogrulanmisPersonel(int Id, string KullaniciAdi, string AdSoyad, string Rol, int GuvenlikSurumu);

// ───── MASA / BÖLÜM TANIMI ─────
public class BolumTanimi
{
    public long KayitNo { get; set; }
    public string BolumKodu { get; set; } = "";
    public string BolumAdi { get; set; } = "";
    public int SiraNo { get; set; }
}

public class BolumYazRequest
{
    public string BolumAdi { get; set; } = "";
}

public class MasaYazRequest
{
    public string MasaAdi { get; set; } = "";
    public long BolumKayitNo { get; set; }
}

public class KisiSayisiRequest
{
    public int KisiSayisi { get; set; }
}

// ───── SEÇENEKLER (EKSTRA, PİŞİRME, MENÜ İÇERİĞİ) ─────
public class SecenekGrubuDTO
{
    public int KayitNo { get; set; }
    public string Ad { get; set; } = "";
    public bool Zorunlu { get; set; }
    public bool CokluSecim { get; set; }
    public List<SecenekDTO> Secenekler { get; set; } = new();
}

public class SecenekDTO
{
    public int KayitNo { get; set; }
    public string Ad { get; set; } = "";
    public decimal EkFiyat { get; set; }
}

public class SatirSecimDTO
{
    public int SecenekKayitNo { get; set; }
    public string GrupAdi { get; set; } = "";
    public string SecenekAdi { get; set; } = "";
    public decimal EkFiyat { get; set; }
}

// ───── KDV ─────
public class KdvSatiriDTO
{
    public int Oran { get; set; }
    public decimal Matrah { get; set; }
    public decimal Kdv { get; set; }
    public decimal Toplam { get; set; }
}

// ───── ADİSYON GEÇMİŞİ, DÜZELTME VE İADE ─────
public class IadeKaydiDTO
{
    public long KayitNo { get; set; }
    public DateTime Tarih { get; set; }
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public decimal Toplam => Nakit + Banka + YemekKarti + Cari;
    public string Gerekce { get; set; } = "";
    public int PersonelId { get; set; }
    public string PersonelAdi { get; set; } = "";
}

public class AdisyonOzetDTO
{
    public long KayitNo { get; set; }
    public long? MasaKayitNo { get; set; }
    public string? MasaAdi { get; set; }
    public string? PersonelAdi { get; set; }
    public DateTime? AcilisTarihi { get; set; }
    public DateTime? KapanisTarihi { get; set; }
    public bool Kapali { get; set; }
    public bool Birlesti { get; set; }
    public decimal GenelToplam { get; set; }
    public decimal Indirim { get; set; }
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public decimal Iade { get; set; }
    public int UrunSayisi { get; set; }
}

public class AdisyonGecmisDTO
{
    public AdisyonBaslikDTO Adisyon { get; set; } = new();
    public DateTime? KapanisTarihi { get; set; }
    public bool Birlesti { get; set; }
    public bool Duzeltilebilir { get; set; }
    public bool IadeEdilebilir { get; set; }
    public List<IslemKaydiDTO> Islemler { get; set; } = new();
}

public class AdisyonKonumDTO
{
    public long KayitNo { get; set; }
    public long? MasaKayitNo { get; set; }
    public string? MasaAdi { get; set; }
    public bool Kapali { get; set; }
}

public class OdemeDuzeltRequest
{
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public long? YemekKartiKayitNo { get; set; }
    public long? CariHesapKayitNo { get; set; }
    public string Gerekce { get; set; } = "";
}

public class IadeRequest
{
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public string Gerekce { get; set; } = "";
}

// ───── PAKET: MÜŞTERİ, KURYE, TAHSİLAT ─────
public class MusteriDTO
{
    public long KayitNo { get; set; }
    public string AdSoyad { get; set; } = "";
    public string Telefon { get; set; } = "";
    public List<string> Adresler { get; set; } = new();
    public string? Not { get; set; }
    public int SiparisSayisi { get; set; }
    public decimal ToplamTutar { get; set; }
    public DateTime? SonSiparisTarihi { get; set; }
}

public class MusteriYazRequest
{
    public string AdSoyad { get; set; } = "";
    public List<string> Adresler { get; set; } = [];
    public string? Not { get; set; }
}

public class MusteriDetayDTO
{
    public MusteriDTO Musteri { get; set; } = new();
    public List<PaketSiparisDTO> SonSiparisler { get; set; } = new();
}

public class KuryeDTO
{
    public long KayitNo { get; set; }
    public string AdSoyad { get; set; } = "";
    public string? Telefon { get; set; }
    public bool Aktif { get; set; } = true;
}

public class KuryelerRequest
{
    public List<KuryeDTO> Kuryeler { get; set; } = [];
}

public class PaketTahsilatDTO
{
    public decimal Nakit { get; set; }
    public decimal Kart { get; set; }
    public decimal Online { get; set; }
    public decimal Bekleyen { get; set; }
    public int BekleyenSayisi { get; set; }
}

public class KuryeOzetDTO
{
    public long? KuryeKayitNo { get; set; }
    public string Kurye { get; set; } = "";
    public int TeslimSayisi { get; set; }
    public decimal TeslimTutari { get; set; }
    public decimal TahsilEdilen { get; set; }
    public decimal Bekleyen { get; set; }
}

// ───── RAPORLAR ─────
public class YemekKartiOzetDTO
{
    public long? KayitNo { get; set; }
    public string Ad { get; set; } = "";
    public decimal Tutar { get; set; }
    public decimal TahminiKomisyon { get; set; }
}

public class DonemGunuDTO
{
    public DateOnly Tarih { get; set; }
    public int AdisyonSayisi { get; set; }
    public decimal MasaSatis { get; set; }
    public decimal PaketSatis { get; set; }
    public decimal Iade { get; set; }
    public decimal ToplamSatis { get; set; }
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public decimal Indirim { get; set; }
    public decimal Iptal { get; set; }
    public decimal Zayi { get; set; }
    public decimal Ikram { get; set; }
    public bool VardiyaKapali { get; set; }
}

public class DonemRaporDTO
{
    public DateOnly Baslangic { get; set; }
    public DateOnly Bitis { get; set; }
    public List<DonemGunuDTO> Gunler { get; set; } = new();
    public DonemGunuDTO Toplam { get; set; } = new();
    public List<KdvSatiriDTO> KdvDokumu { get; set; } = new();
    public List<UrunSatisDTO> EnCokSatan { get; set; } = new();
    public List<YemekKartiOzetDTO> YemekKartiDagilimi { get; set; } = new();
}

public class PersonelRaporSatiriDTO
{
    public int PersonelId { get; set; }
    public string PersonelAdi { get; set; } = "";
    public string? Rol { get; set; }
    public int AcilanAdisyon { get; set; }
    public decimal UrunAdedi { get; set; }
    public decimal SatisTutari { get; set; }
    public int IptalSayisi { get; set; }
    public decimal IptalTutari { get; set; }
    public decimal ZayiTutari { get; set; }
    public decimal IkramTutari { get; set; }
    public decimal TahsilatTutari { get; set; }
    public decimal IadeTutari { get; set; }
}

public class PersonelRaporDTO
{
    public DateOnly Baslangic { get; set; }
    public DateOnly Bitis { get; set; }
    public List<PersonelRaporSatiriDTO> Satirlar { get; set; } = new();
}

// ───── STOK, REÇETE, MALİYET ─────
public class HammaddeDTO
{
    public long KayitNo { get; set; }
    public string Ad { get; set; } = "";
    public string Birim { get; set; } = "kg";
    public decimal Stok { get; set; }
    public decimal KritikSeviye { get; set; }
    public decimal BirimMaliyet { get; set; }
    public bool Aktif { get; set; } = true;
    public bool Kritik => Aktif && Stok <= KritikSeviye;
}

public class HammaddeYazRequest
{
    public string Ad { get; set; } = "";
    public string Birim { get; set; } = "kg";
    public decimal KritikSeviye { get; set; }
    public decimal BirimMaliyet { get; set; }
    public bool Aktif { get; set; } = true;
}

public class ReceteSatiriDTO
{
    public long HammaddeKayitNo { get; set; }
    public decimal Miktar { get; set; }
}

public class ReceteYazRequest
{
    public List<ReceteSatiriDTO> Satirlar { get; set; } = [];
}

public enum StokHareketTipi { Giris, Cikis, Sayim, Satis, SatisIadesi }

public class StokHareketiDTO
{
    public long KayitNo { get; set; }
    public DateTime Tarih { get; set; }
    public long HammaddeKayitNo { get; set; }
    public string HammaddeAdi { get; set; } = "";
    public StokHareketTipi Tip { get; set; }
    public decimal Miktar { get; set; }
    public decimal StokSonrasi { get; set; }
    public decimal? BirimMaliyet { get; set; }
    public string? Aciklama { get; set; }
    public string PersonelAdi { get; set; } = "";
}

public class StokHareketRequest
{
    public long HammaddeKayitNo { get; set; }
    public StokHareketTipi Tip { get; set; }
    public decimal Miktar { get; set; }
    public decimal? BirimMaliyet { get; set; }
    public string? Aciklama { get; set; }
}

public class UrunMaliyetDTO
{
    public long UrunKayitNo { get; set; }
    public string UrunAdi { get; set; } = "";
    public string? PorsiyonAdi { get; set; }
    public decimal SatisFiyati { get; set; }
    public decimal ReceteMaliyeti { get; set; }
    public decimal KdvHaricFiyat { get; set; }
    public decimal BrutKar { get; set; }
    public decimal? MaliyetOrani { get; set; }
    public bool ReceteVar { get; set; }
}
