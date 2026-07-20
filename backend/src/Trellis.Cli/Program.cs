using System.CommandLine;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Trellis.Cli;
using Trellis.Cli.Commands;
using Trellis.Core.Common;

var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
{
    Args = Array.Empty<string>(),
    ContentRootPath = AppContext.BaseDirectory,
});

builder.Logging.ClearProviders();
builder.Services.AddTrellisCore(builder.Configuration);
builder.Services.AddSingleton<ICommandConsole, CommandConsole>();
builder.Services.AddTransient<RenderCommandHandler>();
builder.Services.AddTransient<RenderCommand>();

using var host = builder.Build();
var rootCommand = new RootCommand("Trellis diagram tooling.");
rootCommand.Subcommands.Add(host.Services.GetRequiredService<RenderCommand>().Create());

return await rootCommand.Parse(args).InvokeAsync();
