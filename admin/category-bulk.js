(function(){
  "use strict";

  const config = window.CATEGORY_BULK_CONFIG || {};
  const INITIAL_ROWS = 30;
  const MAX_ROWS = 30;
  const API_ORIGIN = location.protocol === "file:" ? "https://gnlaw-criminal.co.kr" : "";
  const tbody = document.getElementById("bulkRows");
  const createButton = document.getElementById("bulkCreateButton");
  const refreshButton = document.getElementById("bulkRefreshButton");
  const selectAllButton = document.getElementById("bulkSelectAllButton");
  const clearAllButton = document.getElementById("bulkClearAllButton");
  const message = document.getElementById("bulkMessage");
  const progress = document.getElementById("bulkProgress");
  const progressBar = document.getElementById("bulkProgressBar");
  const progressText = document.getElementById("bulkProgressText");
  let isCreating = false;

  if (!tbody || !createButton || !config.endpoint) return;

  function createRows(){
    tbody.innerHTML = "";
    for (let index = 1; index <= INITIAL_ROWS; index += 1) {
      const row = document.createElement("tr");
      row.id = `bulk-row-${index}`;
      row.innerHTML = `
        <td>${index}</td>
        <td><input type="text" id="bulk-value-${index}" placeholder="${escapeAttribute(config.placeholder || "생성할 제목 입력")}" autocomplete="off"></td>
        ${renderTypeCell(index)}
        <td><input type="text" id="bulk-slug-${index}" placeholder="비워두면 자동 생성" autocomplete="off"></td>
        <td style="text-align:center"><input type="checkbox" id="bulk-select-${index}" aria-label="${index}번 항목 생성" disabled></td>
        <td class="bulk-result" id="bulk-result-${index}"></td>`;
      tbody.appendChild(row);

      const input = document.getElementById(`bulk-value-${index}`);
      const checkbox = document.getElementById(`bulk-select-${index}`);
      input.addEventListener("input", function(){
        const hasValue = Boolean(clean(input.value));
        checkbox.disabled = !hasValue;
        checkbox.checked = hasValue;
        clearResult(index);
        updateCreateButton();
      });
      document.getElementById(`bulk-slug-${index}`).addEventListener("input", function(event){
        event.target.value = normalizeSlug(event.target.value);
        clearResult(index);
      });
      const type = document.getElementById(`bulk-type-${index}`);
      if (type) type.addEventListener("change", function(){ clearResult(index); });
      checkbox.addEventListener("change", updateCreateButton);
    }
    updateCreateButton();
    hideProgress();
  }

  function renderTypeCell(index){
    const options = Array.isArray(config.typeOptions) ? config.typeOptions : [];
    if (!options.length) return "";
    return `<td><select id="bulk-type-${index}" aria-label="${index}번 유형">${options.map(function(option){
      return `<option value="${escapeAttribute(option.value)}">${escapeHtml(option.label)}</option>`;
    }).join("")}</select></td>`;
  }

  function collectSelected(){
    const items = [];
    for (let index = 1; index <= MAX_ROWS; index += 1) {
      const input = document.getElementById(`bulk-value-${index}`);
      const checkbox = document.getElementById(`bulk-select-${index}`);
      if (!input || !checkbox || checkbox.disabled || !checkbox.checked) continue;
      const value = clean(input.value);
      if (!value) continue;
      const slug = normalizeSlug(document.getElementById(`bulk-slug-${index}`)?.value || "");
      const type = document.getElementById(`bulk-type-${index}`)?.value || "";
      items.push({ index, value, slug, type });
    }
    return items;
  }

  function buildPayload(item){
    if (config.mode === "readingroom") {
      return { caseName: item.value, type: item.type, ...(item.slug ? { slug: item.slug } : {}), batchMode: true };
    }
    return { title: item.value, ...(item.slug ? { slug: item.slug } : {}), batchMode: true };
  }

  async function runBulkCreate(){
    if (isCreating) return;
    const items = collectSelected();
    if (!items.length) {
      setMessage("생성할 항목을 1개 이상 입력하고 선택하세요.", "err");
      return;
    }

    isCreating = true;
    setControlsDisabled(true);
    showProgress(0, items.length);
    let success = 0;
    let failed = 0;

    for (let position = 0; position < items.length; position += 1) {
      const item = items[position];
      const row = document.getElementById(`bulk-row-${item.index}`);
      const result = document.getElementById(`bulk-result-${item.index}`);
      result.innerHTML = '<span class="result-pending">생성 중...</span>';
      setMessage(`${position + 1} / ${items.length} 생성 중...`, "info");

      try {
        const response = await postJson(config.endpoint, buildPayload(item));
        if (!response.data.ok) throw new Error(response.data.message || `생성 실패 (HTTP ${response.status})`);
        success += 1;
        row.className = "done-ok";
        renderSuccess(result, response.data.url, response.data.message || "생성 완료");
      } catch (error) {
        failed += 1;
        row.className = "done-err";
        result.innerHTML = `<span class="result-err">❌ ${escapeHtml(String(error.message || error).slice(0, 90))}</span>`;
      }

      showProgress(position + 1, items.length);
      if (position + 1 < items.length) await sleep(650);
    }

    if (success > 0) {
      setMessage(`생성 ${success}건 완료. 저장소 동기화 중...`, "info");
      await sleep(1200);
      try {
        const sync = await postJson("/api/sync-kv-to-github", {});
        if (!sync.data.ok) throw new Error(sync.data.message || "저장소 동기화 실패");
        setMessage(`완료: ${success}건 생성${failed ? `, ${failed}건 오류` : ""} · GitHub 동기화 완료`, failed ? "warn" : "ok");
      } catch (error) {
        setMessage(`생성 ${success}건 완료${failed ? `, ${failed}건 오류` : ""}. GitHub 동기화는 확인이 필요합니다: ${error.message}`, "warn");
      }
    } else {
      setMessage(`생성 실패: ${failed}건의 오류 내용을 확인하세요.`, "err");
    }

    isCreating = false;
    setControlsDisabled(false);
    updateCreateButton();
  }

  async function postJson(path, payload, attempt){
    const retry = Number(attempt || 0);
    const response = await fetch(API_ORIGIN + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload || {}),
    });
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      if (response.status === 503 && retry < 2) {
        await sleep(900 * (retry + 1));
        return postJson(path, payload, retry + 1);
      }
      throw new Error(`서버 응답 파싱 실패 (HTTP ${response.status})${text ? `: ${text.slice(0, 80)}` : ""}`);
    }
    if (response.status === 503 && retry < 2) {
      await sleep(900 * (retry + 1));
      return postJson(path, payload, retry + 1);
    }
    return { status: response.status, data };
  }

  function renderSuccess(target, url, label){
    target.innerHTML = `<span class="result-ok">✅ ${escapeHtml(label)}</span>`;
    if (!url) return;
    const actions = document.createElement("div");
    actions.className = "result-actions";
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "보기";
    actions.appendChild(link);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy-url-btn";
    copy.textContent = "URL 복사";
    copy.addEventListener("click", async function(){
      const copied = await copyText(url);
      copy.textContent = copied ? "복사됨" : "복사 실패";
      setTimeout(function(){ copy.textContent = "URL 복사"; }, 1400);
    });
    actions.appendChild(copy);
    target.appendChild(actions);
  }

  async function copyText(value){
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }

  function selectAll(value){
    for (let index = 1; index <= MAX_ROWS; index += 1) {
      const checkbox = document.getElementById(`bulk-select-${index}`);
      if (checkbox && !checkbox.disabled) checkbox.checked = value;
    }
    updateCreateButton();
  }

  function resetRows(){
    if (isCreating) return;
    createRows();
    setMessage("새로운 30개 입력 항목을 불러왔습니다.", "info");
    document.getElementById("bulk-value-1")?.focus();
  }

  function clearResult(index){
    const row = document.getElementById(`bulk-row-${index}`);
    const result = document.getElementById(`bulk-result-${index}`);
    if (row) row.className = "";
    if (result) result.innerHTML = "";
  }

  function setControlsDisabled(disabled){
    createButton.disabled = disabled;
    refreshButton.disabled = disabled;
    selectAllButton.disabled = disabled;
    clearAllButton.disabled = disabled;
  }

  function updateCreateButton(){
    createButton.disabled = isCreating || collectSelected().length === 0;
  }

  function showProgress(done, total){
    progress.style.display = "flex";
    const percent = total ? Math.round((done / total) * 100) : 0;
    progressBar.style.width = `${percent}%`;
    progressText.textContent = `${done} / ${total} (${percent}%)`;
  }

  function hideProgress(){
    progress.style.display = "none";
    progressBar.style.width = "0%";
    progressText.textContent = "";
  }

  function setMessage(text, type){
    message.textContent = text;
    message.className = `bulk-message ${type || ""}`;
  }

  function normalizeSlug(value){
    return String(value || "").trim().toLowerCase().replace(/[–—]/g, "-").replace(/[^a-z0-9가-힣_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 90);
  }

  function clean(value){ return String(value || "").trim().replace(/\s+/g, " "); }
  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function escapeHtml(value){ return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function escapeAttribute(value){ return escapeHtml(value).replace(/"/g, "&quot;"); }

  createButton.addEventListener("click", runBulkCreate);
  refreshButton.addEventListener("click", resetRows);
  selectAllButton.addEventListener("click", function(){ selectAll(true); });
  clearAllButton.addEventListener("click", function(){ selectAll(false); });
  createRows();
})();
