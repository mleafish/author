import { create } from 'zustand';
import { useRef, useState, useEffect } from 'react';
import { persistSet } from '../lib/persistence';

const DEFAULT_BACKGROUND_LAYER = {
    type: 'color',
    color: '',
    image: '',
    size: 'cover',
};

const DEFAULT_WRITING_BACKGROUND = {
    canvas: { ...DEFAULT_BACKGROUND_LAYER },
    page: { ...DEFAULT_BACKGROUND_LAYER },
};

function normalizeBackgroundLayer(value) {
    if (!value || typeof value !== 'object') return { ...DEFAULT_BACKGROUND_LAYER };
    const image = typeof value.image === 'string' ? value.image : '';
    const size = ['cover', 'contain', '100% auto'].includes(value.size) ? value.size : 'cover';
    return {
        type: value.type === 'image' && image ? 'image' : 'color',
        color: typeof value.color === 'string' ? value.color : '',
        image,
        size,
    };
}

function normalizeLanguage(lang) {
    return lang === 'zh' || lang === 'en' ? lang : null;
}

function normalizeWritingBackground(value) {
    if (!value || typeof value !== 'object') return {
        canvas: { ...DEFAULT_WRITING_BACKGROUND.canvas },
        page: { ...DEFAULT_WRITING_BACKGROUND.page },
    };

    // 兼容旧结构：{ type, color, image }
    if ('type' in value || 'color' in value || 'image' in value) {
        return {
            canvas: normalizeBackgroundLayer(value),
            page: { ...DEFAULT_WRITING_BACKGROUND.page },
        };
    }

    return {
        canvas: normalizeBackgroundLayer(value.canvas),
        page: normalizeBackgroundLayer(value.page),
    };
}

function loadWritingBackground() {
    if (typeof window === 'undefined') return normalizeWritingBackground();
    try {
        const raw = localStorage.getItem('author-writing-background');
        if (!raw) return normalizeWritingBackground();
        return normalizeWritingBackground(JSON.parse(raw));
    } catch {
        return normalizeWritingBackground();
    }
}

function applyWritingBackground(background) {
    if (typeof document === 'undefined') return;
    const normalized = normalizeWritingBackground(background);
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--author-writing-bg', normalized.canvas.color || 'var(--bg-canvas)');
    rootStyle.setProperty('--author-writing-bg-image', normalized.canvas.type === 'image' && normalized.canvas.image ? `url("${normalized.canvas.image}")` : 'none');
    rootStyle.setProperty('--author-writing-bg-size', normalized.canvas.size || 'cover');
    rootStyle.setProperty('--author-page-bg', normalized.page.color || 'var(--bg-editor)');
    rootStyle.setProperty('--author-page-bg-image', normalized.page.type === 'image' && normalized.page.image ? `url("${normalized.page.image}")` : 'none');
    rootStyle.setProperty('--author-page-bg-size', normalized.page.size || 'cover');
}

// ============================================================
// 内部 store
// ============================================================
const store = create((set, get) => ({
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
    addVolume: (volume) => set((state) => ({ chapters: [...state.chapters, volume] })),
    toggleVolumeCollapsed: (id) => set((state) => ({
        chapters: state.chapters.map((ch) => (ch.id === id && ch.type === 'volume' ? { ...ch, collapsed: !ch.collapsed } : ch))
    })),
    reorderChapters: (newChapters) => set({ chapters: newChapters }),

    // --- UI State ---
    sidebarOpen: true,
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

    aiSidebarOpen: false,
    setAiSidebarOpen: (open) => set({ aiSidebarOpen: open }),
    toggleAiSidebar: () => set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen })),

    // --- Sidebar Layout Mode (overlay / push) ---
    sidebarPushMode: false,
    setSidebarPushMode: (push) => set(() => {
        if (typeof window !== 'undefined') localStorage.setItem('author-sidebar-push', String(push));
        return { sidebarPushMode: push };
    }),
    aiSidebarPushMode: true,
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
    setShowSettings: (show, tab) => set({ showSettings: (show === true ? (tab || 'settings') : show) || false }),

    showBookInfo: false,

    showSettings: false,
    setShowBookInfo: (show) => set({ showBookInfo: !!show }),

    // 分类独立弹窗
    openCategoryModal: null,
    setOpenCategoryModal: (cat, jumpNodeId) => set({ openCategoryModal: cat || null, jumpToNodeId: jumpNodeId || null }),

    jumpToNodeId: null,
    setJumpToNodeId: (id) => set({ jumpToNodeId: id }),

    showSnapshots: false,
    setShowSnapshots: (show) => set({ showSnapshots: show }),

    theme: 'light',
    setTheme: (theme) => set({ theme }),

    writingMode: 'webnovel',
    setWritingMode: (mode) => set({ writingMode: mode }),

    // --- Localization & Theming ---
    language: typeof window !== 'undefined' ? normalizeLanguage(localStorage.getItem('author-lang')) : null,
    setLanguage: (lang) => set(() => {
        const nextLanguage = normalizeLanguage(lang);
        if (typeof window !== 'undefined') {
            if (nextLanguage) {
                localStorage.setItem('author-lang', nextLanguage);
                persistSet('author-lang', nextLanguage).catch(() => { });
            } else {
                localStorage.removeItem('author-lang');
            }
        }
        return { language: nextLanguage };
    }),

    visualTheme: typeof window !== 'undefined' ? localStorage.getItem('author-visual') || null : null,
    setVisualTheme: (vTheme) => set(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('author-visual', vTheme);
            persistSet('author-visual', vTheme).catch(() => { });
        }
        return { visualTheme: vTheme };
    }),

    writingBackground: loadWritingBackground(),
    setWritingBackground: (background) => set(() => {
        const nextBackground = normalizeWritingBackground(background);
        if (typeof window !== 'undefined') {
            localStorage.setItem('author-writing-background', JSON.stringify(nextBackground));
            persistSet('author-writing-background', nextBackground).catch(() => { });
            applyWritingBackground(nextBackground);
        }
        return { writingBackground: nextBackground };
    }),

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

// ============================================================
// 自动追踪 hook — 组件只在实际访问的属性变化时重渲染
//
// 原理：
// 1. 返回一个 Proxy 代理 state — 记录组件访问了哪些属性
// 2. 订阅 store —— 只在被追踪的属性变化时触发 forceUpdate
// 3. 组件从不接触 showSettings → showSettings 变化不重渲染
//
// 效果：
//   Sidebar 访问 chapters, setShowSettings 等
//   showSettings 变化 → Sidebar 不重渲染（setShowSettings 是函数引用，不变）
//   chapters 变化 → Sidebar 重渲染
// ============================================================
export function useAppStore(selector) {
    // 手动 selector 模式 — 直接代理到 zustand
    if (selector) return store(selector);

    // -- 自动追踪模式 --
    const [, forceRender] = useState(0);
    const accessedKeysRef = useRef(new Set());
    const proxyRef = useRef(null);
    const stateRef = useRef(store.getState());

    // 订阅 store — 只在被追踪的属性变化时触发重渲染
    useEffect(() => {
        const unsub = store.subscribe((newState, prevState) => {
            const keys = accessedKeysRef.current;
            for (const key of keys) {
                if (newState[key] !== prevState[key]) {
                    stateRef.current = newState;
                    forceRender(c => c + 1);
                    return;
                }
            }
            // 没有被追踪的属性变化 —— 不更新，不重渲染
            stateRef.current = newState;
        });
        return unsub;
    }, []);

    // 每次 render 重新创建 Proxy 以追踪新的访问
    const state = store.getState();
    stateRef.current = state;
    const accessed = new Set();
    accessedKeysRef.current = accessed;

    const proxy = new Proxy(state, {
        get(target, prop) {
            if (typeof prop === 'string') {
                accessed.add(prop);
            }
            return target[prop];
        },
    });

    return proxy;
}

// 保留静态方法供非组件代码使用
useAppStore.getState = store.getState;
useAppStore.setState = store.setState;
useAppStore.subscribe = store.subscribe;
