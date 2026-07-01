// ===================== 后端地址（已经帮你填好了） =====================
const BACKEND_URL = "https://celebrated-consideration-production-f3d6.up.railway.app";

// ===================== 常量定义（课程设计核心逻辑完全保留） =====================
const M = 19;          // 哈希表模数
const HASH_LEN = 20;   // 哈希表总长度
const TOP_N = 10;      // 排行榜显示前10名
const LOG_KEY = 'campus_vote_log';

// ===================== 数据结构定义 =====================
function HashNode(name, major, gradeYear, story) {
    this.py = name;
    this.k = 0;
    this.major = major;
    this.gradeYear = gradeYear;
    this.vote = 0;
    this.si = 0;
    this.story = story;
}

function BSTNode(hashNode) {
    this.hashNode = hashNode;
    this.k = hashNode.vote;
    this.name = hashNode.py;
    this.lchild = null;
    this.rchild = null;
}

let hashTable = new Array(HASH_LEN).fill(null);
let studentCount = 0;
let editIndex = -1;

// ===================== 核心数据结构算法（完全保留） =====================
function getKey(name) {
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
        sum += name.charCodeAt(i);
    }
    return sum;
}

function hashFunc(key) {
    return key % M;
}

function rehash(addr, key) {
    return (addr + key) % M;
}

// ===================== 从云端加载数据，构建本地哈希表 =====================
async function loadDataFromCloud() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/students`);
        const result = await res.json();
        
        if (!result.success) {
            console.error('加载数据失败:', result.msg);
            return false;
        }

        // 重置哈希表
        hashTable = new Array(HASH_LEN).fill(null);
        studentCount = result.data.length;
        
        // 把云端数据按哈希算法重新填入本地哈希表（保证哈希结构正确）
        result.data.forEach(item => {
            const node = new HashNode(item.py, item.major, item.grade_year, item.story);
            node.k = item.k;
            node.vote = item.vote;
            node.si = item.si;
            
            // 按哈希算法找到正确位置
            let addr = hashFunc(item.k);
            let si = 1;
            while (hashTable[addr] !== null && si < item.si) {
                addr = rehash(addr, item.k);
                si++;
            }
            hashTable[addr] = node;
        });
        return true;
    } catch (e) {
        console.error('连接后端失败:', e);
        return false;
    }
}

// 本地日志
function addLog(content) {
    let logList = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    logList.unshift({ time: timeStr, content: content });
    if (logList.length > 100) logList = logList.slice(0, 100);
    localStorage.setItem(LOG_KEY, JSON.stringify(logList));
}

// ===================== 业务功能实现 =====================
async function insertOrVote(name, major, gradeYear, story) {
    try {
        const res = await fetch(`${BACKEND_URL}/api/vote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, major, gradeYear, story })
        });
        const result = await res.json();
        
        if (result.success) {
            // 操作成功后，重新从云端拉取最新数据
            await loadDataFromCloud();
            addLog(result.type === 'vote' 
                ? `🗳️ 为 ${name}（${major} ${gradeYear}级）投票` 
                : `📝 提名新学生：${name}（${major} ${gradeYear}级）`);
        }
        return result;
    } catch (e) {
        return { success: false, msg: '❌ 连接服务器失败，请稍后重试' };
    }
}

function findStudent(name, major, gradeYear) {
    const key = getKey(name);
    let addr = hashFunc(key);
    let searchLen = 1;

    while (hashTable[addr] !== null && searchLen <= HASH_LEN) {
        if (hashTable[addr].py === name && 
            hashTable[addr].major === major && 
            hashTable[addr].gradeYear === gradeYear) {
            return { success: true, data: hashTable[addr] };
        }
        addr = rehash(addr, key);
        searchLen++;
    }
    return { success: false, msg: '❌ 该同学未被提名！' };
}

function getAllStudents(filterName = '', filterMajor = '') {
    const list = [];
    let totalSearchLen = 0;
    let totalConflict = 0;
    for (let i = 0; i < HASH_LEN; i++) {
        if (hashTable[i] !== null) {
            if (filterName && !hashTable[i].py.includes(filterName)) continue;
            if (filterMajor && hashTable[i].major !== filterMajor) continue;
            
            list.push({ index: i, data: hashTable[i] });
            totalSearchLen += hashTable[i].si;
            totalConflict += (hashTable[i].si - 1);
        }
    }
    const asl = studentCount > 0 ? (totalSearchLen / studentCount).toFixed(6) : 0;
    const loadFactor = (studentCount / HASH_LEN).toFixed(4);
    return { list, asl, loadFactor, totalConflict };
}

async function updateStudent(index, major, gradeYear, story) {
    if (hashTable[index] === null) return false;
    const name = hashTable[index].py;
    
    try {
        const res = await fetch(`${BACKEND_URL}/api/student`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, major, gradeYear, story })
        });
        const result = await res.json();
        
        if (result.success) {
            await loadDataFromCloud();
            addLog(`✏️ 编辑学生信息：${name}`);
        }
        return result.success;
    } catch (e) {
        return false;
    }
}

// ===================== 二叉排序树排行榜（完全保留） =====================
function insertBST(hashNode, root) {
    if (root === null) {
        return new BSTNode(hashNode);
    }
    if (hashNode.vote < root.k) {
        root.lchild = insertBST(hashNode, root.lchild);
    } else if (hashNode.vote > root.k) {
        root.rchild = insertBST(hashNode, root.rchild);
    } else {
        if (hashNode.py.localeCompare(root.name, 'zh-CN') < 0) {
            root.lchild = insertBST(hashNode, root.lchild);
        } else {
            root.rchild = insertBST(hashNode, root.rchild);
        }
    }
    return root;
}

let rankList = [];
let rankCount = 0;
function reverseInOrder(root) {
    if (root !== null && rankCount < TOP_N) {
        reverseInOrder(root.rchild);
        if (rankCount < TOP_N) {
            rankList.push(root.hashNode);
            rankCount++;
        }
        reverseInOrder(root.lchild);
    }
}

function getRank() {
    let root = null;
    for (let i = 0; i < HASH_LEN; i++) {
        if (hashTable[i] !== null) {
            root = insertBST(hashTable[i], root);
        }
    }
    rankList = [];
    rankCount = 0;
    reverseInOrder(root);
    return rankList;
}

// ===================== 页面交互逻辑 =====================
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        
        if (btn.dataset.tab === 'all') showAllVotes();
        if (btn.dataset.tab === 'hash') showHashTable();
        if (btn.dataset.tab === 'log') showLog();
        if (btn.dataset.tab === 'rank') showRank();
    });
});

async function handleVote() {
    const name = document.getElementById('voteName').value.trim();
    const major = document.getElementById('voteMajor').value;
    const gradeYear = parseInt(document.getElementById('voteGrade').value);
    const story = document.getElementById('voteStory').value.trim();
    const resultEl = document.getElementById('voteResult');

    if (!name) {
        resultEl.innerHTML = '<span style="color:red">❌ 输入错误：姓名不能为空！</span>';
        return;
    }
    if (isNaN(gradeYear) || gradeYear < 2020 || gradeYear > 2030) {
        resultEl.innerHTML = '<span style="color:red">❌ 输入错误：请输入正确的入学年级（2020-2030）！</span>';
        return;
    }

    resultEl.innerHTML = '<span>⏳ 提交中...</span>';
    const res = await insertOrVote(name, major, gradeYear, story);
    resultEl.innerHTML = `<span style="color:${res.success ? 'green' : 'red'}">${res.msg}</span>`;
    
    document.getElementById('voteName').value = '';
    document.getElementById('voteGrade').value = '';
    document.getElementById('voteStory').value = '';
    showAllVotes();
}

function handleSearch() {
    const name = document.getElementById('searchName').value.trim();
    const major = document.getElementById('searchMajor').value;
    const gradeYear = parseInt(document.getElementById('searchGrade').value);
    const resultEl = document.getElementById('searchResult');

    if (!name) {
        resultEl.innerHTML = '<span style="color:red">❌ 输入错误：姓名不能为空！</span>';
        return;
    }
    if (isNaN(gradeYear) || gradeYear < 2020 || gradeYear > 2030) {
        resultEl.innerHTML = '<span style="color:red">❌ 输入错误：请输入正确的入学年级！</span>';
        return;
    }

    const res = findStudent(name, major, gradeYear);
    if (res.success) {
        const d = res.data;
        resultEl.innerHTML = `
            <p><strong>👤 姓名：</strong>${d.py}</p>
            <p><strong>🎓 专业：</strong>${d.major}</p>
            <p><strong>📅 年级：</strong>${d.gradeYear}级</p>
            <p><strong>🗳️ 当前票数：</strong>${d.vote}票</p>
            <p><strong>📝 突出事迹：</strong>${d.story || '暂无'}</p>
        `;
    } else {
        resultEl.innerHTML = `<span style="color:red">${res.msg}</span>`;
    }
}

function showAllVotes() {
    const filterName = document.getElementById('filterName').value.trim();
    const filterMajor = document.getElementById('filterMajor').value;
    const { list, asl, loadFactor, totalConflict } = getAllStudents(filterName, filterMajor);
    const tbody = document.getElementById('allTableBody');
    tbody.innerHTML = '';
    
    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.data.major}</td>
            <td>${item.data.gradeYear}级</td>
            <td>${item.data.py}</td>
            <td>${item.data.vote}</td>
            <td>${item.data.si}</td>
            <td><button class="edit-btn" onclick="openEditModal(${item.index})">✏️ 编辑</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('aslResult').innerHTML = 
        `📏 平均查找长度：ASL(${studentCount}) = ${asl} &nbsp;&nbsp; 📦 装填因子：α = ${loadFactor} &nbsp;&nbsp; ⚠️ 总冲突次数：${totalConflict}`;
}

function showRank() {
    const rank = getRank();
    const tbody = document.getElementById('rankTableBody');
    tbody.innerHTML = '';
    
    rank.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.major}</td>
            <td>${item.gradeYear}级</td>
            <td>${item.py}</td>
            <td>${item.vote}</td>
        `;
        tbody.appendChild(tr);
    });
}

function showHashTable() {
    const grid = document.getElementById('hashGrid');
    const info = document.getElementById('hashInfo');
    grid.innerHTML = '';
    
    let conflictCount = 0;
    let usedCount = 0;
    for (let i = 0; i < HASH_LEN; i++) {
        const cell = document.createElement('div');
        cell.className = 'hash-cell';
        
        if (hashTable[i] === null) {
            cell.classList.add('empty');
            cell.innerHTML = `<div class="addr">地址 ${i}</div><div>⬜ 空</div>`;
        } else {
            usedCount++;
            if (hashTable[i].si > 1) {
                cell.classList.add('conflict');
                conflictCount++;
            } else {
                cell.classList.add('normal');
            }
            cell.innerHTML = `
                <div class="addr">地址 ${i}</div>
                <div class="name">${hashTable[i].py}</div>
                <div class="si">📏 查找长度：${hashTable[i].si}</div>
            `;
        }
        grid.appendChild(cell);
    }

    info.innerHTML = `
        <div class="hash-info-item">
            <div class="num">${HASH_LEN}</div>
            <div class="label">📏 哈希表总长度</div>
        </div>
        <div class="hash-info-item">
            <div class="num">${usedCount}</div>
            <div class="label">✅ 已占用槽位</div>
        </div>
        <div class="hash-info-item">
            <div class="num">${conflictCount}</div>
            <div class="label">⚠️ 冲突槽位数</div>
        </div>
        <div class="hash-info-item">
            <div class="num">${(usedCount/HASH_LEN*100).toFixed(1)}%</div>
            <div class="label">📦 装填因子</div>
        </div>
    `;
}

function showLog() {
    const logList = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const container = document.getElementById('logList');
    container.innerHTML = '';
    
    if (logList.length === 0) {
        container.innerHTML = '<div class="log-item"><span class="content">📭 暂无操作记录</span></div>';
        return;
    }
    
    logList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `<span class="content">${item.content}</span><span class="time">⏰ ${item.time}</span>`;
        container.appendChild(div);
    });
}

// 编辑弹窗
function openEditModal(index) {
    editIndex = index;
    const data = hashTable[index];
    document.getElementById('editMajor').value = data.major;
    document.getElementById('editGrade').value = data.gradeYear;
    document.getElementById('editStory').value = data.story || '';
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editIndex = -1;
}

async function saveEdit() {
    const major = document.getElementById('editMajor').value;
    const gradeYear = parseInt(document.getElementById('editGrade').value);
    const story = document.getElementById('editStory').value.trim();
    
    if (isNaN(gradeYear) || gradeYear < 2020 || gradeYear > 2030) {
        alert('❌ 请输入正确的入学年级（2020-2030）！');
        return;
    }
    
    await updateStudent(editIndex, major, gradeYear, story);
    closeEditModal();
    showAllVotes();
}

// 重置系统
async function resetSystem() {
    if (!confirm('🔔 确定要重置系统吗？所有提名和票数都会恢复初始状态！')) return;
    
    try {
        await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST' });
        await loadDataFromCloud();
        showAllVotes();
        addLog('🔄 系统重置，恢复初始数据');
        alert('✅ 系统已重置！');
    } catch (e) {
        alert('❌ 重置失败，请稍后重试');
    }
}

function clearLog() {
    if (!confirm('🔔 确定要清空所有操作日志吗？')) return;
    localStorage.removeItem(LOG_KEY);
    showLog();
}

// 页面初始化
window.onload = async function() {
    await loadDataFromCloud();
    showAllVotes();
    showRank();
    
    // 每5秒自动从云端拉取最新数据，实现多人同步
    setInterval(async () => {
        await loadDataFromCloud();
        showAllVotes();
        showRank();
    }, 5000);
};