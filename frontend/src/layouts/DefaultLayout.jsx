import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export function DefaultLayout() {
  return (
    <div className="flex min-h-screen bg-bg-main font-inter">
        <Sidebar />
        <main className="min-w-0 flex-1 h-screen overflow-y-auto p-md lg:p-xxl">
            <Outlet />
        </main>
    </div>
  );
}
