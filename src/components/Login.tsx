// /components/Login.tsx
import { useAuth } from '@/contexts/auth-context';
import { useRef } from 'react';
import { Apple } from 'lucide-react';

export default function Login() {
    const { signInWithGoogle, signInWithApple } = useAuth();
    const containerRef = useRef<HTMLDivElement>(null);
    const googleButtonRef = useRef<HTMLButtonElement>(null);
    const appleButtonRef = useRef<HTMLButtonElement>(null);

    // Add unique ID to prevent any CSS conflicts
    const uniqueId = useRef(`login-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    const handleGoogleClick = () => {
        signInWithGoogle();
    };

    const handleAppleClick = () => {
        signInWithApple();
    };

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
        </div>
    );
}