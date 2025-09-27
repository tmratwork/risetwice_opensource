// src/components/Header.tsx

'use client';
import { useAuth } from '@/contexts/auth-context';
import { LogOut, Apple, Settings, Fingerprint, User, Languages, Trophy, Send, Phone, Flag } from 'lucide-react';
import { ErrorBoundary } from 'react-error-boundary';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/theme-context';
import Link from 'next/link';
import SmartSendDialog from './SmartSendDialog';
import DisplayNameDialog from './DisplayNameDialog';
import ContributorsModal from './ContributorsModal';
import PhoneAuth from './PhoneAuth';
import BugReportModal from './BugReportModal';
import { createPortal } from 'react-dom';
import {
  SUPPORTED_LANGUAGES,
  getStoredLanguagePreference,
  setStoredLanguagePreference,
  getLanguageByCode
} from '@/lib/language-utils';

interface DropdownPortalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}

function DropdownPortal({ isOpen, onClose, triggerRef, children }: DropdownPortalProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.right - 192,
      });
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOutsideTrigger && isOutsideDropdown) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div 
      ref={dropdownRef}
      className="fixed w-48 bg-sage-200 dark:bg-gray-800 border border-sage-400 dark:border-gray-700 rounded-md shadow-lg z-[9999]"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}

function LanguageDropdownPortal({ isOpen, onClose, triggerRef, children }: DropdownPortalProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 256,
      });
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      
      if (isOutsideTrigger && isOutsideDropdown) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen || typeof window === 'undefined') return null;

  return createPortal(
    <div 
      ref={dropdownRef}
      className="fixed w-64 bg-sage-100 dark:bg-gray-900 border border-sage-400 dark:border-gray-600 rounded-md shadow-lg z-[9999] max-h-64 overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}

// Simple theme toggle that doesn't rely on context
// function HeaderThemeToggle() {
//     const [theme, setTheme] = useState('dark');

//     // Initialize theme from localStorage on mount
//     useEffect(() => {
//         console.log('🔍 HeaderThemeToggle component mounting');
//         // Get initial theme from localStorage or default to dark
//         const savedTheme = localStorage.getItem('theme') || 'dark';
//         setTheme(savedTheme);
//         console.log('🔍 HeaderThemeToggle initial theme:', savedTheme);

//         // Apply initial theme to document
//         if (savedTheme === 'dark') {
//             document.documentElement.classList.add('dark');
//             document.documentElement.classList.remove('light');
//             document.documentElement.setAttribute('data-theme', 'dark');
//         } else {
//             document.documentElement.classList.remove('dark');
//             document.documentElement.classList.add('light');
//             document.documentElement.setAttribute('data-theme', 'light');
//         }
//         console.log('🔍 HeaderThemeToggle applied initial theme to document');

//         // Listen for theme changes from other components
//         const handleStorage = () => {
//             console.log('🔍 HeaderThemeToggle storage event detected');
//             const currentTheme = localStorage.getItem('theme') || 'dark';
//             setTheme(currentTheme);
//             console.log('🔍 HeaderThemeToggle updated theme from storage:', currentTheme);
//         };

//         window.addEventListener('storage', handleStorage);
//         return () => {
//             console.log('🔍 HeaderThemeToggle unmounting, removing listeners');
//             window.removeEventListener('storage', handleStorage);
//         };
//     }, []);

//     // Toggle theme function
//     const toggleTheme = () => {
//         console.log('🔍 HeaderThemeToggle toggle clicked. Current theme:', theme);

//         const newTheme = theme === 'dark' ? 'light' : 'dark';
//         console.log('🔍 HeaderThemeToggle setting new theme to:', newTheme);

//         setTheme(newTheme);
//         localStorage.setItem('theme', newTheme);
//         console.log('🔍 HeaderThemeToggle updated localStorage');

//         // Apply theme to document (both as class and data attribute for compatibility)
//         if (newTheme === 'dark') {
//             document.documentElement.classList.add('dark');
//             document.documentElement.classList.remove('light');
//             document.documentElement.setAttribute('data-theme', 'dark');
//         } else {
//             document.documentElement.classList.remove('dark');
//             document.documentElement.classList.add('light');
//             document.documentElement.setAttribute('data-theme', 'light');
//         }
//         console.log('🔍 HeaderThemeToggle applied theme to document');

//         // Dispatch a custom event so other components can react to theme changes
//         window.dispatchEvent(new Event('themeChange'));
//         console.log('🔍 HeaderThemeToggle dispatched themeChange event');
//     };

//     return (
//         <button
//             onClick={(e) => {
//                 console.log('🔍 HeaderThemeToggle button clicked');
//                 e.stopPropagation();
//                 toggleTheme();
//             }}
//             className={`p-2 rounded-full bg-opacity-20 transition-colors ${theme === 'dark'
//                     ? 'bg-gray-700 hover:bg-gray-600'
//                     : 'bg-gray-200 hover:bg-gray-300'
//                 }`}
//             aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
//         >
//             {theme === 'dark' ? (
//                 // Sun icon for dark mode (click to switch to light)
//                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-yellow-300">
//                     <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
//                 </svg>
//             ) : (
//                 // Moon icon for light mode (click to switch to dark)
//                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-blue-600">
//                     <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
//                 </svg>
//             )}
//         </button>
//     );
// }

// Remove empty interface and empty props object
function AuthButtons() {
    const { user, signInWithGoogle, signInWithApple, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showSmartSendDialog, setShowSmartSendDialog] = useState(false);
    const [showDisplayNameDialog, setShowDisplayNameDialog] = useState(false);
    const [showContributorsModal, setShowContributorsModal] = useState(false);
    const [showPhoneAuth, setShowPhoneAuth] = useState(false);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [showBugReportModal, setShowBugReportModal] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState('en');
    const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
    const languageTriggerRef = useRef<HTMLButtonElement>(null);
    
    // Helper function to format phone number for display
    const formatPhoneNumber = (phoneNumber: string | null) => {
        if (!phoneNumber) return null;
        // Remove country code and format as (XXX) XXX-XXXX for US/Canada numbers
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.length === 11 && cleaned.startsWith('1')) {
            const number = cleaned.substring(1);
            return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`;
        }
        return phoneNumber;
    };


    // Initialize language preference on mount
    useEffect(() => {
        const savedLanguage = getStoredLanguagePreference(!!user);
        setSelectedLanguage(savedLanguage);
    }, [user]);


    // Toggle theme function - use theme context
    const toggleTheme = () => {
        try {
            const newTheme = theme === 'dark' ? 'light' : 'dark';
            setTheme(newTheme);

            // Close dropdown after theme change with delay
            setTimeout(() => setShowDropdown(false), 50);
        } catch (error) {
            console.error('Error in toggleTheme:', error);
        }
    };

    // Handle signout
    const handleSignOut = () => {
        try {
            signOut();
            // Close dropdown after signout with delay
            setTimeout(() => setShowDropdown(false), 50);
        } catch (error) {
            console.error('Error in handleSignOut:', error);
        }
    };

    // Handle Smart Send dialog
    const handleSmartSendClick = () => {
        setShowSmartSendDialog(true);
        setShowDropdown(false); // Close dropdown when opening dialog
    };

    // Handle Display Name dialog
    const handleDisplayNameClick = () => {
        setShowDisplayNameDialog(true);
        setShowDropdown(false); // Close dropdown when opening dialog
    };

    // Handle Contributors modal
    const handleContributorsClick = () => {
        setShowContributorsModal(true);
        setShowDropdown(false); // Close dropdown when opening modal
    };

    // Handle Send Feedback modal
    const handleSendFeedbackClick = () => {
        setShowBugReportModal(true);
        setShowDropdown(false); // Close dropdown when opening modal
    };

    // Handle language selection
    const handleLanguageSelect = (languageCode: string) => {
        // Add comprehensive multilingual support logging
        const logMultilingualSupport = (message: string, ...args: unknown[]) => {
            if (process.env.NEXT_PUBLIC_ENABLE_MULTILINGUAL_SUPPORT_LOGS === 'true') {
                console.log(`[multilingual_support] ${message}`, ...args);
            }
        };

        const previousLanguage = selectedLanguage;
        const language = getLanguageByCode(languageCode);
        
        logMultilingualSupport('🌐 HEADER: User selected new language', {
            previousLanguage,
            newLanguage: languageCode,
            languageName: language?.name || 'Unknown',
            nativeName: language?.nativeName || 'Unknown',
            changed: previousLanguage !== languageCode,
            timestamp: new Date().toISOString(),
            source: 'header-language-select',
            userAction: 'dropdown-selection'
        });

        setSelectedLanguage(languageCode);
        setStoredLanguagePreference(languageCode);
        setShowLanguageDropdown(false);
        setShowDropdown(false);
        
        logMultilingualSupport('📡 HEADER: Dispatching languageChanged event', {
            languageCode,
            eventType: 'languageChanged',
            eventDetail: { languageCode },
            source: 'header-event-dispatch',
            impact: 'Will trigger language change handlers across application'
        });
        
        // Dispatch event to notify other components of language change
        window.dispatchEvent(new CustomEvent('languageChanged', {
            detail: { languageCode }
        }));

        logMultilingualSupport('✅ HEADER: Language change process completed', {
            newLanguage: languageCode,
            languageName: language?.name || 'Unknown',
            source: 'header-language-change-complete',
            impact: 'UI updated, localStorage saved, event dispatched'
        });
    };


    if (user) {
        return (
            <>
                <button
                    ref={dropdownTriggerRef}
                    id="settings-menu-button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-1 bg-sage-300 dark:bg-white bg-opacity-10 dark:bg-opacity-10 rounded-full px-3 py-2 cursor-pointer transition-all hover:bg-opacity-20"
                    aria-label="Settings menu"
                    aria-expanded={showDropdown}
                    aria-haspopup="true"
                    type="button"
                >
                    <Settings className="w-5 h-5 text-sage-500 dark:text-gray-200" aria-hidden="true" />
                    <svg 
                        className={`w-4 h-4 text-sage-500 dark:text-gray-200 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                <DropdownPortal
                    isOpen={showDropdown}
                    onClose={() => setShowDropdown(false)}
                    triggerRef={dropdownTriggerRef}
                >
                    <div className="py-1" role="none">
                        <div className="px-4 py-2 text-sm text-sage-600 dark:text-gray-300 border-b border-sage-300 dark:border-gray-600">
                            <div className="truncate" title={user.email || formatPhoneNumber(user.phoneNumber) || user.phoneNumber || 'User'}>
                                {user.email || formatPhoneNumber(user.phoneNumber) || user.phoneNumber || 'User'}
                            </div>
                        </div>
                        <button
                            onClick={toggleTheme}
                            className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            {theme === 'dark' ? (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2 text-yellow-300">
                                        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                                    </svg>
                                    Light Mode
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 mr-2 text-blue-600">
                                        <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                                    </svg>
                                    Dark Mode
                                </>
                            )}
                        </button>
                        <Link
                            href="/chatbotV16/memory"
                            onClick={() => setShowDropdown(false)}
                            className="block w-full"
                            role="menuitem"
                        >
                            <span className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700">
                                <Fingerprint className="w-5 h-5 mr-2" />
                                Memory
                            </span>
                        </Link>
                        <button
                            onClick={handleDisplayNameClick}
                            className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            <User className="w-5 h-5 mr-2" />
                            Display Name
                        </button>
                        <button
                            onClick={handleSmartSendClick}
                            className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            <Send className="w-5 h-5 mr-2" />
                            Smart Sending
                        </button>
                        <button
                            onClick={handleContributorsClick}
                            className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            <Trophy className="w-5 h-5 mr-2" />
                            Wall of Contributors
                        </button>
                        <button
                            ref={languageTriggerRef}
                            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                            className="flex items-center justify-between w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                            aria-haspopup="true"
                            aria-expanded={showLanguageDropdown}
                        >
                            <div className="flex items-center">
                                <Languages className="w-5 h-5 mr-2" />
                                {getLanguageByCode(selectedLanguage)?.nativeName || 'English'}
                            </div>
                            <svg 
                                className={`w-4 h-4 ml-2 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            onClick={handleSendFeedbackClick}
                            className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            <Flag className="w-5 h-5 mr-2" />
                            Send Feedback
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="flex items-center w-full px-4 py-2 text-sm text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700"
                            role="menuitem"
                        >
                            <LogOut className="w-5 h-5 mr-2" />
                            Sign Out
                        </button>
                    </div>
                </DropdownPortal>

                <LanguageDropdownPortal
                    isOpen={showLanguageDropdown}
                    onClose={() => setShowLanguageDropdown(false)}
                    triggerRef={languageTriggerRef}
                >
                    <div className="py-1">
                        {SUPPORTED_LANGUAGES.map((language) => (
                            <button
                                key={language.code}
                                onClick={() => handleLanguageSelect(language.code)}
                                className={`block w-full text-left px-4 py-2 text-sm ${
                                    language.code === selectedLanguage
                                        ? 'bg-blue-600 text-white'
                                        : 'text-sage-500 dark:text-gray-200 hover:bg-sage-200 dark:hover:bg-gray-800'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{language.nativeName}</span>
                                    <span className="text-xs opacity-75">{language.name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </LanguageDropdownPortal>

                {/* Smart Send Dialog */}
                <SmartSendDialog
                    isOpen={showSmartSendDialog}
                    onClose={() => setShowSmartSendDialog(false)}
                />

                {/* Display Name Dialog */}
                <DisplayNameDialog
                    isOpen={showDisplayNameDialog}
                    onClose={() => setShowDisplayNameDialog(false)}
                />

                {/* Contributors Modal */}
                <ContributorsModal
                    isOpen={showContributorsModal}
                    onClose={() => setShowContributorsModal(false)}
                />

                {/* Bug Report Modal */}
                {showBugReportModal && (
                    <BugReportModal
                        onClose={() => setShowBugReportModal(false)}
                    />
                )}
            </>);
    }

    // Show phone auth component if requested
    if (showPhoneAuth) {
        return (
            <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex items-center justify-center">
                <PhoneAuth onBack={() => setShowPhoneAuth(false)} />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={signInWithGoogle}
                className="p-2 rounded-lg border border-sage-400 dark:border-gray-600 text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-800"
                aria-label="Sign in with Google"
            >
                <span className="font-semibold text-lg">G</span>
            </button>
            <button
                onClick={signInWithApple}
                className="p-2 rounded-lg border border-sage-400 dark:border-gray-600 text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-800"
                aria-label="Sign in with Apple"
            >
                <Apple className="w-5 h-5" />
            </button>
            <button
                onClick={() => setShowPhoneAuth(true)}
                className="p-2 rounded-lg border border-sage-400 dark:border-gray-600 text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-800"
                aria-label="Sign in with Phone"
            >
                <Phone className="w-5 h-5" />
            </button>
        </div>
    );
}

function FallbackComponent() {
    return <div className="text-sm text-gray-400">Authentication loading...</div>;
}

// Book interface definition
interface Book {
    id: string;
    title: string;
    author: string;
}


// Simple BookSelector component to be used in the header
function BookSelector() {
    const [books, setBooks] = useState<Book[]>([]);
    const [selectedBook, setSelectedBook] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [showDropdown, setShowDropdown] = useState<boolean>(false);
    const { user } = useAuth();
    const isSpecificUser = user?.uid === "NbewAuSvZNgrb64yNDkUebjMHa23";

    useEffect(() => {
        // Only fetch books if this is the specific user
        if (!isSpecificUser) {
            return;
        }

        // Get the selected book from localStorage
        const storedBookId = localStorage.getItem('selectedBookId');
        if (storedBookId) {
            setSelectedBook(storedBookId);
        }

        // Fetch books from API
        const fetchBooks = async () => {
            try {
                const response = await fetch('/api/v11/books');
                if (!response.ok) {
                    throw new Error('Failed to fetch books');
                }
                const data = await response.json() as Book[];
                setBooks(data);

                // If no book is selected yet but we have books, select the psychology textbook or first book
                if (!storedBookId && data.length > 0) {
                    const specificBookId = '2b169bda-011b-4834-8454-e30fed95669d';
                    const specificBook = data.find((book: Book) => book.id === specificBookId);

                    if (specificBook) {
                        setSelectedBook(specificBookId);
                        localStorage.setItem('selectedBookId', specificBookId);
                    } else if (data.length > 0) {
                        setSelectedBook(data[0].id);
                        localStorage.setItem('selectedBookId', data[0].id);
                    }
                }
            } catch (error) {
                console.error('Failed to load books', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBooks();
    }, [isSpecificUser]);

    // Function to handle book selection with direct approach (similar to TestBookSelector)
    const handleBookChange = (bookId: string) => {
        console.log('Original dropdown - Book selected:', bookId);
        setSelectedBook(bookId);
        localStorage.setItem('selectedBookId', bookId);
        setShowDropdown(false);

        // Refresh the page after book selection
        window.location.reload();
    };

    // Toggle dropdown with direct approach (similar to TestBookSelector)
    const toggleDropdown = () => {
        console.log('Toggling original dropdown');
        setShowDropdown(!showDropdown);
    };

    // Only render the component for the specific user
    if (!isSpecificUser) {
        return null;
    }

    if (loading) {
        return <span className="text-sm text-gray-400">Loading...</span>;
    }

    return (
        <div className="relative">
            <button
                onClick={toggleDropdown}
                className="bg-transparent border-none cursor-pointer flex items-center text-sage-500 dark:text-gray-200 hover:text-sage-400 dark:hover:text-white p-2"
                title="Select Book"
                type="button"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {showDropdown && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-sage-200 dark:bg-gray-800 border border-sage-400 dark:border-gray-700 rounded-md shadow-lg z-[9999]">
                    <div className="py-1">
                        {books.map((book: Book) => (
                            <button
                                key={book.id}
                                onClick={() => handleBookChange(book.id)}
                                className={`block w-full text-left px-4 py-2 text-sm ${book.id === selectedBook ? 'bg-blue-600 text-white' : 'text-sage-500 dark:text-gray-200 hover:bg-sage-300 dark:hover:bg-gray-700'}`}
                            >
                                {book.title}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Remove empty interface and empty props object
export function Header() {
    const { theme } = useTheme();
    const [showBackButton, setShowBackButton] = useState(false);
    const [endChatHandler, setEndChatHandler] = useState<(() => void) | null>(null);

    useEffect(() => {
        let unsubscribeHandler: (() => void) | null = null;
        let unsubscribeConnection: (() => void) | null = null;

        import('@/utils/chat-events').then(({ ChatEvents }) => {
            const chatEvents = ChatEvents.getInstance();
            let hasHandler = false;
            let isConnected = false;

            // Update visibility when either handler or connection changes
            const updateVisibility = () => {
                setShowBackButton(hasHandler && isConnected);
            };

            // Listen for handler changes
            unsubscribeHandler = chatEvents.onEndChatHandlerChange((handler: (() => void) | null) => {
                hasHandler = !!handler;
                setEndChatHandler(() => handler);
                updateVisibility();
            });

            // Listen for connection changes
            unsubscribeConnection = chatEvents.onConnectionStateChange((connected: boolean) => {
                isConnected = connected;
                updateVisibility();
            });
        });

        return () => {
            if (unsubscribeHandler) unsubscribeHandler();
            if (unsubscribeConnection) unsubscribeConnection();
        };
    }, []);

    return (
        <header className="fixed top-0 left-0 right-0 flex justify-between items-center px-6 py-3 bg-sage-100 dark:bg-[#131314] z-50">
            <div className="flex items-center gap-2">
                {showBackButton && endChatHandler && (
                    <button
                        onClick={endChatHandler}
                        className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors hover:bg-sage-200 dark:hover:bg-gray-700"
                        style={{ color: 'var(--text-primary)' }}
                    >
                        ← End Session
                    </button>
                )}
                <Link href="/" className="hover:opacity-80 transition-opacity block">
                    <img
                        key={theme}
                        src={theme === 'dark' ? '/images/riseTwiceLogo_darkMode.png' : '/images/riseTwiceLogo_lightMode.png'}
                        alt="RiseTwice"
                        style={{
                            height: '40px',
                            width: 'auto',
                            display: 'block'
                        }}
                    />
                </Link>
            </div>
            <nav className="flex-1 flex justify-center items-center gap-8 header-nav">
                <div className="relative">
                    <div className="book-selector-wrapper">
                        <BookSelector />
                    </div>
                </div>
                {/* Navigation icons removed and moved to footer */}
            </nav>
            <div className="flex items-center">
                <ErrorBoundary FallbackComponent={FallbackComponent}>
                    <AuthButtons />
                </ErrorBoundary>
            </div>
        </header>
    );
}