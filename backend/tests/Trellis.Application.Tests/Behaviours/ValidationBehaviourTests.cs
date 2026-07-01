using FluentValidation;
using FluentValidation.Results;
using MediatR;
using Trellis.Application.Common.Behaviours;
using ValidationException = Trellis.Application.Common.Exceptions.ValidationException;
using Xunit;

namespace Trellis.Application.Tests.Behaviours;

public class ValidationBehaviourTests
{
    [Fact]
    public async Task Handle_InvokesNext_WhenThereAreNoValidators()
    {
        var behaviour = new ValidationBehaviour<TestRequest, string>(Array.Empty<IValidator<TestRequest>>());

        var result = await behaviour.Handle(new TestRequest(), () => Task.FromResult("ok"), CancellationToken.None);

        Assert.Equal("ok", result);
    }

    [Fact]
    public async Task Handle_InvokesNext_WhenValidationSucceeds()
    {
        var validator = new PassingValidator();
        var behaviour = new ValidationBehaviour<TestRequest, string>(new[] { validator });

        var result = await behaviour.Handle(new TestRequest(), () => Task.FromResult("ok"), CancellationToken.None);

        Assert.Equal("ok", result);
    }

    [Fact]
    public async Task Handle_ThrowsValidationException_WhenValidationFails()
    {
        var validator = new FailingValidator();
        var behaviour = new ValidationBehaviour<TestRequest, string>(new[] { validator });

        var exception = await Assert.ThrowsAsync<ValidationException>(() =>
            behaviour.Handle(new TestRequest(), () => Task.FromResult("should not be reached"), CancellationToken.None));

        Assert.True(exception.Errors.ContainsKey(nameof(TestRequest.Value)));
    }

    public record TestRequest : IRequest<string>
    {
        public string Value { get; init; } = string.Empty;
    }

    private class PassingValidator : AbstractValidator<TestRequest>
    {
        public PassingValidator()
        {
            this.RuleFor(request => request.Value).Must(_ => true);
        }
    }

    private class FailingValidator : AbstractValidator<TestRequest>
    {
        public override Task<ValidationResult> ValidateAsync(ValidationContext<TestRequest> context, CancellationToken cancellation = default)
        {
            var failure = new ValidationFailure(nameof(TestRequest.Value), "Value is required.");
            return Task.FromResult(new ValidationResult(new[] { failure }));
        }
    }
}
