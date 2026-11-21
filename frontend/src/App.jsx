import { AppRoutes } from "./routes"
import { AuthProvider } from './contexts/AuthProvider';
import { ToastProvider } from './contexts/ToastProvider';

function App() {

  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  )
}

export default App
