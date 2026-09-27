import { DivInformacoes } from "../../../components/DivInformacoes";
import { CalendarioSemanal } from "../../../components/CalendarioSemanal";

const estilos = {
    titulo: 'text-xs font-semibold uppercase tracking-wider text-slate-500',
    dado: 'text-[14px] text-text-main font-semibold',
    bloco: 'flex flex-col gap-xs py-sm'
};


export function VisaoGeral({ dadosAluno, agenda }) {
    return(
        <div className="flex gap-lg">
            <DivInformacoes>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        PERÍODO
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.turno ?? 'Turno'}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        FREQUÊNCIA
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.dias_frequencia ?? 'Frequência'}
                    </p>
                </div>                
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        ALMOÇO
                    </label>
                    <p className={estilos.dado}>
                        nao sei
                        {/* {dadosAluno?.participa_almoco ?? 'Almoço'} */}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        TURMA
                    </label>
                    <p className={estilos.dado}>
                        Turma tal
                        {/* {dadosAluno?.participa_almoco ?? 'Almoço'} */}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        NASCIMENTO
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.pessoa?.data_nascimento ?? 'Data Nascimento'}
                    </p>
                </div>
                <div className={estilos.bloco}>
                    <label className={estilos.titulo}>
                        TELEFONE
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.pessoa?.telefone ?? 'Telefone'}
                    </p>
                </div>
                <div className={`${estilos.bloco} border-gray-300 border-t-[2px] w-full mt-sm pt-md`}>
                    <label className={estilos.titulo}>
                        RESPONSÁVEL
                    </label>
                    <p className={estilos.dado}>
                        {dadosAluno?.nome_responsavel ?? 'Nome responsável'}
                        <p className="text-[12px] tracking-wider text-text-muted">
                            {dadosAluno?.telefone_responsavel ?? 'Telefone não Informado'}
                        </p>
                    </p>
                </div>
            </DivInformacoes>
            <CalendarioSemanal agenda={agenda} />
        </div>
    )
}