namespace AtiaRestorant.API.Data;

/// <summary>
/// INACTIVE / UNVERIFIED ERP adapter boundary. Deliberately not registered in DI.
/// The former guessed SQL mappings (including print-count-based KDS queries) are unsafe.
/// No SQL connection or ERP read/write is executed until the actual schema, receipt
/// lifecycle, permissions, transaction semantics and kitchen state store are verified.
/// </summary>
public sealed class DbContext
{
    public const bool DatabaseReady = false;
    public static void EnsureVerified() => throw new InvalidOperationException(
        "ERP schema and adapter are unverified. SQL access is disabled.");
}
