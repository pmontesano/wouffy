import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, User, LogOut, Home, MapPin, Calendar, UserCircle } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="glass-card sticky top-0 z-50 border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-[#88D8B0] rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">W</span>
            </div>
            <span className="text-2xl font-bold text-[#1F2937]" style={{ fontFamily: 'Outfit' }}>
              Wouffy
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <>
                {user.role === 'OWNER' && (
                  <>
                    <Link
                      to="/walkers"
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
                        isActive('/walkers')
                          ? 'bg-[#88D8B0] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      data-testid="nav-walkers-link"
                    >
                      <MapPin size={18} />
                      <span>Buscar Paseadores</span>
                    </Link>
                    <Link
                      to="/me/walks"
                      className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
                        isActive('/me/walks')
                          ? 'bg-[#88D8B0] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      data-testid="nav-my-walks-link"
                    >
                      <Calendar size={18} />
                      <span>Mis Solicitudes</span>
                    </Link>
                  </>
                )}
                {user.role === 'WALKER' && (
                  <Link
                    to="/walker/requests"
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
                      isActive('/walker/requests')
                        ? 'bg-[#88D8B0] text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    data-testid="nav-walker-requests-link"
                  >
                    <Calendar size={18} />
                    <span>Solicitudes</span>
                  </Link>
                )}
                <Link
                  to="/app/account"
                  className={`flex items-center space-x-2 px-4 py-2 rounded-full transition-all ${
                    isActive('/app/account') || location.pathname.startsWith('/app/')
                      ? 'bg-[#88D8B0] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  data-testid="nav-account-link"
                >
                  <UserCircle size={18} />
                  <span>Mi Cuenta</span>
                </Link>
                <div className="flex items-center space-x-3">
                  {user.picture && (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border-2 border-[#88D8B0]"
                    />
                  )}
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                  <button
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-red-600 transition-colors"
                    data-testid="logout-button"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </>
            ) : (
              <Link
                to="/login"
                className="btn-primary"
                data-testid="nav-login-link"
              >
                Iniciar Sesión
              </Link>
            )}
          </div>

          <button
            className="md:hidden text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-button"
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t" data-testid="mobile-menu">
          <div className="px-4 py-3 space-y-3">
            {user ? (
              <>
                {user.role === 'OWNER' && (
                  <>
                    <Link
                      to="/walkers"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Buscar Paseadores
                    </Link>
                    <Link
                      to="/me/walks"
                      className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Mis Solicitudes
                    </Link>
                  </>
                )}
                {user.role === 'WALKER' && (
                  <Link
                    to="/walker/requests"
                    className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Solicitudes
                  </Link>
                )}
                <Link
                  to="/app/account"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Mi Cuenta
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 rounded-lg"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                onClick={() => setMobileMenuOpen(false)}
              >
                Iniciar Sesión
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}