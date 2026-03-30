import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from './components/ui/sonner';

import Navbar from './components/Navbar';
import AuthCallback from './components/AuthCallback';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Login from './pages/Login';
import SelectRole from './pages/SelectRole';
import Walkers from './pages/Walkers';
import WalkerProfile from './pages/WalkerProfile';
import CreateWalkRequest from './pages/CreateWalkRequest';
import MyWalks from './pages/MyWalks';
import WalkerRequests from './pages/WalkerRequests';
import CreateWalkerProfile from './pages/CreateWalkerProfile';
import Account from './pages/Account';
import MyPets from './pages/MyPets';
import PetForm from './pages/PetForm';
import WalkLiveMap from './pages/WalkLiveMap';
import WalkSummary from './pages/WalkSummary';
import { isOAuthReturnUrl } from './utils/authRedirect';

function AppRouter() {
  const location = useLocation();

  if (isOAuthReturnUrl(location)) {
    return <AuthCallback />;
  }

  const showNavbar = !['/login', '/auth/callback', '/auth', '/select-role'].includes(
    location.pathname
  );

  return (
    <>
      {showNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth" element={<AuthCallback />} />
        <Route
          path="/select-role"
          element={
            <ProtectedRoute>
              <SelectRole />
            </ProtectedRoute>
          }
        />
        <Route path="/walkers" element={<Walkers />} />
        <Route path="/walkers/:id" element={<WalkerProfile />} />
        <Route
          path="/walks/new"
          element={
            <ProtectedRoute requireRole="OWNER">
              <CreateWalkRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/walks"
          element={
            <ProtectedRoute requireRole="OWNER">
              <MyWalks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/walker/requests"
          element={
            <ProtectedRoute requireRole="WALKER">
              <WalkerRequests />
            </ProtectedRoute>
          }
        />
        <Route
          path="/walker/profile/create"
          element={
            <ProtectedRoute requireRole="WALKER">
              <CreateWalkerProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/walker/profile/edit"
          element={
            <ProtectedRoute requireRole="WALKER">
              <CreateWalkerProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/account"
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/pets"
          element={
            <ProtectedRoute requireRole="OWNER">
              <MyPets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/pets/new"
          element={
            <ProtectedRoute requireRole="OWNER">
              <PetForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/pets/:petId/edit"
          element={
            <ProtectedRoute requireRole="OWNER">
              <PetForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/walks/:walkId/live"
          element={
            <ProtectedRoute>
              <WalkLiveMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/walks/:walkId/summary"
          element={
            <ProtectedRoute>
              <WalkSummary />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </div>
    </AuthProvider>
  );
}

export default App;
