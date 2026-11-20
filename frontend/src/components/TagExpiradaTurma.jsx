export function TagExpiradaTurma({ expirada, testId }) {
    if (!expirada) return null;
    return <span data-testid={testId} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Expirada</span>;
}
