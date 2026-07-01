// ===================== 常量定义（和原课程设计C代码一致） =====================
const M = 19;          // 哈希表模数
const HASH_LEN = 20;   // 哈希表总长度
const TOP_N = 10;      // 排行榜显示前10名
const STORAGE_KEY = 'campus_vote_data';
const LOG_KEY = 'campus_vote_log';

// ===================== 数据结构定义 =====================
// 哈希表节点：存储学生全部信息
function HashNode(name, grade, story) {
    this.py = name;        // 姓名拼音
    this.k = 0;            // 哈希关键字（拼音ASCII码之和）
    this.grade = grade;    // 班级
    this.vote = 0;         // 得票数
    this.si = 0;           // 查找长度
    this.story = story;    // 突出事迹
}

// 二叉排序树节点：用于排行榜排序
function BSTNode(hashNode) {
    this.hashNode = hashNode;
    this.k = hashNode.vote; // 排序关键字：票数
    this.name = hashNode.py; // 次要排序关键字：姓名
    this.lchild = null;     // 左孩子
    this.rchild = null;     // 右孩子
}

// 全局变量
let hashTable = new Array(HASH_LEN).fill(null);
let studentCount = 0; // 当前提名总人数
let editIndex = -1; // 当前编辑的哈希表下标

// ===================== 核心数据结构算法（课程设计考核重点） =====================

// 1. 计算哈希关键字：姓名拼音的ASCII码之和
function getKey(name) {
    let sum = 0;
    for (let i = 0; i < name.length; i++) {
        sum += name.charCodeAt(i);
    }
    return sum;
}

// 2. 哈希函数：关键字对M取模
function hashFunc(key) {
    return key % M;
}

// 3. 冲突解决方法：再哈希法（步长为关键字本身）
function rehash(addr, key) {
    return (addr + key) % M;
}

// ===================== 本地持久化存储 =====================
// 保存数据到本地
function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        hashTable: hashTable,
        studentCount: studentCount
    }));
}

// 从本地读取数据
function loadData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        const obj = JSON.parse(data);
        hashTable = obj.hashTable;
        studentCount = obj.studentCount;
        return true;
    }
    return false;
}

// 添加操作日志
function addLog(content) {
    let logList = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    logList.unshift({ time: timeStr, content: content });
    if (logList.length > 100) logList = logList.slice(0, 100);
    localStorage.setItem(LOG_KEY, JSON.stringify(logList));
}

// ===================== 业务功能实现 =====================

// 功能1：提名学生 / 投票
function insertOrVote(name, grade, story) {
    const key = getKey(name);
    let addr = hashFunc(key);
    let searchLen = 1;

    // 情况1：哈希位置为空 → 直接提名，投第一票
    if (hashTable[addr] === null) {
        const newNode = new HashNode(name, grade, story);
        newNode.k = key;
        newNode.vote = 1;
        newNode.si = searchLen;
        hashTable[addr] = newNode;
        studentCount++;
        saveData();
        addLog(`提名新学生：${name}（${grade}班），初始票数1`);
        return { 
            success: true, 
            type: 'nominate', 
            msg: `恭喜 ${name} 同学被提名为校园优秀青年，已自动投上第一票！` 
        };
    }

    // 情况2：哈希位置有数据，且是同一个学生 → 票数+1
    if (hashTable[addr].k === key && hashTable[addr].py === name && hashTable[addr].grade === grade) {
        hashTable[addr].vote++;
        saveData();
        addLog(`为 ${name}（${grade}班）投票，当前票数${hashTable[addr].vote}`);
        return { 
            success: true, 
            type: 'vote', 
            msg: `您为 ${name} 同学投票成功！当前票数：${hashTable[addr].vote}` 
        };
    }

    // 情况3：发生哈希冲突，用再哈希法循环查找
    while (true) {
        addr = rehash(addr, key);
        searchLen++;

        // 找到空位 → 新增提名
        if (hashTable[addr] === null) {
            const newNode = new HashNode(name, grade, story);
            newNode.k = key;
            newNode.vote = 1;
            newNode.si = searchLen;
            hashTable[addr] = newNode;
            studentCount++;
            saveData();
            addLog(`提名新学生：${name}（${grade}班），初始票数1（冲突后插入）`);
            return { 
                success: true, 
                type: 'nominate', 
                msg: `恭喜 ${name} 同学被提名为校园优秀青年，已自动投上第一票！` 
            };
        }

        // 找到目标学生 → 投票+1
        if (hashTable[addr].k === key && hashTable[addr].py === name && hashTable[addr].grade === grade) {
            hashTable[addr].vote++;
            saveData();
            addLog(`为 ${name}（${grade}班）投票，当前票数${hashTable[addr].vote}`);
            return { 
                success: true, 
                type: 'vote', 
                msg: `您为 ${name} 同学投票成功！当前票数：${hashTable[addr].vote}` 
            };
        }

        // 防止表满死循环
        if (searchLen > HASH_LEN) {
            return { success: false, msg: '提名人数已满，无法继续提名！' };
        }
    }
}

// 功能2：查询指定学生的基本信息
function findStudent(name, grade) {
    const key = getKey(name);
    let addr = hashFunc(key);
    let searchLen = 1;

    if (hashTable[addr] === null) {
        return { success: false, msg: '该同学未被提名！' };
    }

    if (hashTable[addr].k === key && hashTable[addr].py === name && hashTable[addr].grade === grade) {
        return { success: true, data: hashTable[addr] };
    }

    // 冲突后继续查找
    while (true) {
        addr = rehash(addr, key);
        searchLen++;

        if (hashTable[addr] === null) {
            return { success: false, msg: '该同学未被提名！' };
        }

        if (hashTable[addr].k === key && hashTable[addr].py === name && hashTable[addr].grade === grade) {
            return { success: true, data: hashTable[addr] };
        }

        if (searchLen > HASH_LEN) {
            return { success: false, msg: '该同学未被提名！' };
        }
    }
}

// 功能3：获取所有学生信息 + 计算性能指标
function getAllStudents(filterName = '', filterGrade = 0) {
    const list = [];
    let totalSearchLen = 0;
    let totalConflict = 0;
    for (let i = 0; i < HASH_LEN; i++) {
        if (hashTable[i] !== null) {
            // 筛选
            if (filterName && !hashTable[i].py.includes(filterName)) continue;
            if (filterGrade > 0 && hashTable[i].grade !== filterGrade) continue;
            
            list.push({ index: i, data: hashTable[i] });
            totalSearchLen += hashTable[i].si;
            totalConflict += (hashTable[i].si - 1);
        }
    }
    const asl = studentCount > 0 ? (totalSearchLen / studentCount).toFixed(6) : 0;
    const loadFactor = (studentCount / HASH_LEN).toFixed(4);
    return { list, asl, loadFactor, totalConflict };
}

// 功能4：编辑学生信息
function updateStudent(index, grade, story) {
    if (hashTable[index] === null) return false;
    hashTable[index].grade = grade;
    hashTable[index].story = story;
    saveData();
    addLog(`编辑学生信息：${hashTable[index].py}，修改班级和事迹`);
    return true;
}

// ===================== 二叉排序树实现排行榜 =====================

// 向二叉排序树插入节点（优化：票数相同按姓名字典序排序）
function insertBST(hashNode, root) {
    if (root === null) {
        return new BSTNode(hashNode);
    }
    // 先比较票数
    if (hashNode.vote < root.k) {
        root.lchild = insertBST(hashNode, root.lchild);
    } else if (hashNode.vote > root.k) {
        root.rchild = insertBST(hashNode, root.rchild);
    } else {
        // 票数相同，按姓名字典序升序
        if (hashNode.py.localeCompare(root.name) < 0) {
            root.lchild = insertBST(hashNode, root.lchild);
        } else {
            root.rchild = insertBST(hashNode, root.rchild);
        }
    }
    return root;
}

// 逆中序遍历（右-根-左），得到票数降序的前10名
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

// 获取排行榜列表
function getRank() {
    let root = null;
    // 把所有学生插入二叉排序树
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

// 菜单切换功能
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
        
        // 切换到对应面板时刷新数据
        if (btn.dataset.tab === 'all') showAllVotes();
        if (btn.dataset.tab === 'hash') showHashTable();
        if (btn.dataset.tab === 'log') showLog();
        if (btn.dataset.tab === 'rank') showRank();
    });
});

// 提名/投票按钮点击事件
function handleVote() {
    const name = document.getElementById('voteName').value.trim();
    const grade = parseInt(document.getElementById('voteGrade').value);
    const story = document.getElementById('voteStory').value.trim();
    const resultEl = document.getElementById('voteResult');

    // 非法数据校验
    if (!name) {
        resultEl.innerHTML = '<span style="color:red">输入错误：姓名不能为空！</span>';
        return;
    }
    if (isNaN(grade) || grade < 1 || grade > 10) {
        resultEl.innerHTML = '<span style="color:red">输入错误：班级必须是1-10之间的数字！</span>';
        return;
    }

    const res = insertOrVote(name, grade, story);
    resultEl.innerHTML = res.success 
        ? `<span style="color:green">${res.msg}</span>` 
        : `<span style="color:red">${res.msg}</span>`;
    
    // 清空输入框
    document.getElementById('voteName').value = '';
    document.getElementById('voteGrade').value = '';
    document.getElementById('voteStory').value = '';
}

// 查询按钮点击事件
function handleSearch() {
    const name = document.getElementById('searchName').value.trim();
    const grade = parseInt(document.getElementById('searchGrade').value);
    const resultEl = document.getElementById('searchResult');

    if (!name) {
        resultEl.innerHTML = '<span style="color:red">输入错误：姓名不能为空！</span>';
        return;
    }
    if (isNaN(grade) || grade < 1 || grade > 10) {
        resultEl.innerHTML = '<span style="color:red">输入错误：班级必须是1-10之间的数字！</span>';
        return;
    }

    const res = findStudent(name, grade);
    if (res.success) {
        const d = res.data;
        resultEl.innerHTML = `
            <p><strong>姓名：</strong>${d.py}</p>
            <p><strong>班级：</strong>${d.grade}班</p>
            <p><strong>当前票数：</strong>${d.vote}票</p>
            <p><strong>突出事迹：</strong>${d.story || '暂无'}</p>
        `;
    } else {
        resultEl.innerHTML = `<span style="color:red">${res.msg}</span>`;
    }
}

// 显示全部票数
function showAllVotes() {
    const filterName = document.getElementById('filterName').value.trim();
    const filterGrade = parseInt(document.getElementById('filterGrade').value);
    const { list, asl, loadFactor, totalConflict } = getAllStudents(filterName, filterGrade);
    const tbody = document.getElementById('allTableBody');
    tbody.innerHTML = '';
    
    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.data.grade}</td>
            <td>${item.data.py}</td>
            <td>${item.data.vote}</td>
            <td>${item.data.si}</td>
            <td><button class="edit-btn" onclick="openEditModal(${item.index})">编辑</button></td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('aslResult').innerHTML = 
        `平均查找长度：ASL(${studentCount}) = ${asl} &nbsp;&nbsp; 装填因子：α = ${loadFactor} &nbsp;&nbsp; 总冲突次数：${totalConflict}`;
}

// 显示排行榜
function showRank() {
    const rank = getRank();
    const tbody = document.getElementById('rankTableBody');
    tbody.innerHTML = '';
    
    rank.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.grade}</td>
            <td>${item.py}</td>
            <td>${item.vote}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 显示哈希表结构
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
            cell.innerHTML = `<div class="addr">地址 ${i}</div><div>空</div>`;
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
                <div class="si">查找长度：${hashTable[i].si}</div>
            `;
        }
        grid.appendChild(cell);
    }

    info.innerHTML = `
        <div class="hash-info-item">
            <div class="num">${HASH_LEN}</div>
            <div class="label">哈希表总长度</div>
        </div>
        <div class="hash-info-item">
            <div class="num">${usedCount}</div>
            <div class="label">已占用槽位</div>
        </div>
        <div class="hash-info-item">
            <div class="num">${conflictCount}</div>
            <div class="label">冲突槽位数</div>
        </div>
        <div class="hash-info-item">
            <div class="num">${(usedCount/HASH_LEN*100).toFixed(1)}%</div>
            <div class="label">装填因子</div>
        </div>
    `;
}

// 显示操作日志
function showLog() {
    const logList = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const container = document.getElementById('logList');
    container.innerHTML = '';
    
    if (logList.length === 0) {
        container.innerHTML = '<div class="log-item"><span class="content">暂无操作记录</span></div>';
        return;
    }
    
    logList.forEach(item => {
        const div = document.createElement('div');
        div.className = 'log-item';
        div.innerHTML = `<span class="content">${item.content}</span><span class="time">${item.time}</span>`;
        container.appendChild(div);
    });
}

// 编辑弹窗相关
function openEditModal(index) {
    editIndex = index;
    const data = hashTable[index];
    document.getElementById('editGrade').value = data.grade;
    document.getElementById('editStory').value = data.story || '';
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    editIndex = -1;
}

function saveEdit() {
    const grade = parseInt(document.getElementById('editGrade').value);
    const story = document.getElementById('editStory').value.trim();
    
    if (isNaN(grade) || grade < 1 || grade > 10) {
        alert('班级必须是1-10之间的数字！');
        return;
    }
    
    updateStudent(editIndex, grade, story);
    closeEditModal();
    showAllVotes();
}

// 重置系统
function resetSystem() {
    if (!confirm('确定要重置系统吗？所有提名和票数都会恢复初始状态！')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LOG_KEY);
    hashTable = new Array(HASH_LEN).fill(null);
    studentCount = 0;
    initStudents();
    showAllVotes();
    addLog('系统重置，恢复初始数据');
    alert('系统已重置！');
}

// 清空日志
function clearLog() {
    if (!confirm('确定要清空所有操作日志吗？')) return;
    localStorage.removeItem(LOG_KEY);
    showLog();
}

// ===================== 初始化：预置10名初始提名学生 =====================
function initStudents() {
    const initData = [
        { name: 'bianhan', grade: 2, vote: 6, story: '学习成绩优异，积极参与社团活动' },
        { name: 'dengtao', grade: 6, vote: 11, story: '校级奖学金获得者，志愿服务时长超100小时' },
        { name: 'dingjun', grade: 6, vote: 14, story: '专业排名第一，获省级竞赛一等奖' },
        { name: 'fanyongliang', grade: 9, vote: 9, story: '优秀学生干部，组织多项校园活动' },
        { name: 'wangchen', grade: 6, vote: 9, story: '创新创业大赛获奖者' },
        { name: 'wangrong', grade: 2, vote: 4, story: '积极参与社会实践' },
        { name: 'zhouyu', grade: 4, vote: 12, story: '文体活动积极分子' },
        { name: 'liuyuanlong', grade: 7, vote: 2, story: '乐于助人，团结同学' },
        { name: 'wuliang', grade: 8, vote: 3, story: '刻苦钻研专业知识' },
        { name: 'wulingjie', grade: 5, vote: 10, story: '优秀共青团员' }
    ];

    initData.forEach(item => {
        const key = getKey(item.name);
        let addr = hashFunc(key);
        let searchLen = 1;

        if (hashTable[addr] === null) {
            const node = new HashNode(item.name, item.grade, item.story);
            node.k = key;
            node.vote = item.vote;
            node.si = searchLen;
            hashTable[addr] = node;
            studentCount++;
            return;
        }

        // 冲突处理
        while (hashTable[addr] !== null) {
            addr = rehash(addr, key);
            searchLen++;
        }
        const node = new HashNode(item.name, item.grade, item.story);
        node.k = key;
        node.vote = item.vote;
        node.si = searchLen;
        hashTable[addr] = node;
        studentCount++;
    });
    saveData();
    addLog('系统初始化完成，加载初始提名学生');
}

// 页面加载完成后自动初始化
window.onload = function() {
    // 先尝试读取本地数据，没有的话初始化
    if (!loadData()) {
        initStudents();
    }
    showAllVotes();
    showRank();
};