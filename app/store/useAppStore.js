import { create } from 'zustand';
import { persistSet } from '../lib/persistence';

export const useAppStore = create((set, get) => ({
    // --- Chapter State ---
    chapters: [],
    activeChapterId: null,
    activeWorkId: typeof window !== 'undefined' ? localStorage.getItem('author-active-work') || null : null,
    setChapters: (chapters) => set({ chapters: Array.isArray(chapters) ? chapters.filter(ch => ch && typeof ch === 'object' && ch.id) : [] }),
    setActiveChapterId: (id) => set({ activeChapterId: id }),
    setActiveWorkId: (id) => set({ activeWorkId: id }),
    addChapter: (chapter) => set((state) => ({ chapters: [...state.chapters, chapter] })),
    deleteChapter: (id) => set((state) => ({ chapters: state.chapters.filter((ch) => ch.id !== id) })),
    updateChapter: (id, updates) => set((state) => ({
        chapters: state.chapters.map((ch) => (ch.id === id ? { ...ch, ...updates } : ch))
    })),

    // --- UI State ---
    sidebarOpen: true,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    aiSidebarOpen: false,
    setAiSidebarOpen: (open) => set({ aiSidebarOpen: open }),
    toggleAiSidebar: () => set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen })),

    // --- Sidebar Layout Mode (overlay / push) ---
    // 默认值必须与 SSR 一致，localStorage 值通过 _hydrateSidebarModes 在客户端 useEffect 中加载
    sidebarPushMode: false,   // 默认覆盖
    setSidebarPushMode: (push) => set(() => {
        if (typeof window !== 'undefined') localStorage.setItem('author-sidebar-push', String(push));
        return { sidebarPushMode: push };
    }),
    aiSidebarPushMode: true,  // 默认挤开
    setAiSidebarPushMode: (push) => set(() => {
        if (typeof window !== 'undefined') localStorage.setItem('author-ai-sidebar-push', String(push));
        return { aiSidebarPushMode: push };
    }),
    _hydrateSidebarModes: () => {
        if (typeof window === 'undefined') return;
        const sp = localStorage.getItem('author-sidebar-push');
        const ap = localStorage.getItem('author-ai-sidebar-push');
        const updates = {};
        if (sp !== null) updates.sidebarPushMode = sp === 'true';
        if (ap !== null) updates.aiSidebarPushMode = ap === 'true';
        if (Object.keys(updates).length) set(updates);
    },

    showSettings: false,
    setShowSettings: (show) => set({ showSettings: show }),

    jumpToNodeId: null,
    setJumpToNodeId: (id) => set({ jumpToNodeId: id }),

    showSnapshots: false,
    setShowSnapshots: (show) => set({ showSnapshots: show }),

    theme: 'light',
    setTheme: (theme) => set({ theme }),

    writingMode: 'webnovel',
    setWritingMode: (mode) => set({ writingMode: mode }),

    // --- Localization & Theming ---
    language: typeof window !== 'undefined' ? localStorage.getItem('author-lang') || null : null,
    setLanguage: (lang) => set(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('author-lang', lang);
            persistSet('author-lang', lang).catch(() => { });
        }
        return { language: lang };
    }),

    visualTheme: typeof window !== 'undefined' ? localStorage.getItem('author-visual') || null : null,
    setVisualTheme: (vTheme) => set(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('author-visual', vTheme);
            persistSet('author-visual', vTheme).catch(() => { });
        }
        return { visualTheme: vTheme };
    }),

    startTour: false,
    setStartTour: (val) => set({ startTour: val }),

    // --- Toast ---
    toast: null,
    setToast: (toast) => {
        set({ toast });
        if (toast) {
            setTimeout(() => set({ toast: null }), 3000);
        }
    },
    showToast: (message, type = 'info') => get().setToast({ message, type }),

    // --- Context & Settings (RAG Preparation) ---
    contextSelection: typeof window !== 'undefined' && localStorage.getItem('author-context-selection')
        ? new Set(JSON.parse(localStorage.getItem('author-context-selection')))
        : new Set(),
    setContextSelection: (selection) => set((state) => {
        const newSelection = typeof selection === 'function' ? selection(state.contextSelection) : selection;
        if (typeof window !== 'undefined') {
            const arr = Array.from(newSelection);
            localStorage.setItem('author-context-selection', JSON.stringify(arr));
            persistSet('author-context-selection', arr).catch(() => { });
        }
        return { contextSelection: newSelection };
    }),

    contextItems: [],
    setContextItems: (items) => set({ contextItems: items }),

    settingsVersion: 0,
    incrementSettingsVersion: () => set((state) => ({ settingsVersion: state.settingsVersion + 1 })),

    // --- AI Chat & Generation State ---
    sessionStore: { activeSessionId: null, sessions: [] },
    setSessionStore: (action) => set((state) => ({ sessionStore: typeof action === 'function' ? action(state.sessionStore) : action })),

    chatStreaming: false,
    setChatStreaming: (streaming) => set({ chatStreaming: streaming }),

    generationArchive: [],
    setGenerationArchive: (archive) => set({ generationArchive: typeof archive === 'function' ? archive(get().generationArchive) : archive }),
    addGenerationArchive: (record) => set((state) => ({ generationArchive: [...state.generationArchive, record] })),
}));
