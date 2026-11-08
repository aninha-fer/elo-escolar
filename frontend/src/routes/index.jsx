import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DefaultLayout } from '../layouts/DefaultLayout';
import { Home } from '../pages/Home';
import { Alunos } from '../pages/Alunos/Alunos';
import { Usuarios } from '../pages/Usuarios/Usuarios';
import { AlunoDetalhes } from '../pages/AlunoDetalhes';
import { Login } from '../pages/Login';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<DefaultLayout />}>
          <Route index element={<Home />} />
          <Route path="alunos" element={<Alunos />} />
          <Route path="alunos/:id" element={<AlunoDetalhes/>} />
          <Route path="usuarios" element={<Usuarios/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
