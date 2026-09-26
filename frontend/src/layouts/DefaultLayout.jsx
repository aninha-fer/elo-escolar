import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export function DefaultLayout() {
  return (
    <div className="flex min-h-screen bg-gray-50 font-inter">
        <Sidebar />
        <main className="flex-1 h-screen overflow-y-auto p-8">
            <Outlet />
        </main>
    </div>
  );
}