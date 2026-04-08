import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// 数据持久化 API — 将所有用户数据存储到本地文件系统
// 每个用户有独立的目录（通过 userId cookie 隔离）

const DATA_ROOT = process.env.DATA_DIR || path.join(process.cwd(), 'data');

// 从请求中提取或创建用户ID
function getUserId(request) {
    // 优先从 cookie 读取
    const cookies = request.headers.get('cookie') || '';
    const match = cookies.match(/author-uid=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return null;
}

// 确保目录存在
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (e) {
        if (e.code !== 'EEXIST') throw e;
    }
}

// key → 文件路径映射（防止路径穿越）
function resolveFilePath(userId, key) {
    // 仅允许字母、数字、连字符、下划线、斜杠、点
    const safeKey = key.replace(/[^a-zA-Z0-9\-_./]/g, '');
    if (!safeKey || safeKey.includes('..')) {
        throw new Error('Invalid storage key');
    }
    const userDir = path.join(DATA_ROOT, userId);
    const filePath = path.join(userDir, safeKey + '.json');

    // 安全检查：确保路径在用户目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedUserDir = path.resolve(userDir);
    if (!resolvedPath.startsWith(resolvedUserDir)) {
        throw new Error('Path traversal detected');
    }

    return filePath;
}

// 安全读取 JSON 文件（带重试，防止读到写入一半的数据）
async function safeReadJson(filePath, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        const content = await fs.readFile(filePath, 'utf-8');
        try {
            return JSON.parse(content);
        } catch (parseErr) {
            // JSON 解析失败 = 可能读到了写入一半的文件，等待后重试
            if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 80 * (i + 1)));
                continue;
            }
            throw parseErr; // 最后一次仍然失败，抛出错误
        }
    }
}

// GET /api/storage?key=xxx — 读取数据
export async function GET(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const filePath = resolveFilePath(userId, key);

        try {
            const data = await safeReadJson(filePath);
            return NextResponse.json({ data });
        } catch (e) {
            if (e.code === 'ENOENT') {
                // 尝试自动领养：当前用户目录为空但 data/ 下有其他用户数据
                // 用于跨电脑拷贝项目目录后 cookie userId 不同的场景
                const adopted = await tryAdoptOrphanData(userId);
                if (adopted) {
                    // 领养成功，重试读取
                    try {
                        const data2 = await safeReadJson(filePath);
                        return NextResponse.json({ data: data2 });
                    } catch { }
                }
                return NextResponse.json({ data: null });
            }
            throw e;
        }
    } catch (error) {
        console.error('Storage GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * 自动领养孤儿数据：如果当前用户目录不存在或为空，且 data/ 下恰好只有一个其他用户目录，
 * 则将其重命名为当前用户目录，实现数据无缝继承。
 * 适用场景：用户拷贝项目目录到另一台电脑，浏览器生成了新的 userId。
 */
async function tryAdoptOrphanData(currentUserId) {
    try {
        const currentUserDir = path.join(DATA_ROOT, currentUserId);
        
        // 检查当前用户目录是否已有数据
        try {
            const entries = await fs.readdir(currentUserDir);
            if (entries.length > 0) return false; // 已有数据，不需要领养
        } catch (e) {
            if (e.code !== 'ENOENT') return false;
            // 目录不存在，继续尝试领养
        }

        // 扫描 data/ 下的所有用户目录
        let allDirs;
        try {
            allDirs = await fs.readdir(DATA_ROOT, { withFileTypes: true });
        } catch {
            return false; // data/ 目录不存在
        }

        const otherDirs = allDirs
            .filter(d => d.isDirectory() && d.name !== currentUserId && !d.name.startsWith('_'))
            .map(d => d.name);

        if (otherDirs.length !== 1) return false; // 只有恰好一个其他用户时才自动领养

        const orphanDir = path.join(DATA_ROOT, otherDirs[0]);
        
        // 检查孤儿目录是否有数据
        try {
            const orphanEntries = await fs.readdir(orphanDir);
            if (orphanEntries.length === 0) return false;
        } catch {
            return false;
        }

        // 重命名孤儿目录为当前用户目录
        await fs.rename(orphanDir, currentUserDir);
        console.log(`[Storage] Auto-adopted data from user ${otherDirs[0]} → ${currentUserId}`);
        return true;
    } catch (e) {
        console.warn('[Storage] Auto-adopt failed:', e.message);
        return false;
    }
}

// POST /api/storage — 写入数据 { key, value }
export async function POST(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        const { key, value } = await request.json();
        if (!key) {
            return NextResponse.json({ error: 'Missing key' }, { status: 400 });
        }

        const filePath = resolveFilePath(userId, key);
        await ensureDir(path.dirname(filePath));

        // 原子写入：先写临时文件，再重命名，防止并发读取到半截数据
        const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
        await fs.writeFile(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
        await fs.rename(tmpPath, filePath);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Storage POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/storage?key=xxx — 删除数据
export async function DELETE(request) {
    try {
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'No user ID' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const key = searchParams.get('key');
        if (!key) {
            return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
        }

        const filePath = resolveFilePath(userId, key);

        try {
            await fs.unlink(filePath);
        } catch (e) {
            if (e.code !== 'ENOENT') throw e;
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Storage DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
