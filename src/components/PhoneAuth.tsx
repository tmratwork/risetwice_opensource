import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ConfirmationResult } from 'firebase/auth';
import { Phone, ArrowLeft } from 'lucide-react';

interface PhoneAuthProps {
    onBack?: () => void;
}

export default function PhoneAuth({ onBack }: PhoneAuthProps) {
    const { signInWithPhone, verifyPhoneCode, setupRecaptcha } = useAuth();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [codeSent, setCodeSent] = useState(false);

    useEffect(() => {
        // Setup invisible recaptcha on component mount
        setupRecaptcha('recaptcha-container');
    }, [setupRecaptcha]);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Basic phone number validation
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber.replace(/\s/g, ''))) {
            setError('Please enter a valid phone number with country code (e.g., +1234567890)');
            setLoading(false);
            return;
        }

        try {
            const result = await signInWithPhone(phoneNumber);
            if (result) {
                setConfirmationResult(result);
                setCodeSent(true);
            } else {
                setError('Failed to send verification code. Please try again.');
            }
        } catch (err) {
            setError('Error sending verification code. Please check your phone number.');
            console.error('Phone auth error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!confirmationResult) {
            setError('No verification in progress');
            setLoading(false);
            return;
        }

        if (verificationCode.length !== 6) {
            setError('Please enter a valid 6-digit code');
            setLoading(false);
            return;
        }

        try {
            await verifyPhoneCode(confirmationResult, verificationCode);
            // User will be automatically signed in after successful verification
        } catch (err) {
            setError('Invalid verification code. Please try again.');
            console.error('Verification error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setCodeSent(false);
        setConfirmationResult(null);
        setVerificationCode('');
        setError('');
        setPhoneNumber('');
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            maxWidth: '400px',
            margin: '0 auto'
        }}>
            {/* Hidden recaptcha container */}
            <div id="recaptcha-container"></div>

            {onBack && (
                <button
                    onClick={onBack}
                    style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        border: 'none',
                        background: 'none',
                        color: '#6b7280',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: '500'
                    }}
                >
                    <ArrowLeft size={16} />
                    Back to login options
                </button>
            )}

            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
            }}>
                <Phone size={24} />
                <h2 style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0
                }}>Phone Sign In</h2>
            </div>

            {!codeSent ? (
                <form onSubmit={handleSendCode} style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Phone Number
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+1234567890"
                            required
                            disabled={loading}
                            style={{
                                padding: '12px 16px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '16px',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                backgroundColor: loading ? '#f9fafb' : '#ffffff'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#d1d5db';
                            }}
                        />
                        <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                        }}>
                            Include country code (e.g., +1 for USA)
                        </span>
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#dc2626',
                            fontSize: '14px'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !phoneNumber}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor: loading || !phoneNumber ? '#e5e7eb' : '#3b82f6',
                            color: '#ffffff',
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: loading || !phoneNumber ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {loading ? 'Sending...' : 'Send Verification Code'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyCode} style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                }}>
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        fontSize: '14px',
                        color: '#1e40af'
                    }}>
                        Verification code sent to {phoneNumber}
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <label style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#374151'
                        }}>
                            Verification Code
                        </label>
                        <input
                            type="text"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="123456"
                            required
                            disabled={loading}
                            maxLength={6}
                            style={{
                                padding: '12px 16px',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '20px',
                                letterSpacing: '4px',
                                textAlign: 'center',
                                outline: 'none',
                                transition: 'border-color 0.2s',
                                backgroundColor: loading ? '#f9fafb' : '#ffffff'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#3b82f6';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#d1d5db';
                            }}
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '12px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            color: '#dc2626',
                            fontSize: '14px'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || verificationCode.length !== 6}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor: loading || verificationCode.length !== 6 ? '#e5e7eb' : '#10b981',
                            color: '#ffffff',
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: loading || verificationCode.length !== 6 ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s'
                        }}
                    >
                        {loading ? 'Verifying...' : 'Verify Code'}
                    </button>

                    <button
                        type="button"
                        onClick={handleReset}
                        disabled={loading}
                        style={{
                            padding: '8px 16px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            backgroundColor: '#ffffff',
                            color: '#6b7280',
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        Try Different Number
                    </button>
                </form>
            )}
        </div>
    );
}