using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using Trellis.Application.Common.Behaviours;

namespace Trellis.Application;

/// <summary>
/// Registers Application layer services with the dependency injection container.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Wires MediatR and FluentValidation, along with the validation and unhandled
    /// exception pipeline behaviours, for the Application layer.
    /// </summary>
    /// <param name="services">The service collection to add registrations to.</param>
    /// <returns>The same service collection, for chaining.</returns>
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddMediatR(configuration =>
        {
            configuration.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
            configuration.AddOpenBehavior(typeof(UnhandledExceptionBehaviour<,>));
            configuration.AddOpenBehavior(typeof(ValidationBehaviour<,>));
        });

        return services;
    }
}
