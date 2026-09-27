import apaeLogo from '../assets/apae.png'
import { NavLink } from 'react-router-dom';

function Sidebar() {
    const botaoBase = 'rounded-sm flex items-center gap-sm p-sm font-inter text-[14px] [&_path]:stroke-current [&_path]:[stroke-opacity:1] ';
    const botaoVariantes = {
        normal: 'text-white/58 [&_svg]:text-white hover:bg-secondary/20 hover:border-l-secondary hover:border-l-[2px]',
        clicado: 'text-secondary [&_svg]:text-secondary bg-secondary/20 font-bold border-l-secondary border-l-[2px]',
    };

    return (
        <div className="bg-primary w-[250px] min-h-screen flex flex-col pt-md font-inter">
            <div className="flex items-center gap-md border-b-bg-main/35 border-b-[2px] pb-md w-full px-md">
                <img src={apaeLogo} alt="Logo APAE" className="w-[40px] h-[40px]" />
                <div>
                    <h2 className="text-secondary font-bold text-base"> Elo Escolar</h2>
                    <p className="text-sm text-bg-main/35 tracking-widest">APAE - Gestão</p>
                </div>
            </div>
            <div className="flex flex-col gap-md px-md py-md">
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) => `${botaoBase} ${isActive ? botaoVariantes.clicado : botaoVariantes.normal}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 15 15" fill="none">
                        <path d="M1.87207 5.61618L7.48826 1.24804L13.1044 5.61618V12.4804C13.1044 12.8114 12.973 13.1289 12.7389 13.3629C12.5048 13.597 12.1874 13.7285 11.8564 13.7285H3.12011C2.78911 13.7285 2.47167 13.597 2.23761 13.3629C2.00356 13.1289 1.87207 12.8114 1.87207 12.4804V5.61618Z" stroke="#69A5FA" strokeOpacity="1" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5.61621 13.7285V7.48825H9.36034V13.7285" stroke="#69A5FA" strokeOpacity="1" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Início</span>
                </NavLink>
                <NavLink
                    to="/alunos"
                    className={({ isActive }) => `${botaoBase} ${isActive ? botaoVariantes.clicado : botaoVariantes.normal}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 15 15" fill="none">
                        <g clipPath="url(#clip0_2001_1256)">
                            <path d="M1.24805 1.87206H4.99217C5.65417 1.87206 6.28906 2.13503 6.75717 2.60314C7.22528 3.07125 7.48826 3.70614 7.48826 4.36814V13.1044C7.48826 12.6079 7.29102 12.1318 6.93994 11.7807C6.58886 11.4296 6.11269 11.2324 5.61619 11.2324H1.24805V1.87206Z" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M13.7285 1.87206H9.98436C9.32236 1.87206 8.68747 2.13503 8.21937 2.60314C7.75126 3.07125 7.48828 3.70614 7.48828 4.36814V13.1044C7.48828 12.6079 7.68552 12.1318 8.0366 11.7807C8.38768 11.4296 8.86384 11.2324 9.36034 11.2324H13.7285V1.87206Z" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <defs>
                            <clipPath id="clip0_2001_1256">
                                <rect width="14.9765" height="14.9765" fill="white" />
                            </clipPath>
                        </defs>
                    </svg>
                    <span>Alunos</span>
                </NavLink>
                <button className={`${botaoBase} ${botaoVariantes.normal}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 15 15" fill="none">
                        <g clipPath="url(#clip0_2001_1262)">
                            <path d="M7.48826 1.24805L1.24805 4.36815L7.48826 7.48826L13.7285 4.36815L7.48826 1.24805Z" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M1.24805 10.6084L7.48826 13.7285L13.7285 10.6084" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M1.24805 7.48825L7.48826 10.6084L13.7285 7.48825" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <defs>
                            <clipPath id="clip0_2001_1262">
                                <rect width="14.9765" height="14.9765" fill="white" />
                            </clipPath>
                        </defs>
                    </svg>
                    <a href="/">Turmas</a>
                </button>
                <button className={`${botaoBase} ${botaoVariantes.normal}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 15 15" fill="none">
                        <g clipPath="url(#clip0_2001_884)">
                            <path d="M10.6084 13.1044V11.8564C10.6084 11.1944 10.3454 10.5595 9.87727 10.0914C9.40916 9.62329 8.77428 9.36031 8.11227 9.36031H3.12011C2.4581 9.36031 1.82322 9.62329 1.35511 10.0914C0.887003 10.5595 0.624023 11.1944 0.624023 11.8564V13.1044" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5.6162 6.86424C6.99475 6.86424 8.11228 5.7467 8.11228 4.36815C8.11228 2.9896 6.99475 1.87207 5.6162 1.87207C4.23765 1.87207 3.12012 2.9896 3.12012 4.36815C3.12012 5.7467 4.23765 6.86424 5.6162 6.86424Z" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14.3525 13.1044V11.8564C14.3521 11.3033 14.168 10.7661 13.8292 10.329C13.4904 9.89189 13.016 9.5797 12.4805 9.44144" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9.98438 1.95319C10.5213 2.09066 10.9972 2.40292 11.337 2.84074C11.6769 3.27856 11.8613 3.81703 11.8613 4.37127C11.8613 4.9255 11.6769 5.46398 11.337 5.9018C10.9972 6.33961 10.5213 6.65187 9.98438 6.78935" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <defs>
                            <clipPath id="clip0_2001_884">
                                <rect width="14.9765" height="14.9765" fill="white" />
                            </clipPath>
                        </defs>
                    </svg>
                    <a href="/">Profissionais</a>
                </button>
                <button className={`${botaoBase} ${botaoVariantes.normal}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 15 15" fill="none">
                        <g clipPath="url(#clip0_2001_884)">
                            <path d="M10.6084 13.1044V11.8564C10.6084 11.1944 10.3454 10.5595 9.87727 10.0914C9.40916 9.62329 8.77428 9.36031 8.11227 9.36031H3.12011C2.4581 9.36031 1.82322 9.62329 1.35511 10.0914C0.887003 10.5595 0.624023 11.1944 0.624023 11.8564V13.1044" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M5.6162 6.86424C6.99475 6.86424 8.11228 5.7467 8.11228 4.36815C8.11228 2.9896 6.99475 1.87207 5.6162 1.87207C4.23765 1.87207 3.12012 2.9896 3.12012 4.36815C3.12012 5.7467 4.23765 6.86424 5.6162 6.86424Z" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14.3525 13.1044V11.8564C14.3521 11.3033 14.168 10.7661 13.8292 10.329C13.4904 9.89189 13.016 9.5797 12.4805 9.44144" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9.98438 1.95319C10.5213 2.09066 10.9972 2.40292 11.337 2.84074C11.6769 3.27856 11.8613 3.81703 11.8613 4.37127C11.8613 4.9255 11.6769 5.46398 11.337 5.9018C10.9972 6.33961 10.5213 6.65187 9.98438 6.78935" stroke="white" strokeOpacity="0.58" strokeWidth="1.24804" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <defs>
                            <clipPath id="clip0_2001_884">
                                <rect width="14.9765" height="14.9765" fill="white" />
                            </clipPath>
                        </defs>
                    </svg>
                    <a href="/">Usuários</a>
                </button>
            </div>
            <div className='flex items-center gap-md p-md mt-auto'>
                <div className='w-10 h-10 bg-tertiary rounded-full flex items-center justify-center font-bold text-white'>S</div>
                <div>
                    <p className='font-bold text-bg-main/80 text-sm'>User name</p>
                    <p className='font-bold text-bg-main/35 text-xs tracking-widest'>User role</p>
                </div>
            </div>
        </div>
    )
}

export default Sidebar