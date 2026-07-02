using Trellis.Api.Common;
using Trellis.Api.Hubs;
using Trellis.Api.Persistence.Initialisation;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddTrellisServices(builder.Configuration);

var app = builder.Build();

// Run any startup database migration/reset before health checks (and everything
// else) become reachable, since /health is used as a readiness probe.
using (var scope = app.Services.CreateScope())
{
    var initialiser = scope.ServiceProvider.GetRequiredService<ApplicationDbContextInitialiser>();

    if (app.Environment.IsEnvironment("E2E"))
    {
        // Every E2E run starts from a guaranteed-fresh database.
        await initialiser.ResetAsync();
    }

    await initialiser.InitialiseAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseExceptionHandler();

app.UseCors(Trellis.Api.Common.DependencyInjection.CorsPolicyName);

app.MapControllers();
app.MapHub<PlantUmlHub>("/hubs/plantuml");
app.MapHealthChecks("/health");

app.Run();

/// <summary>
/// Exposes the generated entry point Program class as public and partial so it can
/// be referenced by <c>WebApplicationFactory&lt;Program&gt;</c> in integration tests.
/// </summary>
public partial class Program
{
}
