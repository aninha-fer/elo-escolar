export function DivInformacoes({ children }) {
    return(
        <div className="flex justify-center flex-col bg-bg-surface border border-gray-300 rounded-md h-full p-md w-[25%]">
            <div className="border-gray-300 border-b-[2px] w-full py-sm mb-md">
                <h3 className="font-bold text-[16px]">Informações</h3>
            </div>
            {children}
        </div>
    )
}