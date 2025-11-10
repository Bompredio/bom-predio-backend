import React from 'react';
import { Link } from 'react-router-dom';
import { colors, font } from '../styles';

export default function Home() {
  return (
    <div style={{ fontFamily: font.family, padding: 40, background: colors.background, minHeight: '100vh' }}>
      <div style={{
        maxWidth: 980,
        margin: '0 auto',
        background: '#fff',
        padding: 30,
        borderRadius: 10,
        boxShadow: '0 6px 18px rgba(0,0,0,0.08)'
      }}>
        <h1 style={{ color: colors.primary, marginBottom: 8 }}>Bom Prédio</h1>
        <p style={{ color: colors.secondaryText, lineHeight: 1.6 }}>
          Transparência, tecnologia e eficiência na gestão condominial.
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <Link to="/login" style={{
            backgroundColor: colors.primary,
            color: '#fff',
            padding: '10px 18px',
            borderRadius: 8,
            textDecoration: 'none',
            fontWeight: 600
          }}>Entrar</Link>

          <Link to="/sobre" style={{
            background: 'transparent',
            color: colors.primary,
            padding: '10px 18px',
            borderRadius: 8,
            textDecoration: 'none',
            border: `1px solid ${colors.primary}`,
            fontWeight: 600
          }}>Saiba mais</Link>
        </div>
      </div>
    </div>
  );
}
