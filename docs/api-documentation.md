# AtiaRestorant API

ASP.NET Core **.NET 10 LTS** restaurant demonstration backend. No database SDK, provider credentials, verified ERP mappings, or ERP writes are included. SignalR uses the ASP.NET Core shared framework, not the obsolete 1.x package.

## Start and test

Install/use a .NET 10 SDK, then from this API directory:

```powershell
$env:ASPNETCORE_ENVIRONMENT = 'Development'
foreach ($role in 'Waiter','Kitchen') {
    $bytes = New-Object byte[] 24
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $password = [Convert]::ToBase64String($bytes)
    Set-Item -Path "Env:Demo__$($role)Password" -Value $password
    Write-Host "$role password: $password"
}
dotnet restore --source https://api.nuget.org/v3/index.json
dotnet run --no-launch-profile --urls http://0.0.0.0:5000
```

Open the app from another computer at `http://<server-LAN-IP>:5000/login`; allow the port through the host firewall if needed. Development CORS allows `http://localhost:5173` with credentials for SignalR. No launch configuration is supplied. Without `Development`, the committed `Demo:Enabled=true` intentionally prevents startup. Development generates a cryptographically random, process-local JWT signing key if `JwtSettings__SecretKey` is absent; restarting invalidates old tokens.

```powershell
dotnet restore Tests/AtiaRestorant.API.Tests.csproj --source https://api.nuget.org/v3/index.json
dotnet test Tests/AtiaRestorant.API.Tests.csproj --no-restore
```

Tests cover parallel orders and payments, snapshot isolation, authoritative prices/portions/personnel, kitchen readiness and later quantity changes, reservation validation/overlap, closed-only reports, transfers, roles, PascalCase HTTP contracts, authentication, login limiting, and environment/key safety. Tests are excluded from the main API compilation.

### Demo accounts (Development only)

| KullaniciAdi | Password | Rol |
| --- | --- | --- |
| admin | `demo123` | Admin |
| garson | `Demo__WaiterPassword` | Garson |
| mutfak | `Demo__KitchenPassword` | Mutfak |

The demo admin password is fixed at `demo123`. Waiter and kitchen need distinct 12–128 character passwords supplied at startup; neither may equal the admin password. The command above creates and prints random values for them. Missing, short or duplicate values prevent startup. Login is limited to 10 attempts per minute per direct remote IP, with HTTP 429 thereafter. Anyone who can reach this demo and knows the published admin password can sign in as Admin; limit network access and do not use real business data. Do not enable untrusted forwarded headers; configure trusted proxy handling separately if needed.

### Non-demo / production

Set `Demo__Enabled=false` and provide `JwtSettings__SecretKey` via an environment variable or secret store (at least **32 UTF-8 bytes**, cryptographically random), plus issuer/audience as appropriate. Demo is rejected in any environment other than Development; a production signing key is mandatory. No production secrets are committed. HTTPS redirection is enabled outside Development; terminate TLS securely and configure trusted proxy forwarding when applicable. Configure `AllowedHosts` for the intended production hostnames before deployment.

**SQL mode is intentionally unavailable.** Anonymous `GET /api/health` returns Mode `SqlServer`, DatabaseReady `false`; all other requests return **503 ProblemDetails**, including login, menu, authenticated routes and the hub. `Data/DbContext.cs` is explicitly inactive/unverified and is not registered in DI. The former speculative SQL adapter was removed, including its incorrect use of printed quantities as kitchen readiness. Re-enabling ERP requires schema inspection, verified read mappings, authentication/authorization integration, monetary and receipt lifecycle rules, transactional concurrency controls, a dedicated kitchen readiness store, and integration tests. A connection string alone cannot enable it.

## HTTP contract

Request/response DTO fields use the original **PascalCase** model contract. Successful endpoints return HTTP 200 and:

```json
{ "Success": true, "Message": null, "Data": {} }
```

Empty-table adisyon returns `Data: null`. Failed requests return non-2xx RFC ProblemDetails (`application/problem+json`), not a successful ApiResult with `Success:false`. Known validation/not-found/conflict statuses are 400/404/409; missing authentication is 401, denied role 403, login throttling 429, unverified SQL 503. Responses do not expose stack traces or exception messages. Date query parameters strictly require `YYYY-MM-DD`. Reservation timestamps should be ISO 8601 with explicit timezone or `Z`; stored timestamps use UTC; business date filters and hourly reporting use Europe/Istanbul (Windows fallback: Turkey Standard Time).

| Method | Endpoint | Access / Data |
| --- | --- | --- |
| GET | `/api/health` | Anonymous; `{Mode:"Demo" or "SqlServer",DatabaseReady:false}` |
| POST | `/api/auth/login` | Anonymous; `LoginRequest` -> `LoginResponse` |
| GET | `/api/menu` | Anonymous; `MenuKategoriDTO[]` |
| GET | `/api/masalar?bolumId=1` | Staff; `RestorantMasaDTO[]` |
| GET | `/api/bolumler` | Staff; `RestorantBolumDTO[]` |
| GET | `/api/masalar/{id}/adisyon` | Staff; `AdisyonBaslikDTO` or null |
| POST | `/api/siparisler` | Garson/Admin; `SiparisEkleRequest` -> adisyon |
| PATCH | `/api/siparisler/{id}` | Garson/Admin; `SiparisGuncelleRequest` -> adisyon |
| POST | `/api/siparisler/{id}/cikar` | Garson/Admin for cancellation, Admin for waste; `SiparisCikarmaRequest` with reason -> updated adisyon |
| POST | `/api/masalar/{id}/odeme` | Admin; `OdemeRequest` -> updated or closed adisyon |
| POST | `/api/masalar/tasi` | Admin; `MasaTasiRequest` -> moved adisyon |
| POST | `/api/masalar/ayir` | Admin; `MasaAyirRequest` -> source and target receipts |
| POST | `/api/masalar/birlestir` | Admin; `MasaBirlestirRequest` -> merged adisyon |
| GET | `/api/paket-siparisler` | Garson/Admin; delivery orders |
| POST | `/api/paket-siparisler` | Garson/Admin; create delivery order |
| PATCH | `/api/paket-siparisler/{id}/durum` | Garson/Admin; advance delivery status |
| GET | `/api/mutfak` | Mutfak/Admin; `MutfakSiparisDTO[]` |
| GET | `/api/mutfak/bildirimler` | Mutfak/Admin; pending kitchen notices |
| POST | `/api/mutfak/bildirimler/{id}/goruldu` | Mutfak/Admin; acknowledge notice |
| POST | `/api/mutfak/satirlar/{id}/hazir` | Mutfak/Admin; mark one order line ready |
| POST | `/api/mutfak/{baslikId}/hazir` | Mutfak/Admin; adisyon |
| GET | `/api/raporlar/gunluk?tarih=YYYY-MM-DD` | Admin; `GunlukRaporDTO` (Istanbul today by default) |
| GET | `/api/raporlar/islemler?tarih=YYYY-MM-DD` | Admin; operation history |
| POST | `/api/raporlar/vardiya-kapat` | Admin; close completed business day |
| GET | `/api/rezervasyonlar?tarih=YYYY-MM-DD` | Admin; `RezervasyonDTO[]` (all dates if omitted) |
| POST | `/api/rezervasyonlar` | Admin; `RezervasyonEkleRequest` -> `RezervasyonDTO` |
| DELETE | `/api/rezervasyonlar/{id}` | Admin; removed `RezervasyonDTO` |

Admin login body is `{ "KullaniciAdi":"admin", "Sifre":"demo123" }`. Its Data is `{Token,KullaniciAdi,Rol,KullaniciId,TamAd}`; send the token in `Authorization: Bearer ...`. Tokens expire after eight hours. Only Garson/Mutfak/Admin are valid staff roles. The server derives the role from its signed token; a client-supplied role field cannot grant permission.

### Mutation rules

- Singleton process-local repository uses one lock for all reads, writes, identity generation and result snapshots; clients cannot mutate internal DTOs. Seed includes 12 tables in Salon/Bahçe, 11 menu products with portions, open orders and one closed receipt.
- Server derives item/portion price from active menu and staff identity from validated JWT, ignoring supplied `BirimFiyat`, `PersonelKayitNo`, and payment personnel. Arbitrary extra items are rejected. Quantity must be positive, <=100, with <=3 decimal places; row money is rounded to two places away from zero. Notes <=500 characters.
- Garson may add/update quantity/notes and cancel open rows with a reason. Waste and `Ikram` are Admin-only. PATCH body `DetayKayitNo`, if nonzero, must match URL ID. The client should preserve the row's current Ikram flag. Closed receipts cannot change.
- Payment must match the current table's `BaslikKayitNo`; every amount must be nonnegative with <=2 decimal places. A partial payment must be positive and no greater than the remaining balance. A final payment must exactly equal that balance. The receipt closes once paid in full. Negative amounts, mismatched POS confirmations, stale headers, duplicate final payments and overpayments fail before mutation.
- Transfers require an occupied source and an empty, unreserved target. Split and merge are supported with additional checks, including preventing a split after partial payment. These operations remain process-local demo transactions.
- KDS `HazirMiktar` is stored independently from printing. `KalanMiktar=max(0,Miktar-HazirMiktar)` and `Hazir=KalanMiktar<=0`. A ticket appears whenever any row is unready; ticket contains all its rows. Mark-ready acknowledges only quantities present inside that locked operation. Later added/increased quantities return a ticket. Reducing clamps ready quantity to the reduced count, so subsequent increases cannot resurrect readiness. **No operation updates YazdirilanMiktar**; print-related legacy fields are informational only.
- Report `ToplamAdisyon`, hourly totals and bestsellers include only closed receipts on the Istanbul local closing date. `ToplamCiro` and hourly ciro are net of receipt discount; product row totals are gross before receipt-level discount. `AcikAdisyon` separately counts open receipts created on the queried Istanbul local date. Payment subtotals reconcile to net ciro.
- Reservations require an existing unmerged table, nonblank customer <=100 characters, 1–20 people, optional phone <=30 characters with digits/spaces/+/-/parentheses, and future time within a year. A table's reservations must be at least two hours apart; a reservation within two hours is rejected if occupied. Reservations within ±2 hours of now flag a table reserved. Delete removes the reservation. This simple fixed window is a demo policy, not a real scheduling/capacity model.

## Realtime

Connect authenticated SignalR clients to **`/hubs/restorant`** using `accessTokenFactory`. Query-string access tokens are accepted only on this hub path to support WebSocket/SSE transports. Staff authentication/roles are required for negotiation and connection; the hub exposes no client-callable mutation methods.

Every successful mutation emits **`Changes` with no payload**. Refetch whichever REST data the current screen needs. Validation/failed operations emit nothing. Hub transport failure does not roll back a committed mutation or falsely report that it failed. Delivery is best-effort: periodic/on-reconnect refetch remains necessary.

## Limitations

Demo is not a production POS: state disappears on restart, there is no durable store/outbox, cross-instance locking, optimistic version/ETag contract, physical printer acknowledgement, real settlement/refund, ERP integration, tax calculation, stock deduction, audit persistence or production user directory. Payment validates header ID and current balance, not a client snapshot revision (no revision exists in the supplied contract). Readiness updates are serialized within this one process only. DatabaseReady stays false even when the demo is healthy. Do not deploy demo accounts or pretend SQL readiness.
