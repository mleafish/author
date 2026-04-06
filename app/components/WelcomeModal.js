'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function WelcomeModal() {
    const { language, setLanguage } = useAppStore();
    const [isVisible, setIsVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setIsVisible(!language);
    }, [language]);

    if (!mounted || !isVisible) return null;

    const handleSelectLang = (lang) => {
        setLanguage(lang);
        setIsVisible(false);
    };

    return (
        <div className="welcome-modal-overlay">
            <div className="welcome-modal-container">
                <div className="welcome-step fadeIn">
                    <h1 className="welcome-title">Welcome / 欢迎</h1>
                    <div className="welcome-lang-grid">
                        <button className="welcome-card" onClick={() => handleSelectLang('en')}>
                            <span className="welcome-icon">🇬🇧</span>
                            <span className="welcome-label">English</span>
                        </button>
                        <button className="welcome-card" onClick={() => handleSelectLang('zh')}>
                            <span className="welcome-icon">🇨🇳</span>
                            <span className="welcome-label">简体中文</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
