import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DefaultLayout } from '../layouts/DefaultLayout';
import { Home } from '../pages/Home';
import { Alunos } from '../pages/Alunos';
import { AlunoDetalhes } from '../pages/AlunoDetalhes';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultLayout />}>
          <Route index element={<Home />} />
          <Route path="alunos" element={<Alunos />} />
          <Route path="alunos/:id" element={<AlunoDetalhes/>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}