# Firestore Index Gereksinimleri

Bu proje içindeki sorguların ("Bu raporu görüntülemek için gerekli Firestore Index henüz oluşturulmamış" hatasını gidermek için) aşağıdaki Composite Index'lerin Firestore konsolu üzerinden oluşturulması gerekmektedir.

## Nasıl Oluşturulur?

1.  Firebase Console'a gidin.
2.  Sol menüden **Firestore Database**'i seçin.
3.  Üst sekmelerden **Indexes** (Dizinler) sekmesine tıklayın.
4.  **Create Index** (Dizin Oluştur) butonuna tıklayın.
5.  Aşağıdaki tabloda belirtilen her bir işlem için Collection ID, Alanlar ve Sıralama tiplerini girin.
6.  Query scope olarak **Collection** seçin.

## Gerekli Index Listesi

| Collection ID | Alan 1 (Sıralama) | Alan 2 (Sıralama) | Kullanıldığı Sayfa |
| :--- | :--- | :--- | :--- |
| `Adisyonlar` | `rrc_restaurant_id` (Ascending / Artan) | `tarih` (Ascending / Artan) | `AdisyonlarPage.jsx`, `GenelRaporPage.jsx` |
| `AdisyonIcerik` | `rrc_restaurant_id` (Ascending / Artan) | `tarih` (Ascending / Artan) | `SatisAdetleriPage.jsx` |
| `padisyoniptaller` | `rrc_restaurant_id` (Ascending / Artan) | `iptaltarihi` (Ascending / Artan) | `IptalRaporlariPage.jsx` |
| `tblmasaiptalads` | `rrc_restaurant_id` (Ascending / Artan) | `tarih` (Ascending / Artan) | `IptalRaporlariPage.jsx` |
| `giderKayitlari` | `subeId` (Ascending / Artan) | `tarih` (Descending / Azalan) | `GenelRaporPage.jsx` |
| `kuryeatama` | `subeId` (Ascending / Artan) | `atamaTarihi` (Descending / Azalan) | `GenelRaporPage.jsx` |
| `Masalar` | `rrc_restaurant_id` (Ascending / Artan) | `masa_id` (Ascending / Artan) | `MasalarPage.jsx` |
| `sube_bakiye_hareketleri` | `sube_id` (Ascending / Artan) | `tarih` (Descending / Azalan) | `SubeBakiyeTakipPage.jsx` |
| `sube_bakiye_hareketleri` | `siparis_id` (Ascending / Artan) | `tarih` (Descending / Azalan) | `SubeBakiyeTakipPage.jsx` |

## Notlar

*   **Ascending**: Artan (A-Z, 0-9)
*   **Descending**: Azalan (Z-A, 9-0)
*   Uygulama çalıştırıldığında tarayıcı konsolunda (F12 -> Console) çıkan linklere tıklayarak da bu indexleri otomatik oluşturma sayfasına gidebilirsiniz.
