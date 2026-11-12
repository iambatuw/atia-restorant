namespace AtiaRestorant.API.Models;

// ───── MASA ─────
public class RestorantMasaDTO
{
    public long MasaId { get; set; }
    public string? MasaKodu { get; set; }
    public string? MasaAdi { get; set; }
    public long? RestorantBolumuKayitNo { get; set; }
    public string? RestorantBolumAdi { get; set; }
    public string? RestorantBolumKodu { get; set; }
    public int LocationX { get; set; }
    public int LocationY { get; set; }
    public int Durumu { get; set; }   // 0=Boş, 1=Dolu, 2=Rezerve
    public bool Rezerve { get; set; }
    public bool BirlesmisMasa { get; set; }
    public bool AnaMasa { get; set; }
    public long? AnaMasaKayitNo { get; set; }
    public string? AnaMasaAdi { get; set; }
    public long? BaslikKayitNo { get; set; }
    public decimal? Tutar { get; set; }
    public int KisiSayisi { get; set; }
    public DateTime? AcilisTarihi { get; set; }
    public bool AdisyonYazdirildi { get; set; }
    public bool MasaIslem { get; set; }
    public bool SiparisMasa { get; set; }
    public string? SiparisAdi { get; set; }
    public List<AdisyonDetayDTO> Detaylar { get; set; } = new();
}

// ───── BÖLÜM ─────
public class RestorantBolumDTO
{
    public long KayitNo { get; set; }
    public string? BolumKodu { get; set; }
    public string? BolumAdi { get; set; }
    public int ToplamMasa { get; set; }
    public int DoluMasa { get; set; }
    public int BosMasa => ToplamMasa - DoluMasa;
}

// ───── ADİSYON / SİPARİŞ ─────
public class AdisyonDetayDTO
{
    public long KayitNo { get; set; }
    public long? StokKayitNo { get; set; }
    public string? StokKodu { get; set; }
    public string? StokAdi { get; set; }
    public decimal Miktar { get; set; }
    public decimal BirimFiyat { get; set; }
    public decimal SatirTutari { get; set; }
    public decimal? YazdirilanMiktar { get; set; }
    public int? PorsiyonKayitNo { get; set; }
    public string? PorsiyonAdi { get; set; }
    public bool Ikram { get; set; }
    public string? SatirAciklama { get; set; }
    public int? PersonelKayitNo { get; set; }
    public string? PersonelAdi { get; set; }
    public bool Yazdirildi => (YazdirilanMiktar ?? 0) >= Miktar;
    public bool StokEkstra { get; set; }
    public string? StokEkstraAdi { get; set; }
    public int KdvOrani { get; set; } = 10;
    public List<SatirSecimDTO> Secimler { get; set; } = new();
    public string? SecimMetni => Secimler.Count == 0 ? null : string.Join(", ", Secimler.Select(s => s.SecenekAdi));
    public decimal OdenenMiktar { get; set; }
    public decimal OdenenTutar { get; set; }
}

public class AdisyonBaslikDTO
{
    public long KayitNo { get; set; }
    public long? MasaKayitNo { get; set; }
    public string? MasaAdi { get; set; }
    public int? PersonelKayitNo { get; set; }
    public string? PersonelAdi { get; set; }
    public decimal GenelToplam { get; set; }
    public decimal? NakitToplam { get; set; }
    public decimal? BankaToplam { get; set; }
    public decimal? CariToplam { get; set; }
    public decimal? YemekKartiToplam { get; set; }
    public decimal? IndirimToplam { get; set; }
    public DateTime? Tarih { get; set; }
    public DateTime? KayitTarihi { get; set; }
    public int KisiSayisi { get; set; }
    public bool Kapali { get; set; }
    public List<AdisyonDetayDTO> Detaylar { get; set; } = new();
    public List<KdvSatiriDTO> KdvDokumu { get; set; } = new();
    public List<IadeKaydiDTO> Iadeler { get; set; } = new();
    public decimal IadeToplam => Iadeler.Sum(i => i.Toplam);
    public int YazdirmaSayisi { get; set; }
    public long? YemekKartiKayitNo { get; set; }
    public string? YemekKartiAdi { get; set; }
    public long? CariHesapKayitNo { get; set; }
    public string? CariHesapAdi { get; set; }
    public AdisyonFaturaBilgisiDTO? FaturaBilgisi { get; set; }
    public bool HizliSatis { get; set; }
}

// ───── SİPARİŞ EKLEME ─────
public class SiparisEkleRequest
{
    public long MasaKayitNo { get; set; }
    public long StokKayitNo { get; set; }
    public decimal Miktar { get; set; }
    public decimal BirimFiyat { get; set; }
    public int? PorsiyonKayitNo { get; set; }
    public bool Ikram { get; set; }
    public string? SatirAciklama { get; set; }
    public int? PersonelKayitNo { get; set; }
    public bool StokEkstra { get; set; }
    public string? StokEkstraAdi { get; set; }
    public List<int> SecenekKayitNolar { get; set; } = [];
}

public class TopluSiparisEkleRequest
{
    public long MasaKayitNo { get; set; }
    public List<SiparisEkleRequest> Satirlar { get; set; } = [];
}

public class RestoranAyarlariDTO
{
    public bool ZayiAktif { get; set; }
    public IsletmeBilgisiDTO Isletme { get; set; } = new();
    public List<string> HazirNotlar { get; set; } = new();
    public List<HazirNotTanimiDTO> HazirNotTanimlari { get; set; } = new();
    public List<YaziciDTO> Yazicilar { get; set; } = new();
    public List<YemekKartiDTO> YemekKartlari { get; set; } = new();
}

public class ZayiAyariRequest
{
    public bool ZayiAktif { get; set; }
}

public class SiparisGuncelleRequest
{
    public long DetayKayitNo { get; set; }
    public decimal Miktar { get; set; }
    public string? SatirAciklama { get; set; }
    public bool Ikram { get; set; }
}

public enum SiparisCikarmaTipi { Iptal, Zayi }
public class SiparisCikarmaRequest
{
    public SiparisCikarmaTipi Tip { get; set; }
    public string Gerekce { get; set; } = "";
}

public class MutfakBildirimDTO
{
    public long KayitNo { get; set; }
    public long AdisyonNo { get; set; }
    public string MasaAdi { get; set; } = "";
    public string UrunAdi { get; set; } = "";
    public string Islem { get; set; } = "";
    public decimal Miktar { get; set; }
    public string? Not { get; set; }
    public DateTime Tarih { get; set; }
    public bool Goruldu { get; set; }
    public int YazdirmaDenemesi { get; set; }
    public MutfakYazdirmaDurumu YazdirmaDurumu { get; set; }
    public long? YaziciKayitNo { get; set; }
    public string? YaziciAdi { get; set; }
}
public enum MutfakYazdirmaDurumu { Bekliyor, KontrolBekliyor, Tamamlandi, Hatali }
public class MutfakYazdirmaSonucRequest
{
    public bool Basarili { get; set; }
}

// ───── ÖDEME ─────
public class OdemeRequest
{
    public long BaslikKayitNo { get; set; }
    public decimal NakitTutar { get; set; }
    public decimal BankaTutar { get; set; }
    public decimal CariTutar { get; set; }
    public decimal YemekKartiTutar { get; set; }
    public decimal IndirimTutar { get; set; }
    public int? OdemePersonelKayitNo { get; set; }
    public bool KismiOdeme { get; set; }
    public string? PosIslemId { get; set; }
    /// <summary>Optional item-based payment: the server calculates the amount from these lines.</summary>
    public List<AyrilanSatir>? OdenenSatirlar { get; set; }
    public long? YemekKartiKayitNo { get; set; }
    public long? CariHesapKayitNo { get; set; }
}

// ───── POS CİHAZ ENTEGRASYONU & DURUM MAKİNESİ ─────
public enum PosCihazTipi
{
    HariciManuelPos = 0,
    HuginS1 = 1,
    PayGo = 2
}

public enum PosDurum
{
    Baslatildi = 0,
    CihazaGonderildi = 1,
    Onaylandi = 2,
    Reddedildi = 3,
    Belirsiz = 4,
    ErpKaydedildi = 5,
    Mutabik = 6
}

public class PosIslemIstek
{
    public long BaslikKayitNo { get; set; }
    public long MasaKayitNo { get; set; }
    public decimal Tutar { get; set; }
    public PosCihazTipi CihazTipi { get; set; }
    public string? TerminalIp { get; set; }
    public int? TerminalPort { get; set; }
    public string IdempotencyKey { get; set; } = Guid.NewGuid().ToString("N");
}

public class PosIslemKayitDTO
{
    public string IslemId { get; set; } = "";
    public string IdempotencyKey { get; set; } = "";
    public long BaslikKayitNo { get; set; }
    public long MasaKayitNo { get; set; }
    public decimal Tutar { get; set; }
    public PosCihazTipi CihazTipi { get; set; }
    public PosDurum Durum { get; set; }
    public string? AuthCode { get; set; }
    public string? Rrn { get; set; }
    public string? MaskedPan { get; set; }
    public string? HataMesaji { get; set; }
    public DateTime BaslangicZamani { get; set; }
    public DateTime? BitisZamani { get; set; }
    public bool Basarili => Durum is PosDurum.Onaylandi or PosDurum.ErpKaydedildi or PosDurum.Mutabik;
}

// ───── MASA İŞLEMLERİ ─────
public class MasaTasiRequest
{
    public long KaynakMasaKayitNo { get; set; }
    public long HedefMasaKayitNo { get; set; }
}

public class MasaBirlestirRequest
{
    public long AnaMasaKayitNo { get; set; }
    public List<long> BirlestirilecekMasaKayitNolar { get; set; } = new();
}

public class MasaAyirRequest
{
    public long MasaKayitNo { get; set; }
    public long HedefMasaKayitNo { get; set; }
    public List<AyrilanSatir> AyrilanSatirlar { get; set; } = new();
}

public class AyrilanSatir
{
    public long DetayKayitNo { get; set; }
    public decimal Miktar { get; set; }
}

public class MasaAyirSonucDTO
{
    public AdisyonBaslikDTO KaynakAdisyon { get; set; } = new();
    public AdisyonBaslikDTO HedefAdisyon { get; set; } = new();
}

// ───── MENÜ / STOK ─────
public class MenuKategoriDTO
{
    public long KayitNo { get; set; }
    public string? GrupKodu { get; set; }
    public string? GrupAdi { get; set; }
    public int SiraNo { get; set; }
    public List<MenuUrunDTO> Urunler { get; set; } = new();
}

public class MenuUrunDTO
{
    public long KayitNo { get; set; }
    public string? StokKodu { get; set; }
    public string? StokAdi { get; set; }
    public decimal SatisFiyati { get; set; }
    public string? Birimi { get; set; }
    public long? GrupKayitNo { get; set; }
    public string? GrupAdi { get; set; }
    public bool Aktif { get; set; }
    public List<PorsiyonDTO> Porsiyonlar { get; set; } = new();
    public int KdvOrani { get; set; } = 10;
    public string? Barkod { get; set; }
    public List<SecenekGrubuDTO> SecenekGruplari { get; set; } = new();
    public List<string>? HazirNotlar { get; set; }
    public List<ReceteSatiriDTO> Recete { get; set; } = new();
    public string? Aciklama { get; set; }
    public List<string> Alerjenler { get; set; } = new();
    /// <summary>0 when the product has no photo; otherwise increases on every upload for cache busting.</summary>
    public int GorselSurumu { get; set; }
    public string? GorselTuru { get; set; }
}

public class MenuKategoriYazRequest
{
    public string GrupAdi { get; set; } = "";
}
public class MenuUrunYazRequest
{
    public long GrupKayitNo { get; set; }
    public string StokAdi { get; set; } = "";
    public decimal SatisFiyati { get; set; }
    public bool Aktif { get; set; } = true;
    public List<PorsiyonDTO> Porsiyonlar { get; set; } = [];
    public int KdvOrani { get; set; } = 10;
    public string? Barkod { get; set; }
    public List<SecenekGrubuDTO>? SecenekGruplari { get; set; }
    public List<string>? HazirNotlar { get; set; }
    public string? Aciklama { get; set; }
    /// <summary>Null keeps the current allergen list (older clients).</summary>
    public List<string>? Alerjenler { get; set; }
}

public class PorsiyonDTO
{
    public int KayitNo { get; set; }
    public string? PorsiyonAdi { get; set; }
    public decimal Fiyat { get; set; }
    /// <summary>Recipe multiplier relative to the full product (for example 0.6 for a half portion).</summary>
    public decimal Carpan { get; set; } = 1;
}

public enum PaketDurum { Yeni, Hazirlaniyor, Yolda, TeslimEdildi, Iptal }

public class PaketSiparisSatirDTO
{
    public long StokKayitNo { get; set; }
    public string StokAdi { get; set; } = "";
    public int? PorsiyonKayitNo { get; set; }
    public string? PorsiyonAdi { get; set; }
    public int Miktar { get; set; }
    public decimal BirimFiyat { get; set; }
    public decimal SatirTutari { get; set; }
    public int KdvOrani { get; set; } = 10;
    public List<SatirSecimDTO> Secimler { get; set; } = new();
    public string? SecimMetni => Secimler.Count == 0 ? null : string.Join(", ", Secimler.Select(s => s.SecenekAdi));
}

public class PaketSiparisDTO
{
    public long KayitNo { get; set; }
    public DateTime KayitTarihi { get; set; }
    public string MusteriAdi { get; set; } = "";
    public string Telefon { get; set; } = "";
    public string Adres { get; set; } = "";
    public string? Aciklama { get; set; }
    public string OdemeSekli { get; set; } = "Nakit";
    public string? Kurye { get; set; }
    public PaketDurum Durum { get; set; }
    public decimal GenelToplam { get; set; }
    public List<PaketSiparisSatirDTO> Satirlar { get; set; } = new();
    public DateTime? TamamlanmaTarihi { get; set; }
    public DateTime? IptalTarihi { get; set; }
    public long? MusteriKayitNo { get; set; }
    public long? KuryeKayitNo { get; set; }
    public bool TahsilEdildi { get; set; }
    public DateTime? TahsilatTarihi { get; set; }
    public string? TahsilEden { get; set; }
}

public class GelenSiparisDTO
{
    public long KayitNo { get; set; }
    public string Kaynak { get; set; } = "";
    public string HariciSiparisNo { get; set; } = "";
    public string KaynakUrunKodu { get; set; } = "";
    public long? EslesenStokKayitNo { get; set; }
    public int Miktar { get; set; }
    public string MusteriAdi { get; set; } = "";
    public string Telefon { get; set; } = "";
    public string Adres { get; set; } = "";
    public string OdemeSekli { get; set; } = "Nakit";
    public DateTime Tarih { get; set; }
    public long? PaketSiparisNo { get; set; }
}
public class GelenSiparisEkleRequest
{
    public string Kaynak { get; set; } = "";
    public string HariciSiparisNo { get; set; } = "";
    public string KaynakUrunKodu { get; set; } = "";
    public int Miktar { get; set; }
    public string MusteriAdi { get; set; } = "";
    public string Telefon { get; set; } = "";
    public string Adres { get; set; } = "";
    public string OdemeSekli { get; set; } = "Nakit";
}
public class GelenSiparisEslemeRequest
{
    public long StokKayitNo { get; set; }
}

public class PaketSiparisSatirIstek
{
    public long StokKayitNo { get; set; }
    public int? PorsiyonKayitNo { get; set; }
    public int Miktar { get; set; }
    public List<int> SecenekKayitNolar { get; set; } = [];
}

public class PaketSiparisEkleRequest
{
    public string IdempotencyKey { get; set; } = "";
    public string MusteriAdi { get; set; } = "";
    public string Telefon { get; set; } = "";
    public string Adres { get; set; } = "";
    public string? Aciklama { get; set; }
    public string OdemeSekli { get; set; } = "Nakit";
    public List<PaketSiparisSatirIstek> Satirlar { get; set; } = new();
}

public class PaketDurumRequest
{
    public PaketDurum Durum { get; set; }
    public string? Kurye { get; set; }
    public long? KuryeKayitNo { get; set; }
}

// ───── MUTFAK (KDS) ─────
public class MutfakSiparisDTO
{
    public long BaslikKayitNo { get; set; }
    public string? MasaAdi { get; set; }
    public string? BolumAdi { get; set; }
    public DateTime? SiparisZamani { get; set; }
    public int BeklemeSuresi { get; set; } // dakika
    public List<MutfakSatirDTO> Satirlar { get; set; } = new();
}

public class MutfakSatirDTO
{
    public long DetayKayitNo { get; set; }
    public string? StokAdi { get; set; }
    public string? PorsiyonAdi { get; set; }
    public decimal Miktar { get; set; }
    public decimal YazdirilanMiktar { get; set; }
    // Kitchen readiness is independent from ERP printing state.
    public decimal HazirMiktar { get; set; }
    public decimal KalanMiktar => Math.Max(0, Miktar - HazirMiktar);
    public string? SatirAciklama { get; set; }
    public string? PersonelAdi { get; set; }
    public bool Hazir => KalanMiktar <= 0;
    public string? SecimMetni { get; set; }
    public long? YaziciKayitNo { get; set; }
}

// ───── GARSON / PERSONEL ─────
public class PersonelDTO
{
    public int KayitNo { get; set; }
    public string? PersonelKodu { get; set; }
    public string? Ad { get; set; }
    public string? Soyad { get; set; }
    public string TamAd => $"{Ad} {Soyad}".Trim();
}

// ───── REZERVASYON ─────
public class RezervasyonDTO
{
    public long KayitNo { get; set; }
    public long MasaKayitNo { get; set; }
    public string? MasaAdi { get; set; }
    public string? MusteriAdi { get; set; }
    public string? Telefon { get; set; }
    public DateTime RezervasyonTarihi { get; set; }
    public int KisiSayisi { get; set; }
    public string? Aciklama { get; set; }
}

public class RezervasyonEkleRequest
{
    public long MasaKayitNo { get; set; }
    public string MusteriAdi { get; set; } = "";
    public string? Telefon { get; set; }
    public DateTime RezervasyonTarihi { get; set; }
    public int KisiSayisi { get; set; }
    public string? Aciklama { get; set; }
}

// ───── GENEL API YANIT ─────
public class ApiResult<T>
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public T? Data { get; set; }

    public static ApiResult<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResult<T> Fail(string message) =>
        new() { Success = false, Message = message };
}

public class ApiResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public object? Data { get; set; }

    public static ApiResult Ok(object? data = null, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiResult Fail(string message) =>
        new() { Success = false, Message = message };
}

// ───── RAPOR ─────
public class GunlukRaporDTO
{
    public DateOnly IsletmeTarihi { get; set; }
    public DateOnly Bugun { get; set; }
    public int BaslangicSaati { get; set; }
    public VardiyaKapanisDTO? VardiyaKapanisi { get; set; }
    public decimal ToplamCiro { get; set; }
    public int ToplamAdisyon { get; set; }
    public int AcikAdisyon { get; set; }
    public decimal NakitToplam { get; set; }
    public decimal BankaToplam { get; set; }
    public decimal CariToplam { get; set; }
    public decimal YemekKartiToplam { get; set; }
    public decimal IndirimToplam { get; set; }
    public List<SaatlikCiroDTO> SaatlikCiro { get; set; } = new();
    public List<UrunSatisDTO> EnCokSatan { get; set; } = new();
    public GunlukMutabakatDTO Mutabakat { get; set; } = new();
    public decimal PaketCiro { get; set; }
    public int TeslimEdilenPaket { get; set; }
    public int IptalEdilenPaket { get; set; }
    public int AcikPaket { get; set; }
    public decimal GenelSatis { get; set; }
    public List<KdvSatiriDTO> KdvDokumu { get; set; } = new();
    public List<YemekKartiOzetDTO> YemekKartiDagilimi { get; set; } = new();
    public PaketTahsilatDTO PaketTahsilat { get; set; } = new();
    public List<KuryeOzetDTO> KuryeOzeti { get; set; } = new();
    public decimal BeklenenKasaNakdi { get; set; }
    public decimal KasaGiris { get; set; }
    public decimal KasaCikis { get; set; }
    public decimal CariTahsilatNakit { get; set; }
    public decimal CariTahsilatBanka { get; set; }
    public List<KasaHareketiDTO> KasaHareketleri { get; set; } = new();
}

public class VardiyaKapanisRequest
{
    public DateOnly IsletmeTarihi { get; set; }
    public decimal SayilanNakit { get; set; }
    public string? Aciklama { get; set; }
}

public class VardiyaKapanisDTO
{
    public DateOnly IsletmeTarihi { get; set; }
    public DateTime KapanisZamani { get; set; }
    public int PersonelId { get; set; }
    public string PersonelAdi { get; set; } = "";
    public decimal BeklenenNakit { get; set; }
    public decimal SayilanNakit { get; set; }
    public decimal NakitFarki { get; set; }
    public string? Aciklama { get; set; }
}

public class IslemKaydiDTO
{
    public long KayitNo { get; set; }
    public DateTime Tarih { get; set; }
    public string Islem { get; set; } = "";
    public string Aciklama { get; set; } = "";
    public long? AdisyonNo { get; set; }
    public int PersonelId { get; set; }
    public string PersonelAdi { get; set; } = "";
    public decimal Tutar { get; set; }
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public decimal Indirim { get; set; }
    public long? YemekKartiKayitNo { get; set; }
    public string? YemekKartiAdi { get; set; }
}

public class GunlukMutabakatDTO
{
    public decimal KapananSatis { get; set; }
    public decimal Tahsilat { get; set; }
    public decimal Fark { get; set; }
    public decimal Nakit { get; set; }
    public decimal Banka { get; set; }
    public decimal YemekKarti { get; set; }
    public decimal Cari { get; set; }
    public decimal Indirim { get; set; }
    public decimal SilinenUrunTutari { get; set; }
    public decimal IptalTutari { get; set; }
    public decimal ZayiTutari { get; set; }
    public decimal IkramTutari { get; set; }
    public int OdemeSayisi { get; set; }
    public decimal IadeTutari { get; set; }
}

public class SaatlikCiroDTO
{
    public int Saat { get; set; }
    public decimal Ciro { get; set; }
    public int AdisyonSayisi { get; set; }
}

public class UrunSatisDTO
{
    public string? StokAdi { get; set; }
    public decimal ToplamMiktar { get; set; }
    public decimal ToplamTutar { get; set; }
}

// ───── AUTH ─────
public class LoginRequest
{
    public string KullaniciAdi { get; set; } = "";
    public string Sifre { get; set; } = "";
}

public class LoginResponse
{
    public string Token { get; set; } = "";
    public string KullaniciAdi { get; set; } = "";
    public string Rol { get; set; } = "";
    public int KullaniciId { get; set; }
    public string TamAd { get; set; } = "";
    public long MagazaKayitNo { get; set; }
    public string MagazaAdi { get; set; } = "";
}
