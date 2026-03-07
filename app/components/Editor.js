'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { MathInline, MathBlock, openMathEditor } from './MathExtension';
import { PageBreakExtension } from './PageBreakExtension';
import GhostMark from './GhostMark';
import { useEffect, useCallback, useRef, useState, useMemo, useId, forwardRef, useImperativeHandle } from 'react';
import { useAppStore } from '../store/useAppStore';

// ==================== AI 模式配置 ====================
const AI_MODES = [
    { key: 'continue', label: '✦ 续写', desc: '从光标处自然续写', needsSelection: false },
    { key: 'rewrite', label: '✎ 润色', desc: '提升选中文字质量', needsSelection: true },
    { key: 'expand', label: '⊕ 扩写', desc: '丰富细节与描写', needsSelection: true },
    { key: 'condense', label: '⊖ 精简', desc: '浓缩核心内容', needsSelection: true },
    { key: 'chat', label: '💬 问答', desc: '向 AI 提问，不改变原文', needsSelection: false },
];

// ==================== 虚拟分页常量 ====================
const PAGE_HEIGHT = 1056; // A4 纸 @ 96dpi
const PAGE_GAP = 24;      // 页间灰色间隙


const Editor = forwardRef(function Editor({ content, onUpdate, editable = true, onAiRequest, onArchiveGeneration, contextItems, contextSelection, setContextSelection }, ref) {
    const clipPathId = useId();
    const debounceRef = useRef(null);
    const contentRef = useRef(null);

    // 页数状态
    const [pageCount, setPageCount] = useState(1);

    // 搜索栏
    const [findBarVisible, setFindBarVisible] = useState(false);

    // 页边距状态（从 localStorage 读取）
    const [margins, setMargins] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                const saved = JSON.parse(localStorage.getItem('author-margins'));
                if (saved) return { x: saved.x ?? 96, y: saved.y ?? 96 };
            } catch { }
        }
        return { x: 96, y: 96 };
    });

    // 边距变更自动保存
    useEffect(() => {
        localStorage.setItem('author-margins', JSON.stringify(margins));
    }, [margins]);

    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3] },
            }),
            Placeholder.configure({
                placeholder: '开始写作…让灵感自由流淌',
            }),
            CharacterCount,
            Highlight.configure({ multicolor: true }),
            Underline,
            TextStyle,
            Color,
            FontFamily.configure({
                types: ['textStyle'],
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
                alignments: ['left', 'center', 'right', 'justify'],
                defaultAlignment: 'left',
            }),
            Subscript,
            Superscript,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
            Markdown.configure({
                html: true,
                tightLists: true,
                bulletListMarker: '-',
                transformPastedText: true,
                transformCopiedText: false,
            }),
            MathInline,
            MathBlock,
            PageBreakExtension,
            GhostMark,
        ],
        content: content || '',
        editable,
        editorProps: {
            attributes: {
                class: 'tiptap',
            },
        },
        onUpdate: ({ editor }) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                const html = editor.getHTML();
                const text = editor.getText();
                onUpdate?.({
                    html,
                    text,
                    wordCount: text.replace(/\s/g, '').length,
                });
            }, 500);
        },
    });

    // 防止父组件传来的 content 稍有差异即导致整个编辑器重置并跳动
    // 仅当新内容与当前内容脱节时才重置（例如切换章节）
    const previousChapterId = useRef(content);
    useEffect(() => {
        if (!editor || content === undefined) return;
        const currentHtml = editor.getHTML();

        // 简单启发式：如果长度差距极大（用户不可能一秒内打这么多字），或者内容完全不包含现有内容，才做全量替换
        if (content !== currentHtml) {
            // 我们需要区分是“用户打字后传回的最新内容”（不用动）还是“因为点击左侧栏切换了章节”（需要重置）
            // 如果新传入的 content 和当前存在非常显著差异，才执行 setContent
            if (Math.abs(content.length - currentHtml.length) > 50 || !currentHtml.includes(content.substring(0, 50))) {
                editor.commands.setContent(content || '', false);
            }
        }
    }, [content, editor]);

    // 将方法暴露给父组件
    useEffect(() => {
        if (editor) {
            editor.getSelectedText = () => {
                const { from, to } = editor.state.selection;
                if (from === to) return editor.getText();
                return editor.state.doc.textBetween(from, to, ' ');
            };
            editor.insertText = (text) => {
                editor.chain().focus().insertContent(text).run();
            };
            editor.replaceSelection = (text) => {
                const { from, to } = editor.state.selection;
                if (from === to) {
                    editor.chain().focus().insertContent(text).run();
                } else {
                    editor.chain().focus().deleteSelection().insertContent(text).run();
                }
            };
        }
    }, [editor]);

    // 通过 ref 暴露方法给父组件（侧栏存档插入 + 大纲读取用）
    useImperativeHandle(ref, () => ({
        getEditor: () => editor,
        insertText: (text) => {
            if (!editor) return;
            // 规范化换行
            const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
            // 按空行（双换行）分段，段内用 <br> 换行
            const blocks = normalized.split(/\n\n+/);
            const html = blocks
                .map(block => {
                    const lines = block.split('\n').map(l => l.trim()).filter(l => l);
                    return `<p>${lines.join('<br>')}</p>`;
                })
                .filter(p => p !== '<p></p>')
                .join('');
            editor.chain().focus().insertContent(html).run();
        },
    }), [editor]);

    // ===== 核心：ResizeObserver 监听内容高度，计算页数 =====
    const observerRef = useRef(null);
    const contentCallbackRef = useCallback((node) => {
        // 清理旧 observer
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
        if (!node) return;
        contentRef.current = node;
        const observer = new ResizeObserver(() => {
            if (!contentRef.current) return;
            // scrollHeight 更准确地反映内容实际高度
            const height = contentRef.current.scrollHeight;
            // 把 PAGE_GAP 补进来算精确数学除法
            const needed = Math.max(1, Math.ceil((height + PAGE_GAP) / (PAGE_HEIGHT + PAGE_GAP)));
            setPageCount(prev => prev !== needed ? needed : prev);
        });
        observer.observe(node);
        observerRef.current = observer;
    }, []);

    // Ctrl+F 快捷键
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setFindBarVisible(v => !v);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    if (!editor) return null;

    // 容器总高度 = 页数 × 单页高 + 间隙总高
    const totalWorkspaceHeight = pageCount * PAGE_HEIGHT + (pageCount - 1) * PAGE_GAP;

    return (
        <>
            <EditorToolbar editor={editor} margins={margins} setMargins={setMargins} />
            <div
                className="editor-container"
                onClick={(e) => {
                    // 点击灰色空隙处自动聚焦到文末
                    if (e.target.closest('.editor-container') && !e.target.closest('.tiptap')) {
                        editor?.chain().focus('end').run();
                    }
                }}
            >
                <div className="document-workspace" style={{ minHeight: totalWorkspaceHeight }}>

                    {/* SVG clip definition — 每页一个矩形，文字只在页面内可见 */}
                    <svg width="0" height="0" style={{ position: 'absolute' }}>
                        <defs>
                            <clipPath id={clipPathId} clipPathUnits="userSpaceOnUse">
                                {Array.from({ length: pageCount }).map((_, i) => {
                                    const pageTop = i * (PAGE_HEIGHT + PAGE_GAP);
                                    return <rect key={i} x="0" y={pageTop} width="10000" height={PAGE_HEIGHT} />;
                                })}
                            </clipPath>
                        </defs>
                    </svg>

                    {/* ===== 底层：白色纸张卡片阵列 ===== */}
                    <div className="pages-bg-layer">
                        {Array.from({ length: pageCount }).map((_, i) => (
                            <div
                                key={i}
                                className="page-card"
                                style={{
                                    height: PAGE_HEIGHT,
                                    marginBottom: i === pageCount - 1 ? 0 : PAGE_GAP,
                                }}
                            />
                        ))}
                    </div>

                    {/* ===== 页间标签（在灰色间隙中显示页码）===== */}
                    {pageCount > 1 && Array.from({ length: pageCount - 1 }).map((_, i) => {
                        const gapTop = (i + 1) * PAGE_HEIGHT + i * PAGE_GAP;
                        return (
                            <div
                                key={`label-${i}`}
                                style={{
                                    position: 'absolute',
                                    top: gapTop,
                                    left: 0,
                                    right: 0,
                                    height: PAGE_GAP,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none',
                                    zIndex: 5,
                                }}
                            >
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', userSelect: 'none', opacity: 0.6 }}>
                                    第 {i + 1} 页 / 共 {pageCount} 页
                                </span>
                            </div>
                        );
                    })}

                    {/* ===== 文字层（clipPath 严格裁切到页面区域）===== */}
                    <div
                        className="pages-fg-layer"
                        style={{
                            minHeight: totalWorkspaceHeight,
                            clipPath: `url(#${clipPathId})`,
                            WebkitClipPath: `url(#${clipPathId})`,
                            '--page-margin-x': `${margins.x}px`,
                            '--page-margin-y': `${margins.y}px`,
                        }}
                    >
                        <div ref={contentCallbackRef}>
                            <EditorContent editor={editor} />
                        </div>
                    </div>
                </div>
            </div>
            <FindBar editor={editor} visible={findBarVisible} onClose={() => setFindBarVisible(false)} />
            <InlineAI editor={editor} onAiRequest={onAiRequest} onArchiveGeneration={onArchiveGeneration} contextItems={contextItems} contextSelection={contextSelection} setContextSelection={setContextSelection} />
            <StatusBar editor={editor} pageCount={pageCount} />
        </>
    );
});

export default Editor;

// ==================== 搜索栏 ====================
function FindBar({ editor, visible, onClose }) {
    const [query, setQuery] = useState('');
    const [replaceText, setReplaceText] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [matches, setMatches] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(-1);
    const [caseSensitive, setCaseSensitive] = useState(false);
    const inputRef = useRef(null);

    // 搜索文档中的所有匹配
    const findMatches = useCallback((searchText) => {
        if (!editor || !searchText) {
            setMatches([]);
            setCurrentIndex(-1);
            return [];
        }
        const doc = editor.state.doc;
        const results = [];
        const searchLower = caseSensitive ? searchText : searchText.toLowerCase();

        doc.descendants((node, pos) => {
            if (node.isText) {
                const text = caseSensitive ? node.text : node.text.toLowerCase();
                let idx = 0;
                while ((idx = text.indexOf(searchLower, idx)) !== -1) {
                    results.push({ from: pos + idx, to: pos + idx + searchText.length });
                    idx += 1;
                }
            }
        });
        setMatches(results);
        return results;
    }, [editor, caseSensitive]);

    // 当 query 或 caseSensitive 变化时重新搜索
    useEffect(() => {
        const results = findMatches(query);
        if (results.length > 0) {
            setCurrentIndex(0);
            goToMatch(results, 0);
        } else {
            setCurrentIndex(-1);
        }
    }, [query, caseSensitive]); // eslint-disable-line react-hooks/exhaustive-deps

    // 跳转到指定匹配
    const goToMatch = useCallback((matchList, idx) => {
        if (!editor || !matchList.length || idx < 0 || idx >= matchList.length) return;
        const { from, to } = matchList[idx];
        const tr = editor.state.tr.setSelection(TextSelection.create(editor.state.doc, from, to));
        tr.scrollIntoView();
        editor.view.dispatch(tr);
    }, [editor]);

    // 下一个
    const goNext = useCallback(() => {
        if (matches.length === 0) return;
        const next = (currentIndex + 1) % matches.length;
        setCurrentIndex(next);
        goToMatch(matches, next);
    }, [matches, currentIndex, goToMatch]);

    // 上一个
    const goPrev = useCallback(() => {
        if (matches.length === 0) return;
        const prev = (currentIndex - 1 + matches.length) % matches.length;
        setCurrentIndex(prev);
        goToMatch(matches, prev);
    }, [matches, currentIndex, goToMatch]);

    // 替换当前
    const replaceCurrent = useCallback(() => {
        if (!editor || currentIndex < 0 || currentIndex >= matches.length) return;
        const { from, to } = matches[currentIndex];
        editor.chain().focus().insertContentAt({ from, to }, replaceText).run();
        // 重新搜索
        setTimeout(() => {
            const results = findMatches(query);
            if (results.length > 0) {
                const newIdx = Math.min(currentIndex, results.length - 1);
                setCurrentIndex(newIdx);
                goToMatch(results, newIdx);
            }
        }, 50);
    }, [editor, currentIndex, matches, replaceText, query, findMatches, goToMatch]);

    // 全部替换
    const replaceAll = useCallback(() => {
        if (!editor || matches.length === 0) return;
        // 从后往前替换，防止位置偏移
        const sorted = [...matches].sort((a, b) => b.from - a.from);
        let chain = editor.chain();
        for (const { from, to } of sorted) {
            chain = chain.insertContentAt({ from, to }, replaceText);
        }
        chain.run();
        setTimeout(() => {
            setMatches([]);
            setCurrentIndex(-1);
            findMatches(query);
        }, 50);
    }, [editor, matches, replaceText, query, findMatches]);

    // 打开时聚焦
    useEffect(() => {
        if (visible) {
            setTimeout(() => inputRef.current?.focus(), 50);
            // 如果编辑器有选中文本，自动填入搜索框
            if (editor) {
                const { from, to } = editor.state.selection;
                if (from !== to) {
                    const text = editor.state.doc.textBetween(from, to, ' ');
                    if (text && text.length < 200) setQuery(text);
                }
            }
        } else {
            setQuery('');
            setReplaceText('');
            setMatches([]);
            setCurrentIndex(-1);
        }
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    // Escape 关闭
    useEffect(() => {
        if (!visible) return;
        const handler = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
            }
        };
        document.addEventListener('keydown', handler, true);
        return () => document.removeEventListener('keydown', handler, true);
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <div className="find-bar">
            <div className="find-bar-row">
                {/* 展开替换 */}
                <button
                    className="find-bar-toggle"
                    onClick={() => setShowReplace(r => !r)}
                    title={showReplace ? '收起替换' : '展开替换'}
                >
                    {showReplace ? '▾' : '▸'}
                </button>

                <input
                    ref={inputRef}
                    className="find-bar-input"
                    placeholder="搜索..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.shiftKey ? goPrev() : goNext();
                        }
                    }}
                />

                <span className="find-bar-count">
                    {query ? `${matches.length > 0 ? currentIndex + 1 : 0}/${matches.length}` : ''}
                </span>

                <button className="find-bar-btn" onClick={goPrev} disabled={matches.length === 0} title="上一个 (Shift+Enter)">↑</button>
                <button className="find-bar-btn" onClick={goNext} disabled={matches.length === 0} title="下一个 (Enter)">↓</button>
                <button
                    className={`find-bar-btn ${caseSensitive ? 'active' : ''}`}
                    onClick={() => setCaseSensitive(c => !c)}
                    title="区分大小写"
                    style={{ fontSize: 11, fontWeight: caseSensitive ? 700 : 400 }}
                >Aa</button>
                <button className="find-bar-btn find-bar-close" onClick={onClose} title="关闭 (Esc)">✕</button>
            </div>

            {showReplace && (
                <div className="find-bar-row">
                    <div style={{ width: 22 }} /> {/* spacer aligning with toggle */}
                    <input
                        className="find-bar-input"
                        placeholder="替换为..."
                        value={replaceText}
                        onChange={e => setReplaceText(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                replaceCurrent();
                            }
                        }}
                    />
                    <button className="find-bar-btn" onClick={replaceCurrent} disabled={currentIndex < 0} title="替换当前">替换</button>
                    <button className="find-bar-btn" onClick={replaceAll} disabled={matches.length === 0} title="全部替换">全部</button>
                </div>
            )}
        </div>
    );
}

// ==================== Inline AI 组件 ====================
function InlineAI({ editor, onAiRequest, onArchiveGeneration, contextItems, contextSelection, setContextSelection }) {
    const { setShowSettings, setJumpToNodeId } = useAppStore();
    const [visible, setVisible] = useState(false);
    const [mode, setMode] = useState('continue');
    const [instruction, setInstruction] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [pendingGhost, setPendingGhost] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const abortRef = useRef(null);
    const inputRef = useRef(null);
    const popoverRef = useRef(null);
    const typeQueueRef = useRef([]);
    const typingRef = useRef(false);
    // Ghost text tracking
    const ghostStartRef = useRef(null);
    const ghostTextRef = useRef('');
    // Rewrite backup
    const originalTextRef = useRef(null);
    const originalRangeRef = useRef(null);
    const currentModeRef = useRef('continue');
    // 文档快照：生成前保存，拒绝时恢复
    const savedDocRef = useRef(null);
    // ===== Chat Q&A 状态 =====
    const [chatMessages, setChatMessages] = useState([]); // [{role:'user'|'assistant', content}]
    const [chatStreaming, setChatStreaming] = useState(false);
    const [chatAnswer, setChatAnswer] = useState('');
    const chatPanelRef = useRef(null);
    const chatInputRef = useRef(null);

    // 获取选中文本
    const getSelectedText = useCallback(() => {
        if (!editor) return '';
        const { from, to } = editor.state.selection;
        if (from === to) return '';
        return editor.state.doc.textBetween(from, to, ' ');
    }, [editor]);

    // 获取上文（用于续写）
    const getContextText = useCallback(() => {
        if (!editor) return '';
        const text = editor.getText();
        return text.length > 1500 ? text.slice(-1500) : text;
    }, [editor]);

    // 计算浮窗位置（基于光标，使用视口坐标 position:fixed）
    const updatePosition = useCallback(() => {
        if (!editor) return;
        const { view } = editor;
        const head = editor.state.selection.head;
        const coords = view.coordsAtPos(head, -1);

        const GAP = 16;
        const popoverW = 360;
        const popoverH = 130;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let top = coords.bottom + 8;
        let left = coords.left;
        left = Math.max(GAP, Math.min(left, vw - popoverW - GAP));
        if (top + popoverH > vh - GAP) {
            top = coords.top - popoverH - 8;
        }
        if (top < GAP) top = GAP;

        setPosition({ top, left });
    }, [editor]);

    // 打开浮窗
    const open = useCallback(() => {
        if (pendingGhost) return; // 有待确认的 ghost 时不打开新的
        const selected = getSelectedText();
        setMode(selected ? 'rewrite' : 'continue');
        setInstruction('');
        updatePosition();
        setVisible(true);
    }, [getSelectedText, updatePosition, pendingGhost]);

    // 关闭浮窗
    const close = useCallback(() => {
        if (streaming || pendingGhost) return;
        setVisible(false);
        setInstruction('');
        editor?.chain().focus().run();
    }, [streaming, pendingGhost, editor]);

    // 停止生成
    const stop = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        typeQueueRef.current = [];
        typingRef.current = false;
        setStreaming(false);
        // 如果已经有 ghost 文本，进入待确认状态
        if (ghostTextRef.current) {
            setPendingGhost(true);
        }
    }, []);

    // 打字机效果：逐字符插入编辑器，带 ghost mark
    // 使用原生 ProseMirror transaction，彻底避免 scrollIntoView
    const suppressScrollRef = useRef(false);

    const startTyping = useCallback(() => {
        if (typingRef.current) return;
        typingRef.current = true;

        const typeNext = () => {
            if (typeQueueRef.current.length === 0) {
                typingRef.current = false;
                return;
            }
            const char = typeQueueRef.current.shift();
            if (char === '\n') {
                if (typeQueueRef.current[0] !== '\n') {
                    // 换行：使用原生 split，不调用 scrollIntoView
                    ghostTextRef.current += '\n';
                    const { state } = editor.view;
                    const tr = state.tr.split(state.selection.from);
                    editor.view.dispatch(tr);
                }
            } else {
                // 用原生 ProseMirror transaction 插入字符 + 标记 ghost
                const { state } = editor.view;
                const tr = state.tr.insertText(char);
                const ghostMark = state.schema.marks.ghostText.create();
                const to = tr.selection.from;
                const from = to - char.length;
                tr.addMark(from, to, ghostMark);
                // 故意不调用 tr.scrollIntoView() — 防止滚动跳回
                editor.view.dispatch(tr);
                ghostTextRef.current += char;
            }
            requestAnimationFrame(() => setTimeout(typeNext, 20));
        };
        typeNext();
    }, [editor]);

    // 将文本块加入打字队列
    const enqueueText = useCallback((text) => {
        for (const char of text) {
            typeQueueRef.current.push(char);
        }
        startTyping();
    }, [startTyping]);

    // ========== Ghost 操作 ==========

    // 接受：去掉 ghost mark，文本变成正式内容
    const acceptGhost = useCallback(() => {
        editor?.commands.acceptAllGhost();
        // 归档
        onArchiveGeneration?.({
            mode: currentModeRef.current,
            instruction: instruction.trim(),
            text: ghostTextRef.current,
            status: 'accepted',
        });
        ghostTextRef.current = '';
        ghostStartRef.current = null;
        originalTextRef.current = null;
        originalRangeRef.current = null;
        setPendingGhost(false);
        setVisible(false);
        editor?.chain().focus().run();
    }, [editor, instruction, onArchiveGeneration]);

    // 拒绝：删除 ghost 文本（含换行符），改写模式还原原文
    const rejectGhost = useCallback(() => {
        // 归档（标记为拒绝）
        onArchiveGeneration?.({
            mode: currentModeRef.current,
            instruction: instruction.trim(),
            text: ghostTextRef.current,
            status: 'rejected',
        });
        // 直接恢复生成前的文档快照（最可靠，彻底消除残留空行）
        if (savedDocRef.current && editor) {
            editor.commands.setContent(savedDocRef.current, false);
        } else {
            // 回退：若无快照，使用 mark 删除
            editor?.commands.removeAllGhost(ghostStartRef.current);
            if (originalTextRef.current && originalRangeRef.current) {
                const { from } = originalRangeRef.current;
                editor?.chain()
                    .focus()
                    .insertContentAt(from, originalTextRef.current)
                    .run();
            }
        }
        ghostTextRef.current = '';
        ghostStartRef.current = null;
        originalTextRef.current = null;
        originalRangeRef.current = null;
        savedDocRef.current = null;
        setPendingGhost(false);
        setVisible(false);
        editor?.chain().focus().run();
    }, [editor, instruction, onArchiveGeneration]);

    // 重新生成：拒绝当前 ghost + 重新 generate
    const regenerate = useCallback(() => {
        // 先归档拒绝
        onArchiveGeneration?.({
            mode: currentModeRef.current,
            instruction: instruction.trim(),
            text: ghostTextRef.current,
            status: 'rejected',
        });
        // 恢复文档快照
        if (savedDocRef.current && editor) {
            editor.commands.setContent(savedDocRef.current, false);
        } else {
            editor?.commands.removeAllGhost(ghostStartRef.current);
        }
        ghostTextRef.current = '';
        setPendingGhost(false);
        // 触发新一轮生成（savedDocRef 保留不清空，供下次拒绝使用）
        setTimeout(() => generate(), 50);
    }, [editor, instruction, onArchiveGeneration]);

    // 执行 AI 生成
    // ===== Chat Q&A 生成（不修改原文） =====
    const generateChat = useCallback(async (userText) => {
        if (!onAiRequest || chatStreaming) return;
        const question = (userText || '').trim();
        if (!question) return;

        // 添加用户消息
        setChatMessages(prev => [...prev, { role: 'user', content: question }]);
        setChatStreaming(true);
        setChatAnswer('');
        const controller = new AbortController();
        abortRef.current = controller;
        let fullAnswer = '';

        try {
            const contextText = getContextText();
            await onAiRequest({
                mode: 'chat',
                text: contextText,
                instruction: question,
                signal: controller.signal,
                onChunk: (chunk) => {
                    fullAnswer += chunk;
                    setChatAnswer(fullAnswer);
                },
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                fullAnswer += '\n\n❌ 请求出错: ' + (err.message || '未知错误');
                setChatAnswer(fullAnswer);
            }
        } finally {
            setChatStreaming(false);
            abortRef.current = null;
            if (fullAnswer) {
                setChatMessages(prev => [...prev, { role: 'assistant', content: fullAnswer }]);
                setChatAnswer('');
            }
        }
    }, [onAiRequest, chatStreaming, getContextText]);

    const generate = useCallback(async () => {
        if (!onAiRequest || streaming) return;

        // Chat 模式走独立路径
        if (mode === 'chat') {
            generateChat(instruction);
            setInstruction('');
            return;
        }

        const selectedText = getSelectedText();
        const contextText = getContextText();
        let actualMode = mode;

        if (AI_MODES.find(m => m.key === mode)?.needsSelection && !selectedText) {
            actualMode = 'continue';
            setMode('continue');
        }
        currentModeRef.current = actualMode;

        const text = selectedText || contextText;
        if (!text.trim() && actualMode !== 'continue') return;

        setStreaming(true);
        setPendingGhost(false);
        const controller = new AbortController();
        abortRef.current = controller;
        typeQueueRef.current = [];
        ghostTextRef.current = '';

        // 保存生成前的文档快照（在任何修改之前）
        savedDocRef.current = editor.getJSON();

        // 改写模式：备份原文
        if (selectedText && actualMode !== 'continue') {
            const { from, to } = editor.state.selection;
            originalTextRef.current = selectedText;
            originalRangeRef.current = { from, to };
            editor?.chain().focus().deleteSelection().run();
        } else {
            originalTextRef.current = null;
            originalRangeRef.current = null;
            editor?.chain().focus().run();
        }

        ghostStartRef.current = editor.state.selection.head;

        try {
            await onAiRequest({
                mode: actualMode,
                text,
                instruction: instruction.trim(),
                signal: controller.signal,
                onChunk: (chunk) => {
                    enqueueText(chunk);
                },
            });
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('AI 生成错误:', err);
            }
        } finally {
            await new Promise(resolve => {
                const check = () => {
                    if (typeQueueRef.current.length === 0 && !typingRef.current) resolve();
                    else setTimeout(check, 50);
                };
                check();
            });
            setStreaming(false);
            abortRef.current = null;
            // 进入待确认状态
            if (ghostTextRef.current) {
                setPendingGhost(true);
                // 将光标（ghost 文本末端）滚入可视区域，确保操作栏可见
                try {
                    const scrollContainer = editor.view.dom.closest('.editor-container');
                    if (scrollContainer) {
                        const head = editor.state.selection.head;
                        const coords = editor.view.coordsAtPos(head, -1);
                        const containerRect = scrollContainer.getBoundingClientRect();
                        const relativeBottom = coords.bottom - containerRect.top + scrollContainer.scrollTop;
                        const targetScroll = relativeBottom - containerRect.height + 80;
                        if (targetScroll > scrollContainer.scrollTop) {
                            scrollContainer.scrollTop = targetScroll;
                        }
                    }
                } catch { /* 回退：不滚动也不阻塞 */ }
            } else {
                setVisible(false);
            }
        }
    }, [onAiRequest, streaming, mode, instruction, getSelectedText, getContextText, editor, enqueueText, updatePosition, generateChat]);

    // 键盘快捷键：Ctrl+J 打开，Esc 关闭/拒绝，Tab 接受
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'j') {
                e.preventDefault();
                if (pendingGhost) return;
                if (visible) close();
                else open();
            }
            if (e.key === 'Escape' && (visible || pendingGhost)) {
                e.preventDefault();
                if (streaming) stop();
                else if (pendingGhost) rejectGhost();
                else close();
            }
            // Tab 接受 ghost text
            if (e.key === 'Tab' && pendingGhost) {
                e.preventDefault();
                acceptGhost();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [visible, streaming, pendingGhost, open, close, stop, rejectGhost, acceptGhost]);

    // 点击外部关闭（但待确认状态不自动关闭）
    useEffect(() => {
        if (!visible) return;
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target)) {
                if (!streaming && !pendingGhost) close();
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [visible, streaming, pendingGhost, close]);

    // Chat 模式下自动滚到底部
    useEffect(() => {
        if (chatPanelRef.current) {
            chatPanelRef.current.scrollTop = chatPanelRef.current.scrollHeight;
        }
    }, [chatMessages, chatAnswer]);

    // 待确认状态时不显示浮窗，改为在幽灵文本末尾显示操作栏
    if (!visible && !pendingGhost) {
        return null;
    }

    // 待确认状态：在幽灵文本末尾内联显示操作栏（Cursor 风格）
    if (pendingGhost) {
        // 获取光标位置（幽灵文本末尾）
        let ghostPos = { top: 0, left: 0 };
        try {
            const head = editor.state.selection.head;
            const coords = editor.view.coordsAtPos(head, -1);
            ghostPos = { top: coords.bottom + 4, left: coords.left };
            // 确保不超出视口
            const vw = window.innerWidth;
            if (ghostPos.left + 280 > vw) ghostPos.left = vw - 296;
            if (ghostPos.left < 16) ghostPos.left = 16;
        } catch { /* 位置获取失败时用默认值 */ }

        return (
            <div
                className="ghost-inline-bar"
                style={{ top: Math.max(16, Math.min(ghostPos.top, window.innerHeight - 60)), left: ghostPos.left }}
            >
                <button className="ghost-accept-btn" onClick={acceptGhost} title="接受 (Tab)">
                    ✓ 接受
                </button>
                <button className="ghost-reject-btn" onClick={rejectGhost} title="拒绝 (Esc)">
                    ✗ 拒绝
                </button>
                <button className="ghost-regen-btn" onClick={regenerate} title="重新生成">
                    ⟳
                </button>
                <span className="ghost-bar-shortcut">Tab 接受 · Esc 拒绝</span>
            </div>
        );
    }
    const selectedText = getSelectedText();
    const availableModes = selectedText
        ? AI_MODES
        : AI_MODES.filter(m => !m.needsSelection);

    return (
        <div
            ref={popoverRef}
            className={`inline-ai-popover ${mode === 'chat' ? 'inline-ai-popover-chat' : ''}`}
            style={{ top: position.top, left: Math.max(16, position.left) }}
        >
            {/* 模式选择 */}
            <div className="inline-ai-modes">
                {availableModes.map(m => (
                    <button
                        key={m.key}
                        className={`inline-ai-mode-btn ${mode === m.key ? 'active' : ''}`}
                        onClick={() => setMode(m.key)}
                        disabled={streaming}
                        title={m.desc}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            {/* ===== Chat 模式：聊天面板 ===== */}
            {mode === 'chat' ? (
                <>
                    {/* 聊天头部 */}
                    <div className="chat-header">
                        <div className="chat-header-icon">✦</div>
                        <div className="chat-header-text">
                            <span className="chat-header-title">AI 问答助手</span>
                            <span className="chat-header-subtitle">基于你的作品上下文回答，不修改原文</span>
                        </div>
                    </div>

                    {/* 消息区域 */}
                    <div className="inline-ai-chat-panel" ref={chatPanelRef}>
                        {chatMessages.length === 0 && !chatAnswer && (
                            <div className="inline-ai-chat-empty">
                                <div className="chat-empty-icon">💬</div>
                                <div className="chat-empty-title">向 AI 提问</div>
                                <div className="chat-empty-hints">
                                    <span className="chat-empty-hint">📖 这段情节的伏笔是什么？</span>
                                    <span className="chat-empty-hint">🧑 角色性格分析</span>
                                    <span className="chat-empty-hint">✍️ 写作手法建议</span>
                                </div>
                            </div>
                        )}
                        {chatMessages.map((msg, i) => (
                            <div key={i} className={`inline-ai-chat-msg ${msg.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}`}>
                                <div className="chat-msg-avatar">
                                    {msg.role === 'user' ? '🧑' : '✦'}
                                </div>
                                <div className="chat-msg-bubble">{msg.content}</div>
                            </div>
                        ))}
                        {chatAnswer && (
                            <div className="inline-ai-chat-msg chat-msg-ai">
                                <div className="chat-msg-avatar">✦</div>
                                <div className="chat-msg-bubble">
                                    {chatAnswer}
                                    <span className="streaming-cursor">▊</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 输入区 */}
                    <div className="chat-input-area">
                        <div className="inline-ai-input-row">
                            <input
                                ref={chatInputRef}
                                className="inline-ai-input"
                                placeholder="问问关于你作品的任何问题…"
                                value={instruction}
                                onChange={e => setInstruction(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !chatStreaming) {
                                        e.preventDefault();
                                        generateChat(instruction);
                                        setInstruction('');
                                    }
                                }}
                                disabled={chatStreaming}
                            />
                            {chatStreaming ? (
                                <button className="inline-ai-stop-btn" onClick={() => {
                                    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
                                    setChatStreaming(false);
                                }}>
                                    ⬛
                                </button>
                            ) : (
                                <button className="chat-send-btn" onClick={() => {
                                    generateChat(instruction);
                                    setInstruction('');
                                }} disabled={!instruction.trim()}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                </button>
                            )}
                            {chatMessages.length > 0 && !chatStreaming && (
                                <button className="chat-clear-btn" onClick={() => { setChatMessages([]); setChatAnswer(''); }} title="清空对话">
                                    清空
                                </button>
                            )}
                        </div>
                    </div>
                </>

            ) : (
                <>
                    {/* 参考设定集（可折叠） */}
                    <InlineContextPanel
                        contextItems={contextItems}
                        contextSelection={contextSelection}
                        setContextSelection={setContextSelection}
                        onJumpToNode={(nodeId) => {
                            setJumpToNodeId(nodeId);
                            setShowSettings(true);
                        }}
                    />

                    {/* 指令输入 */}
                    <div className="inline-ai-input-row">
                        <input
                            ref={inputRef}
                            className="inline-ai-input"
                            placeholder={mode === 'continue' ? '补充指示（可选），如：写一段打斗场景' : '改写指示（可选），如：更有诗意'}
                            value={instruction}
                            onChange={e => setInstruction(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !streaming) {
                                    e.preventDefault();
                                    generate();
                                }
                            }}
                            disabled={streaming}
                        />
                        {streaming ? (
                            <button className="inline-ai-stop-btn" onClick={stop}>
                                ⬛ 停止
                            </button>
                        ) : (
                            <button className="inline-ai-go-btn" onClick={generate}>
                                ✦ 生成
                            </button>
                        )}
                    </div>

                    {/* 状态提示 */}
                    {streaming && (
                        <div className="inline-ai-status">
                            <span className="streaming-cursor">▊</span> AI 正在写入编辑器…
                        </div>
                    )}
                    {!streaming && selectedText && (
                        <div className="inline-ai-hint">
                            已选中 {selectedText.length} 字
                        </div>
                    )}
                    {!streaming && !selectedText && (
                        <div className="inline-ai-hint">
                            将在光标处续写 · Ctrl+J 打开/关闭
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
// ==================== Inline 参考面板（设定集勾选） ====================
function InlineContextPanel({ contextItems, contextSelection, setContextSelection, onJumpToNode }) {
    const [expanded, setExpanded] = useState(false);

    // 只显示设定集条目，不显示对话历史
    const settingsItems = useMemo(() =>
        (contextItems || []).filter(it => it.category !== 'dialogue'),
        [contextItems]);

    // 按分组归类，过滤掉空分组
    const grouped = useMemo(() => {
        const groups = {};
        for (const item of settingsItems) {
            const g = item.group || '其他';
            if (!groups[g]) groups[g] = [];
            groups[g].push(item);
        }
        return groups;
    }, [settingsItems]);

    const selectedCount = settingsItems.filter(it => contextSelection?.has(it.id)).length;
    const totalCount = settingsItems.length;

    if (totalCount === 0) return null;

    const toggleItem = (itemId) => {
        setContextSelection?.(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const toggleGroup = (groupName) => {
        const items = grouped[groupName] || [];
        setContextSelection?.(prev => {
            const next = new Set(prev);
            const allChecked = items.every(it => prev.has(it.id));
            items.forEach(it => {
                if (allChecked) next.delete(it.id);
                else next.add(it.id);
            });
            return next;
        });
    };

    return (
        <div className="inline-context-panel">
            <button
                className="inline-context-toggle"
                onClick={() => setExpanded(!expanded)}
            >
                <span className="inline-context-chevron">{expanded ? '▼' : '▶'}</span>
                <span>📚 参考</span>
                <span className="inline-context-count">({selectedCount}/{totalCount})</span>
            </button>
            {expanded && (
                <div className="inline-context-list">
                    {Object.entries(grouped).map(([groupName, items]) => {
                        const checkedCount = items.filter(it => contextSelection?.has(it.id)).length;
                        const allChecked = checkedCount === items.length;
                        return (
                            <div key={groupName} className="inline-context-group">
                                <label className="inline-context-group-header">
                                    <input
                                        type="checkbox"
                                        checked={allChecked && items.length > 0}
                                        ref={el => { if (el) el.indeterminate = checkedCount > 0 && checkedCount < items.length; }}
                                        onChange={() => toggleGroup(groupName)}
                                    />
                                    <span className="inline-context-group-name">{groupName}</span>
                                    <span className="inline-context-group-count">{checkedCount}/{items.length}</span>
                                </label>
                                {items.map(item => (
                                    <div key={item.id} className="inline-context-item" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={contextSelection?.has(item.id) || false}
                                                onChange={() => toggleItem(item.id)}
                                            />
                                            <span className="inline-context-item-name" title={item.name}>{item.name}</span>
                                        </label>
                                        {item._nodeId && onJumpToNode && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onJumpToNode(item._nodeId); }}
                                                style={{
                                                    background: 'none', border: 'none', cursor: 'pointer',
                                                    fontSize: 11, color: 'var(--accent)', padding: '0 4px',
                                                    opacity: 0.7, lineHeight: 1, flexShrink: 0,
                                                }}
                                                title="跳转到设定集"
                                            >→</button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ==================== 颜色选择器组件 ====================
const PRESET_COLORS = [
    '#000000', '#434343', '#666666', '#999999', '#cccccc',
    '#c0392b', '#e74c3c', '#e67e22', '#f39c12', '#f1c40f',
    '#27ae60', '#2ecc71', '#1abc9c', '#2980b9', '#3498db',
    '#8e44ad', '#9b59b6', '#e91e63', '#795548', '#607d8b',
];

function ColorPicker({ label, currentColor, onSelect, onClose }) {
    return (
        <div className="color-picker-popover" onMouseDown={e => e.preventDefault()} onClick={e => e.stopPropagation()}>
            <div className="color-picker-label">{label}</div>
            <div className="color-picker-grid">
                {PRESET_COLORS.map(color => (
                    <button
                        key={color}
                        className={`color-swatch ${currentColor === color ? 'active' : ''}`}
                        style={{ background: color }}
                        onClick={() => { onSelect(color); onClose(); }}
                        title={color}
                    />
                ))}
            </div>
            <button
                className="color-picker-clear"
                onClick={() => { onSelect(null); onClose(); }}
            >
                清除颜色
            </button>
        </div>
    );
}

// ==================== 字体族选项 ====================
const FONT_FAMILIES = [
    { label: '默认（宋体）', value: '' },
    { label: '黑体', value: '"Noto Sans SC", "Microsoft YaHei", sans-serif' },
    { label: '楷体', value: '"KaiTi", "STKaiti", serif' },
    { label: '仿宋', value: '"FangSong", "STFangsong", serif' },
    { label: 'serif', value: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif' },
    { label: 'monospace', value: '"SF Mono", "Cascadia Code", "Consolas", monospace' },
];

const FONT_SIZES = [12, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32];

// ==================== 工具栏 ====================
function EditorToolbar({ editor, margins, setMargins }) {
    if (!editor) return null;

    const [showFontColor, setShowFontColor] = useState(false);
    const [showBgColor, setShowBgColor] = useState(false);
    const [showFontFamily, setShowFontFamily] = useState(false);
    const [showFontSize, setShowFontSize] = useState(false);
    const [showTypeset, setShowTypeset] = useState(false);
    const [showMargins, setShowMargins] = useState(false);
    const [fontSize, setFontSize] = useState(() => {
        if (typeof window !== 'undefined') return parseInt(localStorage.getItem('author-font-size')) || 17;
        return 17;
    });
    const [lineHeight, setLineHeight] = useState(() => {
        if (typeof window !== 'undefined') return parseFloat(localStorage.getItem('author-line-height')) || 1.9;
        return 1.9;
    });

    useEffect(() => {
        document.documentElement.style.setProperty('--editor-font-size', `${fontSize}px`);
        document.documentElement.style.setProperty('--editor-line-height', String(lineHeight));
        localStorage.setItem('author-font-size', String(fontSize));
        localStorage.setItem('author-line-height', String(lineHeight));
    }, [fontSize, lineHeight]);

    const closeAll = () => {
        setShowFontColor(false);
        setShowBgColor(false);
        setShowFontFamily(false);
        setShowFontSize(false);
        setShowTypeset(false);
        setShowMargins(false);
    };

    const toolbarRef = useRef(null);
    useEffect(() => {
        const handler = (e) => {
            if (e.target.closest('.toolbar-dropdown-wrap')) return;
            closeAll();
        };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    const currentFontFamily = editor.getAttributes('textStyle').fontFamily || '';
    const currentFontLabel = FONT_FAMILIES.find(f => f.value === currentFontFamily)?.label || '默认';
    const currentColor = editor.getAttributes('textStyle').color || '';
    const currentHighlight = editor.getAttributes('highlight').color || '';

    return (
        <div className="editor-toolbar" onMouseDown={e => { if (e.target.tagName !== 'INPUT') e.preventDefault(); }}>
            {/* 撤销/重做 */}
            <div className="toolbar-group">
                <button className="toolbar-btn" onClick={() => editor.chain().focus().undo().run()} title="撤销 (Ctrl+Z)">↩</button>
                <button className="toolbar-btn" onClick={() => editor.chain().focus().redo().run()} title="重做 (Ctrl+Y)">↪</button>
            </div>

            <div className="toolbar-divider" />

            {/* 字体族 */}
            <div className="toolbar-dropdown-wrap" onClick={e => e.stopPropagation()}>
                <button className="toolbar-btn toolbar-dropdown-btn" onClick={() => { closeAll(); setShowFontFamily(!showFontFamily); }} title="字体">
                    {currentFontLabel} <span className="dropdown-arrow">▾</span>
                </button>
                {showFontFamily && (
                    <div className="toolbar-dropdown-menu">
                        {FONT_FAMILIES.map(f => (
                            <button
                                key={f.label}
                                className={`toolbar-dropdown-item ${currentFontFamily === f.value ? 'active' : ''}`}
                                style={{ fontFamily: f.value || 'inherit' }}
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    if (f.value) {
                                        editor.chain().focus().setFontFamily(f.value).run();
                                    } else {
                                        editor.chain().focus().unsetFontFamily().run();
                                    }
                                    setShowFontFamily(false);
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="toolbar-divider" />

            {/* 格式按钮 */}
            <div className="toolbar-group">
                <button className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} title="加粗 (Ctrl+B)" style={{ fontWeight: 'bold' }}>B</button>
                <button className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} title="斜体 (Ctrl+I)" style={{ fontStyle: 'italic' }}>I</button>
                <button className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleUnderline().run()} title="下划线 (Ctrl+U)" style={{ textDecoration: 'underline' }}>U</button>
                <button className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleStrike().run()} title="删除线" style={{ textDecoration: 'line-through' }}>S</button>
                <button className={`toolbar-btn ${editor.isActive('superscript') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleSuperscript().run()} title="上标" style={{ fontSize: 11 }}>X²</button>
                <button className={`toolbar-btn ${editor.isActive('subscript') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleSubscript().run()} title="下标" style={{ fontSize: 11 }}>X₂</button>
            </div>

            <div className="toolbar-divider" />

            {/* 字体颜色 */}
            <div className="toolbar-dropdown-wrap" onClick={e => e.stopPropagation()}>
                <button
                    className="toolbar-btn toolbar-color-btn"
                    onClick={() => { closeAll(); setShowFontColor(!showFontColor); }}
                    title="字体颜色"
                >
                    <span style={{ borderBottom: `3px solid ${currentColor || 'var(--text-primary)'}` }}>A</span>
                    <span className="dropdown-arrow">▾</span>
                </button>
                {showFontColor && (
                    <ColorPicker
                        label="字体颜色"
                        currentColor={currentColor}
                        onSelect={color => {
                            if (color) editor.chain().focus().setColor(color).run();
                            else editor.chain().focus().unsetColor().run();
                        }}
                        onClose={() => setShowFontColor(false)}
                    />
                )}
            </div>

            {/* 背景色/高亮 */}
            <div className="toolbar-dropdown-wrap" onClick={e => e.stopPropagation()}>
                <button
                    className="toolbar-btn toolbar-color-btn"
                    onClick={() => { closeAll(); setShowBgColor(!showBgColor); }}
                    title="背景颜色（高亮）"
                >
                    <span style={{
                        background: currentHighlight || 'var(--warning)',
                        padding: '0 3px',
                        borderRadius: 2,
                        color: currentHighlight ? '#fff' : 'inherit',
                    }}>高亮</span>
                    <span className="dropdown-arrow">▾</span>
                </button>
                {showBgColor && (
                    <ColorPicker
                        label="背景颜色"
                        currentColor={currentHighlight}
                        onSelect={color => {
                            if (color) editor.chain().focus().toggleHighlight({ color }).run();
                            else editor.chain().focus().unsetHighlight().run();
                        }}
                        onClose={() => setShowBgColor(false)}
                    />
                )}
            </div>

            <div className="toolbar-divider" />

            {/* 标题 */}
            <div className="toolbar-group">
                <button className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="一级标题" style={{ fontSize: 13, fontWeight: 700 }}>H1</button>
                <button className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="二级标题" style={{ fontSize: 12, fontWeight: 700 }}>H2</button>
                <button className={`toolbar-btn ${editor.isActive('heading', { level: 3 }) ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="三级标题" style={{ fontSize: 11, fontWeight: 700 }}>H3</button>
            </div>

            <div className="toolbar-divider" />

            {/* 对齐 */}
            <div className="toolbar-group">
                <button className={`toolbar-btn ${editor.isActive({ textAlign: 'left' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="左对齐">≡</button>
                <button className={`toolbar-btn ${editor.isActive({ textAlign: 'center' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="居中">═</button>
                <button className={`toolbar-btn ${editor.isActive({ textAlign: 'right' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="右对齐">≢</button>
                <button className={`toolbar-btn ${editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}`} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="两端对齐">☰</button>
            </div>

            <div className="toolbar-divider" />

            {/* 字号行距 */}
            <div className="toolbar-dropdown-wrap" onClick={e => e.stopPropagation()}>
                <button
                    className={`toolbar-btn ${showTypeset ? 'active' : ''}`}
                    onClick={() => { closeAll(); setShowTypeset(!showTypeset); }}
                    title="字号与行距"
                    style={{ fontSize: 12 }}
                >
                    Aa <span className="dropdown-arrow">▾</span>
                </button>
                {showTypeset && (
                    <div className="typeset-popover" style={{ position: 'absolute', top: '100%', bottom: 'auto', right: 0, marginTop: 4, zIndex: 120 }}>
                        <div className="typeset-row">
                            <label>字号</label>
                            <input
                                type="range" min="14" max="24" step="1"
                                value={fontSize}
                                onChange={e => setFontSize(Number(e.target.value))}
                            />
                            <span className="typeset-value">{fontSize}px</span>
                        </div>
                        <div className="typeset-row">
                            <label>行距</label>
                            <input
                                type="range" min="1.4" max="2.6" step="0.1"
                                value={lineHeight}
                                onChange={e => setLineHeight(Number(e.target.value))}
                            />
                            <span className="typeset-value">{lineHeight.toFixed(1)}</span>
                        </div>
                        <button className="typeset-reset" onClick={() => { setFontSize(17); setLineHeight(1.9); }}>
                            恢复默认
                        </button>
                    </div>
                )}
            </div>

            {/* 📄 页面边距 */}
            <div className="toolbar-dropdown-wrap" onClick={e => e.stopPropagation()}>
                <button
                    className={`toolbar-btn ${showMargins ? 'active' : ''}`}
                    onClick={() => { closeAll(); setShowMargins(!showMargins); }}
                    title="页面设置"
                    style={{ fontSize: 12 }}
                >
                    📄 <span className="dropdown-arrow">▾</span>
                </button>
                {showMargins && (
                    <div className="typeset-popover" style={{ position: 'absolute', top: '100%', bottom: 'auto', right: 0, marginTop: 4, zIndex: 120 }}>
                        <div className="typeset-row">
                            <label>上下</label>
                            <input
                                type="range" min="40" max="160" step="8"
                                value={margins.y}
                                onChange={e => setMargins(prev => ({ ...prev, y: Number(e.target.value) }))}
                            />
                            <span className="typeset-value">{margins.y}px</span>
                        </div>
                        <div className="typeset-row">
                            <label>左右</label>
                            <input
                                type="range" min="40" max="160" step="8"
                                value={margins.x}
                                onChange={e => setMargins(prev => ({ ...prev, x: Number(e.target.value) }))}
                            />
                            <span className="typeset-value">{margins.x}px</span>
                        </div>
                        <button className="typeset-reset" onClick={() => setMargins({ x: 96, y: 96 })}>
                            恢复默认
                        </button>
                    </div>
                )}
            </div>

            <div className="toolbar-divider" />

            {/* 列表和引用 */}
            <div className="toolbar-group">
                <button className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBulletList().run()} title="无序列表">• 列</button>
                <button className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="有序列表">1. 列</button>
                <button className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleTaskList().run()} title="任务列表">☑ 任</button>
                <button className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="引用块">❝ 引</button>
                <button className={`toolbar-btn ${editor.isActive('codeBlock') ? 'active' : ''}`} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="代码块">&lt;/&gt;</button>
                <button className="toolbar-btn" onClick={() => {
                    openMathEditor('', (latex) => {
                        editor.chain().focus().insertContent({ type: 'mathInline', attrs: { latex } }).run();
                    });
                }} title="插入公式 (也可直接输入 $公式$)">∑</button>
                <button className="toolbar-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="分割线">——</button>
            </div>
        </div>
    );
}

// ==================== 状态栏 ====================
function StatusBar({ editor, pageCount }) {
    if (!editor) return null;

    const characterCount = editor.storage.characterCount;
    const chars = characterCount?.characters() ?? 0;
    const words = editor.getText().replace(/\s/g, '').length;

    return (
        <div className="status-bar">
            <div className="status-bar-left">
                <span>{words} 字</span>
                <span>{chars} 字符</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>共 {pageCount} 页</span>
            </div>
            <div className="status-bar-right">
                <span className="status-bar-shortcut">Ctrl+J AI助手</span>
                <span>自动保存</span>
                <span style={{ opacity: 0.5, fontSize: '11px' }}>© 2026 YuanShiJiLoong</span>
            </div>
        </div>
    );
}
