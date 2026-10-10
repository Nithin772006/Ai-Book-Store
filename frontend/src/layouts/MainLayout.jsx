import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function MainLayout() {
  return (
    <div className="store-layout">
      <Navbar />
      <main className="store-main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
