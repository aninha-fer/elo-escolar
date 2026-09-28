import { DivInformacoes } from "../../../components/DivInformacoes";
import { CalendarioSemanal } from "../../../components/CalendarioSemanal";
import { formatarDataBR, formatarFrequencia, formatarTelefone, formatarTurno } from "../../../utils/formatters";

const estilos = {
    titulo: 'text-xs font-semibold uppercase tracking-wider text-slate-500',
    dado: 'text-[14px] text-text-main font-semibold',
    bloco: 'flex flex-col gap-xs py-sm'
};

export function VisaoGeral({ dadosAluno, agenda, turmaRegular }) {
    return (
        <div className="flex gap-lg">
            <DivInformacoes>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        PERÍODO
                    </label>
                    <p className={estilos.dado}>
                        {formatarTurno(dadosAluno?.turno ?? 'Turno')}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        FREQUÊNCIA
                    </label>
                    <p className={estilos.dado}>
                        {formatarFrequencia(dadosAluno?.dias_frequencia) ?? 'Frequência'}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        ALMOÇO
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.participa_almoco ? 'Sim' : 'Não'
                            ?? 'Almoço'}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        TURMA
                    </label>
                    <p className={estilos.dado}>
                        {turmaRegular?.turma_nome ?? 'Turma'}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        NASCIMENTO
                    </label>
                    <p className={estilos.dado}>
                        {formatarDataBR(dadosAluno?.pessoa?.data_nascimento ?? 'Data Nascimento')}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        TELEFONE
                    </label>
                    <p className={estilos.dado}>
                        {formatarTelefone(dadosAluno?.pessoa?.telefone) ?? 'Telefone não Informado'}
                    </p>
                </div>
                <div className={`${estilos.bloco} border-gray-300 border-t-[2px] w-full mt-sm pt-md`}>
                    <label className={estilos.titulo}>
                        RESPONSÁVEL
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.nome_responsavel ?? 'Nome responsável'}
                        <p className="text-[12px] tracking-wider text-text-muted">
                            {formatarTelefone(dadosAluno?.telefone_responsavel) ?? 'Telefone não Informado'}
                        </p>
                    </p>
                </div>
            </DivInformacoes>
            <CalendarioSemanal agenda={agenda} />
        </div>
    )
}