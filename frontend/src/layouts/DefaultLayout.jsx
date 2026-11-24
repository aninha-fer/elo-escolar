import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export function DefaultLayout() {
  return (
    <div className="flex h-dvh flex-col bg-bg-main font-inter lg:h-auto lg:min-h-screen lg:flex-row">
        <Sidebar />
        <main data-scroll-listagem className="min-h-0 min-w-0 flex-1 overflow-y-auto p-md lg:h-screen lg:p-xxl">
            <Outlet />
        </main>
    </div>
  );
}
