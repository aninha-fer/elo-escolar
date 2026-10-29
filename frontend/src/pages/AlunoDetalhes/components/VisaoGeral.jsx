import { DivInformacoes } from "../../../components/DivInformacoes";
import { CalendarioSemanal } from "../../../components/CalendarioSemanal";
import { formatarDataBR, formatarFrequencia, formatarTelefone, formatarTurno, formatarSimNao, formatarAutorizacaoAnalgesico } from "../../../utils/formatters";

function CampoInformacao({ titulo, valor }) {
    return (
        <div className="space-y-xs py-sm">
            <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{titulo}</dt>
            <dd className="whitespace-pre-wrap break-words text-sm text-text-main">{valor ?? 'Não informado'}</dd>
        </div>
    );
}

export function VisaoGeral({ dadosAluno, agenda, turmaRegular, dataReferencia, onSelecionarSemana, carregandoAgenda, erroAgenda }) {
    const responsaveis = dadosAluno?.responsaveis ?? [];
    const medicos = dadosAluno?.dados_medicos;
    const atividadeFisica = medicos?.autorizado_atividade_fisica;

    return (
        <div className="flex flex-col items-start gap-lg xl:flex-row">
            <div className="w-full shrink-0 space-y-lg xl:w-1/4">
                <DivInformacoes destaque={dadosAluno?.participa_procan && (
                    <span className="rounded-sm border border-amber-300 bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">Procan</span>
                )}>
                    <dl>
                        <CampoInformacao titulo="Período" valor={formatarTurno(dadosAluno?.turno)} />
                        <CampoInformacao titulo="Frequência" valor={formatarFrequencia(dadosAluno?.dias_frequencia)} />
                        <CampoInformacao titulo="Almoço" valor={formatarSimNao(dadosAluno?.participa_almoco)} />
                        <CampoInformacao titulo="Turma" valor={turmaRegular?.nome ?? 'Não informado'} />
                        <CampoInformacao titulo="Nascimento" valor={formatarDataBR(dadosAluno?.pessoa?.data_nascimento)} />
                        <CampoInformacao titulo="Telefone" valor={formatarTelefone(dadosAluno?.pessoa?.telefone)} />
                    </dl>
                    <div className="mt-sm border-t border-gray-200 pt-md">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Responsáveis ({responsaveis.length})</h4>
                        {responsaveis.length ? (
                            <ul className="space-y-sm pt-sm">
                                {responsaveis.map((responsavel) => (
                                    <li key={responsavel.id} className="break-words text-sm text-text-main">
                                        <p>{responsavel.nome}{responsavel.parentesco ? ` · ${responsavel.parentesco}` : ''}</p>
                                        <p className="mt-xs text-xs text-text-muted">{formatarTelefone(responsavel.telefone) ?? 'Telefone não informado'}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="pt-sm text-sm text-text-muted">Nenhum responsável cadastrado.</p>}
                    </div>
                    {dadosAluno?.observacoes && (
                        <dl className="mt-md border-t border-gray-200 pt-sm">
                            <CampoInformacao titulo="Observações" valor={dadosAluno.observacoes} />
                        </dl>
                    )}
                </DivInformacoes>
                <DivInformacoes titulo="Saúde e cuidados">
                    <dl>
                        <CampoInformacao titulo="Restrição alimentar" valor={medicos?.restricao_alimentar} />
                        <CampoInformacao titulo="Atividade física" valor={atividadeFisica == null ? 'Não informado' : atividadeFisica ? 'Autorizada' : 'Não autorizada'} />
                        <CampoInformacao titulo="Uso de medicamento" valor={medicos?.usa_medicamento === true
                            ? medicos.medicamentos_descricao : formatarSimNao(medicos?.usa_medicamento)} />
                        <CampoInformacao titulo="Em caso de dor" valor={formatarAutorizacaoAnalgesico(medicos?.autorizacao_analgesico)} />
                        <CampoInformacao titulo="Procan" valor={formatarSimNao(dadosAluno?.participa_procan)} />
                    </dl>
                </DivInformacoes>
            </div>
            <CalendarioSemanal agenda={agenda} dataReferencia={dataReferencia}
                onSelecionarSemana={onSelecionarSemana} carregando={carregandoAgenda} erro={erroAgenda} />
        </div>
    );
}
