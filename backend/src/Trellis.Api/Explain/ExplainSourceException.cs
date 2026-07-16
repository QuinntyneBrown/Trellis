namespace Trellis.Api.Explain;

/// <summary>
/// A user-recoverable failure while acquiring or aggregating the source for an
/// "Explain This" prompt (unsupported URL, archive download failure, oversized
/// selection, ...). The message is safe to surface verbatim to the client as a
/// ProblemDetails title; anything else bubbling out of the Explain pipeline is
/// a genuine bug and falls through to the generic 500 handler.
/// </summary>
public class ExplainSourceException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ExplainSourceException"/> class.
    /// </summary>
    /// <param name="message">The user-facing failure description.</param>
    public ExplainSourceException(string message)
        : base(message)
    {
    }
}
