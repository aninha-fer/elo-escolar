export function sortearAlunosTurma(candidatos, bloqueados, capacidade, aleatorio = Math.random) {
    const elegiveis = new Set(candidatos.map((aluno) => aluno.id));
    const fixos = [...new Set(bloqueados)].filter((id) => elegiveis.has(id));
    if (!Number.isInteger(capacidade) || capacidade < 0 || fixos.length > capacidade) return null;
    const idsFixos = new Set(fixos);
    const disponiveis = candidatos.filter((aluno) => !idsFixos.has(aluno.id)).map((aluno) => aluno.id);
    for (let i = disponiveis.length - 1; i > 0; i--) {
        const indice = Math.floor(aleatorio() * (i + 1));
        [disponiveis[i], disponiveis[indice]] = [disponiveis[indice], disponiveis[i]];
    }
    return [...fixos, ...disponiveis.slice(0, capacidade - fixos.length)];
}
