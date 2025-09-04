import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { ConfirmationResult } from 'firebase/auth';
import { Phone, ArrowLeft, ChevronDown } from 'lucide-react';

interface PhoneAuthProps {
    onBack?: () => void;
    onSignedIn?: () => void;
}

interface CountryCode {
    name: string;
    code: string;
    flag: string;
}

const SUPPORTED_COUNTRIES: CountryCode[] = [
    { name: 'United States', code: '+1', flag: '🇺🇸' },
    { name: 'Canada', code: '+1', flag: '🇨🇦' },
];

const ALL_COUNTRIES: CountryCode[] = [
    { name: 'United States', code: '+1', flag: '🇺🇸' },
    { name: 'Canada', code: '+1', flag: '🇨🇦' },
    { name: 'United Kingdom', code: '+44', flag: '🇬🇧' },
    { name: 'Australia', code: '+61', flag: '🇦🇺' },
    { name: 'Germany', code: '+49', flag: '🇩🇪' },
    { name: 'France', code: '+33', flag: '🇫🇷' },
    { name: 'India', code: '+91', flag: '🇮🇳' },
    { name: 'Japan', code: '+81', flag: '🇯🇵' },
    { name: 'China', code: '+86', flag: '🇨🇳' },
    { name: 'Brazil', code: '+55', flag: '🇧🇷' },
    { name: 'Mexico', code: '+52', flag: '🇲🇽' },
    { name: 'Spain', code: '+34', flag: '🇪🇸' },
    { name: 'Italy', code: '+39', flag: '🇮🇹' },
    { name: 'Netherlands', code: '+31', flag: '🇳🇱' },
    { name: 'South Korea', code: '+82', flag: '🇰🇷' },
];

export default function PhoneAuth({ onBack, onSignedIn }: PhoneAuthProps) {
    const { signInWithPhone, verifyPhoneCode, setupRecaptcha } = useAuth();
    const [selectedCountry, setSelectedCountry] = useState<CountryCode>(SUPPORTED_COUNTRIES[0]);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);

    useEffect(() => {
        // Setup invisible recaptcha on component mount with a delay to ensure DOM is ready
        // Longer delay for mobile devices to allow proper rendering
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const delay = isMobile ? 500 : 100;
        
        const timer = setTimeout(() => {
            // Double-check element exists before setup
            const element = document.getElementById('recaptcha-container');
            if (element) {
                setupRecaptcha('recaptcha-container');
            } else {
                console.warn('[PhoneAuth] reCAPTCHA container not found, retrying...');
                // Retry once more after additional delay
                setTimeout(() => {
                    setupRecaptcha('recaptcha-container');
                }, delay);
            }
        }, delay);
        
        return () => clearTimeout(timer);
    }, [setupRecaptcha]);

    useEffect(() => {
        // Close dropdown when clicking outside
        const handleClickOutside = (e: MouseEvent) => {
            if (showCountryDropdown) {
                const target = e.target as HTMLElement;
                if (!target.closest('[data-country-dropdown]')) {
                    setShowCountryDropdown(false);
                }
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCountryDropdown]);

    const isCountrySupported = (country: CountryCode) => {
        return SUPPORTED_COUNTRIES.some(c => c.name === country.name);
    };

    const handleCountrySelect = (country: CountryCode) => {
        setSelectedCountry(country);
        setShowCountryDropdown(false);
        
        // Clear any existing error when selecting a new country
        if (isCountrySupported(country)) {
            setError('');
        } else {
            setError(`Phone verification is currently only available in the United States and Canada. We apologize for the inconvenience.`);
        }
    };

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        // Check if country is supported
        if (!isCountrySupported(selectedCountry)) {
            setError('Phone verification is currently only available in the United States and Canada.');
            return;
        }

        setLoading(true);

        // Clean the phone number - remove all non-digits
        const cleanedNumber = phoneNumber.replace(/\D/g, '');
        
        // Basic phone number validation (10 digits for US/Canada)
        if (cleanedNumber.length !== 10) {
            setError('Please enter a valid 10-digit phone number');
            setLoading(false);
            return;
        }

        // Combine country code with phone number
        const fullPhoneNumber = `${selectedCountry.code}${cleanedNumber}`;
        console.log('[PhoneAuth] Sending verification to:', fullPhoneNumber);

        try {
            const result = await signInWithPhone(fullPhoneNumber);
            if (result) {
                setConfirmationResult(result);
                setCodeSent(true);
            } else {
                setError('Failed to send verification code. Please try again.');
            }
        } catch (err) {
            // Handle specific Firebase errors
            const error = err as { code?: string; message?: string };
            if (error?.code === 'auth/invalid-phone-number') {
                setError('Invalid phone number format. Please check and try again.');
            } else if (error?.code === 'auth/missing-phone-number') {
                setError('Phone number is required.');
            } else if (error?.code === 'auth/quota-exceeded') {
                setError('Too many requests. Please try again later.');
            } else if (error?.code === 'auth/user-disabled') {
                setError('This phone number has been disabled.');
            } else {
                setError('Error sending verification code. Please try again.');
            }
            console.error('Phone auth error:', error);
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
            // Add a small delay to ensure auth state has time to update
            setTimeout(() => {
                onSignedIn?.();
            }, 100);
        } catch (err) {
            setError('Invalid verification code. Please try again.');
            console.error('Verification error:', err);
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Don't try to clear recaptcha on unmount to avoid errors
            setConfirmationResult(null);
        };
    }, []);

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
            {/* Hidden recaptcha container with mobile-safe styling */}
            <div 
                id="recaptcha-container" 
                style={{
                    display: 'none',
                    position: 'absolute',
                    top: '-9999px',
                    left: '-9999px',
                    width: '1px',
                    height: '1px',
                    overflow: 'hidden',
                    visibility: 'hidden'
                }}
            ></div>

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
                        <div style={{
                            display: 'flex',
                            gap: '8px'
                        }}>
                            {/* Country Code Dropdown */}
                            <div style={{ position: 'relative' }} data-country-dropdown>
                                <button
                                    type="button"
                                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                    disabled={loading}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        fontSize: '16px',
                                        backgroundColor: loading ? '#f9fafb' : '#ffffff',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        minWidth: '100px'
                                    }}
                                >
                                    <span>{selectedCountry.flag}</span>
                                    <span>{selectedCountry.code}</span>
                                    <ChevronDown size={16} />
                                </button>
                                
                                {showCountryDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '4px',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                        zIndex: 100,
                                        minWidth: '200px',
                                        maxHeight: '300px',
                                        overflowY: 'auto'
                                    }}>
                                        {ALL_COUNTRIES.map((country) => (
                                            <button
                                                key={country.name}
                                                type="button"
                                                onClick={() => handleCountrySelect(country)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    border: 'none',
                                                    backgroundColor: 'transparent',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    textAlign: 'left',
                                                    color: isCountrySupported(country) ? '#1f2937' : '#9ca3af'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.backgroundColor = 'transparent';
                                                }}
                                            >
                                                <span>{country.flag}</span>
                                                <span>{country.name}</span>
                                                <span style={{ marginLeft: 'auto', color: '#6b7280' }}>
                                                    {country.code}
                                                </span>
                                                {!isCountrySupported(country) && (
                                                    <span style={{
                                                        fontSize: '10px',
                                                        color: '#ef4444',
                                                        marginLeft: '4px'
                                                    }}>
                                                        Not available
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Phone Number Input */}
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => {
                                    // Allow numbers, spaces, dashes, and parentheses for formatting
                                    const value = e.target.value;
                                    // Only allow valid phone number characters
                                    if (/^[\d\s\-()]*$/.test(value)) {
                                        setPhoneNumber(value);
                                    }
                                }}
                                placeholder="(555) 123-4567"
                                required
                                disabled={loading || !isCountrySupported(selectedCountry)}
                                style={{
                                    flex: 1,
                                    padding: '12px 16px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    backgroundColor: loading || !isCountrySupported(selectedCountry) ? '#f9fafb' : '#ffffff',
                                    cursor: !isCountrySupported(selectedCountry) ? 'not-allowed' : 'text'
                                }}
                                onFocus={(e) => {
                                    if (isCountrySupported(selectedCountry)) {
                                        e.target.style.borderColor = '#3b82f6';
                                    }
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#d1d5db';
                                }}
                            />
                        </div>
                        <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                        }}>
                            Enter your 10-digit phone number
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
                        disabled={loading || !phoneNumber || !isCountrySupported(selectedCountry)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            borderRadius: '8px',
                            backgroundColor: loading || !phoneNumber || !isCountrySupported(selectedCountry) ? '#e5e7eb' : '#3b82f6',
                            color: '#ffffff',
                            fontSize: '16px',
                            fontWeight: '500',
                            cursor: loading || !phoneNumber || !isCountrySupported(selectedCountry) ? 'not-allowed' : 'pointer',
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
                        Verification code sent to {selectedCountry.code} {phoneNumber}
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