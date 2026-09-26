import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DefaultLayout } from '../layouts/DefaultLayout';
import { Home } from '../pages/Home';
import { Alunos } from '../pages/Alunos';

export function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DefaultLayout />}>
          <Route index element={<Home />} />
          <Route path="alunos" element={<Alunos />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}