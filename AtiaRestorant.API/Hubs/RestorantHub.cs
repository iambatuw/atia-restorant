using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace AtiaRestorant.API.Hubs;

[Authorize(Policy = "Staff")]
public sealed class RestorantHub : Hub
{
    // Server-to-client invalidation only. No client-callable mutation methods.
}
