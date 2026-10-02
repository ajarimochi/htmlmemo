"use strict";

const STORAGE_KEY = "markdown-memo-app:v2";

const newMemoButton = document.querySelector("#newMemoButton");
const newFolderButton = document.querySelector("#newFolderButton");
const sidebar = document.querySelector("#sidebar");
const sidebarToggle = document.querySelector("#sidebarToggle");

const folderList = document.querySelector("#folderList");
const memoList = document.querySelector("#memoList");
const memoCount = document.querySelector("#memoCount");
const searchInput = document.querySelector("#searchInput");

const editor = document.querySelector("#editor");
const titleInput = document.querySelector("#titleInput");
const contentInput = document.querySelector("#contentInput");
const folderSelect = document.querySelector("#folderSelect");
const currentFolderName = document.querySelector("#currentFolderName");
const saveStatus = document.querySelector("#saveStatus");
const dateInfo = document.querySelector("#dateInfo");

const copyButton = document.querySelector("#copyButton");
const deleteButton = document.querySelector("#deleteButton");
const toolbar = document.querySelector(".toolbar");
const message = document.querySelector("#message");

let state = loadState();
let selectedMemoId = state.memos[0]?.id || null;
let selectedFolderId = "all";
let saveTimer = null;

if (state.memos.length === 0) {
  createInitialMemo();
}

render();

newMemoButton.addEventListener("click", createMemo);
newFolderButton.addEventListener("click", createFolder);
sidebarToggle.addEventListener("click", toggleSidebar);

searchInput.addEventListener("input", renderMemoList);
copyButton.addEventListener("click", copyMemo);
deleteButton.addEventListener("click", deleteSelectedMemo);

titleInput.addEventListener("input", updateSelectedMemo);
contentInput.addEventListener("input", updateSelectedMemo);

folderSelect.addEventListener("change", () => {
  const memo = getSelectedMemo();

  if (!memo) {
    return;
  }

  memo.folderId = folderSelect.value;
  memo.updatedAt = new Date().toISOString();

  saveState();
  renderFolderList();
  renderMemoList();
  renderEditor();
});

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  if (button.dataset.insert !== undefined) {
    insertText(button.dataset.insert);
  }

  if (button.dataset.wrap !== undefined) {
    wrapSelectedText(button.dataset.wrap);
  }
});

function loadState() {
  const defaultState = {
    folders: [
      { id: "inbox", name: "受信箱" }
    ],
    memos: []
  };

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return defaultState;
    }

    const parsed = JSON.parse(saved);

    return {
      folders: Array.isArray(parsed.folders) && parsed.folders.length
        ? parsed.folders
        : defaultState.folders,
      memos: Array.isArray(parsed.memos)
        ? parsed.memos.map(normalizeMemo)
        : []
    };
  } catch (error) {
    console.error("データの読み込みに失敗しました", error);
    return defaultState;
  }
}

function normalizeMemo(memo) {
  const now = new Date().toISOString();

  return {
    id: memo.id || createId("memo"),
    title: typeof memo.title === "string" ? memo.title : "",
    content: typeof memo.content === "string" ? memo.content : "",
    folderId: memo.folderId || "inbox",
    createdAt: memo.createdAt || now,
    updatedAt: memo.updatedAt || memo.createdAt || now
  };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    saveStatus.textContent = "保存済み";
  } catch (error) {
    console.error("データの保存に失敗しました", error);
    saveStatus.textContent = "保存できません";
  }
}

function createInitialMemo() {
  const now = new Date().toISOString();

  const memo = {
    id: createId("memo"),
    title: "",
    content: "",
    folderId: "inbox",
    createdAt: now,
    updatedAt: now
  };

  state.memos.push(memo);
  selectedMemoId = memo.id;
  saveState();
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSelectedMemo() {
  return state.memos.find((memo) => memo.id === selectedMemoId) || null;
}

function getFolderName(folderId) {
  return state.folders.find((folder) => folder.id === folderId)?.name || "受信箱";
}

function render() {
  renderFolderList();
  renderMemoList();
  renderEditor();
}

function renderFolderList() {
  folderList.replaceChildren();

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className =
    `folder-item ${selectedFolderId === "all" ? "active" : ""}`;
  allButton.innerHTML =
    `<span>すべてのメモ</span><small>${state.memos.length}</small>`;

  allButton.addEventListener("click", () => {
    selectedFolderId = "all";
    renderFolderList();
    renderMemoList();
  });

  folderList.appendChild(allButton);

  state.folders.forEach((folder) => {
    const count = state.memos.filter(
      (memo) => memo.folderId === folder.id
    ).length;

    const wrapper = document.createElement("div");
    wrapper.className = "folder-row";

    const folderButton = document.createElement("button");
    folderButton.type = "button";
    folderButton.className =
      `folder-item ${selectedFolderId === folder.id ? "active" : ""}`;

    const label = document.createElement("span");
    label.textContent = `📁 ${folder.name}`;

    const countLabel = document.createElement("small");
    countLabel.textContent = count;

    folderButton.append(label, countLabel);

    folderButton.addEventListener("click", () => {
      selectedFolderId = folder.id;
      renderFolderList();
      renderMemoList();
    });

    wrapper.appendChild(folderButton);

    if (folder.id !== "inbox") {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.textContent = "×";
      removeButton.title = `${folder.name}を削除`;
      removeButton.addEventListener("click", () => deleteFolder(folder.id));
      wrapper.appendChild(removeButton);
    }

    folderList.appendChild(wrapper);
  });
}

function renderMemoList() {
  const keyword = searchInput.value.trim().toLowerCase();

  const filteredMemos = state.memos
    .filter((memo) => {
      const matchesFolder =
        selectedFolderId === "all" ||
        memo.folderId === selectedFolderId;

      const matchesSearch =
        !keyword ||
        memo.title.toLowerCase().includes(keyword) ||
        memo.content.toLowerCase().includes(keyword);

      return matchesFolder && matchesSearch;
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  memoCount.textContent = `${filteredMemos.length}件`;
  memoList.replaceChildren();

  if (!filteredMemos.length) {
    const empty = document.createElement("p");
    empty.textContent = "メモがありません";
    empty.className = "empty-list";
    memoList.appendChild(empty);
    return;
  }

  filteredMemos.forEach((memo) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      `memo-item ${memo.id === selectedMemoId ? "active" : ""}`;

    const title = document.createElement("span");
    title.className = "memo-item-title";
    title.textContent = memo.title.trim() || "無題のメモ";

    const date = document.createElement("span");
    date.className = "memo-item-date";
    date.textContent = formatDate(memo.updatedAt);

    button.append(title, date);

    button.addEventListener("click", () => {
      selectedMemoId = memo.id;
      renderMemoList();
      renderEditor();
      collapseSidebarOnMobile();
    });

    memoList.appendChild(button);
  });
}

function renderEditor() {
  const memo = getSelectedMemo();

  if (!memo) {
    createInitialMemo();
    renderMemoList();
    renderEditor();
    return;
  }

  titleInput.value = memo.title;
  contentInput.value = memo.content;
  currentFolderName.textContent = getFolderName(memo.folderId);

  dateInfo.textContent =
    `作成：${formatDate(memo.createdAt)}　更新：${formatDate(memo.updatedAt)}`;

  renderFolderSelect(memo.folderId);
  saveStatus.textContent = "保存済み";
}

function renderFolderSelect(currentFolderId) {
  folderSelect.replaceChildren();

  state.folders.forEach((folder) => {
    const option = document.createElement("option");
    option.value = folder.id;
    option.textContent = folder.name;
    option.selected = folder.id === currentFolderId;
    folderSelect.appendChild(option);
  });
}

function createMemo() {
  const now = new Date().toISOString();

  const memo = {
    id: createId("memo"),
    title: "",
    content: "",
    folderId: selectedFolderId === "all" ? "inbox" : selectedFolderId,
    createdAt: now,
    updatedAt: now
  };

  state.memos.unshift(memo);
  selectedMemoId = memo.id;

  saveState();
  render();
  collapseSidebarOnMobile();
  titleInput.focus();
  showMessage("新しいメモを作成しました");
}

function updateSelectedMemo() {
  const memo = getSelectedMemo();

  if (!memo) {
    return;
  }

  memo.title = titleInput.value;
  memo.content = contentInput.value;
  memo.updatedAt = new Date().toISOString();

  saveStatus.textContent = "保存中…";

  window.clearTimeout(saveTimer);

  saveTimer = window.setTimeout(() => {
    saveState();
    renderMemoList();
    renderEditor();
  }, 300);
}

function createFolder() {
  const name = window.prompt("フォルダ名を入力してください");

  if (!name || !name.trim()) {
    return;
  }

  const folder = {
    id: createId("folder"),
    name: name.trim()
  };

  state.folders.push(folder);
  selectedFolderId = folder.id;

  saveState();
  render();
  showMessage("フォルダを作成しました");
}

function deleteFolder(folderId) {
  const folder = state.folders.find((item) => item.id === folderId);

  if (!folder) {
    return;
  }

  const shouldDelete = window.confirm(
    `「${folder.name}」を削除します。中のメモは受信箱へ移動します。`
  );

  if (!shouldDelete) {
    return;
  }

  state.memos.forEach((memo) => {
    if (memo.folderId === folderId) {
      memo.folderId = "inbox";
    }
  });

  state.folders = state.folders.filter((item) => item.id !== folderId);

  if (selectedFolderId === folderId) {
    selectedFolderId = "all";
  }

  saveState();
  render();
  showMessage("フォルダを削除しました");
}

function deleteSelectedMemo() {
  const memo = getSelectedMemo();

  if (!memo) {
    return;
  }

  const shouldDelete = window.confirm(
    `「${memo.title.trim() || "無題のメモ"}」を削除しますか？`
  );

  if (!shouldDelete) {
    return;
  }

  state.memos = state.memos.filter((item) => item.id !== memo.id);
  selectedMemoId = null;

  if (state.memos.length === 0) {
    createInitialMemo();
  } else {
    selectedMemoId = state.memos[0].id;
  }

  saveState();
  render();
  showMessage("メモを削除しました");
}

function insertText(text) {
  const normalizedText = text.replace(/\\n/g, "\n");
  const start = contentInput.selectionStart;
  const end = contentInput.selectionEnd;
  const current = contentInput.value;

  contentInput.value =
    current.slice(0, start) +
    normalizedText +
    current.slice(end);

  const cursorPosition = start + normalizedText.length;

  contentInput.focus();
  contentInput.setSelectionRange(cursorPosition, cursorPosition);
  updateSelectedMemo();
}

function wrapSelectedText(wrapper) {
  const start = contentInput.selectionStart;
  const end = contentInput.selectionEnd;
  const current = contentInput.value;
  const selectedText = current.slice(start, end);
  const text = selectedText || "文字";
  const replacement = `${wrapper}${text}${wrapper}`;

  contentInput.value =
    current.slice(0, start) + replacement + current.slice(end);

  contentInput.focus();
  contentInput.setSelectionRange(
    start + wrapper.length,
    start + wrapper.length + text.length
  );

  updateSelectedMemo();
}

async function copyMemo() {
  const memo = getSelectedMemo();

  if (!memo) {
    return;
  }

  const copiedText = [
    `# ${memo.title.trim() || "無題のメモ"}`,
    `Creation:${formatDate(memo.createdAt)}`,
    `update:${formatDate(memo.updatedAt)}`,
    "---",
    memo.content
  ].join("\n");

  try {
    await navigator.clipboard.writeText(copiedText);
    showMessage("コピーしました");
    copyButton.textContent = "コピーしました";

    window.setTimeout(() => {
      copyButton.textContent = "コピー";
    }, 1500);
  } catch {
    fallbackCopy(copiedText);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");

  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand("copy");
    showMessage("コピーしました");
  } catch {
    showMessage("コピーできませんでした");
  } finally {
    textarea.remove();
  }
}

function toggleSidebar() {
  const isCollapsed = sidebar.classList.toggle("is-collapsed");
  const isOpen = !isCollapsed;

  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.textContent = isOpen
    ? "メモ一覧を閉じる"
    : "メモ一覧を開く";
}

function collapseSidebarOnMobile() {
  if (
    window.innerWidth <= 760 &&
    !sidebar.classList.contains("is-collapsed")
  ) {
    toggleSidebar();
  }
}

function formatDate(isoString) {
  const date = new Date(isoString);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function showMessage(text) {
  message.textContent = text;

  window.setTimeout(() => {
    message.textContent = "";
  }, 2000);
}
