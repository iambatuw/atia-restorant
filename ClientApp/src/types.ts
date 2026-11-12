export type Role = 'Admin' | 'Garson' | 'Mutfak';
export interface Session { Token:string; KullaniciAdi:string; Rol:Role; KullaniciId:number; TamAd:string; MagazaKayitNo?:number; MagazaAdi?:string }
export interface Health {Mode:string;DatabaseReady:boolean;KaliciDemo?:boolean}
export interface RestaurantSettings {ZayiAktif:boolean}
export interface Table {MasaId:number;MasaAdi:string;MasaKodu:string;RestorantBolumuKayitNo:number;RestorantBolumAdi:string;BaslikKayitNo:number|null;Tutar:number|null;KisiSayisi:number;AcilisTarihi:string|null;Rezerve:boolean;BirlesmisMasa:boolean;AnaMasa:boolean;Durumu:number}
export interface Section {KayitNo:number;BolumAdi:string;ToplamMasa:number;DoluMasa:number}
export interface Portion {KayitNo:number;PorsiyonAdi:string;Fiyat:number;Carpan?:number}
export interface Product {KayitNo:number;StokAdi:string;SatisFiyati:number;GrupKayitNo:number;GrupAdi:string;Aktif:boolean;Porsiyonlar:Portion[];KdvOrani?:number;Barkod?:string|null;SecenekGruplari?:OptionGroup[];HazirNotlar?:string[];Recete?:RecipeRow[];Aciklama?:string|null;Alerjenler?:string[];GorselSurumu?:number}
export interface Category {KayitNo:number;GrupAdi:string;Urunler:Product[]}
export interface OrderLine {KayitNo:number;StokAdi:string;PorsiyonAdi:string|null;Miktar:number;BirimFiyat:number;SatirTutari:number;SatirAciklama:string|null;Ikram:boolean;SecimMetni?:string|null;OdenenMiktar?:number;OdenenTutar?:number}
export interface Receipt {
  KayitNo:number;
  MasaKayitNo:number;
  MasaAdi:string;
  GenelToplam:number;
  NakitToplam?:number|null;
  BankaToplam?:number|null;
  CariToplam?:number|null;
  YemekKartiToplam?:number|null;
  IndirimToplam?:number|null;
  Kapali:boolean;
  KisiSayisi:number;
  Detaylar:OrderLine[];
  KdvDokumu?:VatRow[];
  FaturaBilgisi?:InvoiceDetails|null;
  CariHesapAdi?:string|null;
  HizliSatis?:boolean;
  YazdirmaSayisi?:number;
  KayitTarihi?:string|null;
  PersonelAdi?:string|null;
}
export interface KitchenTicket {BaslikKayitNo:number;MasaAdi:string;BolumAdi:string;SiparisZamani:string;BeklemeSuresi:number;Satirlar:{DetayKayitNo:number;StokAdi:string;Miktar:number;KalanMiktar:number;SatirAciklama:string|null;SecimMetni?:string|null;YaziciKayitNo?:number|null}[]}
export interface KitchenEvent {KayitNo:number;AdisyonNo:number;MasaAdi:string;UrunAdi:string;Islem:string;Miktar:number;Not:string|null;Tarih:string;Goruldu:boolean;YazdirmaDenemesi:number;YazdirmaDurumu:0|1|2|3;YaziciKayitNo?:number|null;YaziciAdi?:string|null}
export interface Reconciliation {KapananSatis:number;Tahsilat:number;Fark:number;Nakit:number;Banka:number;YemekKarti:number;Cari:number;Indirim:number;SilinenUrunTutari:number;IptalTutari:number;ZayiTutari:number;IkramTutari:number;OdemeSayisi:number}
export interface AuditEntry {KayitNo:number;Tarih:string;Islem:string;Aciklama:string;AdisyonNo:number|null;PersonelId:number;PersonelAdi:string;Tutar:number;YemekKartiAdi?:string|null}
export interface ShiftClose {IsletmeTarihi:string;KapanisZamani:string;PersonelAdi:string;BeklenenNakit:number;SayilanNakit:number;NakitFarki:number;Aciklama:string|null}
export interface Report {IsletmeTarihi:string;Bugun:string;BaslangicSaati:number;VardiyaKapanisi:ShiftClose|null;ToplamCiro:number;ToplamAdisyon:number;AcikAdisyon:number;NakitToplam:number;BankaToplam:number;CariToplam:number;YemekKartiToplam:number;IndirimToplam:number;SaatlikCiro:{Saat:number;Ciro:number;AdisyonSayisi:number}[];EnCokSatan:{StokAdi:string;ToplamMiktar:number;ToplamTutar:number}[];Mutabakat:Reconciliation;PaketCiro:number;TeslimEdilenPaket:number;IptalEdilenPaket:number;AcikPaket:number;GenelSatis:number}
export interface Reservation {KayitNo:number;MasaKayitNo:number;MasaAdi:string;MusteriAdi:string;Telefon:string;RezervasyonTarihi:string;KisiSayisi:number;Aciklama:string}
export type DeliveryStatus=0|1|2|3|4;
export interface DeliveryLine {StokKayitNo:number;StokAdi:string;PorsiyonKayitNo:number|null;PorsiyonAdi:string|null;Miktar:number;BirimFiyat:number;SatirTutari:number;SecimMetni?:string|null}
export interface DeliveryOrder {KayitNo:number;KayitTarihi:string;MusteriAdi:string;Telefon:string;Adres:string;Aciklama:string|null;OdemeSekli:string;Kurye:string|null;Durum:DeliveryStatus;GenelToplam:number;Satirlar:DeliveryLine[];MusteriKayitNo?:number|null;KuryeKayitNo?:number|null;TahsilEdildi?:boolean;TahsilatTarihi?:string|null;TahsilEden?:string|null}

// ───── POS CİHAZ ENTEGRASYONU ─────
export type PosCihazTipi = 0 | 1 | 2; // 0=HariciManuelPos, 1=HuginS1, 2=PayGo
export type PosDurum = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Baslatildi, 1=CihazaGonderildi, 2=Onaylandi, 3=Reddedildi, 4=Belirsiz, 5=ErpKaydedildi, 6=Mutabik

export interface PosIslemIstek {
  BaslikKayitNo: number;
  MasaKayitNo: number;
  Tutar: number;
  CihazTipi: PosCihazTipi;
  TerminalIp?: string;
  TerminalPort?: number;
  IdempotencyKey?: string;
}

export interface PosIslemKayit {
  IslemId: string;
  IdempotencyKey: string;
  BaslikKayitNo: number;
  MasaKayitNo: number;
  Tutar: number;
  CihazTipi: PosCihazTipi;
  Durum: PosDurum;
  AuthCode: string | null;
  Rrn: string | null;
  MaskedPan: string | null;
  HataMesaji: string | null;
  BaslangicZamani: string;
  BitisZamani: string | null;
  Basarili: boolean;
}

// ───── ÖDEME VE MASA İŞLEMLERİ ─────
export interface OdemeRequest {
  BaslikKayitNo: number;
  NakitTutar: number;
  BankaTutar: number;
  CariTutar: number;
  YemekKartiTutar: number;
  IndirimTutar: number;
  OdemePersonelKayitNo?: number;
  KismiOdeme: boolean;
  PosIslemId?: string | null;
  OdenenSatirlar?: AyrilanSatir[];
  YemekKartiKayitNo?: number | null;
  CariHesapKayitNo?: number | null;
}

export interface MasaTasiRequest {
  KaynakMasaKayitNo: number;
  HedefMasaKayitNo: number;
}

export interface AyrilanSatir {
  DetayKayitNo: number;
  Miktar: number;
}

export interface MasaAyirRequest {
  MasaKayitNo: number;
  HedefMasaKayitNo: number;
  AyrilanSatirlar: AyrilanSatir[];
}

export interface MasaAyirSonuc {
  KaynakAdisyon: Receipt;
  HedefAdisyon: Receipt;
}

export interface MasaBirlestirRequest {
  AnaMasaKayitNo: number;
  BirlestirilecekMasaKayitNolar: number[];
}

// ───── İŞLETME, PERSONEL VE KURULUM ─────
export interface StoreProfile {MagazaKayitNo:number;MagazaKodu:string;Unvan:string;Adres:string|null;Telefon:string|null;VergiDairesi:string|null;VergiNo:string|null;FisAltYazisi:string|null}
export interface Printer {KayitNo:number;Ad:string;Kategoriler:number[]}
export interface MealCard {KayitNo:number;Ad:string;KomisyonOrani:number;Aktif:boolean}
export interface QuickNoteDefinition {Ad:string;Grup:string}
export interface FullSettings extends RestaurantSettings {Isletme:StoreProfile;HazirNotlar:string[];HazirNotTanimlari?:QuickNoteDefinition[];Yazicilar:Printer[];YemekKartlari:MealCard[]}
export interface DemoStatus {Kalici:boolean;SonKayit:string|null;SonHata:string|null}
export interface StaffAccount {KayitNo:number;KullaniciAdi:string;AdSoyad:string;Rol:Role;Aktif:boolean;OlusturmaTarihi:string;SonGiris:string|null}

// ───── SEÇENEKLER, KDV, ADİSYON GEÇMİŞİ ─────
export interface ProductOption {KayitNo:number;Ad:string;EkFiyat:number}
export interface OptionGroup {KayitNo:number;Ad:string;Zorunlu:boolean;CokluSecim:boolean;Secenekler:ProductOption[]}
export interface LineChoice {SecenekKayitNo:number;GrupAdi:string;SecenekAdi:string;EkFiyat:number}
export interface VatRow {Oran:number;Matrah:number;Kdv:number;Toplam:number}
export interface RefundEntry {KayitNo:number;Tarih:string;Nakit:number;Banka:number;YemekKarti:number;Cari:number;Toplam:number;Gerekce:string;PersonelAdi:string}
export interface FullOrderLine extends OrderLine {StokKayitNo:number;PorsiyonKayitNo:number|null;KdvOrani:number;Secimler:LineChoice[];PersonelAdi:string|null}
export interface FullReceipt extends Omit<Receipt,'Detaylar'> {Detaylar:FullOrderLine[];KdvDokumu:VatRow[];Iadeler:RefundEntry[];IadeToplam:number;YazdirmaSayisi:number;YemekKartiKayitNo:number|null;YemekKartiAdi:string|null;CariHesapKayitNo?:number|null;CariHesapAdi?:string|null;FaturaBilgisi?:InvoiceDetails|null;HizliSatis?:boolean}
export interface ReceiptSummary {KayitNo:number;MasaKayitNo:number|null;MasaAdi:string|null;PersonelAdi:string|null;AcilisTarihi:string|null;KapanisTarihi:string|null;Kapali:boolean;Birlesti:boolean;GenelToplam:number;Indirim:number;Nakit:number;Banka:number;YemekKarti:number;Cari:number;Iade:number;UrunSayisi:number}
export interface ReceiptHistoryDetail {Adisyon:FullReceipt;KapanisTarihi:string|null;Birlesti:boolean;Duzeltilebilir:boolean;IadeEdilebilir:boolean;Islemler:AuditEntry[]}
export interface ReceiptLocation {KayitNo:number;MasaKayitNo:number|null;MasaAdi:string|null;Kapali:boolean}

// ───── PAKET SERVİS ─────
export interface Customer {KayitNo:number;AdSoyad:string;Telefon:string;Adresler:string[];Not:string|null;SiparisSayisi:number;ToplamTutar:number;SonSiparisTarihi:string|null}
export interface CustomerDetail {Musteri:Customer;SonSiparisler:DeliveryOrder[]}
export interface Courier {KayitNo:number;AdSoyad:string;Telefon:string|null;Aktif:boolean}
export interface DeliveryCollection {Nakit:number;Kart:number;Online:number;Bekleyen:number;BekleyenSayisi:number}
export interface CourierSummary {KuryeKayitNo:number|null;Kurye:string;TeslimSayisi:number;TeslimTutari:number;TahsilEdilen:number;Bekleyen:number}

// ───── RAPORLAR ─────
export interface MealCardSummary {KayitNo:number|null;Ad:string;Tutar:number;TahminiKomisyon:number}
export interface FullReport extends Omit<Report,'Mutabakat'> {KdvDokumu:VatRow[];YemekKartiDagilimi:MealCardSummary[];PaketTahsilat:DeliveryCollection;KuryeOzeti:CourierSummary[];BeklenenKasaNakdi:number;Mutabakat:Reconciliation&{IadeTutari:number};KasaGiris?:number;KasaCikis?:number;CariTahsilatNakit?:number;CariTahsilatBanka?:number;KasaHareketleri?:CashMovement[]}
export interface PeriodDay {Tarih:string;AdisyonSayisi:number;MasaSatis:number;PaketSatis:number;Iade:number;ToplamSatis:number;Nakit:number;Banka:number;YemekKarti:number;Cari:number;Indirim:number;Iptal:number;Zayi:number;Ikram:number;VardiyaKapali:boolean}
export interface PeriodReport {Baslangic:string;Bitis:string;Gunler:PeriodDay[];Toplam:PeriodDay;KdvDokumu:VatRow[];EnCokSatan:{StokAdi:string;ToplamMiktar:number;ToplamTutar:number}[];YemekKartiDagilimi:MealCardSummary[]}
export interface StaffReportRow {PersonelId:number;PersonelAdi:string;Rol:string|null;AcilanAdisyon:number;UrunAdedi:number;SatisTutari:number;IptalSayisi:number;IptalTutari:number;ZayiTutari:number;IkramTutari:number;TahsilatTutari:number;IadeTutari:number}
export interface StaffReport {Baslangic:string;Bitis:string;Satirlar:StaffReportRow[]}

// ───── STOK ─────
export interface Ingredient {KayitNo:number;Ad:string;Birim:string;Stok:number;KritikSeviye:number;BirimMaliyet:number;Aktif:boolean;Kritik:boolean}
export interface RecipeRow {HammaddeKayitNo:number;Miktar:number}
export type StockMovementType=0|1|2|3|4; // Giris, Cikis, Sayim, Satis, SatisIadesi
export interface StockMovement {KayitNo:number;Tarih:string;HammaddeKayitNo:number;HammaddeAdi:string;Tip:StockMovementType;Miktar:number;StokSonrasi:number;BirimMaliyet:number|null;Aciklama:string|null;PersonelAdi:string}
export interface ProductCost {UrunKayitNo:number;UrunAdi:string;PorsiyonAdi:string|null;SatisFiyati:number;ReceteMaliyeti:number;KdvHaricFiyat:number;BrutKar:number;MaliyetOrani:number|null;ReceteVar:boolean}

// ───── CARİ, KASA, HIZLI SATIŞ, QR ─────
export interface Account {KayitNo:number;Unvan:string;Telefon:string|null;VergiDairesi:string|null;VergiNo:string|null;Adres:string|null;KrediLimiti:number;Aktif:boolean;Bakiye:number}
export interface AccountMovement {KayitNo:number;CariKayitNo:number;Tarih:string;Tip:string;Borc:number;Alacak:number;BakiyeSonrasi:number;AdisyonNo:number|null;Aciklama:string|null;PersonelAdi:string}
export interface AccountStatement {Hesap:Account;Hareketler:AccountMovement[]}
export interface CashMovement {KayitNo:number;Tarih:string;Giris:boolean;Kategori:string;Tutar:number;Aciklama:string;PersonelAdi:string}
export interface InvoiceDetails {Unvan:string;VergiDairesi:string|null;VergiNo:string|null;Adres:string|null}
export interface TableQr {MasaKayitNo:number;MasaAdi:string;BolumAdi:string;Kod:string}
export interface GuestTable {MasaAdi:string;IsletmeAdi:string}
export type CallType=0|1; // 0=Garson, 1=Hesap
export interface GuestCall {KayitNo:number;MasaKayitNo:number;MasaAdi:string;Tip:CallType;Tarih:string;Tamamlandi:boolean}
export const ALLERGENS=['Gluten','Kabuklu deniz ürünleri','Yumurta','Balık','Yer fıstığı','Soya','Süt','Sert kabuklu yemişler','Kereviz','Hardal','Susam','Sülfit','Acı bakla','Yumuşakçalar'] as const;
