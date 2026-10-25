import { Button } from "../../../components/Button"

export function Atendimentos() {

    return (
        <section className="overflow-hidden rounded-md border border-gray-300 bg-bg-surface">
            <header className="flex items-center justify-between gap-md border-b border-gray-300 px-lg py-md">
                <h2 className="text-base font-bold text-text-main">
                    Atendimentos Clínicos
                </h2>
                <Button onClick={() => {console.log('Abrir modal de novo atendimento')}}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M6.99365 2.914V11.0732" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M2.91406 6.99361H11.0733" stroke="white" strokeWidth="1.457" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Novo Atendimento
                </Button>
            </header>
        </section>
    )
}