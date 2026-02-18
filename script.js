document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_LOGO = 'logos/noname.png';

    // Items add form
    const addForm = document.getElementById('addForm');
    const itemsList = document.getElementById('itemsList');
    const search = document.getElementById('search');

    const nameEl = document.getElementById('name');
    const tth1El = document.getElementById('tth1');
    const tth2El = document.getElementById('tth2');
    const qtyEl = document.getElementById('qty');

    const hintName = document.getElementById('hintName');
    const hintTth1 = document.getElementById('hintTth1');
    const hintTth2 = document.getElementById('hintTth2');

    // Operation message
    const opMsg = document.getElementById('opMsg');
    const opMsgText = document.getElementById('opMsgText');
    const opMsgClose = document.getElementById('opMsgClose');

    // Loader and network controls
    const loader = document.getElementById('loader');
    const forceRefreshBtn = document.getElementById('forceRefresh');
    const netDot = document.getElementById('netDot');
    const netText = document.getElementById('netText');

    // Modal
    const catModalEl = document.getElementById('catModal');
    const catModal = new bootstrap.Modal(catModalEl);
    const catModalTitle = document.getElementById('catModalTitle');

    const catSelect = document.getElementById('catSelect');
    const newCat = document.getElementById('newCat');

    const manufSelect2 = document.getElementById('manufSelect2');
    const newManuf = document.getElementById('newManuf');
    const logoFile = document.getElementById('logoFile');
    const removeLogoBtn = document.getElementById('removeLogoBtn');
    const logoPreview = document.getElementById('logoPreview');
    const logoPlaceholder = document.getElementById('logoPlaceholder');

    const saveModal = document.getElementById('saveModal');

    // Movements
    const moveForm = document.getElementById('moveForm');
    const moveItem = document.getElementById('moveItem');
    const moveType = document.getElementById('moveType');
    const moveQty = document.getElementById('moveQty');
    const moveDest = document.getElementById('moveDest');
    const moveTable = document.getElementById('moveTable').querySelector('tbody');

    // Refs tab
    const catForm = document.getElementById('catForm');
    const catName = document.getElementById('catName');
    const catTable = document.getElementById('catTable').querySelector('tbody');

    const manuForm = document.getElementById('manuForm');
    const manuName = document.getElementById('manuName');
    const manuLogo = document.getElementById('manuLogo');
    const manuTable = document.getElementById('manuTable').querySelector('tbody');

    const tabs = document.querySelectorAll('a[data-tab]');

    // State
    let currentItemData = {};
    let editingCells = [];
    let manufacturersCache = []; // {id,name,logo_path}
    let categoriesCache = [];    // {id,name}
    let itemsCache = [];

    let removeLogoRequested = false;

    // modal state
    let modalMode = 'add'; // 'add' | 'editMeta'
    let editMetaItemId = null;

    // autosort suggestions state
    let autoSortActive = false;

    function showLoader(show) {
        loader.classList.toggle('d-none', !show);
    }

    function esc(s) {
        return String(s ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    async function fetchData(action, data = {}, files = {}) {
        showLoader(true);
        try {
            const formData = new FormData();
            formData.append('action', action);
            for (const key in data) {
                if (data[key] === undefined || data[key] === null) continue;
                formData.append(key, data[key]);
            }
            for (const fkey in files) {
                if (files[fkey]) formData.append(fkey, files[fkey]);
            }

            const res = await fetch('api.php', { method: 'POST', body: formData, cache: 'no-store' });
            return await res.json().catch(() => ({error: 'bad_json'}));
        } catch (e) {
            return { error: 'offline' };
        } finally {
            showLoader(false);
        }
    }

    function isDesktop() {
        return window.matchMedia('(min-width: 768px) and (pointer: fine)').matches;
    }

    // ===== Persistent operation message =====
    function loadOpMessage() {
        const dismissed = localStorage.getItem('opMsgDismissed') === '1';
        const txt = localStorage.getItem('opMsgText') || '';
        if (!dismissed && txt) {
            opMsgText.textContent = txt;
            opMsg.classList.remove('d-none');
        }
    }

    function setOpMessage(text) {
        if (!text) return;
        opMsgText.textContent = text;
        opMsg.classList.remove('d-none');
        localStorage.setItem('opMsgText', text);
        localStorage.setItem('opMsgDismissed', '0');
    }

    opMsgClose.addEventListener('click', () => {
        opMsg.classList.add('d-none');
        localStorage.setItem('opMsgDismissed', '1');
    });

    // ===== Online/Offline indicator + force refresh =====
    function updateNetIndicator() {
        const online = navigator.onLine;
        netDot.classList.toggle('net-dot--online', online);
        netDot.classList.toggle('net-dot--offline', !online);
        netText.textContent = online ? 'online' : 'offline';
    }
    window.addEventListener('online', updateNetIndicator);
    window.addEventListener('offline', updateNetIndicator);

    forceRefreshBtn.addEventListener('click', async () => {
        await refreshAll(true);
    });

    // ===== Suggestions =====
    function hideHints() {
        hintName.classList.add('d-none');
        hintTth1.classList.add('d-none');
        hintTth2.classList.add('d-none');
        hintName.innerHTML = '';
        hintTth1.innerHTML = '';
        hintTth2.innerHTML = '';
    }

    function uniqueSorted(arr) {
        const s = new Set();
        for (const x of arr) {
            const v = (x ?? '').toString().trim();
            if (v) s.add(v);
        }
        return Array.from(s).sort((a, b) => a.localeCompare(b, 'ru'));
    }

    function buildHintsForField(field, term) {
        const t = (term || '').toLowerCase().trim();
        if (!t) return [];

        // special: for name field show combo suggestions (name + tth1 + tth2) sorted by (name,tth1,tth2)
        if (field === 'name') {
            const combos = itemsCache
                .map(i => ({
                    name: i.name || '',
                    tth1: i.tth1 || '',
                    tth2: i.tth2 || '',
                }))
                .filter(x => (`${x.name}`.toLowerCase().includes(t)));

            combos.sort((a, b) => {
                const c1 = a.name.localeCompare(b.name, 'ru');
                if (c1) return c1;
                const c2 = a.tth1.localeCompare(b.tth1, 'ru');
                if (c2) return c2;
                return (a.tth2 || '').localeCompare((b.tth2 || ''), 'ru');
            });

            // unique by triple
            const out = [];
            const seen = new Set();
            for (const c of combos) {
                const key = `${c.name}||${c.tth1}||${c.tth2}`;
                if (seen.has(key)) continue;
                seen.add(key);
                out.push(c);
                if (out.length >= 6) break;
            }
            return out;
        }

        const values = itemsCache.map(i => i[field]).filter(Boolean);
        const uniq = uniqueSorted(values);
        return uniq.filter(v => v.toLowerCase().includes(t)).slice(0, 6);
    }

    function renderHintList(container, items, { field }) {
        if (!items || items.length === 0) {
            container.classList.add('d-none');
            container.innerHTML = '';
            return;
        }

        if (field === 'name') {
            container.innerHTML = items.map(c =>
                `<button type="button" class="hint-item" data-name="${esc(c.name)}" data-tth1="${esc(c.tth1)}" data-tth2="${esc(c.tth2)}">
          <div class="hint-main">${esc(c.name)}</div>
          <div class="hint-sub">${esc(c.tth1)}${c.tth2 ? ' • ' + esc(c.tth2) : ''}</div>
        </button>`
            ).join('');
        } else {
            container.innerHTML = items.map(v =>
                `<button type="button" class="hint-item" data-value="${esc(v)}">
          <div class="hint-main">${esc(v)}</div>
        </button>`
            ).join('');
        }

        container.classList.remove('d-none');
    }

    function attachHintClick(container, field) {
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.hint-item');
            if (!btn) return;

            if (field === 'name') {
                nameEl.value = btn.dataset.name || '';
                tth1El.value = btn.dataset.tth1 || '';
                tth2El.value = btn.dataset.tth2 || '';
                autoSortActive = true; // autosort mode engaged while filling
                hideHints();
                tth1El.focus();
                return;
            }

            const v = btn.dataset.value || '';
            if (field === 'tth1') tth1El.value = v;
            if (field === 'tth2') tth2El.value = v;
            autoSortActive = true;
            hideHints();
        });
    }

    attachHintClick(hintName, 'name');
    attachHintClick(hintTth1, 'tth1');
    attachHintClick(hintTth2, 'tth2');

    function onFieldInput(field) {
        if (field === 'name') {
            const items = buildHintsForField('name', nameEl.value);
            renderHintList(hintName, items, { field: 'name' });
        } else if (field === 'tth1') {
            const items = buildHintsForField('tth1', tth1El.value);
            renderHintList(hintTth1, items, { field: 'tth1' });
        } else if (field === 'tth2') {
            const items = buildHintsForField('tth2', tth2El.value);
            renderHintList(hintTth2, items, { field: 'tth2' });
        }
    }

    nameEl.addEventListener('input', () => onFieldInput('name'));
    tth1El.addEventListener('input', () => onFieldInput('tth1'));
    tth2El.addEventListener('input', () => onFieldInput('tth2'));

    document.addEventListener('click', (e) => {
        const inside = e.target.closest('.hint-list') || e.target.closest('#addForm');
        if (!inside) hideHints();
    });

    // ===== Items rendering (grouped) =====
    function renderManufacturerCell({ manufacturer_name, logo_path }) {
        const name = manufacturer_name || '—';
        const logo = logo_path ? esc(logo_path) : DEFAULT_LOGO;
        return `
      <div class="tmc-manu">
        <div class="manu-logo-wrap">
          <img class="manu-logo" src="${logo}" alt="" title="${esc(name)}">
        </div>
      </div>
    `;
    }

    function groupByCategory(items) {
        const map = new Map();
        for (const it of items) {
            const key = (it.category_name || 'Без категории').trim();
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(it);
        }
        return map;
    }

    function renderItemsGrouped(items) {
        const term = (search.value || '').toLowerCase().trim();
        const grouped = groupByCategory(items);

        itemsList.innerHTML = '';

        for (const [catName, catItems] of grouped.entries()) {
            const section = document.createElement('section');
            section.className = 'tmc-cat';

            const h = document.createElement('div');
            h.className = 'tmc-cat-title';
            h.textContent = catName;
            section.appendChild(h);

            const body = document.createElement('div');
            body.className = 'tmc-cat-body';

            let visibleCount = 0;

            for (const item of catItems) {
                const hay = `${item.manufacturer_name ?? ''} ${item.name ?? ''} ${item.tth1 ?? ''} ${item.tth2 ?? ''}`.toLowerCase();
                const match = !term || hay.includes(term);

                const row = document.createElement('div');
                row.className = 'tmc-row';
                row.dataset.id = item.id;
                row.dataset.categoryId = item.category_id;
                row.dataset.manufacturerId = item.manufacturer_id;

                if (parseInt(item.qty, 10) === 0) row.classList.add('tmc-row--zero');

                row.innerHTML = `
          <div class="tmc-col tmc-col--manu">
            ${renderManufacturerCell(item)}
          </div>

          <div class="tmc-col tmc-col--main">
            <div class="tmc-title editable" data-field="name">${esc(item.name)}</div>
            <div class="tmc-sub">
              <span class="editable" data-field="tth1">${esc(item.tth1)}</span>
              <span class="tmc-dot">•</span>
              <span class="editable" data-field="tth2">${esc(item.tth2 || '—')}</span>
            </div>
          </div>

          <div class="tmc-col tmc-col--qty">
            <div class="tmc-qty editable" data-field="qty">${esc(item.qty)}</div>
          </div>

          <div class="tmc-col tmc-col--actions">
            <button class="btn btn-sm btn-outline-secondary meta" title="Изменить категорию/производителя">⚙</button>
            <button class="btn btn-sm btn-danger del"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
            </svg></button>
          </div>
        `;

                row.style.display = match ? '' : 'none';
                if (match) visibleCount++;

                body.appendChild(row);
            }

            section.appendChild(body);
            if (visibleCount === 0) section.style.display = 'none';
            itemsList.appendChild(section);
        }
    }

    // ===== Modal helpers =====
    function fillCategories(categories) {
        categoriesCache = categories || [];
        catSelect.innerHTML = `
      <option value="">Выберите</option>
      <option value="new">Новая категория…</option>
    `;
        categoriesCache.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            catSelect.appendChild(opt);
        });
    }

    function fillManufacturers(manufacturers) {
        manufacturersCache = manufacturers || [];
        manufSelect2.innerHTML = `
      <option value="">Выберите</option>
      <option value="new">Новый производитель…</option>
    `;
        manufacturersCache.forEach(m => {
            const opt = document.createElement('option');
            opt.value = String(m.id);
            opt.textContent = m.name;
            opt.dataset.logo = m.logo_path || DEFAULT_LOGO;
            manufSelect2.appendChild(opt);
        });
    }

    function setLogoPreviewFromPath(path) {
        const p = path || '';
        const has = !!p;
        logoPreview.style.display = has ? 'block' : 'none';
        logoPlaceholder.style.display = has ? 'none' : 'flex';
        if (has) logoPreview.src = p;
    }

    function setLogoPreviewFromFile(file) {
        if (!file) return;
        const url = URL.createObjectURL(file);
        logoPreview.style.display = 'block';
        logoPlaceholder.style.display = 'none';
        logoPreview.src = url;
    }

    function isDefaultLogo(path) {
        const p = (path || '').trim();
        return p.endsWith('/noname.png') || p === DEFAULT_LOGO;
    }

    function syncManufacturerUI() {
        const val = manufSelect2.value;
        removeLogoRequested = false;

        logoFile.value = '';
        logoPreview.removeAttribute('src');

        if (val === 'new') {
            newManuf.classList.remove('d-none');
            newManuf.required = true;
            setLogoPreviewFromPath(DEFAULT_LOGO);
            removeLogoBtn.disabled = true;
            return;
        }

        newManuf.classList.add('d-none');
        newManuf.required = false;

        if (!val) {
            setLogoPreviewFromPath('');
            removeLogoBtn.disabled = true;
            return;
        }

        const opt = manufSelect2.selectedOptions[0];
        const logo = opt?.dataset?.logo || DEFAULT_LOGO;
        setLogoPreviewFromPath(logo);
        removeLogoBtn.disabled = isDefaultLogo(logo);
    }

    async function openMetaModal({ mode, itemId = null, categoryId = null, manufacturerId = null }) {
        modalMode = mode;
        editMetaItemId = itemId;

        catModalTitle.textContent = mode === 'add'
            ? 'Категория и производитель'
            : 'Изменить категорию / производителя';

        const [cats, mans] = await Promise.all([
            fetchData('categories_list'),
            fetchData('manufacturers_list')
        ]);
        if (cats?.error) return alert('Ошибка: ' + cats.error);
        if (mans?.error) return alert('Ошибка: ' + mans.error);

        fillCategories(cats);
        fillManufacturers(mans);

        // reset
        newCat.value = '';
        newCat.classList.add('d-none');
        newCat.required = false;

        newManuf.value = '';
        newManuf.classList.add('d-none');
        newManuf.required = false;

        logoFile.value = '';
        removeLogoRequested = false;

        // preselect:
        if (mode === 'add') {
            const lastCat = localStorage.getItem('lastCatId') || '';
            const lastManu = localStorage.getItem('lastManuId') || '';
            catSelect.value = lastCat || '';
            manufSelect2.value = lastManu || '';
        } else {
            catSelect.value = categoryId ? String(categoryId) : '';
            manufSelect2.value = manufacturerId ? String(manufacturerId) : '';
        }

        syncManufacturerUI();
        catModal.show();
    }

    catSelect.addEventListener('change', (e) => {
        newCat.classList.toggle('d-none', e.target.value !== 'new');
        newCat.required = e.target.value === 'new';
    });

    manufSelect2.addEventListener('change', () => syncManufacturerUI());

    logoFile.addEventListener('change', () => {
        if (logoFile.files?.[0]) {
            removeLogoRequested = false;
            setLogoPreviewFromFile(logoFile.files[0]);
            removeLogoBtn.disabled = true;
        } else {
            syncManufacturerUI();
        }
    });

    removeLogoBtn.addEventListener('click', () => {
        const val = manufSelect2.value;
        if (!val || val === 'new') return;
        if (!confirm('Сбросить логотип на заглушку (noname.png)?')) return;
        removeLogoRequested = true;
        logoFile.value = '';
        setLogoPreviewFromPath(DEFAULT_LOGO);
        removeLogoBtn.disabled = true;
    });

    // ===== Search =====
    search.addEventListener('input', () => renderItemsGrouped(itemsCache));

    function resetSearch() {
        if (search.value) {
            search.value = '';
            renderItemsGrouped(itemsCache);
        }
    }

    // ===== Add form submit =====
    function resetAddForm() {
        addForm.reset();
        qtyEl.value = '1';
        hideHints();
        autoSortActive = false;
    }

    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // autosort during input: normalize order name/tth1/tth2 by trimming
        currentItemData = {
            name: nameEl.value.trim(),
            tth1: tth1El.value.trim(),
            tth2: tth2El.value.trim(),
            qty: qtyEl.value
        };

        const res = await fetchData('pre_add', currentItemData);
        if (res?.error) return alert('Ошибка: ' + res.error);

        // duplicates update flow
        if (res.duplicates?.length > 0) {
            const msg = res.duplicates
                .map(d => `${d.name} (${d.tth1}, ${d.tth2 || '—'}) - кол-во ${d.qty}`)
                .join('\n');

            if (!confirm('Похожие записи:\n' + msg + '\nОбновить?')) return;

            const d = res.duplicates[0];
            const before = { qty: parseInt(d.qty, 10), tth2: d.tth2 || '' };

            const newQty = before.qty + parseInt(currentItemData.qty, 10);
            const newTth2 = (before.tth2 !== (currentItemData.tth2 || '')) ? currentItemData.tth2 : before.tth2;

            const upd = await fetchData('edit', { id: d.id, qty: newQty, tth2: newTth2 });
            if (upd?.error) return alert('Ошибка: ' + upd.error);

            // reset form after successful update
            resetAddForm();

            // reset autosort after add/update
            autoSortActive = false;

            // reset search
            resetSearch();

            // message (п.8)
            const changed = [];
            if (before.qty !== newQty) changed.push(`кол-во ${before.qty} → ${newQty}`);
            if ((before.tth2 || '') !== (newTth2 || '')) changed.push(`ТТХ2 "${before.tth2 || '—'}" → "${newTth2 || '—'}"`);
            setOpMessage(`Запись "${d.name}" обновлена: ${changed.join(', ') || 'изменения применены'}.`);

            await refreshAll();
            return;
        }

        // open modal for category/manufacturer
        await openMetaModal({ mode: 'add' });
    });

    // ===== Save modal (add or edit meta) =====
    saveModal.addEventListener('click', async () => {
        // Category
        let catId = catSelect.value;
        if (!catId) return alert('Выберите категорию');

        if (catId === 'new') {
            const newName = newCat.value.trim();
            if (!newName) return alert('Введите название категории');
            const res = await fetchData('add_category', { name: newName });
            if (res?.error) return alert('Ошибка: ' + res.error);
            catId = res.id;
        }

        // Manufacturer
        let manufId = manufSelect2.value;
        if (!manufId) return alert('Выберите производителя');

        if (manufId === 'new') {
            const mName = newManuf.value.trim();
            if (!mName) return alert('Введите название производителя');
            const res = await fetchData('manufacturer_upsert', { name: mName }, { logo: logoFile.files?.[0] });
            if (res?.error) return alert('Ошибка: ' + res.error);
            manufId = res.id;
        } else {
            const mid = manufId;
            if (removeLogoRequested) {
                const res = await fetchData('manufacturer_remove_logo', { id: mid });
                if (res?.error) return alert('Ошибка: ' + res.error);
            } else if (logoFile.files?.[0]) {
                const res = await fetchData('manufacturer_set_logo', { id: mid }, { logo: logoFile.files[0] });
                if (res?.error) return alert('Ошибка: ' + res.error);
            }
        }

        // remember last used category/manufacturer for add mode
        localStorage.setItem('lastCatId', String(catId));
        localStorage.setItem('lastManuId', String(manufId));

        if (modalMode === 'add') {
            currentItemData.category_id = catId;
            currentItemData.manufacturer_id = manufId;

            const addRes = await fetchData('add', currentItemData);
            if (addRes?.error) return alert('Ошибка: ' + addRes.error);

            catModal.hide();

            // reset autosort after add
            autoSortActive = false;

            // reset search
            resetSearch();

            // message (п.8)
            setOpMessage(`Запись "${currentItemData.name}" добавлена.`);

            // reset form + default qty=1
            resetAddForm();

            await refreshAll();
            return;
        }

        if (modalMode === 'editMeta') {
            const id = editMetaItemId;
            if (!id) return alert('Ошибка: id');

            const before = itemsCache.find(x => String(x.id) === String(id));

            const upd = await fetchData('edit', {
                id,
                category_id: catId,
                manufacturer_id: manufId
            });
            if (upd?.error) return alert('Ошибка: ' + upd.error);

            catModal.hide();

            // reset search
            resetSearch();

            // message
            const beforeCat = before?.category_name || '—';
            const beforeManu = before?.manufacturer_name || '—';
            const afterCat = categoriesCache.find(c => String(c.id) === String(catId))?.name || beforeCat;
            const afterManu = manufacturersCache.find(m => String(m.id) === String(manufId))?.name || beforeManu;
            setOpMessage(`Запись "${before?.name || ''}" изменена: категория "${beforeCat}" → "${afterCat}", производитель "${beforeManu}" → "${afterManu}".`);

            await refreshAll();
        }
    });

    // ===== Inline edit / delete / meta =====
    itemsList.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('.del');
        if (delBtn) {
            if (!confirm('Удалить позицию?')) return;

            const row = delBtn.closest('.tmc-row');
            const id = row.dataset.id;
            const before = itemsCache.find(x => String(x.id) === String(id));

            const res = await fetchData('delete', { id });
            if (res?.error) return alert('Ошибка: ' + res.error);

            // reset search
            resetSearch();

            // message
            setOpMessage(`Запись "${before?.name || '—'}" удалена.`);

            await refreshAll();
            return;
        }

        const metaBtn = e.target.closest('.meta');
        if (metaBtn) {
            const row = metaBtn.closest('.tmc-row');
            await openMetaModal({
                mode: 'editMeta',
                itemId: row.dataset.id,
                categoryId: row.dataset.categoryId,
                manufacturerId: row.dataset.manufacturerId
            });
            return;
        }

        const editable = e.target.closest('.editable');
        if (editable) {
            if (editingCells.length > 0) return;

            const el = editable;
            const original = el.textContent;
            el.dataset.original = original;

            const field = el.dataset.field;
            const input = document.createElement('input');
            input.type = field === 'qty' ? 'number' : 'text';
            if (field === 'qty') {
                input.min = '0';
                input.inputMode = 'numeric';     //numeric keyboard on phones
                input.pattern = '[0-9]*';
            }
            input.value = original === '—' ? '' : original;
            input.classList.add('form-control', 'form-control-sm');
            el.innerHTML = '';
            el.appendChild(input);
            input.focus();

            editingCells.push(el);

            const row = el.closest('.tmc-row');
            const actions = row.querySelector('.tmc-col--actions');
            actions.insertAdjacentHTML(
                'beforeend',
                ' <button class="btn btn-sm btn-success save">✓</button> <button class="btn btn-sm btn-secondary cancel">✗</button>'
            );
            return;
        }

        const saveBtn = e.target.closest('.save');
        if (saveBtn) {
            const row = saveBtn.closest('.tmc-row');
            const id = row.dataset.id;
            const before = itemsCache.find(x => String(x.id) === String(id));

            const data = { id: row.dataset.id };

            editingCells.forEach(cell => {
                const input = cell.querySelector('input');
                data[cell.dataset.field] = input.value;
            });

            const res = await fetchData('edit', data);
            if (res?.error) return alert('Ошибка: ' + res.error);

            // message
            const field = Object.keys(data).find(k => k !== 'id');
            if (field && before) {
                const from = (before[field] ?? '—');
                const to = (data[field] ?? '—');
                setOpMessage(`Запись "${before.name}" изменена: ${field} "${from}" → "${to}".`);
            } else {
                setOpMessage(`Запись обновлена.`);
            }

            // reset search
            resetSearch();

            row.classList.add('success');
            setTimeout(() => row.classList.remove('success'), 1500);

            editingCells = [];
            await refreshAll();
            return;
        }

        const cancelBtn = e.target.closest('.cancel');
        if (cancelBtn) {
            const row = cancelBtn.closest('.tmc-row');
            editingCells.forEach(cell => {
                cell.textContent = cell.dataset.original;
            });
            row.querySelector('.save')?.remove();
            row.querySelector('.cancel')?.remove();
            editingCells = [];
        }
    });

    // ===== Tabs =====
    tabs.forEach(tab => {
        tab.addEventListener('click', async (e) => {
            e.preventDefault();
            tabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');

            const which = e.target.dataset.tab;

            document.getElementById('tab-items').classList.toggle('d-none', which !== 'items');
            document.getElementById('tab-movements').classList.toggle('d-none', which !== 'movements');
            document.getElementById('tab-refs').classList.toggle('d-none', which !== 'refs');

            if (which === 'movements') await loadMovements();
            if (which === 'refs') await loadRefs();

            if (which === 'items' && isDesktop()) search.focus();
        });
    });

    // ===== Movements =====
    // Move type labels for UI
    const MOVE_TYPE_LABELS = {
        install: 'Установлено',
        transfer: 'Передано',
        dispose: 'Утилизировано',
        return: 'Возвращено'
    };

    function moveTypeLabel(code) {
        return MOVE_TYPE_LABELS[code] || code || '—';
    }

    function syncMoveTypeAvailability() {
        const opt = moveItem.selectedOptions?.[0];
        const available = opt ? parseInt(opt.dataset.qty, 10) : NaN;

        const disableSpend = Number.isFinite(available) && available <= 0;
        Array.from(moveType.options).forEach(o => {
            if (!o.value) return;
            if (o.value === 'return') {
                o.disabled = false;
            } else {
                o.disabled = disableSpend;
            }
        });

        if (disableSpend && moveType.value && moveType.value !== 'return') {
            moveType.value = 'return';
        }
    }

    function renderMoveManuCell(m) {
        const logo = m.logo_path ? esc(m.logo_path) : DEFAULT_LOGO;
        const name = m.manufacturer_name || '';
        return `
      <div class="d-flex align-items-center">
        <div class="manu-logo-wrap">
          <img class="manu-logo" src="${logo}" alt="" title="${esc(name)}">
        </div>
      </div>
    `;
    }

    async function loadMovements() {
        const items = await fetchData('list');
        if (items?.error) return;

        moveItem.innerHTML = '<option value="">Выберите</option>';
        items.forEach(i => {
            const opt = document.createElement('option');
            opt.value = i.id;
            opt.textContent = `${i.name} (${i.tth1}) — остаток ${i.qty}`;
            opt.dataset.qty = i.qty;
            moveItem.appendChild(opt);
        });

        const moves = await fetchData('movements_list');
        if (moves?.error) return;

        moveTable.innerHTML = '';
        moves.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td class="col-move-manu">${renderMoveManuCell(m)}</td>
        <td>${esc(m.item_name)} (${esc(m.item_tth1)})</td>
        <td class="text-end">${esc(m.qty)}</td>
        <td>${esc(moveTypeLabel(m.action_type))}</td>
        <td>${esc(m.destination)}</td>
        <td class="text-secondary small">${esc(m.created_at)}</td>
      `;
            moveTable.appendChild(tr);
        });

        syncMoveTypeAvailability();
    }

    moveItem.addEventListener('change', syncMoveTypeAvailability);

    moveForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            item_id: moveItem.value,
            qty: parseInt(moveQty.value, 10),
            action_type: moveType.value,
            destination: moveDest.value.trim()
        };

        if (!data.item_id || !data.qty || data.qty <= 0 || !data.action_type || !data.destination) {
            return alert('Заполните все поля');
        }

        const opt = moveItem.selectedOptions?.[0];
        const available = opt ? parseInt(opt.dataset.qty, 10) : 0;
        if (data.action_type !== 'return' && data.qty > available) return alert('Нет столько на складе');

        const res = await fetchData('add_movement', data);
        if (res?.error) {
            if (res.error === 'not_enough_qty') return alert('Недостаточно остатка');
            if (res.error === 'offline') return alert('Оффлайн: движения недоступны');
            return alert('Ошибка: ' + res.error);
        }

        setOpMessage(`Движение добавлено: ${moveTypeLabel(data.action_type)}, ${data.qty} шт.`);
        await refreshAll();
        moveForm.reset();
    });

    // ===== Refs (categories/manufacturers CRUD) =====
    function renderRefs() {
        // categories
        catTable.innerHTML = '';
        categoriesCache.forEach(c => {
            const tr = document.createElement('tr');
            tr.dataset.id = c.id;
            tr.innerHTML = `
        <td>
          <input class="form-control form-control-sm ref-input" data-kind="cat" value="${esc(c.name)}">
        </td>
        <td>
          <button class="btn btn-sm btn-success ref-save" data-kind="cat">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-floppy" viewBox="0 0 16 16">
               <path d="M11 2H9v3h2z"/>
               <path d="M1.5 0h11.586a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0M1 1.5v13a.5.5 0 0 0 .5.5H2v-4.5A1.5 1.5 0 0 1 3.5 9h9a1.5 1.5 0 0 1 1.5 1.5V15h.5a.5.5 0 0 0 .5-.5V2.914a.5.5 0 0 0-.146-.353l-1.415-1.415A.5.5 0 0 0 13.086 1H13v4.5A1.5 1.5 0 0 1 11.5 7h-7A1.5 1.5 0 0 1 3 5.5V1H1.5a.5.5 0 0 0-.5.5m3 4a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V1H4zM3 15h10v-4.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5z"/>
             </svg>
</button>
          <button class="btn btn-sm btn-danger ref-del" data-kind="cat">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
            </svg>
</button>
        </td>
      `;
            catTable.appendChild(tr);
        });

        // manufacturers
        manuTable.innerHTML = '';
        manufacturersCache.forEach(m => {
            const tr = document.createElement('tr');
            tr.dataset.id = m.id;
            const logo = m.logo_path || DEFAULT_LOGO;
            tr.innerHTML = `
        <td>
          <div class="manu-logo-wrap">
            <img class="manu-logo" src="${esc(logo)}" alt="">
          </div>
        </td>
        <td>
          <input class="form-control form-control-sm ref-input" data-kind="manu" value="${esc(m.name)}">
        </td>
        <td class="d-flex flex-wrap gap-2">
          <input type="file" class="form-control form-control-sm ref-file" data-kind="manu" accept="image/*" style="max-width: 220px;">
          <button class="btn btn-sm btn-outline-secondary ref-logo" data-action="set">Лого</button>
          <button class="btn btn-sm btn-outline-secondary ref-logo" data-action="reset">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-lg" viewBox="0 0 16 16">
              <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/>
            </svg>
          </button>
          <button class="btn btn-sm btn-success ref-save" data-kind="manu">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-floppy" viewBox="0 0 16 16">
               <path d="M11 2H9v3h2z"/>
               <path d="M1.5 0h11.586a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 16 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 14.5v-13A1.5 1.5 0 0 1 1.5 0M1 1.5v13a.5.5 0 0 0 .5.5H2v-4.5A1.5 1.5 0 0 1 3.5 9h9a1.5 1.5 0 0 1 1.5 1.5V15h.5a.5.5 0 0 0 .5-.5V2.914a.5.5 0 0 0-.146-.353l-1.415-1.415A.5.5 0 0 0 13.086 1H13v4.5A1.5 1.5 0 0 1 11.5 7h-7A1.5 1.5 0 0 1 3 5.5V1H1.5a.5.5 0 0 0-.5.5m3 4a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V1H4zM3 15h10v-4.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5z"/>
             </svg>
          </button>
          <button class="btn btn-sm btn-danger ref-del" data-kind="manu">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash3" viewBox="0 0 16 16">
              <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm1.958 1-.846 10.58a1 1 0 0 1-.997.92h-6.23a1 1 0 0 1-.997-.92L3.042 3.5zm-7.487 1a.5.5 0 0 1 .528.47l.5 8.5a.5.5 0 0 1-.998.06L5 5.03a.5.5 0 0 1 .47-.53Zm5.058 0a.5.5 0 0 1 .47.53l-.5 8.5a.5.5 0 1 1-.998-.06l.5-8.5a.5.5 0 0 1 .528-.47M8 4.5a.5.5 0 0 1 .5.5v8.5a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5"/>
            </svg>
          </button>
        </td>
      `;
            manuTable.appendChild(tr);
        });
    }

    async function loadRefs() {
        const [cats, mans] = await Promise.all([
            fetchData('categories_list'),
            fetchData('manufacturers_list')
        ]);
        if (cats?.error) return alert('Ошибка: ' + cats.error);
        if (mans?.error) return alert('Ошибка: ' + mans.error);

        categoriesCache = cats;
        manufacturersCache = mans;
        renderRefs();
    }

    catForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const n = catName.value.trim();
        if (!n) return;

        const res = await fetchData('add_category', { name: n });
        if (res?.error) return alert('Ошибка: ' + res.error);

        setOpMessage(`Категория "${n}" добавлена.`);
        catName.value = '';
        await refreshAll();
        await loadRefs();
    });

    catTable.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.dataset.id;

        const save = e.target.closest('.ref-save');
        const del = e.target.closest('.ref-del');

        if (save) {
            const inp = row.querySelector('.ref-input');
            const name = inp.value.trim();
            if (!name) return alert('Пустое имя');

            const res = await fetchData('category_update', { id, name });
            if (res?.error) return alert('Ошибка: ' + res.error);

            setOpMessage(`Категория обновлена: "${name}".`);
            await refreshAll();
            await loadRefs();
        }

        if (del) {
            if (!confirm('Удалить категорию?')) return;
            const res = await fetchData('category_delete', { id });
            if (res?.error) return alert(res.error === 'in_use' ? 'Категория используется в позициях.' : ('Ошибка: ' + res.error));
            setOpMessage(`Категория удалена.`);
            await refreshAll();
            await loadRefs();
        }
    });

    manuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const n = manuName.value.trim();
        if (!n) return;

        const res = await fetchData('manufacturer_upsert', { name: n }, { logo: manuLogo.files?.[0] });
        if (res?.error) return alert('Ошибка: ' + res.error);

        setOpMessage(`Производитель "${n}" добавлен.`);
        manuName.value = '';
        manuLogo.value = '';
        await refreshAll();
        await loadRefs();
    });

    manuTable.addEventListener('click', async (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        const id = row.dataset.id;

        const save = e.target.closest('.ref-save');
        const del = e.target.closest('.ref-del');
        const logoBtn = e.target.closest('.ref-logo');

        if (logoBtn) {
            const action = logoBtn.dataset.action;
            if (action === 'reset') {
                const res = await fetchData('manufacturer_remove_logo', { id });
                if (res?.error) return alert('Ошибка: ' + res.error);
                setOpMessage(`Лого производителя сброшено на noname.`);
                await refreshAll();
                await loadRefs();
            } else if (action === 'set') {
                const file = row.querySelector('.ref-file')?.files?.[0];
                if (!file) return alert('Выберите файл лого');
                const res = await fetchData('manufacturer_set_logo', { id }, { logo: file });
                if (res?.error) return alert('Ошибка: ' + res.error);
                setOpMessage(`Лого производителя обновлено.`);
                await refreshAll();
                await loadRefs();
            }
            return;
        }

        if (save) {
            const inp = row.querySelector('.ref-input');
            const name = inp.value.trim();
            if (!name) return alert('Пустое имя');

            const res = await fetchData('manufacturer_update', { id, name });
            if (res?.error) return alert('Ошибка: ' + res.error);

            setOpMessage(`Производитель обновлён: "${name}".`);
            await refreshAll();
            await loadRefs();
            return;
        }

        if (del) {
            if (!confirm('Удалить производителя?')) return;
            const res = await fetchData('manufacturer_delete', { id });
            if (res?.error) return alert(res.error === 'in_use' ? 'Производитель используется в позициях.' : ('Ошибка: ' + res.error));
            setOpMessage(`Производитель удалён.`);
            await refreshAll();
            await loadRefs();
        }
    });

    // ===== Refresh orchestration =====
    async function loadItems() {
        const items = await fetchData('list');
        if (items?.error) return;
        itemsCache = Array.isArray(items) ? items : [];
        renderItemsGrouped(itemsCache);

        // desktop focus search by default
        if (isDesktop()) search.focus();
    }

    async function refreshAll(force = false) {
        // force=true used by button; otherwise normal refresh
        updateNetIndicator();

        // when offline: still try to render cached UI; api will return offline error
        await loadItems();
        await loadMovements();
        if (force) setOpMessage('Данные обновлены.');
    }

    // ===== Init =====
    updateNetIndicator();
    loadOpMessage();
    refreshAll();

    // default: desktop focus search
    if (isDesktop()) search.focus();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
});
