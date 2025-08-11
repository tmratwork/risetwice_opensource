// /components/Login.tsx
import { useAuth } from '@/contexts/auth-context';
import { useRef, useState } from 'react';
import { Apple, Phone } from 'lucide-react';
import PhoneAuth from './PhoneAuth';

export default function Login() {
    const { signInWithGoogle, signInWithApple } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const googleButtonRef = useRef<HTMLButtonElement>(null);
    const appleButtonRef = useRef<HTMLButtonElement>(null);
    const [showPhoneAuth, setShowPhoneAuth] = useState(false);

    // Add unique ID to prevent any CSS conflicts
    const uniqueId = useRef(`login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    const handleGoogleClick = () => {
        signInWithGoogle();
    };

    const handleAppleClick = () => {
        signInWithApple();
    };

    const handlePhoneClick = () => {
        setShowPhoneAuth(true);
    };

    if (showPhoneAuth) {
        return <PhoneAuth onBack={() => setShowPhoneAuth(false)} />;
    }

    return (
        <div
            ref={containerRef}
            id={uniqueId.current}
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                isolation: 'isolate',
                position: 'relative',
                zIndex: 9999,
                backgroundColor: 'transparent'
            }}
        >
            <button
                ref={googleButtonRef}
                onClick={handleGoogleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontWeight: '500',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '16px',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 10000,
                    textDecoration: 'none',
                    outline: 'none',
                    transition: 'background-color 0.2s ease',
                    minWidth: '200px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                }}
            >
                <span style={{
                    fontWeight: '600',
                    fontSize: '18px',
                    marginRight: '8px'
                }}>
                    G
                </span>
                <span style={{
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                }}>
                    Sign in with Google
                </span>
            </button>

            <button
                ref={appleButtonRef}
                onClick={handleAppleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    border: 'none',
                    borderRadius: '8px',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    fontWeight: '500',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '16px',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 10000,
                    textDecoration: 'none',
                    outline: 'none',
                    transition: 'background-color 0.2s ease',
                    minWidth: '200px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#1f2937';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#000000';
                }}
            >
                <Apple style={{
                    width: '20px',
                    height: '20px',
                    marginRight: '8px'
                }} />
                <span style={{
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                }}>
                    Sign in with Apple
                </span>
            </button>

            <div style={{
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                maxWidth: '200px'
            }}>
                <div style={{
                    height: '1px',
                    backgroundColor: '#e5e7eb',
                    flex: 1
                }} />
                <span style={{
                    color: '#6b7280',
                    fontSize: '12px',
                    fontWeight: '500'
                }}>
                    OR
                </span>
                <div style={{
                    height: '1px',
                    backgroundColor: '#e5e7eb',
                    flex: 1
                }} />
            </div>

            <button
                onClick={handlePhoneClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 24px',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#1f2937',
                    fontWeight: '500',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '16px',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 10000,
                    textDecoration: 'none',
                    outline: 'none',
                    transition: 'background-color 0.2s ease',
                    minWidth: '200px'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                }}
            >
                <Phone style={{
                    width: '20px',
                    height: '20px',
                    marginRight: '8px'
                }} />
                <span style={{
                    whiteSpace: 'nowrap',
                    userSelect: 'none'
                }}>
                    Sign in with Phone
                </span>
            </button>
        </div>
    );
}