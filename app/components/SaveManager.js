'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useI18n } from '../lib/useI18n';
import { restoreBrowserFromSaveData } from '../lib/persistence';
import { X, Save, FolderInput, FolderOutput, Trash2, Download, Upload, Edit3, Check } from 'lucide-react';

export default function SaveManager() {
    const { showSaveManager, setShowSaveManager, showToast, activeSaveName, setActiveSave } = useAppStore();
    const { t } = useI18n();
    const [saves, setSaves] = useState([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');

    const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.listSaves;

    const loadSaves = useCallback(async () => {
        if (!isElectron) return;
        setLoading(true);
        try {
            const result = await window.electronAPI.listSaves();
            if (result.success) setSaves(result.saves || []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [isElectron]);

    useEffect(() => {
        if (showSaveManager) loadSaves();
    }, [showSaveManager, loadSaves]);

    if (!showSaveManager) return null;

    const onClose = () => setShowSaveManager(false);

    const handleCreate = async () => {
        const name = newName.trim() || new Date().toLocaleString();
        setCreating(true);
        try {
            const result = await window.electronAPI.createSave(name);
            if (result.success) {
                showToast(t('saveManager.createSuccess'), 'success');
                setActiveSave(result.fileName, name);
                setNewName('');
                await loadSaves();
            } else {
                showToast(t('saveManager.createFailed').replace('{error}', result.error), 'error');
            }
        } catch (e) {
            showToast(t('saveManager.createFailed').replace('{error}', e.message), 'error');
        }
        setCreating(false);
    };

    const handleLoad = async (save) => {
        if (save.fileName === activeSaveName) return;
        if (!confirm(t('saveManager.confirmLoad'))) return;
        try {
            // 切换前先保存当前存档
            if (activeSaveName && window.electronAPI.updateSave) {
                await window.electronAPI.updateSave(activeSaveName).catch(() => {});
            }
            const result = await window.electronAPI.loadSave(save.fileName);
            if (result.success) {
                // 直接把存档数据写入浏览器存储
                await restoreBrowserFromSaveData(result.browserData || {});

                // 保留 UI 设置 + 设置活跃存档标记
                localStorage.setItem('author-active-save', save.fileName);
                localStorage.setItem('author-active-save-display', save.name || save.fileName.replace(/\.json$/, ''));

                // 重启应用
                if (window.electronAPI?.relaunchApp) {
                    window.electronAPI.relaunchApp();
                } else {
                    window.location.reload();
                }
            } else {
                showToast(t('saveManager.loadFailed').replace('{error}', result.error), 'error');
            }
        } catch (e) {
            showToast(t('saveManager.loadFailed').replace('{error}', e.message), 'error');
        }
    };

    const handleExport = async () => {
        try {
            const result = await window.electronAPI.exportSave();
            if (result.canceled) return;
            if (result.success) {
                showToast(t('saveManager.exportSuccess'), 'success');
            } else {
                showToast(t('saveManager.exportFailed').replace('{error}', result.error), 'error');
            }
        } catch (e) {
            showToast(t('saveManager.exportFailed').replace('{error}', e.message), 'error');
        }
    };

    const handleImport = async () => {
        try {
            const result = await window.electronAPI.importSave();
            if (result.canceled) return;
            if (result.success) {
                showToast(t('saveManager.importSuccess').replace('{name}', result.name), 'success');
                if (result.loaded && result.browserData) {
                    await restoreBrowserFromSaveData(result.browserData);

                    localStorage.setItem('author-active-save', result.name + '.json');
                    localStorage.setItem('author-active-save-display', result.name);

                    if (window.electronAPI?.relaunchApp) {
                        window.electronAPI.relaunchApp();
                    } else {
                        window.location.reload();
                    }
                } else {
                    await loadSaves();
                }
            } else {
                showToast(t('saveManager.importFailed').replace('{error}', result.error), 'error');
            }
        } catch (e) {
            showToast(t('saveManager.importFailed').replace('{error}', e.message), 'error');
        }
    };

    const handleDelete = async (fileName) => {
        if (fileName === activeSaveName) return;
        if (!confirm(t('saveManager.confirmDelete'))) return;
        try {
            const result = await window.electronAPI.deleteSave(fileName);
            if (result.success) {
                showToast(t('saveManager.deleteSuccess'), 'success');
                await loadSaves();
            } else {
                showToast(t('saveManager.deleteFailed').replace('{error}', result.error), 'error');
            }
        } catch (e) {
            showToast(t('saveManager.deleteFailed').replace('{error}', e.message), 'error');
        }
    };

    const handleRename = async (fileName) => {
        const newN = renameValue.trim();
        if (!newN) { setRenamingId(null); return; }
        try {
            const result = await window.electronAPI.renameSave(fileName, newN);
            if (result.success) {
                if (fileName === activeSaveName && result.fileName) {
                    setActiveSave(result.fileName, newN);
                }
                showToast(t('saveManager.renameSuccess'), 'success');
                setRenamingId(null);
                await loadSaves();
            } else {
                showToast(t('saveManager.renameFailed').replace('{error}', result.error), 'error');
            }
        } catch (e) {
            showToast(t('saveManager.renameFailed').replace('{error}', e.message), 'error');
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18 }}>{t('saveManager.title')}</h2>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{t('saveManager.subtitle')}</p>
                    </div>
                    <button className="icon-btn" onClick={onClose}><X size={18} /></button>
                </div>

                {!isElectron ? (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>{t('saveManager.notElectron')}</p>
                ) : (
                    <>
                        {/* Create + Import/Export actions */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder={t('saveManager.namePlaceholder')}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                style={{ flex: 1, minWidth: 140, padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                            />
                            <button className="btn btn-primary" disabled={creating} onClick={handleCreate} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                <Save size={14} /> {creating ? t('saveManager.creating') : t('saveManager.createBtn')}
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            <button className="btn btn-secondary" onClick={handleImport} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                <FolderInput size={14} /> {t('saveManager.importBtn')}
                            </button>
                            <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                                <FolderOutput size={14} /> {t('saveManager.exportCurrentBtn')}
                            </button>
                        </div>

                        {/* Save list */}
                        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                            {loading ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>{t('saveManager.loading')}</p>
                            ) : saves.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>{t('saveManager.empty')}</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {saves.map(save => {
                                        const isActive = save.fileName === activeSaveName;
                                        return (
                                        <div key={save.fileName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: isActive ? '2px solid var(--accent, #4f46e5)' : '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {renamingId === save.fileName ? (
                                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                                        <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename(save.fileName)} autoFocus style={{ flex: 1, padding: '2px 6px', fontSize: 13, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', background: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                                                        <button className="icon-btn" onClick={() => handleRename(save.fileName)}><Check size={14} /></button>
                                                        <button className="icon-btn" onClick={() => setRenamingId(null)}><X size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {save.name}
                                                            {isActive && <span style={{ fontSize: 11, color: 'var(--accent, #4f46e5)', marginLeft: 6, fontWeight: 600 }}>{t('saveManager.activeBadge') || '当前'}</span>}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {save.createdAt ? new Date(save.createdAt).toLocaleString() : '—'}
                                                            {save.fileCount != null && ` · ${save.fileCount} ${t('saveManager.fileCount')}`}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            {renamingId !== save.fileName && (
                                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                                    {!isActive && <button className="icon-btn" title={t('saveManager.loadBtn')} onClick={() => handleLoad(save)}><Download size={15} /></button>}
                                                    <button className="icon-btn" title="Rename" onClick={() => { setRenamingId(save.fileName); setRenameValue(save.name); }}><Edit3 size={15} /></button>
                                                    {!isActive && <button className="icon-btn" title={t('saveManager.deleteBtn')} onClick={() => handleDelete(save.fileName)} style={{ color: 'var(--text-danger, #e53e3e)' }}><Trash2 size={15} /></button>}
                                                </div>
                                            )}
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
