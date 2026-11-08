import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DefaultLayout } from '../layouts/DefaultLayout';
import { Home } from '../pages/Home';
import { Alunos } from '../pages/Alunos/Alunos';
import { Usuarios } from '../pages/Usuarios/Usuarios';
import { AlunoDetalhes } from '../pages/AlunoDetalhes';
import { Login } from '../pages/Login';

function ExigirSessao() {
  const { status, recarregarSessao } = useAuth();

  if (status === 'carregando') {
    return <p role="status">Verificando sessão…</p>;
  }
  if (status === 'anonimo') {
    return <Navigate to="/login" replace />;
  }
  if (status === 'acesso-negado') {
    return <p role="alert">Acesso negado.</p>;
  }
  if (status === 'autenticado') {
    return <Outlet />;
  }

  return (
    <main>
      <p role="alert">Não foi possível verificar sua sessão.</p>
      <button type="button" onClick={recarregarSessao}>
        Tentar novamente
      </button>
    </main>
  );
}

function ExigirAdmin() {
  const { usuario } = useAuth();

  return usuario?.role === 'admin'
    ? <Outlet />
    : <p role="alert">Você não tem acesso à tela de Usuários.</p>;
}

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ExigirSessao />}>
          <Route path="/" element={<DefaultLayout />}>
            <Route index element={<Home />} />
            <Route path="alunos" element={<Alunos />} />
            <Route path="alunos/:id" element={<AlunoDetalhes />} />

            <Route element={<ExigirAdmin />}>
              <Route path="usuarios" element={<Usuarios />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
