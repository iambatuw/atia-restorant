export type Role = 'Admin' | 'Garson' | 'Mutfak';
export interface Session { Token:string; KullaniciAdi:string; Rol:Role; KullaniciId:number; TamAd:string }
export interface Health {Mode:string;DatabaseReady:boolean}
export interface Table {MasaId:number;MasaAdi:string;MasaKodu:string;RestorantBolumuKayitNo:number;RestorantBolumAdi:string;BaslikKayitNo:number|null;Tutar:number|null;KisiSayisi:number;AcilisTarihi:string|null;Rezerve:boolean;BirlesmisMasa:boolean;AnaMasa:boolean;Durumu:number}
export interface Section {KayitNo:number;BolumAdi:string;ToplamMasa:number;DoluMasa:number}
export interface Portion {KayitNo:number;PorsiyonAdi:string;Fiyat:number}
export interface Product {KayitNo:number;StokAdi:string;SatisFiyati:number;GrupKayitNo:number;GrupAdi:string;Aktif:boolean;Porsiyonlar:Portion[]}
export interface Category {KayitNo:number;GrupAdi:string;Urunler:Product[]}
export interface OrderLine {KayitNo:number;StokAdi:string;PorsiyonAdi:string|null;Miktar:number;BirimFiyat:number;SatirTutari:number;SatirAciklama:string|null;Ikram:boolean}
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
}
export interface KitchenTicket {BaslikKayitNo:number;MasaAdi:string;BolumAdi:string;SiparisZamani:string;BeklemeSuresi:number;Satirlar:{DetayKayitNo:number;StokAdi:string;Miktar:number;KalanMiktar:number;SatirAciklama:string|null}[]}
export interface KitchenEvent {KayitNo:number;AdisyonNo:number;MasaAdi:string;UrunAdi:string;Islem:string;Miktar:number;Not:string|null;Tarih:string;Goruldu:boolean}
export interface Reconciliation {KapananSatis:number;Tahsilat:number;Fark:number;Nakit:number;Banka:number;YemekKarti:number;Cari:number;Indirim:number;SilinenUrunTutari:number;IptalTutari:number;ZayiTutari:number;IkramTutari:number;OdemeSayisi:number}
export interface AuditEntry {KayitNo:number;Tarih:string;Islem:string;Aciklama:string;AdisyonNo:number|null;PersonelId:number;PersonelAdi:string;Tutar:number}
export interface ShiftClose {IsletmeTarihi:string;KapanisZamani:string;PersonelAdi:string;BeklenenNakit:number;SayilanNakit:number;NakitFarki:number;Aciklama:string|null}
export interface Report {IsletmeTarihi:string;Bugun:string;BaslangicSaati:number;VardiyaKapanisi:ShiftClose|null;ToplamCiro:number;ToplamAdisyon:number;AcikAdisyon:number;NakitToplam:number;BankaToplam:number;CariToplam:number;YemekKartiToplam:number;IndirimToplam:number;SaatlikCiro:{Saat:number;Ciro:number;AdisyonSayisi:number}[];EnCokSatan:{StokAdi:string;ToplamMiktar:number;ToplamTutar:number}[];Mutabakat:Reconciliation}
export interface Reservation {KayitNo:number;MasaKayitNo:number;MasaAdi:string;MusteriAdi:string;Telefon:string;RezervasyonTarihi:string;KisiSayisi:number;Aciklama:string}
export type DeliveryStatus=0|1|2|3|4;
export interface DeliveryLine {StokKayitNo:number;StokAdi:string;PorsiyonKayitNo:number|null;PorsiyonAdi:string|null;Miktar:number;BirimFiyat:number;SatirTutari:number}
export interface DeliveryOrder {KayitNo:number;KayitTarihi:string;MusteriAdi:string;Telefon:string;Adres:string;Aciklama:string|null;OdemeSekli:string;Kurye:string|null;Durum:DeliveryStatus;GenelToplam:number;Satirlar:DeliveryLine[]}

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

